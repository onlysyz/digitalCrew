"""
GraphEngine - State machine engine for graph-based supervisor execution.
"""

import asyncio
import time
import structlog
from pathlib import Path
from typing import Callable, Optional, AsyncIterator

from backend.services.graph.state import GraphState
from backend.services.graph.events import GraphEvent
from backend.services.graph.nodes import (
    plan_node,
    execute_node,
    integrate_node,
    route_after_plan,
    route_after_execute,
)
from backend.services.graph.checkpoint import CheckpointStore

logger = structlog.get_logger()


class GraphEngine:
    """
    State machine engine that executes a graph of nodes.

    Nodes are functions: async def node(state, emit) -> dict (partial state delta)
    Edges connect nodes; conditional edges decide next node based on state.
    """

    def __init__(self, checkpoint_db: Optional[Path] = None) -> None:
        self._nodes: dict[str, Callable] = {}
        self._edges: dict[str, str | Callable] = {}
        self._interrupt_nodes: set[str] = set()
        self._checkpoint_store: Optional[CheckpointStore] = (
            CheckpointStore(checkpoint_db) if checkpoint_db else None
        )
        self._pending_engines: dict[str, "GraphEngine"] = {}
        self._pending_states: dict[str, GraphState] = {}
        self._event_queues: dict[str, asyncio.Queue] = {}

    def add_node(self, name: str, fn: Callable) -> None:
        self._nodes[name] = fn

    def add_edge(self, from_node: str, to_node: str) -> None:
        self._edges[from_node] = to_node

    def add_conditional_edge(self, from_node: str, routing_fn: Callable) -> None:
        self._edges[from_node] = routing_fn

    def add_interrupt(self, node_name: str) -> None:
        self._interrupt_nodes.add(node_name)

    def get_pending_engine(self, thread_id: str) -> Optional["GraphEngine"]:
        return self._pending_engines.get(thread_id)

    def get_pending_state(self, thread_id: str) -> Optional[GraphState]:
        """Get the last state for a thread (for resume)."""
        return self._pending_states.get(thread_id)

    async def execute(
        self,
        initial_state: GraphState,
        emit: Callable,
    ) -> AsyncIterator[GraphState]:
        """
        Execute the graph from START node until END.

        Args:
            initial_state: Starting state for the graph
            emit: Callback to emit GraphEvent to frontend

        Returns:
            AsyncIterator of GraphState snapshots (yielded after each node)
        """
        thread_id = initial_state.get("thread_id", "")

        # Register engine for potential resume
        if thread_id:
            self._pending_engines[thread_id] = self

        # Build default graph if not configured
        if "plan" not in self._nodes:
            self._nodes["plan"] = plan_node
        if "execute" not in self._nodes:
            self._nodes["execute"] = execute_node
        if "integrate" not in self._nodes:
            self._nodes["integrate"] = integrate_node
        if "plan" not in self._edges:
            self._edges["plan"] = route_after_plan
        if "execute" not in self._edges:
            self._edges["execute"] = route_after_execute

        state = initial_state
        current = "plan"
        step = 0

        while current != "END":
            # Check for pending intervention before executing each node
            if thread_id:
                self._pending_states[thread_id] = state

            if current in self._interrupt_nodes:
                # Save checkpoint before interrupt
                if self._checkpoint_store:
                    self._checkpoint_store.save(thread_id, step, dict(state))
                # Emit interrupt event and wait for resume
                await emit(GraphEvent(
                    type="interrupt",
                    node=current,
                    state_delta={"thread_id": thread_id, "current_step": step, "status": state.get("status", "")},
                ))
                # Wait for user resume and apply any modifications
                intervention = await self._wait_for_resume(thread_id)
                if intervention:
                    # User modified state - apply modifications
                    if "goal" in intervention:
                        state = {**state, "goal": intervention["goal"]}
                    if "replan" in intervention and intervention["replan"]:
                        # User wants to replan - reset to plan node
                        current = "plan"
                        step = 0
                        state = {**state, "plan": [], "current_step": 0, "status": "planning"}
                        continue

            node_fn = self._nodes.get(current)
            if not node_fn:
                logger.error("node_not_found", node=current)
                break

            # Emit node_start event (handle async generator emit)
            node_start_result = emit(GraphEvent(type="node_start", node=current))
            if asyncio.iscoroutine(node_start_result):
                result = await node_start_result
                if isinstance(result, dict):
                    yield result
            else:
                async for item in node_start_result:
                    yield item

            # Execute node and get state delta (node may be async generator)
            node_result = node_fn(state, emit)
            if asyncio.iscoroutine(node_result):
                delta = await node_result
                state = {**state, **delta}
            else:
                # Async generator - iterate and yield events
                async for node_delta in node_result:
                    state = {**state, **node_delta}
                    yield node_delta
                delta = state  # Last yielded delta used for state_update below

            # Emit state_update
            event_result = emit(GraphEvent(
                type="state_update",
                node=current,
                state_delta=delta,
            ))
            if asyncio.iscoroutine(event_result):
                result = await event_result
                if isinstance(result, dict):
                    yield result
            else:
                async for item in event_result:
                    yield item

            # Emit any pending stream events from node execution
            pending_events = delta.get("_pending_events", [])
            for pe in pending_events:
                event_result = emit(GraphEvent(
                    type=pe.get("type", "stream_token"),
                    agent_id=pe.get("agent_id"),
                    subtask_id=pe.get("subtask_id"),
                    token=pe.get("token"),
                ))
                if asyncio.iscoroutine(event_result):
                    result = await event_result
                    if isinstance(result, dict):
                        yield result
                else:
                    async for item in event_result:
                        yield item

            # Save checkpoint after node execution
            if self._checkpoint_store:
                self._checkpoint_store.save(thread_id, step, dict(state))
            step += 1

            # Route to next node
            edge = self._edges.get(current, "END")
            if callable(edge):
                if asyncio.iscoroutinefunction(edge):
                    current = await edge(state)
                else:
                    current = edge(state)
            else:
                current = edge

            if current == "END":
                done_result = emit(GraphEvent(type="done", node=None))
                if asyncio.iscoroutine(done_result):
                    await done_result
                else:
                    async for item in done_result:
                        yield item
                # Clear pending state on completion
                if thread_id and thread_id in self._pending_states:
                    del self._pending_states[thread_id]

        # async generator must use bare return
        return

    async def _wait_for_resume(self, thread_id: str) -> Optional[dict]:
        """Wait for user intervention and return the intervention data."""
        from backend.services.supervisor import supervisor_runtime

        timeout = 300  # 5 minutes
        start = time.time()

        while time.time() - start < timeout:
            intervention = supervisor_runtime.get_intervention(thread_id)
            if intervention:
                return intervention
            await asyncio.sleep(0.5)

        return None


def create_default_engine(checkpoint_db: Optional[Path] = None) -> GraphEngine:
    """Create a GraphEngine with default supervisor graph wired up."""
    engine = GraphEngine(checkpoint_db)
    return engine
