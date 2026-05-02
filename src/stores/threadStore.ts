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

      case 'subtask_start':
        if (event.agent_id) {
          get().updateAgent(event.agent_id, { status: 'working' });
        }
        break;

      case 'subtask_token':
        if (event.agent_id && event.token) {
          get().updateAgent(event.agent_id, {
            streamingContent: (state.assignedAgents.find(a => a.id === event.agent_id)?.streamingContent || '') + event.token,
          });
        }
        break;

      case 'subtask_complete':
        if (event.agent_id) {
          get().updateAgent(event.agent_id, { status: 'completed' });
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
          get().addReactStep(event.step);
        }
        break;

      case 'interrupt':
        if (event.thread_id) {
          get().setInterrupted(event.thread_id, event.content || '');
        }
        break;

      case 'done':
      case 'error':
      case 'cancelled':
        set({ isStreaming: false });
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
    });
  },
}));