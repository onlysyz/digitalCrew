"""
DigitalCrew Data Models
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    WAITING = "waiting"
    PAUSED = "paused"
    ERROR = "error"


class AgentRole(str, Enum):
    SUPERVISOR = "supervisor"
    WORKER = "worker"


class TaskStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


# Pydantic Models

class ModelConfig(BaseModel):
    provider: str = "ollama"  # ollama | openai_compatible
    model_name: str = "llama3.2:latest"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    context_window: int = 4096
    temperature: float = 0.7
    top_p: float = 0.9
    max_output_tokens: int = 2048


class MemoryConfig(BaseModel):
    episodic_enabled: bool = True
    knowledge_enabled: bool = False
    knowledge_base_ids: list[str] = Field(default_factory=list)


class ToolPermission(BaseModel):
    tool_name: str
    enabled: bool = True


class AgentMetrics(BaseModel):
    """Runtime metrics for an agent"""
    tasks_completed: int = 0
    tasks_failed: int = 0
    success_rate: float = 0.0
    avg_latency_ms: int = 0
    last_active_at: Optional[datetime] = None


class AgentConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    avatar: Optional[str] = None
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    role: AgentRole = AgentRole.WORKER
    llm_config: ModelConfig = Field(default_factory=lambda: ModelConfig())
    system_prompt: str = ""
    tool_permissions: list[ToolPermission] = Field(default_factory=list)
    memory_config: MemoryConfig = Field(default_factory=lambda: MemoryConfig())
    status: AgentStatus = AgentStatus.IDLE
    is_archived: bool = False
    metrics: AgentMetrics = Field(default_factory=AgentMetrics)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReActStep(BaseModel):
    step_id: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent_id: str = ""
    thought: str = ""
    action: str = ""
    action_input: dict = Field(default_factory=dict)
    observation: str = ""
    token_input: int = 0
    token_output: int = 0
    duration_ms: int = 0


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    status: TaskStatus = TaskStatus.PENDING
    priority: int = 0
    assigned_agents: list[str] = Field(default_factory=list)
    parent_task_id: Optional[str] = None
    subtasks: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    input_data: dict = Field(default_factory=dict)
    output_data: dict = Field(default_factory=dict)
    react_trace: list[ReActStep] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    timeout_seconds: int = 300
    error_message: Optional[str] = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str  # user | assistant | system
    content: str
    agent_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict = Field(default_factory=dict)


class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: Optional[str] = None  # None for team chat
    messages: list[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class KnowledgeBase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    embedding_provider: str = "ollama"
    embedding_model: str = "nomic-embed-text"
    chunk_size: int = 512
    chunk_overlap: int = 50
    document_count: int = 0
    total_chunks: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kb_id: str
    filename: str
    filepath: str
    file_size: int = 0
    chunk_count: int = 0
    indexed_at: datetime = Field(default_factory=datetime.utcnow)


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: dict = Field(default_factory=dict)
    risk_level: str = "low"  # low | medium | high
    requires_confirmation: bool = False


class SystemSettings(BaseModel):
    ollama_base_url: str = "http://localhost:11434"
    workspace_dir: str = ""
    data_dir: str = ""
    enable_anonymous_stats: bool = False
    enable_error_reporting: bool = False
    sandbox_timeout: int = 60
    max_concurrent_agents: int = 5