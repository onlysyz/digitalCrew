/**
 * Zustand store for agents state management
 */
import { create } from 'zustand';
import type { Agent, AgentStatus } from '../types/api';
import { agentApi } from '../services/api';

interface AgentState {
  agents: Agent[];
  selectedAgentId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchAgents: () => Promise<void>;
  createAgent: (data: { name: string; description?: string; role?: string; model_name?: string; system_prompt?: string; tool_permissions?: Array<{ tool_name: string; enabled: boolean }> }) => Promise<void>;
  updateAgent: (agentId: string, data: Partial<Agent>) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  startAgent: (agentId: string) => Promise<void>;
  pauseAgent: (agentId: string) => Promise<void>;
  resumeAgent: (agentId: string) => Promise<void>;
  setSelectedAgent: (agentId: string | null) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentApi.list();
      set({ agents: response.agents as Agent[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createAgent: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await agentApi.create(data);
      await get().fetchAgents();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateAgent: async (agentId, data) => {
    set({ isLoading: true, error: null });
    try {
      await agentApi.update(agentId, data);
      await get().fetchAgents();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteAgent: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      await agentApi.delete(agentId);
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== agentId),
        selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId,
        isLoading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  startAgent: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentApi.start(agentId);
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, status: response.agent.status } : a
        ),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  pauseAgent: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentApi.pause(agentId);
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, status: response.agent.status } : a
        ),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  resumeAgent: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentApi.resume(agentId);
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, status: response.agent.status } : a
        ),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  setSelectedAgent: (agentId) => {
    set({ selectedAgentId: agentId });
  },

  updateAgentStatus: (agentId, status) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status } : a
      ),
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));