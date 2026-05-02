/**
 * Zustand store for system state management
 */
import { create } from 'zustand';
import type { SystemResources, SystemSettings } from '../types/api';
import { systemApi } from '../services/api';

interface SystemState {
  isConnected: boolean;
  resources: SystemResources | null;
  settings: SystemSettings | null;
  models: {
    models: Array<{ name: string; size: number; size_gb: number; modified_at: string }>;
    running_models: Array<{ name: string; vram_gb: number; duration: number }>;
    model_count: number;
    running_count: number;
    total_size_gb: number;
    total_vram_gb: number;
  } | null;
  isLoading: boolean;
  error: string | null;

  checkConnection: () => Promise<void>;
  fetchResources: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchModels: () => Promise<void>;
  updateSettings: (settings: Partial<SystemSettings>) => Promise<unknown>;
  clearCache: () => Promise<void>;
  clearError: () => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  isConnected: false,
  resources: null,
  settings: null,
  models: null,
  isLoading: false,
  error: null,

  checkConnection: async () => {
    try {
      const response = await systemApi.getStatus();
      set({ isConnected: response.status === 'healthy' });
    } catch {
      set({ isConnected: false });
    }
  },

  fetchResources: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await systemApi.getResources();
      set({ resources: response as unknown as SystemResources, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await systemApi.getSettings();
      set({ settings: response as unknown as SystemSettings, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchModels: async () => {
    try {
      const response = await systemApi.getModels();
      set({ models: response });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateSettings: async (settings) => {
    set({ isLoading: true, error: null });
    try {
      const response = await systemApi.updateSettings(settings);
      await systemApi.getSettings().then((r) => {
        set({ settings: r as unknown as SystemSettings, isLoading: false });
      });
      return response;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  clearCache: async () => {
    try {
      await systemApi.clearCache();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));