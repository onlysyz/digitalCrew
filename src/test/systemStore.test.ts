import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSystemStore } from '../stores/systemStore';
import { systemApi } from '../services/api';

vi.mock('../services/api', () => ({
  systemApi: {
    getStatus: vi.fn(),
    getResources: vi.fn(),
    getSettings: vi.fn(),
    getModels: vi.fn(),
    updateSettings: vi.fn(),
    clearCache: vi.fn(),
  },
}));

describe('SystemStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSystemStore.setState({
      isConnected: false,
      resources: null,
      settings: null,
      models: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('has isConnected false', () => {
      const { isConnected } = useSystemStore.getState();
      expect(isConnected).toBe(false);
    });

    it('has null resources', () => {
      const { resources } = useSystemStore.getState();
      expect(resources).toBeNull();
    });

    it('has null settings', () => {
      const { settings } = useSystemStore.getState();
      expect(settings).toBeNull();
    });

    it('has null models', () => {
      const { models } = useSystemStore.getState();
      expect(models).toBeNull();
    });

    it('has isLoading false', () => {
      const { isLoading } = useSystemStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has null error', () => {
      const { error } = useSystemStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('checkConnection', () => {
    it('sets isConnected to true when status is healthy', async () => {
      vi.mocked(systemApi.getStatus).mockResolvedValue({ status: 'healthy', version: '1.0', ollama_connected: true });

      await useSystemStore.getState().checkConnection();

      expect(useSystemStore.getState().isConnected).toBe(true);
    });

    it('sets isConnected to false when status is not healthy', async () => {
      vi.mocked(systemApi.getStatus).mockResolvedValue({ status: 'unhealthy', version: '1.0', ollama_connected: false });

      await useSystemStore.getState().checkConnection();

      expect(useSystemStore.getState().isConnected).toBe(false);
    });

    it('sets isConnected to false on error', async () => {
      vi.mocked(systemApi.getStatus).mockRejectedValue(new Error('Connection failed'));

      await useSystemStore.getState().checkConnection();

      expect(useSystemStore.getState().isConnected).toBe(false);
    });
  });

  describe('fetchResources', () => {
    it('sets isLoading true when fetching', async () => {
      vi.mocked(systemApi.getResources).mockResolvedValue({ cpu: 50, memory: 60 });

      const promise = useSystemStore.getState().fetchResources();

      expect(useSystemStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates resources on success', async () => {
      const mockResources = { cpu: 50, memory: 60, disk: 70 };
      vi.mocked(systemApi.getResources).mockResolvedValue(mockResources);

      await useSystemStore.getState().fetchResources();

      expect(useSystemStore.getState().resources).toEqual(mockResources);
      expect(useSystemStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(systemApi.getResources).mockRejectedValue(new Error('Failed to fetch resources'));

      await useSystemStore.getState().fetchResources();

      expect(useSystemStore.getState().error).toBe('Failed to fetch resources');
      expect(useSystemStore.getState().isLoading).toBe(false);
    });

    it('clears previous error on new fetch', async () => {
      useSystemStore.setState({ error: 'Previous error' });
      vi.mocked(systemApi.getResources).mockResolvedValue({ cpu: 50 });

      await useSystemStore.getState().fetchResources();

      expect(useSystemStore.getState().error).toBeNull();
    });
  });

  describe('fetchSettings', () => {
    it('sets isLoading true when fetching', async () => {
      vi.mocked(systemApi.getSettings).mockResolvedValue({});

      const promise = useSystemStore.getState().fetchSettings();

      expect(useSystemStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates settings on success', async () => {
      const mockSettings = { theme: 'dark', language: 'en' };
      vi.mocked(systemApi.getSettings).mockResolvedValue(mockSettings);

      await useSystemStore.getState().fetchSettings();

      expect(useSystemStore.getState().settings).toEqual(mockSettings);
      expect(useSystemStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(systemApi.getSettings).mockRejectedValue(new Error('Failed to fetch settings'));

      await useSystemStore.getState().fetchSettings();

      expect(useSystemStore.getState().error).toBe('Failed to fetch settings');
      expect(useSystemStore.getState().isLoading).toBe(false);
    });
  });

  describe('fetchModels', () => {
    it('updates models on success', async () => {
      const mockModels = {
        models: [{ name: 'llama3', size: 4000000000, size_gb: 4, modified_at: '2024-01-01' }],
        running_models: [{ name: 'llama3', vram_gb: 4, duration: 60 }],
        model_count: 1,
        running_count: 1,
        total_size_gb: 4,
        total_vram_gb: 4,
      };
      vi.mocked(systemApi.getModels).mockResolvedValue(mockModels);

      await useSystemStore.getState().fetchModels();

      expect(useSystemStore.getState().models).toEqual(mockModels);
    });

    it('sets error on failure', async () => {
      vi.mocked(systemApi.getModels).mockRejectedValue(new Error('Failed to fetch models'));

      await useSystemStore.getState().fetchModels();

      expect(useSystemStore.getState().error).toBe('Failed to fetch models');
    });

    it('does not set isLoading during fetch', async () => {
      vi.mocked(systemApi.getModels).mockResolvedValue({
        models: [],
        running_models: [],
        model_count: 0,
        running_count: 0,
        total_size_gb: 0,
        total_vram_gb: 0,
      });

      await useSystemStore.getState().fetchModels();

      expect(useSystemStore.getState().isLoading).toBe(false);
    });
  });

  describe('updateSettings', () => {
    it('sets isLoading true when updating', async () => {
      vi.mocked(systemApi.updateSettings).mockResolvedValue({ message: 'Updated' });
      vi.mocked(systemApi.getSettings).mockResolvedValue({ theme: 'dark' });

      const promise = useSystemStore.getState().updateSettings({ theme: 'dark' });

      expect(useSystemStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates settings after successful update', async () => {
      const mockSettings = { theme: 'dark', language: 'en' };
      vi.mocked(systemApi.updateSettings).mockResolvedValue({ message: 'Updated' });
      vi.mocked(systemApi.getSettings).mockResolvedValue(mockSettings);

      await useSystemStore.getState().updateSettings({ theme: 'dark' });

      expect(useSystemStore.getState().settings).toEqual(mockSettings);
      expect(useSystemStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(systemApi.updateSettings).mockRejectedValue(new Error('Update failed'));

      try {
        await useSystemStore.getState().updateSettings({ theme: 'dark' });
      } catch {}

      expect(useSystemStore.getState().error).toBe('Update failed');
      expect(useSystemStore.getState().isLoading).toBe(false);
    });

    it('throws error to caller on failure', async () => {
      vi.mocked(systemApi.updateSettings).mockRejectedValue(new Error('Update failed'));

      await expect(useSystemStore.getState().updateSettings({ theme: 'dark' })).rejects.toThrow('Update failed');
    });

    it('returns response on success', async () => {
      vi.mocked(systemApi.updateSettings).mockResolvedValue({ message: 'Success', settings: {} });
      vi.mocked(systemApi.getSettings).mockResolvedValue({});

      const result = await useSystemStore.getState().updateSettings({ theme: 'dark' });

      expect(result).toEqual({ message: 'Success', settings: {} });
    });
  });

  describe('clearCache', () => {
    it('calls systemApi.clearCache', async () => {
      vi.mocked(systemApi.clearCache).mockResolvedValue({ message: 'Cache cleared' });

      await useSystemStore.getState().clearCache();

      expect(systemApi.clearCache).toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
      vi.mocked(systemApi.clearCache).mockRejectedValue(new Error('Clear cache failed'));

      await useSystemStore.getState().clearCache();

      expect(useSystemStore.getState().error).toBe('Clear cache failed');
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      useSystemStore.setState({ error: 'Some error' });

      useSystemStore.getState().clearError();

      expect(useSystemStore.getState().error).toBeNull();
    });
  });

  describe('System State Transitions', () => {
    it('handles connection check followed by resource fetch', async () => {
      vi.mocked(systemApi.getStatus).mockResolvedValue({ status: 'healthy', version: '1.0', ollama_connected: true });
      vi.mocked(systemApi.getResources).mockResolvedValue({ cpu: 50, memory: 60 });

      await useSystemStore.getState().checkConnection();
      await useSystemStore.getState().fetchResources();

      expect(useSystemStore.getState().isConnected).toBe(true);
      expect(useSystemStore.getState().resources).toEqual({ cpu: 50, memory: 60 });
    });

    it('handles multiple operations with different loading states', async () => {
      vi.mocked(systemApi.getResources).mockResolvedValue({ cpu: 50 });
      vi.mocked(systemApi.getModels).mockResolvedValue({
        models: [],
        running_models: [],
        model_count: 0,
        running_count: 0,
        total_size_gb: 0,
        total_vram_gb: 0,
      });

      const resourcesPromise = useSystemStore.getState().fetchResources();
      expect(useSystemStore.getState().isLoading).toBe(true);

      await resourcesPromise;
      expect(useSystemStore.getState().isLoading).toBe(false);

      await useSystemStore.getState().fetchModels();
      expect(useSystemStore.getState().isLoading).toBe(false);
    });
  });
});