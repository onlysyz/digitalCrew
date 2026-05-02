import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AgentCard from '../components/dashboard/AgentCard';
import React from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = (props: Record<string, unknown>) => React.createElement('span', { ...props, 'data-testid': 'mock-icon' });
  return {
    Database: MockIcon,
    Edit: MockIcon,
    Box: MockIcon,
    Play: MockIcon,
    Pause: MockIcon,
    RotateCcw: MockIcon,
    Trash2: MockIcon,
  };
});

// Mock agentApi
vi.mock('../services/api', () => ({
  agentApi: {
    getStats: vi.fn().mockResolvedValue({ stats: null }),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AgentCard Component Rendering', () => {
  const defaultProps = {
    agentId: 'agent-1',
    name: 'Test Agent',
    role: 'supervisor',
    status: 'idle' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders agent name and role', () => {
      render(<AgentCard {...defaultProps} />);
      expect(screen.getByText('Test Agent')).toBeTruthy();
      expect(screen.getByText('supervisor')).toBeTruthy();
    });

    it('renders description when provided', () => {
      render(<AgentCard {...defaultProps} description="A test agent description" />);
      expect(screen.getByText('A test agent description')).toBeTruthy();
    });

    it('does not render description when not provided', () => {
      const { container } = render(<AgentCard {...defaultProps} />);
      expect(container.textContent).not.toContain('A test agent description');
    });

    it('renders with default Box icon when no icon prop', () => {
      render(<AgentCard {...defaultProps} />);
      const iconElements = screen.getAllByTestId('mock-icon');
      expect(iconElements.length).toBeGreaterThan(0);
    });

    it('renders with custom icon when provided', () => {
      const CustomIcon = (props: Record<string, unknown>) => React.createElement('span', { ...props, 'data-testid': 'custom-icon' });
      render(<AgentCard {...defaultProps} icon={CustomIcon} />);
      expect(screen.getByTestId('custom-icon')).toBeTruthy();
    });

    it('renders status badge with idle state', () => {
      render(<AgentCard {...defaultProps} status="idle" />);
      expect(screen.getByText('空闲')).toBeTruthy();
    });

    it('renders status badge with running state', () => {
      render(<AgentCard {...defaultProps} status="running" />);
      expect(screen.getByText('运行中')).toBeTruthy();
    });

    it('renders status badge with waiting state', () => {
      render(<AgentCard {...defaultProps} status="waiting" />);
      expect(screen.getByText('等待中')).toBeTruthy();
    });

    it('renders status badge with paused state', () => {
      render(<AgentCard {...defaultProps} status="paused" />);
      expect(screen.getByText('已暂停')).toBeTruthy();
    });
  });

  describe('Metrics Display', () => {
    it('displays tasks_completed from metrics', () => {
      const props = {
        ...defaultProps,
        metrics: { tasks_completed: 42, success_rate: 95, avg_latency_ms: 150 },
      };
      render(<AgentCard {...props} />);
      expect(screen.getByText('42')).toBeTruthy();
    });

    it('displays success rate from metrics', () => {
      const props = {
        ...defaultProps,
        metrics: { tasks_completed: 10, success_rate: 88, avg_latency_ms: 100 },
      };
      render(<AgentCard {...props} />);
      expect(screen.getByText('88%')).toBeTruthy();
    });

    it('displays latency from metrics', () => {
      const props = {
        ...defaultProps,
        metrics: { tasks_completed: 10, success_rate: 90, avg_latency_ms: 200 },
      };
      render(<AgentCard {...props} />);
      expect(screen.getByText('~200ms')).toBeTruthy();
    });

    it('shows -- when no metrics provided for tasks', () => {
      render(<AgentCard {...defaultProps} />);
      const dashElements = screen.getAllByText('--');
      expect(dashElements.length).toBeGreaterThan(0);
    });

    it('shows -- when success_rate is 0', () => {
      const props = {
        ...defaultProps,
        metrics: { tasks_completed: 0, success_rate: 0, avg_latency_ms: 0 },
      };
      render(<AgentCard {...props} />);
      expect(screen.getAllByText('--').length).toBeGreaterThan(0);
    });
  });

  describe('Action Buttons', () => {
    it('renders Edit Configuration button', () => {
      render(<AgentCard {...defaultProps} onEdit={vi.fn()} />);
      expect(screen.getByText('编辑配置')).toBeTruthy();
    });

    it('renders Access Memory button', () => {
      render(<AgentCard {...defaultProps} onMemory={vi.fn()} />);
      expect(screen.getByText('访问记忆')).toBeTruthy();
    });

    it('shows Play button when status is idle and onStart provided', () => {
      render(<AgentCard {...defaultProps} status="idle" onStart={vi.fn()} />);
      expect(screen.getByTitle('启动')).toBeTruthy();
    });

    it('hides Play button when status is running', () => {
      render(<AgentCard {...defaultProps} status="running" onStart={vi.fn()} />);
      expect(screen.queryByTitle('启动')).toBeNull();
    });

    it('shows Pause button when status is running and onPause provided', () => {
      render(<AgentCard {...defaultProps} status="running" onPause={vi.fn()} />);
      expect(screen.getByTitle('暂停')).toBeTruthy();
    });

    it('hides Pause button when status is idle', () => {
      render(<AgentCard {...defaultProps} status="idle" onPause={vi.fn()} />);
      expect(screen.queryByTitle('暂停')).toBeNull();
    });

    it('shows Resume button when status is paused and onResume provided', () => {
      render(<AgentCard {...defaultProps} status="paused" onResume={vi.fn()} />);
      expect(screen.getByTitle('恢复')).toBeTruthy();
    });

    it('hides Resume button when status is not paused', () => {
      render(<AgentCard {...defaultProps} status="idle" onResume={vi.fn()} />);
      expect(screen.queryByTitle('恢复')).toBeNull();
    });

    it('shows Delete button when onDelete provided', () => {
      render(<AgentCard {...defaultProps} onDelete={vi.fn()} />);
      expect(screen.getByTitle('删除')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('calls onStart with agentId when Play button clicked', () => {
      const onStart = vi.fn();
      render(<AgentCard {...defaultProps} status="idle" onStart={onStart} />);
      fireEvent.click(screen.getByTitle('启动'));
      expect(onStart).toHaveBeenCalledWith('agent-1');
    });

    it('calls onPause with agentId when Pause button clicked', () => {
      const onPause = vi.fn();
      render(<AgentCard {...defaultProps} status="running" onPause={onPause} />);
      fireEvent.click(screen.getByTitle('暂停'));
      expect(onPause).toHaveBeenCalledWith('agent-1');
    });

    it('calls onResume with agentId when Resume button clicked', () => {
      const onResume = vi.fn();
      render(<AgentCard {...defaultProps} status="paused" onResume={onResume} />);
      fireEvent.click(screen.getByTitle('恢复'));
      expect(onResume).toHaveBeenCalledWith('agent-1');
    });

    it('calls onDelete with agentId when Delete button clicked', () => {
      const onDelete = vi.fn();
      render(<AgentCard {...defaultProps} onDelete={onDelete} />);
      fireEvent.click(screen.getByTitle('删除'));
      expect(onDelete).toHaveBeenCalledWith('agent-1');
    });

    it('calls onEdit with agentId when Edit button clicked', () => {
      const onEdit = vi.fn();
      render(<AgentCard {...defaultProps} onEdit={onEdit} />);
      fireEvent.click(screen.getByText('编辑配置'));
      expect(onEdit).toHaveBeenCalledWith('agent-1');
    });

    it('calls onMemory with agentId when Memory button clicked', () => {
      const onMemory = vi.fn();
      render(<AgentCard {...defaultProps} onMemory={onMemory} />);
      fireEvent.click(screen.getByText('访问记忆'));
      expect(onMemory).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('Visual States', () => {
    it('renders with primary styling when primary prop is true', () => {
      const { container } = render(<AgentCard {...defaultProps} primary />);
      const card = container.querySelector('.glass-panel');
      expect(card?.className).toContain('border-primary/20');
    });

    it('renders without primary styling when primary prop is false', () => {
      const { container } = render(<AgentCard {...defaultProps} primary={false} />);
      const card = container.querySelector('.glass-panel');
      expect(card?.className).toContain('opacity-80');
    });

    it('renders idle status indicator without pulse animation', () => {
      const { container } = render(<AgentCard {...defaultProps} status="idle" />);
      const pulseElement = container.querySelector('.animate-pulse');
      expect(pulseElement).toBeNull();
    });

    it('renders running status indicator with pulse animation', () => {
      const { container } = render(<AgentCard {...defaultProps} status="running" />);
      const pulseElement = container.querySelector('.animate-pulse');
      expect(pulseElement).toBeTruthy();
    });
  });

  describe('Trend Chart', () => {
    it('renders trend chart bars', () => {
      const { container } = render(<AgentCard {...defaultProps} />);
      const bars = container.querySelectorAll('.bg-current');
      expect(bars.length).toBe(14);
    });
  });
});
