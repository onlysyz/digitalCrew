/**
 * API Service Layer for DigitalCrew
 * Handles all HTTP requests to the backend API
 */

import type { Agent, AgentMetrics, Task, ChatMessage, ChatSession, ExecutionPlan, KnowledgeBase, Document, SystemSettings } from '../types/api';

const API_BASE_URL = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============ Agent API ============

export const agentApi = {
  list: (params?: { status?: string; role?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return fetchJson<{ agents: unknown[]; total: number }>(`/agents${query ? `?${query}` : ''}`);
  },

  get: (agentId: string) =>
    fetchJson<{ agent: Agent }>(`/agents/${agentId}`),

  getStats: (agentId: string) =>
    fetchJson<{ stats: AgentMetrics }>(`/agents/${agentId}/stats`),

  create: (data: { name: string; description?: string; role?: string; model_name?: string; system_prompt?: string; tool_permissions?: Array<{ tool_name: string; enabled: boolean }> }) =>
    fetchJson<{ agent: Agent; message: string }>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (agentId: string, data: Record<string, unknown>) =>
    fetchJson<{ agent: Agent; message: string }>(`/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (agentId: string) =>
    fetchJson<{ message: string }>(`/agents/${agentId}`, { method: 'DELETE' }),

  archive: (agentId: string) =>
    fetchJson<{ message: string }>(`/agents/${agentId}/archive`, { method: 'POST' }),

  start: (agentId: string) =>
    fetchJson<{ agent: Agent; message: string }>(`/agents/${agentId}/start`, { method: 'POST' }),

  pause: (agentId: string) =>
    fetchJson<{ agent: Agent; message: string }>(`/agents/${agentId}/pause`, { method: 'POST' }),

  resume: (agentId: string) =>
    fetchJson<{ agent: Agent; message: string }>(`/agents/${agentId}/resume`, { method: 'POST' }),

  terminate: (agentId: string) =>
    fetchJson<{ message: string }>(`/agents/${agentId}/terminate`, { method: 'POST' }),

  clearMemory: (agentId: string, memoryType: string = 'all') =>
    fetchJson<{ message: string }>(`/agents/${agentId}/memory?type=${memoryType}`, { method: 'DELETE' }),

  getEpisodicMemory: (agentId: string) =>
    fetchJson<{ memories: unknown[]; total: number }>(`/agents/${agentId}/memory/episodic`),

  getLogs: (agentId: string, limit: number = 50) =>
    fetchJson<{ logs: unknown[]; total: number }>(`/agents/${agentId}/logs?limit=${limit}`),
};

// ============ Task API ============

export const taskApi = {
  list: (params?: { status?: string; agent_id?: string; limit?: number }) => {
    const query = new URLSearchParams(
      Object.entries(params || {}).reduce((acc, [k, v]) => {
        if (v !== undefined) acc[k] = String(v);
        return acc;
      }, {} as Record<string, string>)
    ).toString();
    return fetchJson<{ tasks: unknown[]; total: number }>(`/tasks${query ? `?${query}` : ''}`);
  },

  create: (data: { description: string; mode?: string; target_agent_id?: string; priority?: number; timeout_seconds?: number }) =>
    fetchJson<{ task: Task; message: string }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (taskId: string) =>
    fetchJson<{ task: Task }>(`/tasks/${taskId}`),

  cancel: (taskId: string) =>
    fetchJson<{ message: string }>(`/tasks/${taskId}/cancel`, { method: 'POST' }),

  pause: (taskId: string) =>
    fetchJson<{ message: string }>(`/tasks/${taskId}/pause`, { method: 'POST' }),

  resume: (taskId: string, userInput?: string) =>
    fetchJson<{ message: string }>(`/tasks/${taskId}/resume`, {
      method: 'POST',
      body: JSON.stringify({ user_input: userInput }),
    }),

  retry: (taskId: string) =>
    fetchJson<{ message: string }>(`/tasks/${taskId}/retry`, { method: 'POST' }),

  getLogs: (taskId: string) =>
    fetchJson<{ logs: unknown[]; total: number }>(`/tasks/${taskId}/logs`),

  getTrace: (taskId: string) =>
    fetchJson<{ trace: unknown[]; total_steps: number }>(`/tasks/${taskId}/trace`),

  exportLogs: (taskId: string) =>
    fetchJson<{ message: string; download_url: string }>(`/tasks/${taskId}/export`, { method: 'POST' }),
};

// ============ Chat API ============

export const chatApi = {
  single: (data: { message: string; agent_id?: string; session_id?: string }) =>
    fetchJson<{ session_id: string; message: ChatMessage; agent_id?: string }>('/chat/single', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  team: (data: { message: string; session_id?: string }) =>
    fetchJson<{ session_id: string; message: ChatMessage; execution_plan?: ExecutionPlan }>('/chat/team', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  intervene: (sessionId: string, message: string) =>
    fetchJson<{ message: string; session_id: string }>(`/chat/${sessionId}/intervene`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  listSessions: () =>
    fetchJson<{ sessions: unknown[]; total: number }>('/chat/sessions'),

  getSessionMessages: (sessionId: string, limit: number = 50) =>
    fetchJson<{ messages: unknown[]; total: number }>(`/chat/sessions/${sessionId}/messages?limit=${limit}`),
};

// ============ Knowledge API ============

export const knowledgeApi = {
  list: () =>
    fetchJson<{ knowledge_bases: KnowledgeBase[]; total: number }>('/knowledge'),

  create: (data: { name: string; embedding_provider?: string; embedding_model?: string }) =>
    fetchJson<{ knowledge_base: KnowledgeBase; message: string }>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (kbId: string) =>
    fetchJson<{ knowledge_base: KnowledgeBase }>(`/knowledge/${kbId}`),

  delete: (kbId: string) =>
    fetchJson<{ message: string }>(`/knowledge/${kbId}`, { method: 'DELETE' }),

  uploadDocument: async (kbId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/knowledge/${kbId}/documents`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  },

  deleteDocument: (kbId: string, docId: string) =>
    fetchJson<{ message: string }>(`/knowledge/${kbId}/documents/${docId}`, { method: 'DELETE' }),

  reindex: (kbId: string) =>
    fetchJson<{ message: string; estimated_time: string }>(`/knowledge/${kbId}/reindex`, { method: 'POST' }),

  watch: (kbId: string, dirPath: string) =>
    fetchJson<{ message: string }>(`/knowledge/${kbId}/watch`, {
      method: 'POST',
      body: JSON.stringify({ dir_path: dirPath }),
    }),

  getStats: (kbId: string) =>
    fetchJson<{ document_count: number; total_chunks: number; documents: Document[] }>(`/knowledge/${kbId}/stats`),

  search: (kbId: string, query: string, topK: number = 5) =>
    fetchJson<{ results: Array<{ content: string; source_file: string; page_number: number | null; relevance_score: number; doc_id: string }>; total: number }>(`/knowledge/${kbId}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    }),
};

// ============ Tools API ============

export const toolsApi = {
  list: () =>
    fetchJson<{ tools: unknown[]; total: number }>(''),

  get: (toolName: string) =>
    fetchJson<{ tool: unknown }>(`/${toolName}`),

  updatePermissions: (toolName: string, enabled: boolean) =>
    fetchJson<{ message: string; enabled: boolean }>(`/${toolName}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),

  listMcp: () =>
    fetchJson<{ tools: unknown[]; total: number; message: string }>('/mcp'),
};

// ============ System API ============

export const systemApi = {
  getStatus: () =>
    fetchJson<{ status: string; version: string; ollama_connected: boolean }>('/status'),

  getResources: () =>
    fetchJson<unknown>('/resources'),

  getModels: () =>
    fetchJson<{
      models: Array<{ name: string; size: number; size_gb: number; modified_at: string }>;
      running_models: Array<{ name: string; vram_gb: number; duration: number }>;
      model_count: number;
      running_count: number;
      total_size_gb: number;
      total_vram_gb: number;
    }>('/models'),

  getSettings: () =>
    fetchJson<unknown>('/settings'),

  updateSettings: (data: Record<string, unknown>) =>
    fetchJson<{ message: string; settings: unknown; restart_required?: string[] }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  applySettings: () =>
    fetchJson<{ message: string; applied: string[]; settings: unknown }>('/settings/apply', { method: 'POST' }),

  createBackup: () =>
    fetchJson<{ message: string; path: string }>('/backup', { method: 'POST' }),

  restoreBackup: (backupPath: string) =>
    fetchJson<{ message: string }>('/restore', {
      method: 'POST',
      body: JSON.stringify({ backup_path: backupPath }),
    }),

  getDirs: () =>
    fetchJson<{ directories: Record<string, { path: string; size_bytes: number; size_mb: number }> }>('/dirs'),

  clearCache: () =>
    fetchJson<{ message: string }>('/cache/clear', { method: 'POST' }),
};

// Health check
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/v1', '')}/health`);
    return response.ok;
  } catch {
    return false;
  }
}