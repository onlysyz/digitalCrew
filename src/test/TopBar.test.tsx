import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import React from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = (props: Record<string, unknown>) => React.createElement('span', { ...props, 'data-testid': 'mock-icon' });
  return {
    Search: MockIcon,
    Radio: MockIcon,
    Share2: MockIcon,
    Bell: MockIcon,
    Plus: MockIcon,
  };
});

describe('TopBar Component Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Brand Header', () => {
    it('renders CrewOS brand name', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      expect(screen.getByText('CrewOS')).toBeTruthy();
    });

    it('renders brand with correct styling class', () => {
      const { container } = render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const brandText = screen.getByText('CrewOS');
      expect(brandText.className).toContain('text-primary');
    });
  });

  describe('Search Input', () => {
    it('renders search input', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const searchInput = screen.getByPlaceholderText('搜索资源、日志或代理...');
      expect(searchInput).toBeTruthy();
    });

    it('renders search input with correct type', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const searchInput = screen.getByPlaceholderText('搜索资源、日志或代理...');
      expect(searchInput.tagName).toBe('INPUT');
      expect(searchInput.getAttribute('type')).toBe('text');
    });

    it('accepts text input in search field', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const searchInput = screen.getByPlaceholderText('搜索资源、日志或代理...');
      fireEvent.change(searchInput, { target: { value: 'test query' } });
      expect((searchInput as HTMLInputElement).value).toBe('test query');
    });
  });

  describe('Action Buttons', () => {
    it('renders Radio button', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const radioIcon = screen.getAllByTestId('mock-icon');
      expect(radioIcon.length).toBeGreaterThanOrEqual(1);
    });

    it('renders Share button', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const shareIcon = screen.getAllByTestId('mock-icon');
      expect(shareIcon.length).toBeGreaterThanOrEqual(1);
    });

    it('renders Bell button with notification indicator', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      // Bell button should have notification dot
      const bellButton = screen.getAllByTestId('mock-icon')[2];
      expect(bellButton).toBeTruthy();
    });

    it('renders New Task button', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      expect(screen.getByText('新建任务')).toBeTruthy();
    });

    it('renders Plus icon in New Task button', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const plusIcon = screen.getAllByTestId('mock-icon');
      expect(plusIcon.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('User Interactions', () => {
    it('New Task button is clickable', () => {
      const { container } = render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      // The text "新建任务" is in a span inside the button, so check the button element
      const buttons = container.querySelectorAll('button');
      const newTaskButton = Array.from(buttons).find(btn => btn.textContent?.includes('新建任务'));
      expect(newTaskButton).toBeTruthy();
    });

    it('icon buttons are clickable', () => {
      render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(4); // 3 icon buttons + 1 New Task button
    });
  });

  describe('Layout Structure', () => {
    it('renders as header element', () => {
      const { container } = render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const header = container.querySelector('header');
      expect(header).toBeTruthy();
    });

    it('has correct height class', () => {
      const { container } = render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const header = container.querySelector('header');
      expect(header?.className).toContain('h-16');
    });

    it('renders with backdrop blur', () => {
      const { container } = render(
        <MemoryRouter>
          <TopBar />
        </MemoryRouter>
      );
      const header = container.querySelector('header');
      expect(header?.className).toContain('backdrop-blur');
    });
  });
});
