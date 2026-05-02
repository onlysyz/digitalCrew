"""
Graph API Routes - Thread management and resume support
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.services.graph.engine import create_default_engine

router = APIRouter()


class ResumeRequest(BaseModel):
    goal: Optional[str] = None
    message: Optional[str] = None
    replan: bool = False
    modified_plan: Optional[list[dict]] = None


class ResumeResponse(BaseModel):
    status: str
    thread_id: str
    resumed: bool


@router.post("/{thread_id}/resume")
async def resume_graph(thread_id: str, request: ResumeRequest):
    """
    Resume a graph execution thread after user intervention.

    User can:
    - Modify the goal
    - Request replan (go back to plan node)
    - Provide modified plan directly
    """
    from backend.services.supervisor import supervisor_runtime

    # Build intervention data from request
    intervention = {}
    if request.goal:
        intervention["goal"] = request.goal
    if request.message:
        intervention["message"] = request.message
    if request.replan:
        intervention["replan"] = True
    if request.modified_plan:
        intervention["modified_plan"] = request.modified_plan

    # Submit intervention to supervisor runtime
    supervisor_runtime.submit_intervention(thread_id, intervention)

    return {
        "status": "resumed",
        "thread_id": thread_id,
        "resumed": True,
    }


@router.get("/{thread_id}/status")
async def get_thread_status(thread_id: str):
    """Get the current status of a graph execution thread."""
    from backend.services.supervisor import supervisor_runtime

    # Try to get pending state from engine
    engine = supervisor_runtime._graph_engine if hasattr(supervisor_runtime, '_graph_engine') else None
    if engine:
        state = engine.get_pending_state(thread_id)
        if state:
            return {
                "thread_id": thread_id,
                "status": state.get("status", "unknown"),
                "current_step": state.get("current_step", 0),
                "plan": [st.model_dump() if hasattr(st, 'model_dump') else str(st) for st in state.get("plan", [])],
                "results": state.get("results", {}),
            }

    # Fallback: check checkpoints
    checkpoint_db = None
    try:
        from pathlib import Path
        checkpoint_db = Path("/Users/tiankuo/DigitalCrew/data/checkpoints.db")
        if checkpoint_db.exists():
            from backend.services.graph.checkpoint import CheckpointStore
            store = CheckpointStore(checkpoint_db)
            state = store.load(thread_id)
            if state:
                return {
                    "thread_id": thread_id,
                    "status": state.get("status", "unknown"),
                    "current_step": state.get("current_step", 0),
                    "plan": state.get("plan", []),
                    "results": state.get("results", {}),
                    "from_checkpoint": True,
                }
    except Exception:
        pass

    return {
        "thread_id": thread_id,
        "status": "not_found",
        "message": "Thread not found or has completed",
    }


@router.get("/{thread_id}/history")
async def get_thread_history(thread_id: str):
    """Get the step-by-step history of a thread execution."""
    from pathlib import Path

    checkpoint_db = Path("/Users/tiankuo/DigitalCrew/data/checkpoints.db")
    if not checkpoint_db.exists():
        return {"thread_id": thread_id, "steps": []}

    from backend.services.graph.checkpoint import CheckpointStore
    store = CheckpointStore(checkpoint_db)
    steps = store.list_steps(thread_id)

    history = []
    for step in steps:
        state = store.load(thread_id, step)
        if state:
            history.append({
                "step": step,
                "status": state.get("status", ""),
                "current_node": state.get("_last_node", "unknown"),
                "plan_count": len(state.get("plan", [])),
            })

    return {"thread_id": thread_id, "steps": history}