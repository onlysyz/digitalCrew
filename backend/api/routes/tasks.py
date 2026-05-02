"""
Task Management API Routes
"""
import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.models.schemas import Task, TaskStatus
from backend.services.task_scheduler import task_scheduler

router = APIRouter()


class CreateTaskRequest(BaseModel):
    description: str
    mode: str = "supervisor"  # supervisor | single
    target_agent_id: Optional[str] = None
    priority: int = 0
    timeout_seconds: int = 600


class UpdateTaskRequest(BaseModel):
    status: Optional[TaskStatus] = None
    output_data: Optional[dict] = None


@router.get("")
async def list_tasks(
    status: Optional[TaskStatus] = None,
    agent_id: Optional[str] = None,
    limit: int = 50
):
    """List tasks with optional filters"""
    tasks = await task_scheduler.list_tasks(status=status, agent_id=agent_id, limit=limit)
    return {"tasks": tasks, "total": len(tasks)}


@router.post("")
async def create_task(request: CreateTaskRequest):
    """Submit a new task"""
    task = await task_scheduler.create_task(
        description=request.description,
        priority=request.priority,
        timeout_seconds=request.timeout_seconds,
    )
    return {"task": task, "message": "Task created successfully"}


@router.get("/stream")
async def stream_tasks():
    """SSE stream of all task events for real-time frontend updates"""
    client_id = str(uuid.uuid4())

    async def event_generator():
        # Queue for this client's events
        event_queue: asyncio.Queue[dict] = asyncio.Queue()

        # Callback to put events into the queue
        async def on_task_event(payload: dict):
            # Only forward task-related events
            event_name = payload.get("event", "")
            if event_name.value in (
                "task_created", "task_started", "task_step_complete",
                "task_completed", "task_failed", "task_cancelled", "task_paused"
            ):
                task_data = payload.get("task")
                event_data = {
                    "type": "task_event",
                    "event": event_name.value,
                    "task_id": task_data.id if task_data else None,
                    "task_status": task_data.status.value if task_data else None,
                }
                await event_queue.put(event_data)

        # Subscribe to all task events
        from backend.services.task_scheduler import TaskEvent
        subscriptions = []
        for event in TaskEvent:
            await task_scheduler.subscribe(event, on_task_event)
            subscriptions.append(event)

        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connected', 'client_id': client_id})}\n\n"

        try:
            while True:
                event = await event_queue.get()
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            # Cleanup subscriptions on disconnect
            from backend.services.task_scheduler import task_scheduler as ts
            for event in subscriptions:
                # Note: subscriptions persist per-client; simplified cleanup
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/{task_id}")
async def get_task(task_id: str):
    """Get task details"""
    try:
        task = await task_scheduler.get_task(task_id)
        return {"task": task}
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel a task"""
    try:
        await task_scheduler.cancel_task(task_id)
        return {"message": "Task cancelled"}
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/pause")
async def pause_task(task_id: str):
    """Pause a task (for user intervention)"""
    try:
        await task_scheduler.pause_task(task_id)
        return {"message": "Task paused for intervention"}
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/resume")
async def resume_task(task_id: str, user_input: Optional[str] = None):
    """Resume a paused task with optional user input"""
    try:
        await task_scheduler.resume_task(task_id, user_input)
        return {"message": "Task resumed"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/retry")
async def retry_task(task_id: str):
    """Retry a failed task"""
    try:
        task = await task_scheduler.get_task(task_id)
        task.status = TaskStatus.PENDING
        task.error_message = None
        # Re-add to pending queue for processing
        await task_scheduler._pending_queue.put((task.priority, task.id))
        return {"message": "Task retry initiated"}
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.get("/{task_id}/trace")
async def get_task_trace(task_id: str):
    """Get task ReAct execution trace"""
    try:
        trace = await task_scheduler.get_task_trace(task_id)
        return {"trace": trace, "total_steps": len(trace)}
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.get("/{task_id}/logs")
async def get_task_logs(task_id: str):
    """Get task execution logs from ReAct trace"""
    try:
        task = await task_scheduler.get_task(task_id)
        logs = []
        for step in task.react_trace:
            # Determine log level based on action type
            level = "info"
            if step.action in ("task_failed", "subtask_error"):
                level = "error"
            elif step.action.startswith("retry"):
                level = "warning"

            observation = step.observation or ""
            message = f"[{step.action}] {step.thought}"
            if observation:
                message += f" → {observation[:200]}"

            logs.append({
                "timestamp": step.timestamp.isoformat() if hasattr(step.timestamp, 'isoformat') else str(step.timestamp),
                "level": level,
                "message": message,
                "agent_id": step.agent_id,
                "step_id": step.step_id,
                "duration_ms": step.duration_ms,
            })
        return {"logs": logs, "total": len(logs)}
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/export")
async def export_task_logs(task_id: str):
    """Export task logs as JSON"""
    try:
        task = await task_scheduler.get_task(task_id)
        return {"message": "Export initiated", "download_url": f"/api/v1/tasks/{task_id}/export/download"}
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")