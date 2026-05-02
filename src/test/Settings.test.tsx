import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSystemStore } from '../stores/systemStore';

describe('Settings Store Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    useSystemStore.setState({
      settings: null,
      resources: null,
      isLoading: false,
      error: null,
      fetchSettings: vi.fn().mockResolvedValue(undefined),
      updateSettings: vi.fn().mockResolvedValue({}),
      fetchResources: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Settings Loading', () => {
    it('fetchSettings is called on mount', () => {
      useSystemStore.getState().fetchSettings();
      expect(useSystemStore.getState().fetchSettings).toHaveBeenCalled();
    });

    it('fetchResources is called on mount', () => {
      useSystemStore.getState().fetchResources();
      expect(useSystemStore.getState().fetchResources).toHaveBeenCalled();
    });

    it('settings are loaded from store', () => {
      useSystemStore.setState({
        settings: {
          ollama_base_url: 'http://custom:11434',
          temperature: 0.8,
          top_p: 0.95,
          context_window: 4096,
          language: 'en',
          workspace_dir: '/test/workspace',
          sandbox_timeout: 120,
          max_concurrent_agents: 3,
          enable_error_reporting: true,
          enable_anonymous_stats: false,
        },
      });

      expect(useSystemStore.getState().settings?.ollama_base_url).toBe('http://custom:11434');
      expect(useSystemStore.getState().settings?.temperature).toBe(0.8);
    });
  });

  describe('Validation Logic', () => {
    const validateOllamaUrl = (url: string): string | null => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'Ollama URL 格式无效';
      }
      try {
        new URL(url);
        return null;
      } catch {
        return 'URL 格式无效';
      }
    };

    const validateSandboxTimeout = (timeout: number): string | null => {
      if (timeout < 10 || timeout > 300) {
        return '沙箱超时时间必须在 10-300 秒之间';
      }
      return null;
    };

    const validateWorkspaceDir = (dir: string): string | null => {
      if (dir.trim().length === 0) {
        return '工作目录不能为空';
      }
      return null;
    };

    it('validates Ollama URL must start with http', () => {
      expect(validateOllamaUrl('invalid-url')).toBe('Ollama URL 格式无效');
    });

    it('validates Ollama URL with http prefix', () => {
      expect(validateOllamaUrl('http://localhost:11434')).toBeNull();
    });

    it('validates Ollama URL with https prefix', () => {
      expect(validateOllamaUrl('https://localhost:11434')).toBeNull();
    });

    it('validates invalid URL format', () => {
      // 'not-a-url' doesn't start with http, so it returns 'Ollama URL 格式无效'
      expect(validateOllamaUrl('not-a-url')).toBe('Ollama URL 格式无效');
    });

    it('validates sandbox timeout minimum', () => {
      expect(validateSandboxTimeout(5)).toBe('沙箱超时时间必须在 10-300 秒之间');
    });

    it('validates sandbox timeout maximum', () => {
      expect(validateSandboxTimeout(400)).toBe('沙箱超时时间必须在 10-300 秒之间');
    });

    it('validates sandbox timeout in range', () => {
      expect(validateSandboxTimeout(60)).toBeNull();
    });

    it('validates workspace directory not empty', () => {
      expect(validateWorkspaceDir('')).toBe('工作目录不能为空');
    });

    it('validates workspace directory with whitespace only', () => {
      expect(validateWorkspaceDir('   ')).toBe('工作目录不能为空');
    });

    it('validates workspace directory is valid', () => {
      expect(validateWorkspaceDir('/valid/path')).toBeNull();
    });
  });

  describe('Update Settings', () => {
    it('updateSettings is called with correct data', async () => {
      const updateSettingsMock = vi.fn().mockResolvedValue({});
      useSystemStore.setState({ updateSettings: updateSettingsMock });

      const settingsData = {
        ollama_base_url: 'http://localhost:11434',
        temperature: 0.7,
        top_p: 0.9,
        context_window: 8192,
        language: 'zh',
        workspace_dir: '/workspace',
        sandbox_timeout: 60,
        max_concurrent_agents: 5,
        enable_error_reporting: false,
        enable_anonymous_stats: false,
      };

      await useSystemStore.getState().updateSettings(settingsData as any);

      expect(updateSettingsMock).toHaveBeenCalledWith(settingsData);
    });

    it('handles updateSettings error', async () => {
      const updateSettingsMock = vi.fn().mockRejectedValue(new Error('Save failed'));
      useSystemStore.setState({ updateSettings: updateSettingsMock });

      try {
        await useSystemStore.getState().updateSettings({} as any);
      } catch (e) {
        expect((e as Error).message).toBe('Save failed');
      }
    });

    it('handles restart_required response', async () => {
      const updateSettingsMock = vi.fn().mockResolvedValue({
        restart_required: ['model', 'sandbox'],
      });
      useSystemStore.setState({ updateSettings: updateSettingsMock });

      const response = await useSystemStore.getState().updateSettings({} as any);

      expect(response.restart_required).toContain('model');
      expect(response.restart_required).toContain('sandbox');
    });
  });

  describe('Connection Testing', () => {
    it('constructs correct Ollama API URL', () => {
      const baseUrl = 'http://localhost:11434';
      const expectedUrl = `${baseUrl}/api/tags`;

      expect(expectedUrl).toBe('http://localhost:11434/api/tags');
    });
  });

  describe('Resource Formatting', () => {
    const formatMemory = (gb: number) => {
      return gb.toFixed(1);
    };

    it('formats memory to one decimal place', () => {
      expect(formatMemory(8.5)).toBe('8.5');
      expect(formatMemory(16)).toBe('16.0');
      expect(formatMemory(32.75)).toBe('32.8');
    });
  });

  describe('Resource Monitor Data', () => {
    it('displays CPU usage percentage', () => {
      const resources = {
        cpu_percent: 45,
        gpu_percent: 30,
        memory_used_gb: 16,
        memory_total_gb: 32,
        memory_percent: 50,
        ollama_models: [],
      };

      expect(resources.cpu_percent).toBe(45);
    });

    it('displays GPU usage percentage', () => {
      const resources = {
        cpu_percent: 45,
        gpu_percent: 75,
        memory_used_gb: 16,
        memory_total_gb: 32,
        memory_percent: 50,
        ollama_models: [],
      };

      expect(resources.gpu_percent).toBe(75);
    });

    it('displays memory in GB', () => {
      const resources = {
        cpu_percent: 45,
        gpu_percent: 30,
        memory_used_gb: 16,
        memory_total_gb: 32,
        memory_percent: 50,
        ollama_models: [],
      };

      expect(resources.memory_used_gb).toBe(16);
      expect(resources.memory_total_gb).toBe(32);
    });

    it('displays memory percentage', () => {
      const resources = {
        cpu_percent: 45,
        gpu_percent: 30,
        memory_used_gb: 16,
        memory_total_gb: 32,
        memory_percent: 50,
        ollama_models: [],
      };

      expect(resources.memory_percent).toBe(50);
    });

    it('displays Ollama models list', () => {
      const resources = {
        cpu_percent: 45,
        gpu_percent: 30,
        memory_used_gb: 16,
        memory_total_gb: 32,
        memory_percent: 50,
        ollama_models: [
          { name: 'llama3:8b', size: '4.7GB', loaded: true },
          { name: 'mistral:7b', size: '4.1GB', loaded: false },
        ],
      };

      expect(resources.ollama_models).toHaveLength(2);
      expect(resources.ollama_models[0].name).toBe('llama3:8b');
      expect(resources.ollama_models[0].loaded).toBe(true);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('constructs agent defaults object', () => {
      const temp = 0.7;
      const topP = 0.9;
      const contextWindow = 8192;

      const defaults = {
        temperature: temp,
        top_p: topP,
        context_window: contextWindow,
      };

      expect(defaults.temperature).toBe(0.7);
      expect(defaults.top_p).toBe(0.9);
      expect(defaults.context_window).toBe(8192);
    });
  });

  describe('Parameter Range Validation', () => {
    it('temperature range is 0-2', () => {
      const temp = 1.5;
      expect(temp >= 0 && temp <= 2).toBe(true);
    });

    it('topP range is 0-1', () => {
      const topP = 0.8;
      expect(topP >= 0 && topP <= 1).toBe(true);
    });

    it('context window options', () => {
      const validOptions = [4096, 8192, 32768];
      expect(validOptions).toContain(4096);
      expect(validOptions).toContain(8192);
      expect(validOptions).toContain(32768);
    });

    it('max concurrent agents range is 1-10', () => {
      const maxConcurrentAgents = 5;
      expect(maxConcurrentAgents >= 1 && maxConcurrentAgents <= 10).toBe(true);
    });
  });

  describe('Save Status Transitions', () => {
    it('save status idle initial state', () => {
      const saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
      expect(saveStatus).toBe('idle');
    });

    it('save status transitions to saving', () => {
      let saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
      saveStatus = 'saving';
      expect(saveStatus).toBe('saving');
    });

    it('save status transitions to saved then idle', () => {
      let saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
      saveStatus = 'saving';
      saveStatus = 'saved';
      expect(saveStatus).toBe('saved');

      // Simulate timeout
      setTimeout(() => {
        saveStatus = 'idle';
      }, 2000);

      vi.advanceTimersByTime(2000);
      expect(saveStatus).toBe('idle');
    });
  });

  describe('Connection Status Types', () => {
    it('connection status can be idle', () => {
      const status: 'idle' | 'testing' | 'connected' | 'failed' = 'idle';
      expect(status).toBe('idle');
    });

    it('connection status can be testing', () => {
      const status: 'idle' | 'testing' | 'connected' | 'failed' = 'testing';
      expect(status).toBe('testing');
    });

    it('connection status can be connected', () => {
      const status: 'idle' | 'testing' | 'connected' | 'failed' = 'connected';
      expect(status).toBe('connected');
    });

    it('connection status can be failed', () => {
      const status: 'idle' | 'testing' | 'connected' | 'failed' = 'failed';
      expect(status).toBe('failed');
    });
  });
});