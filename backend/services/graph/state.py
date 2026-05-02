"""
GraphState protocol and related types for supervisor orchestration.
"""

from typing import TypedDict, Literal
from pydantic import BaseModel, Field


class SubTask(BaseModel):
    """A subtask within a graph execution plan."""
    id: str
    description: str
    target_agent_id: str  # Use agent id, not name
    depends_on: list[str] = Field(default_factory=list)
    parallel_group: int = 1
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    output: str | None = None
    error: str | None = None


class SubAgentContext(BaseModel):
    """Isolated context passed to a sub-agent."""
    goal: str
    constraints: str = ""
    parent_summary: str = ""  # Summary, not full history
    previous_results: dict[str, str] = Field(default_factory=dict)  # completed subtask_id -> summary


class GraphState(TypedDict):
    """Complete state of a graph execution thread."""
    thread_id: str
    goal: str
    plan: list[SubTask]
    current_step: int
    results: dict[str, str]       # subtask_id -> output summary
    raw_outputs: dict[str, str]   # subtask_id -> full output
    status: Literal["planning", "executing", "integrating", "done", "error", "interrupted"]
    error: str | None
    context: SubAgentContext