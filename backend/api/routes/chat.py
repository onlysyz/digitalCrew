"""
Chat API Routes - SSE streaming support
"""
import asyncio
import json
from datetime import datetime


def json_dumps_safe(obj):
    """JSON serialize with datetime support."""
    return json.dumps(obj, default=lambda x: x.isoformat() if isinstance(x, datetime) else str(x))
import re
import uuid
from typing import Optional, AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.models.schemas import ChatMessage, ChatSession
from backend.services.agent_manager import agent_manager
from backend.services.task_scheduler import task_scheduler
from backend.services.supervisor import supervisor_runtime
from backend.services.llm_router import llm_router
from backend.services.session_store import session_store

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    agent_id: Optional[str] = None  # None for team/supervisor chat
    session_id: Optional[str] = None
    mentioned_agents: Optional[list[str]] = None  # Agent IDs mentioned with @


class InterveneRequest(BaseModel):
    message: str


def match_mentioned_agents(mentioned_names: list[str], all_agents: list) -> list:
    """
    Match mentioned agent names to actual agents with priority:
    1. Exact id match
    2. Exact name match (case-insensitive)
    3. Substring match only if unique (last fallback)
    """
    matched = []
    for name in mentioned_names:
        # 1. Exact id match
        agent = next((a for a in all_agents if a.id == name), None)
        if agent:
            matched.append(agent)
            continue
        # 2. Exact name match (case-insensitive)
        agent = next((a for a in all_agents if a.name.lower() == name.lower()), None)
        if agent:
            matched.append(agent)
            continue
        # 3. Substring match (last fallback, only if unique)
        candidates = [a for a in all_agents if name.lower() in a.name.lower()]
        if len(candidates) == 1:
            matched.append(candidates[0])
    return matched


def parse_mentions(message: str) -> list[str]:
    """Parse @ mentions from message and return agent IDs."""
    mention_pattern = r'@(\w+)'
    mentions = re.findall(mention_pattern, message)
    return mentions


@router.post("/single")
async def chat_single(request: ChatRequest):
    """Single agent chat (non-streaming)"""
    session_id = request.session_id or "default_single"
    session = session_store.get_or_create(session_id, request.agent_id)

    # Add user message
    user_msg = ChatMessage(role="user", content=request.message)
    session.messages.append(user_msg)
    session_store.update(session)

    # Get agent config
    agent = None
    if request.agent_id:
        try:
            agent = await agent_manager.get_agent(request.agent_id)
        except Exception:
            pass

    # Build messages for LLM
    messages = [
        {"role": "system", "content": agent.system_prompt if agent else "You are a helpful AI assistant."},
        {"role": "user", "content": request.message},
    ]

    try:
        response = await llm_router.chat(
            messages=messages,
            model_config=agent.llm_config if agent else None,
        )
        response_content = response.get("content", "")
    except Exception as e:
        response_content = f"Error: {str(e)}"

    assistant_msg = ChatMessage(
        role="assistant",
        content=response_content,
        agent_id=request.agent_id
    )
    session.messages.append(assistant_msg)
    session_store.update(session)

    return {
        "session_id": session_id,
        "message": assistant_msg,
        "agent_id": request.agent_id
    }


@router.post("/team")
async def chat_team(request: ChatRequest):
    """Team chat via supervisor agent (non-streaming)"""
    session_id = request.session_id or str(uuid.uuid4())

    # Create or get session
    session = session_store.get_or_create(session_id)

    # Add user message
    user_msg = ChatMessage(role="user", content=request.message)
    session.messages.append(user_msg)
    session_store.update(session)

    # Get mentioned agents from @ mentions
    mentioned_names = parse_mentions(request.message)

    # Get all available worker agents
    all_agents = await agent_manager.list_agents(role=None)

    # Filter agents based on @ mentions if specified
    if mentioned_names and request.mentioned_agents is None:
        mentioned_agents = match_mentioned_agents(mentioned_names, all_agents)
    else:
        mentioned_agents = [a for a in all_agents if a.id in (request.mentioned_agents or [])]

    # Use mentioned agents or all available agents
    target_agents = mentioned_agents if mentioned_agents else all_agents

    if not target_agents:
        assistant_msg = ChatMessage(
            role="assistant",
            content="No agents available. Please create an agent first."
        )
        session.messages.append(assistant_msg)
        return {
            "session_id": session_id,
            "message": assistant_msg,
        }

    # Create task for supervisor
    task = await task_scheduler.create_task(
        description=request.message,
        priority=0,
    )
    await task_scheduler.assign_task(task.id, [a.id for a in target_agents])

    # Execute via supervisor
    try:
        # Collect events from the async iterator
        final_output = ""
        async for event in supervisor_runtime.execute(
            goal=request.message,
            available_agents=target_agents,
            task_id=task.id,
        ):
            if event.get("type") == "done":
                final_output = event.get("output", "")

        # Mark task as completed
        await task_scheduler.complete_task(task.id, {"output": final_output})
    except Exception as e:
        final_output = f"Supervisor execution error: {str(e)}"

    assistant_msg = ChatMessage(role="assistant", content=final_output)
    session.messages.append(assistant_msg)
    session_store.update(session)

    return {
        "session_id": session_id,
        "message": assistant_msg,
        "task_id": task.id,
        "mentioned_agents": [a.id for a in mentioned_agents],
    }


@router.post("/team/stream")
async def chat_team_stream(request: ChatRequest):
    """Team chat via supervisor agent with SSE streaming"""
    session_id = request.session_id or str(uuid.uuid4())

    async def event_generator():
        # Create session
        session = session_store.get_or_create(session_id)
        session.thread_id = None  # Will be set when first event arrives

        # Add user message
        user_msg = ChatMessage(role="user", content=request.message)
        session.messages.append(user_msg)
        session_store.update(session)
        yield f"data: {json_dumps_safe({'type': 'message', 'content': request.message, 'role': 'user'})}\n\n"

        # Get mentioned agents from @ mentions
        mentioned_names = parse_mentions(request.message)

        # Get available agents
        all_agents = await agent_manager.list_agents(role=None)

        # Filter agents based on @ mentions if specified
        if mentioned_names and request.mentioned_agents is None:
            mentioned_agents = match_mentioned_agents(mentioned_names, all_agents)
        else:
            mentioned_agents = [a for a in all_agents if a.id in (request.mentioned_agents or [])]

        target_agents = mentioned_agents if mentioned_agents else all_agents

        if not target_agents:
            yield f"data: {json_dumps_safe({'type': 'error', 'content': 'No agents available'})}\n\n"
            return

        # Create task
        task = await task_scheduler.create_task(
            description=request.message,
            priority=0,
        )
        await task_scheduler.assign_task(task.id, [a.id for a in target_agents])
        yield f"data: {json_dumps_safe({'type': 'task_created', 'task_id': task.id})}\n\n"

        # Send agent list being used
        agent_list = [{'id': a.id, 'name': a.name, 'role': a.role.value} for a in target_agents]
        yield f"data: {json_dumps_safe({'type': 'agents_assigned', 'agents': agent_list})}\n\n"

        # Send initial status
        yield f"data: {json_dumps_safe({'type': 'status', 'content': f'已分配 {len(target_agents)} 个代理，开始执行任务...'})}\n\n"

        # Send subtask_start for each agent
        for i, agent in enumerate(target_agents):
            yield f"data: {json_dumps_safe({'type': 'subtask_start', 'agent_id': agent.id, 'agent_name': agent.name})}\n\n"

        # Stream response using supervisor with real-time progress
        final_output = ""
        results = {}
        try:
            # First send thinking status
            yield f"data: {json_dumps_safe({'type': 'status', 'content': '主管代理正在分析并分解任务...'})}\n\n"

            async for event in supervisor_runtime.execute(
                goal=request.message,
                available_agents=target_agents,
                task_id=task.id,
            ):
                # Capture thread_id from first event and persist to session
                if session.thread_id is None and event.get("thread_id"):
                    session.thread_id = event["thread_id"]
                    session_store.update(session)
                # Forward supervisor events as SSE
                yield f"data: {json_dumps_safe(event)}\n\n"
                # Collect final output and results
                if event.get("type") == "done":
                    final_output = event.get("output", "")
                    results = event.get("results", {})

            # Mark task as completed
            await task_scheduler.complete_task(task.id, {"output": final_output})

            # Send final result
            yield f"data: {json_dumps_safe({'type': 'result', 'content': final_output})}\n\n"

        except Exception as e:
            yield f"data: {json_dumps_safe({'type': 'error', 'content': str(e)})}\n\n"

        # Save assistant response to session (even on error/timeout with partial results)
        if final_output:
            assistant_msg = ChatMessage(role="assistant", content=final_output)
            session.messages.append(assistant_msg)
            session_store.update(session)

        yield f"data: {json_dumps_safe({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/{session_id}/intervene")
async def intervene_chat(session_id: str, request: InterveneRequest):
    """
    User intervention during team chat.

    Submits user input to the supervisor for processing during execution.
    The supervisor will process this input when it polls for intervention.
    """
    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.thread_id:
        raise HTTPException(status_code=400, detail="No active supervisor thread for this session")

    # Add user intervention message
    user_msg = ChatMessage(role="user", content=f"[介入] {request.message}")
    session.messages.append(user_msg)
    session_store.update(session)

    # Submit intervention keyed by thread_id so engine._wait_for_resume can find it
    supervisor_runtime.submit_intervention(session.thread_id, {
        "message": request.message,
        "session_id": session_id,
    })

    return {"message": "Intervention submitted", "session_id": session_id, "thread_id": session.thread_id}


@router.get("/sessions")
async def list_sessions():
    """List all chat sessions"""
    sessions = session_store.list()
    return {"sessions": sessions, "total": len(sessions)}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, limit: int = 50):
    """Get messages from a session"""
    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = session.messages[-limit:]
    return {"messages": messages, "total": len(messages)}


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel an ongoing team task."""
    success = supervisor_runtime.request_cancellation(task_id)
    return {"cancelled": success, "task_id": task_id}