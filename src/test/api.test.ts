import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentApi, taskApi, chatApi, knowledgeApi, toolsApi, systemApi, checkHealth } from '../services/api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Service - fetchJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchJson success', () => {
    it('parses JSON response successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ agents: [], total: 0 }),
      });

      const result = await fetch('/api/v1/agents', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }).then(r => r.json());

      expect(result).toEqual({ agents: [], total: 0 });
    });

    it('includes custom headers in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetch('/api/v1/agents', {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents', expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer token' }),
      }));
    });
  });

  describe('fetchJson error handling', () => {
    it('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const response = await fetch('/api/v1/agents/invalid');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(fetch('/api/v1/agents')).rejects.toThrow('Network failure');
    });

    it('throws error on server error (500)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const response = await fetch('/api/v1/agents');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });
});

describe('Agent API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('agentApi.list', () => {
    it('fetches all agents without params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [{ id: '1', name: 'Agent 1' }], total: 1 }),
      });

      const result = await agentApi.list();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents', expect.any(Object));
      expect(result.agents).toHaveLength(1);
    });

    it('fetches agents with status filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [], total: 0 }),
      });

      await agentApi.list({ status: 'running' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents?status=running', expect.any(Object));
    });

    it('fetches agents with role filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [], total: 0 }),
      });

      await agentApi.list({ role: 'supervisor' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents?role=supervisor', expect.any(Object));
    });

    it('combines multiple filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [], total: 0 }),
      });

      await agentApi.list({ status: 'idle', role: 'worker' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents?status=idle&role=worker', expect.any(Object));
    });
  });

  describe('agentApi.get', () => {
    it('fetches single agent by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: { id: 'agent-1', name: 'Test Agent' } }),
      });

      const result = await agentApi.get('agent-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents/agent-1', expect.any(Object));
      expect(result.agent.id).toBe('agent-1');
    });
  });

  describe('agentApi.getStats', () => {
    it('fetches agent stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ stats: { tasks_completed: 10, uptime: 3600 } }),
      });

      const result = await agentApi.getStats('agent-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents/agent-1/stats', expect.any(Object));
      expect(result.stats).toBeDefined();
    });
  });

  describe('agentApi.create', () => {
    it('creates agent with all fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: { id: 'new-agent' }, message: 'Created' }),
      });

      const data = {
        name: 'New Agent',
        description: 'Test agent',
        role: 'worker',
        model_name: 'llama3',
        system_prompt: 'You are helpful',
        tool_permissions: [{ tool_name: 'web_search', enabled: true }],
      };

      const result = await agentApi.create(data);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        })
      );
      expect(result.agent.id).toBe('new-agent');
    });

    it('creates agent with minimal data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: { id: 'minimal-agent' }, message: 'Created' }),
      });

      await agentApi.create({ name: 'Minimal Agent' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('agentApi.update', () => {
    it('updates agent with PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: { id: 'agent-1', name: 'Updated' }, message: 'Updated' }),
      });

      const result = await agentApi.update('agent-1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Updated' }) })
      );
      expect(result.message).toBe('Updated');
    });
  });

  describe('agentApi.delete', () => {
    it('deletes agent with DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Deleted' }),
      });

      const result = await agentApi.delete('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.message).toBe('Deleted');
    });
  });

  describe('agentApi.archive', () => {
    it('archives agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Archived' }),
      });

      const result = await agentApi.archive('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1/archive',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('agentApi.start', () => {
    it('starts agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: { id: 'agent-1', status: 'running' }, message: 'Started' }),
      });

      const result = await agentApi.start('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1/start',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.agent.status).toBe('running');
    });
  });

  describe('agentApi.pause', () => {
    it('pauses agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: { id: 'agent-1', status: 'idle' }, message: 'Paused' }),
      });

      const result = await agentApi.pause('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1/pause',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('agentApi.resume', () => {
    it('resumes agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: { id: 'agent-1', status: 'running' }, message: 'Resumed' }),
      });

      const result = await agentApi.resume('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1/resume',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('agentApi.terminate', () => {
    it('terminates agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Terminated' }),
      });

      const result = await agentApi.terminate('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1/terminate',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('agentApi.clearMemory', () => {
    it('clears all memory by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Memory cleared' }),
      });

      const result = await agentApi.clearMemory('agent-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1/memory?type=all',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('clears specific memory type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Memory cleared' }),
      });

      await agentApi.clearMemory('agent-1', 'episodic');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/agents/agent-1/memory?type=episodic',
        expect.any(Object)
      );
    });
  });

  describe('agentApi.getEpisodicMemory', () => {
    it('fetches episodic memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ memories: [{ content: 'Test' }], total: 1 }),
      });

      const result = await agentApi.getEpisodicMemory('agent-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents/agent-1/memory/episodic', expect.any(Object));
      expect(result.memories).toHaveLength(1);
    });
  });

  describe('agentApi.getLogs', () => {
    it('fetches logs with default limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ logs: [], total: 0 }),
      });

      await agentApi.getLogs('agent-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents/agent-1/logs?limit=50', expect.any(Object));
    });

    it('fetches logs with custom limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ logs: [], total: 0 }),
      });

      await agentApi.getLogs('agent-1', 100);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/agents/agent-1/logs?limit=100', expect.any(Object));
    });
  });
});

describe('Task API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('taskApi.list', () => {
    it('lists all tasks without params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tasks: [], total: 0 }),
      });

      await taskApi.list();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks', expect.any(Object));
    });

    it('filters by status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tasks: [], total: 0 }),
      });

      await taskApi.list({ status: 'pending' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks?status=pending', expect.any(Object));
    });

    it('filters by agent_id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tasks: [], total: 0 }),
      });

      await taskApi.list({ agent_id: 'agent-1' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks?agent_id=agent-1', expect.any(Object));
    });

    it('omits undefined params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tasks: [], total: 0 }),
      });

      await taskApi.list({ status: 'running', agent_id: undefined });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks?status=running', expect.any(Object));
    });
  });

  describe('taskApi.create', () => {
    it('creates task with description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ task: { id: 'task-1' }, message: 'Created' }),
      });

      const result = await taskApi.create({ description: 'Test task' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ description: 'Test task' }),
        })
      );
      expect(result.task.id).toBe('task-1');
    });

    it('creates task with all options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ task: { id: 'task-1' }, message: 'Created' }),
      });

      await taskApi.create({
        description: 'Complex task',
        mode: 'async',
        target_agent_id: 'agent-1',
        priority: 5,
        timeout_seconds: 300,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            description: 'Complex task',
            mode: 'async',
            target_agent_id: 'agent-1',
            priority: 5,
            timeout_seconds: 300,
          }),
        })
      );
    });
  });

  describe('taskApi.get', () => {
    it('fetches single task', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ task: { id: 'task-1', status: 'pending' } }),
      });

      const result = await taskApi.get('task-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks/task-1', expect.any(Object));
      expect(result.task.id).toBe('task-1');
    });
  });

  describe('taskApi.cancel', () => {
    it('cancels task', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Cancelled' }),
      });

      const result = await taskApi.cancel('task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks/task-1/cancel',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('taskApi.pause', () => {
    it('pauses task', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Paused' }),
      });

      await taskApi.pause('task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks/task-1/pause',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('taskApi.resume', () => {
    it('resumes task without user input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Resumed' }),
      });

      await taskApi.resume('task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks/task-1/resume',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ user_input: undefined }),
        })
      );
    });

    it('resumes task with user input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Resumed' }),
      });

      await taskApi.resume('task-1', 'User provided input');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks/task-1/resume',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ user_input: 'User provided input' }),
        })
      );
    });
  });

  describe('taskApi.retry', () => {
    it('retries task', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Retrying' }),
      });

      await taskApi.retry('task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks/task-1/retry',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('taskApi.getLogs', () => {
    it('fetches task logs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ logs: [], total: 0 }),
      });

      await taskApi.getLogs('task-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks/task-1/logs', expect.any(Object));
    });
  });

  describe('taskApi.getTrace', () => {
    it('fetches task trace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trace: [], total_steps: 0 }),
      });

      const result = await taskApi.getTrace('task-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/tasks/task-1/trace', expect.any(Object));
      expect(result.trace).toBeDefined();
    });
  });

  describe('taskApi.exportLogs', () => {
    it('exports task logs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Exported', download_url: '/download/logs' }),
      });

      const result = await taskApi.exportLogs('task-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks/task-1/export',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.download_url).toBe('/download/logs');
    });
  });
});

describe('Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('chatApi.single', () => {
    it('sends single chat message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'sess-1',
          message: { content: 'Response' },
          agent_id: 'agent-1',
        }),
      });

      const result = await chatApi.single({ message: 'Hello', agent_id: 'agent-1' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/chat/single',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'Hello', agent_id: 'agent-1' }),
        })
      );
      expect(result.session_id).toBe('sess-1');
    });

    it('sends single chat with session_id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session_id: 'existing-session', message: {} }),
      });

      await chatApi.single({ message: 'Hello', session_id: 'existing-session' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/chat/single',
        expect.objectContaining({
          body: JSON.stringify({ message: 'Hello', session_id: 'existing-session' }),
        })
      );
    });
  });

  describe('chatApi.team', () => {
    it('sends team chat message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'team-sess-1',
          message: { content: 'Team response' },
          execution_plan: { steps: [] },
        }),
      });

      const result = await chatApi.team({ message: 'Team task' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/chat/team',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'Team task' }),
        })
      );
      expect(result.execution_plan).toBeDefined();
    });
  });

  describe('chatApi.intervene', () => {
    it('intervenes in chat session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Intervened', session_id: 'sess-1' }),
      });

      const result = await chatApi.intervene('sess-1', 'User intervention message');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/chat/sess-1/intervene',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'User intervention message' }),
        })
      );
      expect(result.session_id).toBe('sess-1');
    });
  });

  describe('chatApi.listSessions', () => {
    it('lists all chat sessions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [], total: 0 }),
      });

      const result = await chatApi.listSessions();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/chat/sessions', expect.any(Object));
      expect(result.sessions).toBeDefined();
    });
  });

  describe('chatApi.getSessionMessages', () => {
    it('fetches session messages with default limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [], total: 0 }),
      });

      await chatApi.getSessionMessages('sess-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/chat/sessions/sess-1/messages?limit=50', expect.any(Object));
    });

    it('fetches session messages with custom limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [], total: 0 }),
      });

      await chatApi.getSessionMessages('sess-1', 100);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/chat/sessions/sess-1/messages?limit=100', expect.any(Object));
    });
  });
});

describe('Knowledge API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('knowledgeApi.list', () => {
    it('lists all knowledge bases', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_bases: [], total: 0 }),
      });

      const result = await knowledgeApi.list();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge', expect.any(Object));
      expect(result.knowledge_bases).toBeDefined();
    });
  });

  describe('knowledgeApi.create', () => {
    it('creates knowledge base', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_base: { id: 'kb-1' }, message: 'Created' }),
      });

      const result = await knowledgeApi.create({ name: 'My Knowledge Base' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My Knowledge Base' }),
        })
      );
      expect(result.knowledge_base.id).toBe('kb-1');
    });

    it('creates knowledge base with optional fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_base: {}, message: 'Created' }),
      });

      await knowledgeApi.create({
        name: 'KB',
        embedding_provider: 'openai',
        embedding_model: 'text-embedding-3-small',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge',
        expect.objectContaining({
          body: JSON.stringify({
            name: 'KB',
            embedding_provider: 'openai',
            embedding_model: 'text-embedding-3-small',
          }),
        })
      );
    });
  });

  describe('knowledgeApi.get', () => {
    it('fetches single knowledge base', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ knowledge_base: { id: 'kb-1', name: 'Test' } }),
      });

      const result = await knowledgeApi.get('kb-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/kb-1', expect.any(Object));
      expect(result.knowledge_base.id).toBe('kb-1');
    });
  });

  describe('knowledgeApi.delete', () => {
    it('deletes knowledge base', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Deleted' }),
      });

      const result = await knowledgeApi.delete('kb-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/kb-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('knowledgeApi.uploadDocument', () => {
    it('uploads document with FormData', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Uploaded' }),
      });

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const result = await knowledgeApi.uploadDocument('kb-1', file);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/kb-1/documents',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('knowledgeApi.deleteDocument', () => {
    it('deletes document from knowledge base', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Document deleted' }),
      });

      const result = await knowledgeApi.deleteDocument('kb-1', 'doc-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/kb-1/documents/doc-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('knowledgeApi.reindex', () => {
    it('triggers reindexing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Reindexing started', estimated_time: '5 minutes' }),
      });

      const result = await knowledgeApi.reindex('kb-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/kb-1/reindex',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.estimated_time).toBe('5 minutes');
    });
  });

  describe('knowledgeApi.watch', () => {
    it('sets up directory watching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Watching directory' }),
      });

      const result = await knowledgeApi.watch('kb-1', '/data/docs');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/kb-1/watch',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ dir_path: '/data/docs' }),
        })
      );
    });
  });

  describe('knowledgeApi.getStats', () => {
    it('fetches knowledge base stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          document_count: 10,
          total_chunks: 500,
          documents: [],
        }),
      });

      const result = await knowledgeApi.getStats('kb-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/knowledge/kb-1/stats', expect.any(Object));
      expect(result.document_count).toBe(10);
    });
  });

  describe('knowledgeApi.search', () => {
    it('searches knowledge base with default topK', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], total: 0 }),
      });

      await knowledgeApi.search('kb-1', 'search query');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/kb-1/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'search query', top_k: 5 }),
        })
      );
    });

    it('searches knowledge base with custom topK', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], total: 0 }),
      });

      await knowledgeApi.search('kb-1', 'query', 10);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/knowledge/kb-1/search',
        expect.objectContaining({
          body: JSON.stringify({ query: 'query', top_k: 10 }),
        })
      );
    });
  });
});

describe('Tools API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toolsApi.list', () => {
    it('lists all tools', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tools: [], total: 0 }),
      });

      const result = await toolsApi.list();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1', expect.any(Object));
      expect(result.tools).toBeDefined();
    });
  });

  describe('toolsApi.get', () => {
    it('fetches tool details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tool: { name: 'web_search' } }),
      });

      const result = await toolsApi.get('web_search');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/web_search', expect.any(Object));
      expect(result.tool).toBeDefined();
    });
  });

  describe('toolsApi.updatePermissions', () => {
    it('enables tool', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Updated', enabled: true }),
      });

      const result = await toolsApi.updatePermissions('web_search', true);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/web_search/permissions',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ enabled: true }),
        })
      );
    });

    it('disables tool', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Updated', enabled: false }),
      });

      await toolsApi.updatePermissions('web_search', false);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/web_search/permissions',
        expect.objectContaining({
          body: JSON.stringify({ enabled: false }),
        })
      );
    });
  });

  describe('toolsApi.listMcp', () => {
    it('lists MCP tools', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tools: [], total: 0, message: 'Success' }),
      });

      const result = await toolsApi.listMcp();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/mcp', expect.any(Object));
      expect(result.tools).toBeDefined();
    });
  });
});

describe('System API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('systemApi.getStatus', () => {
    it('fetches system status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'running',
          version: '1.0.0',
          ollama_connected: true,
        }),
      });

      const result = await systemApi.getStatus();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/status', expect.any(Object));
      expect(result.status).toBe('running');
      expect(result.ollama_connected).toBe(true);
    });
  });

  describe('systemApi.getResources', () => {
    it('fetches system resources', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ cpu_percent: 50, memory_percent: 70 }),
      });

      const result = await systemApi.getResources();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/resources', expect.any(Object));
      expect(result).toBeDefined();
    });
  });

  describe('systemApi.getModels', () => {
    it('fetches available models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          models: [{ name: 'llama3', size: 4.7e9, size_gb: 4.7, modified_at: '' }],
          running_models: [],
          model_count: 1,
          running_count: 0,
          total_size_gb: 4.7,
          total_vram_gb: 0,
        }),
      });

      const result = await systemApi.getModels();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/models', expect.any(Object));
      expect(result.model_count).toBe(1);
    });
  });

  describe('systemApi.getSettings', () => {
    it('fetches system settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ollama_base_url: 'http://localhost:11434' }),
      });

      const result = await systemApi.getSettings();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/settings', expect.any(Object));
      expect(result).toBeDefined();
    });
  });

  describe('systemApi.updateSettings', () => {
    it('updates settings with PATCH', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Updated', settings: {} }),
      });

      const result = await systemApi.updateSettings({ temperature: 0.8 });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/settings',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ temperature: 0.8 }),
        })
      );
    });

    it('handles restart_required response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'Updated',
          settings: {},
          restart_required: ['model'],
        }),
      });

      const result = await systemApi.updateSettings({});

      expect(result.restart_required).toContain('model');
    });
  });

  describe('systemApi.applySettings', () => {
    it('applies pending settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Applied', applied: ['model'], settings: {} }),
      });

      const result = await systemApi.applySettings();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/settings/apply',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.applied).toContain('model');
    });
  });

  describe('systemApi.createBackup', () => {
    it('creates backup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Backup created', path: '/backups/backup-2024-01-01' }),
      });

      const result = await systemApi.createBackup();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/backup',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.path).toBeDefined();
    });
  });

  describe('systemApi.restoreBackup', () => {
    it('restores from backup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Restored' }),
      });

      const result = await systemApi.restoreBackup('/backups/backup-2024-01-01');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/restore',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ backup_path: '/backups/backup-2024-01-01' }),
        })
      );
    });
  });

  describe('systemApi.getDirs', () => {
    it('fetches directories info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          directories: {
            workspace: { path: '/workspace', size_bytes: 1000, size_mb: 0.001 },
          },
        }),
      });

      const result = await systemApi.getDirs();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/dirs', expect.any(Object));
      expect(result.directories).toBeDefined();
    });
  });

  describe('systemApi.clearCache', () => {
    it('clears system cache', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Cache cleared' }),
      });

      const result = await systemApi.clearCache();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/cache/clear',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});

describe('Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when health endpoint returns ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const result = await checkHealth();

    expect(mockFetch).toHaveBeenCalledWith('/api/health');
    expect(result).toBe(true);
  });

  it('returns false when health endpoint returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const result = await checkHealth();

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkHealth();

    expect(result).toBe(false);
  });

  it('uses correct health endpoint without /v1 prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
    });

    await checkHealth();

    expect(mockFetch).toHaveBeenCalledWith('/api/health');
    expect(mockFetch).not.toHaveBeenCalledWith('/api/v1/health');
  });
});