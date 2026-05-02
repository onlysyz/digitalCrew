"""
Agent Management API Routes
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.models.schemas import AgentConfig, AgentStatus, AgentRole, ModelConfig, MemoryConfig, ToolPermission
from backend.services.agent_manager import agent_manager, AgentNotFoundError

router = APIRouter()


class CreateAgentRequest(BaseModel):
    name: str
    description: str = ""
    role: AgentRole = AgentRole.WORKER
    avatar: Optional[str] = None
    tags: list[str] = []
    system_prompt: str = ""
    llm_config: Optional[ModelConfig] = None
    tool_permissions: list[ToolPermission] = []
    memory_config: Optional[MemoryConfig] = None


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    llm_config: Optional[ModelConfig] = None
    tool_permissions: Optional[list[ToolPermission]] = None
    memory_config: Optional[MemoryConfig] = None
    tags: Optional[list[str]] = None


@router.get("")
async def list_agents(
    status: Optional[AgentStatus] = None,
    role: Optional[AgentRole] = None,
    archived: bool = False
):
    """List all agents with optional filters"""
    agents = await agent_manager.list_agents(
        status=status,
        role=role,
        include_archived=archived
    )
    return {"agents": agents, "total": len(agents)}


@router.post("")
async def create_agent(request: CreateAgentRequest):
    """Create a new agent"""
    agent = await agent_manager.create_agent(
        name=request.name,
        description=request.description,
        role=request.role,
        avatar=request.avatar,
        tags=request.tags,
        system_prompt=request.system_prompt,
        llm_config=request.llm_config,
        tool_permissions=request.tool_permissions,
        memory_config=request.memory_config,
    )
    return {"agent": agent, "message": "Agent created successfully"}


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get agent details"""
    try:
        agent = await agent_manager.get_agent(agent_id)
        return {"agent": agent}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.patch("/{agent_id}")
async def update_agent(agent_id: str, request: UpdateAgentRequest):
    """Update agent configuration"""
    try:
        update_data = request.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        agent = await agent_manager.update_agent(agent_id, **update_data)
        return {"agent": agent, "message": "Agent updated successfully"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    """Delete an agent"""
    try:
        await agent_manager.delete_agent(agent_id)
        return {"message": "Agent deleted successfully"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/archive")
async def archive_agent(agent_id: str):
    """Archive an agent"""
    try:
        agent = await agent_manager.archive_agent(agent_id)
        return {"agent": agent, "message": "Agent archived successfully"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/start")
async def start_agent(agent_id: str):
    """Start an agent"""
    try:
        agent = await agent_manager.start_agent(agent_id)
        return {"agent": agent, "message": "Agent started"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/pause")
async def pause_agent(agent_id: str):
    """Pause an agent"""
    try:
        agent = await agent_manager.pause_agent(agent_id)
        return {"agent": agent, "message": "Agent paused"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{agent_id}/resume")
async def resume_agent(agent_id: str):
    """Resume a paused agent"""
    try:
        agent = await agent_manager.resume_agent(agent_id)
        return {"agent": agent, "message": "Agent resumed"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{agent_id}/terminate")
async def terminate_agent(agent_id: str):
    """Force terminate an agent"""
    try:
        agent = await agent_manager.terminate_agent(agent_id)
        return {"agent": agent, "message": "Agent terminated"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.delete("/{agent_id}/memory")
async def clear_agent_memory(agent_id: str, memory_type: str = "all"):
    """Clear agent memory (episodic, knowledge, or all)"""
    try:
        results = await agent_manager.clear_memory(agent_id, memory_type)
        return {"results": results, "message": f"Agent {memory_type} memory cleared"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("/{agent_id}/memory/episodic")
async def get_episodic_memory(agent_id: str):
    """Get agent's episodic memories"""
    try:
        memories = await agent_manager.get_episodic_memories(agent_id)
        return {"memories": memories, "total": len(memories)}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("/{agent_id}/stats")
async def get_agent_stats(agent_id: str):
    """Get agent runtime metrics (load, success rate, latency)"""
    try:
        agent = await agent_manager.get_agent(agent_id)
        return {"stats": agent.metrics}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("/{agent_id}/logs")
async def get_agent_logs(agent_id: str, limit: int = 50):
    """Get agent execution logs"""
    try:
        await agent_manager.get_agent(agent_id)
        return {"logs": [], "total": 0, "message": "Logs feature coming soon"}
    except AgentNotFoundError:
        raise HTTPException(status_code=404, detail="Agent not found")
