"""
Agent Manager Service - Agent lifecycle and state management
"""
import asyncio
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import structlog
import yaml

from backend.models.schemas import AgentConfig, AgentStatus, AgentRole, ModelConfig, MemoryConfig

logger = structlog.get_logger()

# Define paths locally to avoid circular import
CONFIG_DIR = Path.home() / "DigitalCrew" / "config"
DATABASE_PATH = Path.home() / "DigitalCrew" / "data" / "db.sqlite"
AGENTS_DIR = CONFIG_DIR / "agents"
AGENTS_DIR.mkdir(parents=True, exist_ok=True)


class AgentNotFoundError(Exception):
    pass


class AgentManager:
    """
    Manages agent lifecycle: creation, configuration, state transitions, persistence.
    """

    def __init__(self):
        self._agents: dict[str, AgentConfig] = {}
        self._runtimes: dict[str, asyncio.Task] = {}  # Running agent tasks
        self._locks: dict[str, asyncio.Lock] = {}

    async def initialize(self):
        """Load existing agents from disk on startup."""
        await self._load_agents()
        logger.info("agent_manager_initialized", agent_count=len(self._agents))

    async def _load_agents(self):
        """Load all agent configs from YAML files."""
        if not AGENTS_DIR.exists():
            return

        for file_path in AGENTS_DIR.glob("*.yaml"):
            try:
                with open(file_path) as f:
                    data = yaml.safe_load(f)
                agent = AgentConfig(**data)
                self._agents[agent.id] = agent
                self._locks[agent.id] = asyncio.Lock()
            except Exception as e:
                logger.error("failed_to_load_agent", path=str(file_path), error=str(e))

    async def _save_agent(self, agent: AgentConfig):
        """Persist agent config to YAML file."""
        file_path = AGENTS_DIR / f"{agent.id}.yaml"
        # Use model_dump mode that serializes enums as strings
        with open(file_path, "w") as f:
            yaml.dump(agent.model_dump(mode='json'), f, default_flow_style=False)

    def _get_lock(self, agent_id: str) -> asyncio.Lock:
        """Get or create a lock for an agent."""
        if agent_id not in self._locks:
            self._locks[agent_id] = asyncio.Lock()
        return self._locks[agent_id]

    # ============ CRUD Operations ============

    async def create_agent(
        self,
        name: str,
        description: str = "",
        role: AgentRole = AgentRole.WORKER,
        avatar: Optional[str] = None,
        tags: list[str] | None = None,
        llm_config: ModelConfig | None = None,
        system_prompt: str = "",
        tool_permissions: list | None = None,
        memory_config: MemoryConfig | None = None,
    ) -> AgentConfig:
        """Create a new agent."""
        agent = AgentConfig(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            role=role,
            avatar=avatar,
            tags=tags or [],
            llm_config=llm_config or ModelConfig(),
            system_prompt=system_prompt,
            tool_permissions=tool_permissions or [],
            memory_config=memory_config or MemoryConfig(),
            status=AgentStatus.IDLE,
        )

        self._agents[agent.id] = agent
        self._locks[agent.id] = asyncio.Lock()

        await self._save_agent(agent)
        logger.info("agent_created", agent_id=agent.id, name=agent.name)

        return agent

    async def get_agent(self, agent_id: str) -> AgentConfig:
        """Get agent by ID."""
        if agent_id not in self._agents:
            raise AgentNotFoundError(f"Agent {agent_id} not found")
        return self._agents[agent_id]

    async def list_agents(
        self,
        status: AgentStatus | None = None,
        role: AgentRole | None = None,
        include_archived: bool = False,
    ) -> list[AgentConfig]:
        """List agents with optional filters."""
        agents = list(self._agents.values())

        if status:
            agents = [a for a in agents if a.status == status]
        if role:
            agents = [a for a in agents if a.role == role]
        if not include_archived:
            agents = [a for a in agents if not a.is_archived]

        return agents

    async def update_agent(self, agent_id: str, **updates) -> AgentConfig:
        """Update agent configuration."""
        agent = await self.get_agent(agent_id)
        async with self._get_lock(agent_id):
            for key, value in updates.items():
                if value is None or not hasattr(agent, key):
                    continue
                if key == 'llm_config' and isinstance(value, dict):
                    value = ModelConfig(**value)
                elif key == 'memory_config' and isinstance(value, dict):
                    value = MemoryConfig(**value)
                setattr(agent, key, value)
            agent.updated_at = datetime.utcnow()
            await self._save_agent(agent)

        logger.info("agent_updated", agent_id=agent_id, updates=list(updates.keys()))
        return agent

    async def delete_agent(self, agent_id: str):
        """Delete an agent."""
        agent = await self.get_agent(agent_id)

        # Stop if running
        if agent_id in self._runtimes:
            self._runtimes[agent_id].cancel()
            del self._runtimes[agent_id]

        del self._agents[agent_id]
        self._locks.pop(agent_id, None)

        # Remove config file
        file_path = AGENTS_DIR / f"{agent_id}.yaml"
        if file_path.exists():
            file_path.unlink()

        logger.info("agent_deleted", agent_id=agent_id)

    async def archive_agent(self, agent_id: str) -> AgentConfig:
        """Archive an agent (soft delete)."""
        return await self.update_agent(agent_id, is_archived=True)

    # ============ State Transitions ============

    async def start_agent(self, agent_id: str):
        """Start an agent's runtime."""
        agent = await self.get_agent(agent_id)
        async with self._get_lock(agent_id):
            if agent.status == AgentStatus.RUNNING:
                return agent

            agent.status = AgentStatus.RUNNING
            agent.updated_at = datetime.utcnow()
            await self._save_agent(agent)

        logger.info("agent_started", agent_id=agent_id)
        return agent

    async def pause_agent(self, agent_id: str) -> AgentConfig:
        """Pause an agent."""
        agent = await self.get_agent(agent_id)
        async with self._get_lock(agent_id):
            if agent.status != AgentStatus.RUNNING:
                raise ValueError(f"Agent {agent_id} is not running")

            agent.status = AgentStatus.PAUSED
            agent.updated_at = datetime.utcnow()
            await self._save_agent(agent)

        logger.info("agent_paused", agent_id=agent_id)
        return agent

    async def resume_agent(self, agent_id: str) -> AgentConfig:
        """Resume a paused agent."""
        agent = await self.get_agent(agent_id)
        async with self._get_lock(agent_id):
            if agent.status != AgentStatus.PAUSED:
                raise ValueError(f"Agent {agent_id} is not paused")

            agent.status = AgentStatus.IDLE
            agent.updated_at = datetime.utcnow()
            await self._save_agent(agent)

        logger.info("agent_resumed", agent_id=agent_id)
        return agent

    async def terminate_agent(self, agent_id: str) -> AgentConfig:
        """Force terminate an agent."""
        agent = await self.get_agent(agent_id)

        if agent_id in self._runtimes:
            self._runtimes[agent_id].cancel()
            del self._runtimes[agent_id]

        async with self._get_lock(agent_id):
            agent.status = AgentStatus.IDLE
            agent.updated_at = datetime.utcnow()
            await self._save_agent(agent)

        logger.info("agent_terminated", agent_id=agent_id)
        return agent

    async def set_agent_status(self, agent_id: str, status: AgentStatus):
        """Set agent status directly."""
        agent = await self.get_agent(agent_id)
        async with self._get_lock(agent_id):
            agent.status = status
            agent.updated_at = datetime.utcnow()
            await self._save_agent(agent)

    # ============ Memory Operations ============

    async def clear_memory(
        self, agent_id: str, memory_type: str = "all"
    ) -> dict[str, bool]:
        """Clear agent memory (episodic, knowledge, or all)."""
        from backend.memory.episodic import EpisodicMemory
        from backend.memory.knowledge import KnowledgeMemory

        results = {}
        agent = await self.get_agent(agent_id)

        if memory_type in ("episodic", "all"):
            episodic = EpisodicMemory(agent_id, DATABASE_PATH)
            await episodic.clear_all()
            results["episodic"] = True

        if memory_type in ("knowledge", "all"):
            if agent.memory_config.knowledge_base_ids:
                kb = KnowledgeMemory(DATABASE_PATH)
                await kb.clear_agent_memories(agent_id)
            results["knowledge"] = True

        logger.info("agent_memory_cleared", agent_id=agent_id, memory_type=memory_type)
        return results

    async def get_episodic_memories(self, agent_id: str) -> list:
        """Get agent's episodic memories."""
        from backend.memory.episodic import EpisodicMemory

        episodic = EpisodicMemory(agent_id, DATABASE_PATH)
        return await episodic.list_memories()


# Global singleton instance
agent_manager = AgentManager()