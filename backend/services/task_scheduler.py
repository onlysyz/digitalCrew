"""
Task Scheduler Service - Task lifecycle and ReAct execution trace management
"""
import asyncio
import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

import structlog

from backend.models.schemas import Task, TaskStatus, ReActStep
from backend.services.agent_manager import agent_manager
from backend.services.supervisor import supervisor_runtime
from backend.services.task_store import task_store

logger = structlog.get_logger()


class TaskEvent(str, Enum):
    CREATED = "task_created"
    ASSIGNED = "task_assigned"
    STARTED = "task_started"
    STEP_COMPLETE = "task_step_complete"
    TOOL_CALL = "task_tool_call"
    TOOL_RESULT = "task_tool_result"
    COMPLETED = "task_completed"
    FAILED = "task_failed"
    CANCELLED = "task_cancelled"
    PAUSED = "task_paused"
    USER_CONFIRM = "user_confirmation_required"


class TaskScheduler:
    """
    Manages task lifecycle, queuing, and ReAct execution trace.
    """

    def __init__(self):
        self._tasks: dict[str, Task] = {}
        self._queues: dict[str, asyncio.PriorityQueue] = {}  # Per-agent queues
        self._pending_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._running_tasks: dict[str, asyncio.Task] = {}
        self._event_subscribers: dict[TaskEvent, list] = {
            e: [] for e in TaskEvent
        }
        self._task_locks: dict[str, asyncio.Lock] = {}
        self._load()

    def _load(self):
        """Restore tasks from persistent store on startup."""
        persisted = task_store.load_all()
        restored = 0
        for task in persisted:
            if task.status == TaskStatus.RUNNING:
                # Can't recover mid-execution — mark as failed
                task.status = TaskStatus.FAILED
                task.error_message = "Server restarted during execution"
                task.completed_at = datetime.utcnow()
                task_store.save(task)
            elif task.status in (TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.PAUSED):
                self._tasks[task.id] = task
                self._task_locks[task.id] = asyncio.Lock()
                if task.status == TaskStatus.PENDING:
                    self._pending_queue.put_nowait((task.priority, task.id))
                restored += 1
            # COMPLETED/FAILED/CANCELLED: don't restore (terminal)
        if restored > 0:
            logger.info("tasks_restored", count=restored)

    async def initialize(self):
        """Start the scheduler."""
        logger.info("task_scheduler_initialized")
        # Start queue consumer as background task
        asyncio.create_task(self._queue_consumer(), name="task_queue_consumer")

    def _get_lock(self, task_id: str) -> asyncio.Lock:
        if task_id not in self._task_locks:
            self._task_locks[task_id] = asyncio.Lock()
        return self._task_locks[task_id]

    # ============ Task CRUD ============

    async def create_task(
        self,
        description: str,
        priority: int = 0,
        timeout_seconds: int = 300,
        input_data: dict | None = None,
        parent_task_id: str | None = None,
    ) -> Task:
        """Create a new task."""
        task = Task(
            id=str(uuid.uuid4()),
            description=description,
            priority=priority,
            timeout_seconds=timeout_seconds,
            input_data=input_data or {},
            parent_task_id=parent_task_id,
            status=TaskStatus.PENDING,
        )

        self._tasks[task.id] = task
        self._task_locks[task.id] = asyncio.Lock()

        await self._emit_event(TaskEvent.CREATED, task)
        await self._pending_queue.put((priority, task.id))
        self._persist(task)

        logger.info("task_created", task_id=task.id, description=description[:50])
        return task

    async def get_task(self, task_id: str) -> Task:
        """Get task by ID."""
        if task_id not in self._tasks:
            raise ValueError(f"Task {task_id} not found")
        return self._tasks[task_id]

    async def list_tasks(
        self,
        status: TaskStatus | None = None,
        agent_id: str | None = None,
        limit: int = 50,
    ) -> list[Task]:
        """List tasks with optional filters."""
        tasks = list(self._tasks.values())

        if status:
            tasks = [t for t in tasks if t.status == status]
        if agent_id:
            tasks = [t for t in tasks if agent_id in t.assigned_agents]

        # Sort by created_at descending, then by priority
        tasks.sort(key=lambda t: (-t.created_at.timestamp(), -t.priority))
        return tasks[:limit]

    async def update_task(self, task_id: str, **updates) -> Task:
        """Update task fields."""
        task = await self.get_task(task_id)
        async with self._get_lock(task_id):
            for key, value in updates.items():
                if value is not None and hasattr(task, key):
                    setattr(task, key, value)
        return task

    # ============ Task State Transitions ============

    async def assign_task(
        self, task_id: str, agent_ids: list[str], dependencies: list[str] | None = None
    ) -> Task:
        """Assign task to agents."""
        task = await self.get_task(task_id)
        async with self._get_lock(task_id):
            task.assigned_agents = agent_ids
            task.dependencies = dependencies or []
            task.status = TaskStatus.ASSIGNED

        await self._emit_event(TaskEvent.ASSIGNED, task)
        self._persist(task)
        logger.info("task_assigned", task_id=task_id, agents=agent_ids)
        return task

    async def start_task(self, task_id: str) -> Task:
        """Mark task as started."""
        task = await self.get_task(task_id)
        async with self._get_lock(task_id):
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.utcnow()

        await self._emit_event(TaskEvent.STARTED, task)
        self._persist(task)
        logger.info("task_started", task_id=task_id)
        return task

    async def complete_task(self, task_id: str, output_data: dict) -> Task:
        """Mark task as completed with output."""
        task = await self.get_task(task_id)
        async with self._get_lock(task_id):
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            task.output_data = output_data

        await self._emit_event(TaskEvent.COMPLETED, task)
        self._persist(task)
        logger.info("task_completed", task_id=task_id, duration_ms=self._get_duration(task))
        return task

    async def fail_task(self, task_id: str, error_message: str) -> Task:
        """Mark task as failed."""
        task = await self.get_task(task_id)
        async with self._get_lock(task_id):
            task.status = TaskStatus.FAILED
            task.completed_at = datetime.utcnow()
            task.error_message = error_message

        await self._emit_event(TaskEvent.FAILED, task)
        self._persist(task)
        logger.error("task_failed", task_id=task_id, error=error_message)
        return task

    async def cancel_task(self, task_id: str) -> Task:
        """Cancel a task."""
        task = await self.get_task(task_id)
        async with self._get_lock(task_id):
            task.status = TaskStatus.CANCELLED
            task.completed_at = datetime.utcnow()

        # Cancel running task if exists
        if task_id in self._running_tasks:
            self._running_tasks[task_id].cancel()
            del self._running_tasks[task_id]

        await self._emit_event(TaskEvent.CANCELLED, task)
        self._persist(task)
        logger.info("task_cancelled", task_id=task_id)
        return task

    async def pause_task(self, task_id: str) -> Task:
        """Pause a task for user intervention."""
        task = await self.get_task(task_id)
        async with self._get_lock(task_id):
            task.status = TaskStatus.PAUSED

        await self._emit_event(TaskEvent.PAUSED, task)
        self._persist(task)
        logger.info("task_paused", task_id=task_id)
        return task

    async def resume_task(self, task_id: str, user_input: str | None = None) -> Task:
        """Resume a paused task."""
        task = await self.get_task(task_id)
        if task.status != TaskStatus.PAUSED:
            raise ValueError(f"Task {task_id} is not paused")

        async with self._get_lock(task_id):
            task.status = TaskStatus.RUNNING
            if user_input:
                task.input_data["user_intervention"] = user_input

        await self._emit_event(TaskEvent.STARTED, task)
        self._persist(task)
        logger.info("task_resumed", task_id=task_id, has_user_input=user_input is not None)
        return task

    # ============ ReAct Trace ============

    async def add_react_step(
        self,
        task_id: str,
        agent_id: str,
        thought: str = "",
        action: str = "",
        action_input: dict | None = None,
        observation: str = "",
        token_input: int = 0,
        token_output: int = 0,
        duration_ms: int = 0,
    ) -> ReActStep:
        """Add a ReAct step to the task trace."""
        task = await self.get_task(task_id)

        step = ReActStep(
            step_id=len(task.react_trace) + 1,
            timestamp=datetime.utcnow(),
            agent_id=agent_id,
            thought=thought,
            action=action,
            action_input=action_input or {},
            observation=observation,
            token_input=token_input,
            token_output=token_output,
            duration_ms=duration_ms,
        )

        async with self._get_lock(task_id):
            task.react_trace.append(step)

        await self._emit_event(TaskEvent.STEP_COMPLETE, task, step)
        return step

    async def get_task_trace(self, task_id: str) -> list[ReActStep]:
        """Get the complete ReAct trace for a task."""
        task = await self.get_task(task_id)
        return task.react_trace

    # ============ Event System ============

    async def subscribe(self, event: TaskEvent, callback):
        """Subscribe to task events."""
        self._event_subscribers[event].append(callback)

    async def _emit_event(self, event: TaskEvent, task: Task, data: Any = None):
        """Emit a task event to all subscribers."""
        payload = {"task": task, "data": data, "event": event}
        for callback in self._event_subscribers[event]:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(payload)
                else:
                    callback(payload)
            except Exception as e:
                logger.error("event_callback_failed", event=event, error=str(e))

    def _persist(self, task: Task):
        """Persist task state to SQLite."""
        try:
            task_store.save(task)
        except Exception as e:
            logger.error("task_persist_failed", task_id=task.id, error=str(e))

    async def request_confirmation(
        self, task_id: str, tool_name: str, params: dict
    ) -> asyncio.Event:
        """Request user confirmation for a tool (high-risk)."""
        task = await self.get_task(task_id)
        confirm_event = asyncio.Event()

        await self._emit_event(
            TaskEvent.USER_CONFIRM,
            task,
            {"tool_name": tool_name, "params": params, "confirm_event": confirm_event},
        )

        return confirm_event

    # ============ Helpers ============

    def _get_duration(self, task: Task) -> int:
        """Calculate task duration in ms."""
        if task.started_at and task.completed_at:
            return int((task.completed_at - task.started_at).total_seconds() * 1000)
        return 0

    # ============ Queue Consumer ============

    async def _queue_consumer(self):
        """Background worker that consumes pending tasks from the queue."""
        logger.info("queue_consumer_started")
        while True:
            try:
                priority, task_id = await self._pending_queue.get()
                await self._process_task(task_id)
            except asyncio.CancelledError:
                logger.info("queue_consumer_cancelled")
                break
            except Exception as e:
                logger.error("queue_consumer_error", error=str(e))

    async def _process_task(self, task_id: str):
        """Process a single task from queue to completion."""
        try:
            task = await self.get_task(task_id)
            # Skip if already terminal
            if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
                return

            await self.start_task(task_id)
            logger.info("task_execution_started", task_id=task_id)

            # Get available agents for execution
            agents = await agent_manager.list_agents()
            if not agents:
                await self.fail_task(task_id, "No agents available to execute task")
                return

            # Execute via supervisor runtime
            collected_output = []
            try:
                async for event in supervisor_runtime.execute(
                    goal=task.description,
                    available_agents=agents,
                    task_id=task_id,
                ):
                    if event is None:
                        continue
                    event_type = event.get("type", "")
                    if event_type == "done":
                        collected_output.append(event.get("output", ""))
                    elif event_type == "cancelled":
                        await self.cancel_task(task_id)
                        return
            except Exception as e:
                logger.error("task_execution_error", task_id=task_id, error=str(e))
                await self.fail_task(task_id, str(e))
                return

            final_output = "\n\n".join(collected_output) if collected_output else ""
            await self.complete_task(task_id, {"output": final_output})

        except asyncio.CancelledError:
            await self.cancel_task(task_id)
        except Exception as e:
            logger.error("task_processing_error", task_id=task_id, error=str(e))
            try:
                await self.fail_task(task_id, str(e))
            except Exception:
                pass


# Global singleton
task_scheduler = TaskScheduler()