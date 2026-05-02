"""
Agent Registry - Capability-based agent routing for supervisor.

Replaces string-matching agent selection with capability-based routing.
Agents are registered with capabilities, and the supervisor uses
function calling (via LLM) to select agents based on task requirements.
"""

import structlog
from typing import Optional

from backend.models.schemas import AgentConfig

logger = structlog.get_logger()


class AgentEntry:
    """An agent with its registered capabilities."""

    def __init__(self, agent: AgentConfig, capabilities: list[str]) -> None:
        self.agent = agent
        self.capabilities = capabilities

    def has_capability(self, cap: str) -> bool:
        return cap in self.capabilities

    def has_any_capability(self, caps: list[str]) -> bool:
        return any(c in self.capabilities for c in caps)


class AgentRegistry:
    """
    Registry for agents with capability-based routing.

    Agents are matched to tasks based on capabilities rather than name matching.
    """

    def __init__(self) -> None:
        self._entries: dict[str, AgentEntry] = {}

    def register(self, agent: AgentConfig, capabilities: list[str]) -> None:
        """Register an agent with its capabilities."""
        self._entries[agent.id] = AgentEntry(agent, capabilities)
        logger.info("agent_registered", agent_id=agent.id, capabilities=capabilities)

    def unregister(self, agent_id: str) -> None:
        """Unregister an agent."""
        if agent_id in self._entries:
            del self._entries[agent_id]

    def get(self, agent_id: str) -> Optional[AgentEntry]:
        """Get entry by agent ID."""
        return self._entries.get(agent_id)

    def find_by_capability(self, capability: str) -> list[AgentEntry]:
        """Find all agents with a specific capability."""
        return [e for e in self._entries.values() if e.has_capability(capability)]

    def find_by_any_capability(self, capabilities: list[str]) -> list[AgentEntry]:
        """Find all agents with any of the given capabilities."""
        return [e for e in self._entries.values() if e.has_any_capability(capabilities)]

    def list_all(self) -> list[AgentEntry]:
        """List all registered agents."""
        return list(self._entries.values())

    def as_llm_tools(self) -> list[dict]:
        """
        Convert registered agents to LLM function calling format.

        Returns tools for delegate_to_{agent_id} for each agent.
        """
        tools = []
        for entry in self._entries.values():
            agent = entry.agent
            tools.append({
                "type": "function",
                "function": {
                    "name": f"delegate_to_{agent.id}",
                    "description": f"{agent.name}: {agent.description or 'No description'}. "
                                  f"Capabilities: {', '.join(entry.capabilities) or 'general-purpose'}",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "task": {
                                "type": "string",
                                "description": "The task description to delegate to this agent",
                            },
                            "context": {
                                "type": "string",
                                "description": "Additional context for the task",
                            },
                        },
                        "required": ["task"],
                    },
                },
            })
        return tools


# Global registry singleton
agent_registry = AgentRegistry()