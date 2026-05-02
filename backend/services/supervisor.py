"""
Supervisor Agent Runtime - Multi-agent orchestration
"""
import asyncio
from typing import Any, AsyncIterator, Optional

import structlog

from backend.models.schemas import AgentConfig, AgentStatus, AgentRole, ReActStep, Task, ModelConfig
from backend.services.agent_manager import agent_manager
from backend.services.react_recorder import react_recorder
from backend.services.llm_router import llm_router, RateLimitError
from backend.services.graph.state import GraphState, SubAgentContext
from backend.services.graph.engine import create_default_engine
from backend.services.graph.nodes import plan_node, execute_node, integrate_node, route_after_plan, route_after_execute
from backend.services.graph.events import GraphEvent

logger = structlog.get_logger()


class SupervisorRuntime:
    """
    Executes the supervisor pattern: decomposes user goals into subtasks,
    dispatches to worker agents, collects results, and integrates into final output.
    """

    def __init__(self):
        self._max_parallel_tasks = 5
        self._retry_policy = {
            "max_retries": 1,
            "backoff_base": 2.0,
            "backoff_max": 30.0,
        }
        self._cancellation_requests: dict[str, asyncio.Event] = {}
        self._intervention_requests: dict[str, dict] = {}

    def request_cancellation(self, task_id: str) -> bool:
        """Request cancellation for a running task."""
        if task_id in self._cancellation_requests:
            self._cancellation_requests[task_id].set()
            return True
        return False

    def submit_intervention(self, thread_id: str, input_data: dict) -> None:
        """Submit user intervention for a running thread."""
        self._intervention_requests[thread_id] = input_data

    def get_intervention(self, thread_id: str) -> Optional[dict]:
        """Get and clear pending intervention for a thread."""
        return self._intervention_requests.pop(thread_id, None)

    def _is_cancelled(self, task_id: str) -> bool:
        """Check if cancellation was requested for this task."""
        if task_id in self._cancellation_requests:
            return self._cancellation_requests[task_id].is_set()
        return False

    async def execute(
        self,
        goal: str,
        available_agents: list[AgentConfig],
        task_id: str,
    ) -> AsyncIterator[dict]:
        """
        Main supervisor execution flow via GraphEngine.
        Yields progress events as the execution proceeds.

        1. Build initial GraphState
        2. Execute via GraphEngine (plan → execute → integrate)
        3. Yield events adapted from GraphEvent to legacy dict format
        """
        import uuid
        from backend.services.graph.state import SubAgentContext
        from backend.services.graph.engine import create_default_engine

        logger.info("supervisor_execution_started", goal=goal[:100], task_id=task_id)

        # Set up cancellation
        cancel_event = asyncio.Event()
        self._cancellation_requests[task_id] = cancel_event

        thread_id = str(uuid.uuid4())

        try:
            # Build initial state
            initial_state: GraphState = {
                "thread_id": thread_id,
                "goal": goal,
                "plan": [],
                "current_step": 0,
                "results": {},
                "raw_outputs": {},
                "status": "planning",
                "error": None,
                "context": SubAgentContext(goal=goal),
                "available_agents": available_agents,
            }

            # Convert GraphEvent to legacy dict format
            async def emit(event: GraphEvent):
                event_dict = event.model_dump(exclude_none=True)
                # Remove original type from event_dict since we're replacing it
                event_dict.pop("type", None)
                # Map GraphEvent types to legacy types
                type_map = {
                    "state_update": "status",
                    "node_start": "status",
                    "node_end": "status",
                    "stream_token": "subtask_token",
                    "subtask_start": "subtask_start",
                    "subtask_complete": "subtask_complete",
                    "subtask_error": "subtask_error",
                    "subtask_progress": "status",
                    "status": "status",
                    "react_step": "react_step",
                    "interrupt": "status",
                    "done": "done",
                    "error": "error",
                }
                legacy_type = type_map.get(event.type, event.type)
                out = {"type": legacy_type, **event_dict}
                logger.info("supervisor_emit", event_type=event.type, legacy_type=legacy_type, out_type=out.get("type"))
                # Yield the dict so engine can iterate and yield all events
                yield out

            # Create engine and execute
            engine = create_default_engine()
            engine.add_node("plan", plan_node)
            engine.add_node("execute", execute_node)
            engine.add_node("integrate", integrate_node)
            engine.add_edge("plan", route_after_plan)
            engine.add_edge("execute", route_after_execute)

            async for event in engine.execute(initial_state, emit):
                if self._is_cancelled(task_id):
                    yield {"type": "cancelled", "content": "任务已被用户取消"}
                    break
                yield event

        finally:
            self._cancellation_requests.pop(task_id, None)




# Global singleton
supervisor_runtime = SupervisorRuntime()