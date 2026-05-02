import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAgentStore } from '../stores/agentStore';
import { agentApi } from '../services/api';

vi.mock('../services/api', () => ({
  agentApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
}));

describe('AgentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentStore.setState({
      agents: [],
      selectedAgentId: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('has empty agents array', () => {
      const { agents } = useAgentStore.getState();
      expect(agents).toEqual([]);
    });

    it('has null selectedAgentId', () => {
      const { selectedAgentId } = useAgentStore.getState();
      expect(selectedAgentId).toBeNull();
    });

    it('has isLoading false', () => {
      const { isLoading } = useAgentStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has null error', () => {
      const { error } = useAgentStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('fetchAgents', () => {
    it('sets isLoading true when fetching', async () => {
      vi.mocked(agentApi.list).mockResolvedValue({ agents: [], total: 0 });

      const promise = useAgentStore.getState().fetchAgents();

      expect(useAgentStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates agents on success', async () => {
      const mockAgents = [
        { id: '1', name: 'Agent 1', role: 'worker', status: 'idle' },
        { id: '2', name: 'Agent 2', role: 'supervisor', status: 'running' },
      ];
      vi.mocked(agentApi.list).mockResolvedValue({ agents: mockAgents, total: 2 });

      await useAgentStore.getState().fetchAgents();

      expect(useAgentStore.getState().agents).toEqual(mockAgents);
      expect(useAgentStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(agentApi.list).mockRejectedValue(new Error('Failed to fetch'));

      await useAgentStore.getState().fetchAgents();

      expect(useAgentStore.getState().error).toBe('Failed to fetch');
      expect(useAgentStore.getState().isLoading).toBe(false);
    });

    it('clears previous error on new fetch', async () => {
      useAgentStore.setState({ error: 'Previous error' });
      vi.mocked(agentApi.list).mockResolvedValue({ agents: [], total: 0 });

      await useAgentStore.getState().fetchAgents();

      expect(useAgentStore.getState().error).toBeNull();
    });
  });

  describe('createAgent', () => {
    it('sets isLoading true when creating', async () => {
      vi.mocked(agentApi.create).mockResolvedValue({ agent: {}, message: 'Created' });
      vi.mocked(agentApi.list).mockResolvedValue({ agents: [], total: 0 });

      const promise = useAgentStore.getState().createAgent({ name: 'New Agent' });

      expect(useAgentStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('calls agentApi.create with data', async () => {
      const createData = {
        name: 'New Agent',
        description: 'Test',
        role: 'worker',
        model_name: 'llama3',
      };
      vi.mocked(agentApi.create).mockResolvedValue({ agent: {}, message: 'Created' });
      vi.mocked(agentApi.list).mockResolvedValue({ agents: [], total: 0 });

      await useAgentStore.getState().createAgent(createData);

      expect(agentApi.create).toHaveBeenCalledWith(createData);
    });

    it('calls fetchAgents after successful creation', async () => {
      vi.mocked(agentApi.create).mockResolvedValue({ agent: {}, message: 'Created' });
      vi.mocked(agentApi.list).mockResolvedValue({ agents: [], total: 0 });

      await useAgentStore.getState().createAgent({ name: 'New Agent' });

      expect(agentApi.list).toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
      vi.mocked(agentApi.create).mockRejectedValue(new Error('Creation failed'));

      await useAgentStore.getState().createAgent({ name: 'New Agent' });

      expect(useAgentStore.getState().error).toBe('Creation failed');
      expect(useAgentStore.getState().isLoading).toBe(false);
    });
  });

  describe('updateAgent', () => {
    it('calls agentApi.update with agentId and data', async () => {
      vi.mocked(agentApi.update).mockResolvedValue({ agent: {}, message: 'Updated' });
      vi.mocked(agentApi.list).mockResolvedValue({ agents: [], total: 0 });

      await useAgentStore.getState().updateAgent('agent-1', { name: 'Updated Name' });

      expect(agentApi.update).toHaveBeenCalledWith('agent-1', { name: 'Updated Name' });
    });

    it('calls fetchAgents after successful update', async () => {
      vi.mocked(agentApi.update).mockResolvedValue({ agent: {}, message: 'Updated' });
      vi.mocked(agentApi.list).mockResolvedValue({ agents: [], total: 0 });

      await useAgentStore.getState().updateAgent('agent-1', { name: 'Updated' });

      expect(agentApi.list).toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
      vi.mocked(agentApi.update).mockRejectedValue(new Error('Update failed'));

      await useAgentStore.getState().updateAgent('agent-1', { name: 'Updated' });

      expect(useAgentStore.getState().error).toBe('Update failed');
    });
  });

  describe('deleteAgent', () => {
    it('calls agentApi.delete with agentId', async () => {
      vi.mocked(agentApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useAgentStore.getState().deleteAgent('agent-1');

      expect(agentApi.delete).toHaveBeenCalledWith('agent-1');
    });

    it('removes agent from agents array', async () => {
      useAgentStore.setState({
        agents: [
          { id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'idle' },
          { id: 'agent-2', name: 'Agent 2', role: 'worker', status: 'idle' },
        ],
      });
      vi.mocked(agentApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useAgentStore.getState().deleteAgent('agent-1');

      expect(useAgentStore.getState().agents).toHaveLength(1);
      expect(useAgentStore.getState().agents[0].id).toBe('agent-2');
    });

    it('clears selectedAgentId if deleted agent was selected', async () => {
      useAgentStore.setState({
        agents: [{ id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'idle' }],
        selectedAgentId: 'agent-1',
      });
      vi.mocked(agentApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useAgentStore.getState().deleteAgent('agent-1');

      expect(useAgentStore.getState().selectedAgentId).toBeNull();
    });

    it('does not clear selectedAgentId if different agent was selected', async () => {
      useAgentStore.setState({
        agents: [
          { id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'idle' },
          { id: 'agent-2', name: 'Agent 2', role: 'worker', status: 'idle' },
        ],
        selectedAgentId: 'agent-2',
      });
      vi.mocked(agentApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useAgentStore.getState().deleteAgent('agent-1');

      expect(useAgentStore.getState().selectedAgentId).toBe('agent-2');
    });

    it('sets error on failure', async () => {
      vi.mocked(agentApi.delete).mockRejectedValue(new Error('Delete failed'));

      await useAgentStore.getState().deleteAgent('agent-1');

      expect(useAgentStore.getState().error).toBe('Delete failed');
    });
  });

  describe('startAgent', () => {
    it('calls agentApi.start with agentId', async () => {
      vi.mocked(agentApi.start).mockResolvedValue({
        agent: { id: 'agent-1', name: 'Agent 1', status: 'running' },
        message: 'Started',
      });

      await useAgentStore.getState().startAgent('agent-1');

      expect(agentApi.start).toHaveBeenCalledWith('agent-1');
    });

    it('updates only the specified agent status to running', async () => {
      useAgentStore.setState({
        agents: [
          { id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'idle' },
          { id: 'agent-2', name: 'Agent 2', role: 'worker', status: 'idle' },
        ],
      });
      vi.mocked(agentApi.start).mockResolvedValue({
        agent: { id: 'agent-1', status: 'running' },
        message: 'Started',
      });

      await useAgentStore.getState().startAgent('agent-1');

      expect(useAgentStore.getState().agents[0].status).toBe('running');
      expect(useAgentStore.getState().agents[1].status).toBe('idle');
    });

    it('sets error on failure', async () => {
      vi.mocked(agentApi.start).mockRejectedValue(new Error('Start failed'));

      await useAgentStore.getState().startAgent('agent-1');

      expect(useAgentStore.getState().error).toBe('Start failed');
    });
  });

  describe('pauseAgent', () => {
    it('calls agentApi.pause with agentId', async () => {
      vi.mocked(agentApi.pause).mockResolvedValue({
        agent: { id: 'agent-1', name: 'Agent 1', status: 'idle' },
        message: 'Paused',
      });

      await useAgentStore.getState().pauseAgent('agent-1');

      expect(agentApi.pause).toHaveBeenCalledWith('agent-1');
    });

    it('updates only the specified agent status to idle', async () => {
      useAgentStore.setState({
        agents: [
          { id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'running' },
          { id: 'agent-2', name: 'Agent 2', role: 'worker', status: 'running' },
        ],
      });
      vi.mocked(agentApi.pause).mockResolvedValue({
        agent: { id: 'agent-1', status: 'idle' },
        message: 'Paused',
      });

      await useAgentStore.getState().pauseAgent('agent-1');

      expect(useAgentStore.getState().agents[0].status).toBe('idle');
      expect(useAgentStore.getState().agents[1].status).toBe('running');
    });

    it('sets error on failure', async () => {
      vi.mocked(agentApi.pause).mockRejectedValue(new Error('Pause failed'));

      await useAgentStore.getState().pauseAgent('agent-1');

      expect(useAgentStore.getState().error).toBe('Pause failed');
    });
  });

  describe('resumeAgent', () => {
    it('calls agentApi.resume with agentId', async () => {
      vi.mocked(agentApi.resume).mockResolvedValue({
        agent: { id: 'agent-1', name: 'Agent 1', status: 'running' },
        message: 'Resumed',
      });

      await useAgentStore.getState().resumeAgent('agent-1');

      expect(agentApi.resume).toHaveBeenCalledWith('agent-1');
    });

    it('updates only the specified agent status to running', async () => {
      useAgentStore.setState({
        agents: [
          { id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'idle' },
          { id: 'agent-2', name: 'Agent 2', role: 'worker', status: 'idle' },
        ],
      });
      vi.mocked(agentApi.resume).mockResolvedValue({
        agent: { id: 'agent-1', status: 'running' },
        message: 'Resumed',
      });

      await useAgentStore.getState().resumeAgent('agent-1');

      expect(useAgentStore.getState().agents[0].status).toBe('running');
      expect(useAgentStore.getState().agents[1].status).toBe('idle');
    });

    it('sets error on failure', async () => {
      vi.mocked(agentApi.resume).mockRejectedValue(new Error('Resume failed'));

      await useAgentStore.getState().resumeAgent('agent-1');

      expect(useAgentStore.getState().error).toBe('Resume failed');
    });
  });

  describe('setSelectedAgent', () => {
    it('sets selectedAgentId to given id', () => {
      useAgentStore.getState().setSelectedAgent('agent-1');

      expect(useAgentStore.getState().selectedAgentId).toBe('agent-1');
    });

    it('sets selectedAgentId to null', () => {
      useAgentStore.setState({ selectedAgentId: 'agent-1' });

      useAgentStore.getState().setSelectedAgent(null);

      expect(useAgentStore.getState().selectedAgentId).toBeNull();
    });
  });

  describe('updateAgentStatus', () => {
    it('updates only the specified agent status', () => {
      useAgentStore.setState({
        agents: [
          { id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'idle' },
          { id: 'agent-2', name: 'Agent 2', role: 'worker', status: 'idle' },
        ],
      });

      useAgentStore.getState().updateAgentStatus('agent-1', 'running');

      expect(useAgentStore.getState().agents[0].status).toBe('running');
      expect(useAgentStore.getState().agents[1].status).toBe('idle');
    });

    it('handles all status values', () => {
      useAgentStore.setState({
        agents: [{ id: 'agent-1', name: 'Agent 1', role: 'worker', status: 'idle' }],
      });

      const statuses = ['idle', 'running', 'stopped', 'error'];

      statuses.forEach((status) => {
        useAgentStore.getState().updateAgentStatus('agent-1', status as any);
        expect(useAgentStore.getState().agents[0].status).toBe(status);
      });
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      useAgentStore.setState({ error: 'Some error' });

      useAgentStore.getState().clearError();

      expect(useAgentStore.getState().error).toBeNull();
    });
  });

  describe('Concurrent Operations', () => {
    it('handles multiple fetchAgents calls', async () => {
      vi.mocked(agentApi.list)
        .mockResolvedValueOnce({ agents: [{ id: '1' }], total: 1 })
        .mockResolvedValueOnce({ agents: [{ id: '1' }, { id: '2' }], total: 2 });

      const [promise1, promise2] = [
        useAgentStore.getState().fetchAgents(),
        useAgentStore.getState().fetchAgents(),
      ];

      await Promise.all([promise1, promise2]);

      expect(useAgentStore.getState().agents).toHaveLength(2);
    });
  });
});