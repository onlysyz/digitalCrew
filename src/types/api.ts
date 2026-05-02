// API types for DigitalCrew

export interface ModelConfig {
  provider: 'ollama' | 'openai_compatible';
  model_name: string;
  api_key?: string;
  base_url?: string;
  context_window: number;
  temperature: number;
  top_p: number;
  max_output_tokens: number;
}

export interface MemoryConfig {
  episodic_enabled: boolean;
  knowledge_enabled: boolean;
  knowledge_base_ids: string[];
}

export interface ToolPermission {
  tool_name: string;
  enabled: boolean;
}

export type AgentStatus = 'idle' | 'running' | 'waiting' | 'paused' | 'error';
export type AgentRole = 'supervisor' | 'worker';

export interface AgentMetrics {
  tasks_completed: number;
  tasks_failed: number;
  success_rate: number;
  avg_latency_ms: number;
  last_active_at: string | null;
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  tags: string[];
  role: AgentRole;
  capabilities: string[];
  llm_config: ModelConfig;
  system_prompt: string;
  tool_permissions: ToolPermission[];
  memory_config: MemoryConfig;
  status: AgentStatus;
  is_archived: boolean;
  metrics: AgentMetrics;
  created_at: string;
  updated_at: string;
}

export interface ReActStep {
  step_id: number;
  timestamp: string;
  agent_id: string;
  thought: string;
  action: string;
  action_input: Record<string, unknown>;
  observation: string;
  token_input: number;
  token_output: number;
  duration_ms: number;
}

export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: number;
  assigned_agents: string[];
  parent_task_id?: string;
  subtasks: string[];
  dependencies: string[];
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  react_trace: ReActStep[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
  timeout_seconds: number;
  error_message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_id?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  agent_id?: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  embedding_provider: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  document_count: number;
  total_chunks: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  filepath: string;
  file_size: number;
  chunk_count: number;
  indexed_at: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  risk_level: 'low' | 'medium' | 'high';
  requires_confirmation: boolean;
}

export interface SystemSettings {
  ollama_base_url: string;
  workspace_dir: string;
  data_dir: string;
  sandbox_timeout: number;
  max_concurrent_agents: number;
  enable_anonymous_stats: boolean;
  enable_error_reporting: boolean;
  temperature?: number;
  top_p?: number;
  context_window?: number;
  language?: string;
}

export interface SystemResources {
  cpu_percent: number;
  gpu_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  ollama_models: Array<{
    name: string;
    size: string;
    loaded: boolean;
  }>;
}

export interface ExecutionPlan {
  steps: Array<{
    agent: string;
    task: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
}