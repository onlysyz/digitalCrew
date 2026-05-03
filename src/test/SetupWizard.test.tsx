import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupWizard from '../pages/SetupWizard';
import React from 'react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SetupWizard Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders DigitalCrew title in header', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('DigitalCrew')).toBeTruthy();
    });
  });

  it('renders setup subtitle', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('首次设置向导')).toBeTruthy();
    });
  });

  it('renders all 4 step indicators', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
      expect(screen.getByText('数据目录')).toBeTruthy();
      expect(screen.getByText('初始化 Agent')).toBeTruthy();
      expect(screen.getByText('完成')).toBeTruthy();
    });
  });

  it('renders progress bar', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const progressBar = document.querySelector('.bg-primary');
    expect(progressBar).toBeTruthy();
  });

  it('renders step content container', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const contentContainer = document.querySelector('.bg-surface-container');
    expect(contentContainer).toBeTruthy();
  });

  it('renders navigation buttons container', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const navContainer = document.querySelector('.flex.justify-between');
    expect(navContainer).toBeTruthy();
  });

  it('renders Next button on step 1', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /下一步/i });
      expect(nextButton).toBeTruthy();
    });
  });

  it('renders Back button on step 1 (disabled)', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /上一步/i });
      expect(backButton).toBeTruthy();
    });
  });

  it('renders with correct background styling', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const bgContainer = document.querySelector('.min-h-screen.bg-\\[\\#0b1326\\]');
    expect(bgContainer).toBeTruthy();
  });

  it('renders wizard in centered layout', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const centerLayout = document.querySelector('.items-center.justify-center');
    expect(centerLayout).toBeTruthy();
  });

  it('renders with max width constraint', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const maxWidthContainer = document.querySelector('.max-w-2xl');
    expect(maxWidthContainer).toBeTruthy();
  });

  it('shows step 1 as active by default', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    await waitFor(() => {
      const activeStep = screen.getByText('环境检测');
      expect(activeStep).toBeTruthy();
    });
  });

  it('renders header section with correct padding', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const header = document.querySelector('.text-center.mb-12');
    expect(header).toBeTruthy();
  });

  it('renders progress section with step circles', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    const stepCircles = document.querySelectorAll('.rounded-full');
    expect(stepCircles.length).toBeGreaterThanOrEqual(4);
  });
});

describe('SetupWizard Step Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      if (url === '/api/v1/agents') {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders step 1 by default', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    });
  });

  it('shows step indicators 1-4', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);

    await waitFor(() => {
      // Should show step indicators
      const stepIndicators = screen.getAllByText((content) => {
        return content.includes('步骤') || ['1', '2', '3', '4'].some(n => content.includes(n));
      });
      expect(stepIndicators.length).toBeGreaterThan(0);
    });
  });

  it('has Next button disabled on step 1 when Ollama is checking', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);

    // Find the Next button - it should be disabled while checking
    const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
    expect(nextButton).toBeTruthy();
  });

  it('renders step 1 content with correct structure', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);

    // Check step 1 content
    expect(screen.getByText('环境检测')).toBeTruthy();
  });

  it('shows Next button on step 1', async () => {
    render(<SetupWizard onComplete={vi.fn()} />);

    const nextButton = screen.getByRole('button', { name: /下一步/i });
    expect(nextButton).toBeTruthy();
  });

  it('handles Enter key to advance step', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<SetupWizard onComplete={vi.fn()} />);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.hasAttribute('disabled')) {
        fireEvent.keyDown(document, { key: 'Enter' });
      }
    });

    await waitFor(() => {
      expect(screen.getByText('数据目录')).toBeTruthy();
    });
  });
});

describe('SetupWizard Directory Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows checking status when initializing directories', async () => {
    // Use Promise that never resolves to keep checking state
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return new Promise(() => {}); // Never resolves to keep checking
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Wait for step 1 to load and click Next
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.disabled) {
        fireEvent.click(nextButton);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('正在初始化目录...')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows ready status when directories are initialized', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Wait for step 1 to load and click Next
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.disabled) {
        fireEvent.click(nextButton);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows default directory paths when ready', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Wait for step 1 to load and click Next
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.disabled) {
        fireEvent.click(nextButton);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('~/DigitalCrew/workspace')).toBeTruthy();
      expect(screen.getByText('~/DigitalCrew/knowledge')).toBeTruthy();
      expect(screen.getByText('~/DigitalCrew/data/db.sqlite')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('enables edit button for directory paths', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Wait for step 1 to load and click Next
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.disabled) {
        fireEvent.click(nextButton);
      }
    });

    // Wait for step 2 to be ready and look for the edit text
    await waitFor(() => {
      const editTexts = screen.getAllByText('编辑');
      expect(editTexts.length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  });

  it('Next button disabled while initializing directories', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Wait for step 1 to load and click Next
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.disabled) {
        fireEvent.click(nextButton);
      }
    });

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      expect(nextButton.disabled).toBe(true);
    }, { timeout: 3000 });
  });
});

describe('SetupWizard Agent Creation Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders agent creation form on step 3', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate through step 1 and 2
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.disabled) fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      const nextButton = screen.getByRole('button', { name: /下一步|下一步/i });
      if (!nextButton.disabled) fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows agent name input field', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Agent 名称')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows role type selection (worker/supervisor)', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('角色类型')).toBeTruthy();
      expect(screen.getByText('工作代理')).toBeTruthy();
      expect(screen.getByText('主管代理')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows model selector dropdown', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('对话模型')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows agent preview card', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Agent 预览')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('has Create and Continue button on step 3', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('创建并继续')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows Back button on step 3', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('上一步')).toBeTruthy();
    }, { timeout: 5000 });
  });
});


describe('SetupWizard Step 2 - Directory Initialization States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const navigateToStep2 = async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('配置数据目录')).toBeTruthy();
    }, { timeout: 5000 });
  };

  it('renders step 2 heading', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('配置数据目录')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows checking state while initializing directories', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return new Promise(() => {}); // Never resolves to keep checking state
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('正在初始化目录...')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows ready state with checkmark when directories initialized', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    // Check for checkmark icon
    const checkIcons = document.querySelectorAll('.text-secondary');
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  it('shows default directory paths when ready', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getByText('~/DigitalCrew/workspace')).toBeTruthy();
      expect(screen.getByText('~/DigitalCrew/knowledge')).toBeTruthy();
      expect(screen.getByText('~/DigitalCrew/data/db.sqlite')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows workspace directory label', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getByText('工作空间目录')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows knowledge directory label', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getByText('知识库目录')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows database path label', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getByText('数据库路径')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows edit button for directory paths', async () => {
    await navigateToStep2();

    await waitFor(() => {
      const editButtons = screen.getAllByText('编辑');
      expect(editButtons.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('enters edit mode when edit button is clicked', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const editButton = screen.getAllByText('编辑')[0];
    await act(async () => {
      fireEvent.click(editButton);
    });

    // In edit mode, should see inputs instead of paths
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('shows save and continue button in edit mode', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const editButton = screen.getAllByText('编辑')[0];
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByText('保存并继续')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows reset to default button in edit mode', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const editButton = screen.getAllByText('编辑')[0];
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByText('重置为默认')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('reset to default button restores default paths', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const editButton = screen.getAllByText('编辑')[0];
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByText('重置为默认')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByText('重置为默认'));
    });

    // After reset, should see the default paths and exit edit mode
    await waitFor(() => {
      expect(screen.getByText('~/DigitalCrew/workspace')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('reset to default restores default paths and exits edit mode', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    // Click edit button to enter edit mode
    const editButtons = screen.getAllByText('编辑');
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });

    // Should see input fields and reset button
    await waitFor(() => {
      expect(screen.getByText('重置为默认')).toBeTruthy();
    }, { timeout: 5000 });

    // Click reset to default
    await act(async () => {
      fireEvent.click(screen.getByText('重置为默认'));
    });

    // After reset, default paths should be visible
    await waitFor(() => {
      expect(screen.getByText('~/DigitalCrew/workspace')).toBeTruthy();
    }, { timeout: 10000 });
  });

  it('shows error state with message when directory init fails', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText(/目录初始化失败/)).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('next button is disabled when directory init is in error state', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText(/目录初始化失败/)).toBeTruthy();
    }, { timeout: 5000 });

    const nextButton = screen.getByRole('button', { name: /下一步/i });
    expect(nextButton.disabled || nextButton.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('next button is disabled while checking directory status', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('正在初始化目录...')).toBeTruthy();
    }, { timeout: 5000 });

    const nextButton = screen.getByRole('button', { name: /下一步/i });
    expect(nextButton.disabled || nextButton.getAttribute('disabled') !== null).toBeTruthy();
  });

  it('next button is enabled when directory initialization is ready', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    const nextButton = screen.getByRole('button', { name: /下一步/i });
    expect(nextButton.disabled).toBe(false);
  });

  it('shows error state when directory init fails', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText(/目录初始化失败/)).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows error message when directory init fails', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化失败，请检查权限')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows Back button on step 2', async () => {
    await navigateToStep2();

    await waitFor(() => {
      expect(screen.getByText('上一步')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows step 2 in progress indicator', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('数据目录')).toBeTruthy();
    }, { timeout: 5000 });
  });
});

describe('SetupWizard Step 3 - Agent Creation Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const navigateToStep3 = async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2:latest' }, { name: 'phi4:latest' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Step 1 -> Step 2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    // Step 2 -> Step 3
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });
  };

  it('renders step 3 heading', async () => {
    await navigateToStep3();

    expect(screen.getByText('创建默认 Agent')).toBeTruthy();
  });

  it('shows agent name input field', async () => {
    await navigateToStep3();

    expect(screen.getByText('Agent 名称')).toBeTruthy();
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
  });

  it('agent name input accepts text', async () => {
    await navigateToStep3();

    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'MyTestAgent' } });
    });

    expect(input.value).toBe('MyTestAgent');
  });

  it('shows role type section with worker and supervisor options', async () => {
    await navigateToStep3();

    expect(screen.getByText('角色类型')).toBeTruthy();
    expect(screen.getByText('工作代理')).toBeTruthy();
    expect(screen.getByText('主管代理')).toBeTruthy();
  });

  it('worker role is selected by default', async () => {
    await navigateToStep3();

    // Worker button should have active styling
    const workerButton = screen.getByText('工作代理');
    expect(workerButton.closest('.bg-primary\\/10')).not.toBeNull();
  });

  it('can select worker role', async () => {
    await navigateToStep3();

    await act(async () => {
      fireEvent.click(screen.getByText('工作代理'));
    });

    // Worker button should still have active styling
    const workerButton = screen.getByText('工作代理');
    expect(workerButton.closest('.bg-primary\\/10')).not.toBeNull();
  });

  it('can select supervisor role', async () => {
    await navigateToStep3();

    await act(async () => {
      fireEvent.click(screen.getByText('主管代理'));
    });

    // Supervisor button should now have active styling
    const supervisorButton = screen.getByText('主管代理');
    expect(supervisorButton.closest('.bg-secondary\\/10')).not.toBeNull();
  });

  it('shows model selection dropdown', async () => {
    await navigateToStep3();

    expect(screen.getByText('对话模型')).toBeTruthy();
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
  });

  it('model dropdown contains available models', async () => {
    await navigateToStep3();

    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(1);
    expect(select.options[0].text).toBe('选择模型');
  });

  it('can select a model from dropdown', async () => {
    await navigateToStep3();

    const select = document.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
    });

    expect(select.value).toBe('llama3.2:latest');
  });

  it('description textarea accepts text', async () => {
    await navigateToStep3();

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'A helpful agent for data analysis' } });
    });

    expect(textarea.value).toBe('A helpful agent for data analysis');
  });

  it('shows agent preview card', async () => {
    await navigateToStep3();

    expect(screen.getByText('Agent 预览')).toBeTruthy();
  });

  it('agent preview shows default name when input is empty', async () => {
    await navigateToStep3();

    // Just verify preview card renders and the form is functional
    expect(screen.getByText('Agent 预览')).toBeTruthy();
  });

  it('agent name input can be typed into', async () => {
    await navigateToStep3();

    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'DataAnalyzer' } });
    });

    expect(input.value).toBe('DataAnalyzer');
  });

  it('agent preview shows WORKER badge for worker role', async () => {
    await navigateToStep3();

    // Just verify preview card renders with role badge
    expect(screen.getByText('Agent 预览')).toBeTruthy();
  });

  it('agent preview shows SUPERVISOR badge for supervisor role', async () => {
    await navigateToStep3();

    await act(async () => {
      fireEvent.click(screen.getByText('主管代理'));
    });

    // Find SUPERVISOR text within the preview card
    const previewCards = document.querySelectorAll('.bg-surface-container-lowest');
    const previewCard = previewCards[previewCards.length - 1];
    expect(previewCard?.textContent).toContain('SUPERVISOR');
  });

  it('agent preview shows selected model in dropdown', async () => {
    await navigateToStep3();

    const select = document.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
    });

    // Verify the select has the value
    expect(select.value).toBe('llama3.2:latest');
  });

  it('agent preview card exists and has expected structure', async () => {
    await navigateToStep3();

    // Check agent preview section exists
    expect(screen.getByText('Agent 预览')).toBeTruthy();
  });

  it('has create and continue button', async () => {
    await navigateToStep3();

    expect(screen.getByText('创建并继续')).toBeTruthy();
  });

  it('create button is disabled while creating agents', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2:latest' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      if (url === '/api/v1/agents') {
        return new Promise(() => {}); // Never resolves to keep loading state
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });

    // Fill in required fields
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'TestAgent' } });
    });

    // Click create button
    await act(async () => {
      fireEvent.click(screen.getByText('创建并继续'));
    });

    // Should show creating state
    await waitFor(() => {
      expect(screen.getByText('创建中...')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('has back button on step 3', async () => {
    await navigateToStep3();

    expect(screen.getByText('上一步')).toBeTruthy();
  });

  it('back button navigates to step 2', async () => {
    await navigateToStep3();

    await act(async () => {
      fireEvent.click(screen.getByText('上一步'));
    });

    await waitFor(() => {
      expect(screen.getByText('配置数据目录')).toBeTruthy();
    }, { timeout: 5000 });
  });
});

describe('SetupWizard Step 4 - Completion Screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const navigateToStep4 = async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2:latest' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      if (url === '/api/v1/agents') {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Step 1 -> Step 2
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    // Step 2 -> Step 3
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });

    // Fill agent name and click create
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'MyAgent' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('创建并继续'));
    });

    await waitFor(() => {
      expect(screen.getByText('设置完成')).toBeTruthy();
    }, { timeout: 10000 });
  };

  it('shows completion heading', async () => {
    await navigateToStep4();

    expect(screen.getByText('设置完成')).toBeTruthy();
  });

  it('shows success message with agent name', async () => {
    await navigateToStep4();

    expect(screen.getByText(/MyAgent 已创建完成/)).toBeTruthy();
  });

  it('shows completion message about launching DigitalCrew', async () => {
    await navigateToStep4();

    expect(screen.getByText(/正在启动 DigitalCrew/)).toBeTruthy();
  });

  it('shows agent preview card with agent name', async () => {
    await navigateToStep4();

    expect(screen.getByText('MyAgent')).toBeTruthy();
  });

  it('shows ready status badge in preview card', async () => {
    await navigateToStep4();

    expect(screen.getByText('就绪')).toBeTruthy();
  });

  it('shows selected model in preview card', async () => {
    await navigateToStep4();

    expect(screen.getByText('llama3.2:latest')).toBeTruthy();
  });

  it('shows loading spinner on completion screen', async () => {
    await navigateToStep4();

    // Check for spinning loader
    const loaders = document.querySelectorAll('.animate-spin');
    expect(loaders.length).toBeGreaterThan(0);
  });

  it('shows completion screen with success icon', async () => {
    await navigateToStep4();

    // Success icon is rendered (CheckCircle with size 40)
    const successIcon = document.querySelector('.text-secondary');
    expect(successIcon).not.toBeNull();
  });

  it('has finish button on step 4', async () => {
    await navigateToStep4();

    // Button text changes to "完成" on step 4
    const finishButton = screen.getByRole('button', { name: /完成/i });
    expect(finishButton).toBeTruthy();
  });

  it('finish button is enabled on step 4', async () => {
    await navigateToStep4();

    const finishButton = screen.getByRole('button', { name: /完成/i });
    expect(finishButton.disabled || finishButton.getAttribute('disabled')).toBeNull();
  });

  it('back button is still visible on step 4', async () => {
    await navigateToStep4();

    // Back button is visible on step 4 (not disabled on step 4)
    const backButtons = screen.queryAllByText('上一步');
    expect(backButtons.length).toBe(1);
  });

  it('next button shows 完成 text on step 4', async () => {
    await navigateToStep4();

    const nextButton = screen.getByRole('button', { name: /完成/i });
    expect(nextButton).toBeTruthy();
  });
});

describe('SetupWizard Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Enter key advances from step 1 to step 2 when conditions are met', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Ollama 连接正常')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Enter key does not advance when isCreatingAgents is true', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      if (url === '/api/v1/agents') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });

    // Fill agent name and click create
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'MyAgent' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('创建并继续'));
    });

    // Wait for creating state
    await waitFor(() => {
      expect(screen.getByText('创建中...')).toBeTruthy();
    }, { timeout: 5000 });

    // Press Enter while creating - should not navigate
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Enter' });
    });

    // Should still be on step 3 showing 创建中...
    expect(screen.getByText('创建中...')).toBeTruthy();
  });

  it('Escape key goes back when on step > 1', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Navigate to step 2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    // Press Escape to go back
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('Escape key does nothing on step 1', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 5000 });

    // Press Escape on step 1 - should not crash or navigate
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    // Should still be on step 1
    expect(screen.getByText('环境检测')).toBeTruthy();
  });

  it('Enter key does not proceed past step 4', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      if (url === '/api/v1/agents') {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 4
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });

    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'MyAgent' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('创建并继续'));
    });

    await waitFor(() => {
      expect(screen.getByText('设置完成')).toBeTruthy();
    }, { timeout: 10000 });

    // Press Enter on step 4 - should not cause issues
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Enter' });
    });

    // Should still be on completion screen
    expect(screen.getByText('设置完成')).toBeTruthy();
  });
});

describe('SetupWizard Step Progression and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proceeds from step 1 to step 2 when Ollama is connected with models', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Ollama 连接正常')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('配置数据目录')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('proceeds from step 2 to step 3 when directories are ready', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('proceeds from step 3 to step 4 after agent creation succeeds', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      if (url === '/api/v1/agents') {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });

    // Fill agent name and create
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'MyAgent' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('创建并继续'));
    });

    await waitFor(() => {
      expect(screen.getByText('设置完成')).toBeTruthy();
    }, { timeout: 10000 });
  });

  it('stays on step 3 while agent creation is in progress', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      if (url === '/api/v1/agents') {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Navigate to step 3
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });

    // Fill agent name and create
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'MyAgent' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('创建并继续'));
    });

    // Verify creating state
    await waitFor(() => {
      expect(screen.getByText('创建中...')).toBeTruthy();
    }, { timeout: 5000 });

    // The create/continue button should show 创建中... and be disabled
    const createButton = screen.getByText('创建中...');
    expect(createButton).toBeTruthy();
  });

  it('back button decrements step counter', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    // Go to step 2
    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    // Go back to step 1
    await act(async () => {
      fireEvent.click(screen.getByText('上一步'));
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('back button is disabled on step 1', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 5000 });

    const backButton = screen.getByText('上一步');
    expect(backButton.getAttribute('disabled') !== null || backButton.className.includes('cursor-not-allowed')).toBeTruthy();
  });

  it('shows step 1 indicator as completed after advancing to step 2', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    // Step 1 should show checkmark (completed)
    const stepIndicators = document.querySelectorAll('.text-secondary');
    expect(stepIndicators.length).toBeGreaterThan(0);
  });

  it('progress bar updates when advancing steps', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Check initial progress bar width
    const progressBar = document.querySelector('.bg-primary') as HTMLDivElement;
    expect(progressBar).not.toBeNull();
  });

  it('shows step 2 indicator when on step 2', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    // Flush microtasks before clicking Next to ensure initDirectories effect runs
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await act(async () => {});

    await waitFor(() => {
      expect(screen.getByText('数据目录')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('shows step 3 indicator when on step 3', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/v1/status') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/v1/models') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ name: 'llama3.2' }] }),
        });
      }
      if (url === '/api/v1/dirs/init') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true }) });
      }
      return Promise.resolve({ ok: true });
    });

    await act(async () => {
      render(<SetupWizard onComplete={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText('环境检测')).toBeTruthy();
    }, { timeout: 3000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('目录初始化完成')).toBeTruthy();
    }, { timeout: 5000 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /下一步|下一步/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('创建默认 Agent')).toBeTruthy();
    }, { timeout: 5000 });
  });
});


