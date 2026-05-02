"""
Unified SSE event protocol for graph execution.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional


class GraphEvent(BaseModel):
    """统一的 SSE 事件格式， supervisor 所有事件统一结构."""
    type: Literal[
        "state_update",      # State change (primary frontend driver event)
        "node_start",        # A node started
        "node_end",          # A node finished
        "stream_token",      # LLM streaming token
        "subtask_start",     # Subtask started
        "subtask_complete",  # Subtask completed
        "subtask_error",     # Subtask failed
        "subtask_progress",  # Subtask-level progress (retry, etc)
        "status",            # Status message (informational)
        "react_step",        # ReAct reasoning step
        "error",             # Error occurred
        "interrupt",        # Requires user intervention
        "done",              # Overall execution done
    ]
    node: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    subtask_id: Optional[str] = None
    state_delta: Optional[dict] = None  # Incremental GraphState
    content: Optional[str] = None
    token: Optional[str] = None
    step: Optional[dict] = None         # ReAct step data
    metadata: dict = Field(default_factory=dict)