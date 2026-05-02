/**
 * Zustand store for thread/streaming state management
 *
 * Manages the graph execution state for team chat streaming.
 * Replaces component-local useState for streaming-related state.
 */
import { create } from 'zustand';

export interface AssignedAgent {
  id: string;
  name: string;
  role: string;
  status: 'pending' | 'working' | 'completed' | 'error';
  streamingContent?: string;
}

export interface GraphEvent {
  type: string;
  content?: string;
  agent_id?: string;
  agent_name?: string;
  agents?: Array<{ id: string; name: string; role: string }>;
  task_id?: string;
  subtask_id?: string;
  token?: string;
  output?: string;
  step?: unknown;
  state_delta?: Record<string, unknown>;
  thread_id?: string;
}

interface ThreadState {
  // Thread identification
  threadId: string | null;
  currentTaskId: string | null;

  // Streaming state
  isStreaming: boolean;
  streamingMessageId: string | null;
  setStreamingMessageId: (messageId: string | null) => void;

  // Agent states during execution
  assignedAgents: AssignedAgent[];

  // Execution metadata
  statusMessage: string;
  executionPlan: unknown | null;
  reactSteps: unknown[];

  // Interrupt state
  isInterrupted: boolean;
  interruptThreadId: string | null;
  interruptMessage: string;

  // Final output from streaming (read by ChatPanel after 'done')
  doneOutput: string | null;
  accumulatedContent: string;

  // Accumulate streaming tokens (for responseText fallback when no doneOutput)
  appendToken: (token: string) => void;

  // Actions
  startThread: (threadId: string) => void;
  endThread: () => void;
  setTaskId: (taskId: string | null) => void;

  // Streaming control
  startStreaming: (messageId: string) => void;
  stopStreaming: () => void;

  // Agent management
  setAssignedAgents: (agents: AssignedAgent[]) => void;
  updateAgent: (agentId: string, updates: Partial<AssignedAgent>) => void;
  clearAgents: () => void;

  // Status and metadata
  setStatusMessage: (message: string) => void;
  setExecutionPlan: (plan: unknown | null) => void;
  addReactStep: (step: unknown) => void;
  clearReactSteps: () => void;

  // Apply GraphEvent to update state
  applyEvent: (event: GraphEvent) => void;

  // Interrupt management
  setInterrupted: (threadId: string, message: string) => void;
  setInterruptMessage: (message: string) => void;
  clearInterrupt: () => void;

  // Final output tracking (for 'done' event to consume)
  setDoneOutput: (output: string | null) => void;

  // Reset all state
  reset: () => void;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  threadId: null,
  currentTaskId: null,
  isStreaming: false,
  streamingMessageId: null,
  assignedAgents: [],
  statusMessage: '',
  executionPlan: null,
  reactSteps: [],
  isInterrupted: false,
  interruptThreadId: null,
  interruptMessage: '',
  doneOutput: null,
  accumulatedContent: '',

  startThread: (threadId: string) => {
    set({
      threadId,
      isStreaming: true,
      assignedAgents: [],
      statusMessage: '',
      executionPlan: null,
      reactSteps: [],
    });
  },

  endThread: () => {
    set({ isStreaming: false });
  },

  setTaskId: (taskId: string | null) => {
    set({ currentTaskId: taskId });
  },

  startStreaming: (messageId: string) => {
    set({ isStreaming: true, streamingMessageId: messageId });
  },

  stopStreaming: () => {
    set({ isStreaming: false, streamingMessageId: null });
  },

  setStreamingMessageId: (messageId: string | null) => {
    set({ streamingMessageId: messageId });
  },

  setAssignedAgents: (agents: AssignedAgent[]) => {
    set({ assignedAgents: agents });
  },

  updateAgent: (agentId: string, updates: Partial<AssignedAgent>) => {
    set((state) => ({
      assignedAgents: state.assignedAgents.map((a) =>
        a.id === agentId ? { ...a, ...updates } : a
      ),
    }));
  },

  clearAgents: () => {
    set({ assignedAgents: [] });
  },

  setStatusMessage: (message: string) => {
    set({ statusMessage: message });
  },

  setExecutionPlan: (plan: unknown | null) => {
    set({ executionPlan: plan });
  },

  addReactStep: (step: unknown) => {
    set((state) => ({
      reactSteps: [...state.reactSteps, step],
    }));
  },

  clearReactSteps: () => {
    set({ reactSteps: [] });
  },

  setInterrupted: (threadId: string, message: string) => {
    set({ isInterrupted: true, interruptThreadId: threadId, interruptMessage: message });
  },

  setInterruptMessage: (message: string) => {
    set({ interruptMessage: message });
  },

  clearInterrupt: () => {
    set({ isInterrupted: false, interruptThreadId: null, interruptMessage: '' });
  },

  setDoneOutput: (output: string | null) => {
    set({ doneOutput: output });
  },

  appendToken: (token: string) => {
    set((prev) => ({ accumulatedContent: prev.accumulatedContent + token }));
  },

  applyEvent: (event: GraphEvent) => {
    const state = get();

    switch (event.type) {
      case 'agents_assigned':
        if (event.agents) {
          const agents = event.agents.map((a: { id: string; name: string; role: string }) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            status: 'pending' as const,
            streamingContent: '',
          }));
          set({ assignedAgents: agents });
        }
        break;

      case 'task_created':
        if (event.task_id) {
          set({ currentTaskId: event.task_id });
        }
        set({ executionPlan: { steps: [] } });
        break;

      case 'subtask_start':
        if (event.agent_id) {
          get().updateAgent(event.agent_id, { status: 'working' });
        }
        if (event.agent_name) {
          set({ statusMessage: `${event.agent_name} 正在工作...` });
        }
        break;

      case 'subtask_token':
        if (event.agent_id && event.token) {
          get().updateAgent(event.agent_id, {
            streamingContent: (state.assignedAgents.find(a => a.id === event.agent_id)?.streamingContent || '') + event.token,
          });
          get().appendToken(event.token);
        }
        break;

      case 'subtask_complete':
        if (event.agent_id) {
          get().updateAgent(event.agent_id, { status: 'completed' });
        }
        if (event.subtask_id && event.output) {
          set((prev) => {
            const plan = prev.executionPlan as { steps: unknown[] } | null;
            if (!plan) return prev;
            return {
              ...prev,
              executionPlan: {
                ...plan,
                steps: [
                  ...plan.steps,
                  { agent: event.subtask_id, task: event.output, status: 'completed' },
                ],
              },
            };
          });
        }
        break;

      case 'subtask_error':
        if (event.agent_id) {
          get().updateAgent(event.agent_id, { status: 'error' });
        }
        break;

      case 'state_update':
      case 'status':
        if (event.content) {
          set({ statusMessage: event.content });
        }
        if (event.state_delta) {
          // Apply state delta if needed
        }
        break;

      case 'react_step':
        if (event.step) {
          get().addReactStep({
            step_id: (event.step as { step_id: number }).step_id,
            agent_id: (event.step as { agent_id: string }).agent_id,
            thought: (event.step as { thought: string }).thought,
            action: (event.step as { action: string }).action,
            action_input: {},
            observation: (event.step as { observation?: string }).observation || '',
            timestamp: new Date().toISOString(),
            token_input: 0,
            token_output: 0,
            duration_ms: 0,
          });
        }
        break;

      case 'interrupt':
        if (event.thread_id) {
          get().setInterrupted(event.thread_id, event.content || '');
          set({ statusMessage: '任务已暂停，等待您的指令...' });
        }
        break;

      case 'cancelled':
        set({ isStreaming: false, statusMessage: '任务已被取消', currentTaskId: null });
        break;

      case 'done':
        get().setDoneOutput(event.output || null);
        set({ isStreaming: false, statusMessage: '', currentTaskId: null });
        break;

      case 'result':
        get().setDoneOutput(event.content || null);
        break;

      case 'error':
        get().setDoneOutput(event.content || 'An error occurred');
        set({ isStreaming: false, statusMessage: '', currentTaskId: null });
        break;

      default:
        break;
    }
  },

  reset: () => {
    set({
      threadId: null,
      currentTaskId: null,
      isStreaming: false,
      streamingMessageId: null,
      assignedAgents: [],
      statusMessage: '',
      executionPlan: null,
      reactSteps: [],
      isInterrupted: false,
      interruptThreadId: null,
      interruptMessage: '',
      doneOutput: null,
  accumulatedContent: '',
    });
  },
}));