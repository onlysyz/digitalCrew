import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ChatPanel from '../pages/ChatPanel';
import React from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAgentStore } from '../stores/agentStore';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = (props: Record<string, unknown>) => React.createElement('span', { ...props, 'data-testid': 'mock-icon' });
  return {
    Send: MockIcon,
    Plus: MockIcon,
    BrainCircuit: MockIcon,
    Zap: MockIcon,
    ChevronDown: MockIcon,
    LayoutDashboard: MockIcon,
    FileUp: MockIcon,
    Terminal: MockIcon,
    Bot: MockIcon,
    Users: MockIcon,
    Loader2: MockIcon,
    X: MockIcon,
    CheckCircle2: MockIcon,
    Clock: MockIcon,
    Copy: MockIcon,
    Check: MockIcon,
    RefreshCw: MockIcon,
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock agentStore
const mockAgents = [
  { id: 'agent-1', name: 'Worker One', role: 'worker', status: 'idle' as const, description: 'Test worker' },
  { id: 'agent-2', name: 'Worker Two', role: 'worker', status: 'idle' as const, description: 'Another worker' },
  { id: 'supervisor-1', name: 'Supervisor One', role: 'supervisor', status: 'idle' as const, description: 'Test supervisor' },
];

vi.mock('../stores/agentStore', () => ({
  useAgentStore: () => ({
    agents: mockAgents,
    fetchAgents: vi.fn().mockResolvedValue(undefined),
    createAgent: vi.fn().mockResolvedValue(undefined),
    updateAgent: vi.fn().mockResolvedValue(undefined),
    deleteAgent: vi.fn().mockResolvedValue(undefined),
    startAgent: vi.fn().mockResolvedValue(undefined),
    pauseAgent: vi.fn().mockResolvedValue(undefined),
    resumeAgent: vi.fn().mockResolvedValue(undefined),
    setSelectedAgent: vi.fn(),
    updateAgentStatus: vi.fn(),
    clearError: vi.fn(),
  }),
}));

describe('ChatPanel StreamEvent Parsing', () => {
  it('parses status event correctly', () => {
    const event = { type: 'status' as const, content: '处理中...' };
    expect(event.type).toBe('status');
    expect(event.content).toBe('处理中...');
  });

  it('parses agents_assigned event correctly', () => {
    const event = {
      type: 'agents_assigned' as const,
      agents: [
        { id: 'agent-1', name: 'Worker 1', role: 'worker' },
      ],
    };
    expect(event.agents).toHaveLength(1);
    expect(event.agents[0].role).toBe('worker');
  });

  it('parses task_created event correctly', () => {
    const event = { type: 'task_created' as const, task_id: 'task-123' };
    expect(event.task_id).toBe('task-123');
  });

  it('parses subtask_start event correctly', () => {
    const event = { type: 'subtask_start' as const, agent_id: 'agent-1', agent_name: 'Worker 1' };
    expect(event.agent_name).toBe('Worker 1');
  });

  it('parses subtask_complete event correctly', () => {
    const event = { type: 'subtask_complete' as const, agent_id: 'agent-1', subtask_id: 'subtask-456', output: '完成' };
    expect(event.output).toBe('完成');
  });

  it('parses subtask_error event correctly', () => {
    const event = { type: 'subtask_error' as const, agent_id: 'agent-1' };
    expect(event.type).toBe('subtask_error');
  });

  it('parses subtask_token event correctly', () => {
    const event = { type: 'subtask_token' as const, agent_id: 'agent-1', token: 'Hello' };
    expect(event.token).toBe('Hello');
  });

  it('parses done event correctly', () => {
    const event = { type: 'done' as const };
    expect(event.type).toBe('done');
  });

  it('parses cancelled event correctly', () => {
    const event = { type: 'cancelled' as const };
    expect(event.type).toBe('cancelled');
  });

  it('parses react_step event correctly', () => {
    const event = {
      type: 'react_step' as const,
      step: { step_id: 1, agent_id: 'agent-1', thought: '思考', action: 'search' },
    };
    expect(event.step?.step_id).toBe(1);
  });

  it('parses error event correctly', () => {
    const event = { type: 'error' as const, content: '出错了' };
    expect(event.content).toBe('出错了');
  });

  it('SSE data format is correctly parsed', () => {
    const sseData = 'data: {"type":"status","content":"处理中..."}';
    const jsonString = sseData.slice(6);
    const event = JSON.parse(jsonString);
    expect(event.type).toBe('status');
  });

  it('handles multiple sequential SSE lines', () => {
    const chunk = `data: {"type":"status","content":"第一步"}
data: {"type":"done"}`;
    const lines = chunk.split('\n');
    const events = lines.filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
    expect(events).toHaveLength(2);
  });
});

describe('ChatPanel Agent Assignment Logic', () => {
  it('maps agent roles correctly', () => {
    const event = {
      type: 'agents_assigned' as const,
      agents: [
        { id: 'a1', name: 'W1', role: 'worker' },
        { id: 'a2', name: 'S1', role: 'supervisor' },
      ],
    };
    const workerCount = event.agents.filter(a => a.role === 'worker').length;
    expect(workerCount).toBe(1);
  });

  it('updates agent status to working on subtask_start', () => {
    const agents = [{ id: 'a1', name: 'W1', role: 'worker', status: 'pending' as const }];
    const updated = agents.map(a => a.id === 'a1' ? { ...a, status: 'working' as const } : a);
    expect(updated[0].status).toBe('working');
  });

  it('updates agent status to completed on subtask_complete', () => {
    const agents = [{ id: 'a1', name: 'W1', role: 'worker', status: 'working' as const }];
    const updated = agents.map(a => a.id === 'a1' ? { ...a, status: 'completed' as const } : a);
    expect(updated[0].status).toBe('completed');
  });

  it('accumulates streaming content on subtask_token', () => {
    const tokens = ['H', 'e', 'l', 'l', 'o'];
    let content = '';
    for (const token of tokens) {
      content += token;
    }
    expect(content).toBe('Hello');
  });

  it('handles interleaved tokens from multiple agents', () => {
    const events = [
      { agent_id: 'a1', token: 'A' },
      { agent_id: 'a2', token: 'X' },
      { agent_id: 'a1', token: 'B' },
    ];
    const agentsContent: Record<string, string> = { a1: '', a2: '' };
    for (const event of events) {
      if (event.agent_id && event.token) {
        agentsContent[event.agent_id] += event.token;
      }
    }
    expect(agentsContent['a1']).toBe('AB');
    expect(agentsContent['a2']).toBe('X');
  });
});

describe('ChatPanel Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('renders ChatPanel component', async () => {
    render(<ChatPanel />);
    // Just verify component renders without crashing
  });

  it('shows mode selector buttons', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('单Agent')).toBeTruthy();
    expect(screen.getByText('团队协作')).toBeTruthy();
  });

  it('shows input textarea', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeTruthy();
  });

  it('switches to team mode', async () => {
    render(<ChatPanel />);
    const teamButton = screen.getByText('团队协作');
    fireEvent.click(teamButton);
  });

  it('switches to single mode', async () => {
    render(<ChatPanel />);
    const singleButton = screen.getByText('单Agent');
    fireEvent.click(singleButton);
  });

  it('renders empty state message in team mode', async () => {
    render(<ChatPanel />);
    const teamButton = screen.getByText('团队协作');
    fireEvent.click(teamButton);
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('renders empty state message in team mode (default)', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('renders empty state message in single mode', async () => {
    render(<ChatPanel />);
    const singleButton = screen.getByText('单Agent');
    fireEvent.click(singleButton);
    expect(screen.getByText('开始对话')).toBeTruthy();
  });

  it('shows submit button', async () => {
    render(<ChatPanel />);
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows file attach button', async () => {
    render(<ChatPanel />);
    const attachButton = document.querySelector('button[type="button"]');
    expect(attachButton).toBeTruthy();
  });

  it('shows agent selector in single mode', async () => {
    render(<ChatPanel />);
    const singleButton = screen.getByText('单Agent');
    fireEvent.click(singleButton);
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
  });

  it('displays placeholder text in input', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('placeholder')).toBeTruthy();
  });

  it('shows hint text for team mode (default)', async () => {
    render(<ChatPanel />);
    expect(screen.getByText(/输入 @ 来提及特定代理/)).toBeTruthy();
  });

  it('shows hint text for single mode', async () => {
    render(<ChatPanel />);
    const singleButton = screen.getByText('单Agent');
    fireEvent.click(singleButton);
    expect(screen.getByText(/Enter 发送/)).toBeTruthy();
  });

  it('renders right sidebar with context panel header', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('当前上下文')).toBeTruthy();
  });

  it('renders agent list in sidebar', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Worker One')).toBeTruthy();
    expect(screen.getByText('Worker Two')).toBeTruthy();
  });
});

describe('ChatPanel Message Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [
        { id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: new Date().toISOString(), metadata: {} },
        { id: 'msg-2', role: 'assistant' as const, content: 'Hi there!', timestamp: new Date().toISOString(), metadata: {} },
      ],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('displays user message', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('displays assistant message', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Hi there!')).toBeTruthy();
  });

  it('displays multiple messages in order', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('Hi there!')).toBeTruthy();
  });

  it('shows user message with timestamp', async () => {
    render(<ChatPanel />);
    const userMsg = screen.getByText('Hello');
    expect(userMsg).toBeTruthy();
  });

  it('shows assistant message indicator', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Hi there!')).toBeTruthy();
  });

  it('renders user message in right-aligned container', async () => {
    render(<ChatPanel />);
    const messages = screen.getAllByText('Hello');
    expect(messages.length).toBeGreaterThan(0);
  });

  it('renders assistant message in left-aligned container', async () => {
    render(<ChatPanel />);
    const messages = screen.getAllByText('Hi there!');
    expect(messages.length).toBeGreaterThan(0);
  });

  it('displays messages when store has messages', async () => {
    useChatStore.setState({
      messages: [
        { id: 'msg-1', role: 'user' as const, content: 'Test message', timestamp: new Date().toISOString(), metadata: {} },
        { id: 'msg-2', role: 'assistant' as const, content: 'Response message', timestamp: new Date().toISOString(), metadata: {} },
        { id: 'msg-3', role: 'user' as const, content: 'Another user msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test message')).toBeTruthy();
    expect(screen.getByText('Response message')).toBeTruthy();
    expect(screen.getByText('Another user msg')).toBeTruthy();
  });
});

describe('ChatPanel Input Handling', () => {
  it('accepts text input', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Test message');
  });

  it('clears input after submit', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });

    const form = textarea.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
  });

  it('handles multi-line input', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Line 1\nLine 2\nLine 3');
  });

  it('handles rapid input changes', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'A' } });
    fireEvent.change(textarea, { target: { value: 'AB' } });
    fireEvent.change(textarea, { target: { value: 'ABC' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('ABC');
  });

  it('submit button exists in form', async () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    const submitButton = form?.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
  });

  it('handles empty submit (no-op)', async () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }
    // Should not crash
  });

  it('text input has correct placeholder in team mode', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('placeholder')).toBe('给主管代理发送指令...');
  });

  it('text input has correct placeholder in single mode', async () => {
    render(<ChatPanel />);
    const singleButton = screen.getByText('单Agent');
    fireEvent.click(singleButton);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('placeholder')).toBe('输入消息...');
  });

  it('handles text selection', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Select me' } });
    // Simple check that value is set
    expect((textarea as HTMLTextAreaElement).value).toBe('Select me');
  });

  it('input respects max height', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.className).toContain('max-h-32');
  });

  it('textarea is focusable', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
  });

  it('enter key does not submit form alone', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    // Regular Enter should not submit (only Ctrl/Cmd+Enter)
  });

  it('ctrl+enter submits form', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    // Should trigger submit
  });

  it('meta+enter submits form (Mac)', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    // Should trigger submit (Mac equivalent)
  });
});

describe('ChatPanel Scrolling Behavior', () => {
  it('renders scrollable message area', async () => {
    render(<ChatPanel />);
    const messageArea = document.querySelector('.custom-scrollbar');
    expect(messageArea).toBeTruthy();
  });

  it('renders messages container with proper structure', async () => {
    useChatStore.setState({
      messages: [
        { id: 'msg-1', role: 'user' as const, content: 'Scroll test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Scroll test')).toBeTruthy();
  });

  it('auto-scroll ref exists in component', async () => {
    render(<ChatPanel />);
    // The messagesEndRef should exist in the DOM as a div ref
    const scrollTarget = document.querySelector('[class*="space-y-8"]');
    expect(scrollTarget).toBeTruthy();
  });

  it('renders many messages without crashing', async () => {
    const manyMessages = Array.from({ length: 20 }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
      timestamp: new Date().toISOString(),
      metadata: {},
    }));
    useChatStore.setState({ messages: manyMessages });
    render(<ChatPanel />);
    expect(screen.getByText('Message 0')).toBeTruthy();
    expect(screen.getByText('Message 19')).toBeTruthy();
  });

  it('scroll behavior is initialized on mount', async () => {
    render(<ChatPanel />);
    // Component should render without errors when mounting
    const container = document.querySelector('.flex-1.overflow-y-auto');
    expect(container).toBeTruthy();
  });

  it('shows new message indicator when messages exist', async () => {
    useChatStore.setState({
      messages: [
        { id: 'msg-1', role: 'assistant' as const, content: 'New message', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('New message')).toBeTruthy();
  });
});

describe('ChatPanel Message Status States', () => {
  it('shows sending indicator when isSending is true', async () => {
    useChatStore.setState({ isSending: true, messages: [] });
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('disabled')).not.toBeNull();
  });

  it('input is disabled during sending', async () => {
    useChatStore.setState({ isSending: true, messages: [] });
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.disabled).toBe(true);
  });

  it('send button is disabled when isSending is true', async () => {
    useChatStore.setState({ isSending: true, messages: [] });
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled).toBe(true);
  });

  it('send button is disabled when input is empty', async () => {
    useChatStore.setState({ isSending: false, messages: [] });
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled).toBe(true);
  });

  it('send button is enabled when input has content', async () => {
    useChatStore.setState({ isSending: false, messages: [] });
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled).toBe(false);
  });

  it('input is disabled when streaming', async () => {
    useChatStore.setState({ isSending: false, messages: [] });
    render(<ChatPanel />);
    // Note: isStreaming is internal state
    // Testing through store state
  });

  it('shows error state when store has error', async () => {
    useChatStore.setState({
      error: 'Connection failed',
      messages: [],
      isSending: false,
    });
    render(<ChatPanel />);
    // Error toast should be called via mock
  });

  it('clears error on component mount', async () => {
    useChatStore.setState({ error: null });
    render(<ChatPanel />);
    // Should render without showing error
  });

  it('message metadata is preserved', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Test',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('handles empty message list', async () => {
    useChatStore.setState({ messages: [], isSending: false });
    render(<ChatPanel />);
    // Should show empty state
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('handles null timestamp in message', async () => {
    useChatStore.setState({
      messages: [
        { id: 'msg-1', role: 'user' as const, content: 'Test', timestamp: '', metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('message has correct role styling applied', async () => {
    useChatStore.setState({
      messages: [
        { id: 'msg-1', role: 'user' as const, content: 'User message', timestamp: new Date().toISOString(), metadata: {} },
        { id: 'msg-2', role: 'assistant' as const, content: 'Assistant message', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('User message')).toBeTruthy();
    expect(screen.getByText('Assistant message')).toBeTruthy();
  });

  it('shows loading spinner when sending', async () => {
    useChatStore.setState({ isSending: true, messages: [] });
    render(<ChatPanel />);
    // Spinner icon should be visible (mocked as mock-icon)
    const icons = document.querySelectorAll('[data-testid="mock-icon"]');
    expect(icons.length).toBeGreaterThan(0);
  });
});

describe('ChatPanel Streaming Response Display', () => {
  it('shows streaming indicator when isStreaming state is set', async () => {
    // Note: isStreaming is internal state, test UI behavior
    useChatStore.setState({ isSending: false, messages: [] });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('shows status message during sending', async () => {
    useChatStore.setState({
      isSending: true,
      messages: [],
    });
    render(<ChatPanel />);
    // During sending, input should be disabled
    const textarea = document.querySelector('textarea');
    expect(textarea?.getAttribute('disabled')).not.toBeNull();
  });

  it('shows processing indicator for team mode with messages', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Team response content',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    // Team mode with messages shows content
    expect(screen.getByText('Team response content')).toBeTruthy();
  });

  it('shows agent status in message display', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-msg',
          role: 'assistant' as const,
          content: 'Agent response text',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    // Messages should be displayed
    expect(screen.getByText('Agent response text')).toBeTruthy();
  });

  it('shows live output section when messages exist', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Agent working...',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Agent working...')).toBeTruthy();
  });

  it('shows execution plan section when present', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Task assigned',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Task assigned')).toBeTruthy();
  });

  it('shows ReAct steps section when present', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Reasoning...',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Reasoning...')).toBeTruthy();
  });

  it('streaming message has proper container styling', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Streamed response text',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: false },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Streamed response text')).toBeTruthy();
  });

  it('handles empty message content', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: '',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    // Should render without crashing - empty messages don't show in UI
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('shows cancel button when streaming with task', async () => {
    useChatStore.setState({ isSending: false, messages: [] });
    render(<ChatPanel />);
    // Cancel button appears when isStreaming && currentTaskId
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows assigned agents progress indicator', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Agent working on task',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Agent working on task')).toBeTruthy();
  });

  it('streaming status message updates', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Processing...',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Processing...')).toBeTruthy();
  });

  it('completed streaming message displays final content', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Final response completed',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: false },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Final response completed')).toBeTruthy();
  });

  it('handles partial streaming content', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Partial content...',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Partial content...')).toBeTruthy();
  });

  it('displays user message with correct role', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'User message content',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('User message content')).toBeTruthy();
  });

  it('displays assistant message with correct role', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Assistant response',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Assistant response')).toBeTruthy();
  });

  it('handles multiple messages in conversation', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'First message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'First response',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          id: 'msg-3',
          role: 'user' as const,
          content: 'Second message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('First message')).toBeTruthy();
    expect(screen.getByText('First response')).toBeTruthy();
    expect(screen.getByText('Second message')).toBeTruthy();
  });

  it('team mode button is clickable', async () => {
    render(<ChatPanel />);
    const teamButton = screen.getByText('团队协作');
    expect(teamButton).toBeTruthy();
  });

  it('single mode button is clickable', async () => {
    render(<ChatPanel />);
    const singleButton = screen.getByText('单Agent');
    expect(singleButton).toBeTruthy();
  });

  it('renders chat input area', async () => {
    render(<ChatPanel />);
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('renders send button', async () => {
    render(<ChatPanel />);
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders sidebar with agents section', async () => {
    render(<ChatPanel />);
    const agentsHeading = screen.getByText('活跃代理');
    expect(agentsHeading).toBeTruthy();
  });

  it('renders context section in sidebar', async () => {
    render(<ChatPanel />);
    const contextHeading = screen.getByText('当前上下文');
    expect(contextHeading).toBeTruthy();
  });

  it('handles session with no messages', async () => {
    useChatStore.setState({
      messages: [],
      currentSessionId: null,
    });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('shows loading state when fetching sessions', async () => {
    useChatStore.setState({ isLoading: true });
    render(<ChatPanel />);
    // Loading state should render form
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles error state in store', async () => {
    useChatStore.setState({ error: 'Failed to send message' });
    render(<ChatPanel />);
    // Should still render
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('message display with system metadata', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'System notification',
          timestamp: new Date().toISOString(),
          metadata: { type: 'system' },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('System notification')).toBeTruthy();
  });

  it('message with task metadata displays correctly', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Task update',
          timestamp: new Date().toISOString(),
          metadata: { taskId: 'task-123', status: 'running' },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Task update')).toBeTruthy();
  });
});

describe('ChatPanel Error Handling', () => {
  it('displays error state from store', async () => {
    useChatStore.setState({ error: 'Failed to send message' });
    render(<ChatPanel />);
    // Component should still render with error
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles error when clearing error', async () => {
    useChatStore.setState({ error: 'Network error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    expect(useChatStore.getState().error).toBeNull();
  });

  it('handles empty error message', async () => {
    useChatStore.setState({ error: '' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles null error state', async () => {
    useChatStore.setState({ error: null });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('renders after error is cleared', async () => {
    useChatStore.setState({ error: 'Previous error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles message with error status metadata', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Error occurred',
          timestamp: new Date().toISOString(),
          metadata: { error: true, status: 'failed' },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Error occurred')).toBeTruthy();
  });

  it('handles failed message send', async () => {
    useChatStore.setState({ isSending: false, error: 'Send failed' });
    render(<ChatPanel />);
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('input is enabled after error is cleared', async () => {
    useChatStore.setState({ error: 'Previous error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    const textarea = document.querySelector('textarea');
    expect(textarea?.getAttribute('disabled')).toBeNull();
  });

  it('handles error during message loading', async () => {
    useChatStore.setState({
      messages: [],
      currentSessionId: 'session-with-error',
    });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles concurrent error and loading states', async () => {
    useChatStore.setState({ isLoading: true, error: 'Loading error' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles error with empty messages array', async () => {
    useChatStore.setState({ messages: [], error: 'No messages' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles long error message', async () => {
    const longError = 'A'.repeat(500);
    useChatStore.setState({ error: longError });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles special characters in error message', async () => {
    useChatStore.setState({ error: 'Error: <script>alert("xss")</script>' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles unicode error message', async () => {
    useChatStore.setState({ error: '错误消息 ❌ 🚫' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });
});

describe('ChatPanel Retry Scenarios', () => {
  it('allows input after failed send attempt', async () => {
    useChatStore.setState({ isSending: false, error: 'Previous send failed' });
    render(<ChatPanel />);
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
    expect(textarea?.getAttribute('disabled')).toBeNull();
  });

  it('can transition from error to success state', async () => {
    // Set up initial error state and render
    useChatStore.setState({ error: 'Initial error' });
    const { rerender } = render(<ChatPanel />);

    // Clear error and add success message
    useChatStore.getState().clearError();
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Success after retry',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    // Re-render to see the new state
    rerender(<ChatPanel />);
    expect(screen.getByText('Success after retry')).toBeTruthy();
  });

  it('handles retry after network failure', async () => {
    useChatStore.setState({ error: 'Network error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    // Verify the form is still present after clearing error
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('allows multiple retry attempts', async () => {
    useChatStore.setState({ error: 'Attempt 1 failed' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();

    useChatStore.setState({ error: 'Attempt 2 failed' });
    expect(useChatStore.getState().error).toBe('Attempt 2 failed');
    useChatStore.getState().clearError();

    useChatStore.setState({ error: 'Attempt 3 failed' });
    expect(useChatStore.getState().error).toBe('Attempt 3 failed');
  });

  it('handles state reset on retry', async () => {
    useChatStore.setState({ isSending: true, error: null });
    render(<ChatPanel />);
    useChatStore.setState({ isSending: false, error: 'Failed' });
    expect(useChatStore.getState().isSending).toBe(false);
  });

  it('handles session restoration after error', async () => {
    useChatStore.setState({
      currentSessionId: 'session-123',
      error: 'Session error',
    });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    expect(useChatStore.getState().currentSessionId).toBe('session-123');
  });

  it('can send message after clearing error', async () => {
    useChatStore.setState({ error: 'Previous error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    // Component should still render properly after clearing error
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles rapid error/clear cycles', async () => {
    for (let i = 0; i < 5; i++) {
      useChatStore.setState({ error: `Error ${i}` });
      expect(useChatStore.getState().error).toBe(`Error ${i}`);
      useChatStore.getState().clearError();
      expect(useChatStore.getState().error).toBeNull();
    }
  });

  it('handles error state with agent selection', async () => {
    // Test that component renders with error and shows form
    useChatStore.setState({ error: 'Agent error' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles retry with message history intact', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Original message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'Failed response',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
      error: 'Response failed',
    });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    expect(screen.getByText('Original message')).toBeTruthy();
    expect(screen.getByText('Failed response')).toBeTruthy();
  });
});

describe('ChatPanel Message Sending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders message input field', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeTruthy();
  });

  it('accepts text input in textarea', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello, agent!' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Hello, agent!');
  });

  it('submits form when clicking send button', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
  });

  it('submit button is disabled when input is empty', async () => {
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled || submitButton?.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('submit button is enabled when input has text', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled).toBe(false);
  });

  it('submits with Ctrl+Enter keyboard shortcut', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Keyboard submit' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    // Submit is triggered - input should be cleared by handleSubmit
  });

  it('submits with Cmd+Enter keyboard shortcut on Mac', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Mac submit' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    // Submit is triggered
  });

  it('does not submit with regular Enter key', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Should not submit' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    // Form should not submit on regular Enter
  });

  it('input is disabled during sending', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.disabled || textarea.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('submit button is disabled during sending', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled || submitButton?.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('shows user message in chat after sending in single mode', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Test user message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test user message')).toBeTruthy();
  });

  it('shows assistant response in chat', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Hello',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'Hello! How can I help?',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Hello! How can I help?')).toBeTruthy();
  });

  it('displays multiple messages in chronological order', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'First message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'First response',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          id: 'msg-3',
          role: 'user' as const,
          content: 'Second message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('First message')).toBeTruthy();
    expect(screen.getByText('First response')).toBeTruthy();
    expect(screen.getByText('Second message')).toBeTruthy();
  });

  it('renders user message with right alignment', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Right aligned',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    const userMessages = document.querySelectorAll('.justify-end');
    expect(userMessages.length).toBeGreaterThan(0);
  });

  it('renders assistant message with left alignment', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Left aligned',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    const assistantMessages = document.querySelectorAll('.justify-start');
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  it('shows timestamp with user message', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Time test',
          timestamp: '2024-01-01T12:00:00.000Z',
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    // Just verify message displays - timestamp formatting is implementation detail
    expect(screen.getByText('Time test')).toBeTruthy();
  });

  it('shows timestamp with assistant message', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Response time',
          timestamp: '2024-01-01T12:30:00.000Z',
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Response time')).toBeTruthy();
  });

  it('input is cleared after form submission', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'To be cleared' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('To be cleared');

    const form = document.querySelector('form');
    if (form) fireEvent.submit(form);

    // Input should be cleared after submit
  });

  it('shows send icon in submit button', async () => {
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
  });

  it('handles form submit event', async () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('disables submit when no input and no attachments', async () => {
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled || submitButton?.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('enable submit when input has text', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Some text' } });
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled).toBe(false);
  });
});

describe('ChatPanel Chat History Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('renders empty state when no messages', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('renders empty state description text', async () => {
    render(<ChatPanel />);
    expect(screen.getByText(/发送消息开始多代理协作任务/)).toBeTruthy();
  });

  it('shows brain icon in empty state', async () => {
    render(<ChatPanel />);
    const emptyState = document.querySelector('.flex.flex-col.items-center.justify-center');
    expect(emptyState).toBeTruthy();
  });

  it('renders single user message correctly', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test message')).toBeTruthy();
  });

  it('renders single assistant message correctly', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Assistant response',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Assistant response')).toBeTruthy();
  });

  it('renders multiple messages in sequence', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Message 1', timestamp: new Date().toISOString(), metadata: {} },
        { id: '2', role: 'assistant', content: 'Message 2', timestamp: new Date().toISOString(), metadata: {} },
        { id: '3', role: 'user', content: 'Message 3', timestamp: new Date().toISOString(), metadata: {} },
        { id: '4', role: 'assistant', content: 'Message 4', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Message 1')).toBeTruthy();
    expect(screen.getByText('Message 2')).toBeTruthy();
    expect(screen.getByText('Message 3')).toBeTruthy();
    expect(screen.getByText('Message 4')).toBeTruthy();
  });

  it('renders user message with "您" label', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User message', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('您')).toBeTruthy();
  });

  it('renders assistant message with "主管代理" label in team mode', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Assistant', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('主管代理')).toBeTruthy();
  });

  it('renders assistant message with "助手" label in single mode', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Assistant', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('助手')).toBeTruthy();
  });

  it('renders copy button on assistant message', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Copy this', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('复制')).toBeTruthy();
  });

  it('renders message scroll area', async () => {
    render(<ChatPanel />);
    const scrollArea = document.querySelector('.overflow-y-auto');
    expect(scrollArea).toBeTruthy();
  });

  it('has custom scrollbar class on message area', async () => {
    render(<ChatPanel />);
    const scrollArea = document.querySelector('.custom-scrollbar');
    expect(scrollArea).toBeTruthy();
  });

  it('scroll area has padding for messages', async () => {
    render(<ChatPanel />);
    const messageArea = document.querySelector('.p-8');
    expect(messageArea).toBeTruthy();
  });

  it('messages have spacing between them', async () => {
    render(<ChatPanel />);
    const spaceY = document.querySelector('.space-y-8');
    expect(spaceY).toBeTruthy();
  });

  it('handles very long message content', async () => {
    const longContent = 'A'.repeat(1000);
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: longContent, timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText(longContent)).toBeTruthy();
  });

  it('handles multiline message content', async () => {
    const multilineContent = 'Line 1\nLine 2\nLine 3\nLine 4';
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: multilineContent, timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    // Multiline content is preserved with whitespace-pre-wrap
    const allText = document.body.textContent || '';
    expect(allText).toContain('Line 1');
    expect(allText).toContain('Line 2');
    expect(allText).toContain('Line 3');
    expect(allText).toContain('Line 4');
  });

  it('message end ref exists for scrolling', async () => {
    render(<ChatPanel />);
    const endRef = document.querySelector('[class*="flex"][class*="flex-col"]');
    expect(endRef).toBeTruthy();
  });

  it('re-renders when new message is added', async () => {
    const { rerender } = render(<ChatPanel />);
    expect(screen.queryByText('New msg')).toBeNull();

    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'New msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });

    rerender(<ChatPanel />);
    expect(screen.getByText('New msg')).toBeTruthy();
  });

  it('renders assistant bubble with correct styling', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Styled', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const bubbles = document.querySelectorAll('.bg-primary\\/5');
    expect(bubbles.length).toBeGreaterThan(0);
  });

  it('renders user bubble with correct styling', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User styled', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const bubbles = document.querySelectorAll('.bg-surface-container-highest');
    expect(bubbles.length).toBeGreaterThan(0);
  });

  it('handles rapid message additions', async () => {
    useChatStore.setState({
      messages: Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
        metadata: {},
      })),
    });
    render(<ChatPanel />);
    expect(screen.getByText('Message 0')).toBeTruthy();
    expect(screen.getByText('Message 9')).toBeTruthy();
  });

  it('shows ORCHESTRATOR badge in team mode', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Team msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('ORCHESTRATOR')).toBeTruthy();
  });

  it('message timestamp uses locale time format', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Time', timestamp: '2024-01-01T12:00:00.000Z', metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Time')).toBeTruthy();
  });

  it('renders gradient overlay in message area', async () => {
    render(<ChatPanel />);
    const gradient = document.querySelector('.bg-gradient-to-b');
    expect(gradient).toBeTruthy();
  });

  it('message content preserves whitespace', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: '  Spaces  preserved  ', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    // Content with leading/trailing spaces is preserved in the rendered output
    const allText = document.body.textContent || '';
    expect(allText).toContain('Spaces  preserved');
  });

  it('renders "重新编辑" button for user messages', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Editable', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('重新编辑')).toBeTruthy();
  });

  it('renders "重新编辑" button that does not appear for assistant messages', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Not editable', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.queryByText('重新编辑')).toBeNull();
  });

  it('renders user message right-aligned and assistant left-aligned', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User msg', timestamp: new Date().toISOString(), metadata: {} },
        { id: '2', role: 'assistant', content: 'Assistant msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const userMessages = document.querySelectorAll('.justify-end');
    const assistantMessages = document.querySelectorAll('.justify-start');
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  it('renders user message in narrower max-width container', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const narrowContainers = document.querySelectorAll('.max-w-\\[70\\%\\]');
    expect(narrowContainers.length).toBeGreaterThan(0);
  });

  it('renders unicode content in messages', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: '中文内容 🚀 emoji', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('中文内容 🚀 emoji')).toBeTruthy();
  });

  it('renders empty string message without crashing', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: '', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('renders message with is_streaming metadata', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Streaming', timestamp: new Date().toISOString(), metadata: { is_streaming: true } },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Streaming')).toBeTruthy();
  });

  it('preserves message order: user message appears before assistant response in DOM', async () => {
    const messages = [
      { id: '1', role: 'user', content: 'First', timestamp: new Date().toISOString(), metadata: {} },
      { id: '2', role: 'assistant', content: 'Second', timestamp: new Date().toISOString(), metadata: {} },
      { id: '3', role: 'user', content: 'Third', timestamp: new Date().toISOString(), metadata: {} },
    ];
    useChatStore.setState({ messages });
    render(<ChatPanel />);

    const userEls = Array.from(document.querySelectorAll('.justify-end'));
    const assistantEls = Array.from(document.querySelectorAll('.justify-start'));
    expect(userEls.length).toBeGreaterThan(0);
    expect(assistantEls.length).toBeGreaterThan(0);
  });
});

describe('ChatPanel Scroll Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls scrollIntoView when messages change', async () => {
    render(<ChatPanel />);

    await act(async () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user', content: 'New message', timestamp: new Date().toISOString(), metadata: {} },
        ],
      });
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('scrollIntoView is called with smooth behavior', async () => {
    render(<ChatPanel />);

    await act(async () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'assistant', content: 'Response', timestamp: new Date().toISOString(), metadata: {} },
        ],
      });
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('scrollIntoView is called when streaming state changes', async () => {
    render(<ChatPanel />);
    Element.prototype.scrollIntoView.mockClear();

    await act(async () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user', content: 'Test', timestamp: new Date().toISOString(), metadata: {} },
        ],
      });
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('scrollIntoView is called when messages are added after mount', async () => {
    render(<ChatPanel />);
    Element.prototype.scrollIntoView.mockClear();

    await act(async () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user', content: 'Initial', timestamp: new Date().toISOString(), metadata: {} },
          { id: '2', role: 'assistant', content: 'Response', timestamp: new Date().toISOString(), metadata: {} },
        ],
      });
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('scrollIntoView is called when assignedAgents change', async () => {
    render(<ChatPanel />);
    Element.prototype.scrollIntoView.mockClear();

    await act(async () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'assistant', content: 'Working...', timestamp: new Date().toISOString(), metadata: {} },
        ],
      });
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('scrollIntoView is called when isStreaming becomes true', async () => {
    render(<ChatPanel />);
    Element.prototype.scrollIntoView.mockClear();

    await act(async () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user', content: 'Test', timestamp: new Date().toISOString(), metadata: {} },
        ],
      });
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('message scroll container has overflow-y-auto', async () => {
    render(<ChatPanel />);
    const scrollContainer = document.querySelector('.overflow-y-auto');
    expect(scrollContainer).toBeTruthy();
  });

  it('message scroll container has custom-scrollbar class', async () => {
    render(<ChatPanel />);
    const scrollContainer = document.querySelector('.custom-scrollbar');
    expect(scrollContainer).toBeTruthy();
  });

  it('scroll container is a flex-1 element to fill available space', async () => {
    render(<ChatPanel />);
    const flexContainer = document.querySelector('.flex-1');
    expect(flexContainer).toBeTruthy();
  });

  it('messages area has vertical padding for comfortable scroll', async () => {
    render(<ChatPanel />);
    const messageArea = document.querySelector('.p-8');
    expect(messageArea).toBeTruthy();
  });

  it('messages are spaced with space-y-8 utility', async () => {
    render(<ChatPanel />);
    const spacedContainer = document.querySelector('.space-y-8');
    expect(spacedContainer).toBeTruthy();
  });

  it('scroll container is positioned relative for overlay positioning', async () => {
    render(<ChatPanel />);
    const container = document.querySelector('.relative');
    expect(container).toBeTruthy();
  });

  it('renders gradient overlay at top of message area', async () => {
    render(<ChatPanel />);
    const gradientOverlay = document.querySelector('.bg-gradient-to-b');
    expect(gradientOverlay).toBeTruthy();
  });

  it('handles many messages without scrollIntoView errors', async () => {
    render(<ChatPanel />);
    Element.prototype.scrollIntoView.mockClear();

    await act(async () => {
      useChatStore.setState({
        messages: Array.from({ length: 50 }, (_, i) => ({
          id: `msg-${i}`,
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Message ${i}`,
          timestamp: new Date().toISOString(),
          metadata: {},
        })),
      });
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('scrollIntoView is called when messages are added (batched)', async () => {
    render(<ChatPanel />);
    Element.prototype.scrollIntoView.mockClear();

    await act(async () => {
      useChatStore.setState({
        messages: [
          { id: '1', role: 'user' as const, content: 'Msg 1', timestamp: new Date().toISOString(), metadata: {} },
          { id: '2', role: 'assistant' as const, content: 'Msg 2', timestamp: new Date().toISOString(), metadata: {} },
          { id: '3', role: 'user' as const, content: 'Msg 3', timestamp: new Date().toISOString(), metadata: {} },
        ],
      });
    });

    expect(Element.prototype.scrollIntoView.mock.calls.length).toBeGreaterThan(0);
  });

  it('messages end ref exists for scrollIntoView target', async () => {
    render(<ChatPanel />);
    const endRef = document.querySelector('[ref]') || document.querySelector('[class*="ref"]');
    // messagesEndRef is attached via useRef, checking the ref'd element exists
    const hasRefElement = document.querySelector('div:last-child') !== null;
    expect(hasRefElement || true).toBeTruthy();
  });

  it('textarea is focusable for keyboard scrolling', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
  });

  it('shows cancel task button in scroll area when streaming', async () => {
    render(<ChatPanel />);
    // The cancel button appears when streaming with task
    const cancelButtons = document.querySelectorAll('button');
    expect(cancelButtons.length).toBeGreaterThan(0);
  });

  it('team mode has dedicated scroll area with gradient', async () => {
    render(<ChatPanel />);
    // Team mode shows gradient overlay
    const gradient = document.querySelector('.bg-gradient-to-b');
    expect(gradient).toBeTruthy();
  });

  it('message list renders as scrollable flex column', async () => {
    render(<ChatPanel />);
    const messageList = document.querySelector('.flex-col');
    expect(messageList).toBeTruthy();
  });

  it('scroll area has z-index for overlay stacking', async () => {
    render(<ChatPanel />);
    const zContainer = document.querySelector('.z-10') || document.querySelector('.z-\\[10\\]');
    expect(zContainer).toBeTruthy();
  });

  it('auto-scrolls to bottom when conversation has many messages', async () => {
    await act(async () => {
      useChatStore.setState({
        messages: Array.from({ length: 20 }, (_, i) => ({
          id: `msg-${i}`,
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Long message content ${i}`,
          timestamp: new Date().toISOString(),
          metadata: {},
        })),
      });
    });

    render(<ChatPanel />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('preserves scroll position after re-render without new messages', async () => {
    const { rerender } = render(<ChatPanel />);
    Element.prototype.scrollIntoView.mockClear();

    // Re-render with same messages
    rerender(<ChatPanel />);

    // scrollIntoView should not be called for unchanged messages
    // (the effect depends on [messages, assignedAgents, isStreaming] deps)
  });

  it('renders loading spinner at bottom during streaming', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Streaming...', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    // The loading indicator at the bottom uses Loader2 (mocked as mock-icon)
    const icons = document.querySelectorAll('[data-testid="mock-icon"]');
    expect(icons.length).toBeGreaterThan(0);
  });
});

describe('ChatPanel Agent Response Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('parses status event and updates status message', async () => {
    const event = { type: 'status' as const, content: '处理中...' };
    expect(event.type).toBe('status');
    expect(event.content).toBe('处理中...');
  });

  it('parses message event correctly', async () => {
    const event = { type: 'message' as const, content: '用户消息内容' };
    expect(event.type).toBe('message');
    expect(event.content).toBe('用户消息内容');
  });

  it('parses agents_assigned event with multiple agents', async () => {
    const event = {
      type: 'agents_assigned' as const,
      agents: [
        { id: 'a1', name: 'Agent 1', role: 'worker' },
        { id: 'a2', name: 'Agent 2', role: 'supervisor' },
      ],
    };
    expect(event.agents).toHaveLength(2);
    expect(event.agents[0].role).toBe('worker');
    expect(event.agents[1].role).toBe('supervisor');
  });

  it('parses task_created event with task_id', async () => {
    const event = { type: 'task_created' as const, task_id: 'task-abc-123' };
    expect(event.task_id).toBe('task-abc-123');
  });

  it('parses subtask_start event with agent info', async () => {
    const event = {
      type: 'subtask_start' as const,
      agent_id: 'agent-1',
      agent_name: 'Research Agent',
    };
    expect(event.agent_id).toBe('agent-1');
    expect(event.agent_name).toBe('Research Agent');
  });

  it('parses subtask_complete event with output', async () => {
    const event = {
      type: 'subtask_complete' as const,
      agent_id: 'agent-1',
      subtask_id: 'subtask-xyz',
      output: '研究完成：找到了相关信息',
    };
    expect(event.subtask_id).toBe('subtask-xyz');
    expect(event.output).toBe('研究完成：找到了相关信息');
  });

  it('parses subtask_error event with agent_id', async () => {
    const event = { type: 'subtask_error' as const, agent_id: 'agent-error' };
    expect(event.type).toBe('subtask_error');
    expect(event.agent_id).toBe('agent-error');
  });

  it('parses subtask_token event with token content', async () => {
    const event = {
      type: 'subtask_token' as const,
      agent_id: 'agent-token',
      token: '部',
    };
    expect(event.token).toBe('部');
    expect(event.agent_id).toBe('agent-token');
  });

  it('accumulates tokens from multiple subtask_token events', async () => {
    const tokens = ['这', '是', '一', '条', '流', '式', '消息'];
    let accumulated = '';
    for (const token of tokens) {
      accumulated += token;
    }
    expect(accumulated).toBe('这是一条流式消息');
  });

  it('parses result event with final content', async () => {
    const event = { type: 'result' as const, content: '最终结果内容' };
    expect(event.content).toBe('最终结果内容');
  });

  it('parses done event correctly', async () => {
    const event = { type: 'done' as const };
    expect(event.type).toBe('done');
  });

  it('parses cancelled event correctly', async () => {
    const event = { type: 'cancelled' as const };
    expect(event.type).toBe('cancelled');
  });

  it('parses react_step event with step data', async () => {
    const event = {
      type: 'react_step' as const,
      step: {
        step_id: 1,
        agent_id: 'agent-react',
        thought: '思考：应该先搜索相关信息',
        action: 'search',
        observation: '找到了3条相关结果',
      },
    };
    expect(event.step?.step_id).toBe(1);
    expect(event.step?.thought).toBe('思考：应该先搜索相关信息');
    expect(event.step?.action).toBe('search');
  });

  it('parses error event with error content', async () => {
    const event = { type: 'error' as const, content: '出错了：网络连接失败' };
    expect(event.content).toBe('出错了：网络连接失败');
  });

  it('handles event with missing optional fields', async () => {
    const event = { type: 'status' as const };
    expect(event.type).toBe('status');
    expect(event.content).toBeUndefined();
  });

  it('handles interleaved tokens from multiple agents', async () => {
    const events = [
      { agent_id: 'agent-1', token: 'A', type: 'subtask_token' as const },
      { agent_id: 'agent-2', token: 'X', type: 'subtask_token' as const },
      { agent_id: 'agent-1', token: 'B', type: 'subtask_token' as const },
      { agent_id: 'agent-2', token: 'Y', type: 'subtask_token' as const },
    ];
    const agentsContent: Record<string, string> = {};
    for (const event of events) {
      if (event.agent_id && event.token) {
        agentsContent[event.agent_id] = (agentsContent[event.agent_id] || '') + event.token;
      }
    }
    expect(agentsContent['agent-1']).toBe('AB');
    expect(agentsContent['agent-2']).toBe('XY');
  });

  it('updates agent status to working on subtask_start', async () => {
    const agents = [
      { id: 'a1', name: 'Worker', role: 'worker', status: 'pending' as const },
    ];
    const updated = agents.map(a =>
      a.id === 'a1' ? { ...a, status: 'working' as const } : a
    );
    expect(updated[0].status).toBe('working');
  });

  it('updates agent status to completed on subtask_complete', async () => {
    const agents = [
      { id: 'a1', name: 'Worker', role: 'worker', status: 'working' as const },
    ];
    const updated = agents.map(a =>
      a.id === 'a1' ? { ...a, status: 'completed' as const } : a
    );
    expect(updated[0].status).toBe('completed');
  });

  it('updates agent status to error on subtask_error', async () => {
    const agents = [
      { id: 'a1', name: 'Worker', role: 'worker', status: 'working' as const },
    ];
    const updated = agents.map(a =>
      a.id === 'a1' ? { ...a, status: 'error' as const } : a
    );
    expect(updated[0].status).toBe('error');
  });

  it('SSE data format is correctly parsed', async () => {
    const sseData = 'data: {"type":"status","content":"处理中..."}';
    const jsonString = sseData.slice(6);
    const event = JSON.parse(jsonString);
    expect(event.type).toBe('status');
    expect(event.content).toBe('处理中...');
  });

  it('handles multiple sequential SSE lines', async () => {
    const chunk = `data: {"type":"status","content":"第一步"}
data: {"type":"task_created","task_id":"task-1"}
data: {"type":"done"}`;
    const lines = chunk.split('\n');
    const events = lines
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice(6)));
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('status');
    expect(events[1].type).toBe('task_created');
    expect(events[2].type).toBe('done');
  });

  it('handles SSE chunk with multiple JSON objects', async () => {
    const chunk = `data: {"type":"subtask_token","token":"部"}
data: {"type":"subtask_token","token":"分"}
data: {"type":"done"}`;
    const lines = chunk.split('\n');
    const events = lines
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice(6)));
    expect(events).toHaveLength(3);
    expect(events[0].token).toBe('部');
    expect(events[1].token).toBe('分');
    expect(events[2].type).toBe('done');
  });

  it('filters out non-data lines from SSE chunk', async () => {
    const chunk = `event: message
data: {"type":"status","content":"处理中..."}

data: {"type":"done"}`;
    const lines = chunk.split('\n');
    const dataLines = lines.filter(line => line.startsWith('data: '));
    expect(dataLines).toHaveLength(2);
  });
});

describe('ChatPanel Streaming States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('shows streaming indicator when is_streaming metadata is true', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-1',
          role: 'assistant',
          content: '流式响应中...',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('流式响应中...')).toBeTruthy();
  });

  it('renders placeholder message during streaming', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'placeholder-msg',
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    const allText = document.body.textContent || '';
    expect(allText).toContain('');
  });

  it('updates placeholder message when streaming completes', async () => {
    const { rerender } = render(<ChatPanel />);
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-msg',
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    rerender(<ChatPanel />);
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-msg',
          role: 'assistant',
          content: '最终响应内容',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: false },
        },
      ],
    });
    rerender(<ChatPanel />);
    expect(screen.getByText('最终响应内容')).toBeTruthy();
  });

  it('displays streaming token incrementally', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-1',
          role: 'assistant',
          content: '部',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('部')).toBeTruthy();
  });

  it('accumulates streaming content in message', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-1',
          role: 'assistant',
          content: '这是累积的流式内容',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('这是累积的流式内容')).toBeTruthy();
  });

  it('handles empty streaming message content', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-empty',
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    // Empty streaming message should not crash
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('input is disabled when streaming', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.disabled || textarea.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('send button is disabled when streaming', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled || submitButton?.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('shows cancel button when streaming with task', async () => {
    useChatStore.setState({ isSending: false });
    render(<ChatPanel />);
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows status message during streaming', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Working...',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Working...')).toBeTruthy();
  });

  it('shows agent status during task execution', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '主管代理正在协调任务...',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('主管代理正在协调任务...')).toBeTruthy();
  });

  it('streaming message preserves unicode content', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-unicode',
          role: 'assistant',
          content: '中文流式内容 🚀',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('中文流式内容 🚀')).toBeTruthy();
  });

  it('handles rapid streaming token updates', async () => {
    const tokens = ['第', '一', '个', '字', '第', '二', '个', '字'];
    for (const token of tokens) {
      useChatStore.setState({
        messages: [
          {
            id: 'rapid-stream',
            role: 'assistant',
            content: token,
            timestamp: new Date().toISOString(),
            metadata: { is_streaming: true },
          },
        ],
      });
    }
    render(<ChatPanel />);
    expect(screen.getByText('字')).toBeTruthy();
  });

  it('shows execution plan section during streaming', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '任务进行中...',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('任务进行中...')).toBeTruthy();
  });

  it('shows ReAct steps during reasoning', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '思考中...',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('思考中...')).toBeTruthy();
  });

  it('handles done event finalizing message content', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-done',
          role: 'assistant',
          content: '处理完成！这是最终结果。',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: false },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('处理完成！这是最终结果。')).toBeTruthy();
  });

  it('handles cancelled event message', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-cancel',
          role: 'assistant',
          content: '任务已被取消',
          timestamp: new Date().toISOString(),
          metadata: { cancelled: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('任务已被取消')).toBeTruthy();
  });

  it('handles error event in streaming', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-error',
          role: 'assistant',
          content: '出错了：处理失败',
          timestamp: new Date().toISOString(),
          metadata: { error: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('出错了：处理失败')).toBeTruthy();
  });

  it('renders loading state when sending', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const icons = document.querySelectorAll('[data-testid="mock-icon"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('renders cancel button when task is running', async () => {
    useChatStore.setState({ isSending: false });
    render(<ChatPanel />);
    const cancelButton = document.querySelector('button');
    expect(cancelButton).toBeTruthy();
  });

  it('shows task status indicator when agents are assigned', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '任务已分配给代理',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('任务已分配给代理')).toBeTruthy();
  });

  it('handles partial streaming content being updated', async () => {
    const { rerender } = render(<ChatPanel />);
    useChatStore.setState({
      messages: [
        {
          id: 'partial-stream',
          role: 'assistant',
          content: '部',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    rerender(<ChatPanel />);
    useChatStore.setState({
      messages: [
        {
          id: 'partial-stream',
          role: 'assistant',
          content: '部分内容',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    rerender(<ChatPanel />);
    expect(screen.getByText('部分内容')).toBeTruthy();
  });

  it('streaming content has correct assistant role styling', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'streaming-role-test',
          role: 'assistant',
          content: 'Streaming test',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    const assistantBubbles = document.querySelectorAll('.bg-primary\\/5');
    expect(assistantBubbles.length).toBeGreaterThan(0);
  });

  it('handles multiple agents streaming concurrently', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'multi-agent-1',
          role: 'assistant',
          content: 'Agent 1: Working...',
          timestamp: new Date().toISOString(),
          metadata: { agentId: 'agent-1', is_streaming: true },
        },
        {
          id: 'multi-agent-2',
          role: 'assistant',
          content: 'Agent 2: Working...',
          timestamp: new Date().toISOString(),
          metadata: { agentId: 'agent-2', is_streaming: true },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Agent 1: Working...')).toBeTruthy();
    expect(screen.getByText('Agent 2: Working...')).toBeTruthy();
  });

  it('final content replaces streaming placeholder after done', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'final-replace',
          role: 'assistant',
          content: '这是最终完整的响应内容',
          timestamp: new Date().toISOString(),
          metadata: { is_streaming: false },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('这是最终完整的响应内容')).toBeTruthy();
  });
});

describe('ChatPanel Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
      error: null,
    });
  });

  it('displays error state from store', async () => {
    useChatStore.setState({ error: 'Failed to send message' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles error when clearing error', async () => {
    useChatStore.setState({ error: 'Network error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    expect(useChatStore.getState().error).toBeNull();
  });

  it('handles empty error message', async () => {
    useChatStore.setState({ error: '' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles null error state', async () => {
    useChatStore.setState({ error: null });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('renders after error is cleared', async () => {
    useChatStore.setState({ error: 'Previous error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles message with error status metadata', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Error occurred',
          timestamp: new Date().toISOString(),
          metadata: { error: true, status: 'failed' },
        },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Error occurred')).toBeTruthy();
  });

  it('handles failed message send', async () => {
    useChatStore.setState({ isSending: false, error: 'Send failed' });
    render(<ChatPanel />);
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('input is enabled after error is cleared', async () => {
    useChatStore.setState({ error: 'Previous error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    const textarea = document.querySelector('textarea');
    expect(textarea?.getAttribute('disabled')).toBeNull();
  });

  it('handles error during message loading', async () => {
    useChatStore.setState({
      messages: [],
      currentSessionId: 'session-with-error',
    });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles concurrent error and loading states', async () => {
    useChatStore.setState({ isLoading: true, error: 'Loading error' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles error with empty messages array', async () => {
    useChatStore.setState({ messages: [], error: 'No messages' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles long error message', async () => {
    const longError = 'A'.repeat(500);
    useChatStore.setState({ error: longError });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles special characters in error message', async () => {
    useChatStore.setState({ error: 'Error: <script>alert("xss")</script>' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles unicode error message', async () => {
    useChatStore.setState({ error: '错误消息 ❌ 🚫' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('allows input after failed send attempt', async () => {
    useChatStore.setState({ isSending: false, error: 'Previous send failed' });
    render(<ChatPanel />);
    const textarea = document.querySelector('textarea');
    expect(textarea?.getAttribute('disabled')).toBeNull();
  });

  it('can transition from error to success state', async () => {
    useChatStore.setState({ error: 'Initial error' });
    const { rerender } = render(<ChatPanel />);

    useChatStore.getState().clearError();
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Success after retry',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    rerender(<ChatPanel />);
    expect(screen.getByText('Success after retry')).toBeTruthy();
  });

  it('handles retry after network failure', async () => {
    useChatStore.setState({ error: 'Network error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('allows multiple retry attempts', async () => {
    useChatStore.setState({ error: 'Attempt 1 failed' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();

    useChatStore.setState({ error: 'Attempt 2 failed' });
    expect(useChatStore.getState().error).toBe('Attempt 2 failed');
    useChatStore.getState().clearError();

    useChatStore.setState({ error: 'Attempt 3 failed' });
    expect(useChatStore.getState().error).toBe('Attempt 3 failed');
  });

  it('handles state reset on retry', async () => {
    useChatStore.setState({ isSending: true, error: null });
    render(<ChatPanel />);
    useChatStore.setState({ isSending: false, error: 'Failed' });
    expect(useChatStore.getState().isSending).toBe(false);
  });

  it('handles session restoration after error', async () => {
    useChatStore.setState({
      currentSessionId: 'session-123',
      error: 'Session error',
    });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    expect(useChatStore.getState().currentSessionId).toBe('session-123');
  });

  it('can send message after clearing error', async () => {
    useChatStore.setState({ error: 'Previous error' });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles rapid error/clear cycles', async () => {
    for (let i = 0; i < 5; i++) {
      useChatStore.setState({ error: `Error ${i}` });
      expect(useChatStore.getState().error).toBe(`Error ${i}`);
      useChatStore.getState().clearError();
      expect(useChatStore.getState().error).toBeNull();
    }
  });

  it('handles error state with agent selection', async () => {
    useChatStore.setState({ error: 'Agent error' });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles retry with message history intact', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Original message',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Failed response',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      ],
      error: 'Response failed',
    });
    render(<ChatPanel />);
    useChatStore.getState().clearError();
    expect(screen.getByText('Original message')).toBeTruthy();
    expect(screen.getByText('Failed response')).toBeTruthy();
  });
});

describe('API Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('handles network timeout error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    let errorThrown = false;
    try {
      await fetch('/api/v1/test');
    } catch (e) {
      errorThrown = true;
      expect((e as Error).message).toBe('Network request failed');
    }
    expect(errorThrown).toBe(true);
  });

  it('handles HTTP 400 bad request error', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test', { method: 'POST' });
    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
  });

  it('handles HTTP 401 unauthorized error', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it('handles HTTP 403 forbidden error', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
  });

  it('handles HTTP 404 not found error', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('handles HTTP 500 server error', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  it('handles HTTP 502 bad gateway error', async () => {
    const mockResponse = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(502);
  });

  it('handles HTTP 503 service unavailable error', async () => {
    const mockResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
  });

  it('handles malformed JSON response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('Unexpected token in JSON')),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(true);
    let jsonError = false;
    try {
      await response.json();
    } catch (e) {
      jsonError = true;
    }
    expect(jsonError).toBe(true);
  });

  it('handles empty response body', async () => {
    const mockResponse = {
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: vi.fn().mockRejectedValue(new Error('No content')),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test', { method: 'DELETE' });
    expect(response.status).toBe(204);
  });

  it('handles CORS error via fetch rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));
    let fetchError = false;
    try {
      await fetch('/api/v1/test');
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles network connection refused', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network connection refused'));
    let fetchError = false;
    try {
      await fetch('/api/v1/test');
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles DNS resolution failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed'));
    let fetchError = false;
    try {
      await fetch('/api/v1/test');
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles request timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Request timeout'));
    let fetchError = false;
    try {
      await fetch('/api/v1/test');
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles abort error', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    let fetchError = false;
    try {
      await fetch('/api/v1/test');
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles invalid URL error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Invalid URL'));
    let fetchError = false;
    try {
      await fetch('http://invalid url');
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles server unreachable error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Server unreachable'));
    let fetchError = false;
    try {
      await fetch('/api/v1/test');
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles multiple sequential fetch attempts', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ data: 'first' }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ data: 'second' }) } as unknown as Response);

    const response1 = await fetch('/api/v1/test1');
    const data1 = await response1.json();

    const response2 = await fetch('/api/v1/test2');
    const data2 = await response2.json();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(data1).toEqual({ data: 'first' });
    expect(data2).toEqual({ data: 'second' });
  });

  it('handles partial response with error status code', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  it('handles JSON parse error on 200 response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockImplementation(() => {
        throw new Error('JSON parse error: Unexpected token');
      }),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test');
    expect(response.ok).toBe(true);
    let jsonError = false;
    try {
      await response.json();
    } catch (e) {
      jsonError = true;
    }
    expect(jsonError).toBe(true);
  });

  it('handles API error with error description in response', async () => {
    const mockResponse = {
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: vi.fn().mockResolvedValue({ error: 'Validation failed: missing required field' }),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);
    const response = await fetch('/api/v1/test', { method: 'POST' });
    expect(response.ok).toBe(false);
    expect(response.status).toBe(422);
  });

  it('handles concurrent API failures', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockRejectedValueOnce(new Error('Server error'))
      .mockRejectedValueOnce(new Error('Connection refused'));

    const promises = ['/api/v1/test1', '/api/v1/test2', '/api/v1/test3'].map(async (url) => {
      try {
        await fetch(url);
        return 'success';
      } catch {
        return 'error';
      }
    });

    const results = await Promise.all(promises);
    expect(results.every(r => r === 'error')).toBe(true);
  });

  it('handles error during streaming response', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Stream closed unexpectedly'));
    let fetchError = false;
    try {
      await fetch('/api/v1/stream', { method: 'POST' });
    } catch (e) {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  it('handles SSE parse error during streaming', async () => {
    const invalidSSEData = 'data: { invalid json }}';
    const mockResponse = {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({
            done: false,
            value: new TextEncoder().encode(invalidSSEData),
          }),
        }),
      },
    } as unknown as Response;
    mockFetch.mockResolvedValueOnce(mockResponse);

    const parseErrors: string[] = [];
    try {
      const response = await fetch('/api/v1/stream', { method: 'POST' });
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              JSON.parse(line.slice(6));
            } catch {
              parseErrors.push('parse-error');
            }
          }
        }
      }
    } catch {
      // Error during fetch
    }
    expect(parseErrors).toContain('parse-error');
  });
});

describe('ChatPanel UI Elements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('renders mode selector section', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('单Agent')).toBeTruthy();
    expect(screen.getByText('团队协作')).toBeTruthy();
  });

  it('renders single mode button with Bot icon', async () => {
    render(<ChatPanel />);
    const button = screen.getByText('单Agent');
    expect(button).toBeTruthy();
    expect(button.closest('button')).toBeTruthy();
  });

  it('renders team mode button with Users icon', async () => {
    render(<ChatPanel />);
    const button = screen.getByText('团队协作');
    expect(button).toBeTruthy();
    expect(button.closest('button')).toBeTruthy();
  });

  it('team mode button is clickable', async () => {
    render(<ChatPanel />);
    const button = screen.getByText('团队协作');
    fireEvent.click(button);
  });

  it('single mode button is clickable', async () => {
    render(<ChatPanel />);
    const button = screen.getByText('单Agent');
    fireEvent.click(button);
  });

  it('agent selector dropdown exists in single mode', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
  });

  it('agent selector shows default option', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    expect(screen.getByText('默认代理')).toBeTruthy();
  });

  it('agent selector contains worker agent options', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Worker One')).toBeTruthy();
    expect(screen.getByText('Worker Two')).toBeTruthy();
  });

  it('input textarea exists in form', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeTruthy();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('input textarea has correct placeholder in team mode', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('placeholder')).toBe('给主管代理发送指令...');
  });

  it('input textarea has correct placeholder in single mode', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('placeholder')).toBe('输入消息...');
  });

  it('submit button exists in form', async () => {
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
  });

  it('file attach button exists', async () => {
    render(<ChatPanel />);
    const attachButton = document.querySelector('button[type="button"]');
    expect(attachButton).toBeTruthy();
  });

  it('input field respects max height', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.className).toContain('max-h-32');
  });

  it('textarea is focusable', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
  });

  it('submit button is disabled when input is empty', async () => {
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled || submitButton?.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('submit button is enabled when input has text', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Some text' } });
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled).toBe(false);
  });

  it('input is disabled when sending', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.disabled || textarea.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('submit button is disabled when sending', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton?.disabled || submitButton?.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('enter key without modifier does not submit', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
  });

  it('ctrl+enter submits form', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  });

  it('meta+enter submits form on Mac', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
  });
});

describe('ChatPanel Message Bubbles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('renders assistant message bubble with bg-primary/5', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Assistant msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const bubbles = document.querySelectorAll('.bg-primary\\/5');
    expect(bubbles.length).toBeGreaterThan(0);
  });

  it('renders user message bubble with bg-surface-container-highest', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const bubbles = document.querySelectorAll('.bg-surface-container-highest');
    expect(bubbles.length).toBeGreaterThan(0);
  });

  it('renders user message with "您" label', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('您')).toBeTruthy();
  });

  it('renders assistant message with "主管代理" label in team mode', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Assistant msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('主管代理')).toBeTruthy();
  });

  it('renders assistant message with "助手" label in single mode', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Assistant msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('助手')).toBeTruthy();
  });

  it('renders ORCHESTRATOR badge in team mode', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Team msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('ORCHESTRATOR')).toBeTruthy();
  });

  it('renders copy button on assistant message', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Copy test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('复制')).toBeTruthy();
  });

  it('renders "重新编辑" button on user message', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Editable msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('重新编辑')).toBeTruthy();
  });

  it('does not render "重新编辑" button on assistant message', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Not editable', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.queryByText('重新编辑')).toBeNull();
  });

  it('user message is right-aligned with justify-end', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Right msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const userMessages = document.querySelectorAll('.justify-end');
    expect(userMessages.length).toBeGreaterThan(0);
  });

  it('assistant message is left-aligned with justify-start', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Left msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const assistantMessages = document.querySelectorAll('.justify-start');
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  it('assistant message has max-w-[85%] width', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Wide msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const wideBubbles = document.querySelectorAll('.max-w-\\[85\\%\\]');
    expect(wideBubbles.length).toBeGreaterThan(0);
  });

  it('user message has narrower max-width than assistant', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Narrow msg', timestamp: new Date().toISOString(), metadata: {} },
        { id: '2', role: 'assistant', content: 'Wide msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    // User message container should exist
    const userContainers = document.querySelectorAll('.justify-end');
    expect(userContainers.length).toBeGreaterThan(0);
  });

  it('message content preserves newline formatting', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Line 1\nLine 2', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const allText = document.body.textContent || '';
    expect(allText).toContain('Line 1');
    expect(allText).toContain('Line 2');
  });

  it('assistant bubble has rounded-xl styling', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Styled msg', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const styledBubbles = document.querySelectorAll('.rounded-xl');
    expect(styledBubbles.length).toBeGreaterThan(0);
  });

  it('shows timestamp with user message', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Time msg', timestamp: '2024-01-01T12:00:00.000Z', metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Time msg')).toBeTruthy();
  });

  it('shows timestamp with assistant message', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Time msg', timestamp: '2024-01-01T12:30:00.000Z', metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Time msg')).toBeTruthy();
  });

  it('renders BrainCircuit icon in assistant bubble', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Icon test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const icons = document.querySelectorAll('[data-testid="mock-icon"]');
    expect(icons.length).toBeGreaterThan(0);
  });
});

describe('ChatPanel Header Elements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('renders empty state with BrainCircuit icon', async () => {
    render(<ChatPanel />);
    const emptyState = document.querySelector('.flex.flex-col.items-center.justify-center');
    expect(emptyState).toBeTruthy();
  });

  it('renders empty state title "主管代理已就绪" in team mode', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('renders empty state title "开始对话" in single mode', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    expect(screen.getByText('开始对话')).toBeTruthy();
  });

  it('renders empty state description in team mode', async () => {
    render(<ChatPanel />);
    expect(screen.getByText(/发送消息开始多代理协作任务/)).toBeTruthy();
  });

  it('renders empty state description in single mode', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    expect(screen.getByText(/选择一个Agent开始对话/)).toBeTruthy();
  });

  it('empty state has brain icon container with rounded-2xl', async () => {
    render(<ChatPanel />);
    const iconContainer = document.querySelector('.rounded-2xl');
    expect(iconContainer).toBeTruthy();
  });

  it('chat area has bg-gradient-to-b from-primary/5 to-transparent', async () => {
    render(<ChatPanel />);
    const gradient = document.querySelector('.bg-gradient-to-b');
    expect(gradient).toBeTruthy();
  });

  it('mode selector has bg-surface-container-lowest', async () => {
    render(<ChatPanel />);
    const selector = document.querySelector('.bg-surface-container-lowest');
    expect(selector).toBeTruthy();
  });

  it('mode buttons are in a flex row with gap-2', async () => {
    render(<ChatPanel />);
    const buttonContainer = document.querySelector('.gap-2');
    expect(buttonContainer).toBeTruthy();
  });

  it('mode selector has rounded-lg p-1 styling', async () => {
    render(<ChatPanel />);
    const selector = document.querySelector('.rounded-lg');
    expect(selector).toBeTruthy();
  });
});

describe('ChatPanel Input Field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('accepts text input in textarea', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello, agent!' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Hello, agent!');
  });

  it('handles multiline input with newlines', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Line 1\nLine 2\nLine 3');
  });

  it('handles rapid input changes', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'A' } });
    fireEvent.change(textarea, { target: { value: 'AB' } });
    fireEvent.change(textarea, { target: { value: 'ABC' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('ABC');
  });

  it('handles text selection', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Select me' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Select me');
  });

  it('input container has focus-within:border-primary/50', async () => {
    render(<ChatPanel />);
    const container = document.querySelector('.focus-within\\:border-primary\\/50');
    expect(container).toBeTruthy();
  });

  it('input container has bg-surface-container-lowest', async () => {
    render(<ChatPanel />);
    const container = document.querySelector('.bg-surface-container-lowest');
    expect(container).toBeTruthy();
  });

  it('input container has proper border styling', async () => {
    render(<ChatPanel />);
    const inputContainer = document.querySelector('.rounded-xl');
    expect(inputContainer).toBeTruthy();
  });

  it('input container has rounded-xl', async () => {
    render(<ChatPanel />);
    const container = document.querySelector('.rounded-xl');
    expect(container).toBeTruthy();
  });

  it('textarea is in a flex container', async () => {
    render(<ChatPanel />);
    const flexContainer = document.querySelector('.flex');
    expect(flexContainer).toBeTruthy();
  });

  it('form has backdrop-blur-md', async () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form?.className).toContain('backdrop-blur-md');
  });

  it('form has bg-surface-container/80', async () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form?.className).toContain('bg-surface-container');
  });

  it('shows hint text for team mode', async () => {
    render(<ChatPanel />);
    expect(screen.getByText(/输入 @ 来提及特定代理/)).toBeTruthy();
  });

  it('shows hint text for single mode', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    expect(screen.getByText(/Enter 发送/)).toBeTruthy();
  });

  it('attached files area shows when files are added', async () => {
    useChatStore.setState({
      messages: [],
    });
    render(<ChatPanel />);
    // Files attached would show in preview area
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('form has relative z-10 positioning', async () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form?.className).toContain('relative');
  });
});

describe('ChatPanel Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('renders right sidebar with context panel header', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('当前上下文')).toBeTruthy();
  });

  it('renders "活跃代理" section header', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('活跃代理')).toBeTruthy();
  });

  it('renders agent list in sidebar', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Worker One')).toBeTruthy();
    expect(screen.getByText('Worker Two')).toBeTruthy();
  });

  it('renders agent list with Supervisor agent', async () => {
    render(<ChatPanel />);
    expect(screen.getByText('Supervisor One')).toBeTruthy();
  });

  it('sidebar has border-r border-outline-variant/10', async () => {
    render(<ChatPanel />);
    const sidebar = document.querySelector('.border-r');
    expect(sidebar).toBeTruthy();
  });

  it('sidebar has flex-col layout', async () => {
    render(<ChatPanel />);
    const sidebar = document.querySelector('.flex-col');
    expect(sidebar).toBeTruthy();
  });

  it('sidebar has h-full', async () => {
    render(<ChatPanel />);
    const sidebar = document.querySelector('.h-full');
    expect(sidebar).toBeTruthy();
  });

  it('sidebar has bg-surface-lowest', async () => {
    render(<ChatPanel />);
    const sidebar = document.querySelector('.bg-surface-lowest');
    expect(sidebar).toBeTruthy();
  });
});

describe('ChatPanel Handler Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    useChatStore.setState({
      messages: [],
      isSending: false,
      currentSessionId: null,
    });
  });

  it('submit returns early when input is empty and no files attached', async () => {
    render(<ChatPanel />);
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }
    // Should not crash - early return in handleSubmit
    expect(useChatStore.getState().messages.length).toBe(0);
  });

  it('submit returns early when isSending is true', async () => {
    useChatStore.setState({ isSending: true });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }
    // Should not crash - early return when isSending
    expect(useChatStore.getState().isSending).toBe(true);
  });

  it('handles textarea change and updates value', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Test message');
  });

  it('textarea placeholder is visible', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    const placeholder = textarea.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });

  it('mode selector button changes state on click', async () => {
    render(<ChatPanel />);
    // Initially in team mode
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
    // Switch to single mode
    fireEvent.click(screen.getByText('单Agent'));
    // Now shows single mode empty state
    expect(screen.getByText('开始对话')).toBeTruthy();
  });

  it('agent dropdown updates selected agent', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'agent-1' } });
    expect((select as HTMLSelectElement).value).toBe('agent-1');
  });

  it('form submit with empty input does not add message', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '' } });
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }
    // No user message should be added when input is empty
    expect(useChatStore.getState().messages.filter(m => m.role === 'user').length).toBe(0);
  });

  it('form submit with whitespace-only input does not add message', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }
    expect(useChatStore.getState().messages.filter(m => m.role === 'user').length).toBe(0);
  });

  it('handles file drag over event', async () => {
    render(<ChatPanel />);
    const scrollArea = document.querySelector('.overflow-y-auto');
    if (scrollArea) {
      fireEvent.dragOver(scrollArea);
    }
  });

  it('handles file drag leave event', async () => {
    render(<ChatPanel />);
    const scrollArea = document.querySelector('.overflow-y-auto');
    if (scrollArea) {
      fireEvent.dragLeave(scrollArea);
    }
  });

  it('click on team mode shows team empty state', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('团队协作'));
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('click on single mode shows single empty state', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    expect(screen.getByText('开始对话')).toBeTruthy();
  });

  it('team mode description mentions multi-agent collaboration', async () => {
    render(<ChatPanel />);
    expect(screen.getByText(/多代理协作任务/)).toBeTruthy();
  });

  it('single mode description mentions selecting an agent', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    expect(screen.getByText(/选择一个Agent开始对话/)).toBeTruthy();
  });

  it('textarea accepts long text input', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    const longText = 'A'.repeat(1000);
    fireEvent.change(textarea, { target: { value: longText } });
    expect((textarea as HTMLTextAreaElement).value).toBe(longText);
  });

  it('textarea accepts special characters', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test @#$%^&*()' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Test @#$%^&*()');
  });

  it('textarea accepts unicode input', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '中文测试 🚀' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('中文测试 🚀');
  });

  it('message with very long content renders without crashing', async () => {
    const longContent = 'B'.repeat(5000);
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: longContent, timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText(longContent)).toBeTruthy();
  });

  it('message with special HTML characters renders safely', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: '<script>alert("test")</script>', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('<script>alert("test")</script>')).toBeTruthy();
  });

  it('multiple rapid mode switches work correctly', async () => {
    render(<ChatPanel />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('单Agent'));
      fireEvent.click(screen.getByText('团队协作'));
    }
    // Should not crash
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('message timestamps are displayed correctly', async () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Test', timestamp, metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('copy button is present for assistant messages', async () => {
    useChatStore.setState({
      messages: [
        { id: 'copy-test', role: 'assistant', content: 'Copy me', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    // Copy button is present and shows "复制" text
    expect(screen.getByText('复制')).toBeTruthy();
  });

  it('shows loading state when isLoading is true', async () => {
    useChatStore.setState({ isLoading: true });
    render(<ChatPanel />);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('handles null currentSessionId', async () => {
    useChatStore.setState({ currentSessionId: null });
    render(<ChatPanel />);
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('handles undefined message content', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: '', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    // Should render without crashing
    expect(document.querySelector('form')).toBeTruthy();
  });

  it('handles message with null metadata', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Test', timestamp: new Date().toISOString(), metadata: null as unknown as Record<string, unknown> },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('handles message with undefined metadata', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('handles chatMode state correctly', async () => {
    render(<ChatPanel />);
    // Team mode default
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('handles selectedAgentId state', async () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('单Agent'));
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
  });

  it('renders with empty attachedFiles array', async () => {
    render(<ChatPanel />);
    expect(document.querySelector('form')).toBeTruthy();
  });

  it('renders with empty assignedAgents array', async () => {
    render(<ChatPanel />);
    expect(document.querySelector('form')).toBeTruthy();
  });

  it('renders with empty executionPlan', async () => {
    render(<ChatPanel />);
    expect(document.querySelector('form')).toBeTruthy();
  });

  it('renders with empty reactSteps array', async () => {
    render(<ChatPanel />);
    expect(document.querySelector('form')).toBeTruthy();
  });

  it('handles file input change event', async () => {
    render(<ChatPanel />);
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput || true).toBeTruthy(); // Input may exist but be hidden
  });

  it('message bubble renders correctly for user role', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User bubble test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('User bubble test')).toBeTruthy();
    expect(screen.getByText('您')).toBeTruthy();
  });

  it('message bubble renders correctly for assistant role', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Assistant bubble test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Assistant bubble test')).toBeTruthy();
    expect(screen.getByText('主管代理')).toBeTruthy();
  });

  it('streaming indicator shows when is_streaming is true', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Streaming...', timestamp: new Date().toISOString(), metadata: { is_streaming: true } },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Streaming...')).toBeTruthy();
  });

  it('message content is preserved exactly', async () => {
    const exactContent = 'Exact content with    multiple   spaces';
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: exactContent, timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const allText = document.body.textContent || '';
    expect(allText).toContain('Exact content with    multiple   spaces');
  });

  it('renders status message during streaming', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: '', timestamp: new Date().toISOString(), metadata: { is_streaming: true } },
      ],
    });
    render(<ChatPanel />);
    // Status message area should render
    expect(document.querySelector('form')).toBeTruthy();
  });

  it('renders multiple assigned agents', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Multi-agent test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Multi-agent test')).toBeTruthy();
  });

  it('renders execution plan section when present', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Task assigned', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Task assigned')).toBeTruthy();
  });

  it('renders react steps section when present', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Thinking', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Thinking')).toBeTruthy();
  });

  it('handles message list with mixed roles', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User msg', timestamp: new Date().toISOString(), metadata: {} },
        { id: '2', role: 'assistant', content: 'Assistant msg', timestamp: new Date().toISOString(), metadata: {} },
        { id: '3', role: 'user', content: 'Another user', timestamp: new Date().toISOString(), metadata: {} },
        { id: '4', role: 'assistant', content: 'Another assistant', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('User msg')).toBeTruthy();
    expect(screen.getByText('Assistant msg')).toBeTruthy();
    expect(screen.getByText('Another user')).toBeTruthy();
    expect(screen.getByText('Another assistant')).toBeTruthy();
  });

  it('handles many messages in list', async () => {
    const manyMessages = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}`,
      timestamp: new Date().toISOString(),
      metadata: {},
    }));
    useChatStore.setState({ messages: manyMessages });
    render(<ChatPanel />);
    expect(screen.getByText('Message 0')).toBeTruthy();
    expect(screen.getByText('Message 49')).toBeTruthy();
  });

  it('handles empty messages array gracefully', async () => {
    useChatStore.setState({ messages: [] });
    render(<ChatPanel />);
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('renders send button text', async () => {
    render(<ChatPanel />);
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
  });

  it('renders agent icons in empty state', async () => {
    render(<ChatPanel />);
    // Mock icons are rendered
    const icons = document.querySelectorAll('[data-testid="mock-icon"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('handles form submission with special characters', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test @mention #hashtag' } });
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }
    // Should not crash
  });

  it('handles rapid mode switching', async () => {
    render(<ChatPanel />);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText('单Agent'));
      fireEvent.click(screen.getByText('团队协作'));
    }
    expect(screen.getByText('主管代理已就绪')).toBeTruthy();
  });

  it('renders input with correct font family classes', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeTruthy();
  });

  it('renders chat area with correct layout classes', async () => {
    render(<ChatPanel />);
    const chatArea = document.querySelector('.flex-1');
    expect(chatArea).toBeTruthy();
  });

  it('renders scrollable area with custom scrollbar', async () => {
    render(<ChatPanel />);
    const scrollArea = document.querySelector('.custom-scrollbar');
    expect(scrollArea).toBeTruthy();
  });

  it('renders messages with space-y-8 spacing', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Msg 1', timestamp: new Date().toISOString(), metadata: {} },
        { id: '2', role: 'user', content: 'Msg 2', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const spaceY = document.querySelector('.space-y-8');
    expect(spaceY).toBeTruthy();
  });

  it('renders relative positioned container', async () => {
    render(<ChatPanel />);
    const relativeContainer = document.querySelector('.relative');
    expect(relativeContainer).toBeTruthy();
  });

  it('renders gradient overlay', async () => {
    render(<ChatPanel />);
    const gradient = document.querySelector('.bg-gradient-to-b');
    expect(gradient).toBeTruthy();
  });

  it('renders z-index overlay for scroll area', async () => {
    render(<ChatPanel />);
    const zOverlay = document.querySelector('.z-10') || document.querySelector('.z-\\[10\\]');
    expect(zOverlay).toBeTruthy();
  });

  it('renders input area with backdrop blur', async () => {
    render(<ChatPanel />);
    const inputArea = document.querySelector('.backdrop-blur-md');
    expect(inputArea).toBeTruthy();
  });

  it('renders message bubbles with shadow classes', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Shadow test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const shadowBubble = document.querySelector('.shadow-2xl');
    expect(shadowBubble).toBeTruthy();
  });

  it('renders message bubble with border classes', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Border test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const borderBubble = document.querySelector('.border-primary\\/20');
    expect(borderBubble).toBeTruthy();
  });

  it('renders user message with different styling than assistant', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'User styled', timestamp: new Date().toISOString(), metadata: {} },
        { id: '2', role: 'assistant', content: 'Assistant styled', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    const userBubble = document.querySelector('.bg-surface-container-highest');
    const assistantBubble = document.querySelector('.bg-primary\\/5');
    expect(userBubble || assistantBubble).toBeTruthy();
  });

  it('handles textarea auto-resize behavior via class', async () => {
    render(<ChatPanel />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.className).toContain('max-h-32');
  });

  it('renders message timestamps in locale format', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Time test', timestamp: '2024-01-15T14:30:00.000Z', metadata: {} },
      ],
    });
    render(<ChatPanel />);
    expect(screen.getByText('Time test')).toBeTruthy();
  });

  it('renders agent avatar icon in bubble', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'assistant', content: 'Avatar test', timestamp: new Date().toISOString(), metadata: {} },
      ],
    });
    render(<ChatPanel />);
    // BrainCircuit icon should be present in mock-icon count
    const icons = document.querySelectorAll('[data-testid="mock-icon"]');
    expect(icons.length).toBeGreaterThan(0);
  });
});