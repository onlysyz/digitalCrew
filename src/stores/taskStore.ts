/**
 * Zustand store for tasks state management
 */
import { create } from 'zustand';
import type { Task, TaskStatus } from '../types/api';
import { taskApi } from '../services/api';

interface TaskState {
  tasks: Task[];
  selectedTaskId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchTasks: (filters?: { status?: TaskStatus; agent_id?: string }) => Promise<void>;
  createTask: (data: { description: string; mode?: string; target_agent_id?: string }) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string, userInput?: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  setSelectedTask: (taskId: string | null) => void;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  isLoading: false,
  error: null,

  fetchTasks: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const response = await taskApi.list(filters);
      set({ tasks: response.tasks as Task[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createTask: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await taskApi.create(data);
      await get().fetchTasks();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  cancelTask: async (taskId) => {
    try {
      await taskApi.cancel(taskId);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'cancelled' as TaskStatus } : t
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  pauseTask: async (taskId) => {
    try {
      await taskApi.pause(taskId);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'paused' as TaskStatus } : t
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  resumeTask: async (taskId, userInput) => {
    try {
      await taskApi.resume(taskId, userInput);
      await get().fetchTasks();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  retryTask: async (taskId) => {
    try {
      await taskApi.retry(taskId);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'pending' as TaskStatus } : t
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setSelectedTask: (taskId) => {
    set({ selectedTaskId: taskId });
  },

  clearError: () => {
    set({ error: null });
  },
}));