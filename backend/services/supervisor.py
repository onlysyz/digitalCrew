"""
Supervisor Agent Runtime - Multi-agent orchestration
"""
import asyncio
from typing import Any, AsyncIterator, Optional

import structlog

from backend.models.schemas import AgentConfig, AgentStatus, AgentRole, ReActStep, Task, ModelConfig
from backend.services.agent_manager import agent_manager
from backend.services.task_scheduler import task_scheduler
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

    async def _execute_plan_gen(
        self,
        plan: dict[str, Any],
        task_id: str,
        available_agents: list[AgentConfig],
    ) -> AsyncIterator[dict]:
        """Execute the plan, yielding progress events."""
        subtasks_list = plan.get("subtasks", []) if isinstance(plan, dict) else plan if isinstance(plan, list) else []
        results: dict[str, Any] = {}

        groups: dict[int, list[dict]] = {}
        for subtask in subtasks_list:
            if not isinstance(subtask, dict):
                logger.warning("skipping_invalid_subtask", expected="dict", got=type(subtask).__name__)
                continue
            task_id_str = subtask.get("task_id")
            if not isinstance(task_id_str, str):
                logger.warning("skipping_subtask_invalid_task_id", task_id=str(task_id_str)[:50])
                continue
            group = subtask.get("parallel_group", 1)
            if group not in groups:
                groups[group] = []
            groups[group].append(subtask)

        for group_num in sorted(groups.keys()):
            group_tasks = groups[group_num]

            logger.info("executing_task_group", group=group_num, task_count=len(group_tasks))
            yield {"type": "status", "content": f"执行第 {group_num} 组任务，共 {len(group_tasks)} 个"}

            step = await task_scheduler.add_react_step(
                task_id=task_id,
                agent_id="supervisor",
                thought=f"Starting group {group_num} with {len(group_tasks)} parallel tasks",
                action=f"execute_group_{group_num}",
            )
            yield {"type": "react_step", "step": {
                "step_id": step.step_id,
                "agent_id": "supervisor",
                "thought": step.thought,
                "action": step.action,
                "observation": step.observation,
            }}

            # Emit subtask_start for each agent in this group
            for subtask in group_tasks:
                target_agent_name = subtask.get("target_agent", "")
                agent_info = next((a for a in available_agents if a.name == target_agent_name), available_agents[0] if available_agents else None)
                if agent_info:
                    yield {"type": "subtask_start", "agent_id": agent_info.id, "agent_name": agent_info.name}

            # Execute all tasks in this group concurrently, collecting tokens
            task_outputs: dict[str, str] = {}
            shared_queue: asyncio.Queue[dict] = asyncio.Queue()
            pending_workers: set[asyncio.Task] = set()

            async def run_subtask_worker(subtask):
                """Run a subtask and put its events in the shared queue."""
                subtask_id_str = subtask["task_id"]
                tokens = []
                try:
                    async for token_event in self._execute_subtask_gen(subtask, results, task_id, available_agents, group_num):
                        await shared_queue.put(token_event)
                        if token_event.get("type") == "subtask_token":
                            tokens.append(token_event.get("token", ""))
                    output = "".join(tokens)
                    results[subtask_id_str] = {"status": "completed", "output": output}
                    task_outputs[subtask_id_str] = output
                except Exception as e:
                    logger.error("subtask_worker_error", subtask_id=subtask_id_str, error=str(e))
                    task_outputs[subtask_id_str] = ""
                    results[subtask_id_str] = {"status": "failed", "error": str(e)}

            # Start all worker tasks
            workers = [asyncio.create_task(run_subtask_worker(subtask)) for subtask in group_tasks]
            pending_workers = set(workers)

            # Process events from the queue while workers are running
            queue_get_task = None
            while pending_workers:
                # Create queue get task only if not exists
                if queue_get_task is None:
                    queue_get_task = asyncio.create_task(shared_queue.get())

                done, _ = await asyncio.wait(
                    [queue_get_task] + list(pending_workers),
                    return_when=asyncio.FIRST_COMPLETED
                )

                for completed in done:
                    # Check if this is the queue get task by identity
                    if queue_get_task is not None and completed == queue_get_task:
                        # A queue get completed
                        queue_get_task = None  # Reset so we create a new one
                        try:
                            result = completed.result()
                            if result is not None:
                                yield result
                        except asyncio.CancelledError:
                            pass
                        except Exception as e:
                            logger.warning("queue_get_error", error=str(e))
                    else:
                        # A worker completed - remove from pending_workers
                        pending_workers.discard(completed)

            # Cancel any pending queue get task
            if queue_get_task and not queue_get_task.done():
                queue_get_task.cancel()
                try:
                    await queue_get_task
                except asyncio.CancelledError:
                    pass

            # Drain any remaining events in the queue
            while not shared_queue.empty():
                try:
                    event = shared_queue.get_nowait()
                    yield event
                except asyncio.QueueEmpty:
                    break

        # Always yield results_ready, even if groups was empty
        if not groups:
            logger.info("no_groups_in_plan", plan_keys=list(plan.keys()) if isinstance(plan, dict) else "list")

        yield {"type": "results_ready", "results": results}
        logger.info("results_ready_yielded", results_keys=list(results.keys()))

    async def _execute_subtask_gen(
        self,
        subtask: dict[str, Any],
        completed_results: dict[str, Any],
        parent_task_id: str,
        available_agents: list[AgentConfig],
        group_num: int = 1,
    ) -> AsyncIterator[dict]:
        """Execute a single subtask, yielding token events."""
        if not isinstance(subtask, dict):
            logger.error("unexpected_subtask_format", subtask_type=type(subtask).__name__, subtask=str(subtask)[:200])
            raise ValueError(f"Subtask must be a dict, got {type(subtask).__name__}")
        subtask_id = subtask["task_id"]
        description = subtask["description"]
        target_agent_name = subtask.get("target_agent", "")

        logger.info("executing_subtask", subtask_id=subtask_id, target=target_agent_name)

        await task_scheduler.add_react_step(
            task_id=parent_task_id,
            agent_id=f"supervisor:{subtask_id}",
            thought=f"Executing subtask: {description}",
            action="execute_subtask",
            action_input={"subtask_id": subtask_id, "target": target_agent_name},
        )

        # Find the target agent
        target_agent = None
        for agent in available_agents:
            if agent.name == target_agent_name or agent.role.value == target_agent_name:
                target_agent = agent
                break

        if not target_agent:
            for agent in available_agents:
                if agent.role == AgentRole.WORKER:
                    target_agent = agent
                    break

        if not target_agent:
            raise ValueError(f"No suitable agent found for subtask: {subtask_id}")

        # Stream tokens from the agent task
        output_chunks = []
        async for event in self._execute_agent_task_stream(target_agent, description, parent_task_id):
            if event.get("type") == "token":
                output_chunks.append(event.get("content", ""))
                yield {"type": "subtask_token", "subtask_id": subtask_id, "agent_id": target_agent.id, "token": event["content"]}
            elif event.get("type") == "error":
                yield {"type": "subtask_error", "subtask_id": subtask_id, "agent_id": target_agent.id, "error": event.get("content", "Unknown error")}
                return

        output = "".join(output_chunks)

        yield {"type": "subtask_complete", "subtask_id": subtask_id, "agent_id": target_agent.id, "output": output[:200]}

        await task_scheduler.add_react_step(
            task_id=parent_task_id,
            agent_id=target_agent.id,
            thought=f"Subtask completed: {subtask_id}",
            action="subtask_complete",
            action_input={"subtask_id": subtask_id},
            observation=output[:500] if output else "No output",
        )

    async def _decompose_task(
        self, goal: str, available_agents: list[AgentConfig]
    ) -> dict[str, Any]:
        """LLM-driven task decomposition."""
        # Build agent descriptions for the prompt
        agent_descriptions = []
        for agent in available_agents:
            agent_descriptions.append(
                f"- {agent.name} ({agent.role.value}): {agent.description or 'No description'}"
            )

        # Create system prompt for decomposition
        system_prompt = f"""You are a task decomposition expert. Given a user goal, break it down into subtasks.

Available agents:
{chr(10).join(agent_descriptions)}

Output a JSON plan with:
- subtasks: array of subtasks, each with:
  - task_id: unique ID
  - description: what to do
  - target_agent: which agent type should handle it
  - expected_output: what format the output should be in
  - depends_on: array of task_ids this depends on (empty if no dependencies)
  - parallel_group: number denoting which tasks can run in parallel

Rules:
- No dependency cycles allowed
- Tasks without dependencies can run in parallel
- Each subtask should be atomic and focused
- task_id MUST be a string (e.g., "research_1", "write_2"), not a number
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Decompose this goal: {goal}"},
        ]

        try:
            response = await llm_router.chat(
                messages=messages,
                model_config=available_agents[0].llm_config if available_agents else None,
            )

            content = response.get("content", "{}")
            # Parse JSON from response
            import json
            try:
                # Try to extract JSON from markdown code blocks
                if "```" in content:
                    start = content.find("```json") + 7
                    if start > 6:
                        end = content.find("```", start)
                        content = content[start:end]
                    else:
                        start = content.find("```") + 3
                        end = content.rfind("```")
                        content = content[start:end]
                parsed = json.loads(content.strip())
                # Handle case where LLM returns bare JSON array instead of dict
                if isinstance(parsed, list):
                    # Convert list to expected dict format with subtasks array
                    plan = {"subtasks": parsed}
                else:
                    plan = parsed
            except (json.JSONDecodeError, TypeError):
                logger.warning("failed_to_parse_decomposition_plan", content=content[:200])
                # Fallback: treat entire goal as single task
                plan = {
                    "subtasks": [{
                        "task_id": "main",
                        "description": goal,
                        "target_agent": available_agents[0].name if available_agents else "default",
                        "expected_output": "text",
                        "depends_on": [],
                        "parallel_group": 1
                    }]
                }

        except Exception as e:
            logger.error("decomposition_failed", error=str(e))
            plan = {
                "subtasks": [{
                    "task_id": "main",
                    "description": goal,
                    "target_agent": available_agents[0].name if available_agents else "default",
                    "expected_output": "text",
                    "depends_on": [],
                    "parallel_group": 1
                }]
            }

        return plan

    async def _execute_plan(
        self,
        plan: dict[str, Any],
        task_id: str,
        available_agents: list[AgentConfig],
        progress_callback: Optional[callable] = None,
    ) -> dict[str, Any]:
        """Execute the plan, respecting dependencies and parallelism."""
        # Handle case where plan is a list instead of dict
        subtasks_list = plan.get("subtasks", []) if isinstance(plan, dict) else plan if isinstance(plan, list) else []
        results: dict[str, Any] = {}

        # Group tasks by parallel_group
        groups: dict[int, list[dict]] = {}
        for subtask in subtasks_list:
            # Validate subtask is a dict with required string fields
            if not isinstance(subtask, dict):
                logger.warning("skipping_invalid_subtask", expected="dict", got=type(subtask).__name__)
                continue
            task_id_str = subtask.get("task_id")
            if not isinstance(task_id_str, str):
                logger.warning("skipping_subtask_invalid_task_id", task_id=str(task_id_str)[:50])
                continue
            group = subtask.get("parallel_group", 1)
            if group not in groups:
                groups[group] = []
            groups[group].append(subtask)

        # Execute groups in order, tasks within a group in parallel
        for group_num in sorted(groups.keys()):
            group_tasks = groups[group_num]

            # Log group start
            logger.info("executing_task_group", group=group_num, task_count=len(group_tasks))
            await task_scheduler.add_react_step(
                task_id=task_id,
                agent_id="supervisor",
                thought=f"Starting group {group_num} with {len(group_tasks)} parallel tasks",
                action=f"execute_group_{group_num}",
            )

            # Send group start progress
            if progress_callback:
                for subtask in group_tasks:
                    target_agent_name = subtask.get("target_agent", "")
                    agent_info = next((a for a in available_agents if a.name == target_agent_name), available_agents[0] if available_agents else None)
                    if agent_info:
                        await progress_callback({
                            "type": "subtask_start",
                            "agent_id": agent_info.id,
                            "agent_name": agent_info.name,
                        })

            # Execute all tasks in this group concurrently
            group_coroutines = [
                self._execute_subtask(subtask, results, task_id, available_agents, group_num, progress_callback)
                for subtask in group_tasks
            ]

            group_results = await asyncio.gather(*group_coroutines, return_exceptions=True)

            for subtask, result in zip(group_tasks, group_results):
                task_id_sub = subtask["task_id"]
                target_agent_name = subtask.get("target_agent", "")
                agent_info = next((a for a in available_agents if a.name == target_agent_name), available_agents[0] if available_agents else None)
                if isinstance(result, Exception):
                    logger.error("subtask_failed", subtask_id=task_id_sub, error=str(result))
                    results[task_id_sub] = {"status": "failed", "error": str(result)}
                    if progress_callback:
                        await progress_callback({
                            "type": "subtask_error",
                            "subtask_id": task_id_sub,
                            "agent_id": agent_info.id if agent_info else None,
                        })
                else:
                    results[task_id_sub] = {"status": "completed", "output": result}

        return results

    async def _execute_subtask(
        self,
        subtask: dict[str, Any],
        completed_results: dict[str, Any],
        parent_task_id: str,
        available_agents: list[AgentConfig],
        group_num: int = 1,
        progress_callback: Optional[callable] = None,
    ) -> str:
        """Execute a single subtask."""
        # Handle case where subtask is unexpectedly a list or non-dict
        if not isinstance(subtask, dict):
            logger.error("unexpected_subtask_format", subtask_type=type(subtask).__name__, subtask=str(subtask)[:200])
            raise ValueError(f"Subtask must be a dict, got {type(subtask).__name__}")
        subtask_id = subtask["task_id"]
        description = subtask["description"]
        target_agent_name = subtask.get("target_agent", "")

        logger.info("executing_subtask", subtask_id=subtask_id, target=target_agent_name)

        await task_scheduler.add_react_step(
            task_id=parent_task_id,
            agent_id=f"supervisor:{subtask_id}",
            thought=f"Executing subtask: {description}",
            action="execute_subtask",
            action_input={"subtask_id": subtask_id, "target": target_agent_name},
        )

        # Find the target agent
        target_agent = None
        for agent in available_agents:
            if agent.name == target_agent_name or agent.role.value == target_agent_name:
                target_agent = agent
                break

        if not target_agent:
            # Fallback to first available worker
            for agent in available_agents:
                if agent.role == AgentRole.WORKER:
                    target_agent = agent
                    break

        if not target_agent:
            raise ValueError(f"No suitable agent found for subtask: {subtask_id}")

        # Execute using agent runtime
        # In a full implementation, would call the agent's runtime
        output = await self._execute_agent_task(target_agent, description, parent_task_id)

        await task_scheduler.add_react_step(
            task_id=parent_task_id,
            agent_id=target_agent.id,
            thought=f"Subtask completed: {subtask_id}",
            action="subtask_complete",
            action_input={"subtask_id": subtask_id},
            observation=output[:500] if output else "No output",
        )

        return output

    async def _execute_agent_task_stream(
        self, agent: AgentConfig, task_description: str, parent_task_id: str
    ) -> AsyncIterator[dict]:
        """Execute a task on a specific agent, yielding tokens as they arrive."""
        messages = [
            {"role": "system", "content": agent.system_prompt or f"You are {agent.name}, a helpful AI assistant."},
            {"role": "user", "content": task_description},
        ]

        # Use agent's LLM config or fall back to defaults
        model_config = agent.llm_config
        if not model_config:
            logger.warning("agent_missing_llm_config", agent_id=agent.id, agent_name=agent.name)
            model_config = ModelConfig(model_name="llama3.2:latest", provider="ollama")

        try:
            async for chunk in llm_router.stream_chat(
                messages=messages,
                model_config=model_config,
            ):
                if chunk.get("content"):
                    yield {"type": "token", "content": chunk["content"]}
                if chunk.get("done"):
                    break
        except Exception as e:
            logger.error("agent_task_failed", agent_id=agent.id, error=str(e))
            yield {"type": "error", "content": str(e)}

    async def _integrate_results(self, results: dict[str, Any]) -> str:
        """Combine all subtask results into a final output."""
        if not results:
            return ""

        if len(results) == 1:
            # Single task, return directly
            result = list(results.values())[0]
            if result:
                return result.get("output", "")
            return ""

        # Multiple tasks, create integrated summary
        summaries = []
        for task_id, result in results.items():
            if not isinstance(result, dict):
                summaries.append(f"## {task_id}\n[INVALID RESULT TYPE] {type(result).__name__}")
                continue
            output = result.get("output", "")
            status = result.get("status", "unknown")

            if status == "failed":
                summaries.append(f"## {task_id}\n[FAILED] {result.get('error', 'Unknown error')}")
            else:
                summaries.append(f"## {task_id}\n{output}")

        return "\n\n---\n\n".join(summaries)

    async def _handle_failure(
        self, failed_subtask: dict, error: Exception, available_agents: list[AgentConfig]
    ) -> dict[str, Any]:
        """Handle a subtask failure with retry logic."""
        subtask_id = failed_subtask["task_id"]
        max_retries = self._retry_policy["max_retries"]

        # Determine retry strategy
        if isinstance(error, TimeoutError):
            return {
                "action": "retry_same",
                "reason": "timeout",
            }
        elif isinstance(error, RateLimitError):
            backoff = self._retry_policy["backoff_base"]
            return {
                "action": "retry_with_backoff",
                "reason": "rate_limit",
                "backoff": backoff,
            }
        else:
            # Try a different agent
            return {
                "action": "retry_different_agent",
                "reason": "execution_error",
            }


# Global singleton
supervisor_runtime = SupervisorRuntime()