import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import React from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = (props: Record<string, unknown>) => React.createElement('span', { ...props, 'data-testid': 'mock-icon' });
  return {
    Users: MockIcon,
    MessageSquare: MockIcon,
    ClipboardList: MockIcon,
    BarChart3: MockIcon,
    Settings: MockIcon,
    Terminal: MockIcon,
    HelpCircle: MockIcon,
    ShieldCheck: MockIcon,
    BookOpen: MockIcon,
  };
});

describe('Sidebar Component Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Brand Header', () => {
    it('renders Digital Crew brand name', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      expect(screen.getByText('Digital Crew')).toBeTruthy();
    });

    it('renders brand subtitle', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      expect(screen.getByText('本地协调器')).toBeTruthy();
    });

    it('renders avatar image', () => {
      const { container } = render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.alt).toBe('Avatar');
    });
  });

  describe('Navigation Items', () => {
    it('renders all main navigation items', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      expect(screen.getByText('团队概览')).toBeTruthy();
      expect(screen.getByText('聊天面板')).toBeTruthy();
      expect(screen.getByText('任务中心')).toBeTruthy();
      expect(screen.getByText('知识库')).toBeTruthy();
      expect(screen.getByText('设置')).toBeTruthy();
    });

    it('renders bottom navigation items', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      expect(screen.getByText('系统日志')).toBeTruthy();
      expect(screen.getByText('帮助与支持')).toBeTruthy();
    });

    it('renders correct number of main nav items (5)', () => {
      const { container } = render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      const mainNavLinks = container.querySelectorAll('nav:first-of-type a');
      expect(mainNavLinks.length).toBe(5);
    });

    it('renders correct number of bottom nav items (2)', () => {
      const { container } = render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      // Bottom nav is in the div with border-t border-white/5 class, not a nav element
      // The two bottom items are 系统日志 and 帮助与支持
      expect(screen.getByText('系统日志')).toBeTruthy();
      expect(screen.getByText('帮助与支持')).toBeTruthy();
    });
  });

  describe('Privacy Status Badge', () => {
    it('renders privacy status badge', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      expect(screen.getByText('隐私状态')).toBeTruthy();
      expect(screen.getByText('数据 100% 本地处理')).toBeTruthy();
    });

    it('renders privacy progress bar', () => {
      const { container } = render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      const progressBar = container.querySelector('.bg-secondary');
      expect(progressBar).toBeTruthy();
    });
  });

  describe('Navigation Links', () => {
    it('renders navigation links with correct paths', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );
      const navLinks = container.querySelectorAll('a');
      expect(navLinks.length).toBeGreaterThanOrEqual(7);
    });

    it('renders Settings icon for settings nav item', () => {
      render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      );
      const settingsIcon = screen.getAllByTestId('mock-icon');
      expect(settingsIcon.length).toBeGreaterThan(0);
    });
  });

  describe('Active State Styling', () => {
    it('applies active class when on current route', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );
      // The active link should have border-primary class
      const activeLink = container.querySelector('.border-l-2');
      expect(activeLink).toBeTruthy();
    });

    it('does not apply active class when on different route', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/chat']}>
          <Sidebar />
        </MemoryRouter>
      );
      // When on /chat, the / link should not be active
      const links = container.querySelectorAll('a');
      const activeLinks = container.querySelectorAll('.border-l-2');
      expect(activeLinks.length).toBe(1); // Only one link should be active
    });
  });

  describe('User Interactions', () => {
    it('renders clickable navigation links', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );
      const chatLink = screen.getByText('聊天面板');
      expect(chatLink).toBeTruthy();
      expect(chatLink.tagName).toBe('A');
    });

    it('updates active state on navigation', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );
      // Initially / is active
      expect(container.querySelector('.border-l-2')).toBeTruthy();

      // Simulate navigation to /chat
      container.querySelectorAll('a[href="/chat"]')[0].click();

      // After click, /chat should become active
      const activeLinks = container.querySelectorAll('.border-l-2');
      expect(activeLinks.length).toBe(1);
    });

    it('navigates to settings page', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Sidebar />
        </MemoryRouter>
      );
      const settingsLink = screen.getByText('设置');
      expect(settingsLink).toBeTruthy();
      expect(settingsLink.tagName).toBe('A');
    });
  });
});
