"""
ReactRecorder - Shared ReAct step recording service.

Provides a simple interface for recording ReAct steps without creating
circular dependencies between supervisor and task_scheduler.
"""
from datetime import datetime
from typing import Optional

import structlog

from backend.models.schemas import ReActStep

logger = structlog.get_logger()


class ReactRecorder:
    """
    Records ReAct steps for task execution trace.

    This is a standalone service that can be used by both
    supervisor and task_scheduler without creating circular imports.
    """

    def __init__(self) -> None:
        self._steps: list[ReActStep] = []
        self._task_id: Optional[str] = None

    def start_task(self, task_id: str) -> None:
        """Start recording steps for a task."""
        self._task_id = task_id
        self._steps = []

    async def add_step(
        self,
        agent_id: str,
        thought: str = "",
        action: str = "",
        action_input: Optional[dict] = None,
        observation: str = "",
        token_input: int = 0,
        token_output: int = 0,
        duration_ms: int = 0,
    ) -> ReActStep:
        """
        Add a ReAct step to the current task's trace.

        Args:
            agent_id: The agent that generated this step
            thought: The agent's reasoning/thinking
            action: The action being taken
            action_input: Input parameters for the action
            observation: Result of the action
            token_input: Input tokens consumed
            token_output: Output tokens generated
            duration_ms: Time taken for this step

        Returns:
            The created ReActStep
        """
        step = ReActStep(
            step_id=len(self._steps) + 1,
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
        self._steps.append(step)
        return step

    def get_steps(self) -> list[ReActStep]:
        """Get all recorded steps for the current task."""
        return self._steps

    def clear(self) -> None:
        """Clear all recorded steps."""
        self._steps = []
        self._task_id = None

    async def record_step(
        self,
        task_id: str,
        agent_id: str,
        thought: str = "",
        action: str = "",
        action_input: Optional[dict] = None,
        observation: str = "",
        token_input: int = 0,
        token_output: int = 0,
        duration_ms: int = 0,
    ) -> ReActStep:
        """
        Record a step for a specific task (stateless convenience method).

        Args:
            task_id: The task this step belongs to
            agent_id: The agent that generated this step
            thought: The agent's reasoning/thinking
            action: The action being taken
            action_input: Input parameters for the action
            observation: Result of the action
            token_input: Input tokens consumed
            token_output: Output tokens generated
            duration_ms: Time taken for this step

        Returns:
            The created ReActStep
        """
        step = ReActStep(
            step_id=0,  # Will be set by caller if needed
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
        logger.debug("react_step_recorded", task_id=task_id, agent_id=agent_id, action=action)
        return step


# Global singleton for use across the application
react_recorder = ReactRecorder()