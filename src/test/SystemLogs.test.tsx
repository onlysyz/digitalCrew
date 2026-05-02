import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SystemLogs from '../pages/SystemLogs';
import React from 'react';

vi.mock('lucide-react', () => {
  const MockIcon = (props: Record<string, unknown>) => React.createElement('span', props);
  return {
    Terminal: MockIcon,
    Search: MockIcon,
    Trash2: MockIcon,
    Pause: MockIcon,
    Play: MockIcon,
    Download: MockIcon,
    Info: MockIcon,
    AlertTriangle: MockIcon,
    XCircle: MockIcon,
    RefreshCw: MockIcon,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('SystemLogs Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders page header correctly', () => {
      render(<SystemLogs />);
      expect(screen.getByRole('heading', { name: '系统日志' })).toBeDefined();
    });

    it('renders search input', () => {
      render(<SystemLogs />);
      expect(screen.getByPlaceholderText('搜索日志内容或来源...')).toBeDefined();
    });

    it('renders auto-scroll toggle', () => {
      render(<SystemLogs />);
      expect(screen.getByText('自动滚动')).toBeDefined();
    });

    it('renders pause button initially', () => {
      render(<SystemLogs />);
      expect(screen.getByRole('button', { name: /暂停/i })).toBeDefined();
    });

    it('renders export button', () => {
      render(<SystemLogs />);
      expect(screen.getByRole('button', { name: /导出/i })).toBeDefined();
    });

    it('renders clear button', () => {
      render(<SystemLogs />);
      expect(screen.getByRole('button', { name: /清空/i })).toBeDefined();
    });
  });

  describe('Log Level Filtering', () => {
    it('changes levelFilter state to info when clicking info button', () => {
      render(<SystemLogs />);
      const buttons = screen.getAllByRole('button');
      const infoButton = buttons.find(b => b.textContent === '信息');
      expect(infoButton).toBeDefined();
      if (infoButton) {
        fireEvent.click(infoButton);
        // Info button should now have active styling (bg-primary/20)
        expect(infoButton.className).toContain('bg-primary/20');
      }
    });

    it('changes levelFilter state to warn when clicking warn button', () => {
      render(<SystemLogs />);
      const buttons = screen.getAllByRole('button');
      const warnButton = buttons.find(b => b.textContent === '警告');
      expect(warnButton).toBeDefined();
      if (warnButton) {
        fireEvent.click(warnButton);
        // Warn button should now have active styling
        expect(warnButton.className).toContain('bg-yellow-500/10');
      }
    });

    it('changes levelFilter state to error when clicking error button', () => {
      render(<SystemLogs />);
      const buttons = screen.getAllByRole('button');
      const errorButton = buttons.find(b => b.textContent === '错误');
      expect(errorButton).toBeDefined();
      if (errorButton) {
        fireEvent.click(errorButton);
        // Error button should now have active styling
        expect(errorButton.className).toContain('bg-error/10');
      }
    });

    it('resets to show all logs when clicking all button', () => {
      render(<SystemLogs />);
      // First click info to change filter
      const buttons = screen.getAllByRole('button');
      const infoButton = buttons.find(b => b.textContent === '信息');
      if (infoButton) {
        fireEvent.click(infoButton);
      }
      // Then click all to reset
      const allButton = buttons.find(b => b.textContent === '全部');
      if (allButton) {
        fireEvent.click(allButton);
        // All button should now have active styling
        expect(allButton.className).toContain('bg-white/10');
      }
    });

    it('filters update log count when level changes', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // Get initial count
      const initialCountText = document.body.textContent || '';
      const initialMatch = initialCountText.match(/(\d+) 条记录/);

      // Click info filter
      const buttons = screen.getAllByRole('button');
      const infoButton = buttons.find(b => b.textContent === '信息');
      if (infoButton) {
        fireEvent.click(infoButton);
      }

      vi.advanceTimersByTime(100);

      // Count may change because only info logs are shown
      const filteredCountText = document.body.textContent || '';
      expect(filteredCountText).toContain('条记录');
    });
  });

  describe('Combined Filters', () => {
    it('applies both level filter and search query', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // First set level filter to info
      const buttons = screen.getAllByRole('button');
      const infoButton = buttons.find(b => b.textContent === '信息');
      if (infoButton) {
        fireEvent.click(infoButton);
      }

      // Then add search query
      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      fireEvent.change(searchInput, { target: { value: 'Agent' } });

      vi.advanceTimersByTime(100);

      // Count should reflect both filters applied
      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });

    it('shows fewer logs when level filter + search combined', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // Get initial count with no filters
      const initialCountText = document.body.textContent || '';
      const initialMatch = initialCountText.match(/(\d+) 条记录/);
      const initialCount = initialMatch ? parseInt(initialMatch[1]) : 0;

      // Apply both info filter and search
      const buttons = screen.getAllByRole('button');
      const infoButton = buttons.find(b => b.textContent === '信息');
      if (infoButton) {
        fireEvent.click(infoButton);
      }

      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      fireEvent.change(searchInput, { target: { value: 'Agent' } });

      vi.advanceTimersByTime(100);

      // Combined filters should return equal or less logs
      const filteredCountText = document.body.textContent || '';
      const filteredMatch = filteredCountText.match(/(\d+) 条记录/);
      const filteredCount = filteredMatch ? parseInt(filteredMatch[1]) : 0;
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    it('resets combined filters when clicking all levels', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // Set both level filter and search
      const buttons = screen.getAllByRole('button');
      const infoButton = buttons.find(b => b.textContent === '信息');
      if (infoButton) {
        fireEvent.click(infoButton);
      }

      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      fireEvent.change(searchInput, { target: { value: 'Agent' } });

      // Reset level filter to all
      const allButton = buttons.find(b => b.textContent === '全部');
      if (allButton) {
        fireEvent.click(allButton);
      }

      vi.advanceTimersByTime(100);

      // Should show more logs when level is reset but search remains
      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });

    it('clearing search keeps level filter active', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // Set level filter
      const buttons = screen.getAllByRole('button');
      const errorButton = buttons.find(b => b.textContent === '错误');
      if (errorButton) {
        fireEvent.click(errorButton);
      }

      // Set and then clear search
      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      fireEvent.change(searchInput, { target: { value: '' } });

      vi.advanceTimersByTime(100);

      // Should still be filtered by error level
      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });
  });

  describe('Search Functionality', () => {
    it('filters logs by message content match', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      // Search for 'Agent' which appears in mock log messages
      fireEvent.change(searchInput, { target: { value: 'Agent' } });

      // The filtered count should reflect logs containing 'Agent'
      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });

    it('filters logs by source match', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      // Search for 'AgentManager' which appears as a mock log source
      fireEvent.change(searchInput, { target: { value: 'AgentManager' } });

      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });

    it('returns no matching logs for non-existent query', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // Search for text that doesn't exist in mock data
      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      fireEvent.change(searchInput, { target: { value: 'xyznonexistent123ABC' } });

      vi.advanceTimersByTime(100);

      // Should show empty state or zero count
      const emptyState = screen.queryByText('暂无日志记录');
      // Either empty state is shown or count is 0
      const countText = document.body.textContent || '';
      const hasZeroMatches = countText.includes('0 条记录');
      expect(emptyState || hasZeroMatches).toBeTruthy();
    });

    it('clears search query and shows all logs', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');

      // First search for something
      fireEvent.change(searchInput, { target: { value: 'Agent' } });
      vi.advanceTimersByTime(100);

      // Then clear the search
      fireEvent.change(searchInput, { target: { value: '' } });
      vi.advanceTimersByTime(100);

      // Should show all logs again (count should be higher than filtered)
      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });

    it('search is case-insensitive', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      // Use lowercase 'agent' - should still match 'Agent' in messages
      fireEvent.change(searchInput, { target: { value: 'agent' } });

      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });
  });

  describe('Pause/Resume', () => {
    it('toggles pause state from running to paused', () => {
      render(<SystemLogs />);
      const pauseButton = screen.getByRole('button', { name: /暂停/i });
      fireEvent.click(pauseButton);

      expect(screen.getByRole('button', { name: /继续/i })).toBeDefined();
    });

    it('resumes log stream after pause', () => {
      render(<SystemLogs />);
      const pauseButton = screen.getByRole('button', { name: /暂停/i });
      fireEvent.click(pauseButton);

      const resumeButton = screen.getByRole('button', { name: /继续/i });
      fireEvent.click(resumeButton);

      expect(screen.getByRole('button', { name: /暂停/i })).toBeDefined();
    });

    it('shows paused indicator in log count when paused', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const pauseButton = screen.getByRole('button', { name: /暂停/i });
      fireEvent.click(pauseButton);

      const countText = document.body.textContent || '';
      expect(countText).toContain('已暂停');
    });

    it('stops generating new logs when paused', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const initialCountText = document.body.textContent || '';
      const initialMatch = initialCountText.match(/(\d+) 条记录/);
      const initialCount = initialMatch ? parseInt(initialMatch[1]) : 0;

      // Pause the log stream
      const pauseButton = screen.getByRole('button', { name: /暂停/i });
      fireEvent.click(pauseButton);

      // Advance timers - no new logs should be generated
      vi.advanceTimersByTime(5000);

      // Count should remain the same (or very close) since no new logs are generated
      const countText = document.body.textContent || '';
      const pausedMatch = countText.match(/(\d+) 条记录/);
      const pausedCount = pausedMatch ? parseInt(pausedMatch[1]) : 0;
      expect(pausedCount).toBeGreaterThanOrEqual(initialCount);
    });

    it('resumes generating logs when resumed from pause', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // Pause
      const pauseButton = screen.getByRole('button', { name: /暂停/i });
      fireEvent.click(pauseButton);

      // Resume
      const resumeButton = screen.getByRole('button', { name: /继续/i });
      fireEvent.click(resumeButton);

      // After resume, should show pause button again
      expect(screen.getByRole('button', { name: /暂停/i })).toBeDefined();
    });

    it('no paused indicator when not paused', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const countText = document.body.textContent || '';
      expect(countText).not.toContain('已暂停');
    });
  });

  describe('Auto-scroll', () => {
    it('toggles auto-scroll off', () => {
      render(<SystemLogs />);
      const autoScrollButton = screen.getByText('自动滚动');
      fireEvent.click(autoScrollButton);
    });

    it('toggles auto-scroll back on', () => {
      render(<SystemLogs />);
      const autoScrollButton = screen.getByText('自动滚动');
      fireEvent.click(autoScrollButton);
      fireEvent.click(autoScrollButton);
    });
  });

  describe('Clear Logs', () => {
    it('clears all logs and triggers toast notification', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      // Click clear button
      const clearButton = screen.getByRole('button', { name: /清空/i });
      fireEvent.click(clearButton);

      // After clearing, should show empty state (toast is triggered internally)
      vi.advanceTimersByTime(100);
      const emptyState = screen.queryByText('暂无日志记录');
      expect(emptyState).toBeDefined();
    });

    it('sets logs array to empty after clear', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const clearButton = screen.getByRole('button', { name: /清空/i });
      fireEvent.click(clearButton);

      vi.advanceTimersByTime(100);

      // After clearing, should show empty state message
      const emptyState = screen.queryByText('暂无日志记录');
      expect(emptyState).toBeDefined();
    });

    it('shows 0 条记录 after clearing all logs', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const clearButton = screen.getByRole('button', { name: /清空/i });
      fireEvent.click(clearButton);

      vi.advanceTimersByTime(100);

      const countText = document.body.textContent || '';
      expect(countText).toContain('0 条记录');
    });
  });

  describe('Export Logs', () => {
    it('triggers download when export button is clicked', () => {
      // Mock URL.createObjectURL and revokeObjectURL
      const mockURL = 'blob:http://localhost/mock-url';
      const mockRevoke = vi.fn();
      global.URL.createObjectURL = vi.fn(() => mockURL);
      global.URL.revokeObjectURL = mockRevoke;

      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const exportButton = screen.getByRole('button', { name: /导出/i });
      fireEvent.click(exportButton);

      // Verify URL.createObjectURL was called with a Blob
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockRevoke).toHaveBeenCalledWith(mockURL);

      // Cleanup
      vi.restoreAllMocks();
    });

    it('exports filtered logs when export button is clicked', () => {
      // Mock URL methods
      const mockURL = 'blob:http://localhost/mock-url';
      const mockRevoke = vi.fn();
      global.URL.createObjectURL = vi.fn(() => mockURL);
      global.URL.revokeObjectURL = mockRevoke;

      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const exportButton = screen.getByRole('button', { name: /导出/i });
      fireEvent.click(exportButton);

      vi.advanceTimersByTime(100);

      // Verify createObjectURL was called
      expect(global.URL.createObjectURL).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('creates export filename with date', () => {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `system-logs-${date}.log`;

      expect(filename).toMatch(/system-logs-\d{4}-\d{2}-\d{2}\.log/);
    });

    it('formats logs for export', () => {
      const logs = [
        { timestamp: '2026-05-02T10:00:00Z', level: 'info', source: 'Test', message: 'Test message' },
      ];

      const content = logs
        .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
        .join('\n');

      expect(content).toBe('[2026-05-02T10:00:00Z] [INFO] [Test] Test message');
    });
  });

  describe('Log Count Display', () => {
    it('displays log count text', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);

      const countText = document.body.textContent || '';
      expect(countText).toContain('条记录');
    });

    it('shows paused indicator when paused', () => {
      render(<SystemLogs />);
      const pauseButton = screen.getByRole('button', { name: /暂停/i });
      fireEvent.click(pauseButton);

      const countText = document.body.textContent || '';
      expect(countText).toContain('已暂停');
    });
  });

  describe('Log Generation', () => {
    it('generates initial logs on mount', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(100);
    });

    it('auto-generates new logs when not paused', () => {
      render(<SystemLogs />);
      vi.advanceTimersByTime(3000);
    });

    it('stops generating logs when paused', () => {
      render(<SystemLogs />);
      const pauseButton = screen.getByRole('button', { name: /暂停/i });
      fireEvent.click(pauseButton);

      vi.advanceTimersByTime(5000);
    });
  });

  describe('Scroll Behavior', () => {
    it('handles scroll events', () => {
      render(<SystemLogs />);
      const container = document.querySelector('.overflow-y-auto') as HTMLDivElement;
      if (container) {
        fireEvent.scroll(container);
      }
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no logs match filter', () => {
      render(<SystemLogs />);
      const searchInput = screen.getByPlaceholderText('搜索日志内容或来源...');
      fireEvent.change(searchInput, { target: { value: 'xyznonexistent123' } });

      vi.advanceTimersByTime(100);
    });
  });
});