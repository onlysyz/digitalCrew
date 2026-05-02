import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentModal from '../components/modals/AgentModal';
import React from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = (props: Record<string, unknown>) => React.createElement('span', { ...props, 'data-testid': 'mock-icon' });
  return {
    X: MockIcon,
    DatabaseZap: MockIcon,
    Box: MockIcon,
    Loader2: MockIcon,
  };
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AgentModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    models: ['llama3.2:latest', 'codellama:13b', 'mistral:7b'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Open/Close States', () => {
    it('renders modal content when isOpen is true', () => {
      render(<AgentModal {...defaultProps} isOpen={true} />);
      expect(screen.getByText('创建新代理')).toBeTruthy();
    });

    it('does not render modal when isOpen is false', () => {
      render(<AgentModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('创建新代理')).toBeNull();
    });

    it('renders backdrop overlay when open', () => {
      render(<AgentModal {...defaultProps} />);
      const overlay = document.querySelector('.bg-black\\/60');
      expect(overlay).toBeTruthy();
    });

    it('renders modal in center with fixed positioning', () => {
      render(<AgentModal {...defaultProps} />);
      const modal = document.querySelector('.fixed.inset-0');
      expect(modal).toBeTruthy();
    });

    it('renders close button (X icon)', () => {
      render(<AgentModal {...defaultProps} />);
      const closeBtn = screen.getAllByTestId('mock-icon')[0];
      expect(closeBtn).toBeTruthy();
    });

    it('calls onClose when backdrop is clicked', () => {
      render(<AgentModal {...defaultProps} />);
      const overlay = document.querySelector('.bg-black\\/60');
      if (overlay) {
        fireEvent.click(overlay);
      }
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('renders all form fields when open', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('代理名称')).toBeTruthy();
      expect(screen.getByText('代理角色')).toBeTruthy();
      expect(screen.getByText('对话模型')).toBeTruthy();
      expect(screen.getByText('描述')).toBeTruthy();
      expect(screen.getByText('系统指令')).toBeTruthy();
      expect(screen.getByText('工具权限')).toBeTruthy();
    });

    it('renders model options when open', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('llama3.2:latest')).toBeTruthy();
      expect(screen.getByText('codellama:13b')).toBeTruthy();
    });

    it('renders with z-50 z-index for proper layering', () => {
      render(<AgentModal {...defaultProps} />);
      const modal = document.querySelector('.z-50');
      expect(modal).toBeTruthy();
    });

    it('renders backdrop with blur effect', () => {
      render(<AgentModal {...defaultProps} />);
      const backdrop = document.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeTruthy();
    });

    it('renders submit and cancel buttons in footer', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('取消')).toBeTruthy();
      expect(screen.getByText('创建代理')).toBeTruthy();
    });
  });

  describe('Close and Cancel Interactions', () => {
    it('renders X close button in header', () => {
      render(<AgentModal {...defaultProps} />);
      const closeBtn = screen.getAllByTestId('mock-icon')[0];
      expect(closeBtn).toBeTruthy();
    });

    it('X close button is clickable', () => {
      render(<AgentModal {...defaultProps} />);
      const closeBtn = screen.getAllByTestId('mock-icon')[0];
      fireEvent.click(closeBtn);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', () => {
      render(<AgentModal {...defaultProps} />);
      const closeBtn = screen.getAllByTestId('mock-icon')[0];
      fireEvent.click(closeBtn);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('renders cancel button in footer', () => {
      render(<AgentModal {...defaultProps} />);
      const cancelBtn = screen.getByText('取消');
      expect(cancelBtn).toBeTruthy();
    });

    it('cancel button is clickable', () => {
      render(<AgentModal {...defaultProps} />);
      const cancelBtn = screen.getByText('取消');
      fireEvent.click(cancelBtn);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button is clicked', () => {
      render(<AgentModal {...defaultProps} />);
      const cancelBtn = screen.getByText('取消');
      fireEvent.click(cancelBtn);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop overlay is clicked', () => {
      render(<AgentModal {...defaultProps} />);
      const overlay = document.querySelector('.bg-black\\/60');
      if (overlay) {
        fireEvent.click(overlay);
      }
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('backdrop overlay is clickable', () => {
      render(<AgentModal {...defaultProps} />);
      const overlay = document.querySelector('.bg-black\\/60');
      if (overlay) {
        fireEvent.click(overlay);
      }
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('cancel button has correct styling classes', () => {
      render(<AgentModal {...defaultProps} />);
      const cancelBtn = screen.getByText('取消');
      expect(cancelBtn.className).toContain('border-white/10');
      expect(cancelBtn.className).toContain('rounded-lg');
    });

    it('does not call onSubmit when cancel is clicked', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AgentModal {...defaultProps} onSubmit={onSubmit} />);
      const cancelBtn = screen.getByText('取消');
      fireEvent.click(cancelBtn);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('can call onClose multiple times by clicking different close triggers', () => {
      render(<AgentModal {...defaultProps} />);
      const cancelBtn = screen.getByText('取消');
      const closeBtn = screen.getAllByTestId('mock-icon')[0];
      fireEvent.click(cancelBtn);
      fireEvent.click(closeBtn);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Name Input Field', () => {
    it('renders name input with placeholder', () => {
      render(<AgentModal {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      expect(nameInput).toBeTruthy();
    });

    it('renders name input with text type', () => {
      render(<AgentModal {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      expect(nameInput.getAttribute('type')).toBe('text');
    });

    it('accepts name input', () => {
      render(<AgentModal {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      expect((nameInput as HTMLInputElement).value).toBe('Test Agent');
    });


    it('shows required indicator (red asterisk)', () => {
      render(<AgentModal {...defaultProps} />);
      const requiredMark = screen.getByText('代理名称').parentElement?.querySelector('.text-red-400');
      expect(requiredMark?.textContent).toBe('*');
    });

    it('accepts Chinese name input', () => {
      render(<AgentModal {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Python开发助手' } });
      expect((nameInput as HTMLInputElement).value).toBe('Python开发助手');
    });

    it('clears name value when cleared by user', () => {
      render(<AgentModal {...defaultProps} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      expect((nameInput as HTMLInputElement).value).toBe('Test Agent');
      fireEvent.change(nameInput, { target: { value: '' } });
      expect((nameInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('Description Textarea Field', () => {
    it('renders description textarea with placeholder', () => {
      render(<AgentModal {...defaultProps} />);
      const descInput = screen.getByPlaceholderText('描述此代理的专长和能力...');
      expect(descInput).toBeTruthy();
    });

    it('renders description as textarea element', () => {
      render(<AgentModal {...defaultProps} />);
      const descInput = screen.getByPlaceholderText('描述此代理的专长和能力...');
      expect(descInput.tagName).toBe('TEXTAREA');
    });

    it('accepts description input', () => {
      render(<AgentModal {...defaultProps} />);
      const descInput = screen.getByPlaceholderText('描述此代理的专长和能力...');
      fireEvent.change(descInput, { target: { value: 'A test description' } });
      expect((descInput as HTMLTextAreaElement).value).toBe('A test description');
    });

    it('renders with 2 rows', () => {
      render(<AgentModal {...defaultProps} />);
      const descInput = screen.getByPlaceholderText('描述此代理的专长和能力...');
      expect(descInput.getAttribute('rows')).toBe('2');
    });

    it('accepts multiline description', () => {
      render(<AgentModal {...defaultProps} />);
      const descInput = screen.getByPlaceholderText('描述此代理的专长和能力...');
      fireEvent.change(descInput, { target: { value: 'Line 1\nLine 2\nLine 3' } });
      expect((descInput as HTMLTextAreaElement).value).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('System Prompt Field', () => {
    it('renders system prompt textarea with placeholder', () => {
      render(<AgentModal {...defaultProps} />);
      const promptInput = screen.getByPlaceholderText('为代理设定特定的行为和能力...');
      expect(promptInput).toBeTruthy();
    });

    it('accepts system prompt input', () => {
      render(<AgentModal {...defaultProps} />);
      const promptInput = screen.getByPlaceholderText('为代理设定特定的行为和能力...');
      fireEvent.change(promptInput, { target: { value: 'Be helpful' } });
      expect((promptInput as HTMLTextAreaElement).value).toBe('Be helpful');
    });

    it('shows character count starting at 0', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('0')).toBeTruthy();
    });

    it('shows character count for system prompt', () => {
      render(<AgentModal {...defaultProps} />);
      const promptInput = screen.getByPlaceholderText('为代理设定特定的行为和能力...');
      fireEvent.change(promptInput, { target: { value: 'Hi' } });
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('shows optional label', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('可选')).toBeTruthy();
    });
  });

  describe('Role Selection', () => {
    it('renders worker role selected by default', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('工作代理')).toBeTruthy();
    });

    it('renders both role options', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('工作代理')).toBeTruthy();
      expect(screen.getByText('主管代理')).toBeTruthy();
    });

    it('renders role descriptions', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('执行具体任务')).toBeTruthy();
      expect(screen.getByText('协调多代理工作')).toBeTruthy();
    });

    it('allows selecting supervisor role', () => {
      render(<AgentModal {...defaultProps} />);
      const supervisorBtn = screen.getByText('主管代理');
      fireEvent.click(supervisorBtn);
      expect(supervisorBtn).toBeTruthy();
    });

    it('allows switching back to worker role', () => {
      render(<AgentModal {...defaultProps} />);
      const supervisorBtn = screen.getByText('主管代理');
      fireEvent.click(supervisorBtn);
      const workerBtn = screen.getByText('工作代理');
      fireEvent.click(workerBtn);
      expect(workerBtn).toBeTruthy();
    });

    it('renders role buttons in a grid', () => {
      const { container } = render(<AgentModal {...defaultProps} />);
      const roleGrid = container.querySelector('.grid-cols-2');
      expect(roleGrid).toBeTruthy();
    });

    it('renders DatabaseZap icon for worker role', () => {
      render(<AgentModal {...defaultProps} />);
      const icons = screen.getAllByTestId('mock-icon');
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });

    it('renders Box icon for supervisor role', () => {
      render(<AgentModal {...defaultProps} />);
      const icons = screen.getAllByTestId('mock-icon');
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Model Selection', () => {
    it('renders model dropdown', () => {
      render(<AgentModal {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeTruthy();
    });

    it('renders model dropdown with default option', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('选择模型')).toBeTruthy();
    });

    it('accepts model selection', () => {
      render(<AgentModal {...defaultProps} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
      expect((select as HTMLSelectElement).value).toBe('llama3.2:latest');
    });

    it('renders all available models as options', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('llama3.2:latest')).toBeTruthy();
      expect(screen.getByText('codellama:13b')).toBeTruthy();
      expect(screen.getByText('mistral:7b')).toBeTruthy();
    });

    it('selects different model options', () => {
      render(<AgentModal {...defaultProps} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'mistral:7b' } });
      expect((select as HTMLSelectElement).value).toBe('mistral:7b');
    });

    it('shows required indicator for model selection', () => {
      render(<AgentModal {...defaultProps} />);
      const label = screen.getByText('对话模型').parentElement;
      expect(label?.querySelector('.text-red-400')).toBeTruthy();
    });
  });

  describe('Tool Permissions', () => {
    it('renders tool permissions label', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('工具权限')).toBeTruthy();
    });

    it('renders all 5 tool options', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('文件读取')).toBeTruthy();
      expect(screen.getByText('文件写入')).toBeTruthy();
      expect(screen.getByText('Shell 命令')).toBeTruthy();
      expect(screen.getByText('网络搜索')).toBeTruthy();
      expect(screen.getByText('代码执行')).toBeTruthy();
    });

    it('renders tools in a 2-column grid', () => {
      const { container } = render(<AgentModal {...defaultProps} />);
      const grid = container.querySelector('.grid-cols-2');
      expect(grid).toBeTruthy();
    });

    it('renders all tools as buttons', () => {
      render(<AgentModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const toolButtons = buttons.filter(btn =>
        ['文件读取', '文件写入', 'Shell 命令', '网络搜索', '代码执行'].some(t => btn.textContent?.includes(t))
      );
      expect(toolButtons.length).toBe(5);
    });

    it('tools are unchecked by default', () => {
      render(<AgentModal {...defaultProps} />);
      const fileReadBtn = screen.getByText('文件读取');
      expect(fileReadBtn.className).not.toContain('secondary');
    });

    it('toggles file_read tool on click', () => {
      render(<AgentModal {...defaultProps} />);
      const fileReadBtn = screen.getByText('文件读取');
      fireEvent.click(fileReadBtn);
      expect(fileReadBtn.className).toContain('secondary');
    });

    it('toggles file_write tool on click', () => {
      render(<AgentModal {...defaultProps} />);
      const fileWriteBtn = screen.getByText('文件写入');
      fireEvent.click(fileWriteBtn);
      expect(fileWriteBtn.className).toContain('secondary');
    });

    it('toggles shell tool on click', () => {
      render(<AgentModal {...defaultProps} />);
      const shellBtn = screen.getByText('Shell 命令');
      fireEvent.click(shellBtn);
      expect(shellBtn.className).toContain('secondary');
    });

    it('toggles web_search tool on click', () => {
      render(<AgentModal {...defaultProps} />);
      const webSearchBtn = screen.getByText('网络搜索');
      fireEvent.click(webSearchBtn);
      expect(webSearchBtn.className).toContain('secondary');
    });

    it('toggles code_execution tool on click', () => {
      render(<AgentModal {...defaultProps} />);
      const codeExecBtn = screen.getByText('代码执行');
      fireEvent.click(codeExecBtn);
      expect(codeExecBtn.className).toContain('secondary');
    });

    it('can toggle tool off after enabling', () => {
      render(<AgentModal {...defaultProps} />);
      const fileReadBtn = screen.getByText('文件读取');
      fireEvent.click(fileReadBtn);
      expect(fileReadBtn.className).toContain('secondary');
      fireEvent.click(fileReadBtn);
      expect(fileReadBtn.className).not.toContain('secondary');
    });

    it('can enable multiple tools', () => {
      render(<AgentModal {...defaultProps} />);
      const fileReadBtn = screen.getByText('文件读取');
      const fileWriteBtn = screen.getByText('文件写入');
      fireEvent.click(fileReadBtn);
      fireEvent.click(fileWriteBtn);
      expect(fileReadBtn.className).toContain('secondary');
      expect(fileWriteBtn.className).toContain('secondary');
    });

    it('can enable all tools', () => {
      render(<AgentModal {...defaultProps} />);
      const tools = ['文件读取', '文件写入', 'Shell 命令', '网络搜索', '代码执行'];
      tools.forEach(tool => {
        fireEvent.click(screen.getByText(tool));
      });
      tools.forEach(tool => {
        const btn = screen.getByText(tool);
        expect(btn.className).toContain('secondary');
      });
    });

    it('tools render as toggle buttons with correct styling', () => {
      render(<AgentModal {...defaultProps} />);
      const fileReadBtn = screen.getByText('文件读取');
      expect(fileReadBtn.className).toContain('p-3');
      expect(fileReadBtn.className).toContain('rounded-lg');
      expect(fileReadBtn.className).toContain('border');
    });
  });

  describe('Form Submission and Validation', () => {
    it('renders cancel and submit buttons in footer', () => {
      render(<AgentModal {...defaultProps} />);
      expect(screen.getByText('取消')).toBeTruthy();
      expect(screen.getByText('创建代理')).toBeTruthy();
    });

    it('calls onClose when cancel button is clicked', () => {
      render(<AgentModal {...defaultProps} />);
      const cancelBtn = screen.getByText('取消');
      fireEvent.click(cancelBtn);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when X button is clicked', () => {
      render(<AgentModal {...defaultProps} />);
      const closeBtn = screen.getAllByTestId('mock-icon')[0];
      fireEvent.click(closeBtn);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onSubmit with complete form data when submitted', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AgentModal {...defaultProps} onSubmit={onSubmit} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
      const submitBtn = screen.getByText('创建代理');
      fireEvent.click(submitBtn);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Agent',
          model_name: 'llama3.2:latest',
        })
      );
    });

    it('submits with worker role by default', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AgentModal {...defaultProps} onSubmit={onSubmit} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
      const submitBtn = screen.getByText('创建代理');
      fireEvent.click(submitBtn);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'worker',
        })
      );
    });

    it('submits with supervisor role when selected', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AgentModal {...defaultProps} onSubmit={onSubmit} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
      const supervisorBtn = screen.getByText('主管代理');
      fireEvent.click(supervisorBtn);
      const submitBtn = screen.getByText('创建代理');
      fireEvent.click(submitBtn);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'supervisor',
        })
      );
    });

    it('submits with description when provided', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AgentModal {...defaultProps} onSubmit={onSubmit} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
      const descInput = screen.getByPlaceholderText('描述此代理的专长和能力...');
      fireEvent.change(descInput, { target: { value: 'Test description' } });
      const submitBtn = screen.getByText('创建代理');
      fireEvent.click(submitBtn);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test description',
        })
      );
    });

    it('submits with system prompt when provided', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AgentModal {...defaultProps} onSubmit={onSubmit} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
      const promptInput = screen.getByPlaceholderText('为代理设定特定的行为和能力...');
      fireEvent.change(promptInput, { target: { value: 'Be helpful and concise' } });
      const submitBtn = screen.getByText('创建代理');
      fireEvent.click(submitBtn);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          system_prompt: 'Be helpful and concise',
        })
      );
    });

    it('submits with enabled tool permissions', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AgentModal {...defaultProps} onSubmit={onSubmit} />);
      const nameInput = screen.getByPlaceholderText('例如：Python 开发助手');
      fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
      fireEvent.click(screen.getByText('文件读取'));
      fireEvent.click(screen.getByText('Shell 命令'));
      const submitBtn = screen.getByText('创建代理');
      fireEvent.click(submitBtn);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_permissions: expect.arrayContaining([
            expect.objectContaining({ tool_name: 'file_read', enabled: true }),
            expect.objectContaining({ tool_name: 'shell', enabled: true }),
          ]),
        })
      );
    });

    it('submit button has correct styling classes', () => {
      render(<AgentModal {...defaultProps} />);
      const submitBtn = screen.getByText('创建代理');
      expect(submitBtn.className).toContain('bg-primary');
      expect(submitBtn.className).toContain('text-on-primary');
      expect(submitBtn.className).toContain('flex-1');
    });

    it('cancel button has correct styling classes', () => {
      render(<AgentModal {...defaultProps} />);
      const cancelBtn = screen.getByText('取消');
      expect(cancelBtn.className).toContain('border-white/10');
      expect(cancelBtn.className).toContain('text-on-surface');
      expect(cancelBtn.className).toContain('flex-1');
    });
  });

  describe('Keyboard Interactions', () => {
    it('closes modal on Escape key', () => {
      render(<AgentModal {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
