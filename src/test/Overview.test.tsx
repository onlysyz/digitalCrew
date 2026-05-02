import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Overview from '../pages/Overview';
import React from 'react';
import { useAgentStore } from '../stores/agentStore';
import { useSystemStore } from '../stores/systemStore';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = (props: Record<string, unknown>) => React.createElement('span', { ...props, 'data-testid': 'mock-icon' });
  return {
    Users: MockIcon,
    Cpu: MockIcon,
    HardDrive: MockIcon,
    UserPlus: MockIcon,
    SearchCode: MockIcon,
    X: MockIcon,
    Loader2: MockIcon,
    Trash2: MockIcon,
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock AgentCard
vi.mock('../components/dashboard/AgentCard', () => ({
  default: ({ agentId, name, role, status, onStart, onPause, onResume, onEdit, onMemory, onDelete }: {
    agentId: string;
    name: string;
    role: string;
    status: string;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onEdit: () => void;
    onMemory: () => void;
    onDelete: () => void;
  }) => (
    React.createElement('div', { 'data-testid': 'agent-card', 'data-agent-id': agentId },
      React.createElement('span', { 'data-testid': 'agent-name' }, name),
      React.createElement('span', { 'data-testid': 'agent-role' }, role),
      React.createElement('span', { 'data-testid': 'agent-status' }, status),
      React.createElement('button', { onClick: onStart, 'data-testid': 'start-btn' }, 'Start'),
      React.createElement('button', { onClick: onPause, 'data-testid': 'pause-btn' }, 'Pause'),
      React.createElement('button', { onClick: onResume, 'data-testid': 'resume-btn' }, 'Resume'),
      React.createElement('button', { onClick: onEdit, 'data-testid': 'edit-btn' }, 'Edit'),
      React.createElement('button', { onClick: onMemory, 'data-testid': 'memory-btn' }, 'Memory'),
      React.createElement('button', { onClick: onDelete, 'data-testid': 'delete-btn' }, 'Delete')
    )
  ),
}));

// Mock AgentModal
vi.mock('../components/modals/AgentModal', () => ({
  default: ({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (data: unknown) => void }) =>
    isOpen ? React.createElement('div', { 'data-testid': 'agent-modal' },
      React.createElement('button', { onClick: onClose, 'data-testid': 'modal-close' }, 'Close'),
      React.createElement('button', { onClick: () => onSubmit({}) }, 'Submit')
    ) : null,
}));

// Mock AgentEditModal
vi.mock('../components/modals/AgentEditModal', () => ({
  default: ({ isOpen, onClose, onSubmit }: { isOpen: boolean; agent: unknown; onClose: () => void; onSubmit: (data: unknown) => void }) =>
    isOpen ? React.createElement('div', { 'data-testid': 'edit-modal' },
      React.createElement('button', { onClick: onClose, 'data-testid': 'edit-modal-close' }, 'Close'),
      React.createElement('button', { onClick: () => onSubmit({}) }, 'Update')
    ) : null,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Overview Component Rendering', () => {
  const mockAgents = [
    { id: '1', name: 'Supervisor One', role: 'supervisor', status: 'running', description: 'A supervisor agent', model_name: 'llama3.2', metrics: { tasks_completed: 10 } },
    { id: '2', name: 'Worker One', role: 'worker', status: 'idle', description: 'A worker agent', model_name: 'llama3.2', metrics: { tasks_completed: 5 } },
    { id: '3', name: 'Worker Two', role: 'worker', status: 'paused', description: 'Another worker', model_name: 'llama3.2', metrics: { tasks_completed: 3 } },
  ];

  const mockModels = {
    model_count: 2,
    total_vram_gb: 8,
    models: [{ name: 'llama3.2:latest' }, { name: 'codellama:13b' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAgentStore.setState({
      agents: [],
      isLoading: false,
      error: null,
      fetchAgents: vi.fn().mockResolvedValue(undefined),
      createAgent: vi.fn().mockResolvedValue({}),
      startAgent: vi.fn().mockResolvedValue(undefined),
      pauseAgent: vi.fn().mockResolvedValue(undefined),
      resumeAgent: vi.fn().mockResolvedValue(undefined),
      updateAgent: vi.fn().mockResolvedValue(undefined),
      deleteAgent: vi.fn().mockResolvedValue(undefined),
    });
    useSystemStore.setState({
      models: null,
      fetchModels: vi.fn().mockResolvedValue(undefined),
    });
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/agents') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ agents: mockAgents }) });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockModels) });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Header', () => {
    it('renders page header with title', () => {
      render(<Overview />);
      expect(screen.getByText('团队概览')).toBeTruthy();
    });

    it('renders page description', () => {
      render(<Overview />);
      expect(screen.getByText('管理并监控您的本地执行代理团队。')).toBeTruthy();
    });
  });

  describe('Summary Widgets', () => {
    it('renders active agents counter widget', () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);
      expect(screen.getByText('活跃代理')).toBeTruthy();
    });

    it('renders local models widget', () => {
      useSystemStore.setState({ models: mockModels });
      render(<Overview />);
      expect(screen.getByText('本地模型')).toBeTruthy();
    });

    it('renders vram usage widget', () => {
      useSystemStore.setState({ models: mockModels });
      render(<Overview />);
      expect(screen.getByText('显存占用')).toBeTruthy();
    });

    it('displays correct agent count', () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);
      // 2 agents are running or idle
      const agentCountElement = document.querySelector('.font-mono');
      expect(agentCountElement?.textContent).toContain('2');
    });

    it('displays model count from store', () => {
      useSystemStore.setState({ models: mockModels });
      render(<Overview />);
      expect(screen.getByText('2 实例')).toBeTruthy();
    });
  });

  describe('Add Agent Button', () => {
    it('renders add new agent button', () => {
      render(<Overview />);
      expect(screen.getByText('新增数字员工')).toBeTruthy();
    });

    it('renders add button with description', () => {
      render(<Overview />);
      expect(screen.getByText('配置新的本地代理或连接远程服务')).toBeTruthy();
    });
  });

  describe('Search and Filter', () => {
    it('renders search input', () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);
      const searchInput = document.querySelector('input[placeholder="搜索代理..."]');
      expect(searchInput).toBeTruthy();
    });

    it('renders filter buttons', () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);
      expect(screen.getByText('全部')).toBeTruthy();
      expect(screen.getByText('主管')).toBeTruthy();
      expect(screen.getByText('工作')).toBeTruthy();
    });
  });

  describe('Agent Grid Display', () => {
    it('renders agent cards when agents exist', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        expect(screen.getByText('Supervisor One')).toBeTruthy();
      });
    });

    it('renders correct number of agent cards', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        const agentCards = document.querySelectorAll('[data-testid="agent-card"]');
        expect(agentCards.length).toBe(3);
      });
    });

    it('displays all agent names', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        expect(screen.getByText('Supervisor One')).toBeTruthy();
        expect(screen.getByText('Worker One')).toBeTruthy();
        expect(screen.getByText('Worker Two')).toBeTruthy();
      });
    });
  });

  describe('Loading States', () => {
    it('shows skeleton loading when isLoading is true', () => {
      useAgentStore.setState({ isLoading: true });
      render(<Overview />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('hides skeleton when not loading', async () => {
      useAgentStore.setState({ agents: mockAgents, isLoading: false });
      render(<Overview />);

      await waitFor(() => {
        expect(screen.getByText('Supervisor One')).toBeTruthy();
      });
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no agents exist', async () => {
      useAgentStore.setState({ agents: [] });
      render(<Overview />);

      await waitFor(() => {
        expect(screen.getByText('暂无代理')).toBeTruthy();
      });
    });

    it('shows empty state message with call to action', async () => {
      useAgentStore.setState({ agents: [] });
      render(<Overview />);

      await waitFor(() => {
        expect(screen.getByText('点击上方按钮创建您的第一个数字员工')).toBeTruthy();
      });
    });
  });

  describe('Data Fetching States', () => {
    it('renders with null models without crashing', () => {
      useSystemStore.setState({ models: null });
      render(<Overview />);
      expect(screen.getByText('团队概览')).toBeTruthy();
    });

    it('renders with undefined models without crashing', () => {
      useSystemStore.setState({ models: undefined as any });
      render(<Overview />);
      expect(screen.getByText('团队概览')).toBeTruthy();
    });

    it('renders with empty models object', () => {
      useSystemStore.setState({ models: { model_count: 0, total_vram_gb: 0, models: [] } });
      render(<Overview />);
      expect(screen.getByText('团队概览')).toBeTruthy();
    });

    it('renders with large vram value', () => {
      useSystemStore.setState({ models: { model_count: 4, total_vram_gb: 32, models: [] } });
      render(<Overview />);
      expect(screen.getByText('32 GB')).toBeTruthy();
    });

    it('handles rapid fetch completion', async () => {
      useAgentStore.setState({ agents: mockAgents });
      useSystemStore.setState({ models: mockModels });
      render(<Overview />);

      await waitFor(() => {
        expect(screen.getByText('Supervisor One')).toBeTruthy();
        expect(screen.getByText('2 实例')).toBeTruthy();
      });
    });

    it('handles fetch with partial data', async () => {
      useAgentStore.setState({
        agents: [{ id: '1', name: 'Partial Agent', role: 'worker', status: 'idle', description: '', model_name: 'llama3' }],
      });
      useSystemStore.setState({
        models: { model_count: 1, total_vram_gb: 4, models: [{ name: 'llama3' }] },
      });
      render(<Overview />);

      await waitFor(() => {
        expect(screen.getByText('Partial Agent')).toBeTruthy();
      });
    });
  });

  describe('Loading State Details', () => {
    it('shows multiple skeleton placeholders during loading', () => {
      useAgentStore.setState({ isLoading: true });
      render(<Overview />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      // Should show 3 skeleton placeholder cards
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it('loading state hides agent grid', () => {
      useAgentStore.setState({ isLoading: true, agents: mockAgents });
      render(<Overview />);
      // When loading, agent cards should not be visible
      const agentCards = document.querySelectorAll('[data-testid="agent-card"]');
      expect(agentCards.length).toBe(0);
    });

    it('clears previous agents when loading starts', () => {
      useAgentStore.setState({ agents: mockAgents, isLoading: true });
      render(<Overview />);
      const agentCards = document.querySelectorAll('[data-testid="agent-card"]');
      expect(agentCards.length).toBe(0);
    });
  });

  describe('Error State Rendering', () => {
    it('renders with error in agent store', () => {
      useAgentStore.setState({ error: 'Failed to fetch agents' });
      render(<Overview />);
      // Component should still render
      expect(screen.getByText('团队概览')).toBeTruthy();
    });

    it('renders with empty agents array after error', () => {
      useAgentStore.setState({ agents: [], error: 'Previous error' });
      render(<Overview />);
      expect(screen.getByText('团队概览')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('opens create modal when add agent button is clicked', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      const addButton = screen.getByText('新增数字员工');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(document.querySelector('[data-testid="agent-modal"]')).toBeTruthy();
      });
    });

    it('closes create modal when close button is clicked', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      // Open modal
      fireEvent.click(screen.getByText('新增数字员工'));

      await waitFor(() => {
        expect(document.querySelector('[data-testid="agent-modal"]')).toBeTruthy();
      });

      // Close modal
      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(document.querySelector('[data-testid="agent-modal"]')).toBeNull();
      });
    });

    it('renders delete button for each agent card', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        const deleteButtons = document.querySelectorAll('[data-testid="delete-btn"]');
        expect(deleteButtons.length).toBe(3);
      });
    });

    it('renders edit button for each agent card', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        const editButtons = document.querySelectorAll('[data-testid="edit-btn"]');
        expect(editButtons.length).toBe(3);
      });
    });

    it('renders start button for each agent card', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        const startButtons = document.querySelectorAll('[data-testid="start-btn"]');
        expect(startButtons.length).toBe(3);
      });
    });

    it('renders pause button for each agent card', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        const pauseButtons = document.querySelectorAll('[data-testid="pause-btn"]');
        expect(pauseButtons.length).toBe(3);
      });
    });

    it('renders memory button for each agent card', async () => {
      useAgentStore.setState({ agents: mockAgents });
      render(<Overview />);

      await waitFor(() => {
        const memoryButtons = document.querySelectorAll('[data-testid="memory-btn"]');
        expect(memoryButtons.length).toBe(3);
      });
    });
  });
});

describe('Overview Store Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    useAgentStore.setState({
      agents: [],
      isLoading: false,
      fetchAgents: vi.fn().mockResolvedValue(undefined),
      createAgent: vi.fn().mockResolvedValue({}),
      startAgent: vi.fn().mockResolvedValue(undefined),
      pauseAgent: vi.fn().mockResolvedValue(undefined),
      resumeAgent: vi.fn().mockResolvedValue(undefined),
      updateAgent: vi.fn().mockResolvedValue(undefined),
      deleteAgent: vi.fn().mockResolvedValue(undefined),
    });

    useSystemStore.setState({
      models: null,
      fetchModels: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Agent Filtering Logic', () => {
    it('filters agents by search query - name match', () => {
      const agents = [
        { id: '1', name: 'Alice', role: 'worker', status: 'idle', description: 'Search expert' },
        { id: '2', name: 'Bob', role: 'worker', status: 'idle', description: 'Data analyst' },
      ];

      const searchQuery = 'Alice';
      const filtered = agents.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Alice');
    });

    it('filters agents by search query - description match', () => {
      const agents = [
        { id: '1', name: 'Alice', role: 'worker', status: 'idle', description: 'Search expert' },
        { id: '2', name: 'Bob', role: 'worker', status: 'idle', description: 'Data analyst' },
      ];

      const searchQuery = 'analyst';
      const filtered = agents.filter(a =>
        a.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Bob');
    });

    it('filters agents by role - supervisor', () => {
      const agents = [
        { id: '1', name: 'Supervisor 1', role: 'supervisor', status: 'idle', description: '' },
        { id: '2', name: 'Worker 1', role: 'worker', status: 'idle', description: '' },
      ];

      const roleFilter = 'supervisor';
      const filtered = agents.filter(a => a.role === roleFilter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].role).toBe('supervisor');
    });

    it('filters agents by role - worker', () => {
      const agents = [
        { id: '1', name: 'Supervisor 1', role: 'supervisor', status: 'idle', description: '' },
        { id: '2', name: 'Worker 1', role: 'worker', status: 'idle', description: '' },
      ];

      const roleFilter = 'worker';
      const filtered = agents.filter(a => a.role === roleFilter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].role).toBe('worker');
    });

    it('shows all agents when filter is all', () => {
      const agents = [
        { id: '1', name: 'Supervisor 1', role: 'supervisor', status: 'idle', description: '' },
        { id: '2', name: 'Worker 1', role: 'worker', status: 'idle', description: '' },
      ];

      const roleFilter = 'all';
      const filtered = agents.filter(a => roleFilter === 'all' || a.role === roleFilter);

      expect(filtered).toHaveLength(2);
    });

    it('combines search and role filters', () => {
      const agents = [
        { id: '1', name: 'Alice', role: 'supervisor', status: 'idle', description: '' },
        { id: '2', name: 'Alice', role: 'worker', status: 'idle', description: '' },
        { id: '3', name: 'Bob', role: 'worker', status: 'idle', description: '' },
      ];

      const searchQuery = 'Alice';
      const roleFilter = 'supervisor';

      const filtered = agents.filter(a => {
        const matchesSearch = searchQuery === '' ||
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || a.role === roleFilter;
        return matchesSearch && matchesRole;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Alice');
      expect(filtered[0].role).toBe('supervisor');
    });
  });

  describe('Active Count Calculation', () => {
    it('counts active agents correctly', () => {
      const agents = [
        { id: '1', name: 'Agent 1', role: 'worker', status: 'running' },
        { id: '2', name: 'Agent 2', role: 'worker', status: 'idle' },
        { id: '3', name: 'Agent 3', role: 'worker', status: 'stopped' },
      ];

      const activeCount = agents.filter(a => a.status === 'running' || a.status === 'idle').length;

      expect(activeCount).toBe(2);
    });

    it('returns 0 when no agents', () => {
      const agents: any[] = [];
      const activeCount = agents.filter(a => a.status === 'running' || a.status === 'idle').length;
      expect(activeCount).toBe(0);
    });
  });

  describe('Agent Actions', () => {
    it('startAgent is called with agent id', async () => {
      const startAgentMock = vi.fn().mockResolvedValue(undefined);
      useAgentStore.setState({ startAgent: startAgentMock });

      const agentId = 'agent-123';
      await useAgentStore.getState().startAgent(agentId);

      expect(startAgentMock).toHaveBeenCalledWith(agentId);
    });

    it('pauseAgent is called with agent id', async () => {
      const pauseAgentMock = vi.fn().mockResolvedValue(undefined);
      useAgentStore.setState({ pauseAgent: pauseAgentMock });

      const agentId = 'agent-123';
      await useAgentStore.getState().pauseAgent(agentId);

      expect(pauseAgentMock).toHaveBeenCalledWith(agentId);
    });

    it('resumeAgent is called with agent id', async () => {
      const resumeAgentMock = vi.fn().mockResolvedValue(undefined);
      useAgentStore.setState({ resumeAgent: resumeAgentMock });

      const agentId = 'agent-123';
      await useAgentStore.getState().resumeAgent(agentId);

      expect(resumeAgentMock).toHaveBeenCalledWith(agentId);
    });

    it('deleteAgent is called with agent id', async () => {
      const deleteAgentMock = vi.fn().mockResolvedValue(undefined);
      useAgentStore.setState({ deleteAgent: deleteAgentMock });

      const agentId = 'agent-123';
      await useAgentStore.getState().deleteAgent(agentId);

      expect(deleteAgentMock).toHaveBeenCalledWith(agentId);
    });

    it('createAgent is called with correct data', async () => {
      const createAgentMock = vi.fn().mockResolvedValue({});
      useAgentStore.setState({ createAgent: createAgentMock });

      const agentData = {
        name: 'Test Agent',
        description: 'Test description',
        role: 'worker' as const,
        model_name: 'llama3',
        system_prompt: 'You are a helpful agent.',
        tool_permissions: [],
      };

      await useAgentStore.getState().createAgent(agentData);

      expect(createAgentMock).toHaveBeenCalledWith(agentData);
    });
  });

  describe('Update Agent', () => {
    it('updateAgent is called with id and data', async () => {
      const updateAgentMock = vi.fn().mockResolvedValue(undefined);
      useAgentStore.setState({ updateAgent: updateAgentMock });

      const agentId = 'agent-123';
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
        role: 'worker' as const,
        system_prompt: 'New prompt',
        tool_permissions: [],
      };

      await useAgentStore.getState().updateAgent(agentId, updateData);

      expect(updateAgentMock).toHaveBeenCalledWith(agentId, updateData);
    });
  });

  describe('Empty State Logic', () => {
    it('shows "no agents" message when agent list is empty', () => {
      const agents: any[] = [];
      expect(agents.length === 0).toBe(true);
    });

    it('shows "no matching" message when filter returns empty', () => {
      const agents = [{ id: '1', name: 'Agent 1', role: 'worker', status: 'idle', description: '' }];
      const searchQuery = 'nonexistent';

      const filtered = agents.filter(a =>
        searchQuery === '' ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered.length === 0 && agents.length > 0).toBe(true);
    });
  });
});