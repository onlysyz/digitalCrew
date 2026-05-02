import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Plus,
  BrainCircuit,
  Zap,
  ChevronDown,
  LayoutDashboard,
  FileUp,
  Terminal,
  Bot,
  Users,
  Loader2,
  X,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useChatStore } from '../stores/chatStore';
import { useAgentStore } from '../stores/agentStore';
import type { ChatMessage, ReActStep, ExecutionPlan } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7700/api/v1';

type ChatMode = 'single' | 'team';

interface StreamEvent {
  type: 'message' | 'status' | 'task_created' | 'subtask_start' | 'subtask_complete' | 'subtask_error' | 'subtask_token' | 'result' | 'error' | 'done' | 'agents_assigned' | 'react_step' | 'cancelled';
  content?: string;
  task_id?: string;
  subtask_id?: string;
  agent_id?: string;
  agent_name?: string;
  output?: string;
  agents?: Array<{ id: string; name: string; role: string }>;
  token?: string;
  step?: {
    step_id: number;
    agent_id: string;
    thought: string;
    action: string;
    observation?: string;
  };
}

interface AssignedAgent {
  id: string;
  name: string;
  role: string;
  status: 'pending' | 'working' | 'completed' | 'error';
  streamingContent?: string;
}

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('team');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null);
  const [reactSteps, setReactSteps] = useState<ReActStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [assignedAgents, setAssignedAgents] = useState<AssignedAgent[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, isSending, sendMessage, sendTeamMessage, setCurrentSession, currentSessionId } = useChatStore();
  const { agents, fetchAgents } = useAgentStore();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming && currentTaskId && !isCancelling) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, currentTaskId, isCancelling]);

  useEffect(() => {
    // Detect @ mentions in input for agent suggestions
    const mentionMatch = input.match(/@(\w*)$/);
    if (mentionMatch) {
      // Could trigger agent suggestion dropdown here
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0 || isSending || isStreaming) return;

    // Read file contents if attached
    let fileContext = '';
    if (attachedFiles.length > 0) {
      const fileContents = await Promise.all(
        attachedFiles.map(async (f) => {
          const text = await f.text();
          return `[文件: ${f.name}]\n${text}\n[/文件: ${f.name}]`;
        })
      );
      fileContext = fileContents.join('\n\n');
      setAttachedFiles([]);
    }

    const filePart = fileContext ? `\n\n${fileContext}` : '';
    const userMessage = (input.trim() + filePart).trim();
    setInput('');
    setExecutionPlan(null);
    setReactSteps([]);
    setStatusMessage('');
    setAssignedAgents([]);

    if (chatMode === 'team') {
      toast.success('任务已提交，请等待处理结果');
      // Always use streaming for team mode to get real-time progress
      await handleTeamStream(userMessage);
    } else {
      await sendMessage(userMessage, selectedAgentId || undefined);
      toast.success('消息已发送');
    }
  };

  const handleTeamStream = async (message: string) => {
    setIsStreaming(true);
    const sessionId = currentSessionId || crypto.randomUUID();
    setCurrentSession(sessionId, false);

    // Add user message to store
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      metadata: {},
    };
    useChatStore.setState((state) => ({
      messages: [...state.messages, userMsg],
    }));

    // We'll append messages as they come
    const responseText = { current: '' };

    try {
      const response = await fetch(`${API_BASE_URL}/chat/team/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: sessionId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));
              await handleStreamEvent(event, responseText);
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStreamEvent = async (event: StreamEvent, responseText: { current: string }) => {
    switch (event.type) {
      case 'status':
        setStatusMessage(event.content || '处理中...');
        break;
      case 'message':
        // User message echoed back - already added
        break;
      case 'agents_assigned':
        if (event.agents) {
          setAssignedAgents(event.agents.map(a => ({
            ...a,
            status: 'pending' as const
          })));
        }
        break;
      case 'task_created':
        if (event.task_id) {
          setCurrentTaskId(event.task_id);
        }
        setExecutionPlan({
          steps: [{ agent: '初始化', task: '任务已创建', status: 'pending' }],
        });
        break;
      case 'subtask_start':
        if (event.agent_id && event.agent_name) {
          setAssignedAgents(prev =>
            prev.map(a =>
              a.id === event.agent_id ? { ...a, status: 'working' as const } : a
            )
          );
          setStatusMessage(`${event.agent_name} 正在工作...`);
        }
        break;
      case 'subtask_complete':
        // Update agent status to completed
        if (event.agent_id) {
          setAssignedAgents(prev =>
            prev.map(a =>
              a.id === event.agent_id ? { ...a, status: 'completed' as const } : a
            )
          );
        }
        if (event.subtask_id && event.output) {
          setExecutionPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: [
                ...prev.steps,
                { agent: event.subtask_id!, task: event.output!, status: 'completed' as const },
              ],
            };
          });
        }
        break;
      case 'subtask_error':
        if (event.agent_id) {
          setAssignedAgents(prev =>
            prev.map(a =>
              a.id === event.agent_id ? { ...a, status: 'error' as const } : a
            )
          );
        }
        break;
      case 'subtask_token':
        // Incrementally accumulate streaming tokens for display
        if (event.token) {
          setAssignedAgents(prev => prev.map(a => {
            if (a.id === event.agent_id || a.status === 'working') {
              return { ...a, streamingContent: (a.streamingContent || '') + event.token };
            }
            return a;
          }));
          // Also update responseText for final message
          responseText.current += event.token;
        }
        break;
      case 'result':
        responseText.current = event.content || '';
        break;
      case 'error':
        responseText.current = event.content || 'An error occurred';
        break;
      case 'done':
        // Add the final assistant message
        if (responseText.current) {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: responseText.current,
            agent_id: null,
            timestamp: new Date().toISOString(),
            metadata: { is_streaming: false },
          };
          useChatStore.setState((state) => ({
            messages: [...state.messages, assistantMsg],
          }));
        }
        setStatusMessage('');
        setCurrentTaskId(null);
        setIsCancelling(false);
        break;
      case 'cancelled':
        toast.warning('任务已被取消');
        setStatusMessage('任务已被取消');
        setCurrentTaskId(null);
        setIsCancelling(false);
        break;
      case 'react_step':
        if (event.step) {
          setReactSteps(prev => [...prev, {
            step_id: event.step!.step_id,
            agent_id: event.step!.agent_id,
            thought: event.step!.thought,
            action: event.step!.action,
            action_input: {},
            observation: event.step!.observation || '',
            timestamp: new Date().toISOString(),
            token_input: 0,
            token_output: 0,
            duration_ms: 0,
          }]);
        }
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCancel = async () => {
    if (!currentTaskId) return;
    setIsCancelling(true);
    toast.info('正在取消任务...');
    try {
      await fetch(`${API_BASE_URL}/tasks/${currentTaskId}/cancel`, {
        method: 'POST',
      });
      setStatusMessage('正在取消任务...');
    } catch (err) {
      console.error('Cancel request failed:', err);
      setIsCancelling(false);
      toast.error('取消任务失败');
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files as FileList);
    handleFilesAdded(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files as FileList);
      handleFilesAdded(files);
    }
  };

  const handleFilesAdded = (files: File[]) => {
    const validFiles = files.filter(f => f.size < 10 * 1024 * 1024); // 10MB limit
    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const workerAgents = agents.filter((a) => a.role === 'worker');
  const supervisorAgents = agents.filter((a) => a.role === 'supervisor');

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat Stream Section */}
      <section className="flex-1 flex flex-col h-full bg-surface-lowest border-r border-outline-variant/10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-50" />

        {/* Mode Selector */}
        <div className="p-4 border-b border-outline-variant/10 relative z-10">
          <div className="flex items-center gap-2 bg-surface-container-lowest rounded-lg p-1">
            <button
              onClick={() => setChatMode('single')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md font-sans text-sm transition-all',
                chatMode === 'single'
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Bot size={16} />
              单Agent
            </button>
            <button
              onClick={() => setChatMode('team')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md font-sans text-sm transition-all',
                chatMode === 'team'
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Users size={16} />
              团队协作
            </button>
          </div>

          {/* Agent Selector for single mode */}
          {chatMode === 'single' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="font-sans text-sm text-on-surface-variant">选择Agent:</span>
              <select
                value={selectedAgentId || ''}
                onChange={(e) => setSelectedAgentId(e.target.value || null)}
                className="bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 font-sans text-sm text-on-surface"
              >
                <option value="">默认代理</option>
                {workerAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Messages Scroll Area */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 relative z-0"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary/50 flex items-center justify-center">
              <div className="bg-surface-container-highest rounded-xl p-8 text-center">
                <FileUp size={40} className="text-primary mx-auto mb-3" />
                <p className="font-display text-lg text-on-surface">松开以上传文件</p>
                <p className="font-sans text-sm text-on-surface-variant mt-1">文件将作为上下文附加到消息</p>
              </div>
            </div>
          )}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <BrainCircuit className="text-primary" size={32} />
              </div>
              <h3 className="font-display text-lg font-bold text-on-surface mb-2">
                {chatMode === 'team' ? '主管代理已就绪' : '开始对话'}
              </h3>
              <p className="font-sans text-sm text-on-surface-variant max-w-md">
                {chatMode === 'team'
                  ? '发送消息开始多代理协作任务，主管代理将分解任务并协调工作。'
                  : '选择一个Agent开始对话'}
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={msg.id || idx} className={cn('flex', msg.role === 'user' ? 'justify-end pr-4' : 'justify-start pl-4')}>
              <div className={cn('max-w-[85%]', msg.role === 'user' ? 'max-w-[70%]' : '')}>
                {msg.role === 'assistant' ? (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl rounded-tl-sm p-5 shadow-2xl backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />

                    <div className="flex items-center gap-3 mb-4 relative z-10">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                        <BrainCircuit className="text-primary" size={22} />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-[16px] font-bold text-primary tracking-wide">
                            {chatMode === 'team' ? '主管代理' : '助手'}
                          </span>
                          {chatMode === 'team' && (
                            <span className="font-label text-[10px] text-primary/70 border border-primary/30 px-1.5 py-0.5 rounded bg-primary/5">
                              ORCHESTRATOR
                            </span>
                          )}
                        </div>
                        <span className="font-sans text-[11px] text-primary/60">
                          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <p className="font-sans text-[15px] text-on-surface mb-5 relative z-10 whitespace-pre-wrap">
                      {msg.content}
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 relative z-10 mt-2">
                      <button
                        onClick={() => copyMessage(msg.id || String(idx), msg.content)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium text-outline hover:text-on-surface hover:bg-white/5 transition-all"
                        title="复制消息"
                      >
                        {copiedId === (msg.id || String(idx)) ? <Check size={12} className="text-secondary" /> : <Copy size={12} />}
                        {copiedId === (msg.id || String(idx)) ? '已复制' : '复制'}
                      </button>
                    </div>

                    {/* Status Message */}
                    {statusMessage && (
                      <div className="bg-surface-container/60 border border-primary/10 rounded-lg p-3 mb-5 relative z-10 flex items-center gap-2">
                        <Loader2 size={14} className="text-primary animate-spin" />
                        <span className="font-sans text-[12px] text-on-surface-variant">{statusMessage}</span>
                      </div>
                    )}

                    {/* Live Streaming Output */}
                    {assignedAgents.length > 0 && assignedAgents.some(a => a.streamingContent) && (
                      <div className="bg-surface-container/40 border border-primary/10 rounded-lg p-4 mb-5 relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                          <BrainCircuit size={14} className="text-primary" />
                          <h4 className="font-label text-primary/80 text-[11px] uppercase tracking-widest">实时输出</h4>
                        </div>
                        <div className="space-y-2">
                          {assignedAgents.filter(a => a.streamingContent).map((agent, idx) => {
                            const colors = ['text-primary', 'text-secondary', 'text-tertiary', 'text-[#8b5cf6]'];
                            const color = colors[idx % colors.length];
                            const isExpanded = expandedAgents.has(agent.id);
                            const shouldTruncate = agent.streamingContent && agent.streamingContent.length > 300;
                            const displayContent = shouldTruncate && !isExpanded
                              ? agent.streamingContent.slice(0, 300) + '...'
                              : agent.streamingContent;
                            return (
                            <div
                              key={agent.id}
                              className={cn(
                                'rounded-lg border relative overflow-hidden',
                                agent.status === 'completed' && 'bg-secondary/5 border-secondary/20',
                                agent.status === 'working' && 'bg-primary/5 border-primary/20',
                                agent.status === 'pending' && 'bg-white/5 border-white/10'
                              )}
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-secondary rounded-l" />
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedAgents(prev => {
                                    const next = new Set(prev);
                                    if (next.has(agent.id)) next.delete(agent.id);
                                    else next.add(agent.id);
                                    return next;
                                  })
                                }}
                                className="w-full flex items-center gap-2 p-3 hover:bg-white/5 transition-colors"
                              >
                                {agent.status === 'completed' && <CheckCircle2 size={12} className="text-secondary" />}
                                {agent.status === 'working' && <Loader2 size={12} className={cn(color, "animate-spin")} />}
                                <span className={cn("text-[11px] font-medium flex-1 text-left", color)}>{agent.name}</span>
                                {agent.status === 'working' && (
                                  <span className={cn("text-[10px]", color, "opacity-70")}>工作中...</span>
                                )}
                                {shouldTruncate && (
                                  <span className="text-[10px] text-outline ml-2">
                                    {isExpanded ? '收起' : `展开`}
                                  </span>
                                )}
                              </button>
                              <div className={cn("px-3 pb-3", isExpanded ? '' : 'max-h-32 overflow-hidden')}>
                                <div className="font-mono text-[11px] text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words pl-4">
                                  {displayContent}
                                </div>
                                {shouldTruncate && !isExpanded && (
                                  <div className="absolute bottom-0 left-4 right-4 h-8 bg-gradient-to-t from-surface-container/80 to-transparent" />
                                )}
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    )}

                    {/* Assigned Agents */}
                    {assignedAgents.length > 0 && (
                      <div className="bg-surface-container/60 border border-primary/10 rounded-lg p-4 mb-5 relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-label text-primary/80 text-[11px] flex items-center gap-2 uppercase tracking-widest">
                            <Users size={14} /> 参与的代理 ({assignedAgents.length})
                          </h4>
                          {(isStreaming || currentTaskId) && !isCancelling && (
                            <button
                              onClick={handleCancel}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                            >
                              <X size={12} /> 取消任务
                            </button>
                          )}
                          {isCancelling && (
                            <span className="text-[11px] text-outline">正在取消...</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {assignedAgents.map((agent) => (
                            <div
                              key={agent.id}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border',
                                agent.status === 'completed' && 'bg-secondary/10 border-secondary/30 text-secondary',
                                agent.status === 'working' && 'bg-primary/10 border-primary/30 text-primary animate-pulse',
                                agent.status === 'pending' && 'bg-white/5 border-white/10 text-outline',
                                agent.status === 'error' && 'bg-red-500/10 border-red-500/30 text-red-400'
                              )}
                            >
                              {agent.status === 'completed' && <CheckCircle2 size={12} />}
                              {agent.status === 'working' && <Loader2 size={12} className="animate-spin" />}
                              {agent.status === 'error' && <X size={12} />}
                              <span>{agent.name}</span>
                              {agent.status === 'working' && (
                                <span className="text-primary/60 text-[10px]">工作中...</span>
                              )}
                              {agent.status === 'pending' && (
                                <span className="text-outline/60 text-[10px]">等待中</span>
                              )}
                              {agent.status === 'completed' && (
                                <span className="text-secondary/60 text-[10px]">完成</span>
                              )}
                              {agent.streamingContent && (
                                <span className="text-primary/80 font-mono text-[10px] ml-1">{agent.streamingContent.slice(-200)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Execution Plan */}
                    {executionPlan && executionPlan.steps.length > 0 && (
                      <div className="bg-surface-container/60 border border-primary/10 rounded-lg p-4 mb-5 relative z-10">
                        <h4 className="font-label text-primary/80 text-[11px] mb-3 flex items-center gap-2 uppercase tracking-widest">
                          <Zap size={14} /> 执行计划
                        </h4>
                        <ul className="font-sans text-[13px] text-on-surface space-y-2">
                          {executionPlan.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <div className={cn('mt-1.5 w-1.5 h-1.5 rounded-full', step.status === 'completed' ? 'bg-secondary' : 'bg-tertiary')} />
                              <span>
                                分配给 <span className="text-tertiary font-medium bg-tertiary/10 px-1 rounded">{step.agent}</span> {step.task}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* ReAct Steps */}
                    {reactSteps.length > 0 && (
                      <div className="bg-[#0d1117] border border-outline-variant/30 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-white/2">
                          <div className="flex items-center gap-2">
                            <Terminal size={14} className="text-outline" />
                            <span className="font-mono text-[11px] text-outline font-medium uppercase tracking-wider">
                              ReAct 思考日志
                            </span>
                          </div>
                          <ChevronDown size={16} className="text-outline" />
                        </div>
                        <div className="p-4 border-t border-white/5 font-mono text-[12px] space-y-3 leading-relaxed text-on-surface-variant/80">
                          {reactSteps.map((step, i) => (
                            <div key={i}>
                              <div className="flex gap-2 mb-1">
                                <span className="text-tertiary font-bold">Thought:</span>
                                <span>{step.thought}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-primary font-bold">Action:</span>
                                <span className="text-blue-400">{step.action}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="max-w-[70%] bg-surface-container-highest border border-outline-variant/30 rounded-xl rounded-tr-sm p-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-display text-[14px] font-bold text-on-surface">您</span>
                      <span className="font-sans text-[11px] text-on-surface-variant/60">
                        {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-sans text-[15px] text-on-surface leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                    {msg.role === 'user' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => {
                            setInput(msg.content);
                            textareaRef.current?.focus();
                          }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium text-outline hover:text-on-surface hover:bg-white/5 transition-all"
                          title="重新编辑发送"
                        >
                          <RefreshCw size={12} />
                          重新编辑
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start pl-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl rounded-tl-sm p-5">
                <div className="flex items-center gap-3">
                  <Loader2 className="text-primary animate-spin" size={20} />
                  <span className="font-sans text-sm text-primary">处理中...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 bg-surface-container/80 backdrop-blur-md border-t border-outline-variant/10 relative z-10">
          {/* Attached files preview */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5">
                  <FileUp size={14} className="text-primary" />
                  <span className="font-sans text-xs text-on-surface truncate max-w-[120px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachedFile(idx)}
                    className="text-outline hover:text-on-surface transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2 focus-within:border-primary/50 transition-all">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-outline hover:text-primary rounded-lg hover:bg-white/5 transition-colors"
            >
              <Plus size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none font-sans text-sm text-on-surface placeholder-on-surface-variant/40 py-2.5 max-h-32 min-h-[40px] custom-scrollbar"
              placeholder={chatMode === 'team' ? '给主管代理发送指令...' : '输入消息...'}
              rows={1}
              disabled={isSending || isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() && attachedFiles.length === 0 || isSending || isStreaming}
              className="p-2.5 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3 px-2">
            <span className="font-label text-[10px] text-outline-variant uppercase tracking-widest">
              {chatMode === 'team'
                ? '提示：输入 @ 来提及特定代理参与协作'
                : '按 Enter 发送，Shift+Enter 换行'}
            </span>
            {attachedFiles.length === 0 && (
              <span className="font-label text-[10px] text-outline-variant uppercase tracking-widest">
                · 拖拽文件到消息区以上传
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Right Sidebar: Context Panel */}
      <aside className="w-80 bg-surface-container h-full flex flex-col border-l border-outline-variant/10 shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
        <div className="p-5 border-b border-outline-variant/10 bg-surface-lowest/30">
          <h3 className="font-label text-outline text-[11px] uppercase tracking-widest flex items-center gap-2 font-bold">
            <LayoutDashboard size={16} className="text-primary/70" /> 当前上下文
          </h3>
        </div>

        <div className="p-5 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Active Agents list */}
          <div>
            <h4 className="font-display font-semibold text-[13px] text-on-surface mb-4 flex items-center gap-2">
              {chatMode === 'team' ? '活跃代理' : '可用代理'}
            </h4>
            <div className="space-y-4">
              {chatMode === 'team' && supervisorAgents.length > 0 && (
                <div className="p-3 rounded-xl bg-surface-lowest border border-primary/30 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <BrainCircuit size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-[12px] text-on-surface truncate">
                        {supervisorAgents[0].name}
                      </p>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        主管
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(chatMode === 'team' ? workerAgents : agents).map((agent, i) => (
                <div
                  key={agent.id}
                  className={cn(
                    'p-3 rounded-xl bg-surface-lowest border border-outline-variant/30 shadow-sm relative overflow-hidden cursor-pointer hover:border-primary/30 transition-colors',
                    selectedAgentId === agent.id && chatMode === 'single' && 'border-primary/50 bg-primary/5'
                  )}
                  onClick={() => chatMode === 'single' && setSelectedAgentId(agent.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-tertiary/10 border border-tertiary/30 flex items-center justify-center">
                      <Zap size={18} className="text-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-[12px] text-on-surface truncate">{agent.name}</p>
                      <p className="font-sans text-[10px] text-on-surface-variant truncate">{agent.description || agent.role}</p>
                    </div>
                    {selectedAgentId === agent.id && chatMode === 'single' && (
                      <X size={14} className="text-primary" />
                    )}
                  </div>
                </div>
              ))}

              {agents.length === 0 && (
                <p className="font-sans text-sm text-on-surface-variant">暂无代理</p>
              )}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-semibold text-[13px] text-on-surface mb-4">关联资源</h4>
            <div
              className="border-2 border-outline-variant/20 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center bg-surface-lowest/50 hover:bg-surface-lowest transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileUp size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
              </div>
              <p className="font-display text-[12px] font-medium text-on-surface">拖拽文件至此</p>
              <p className="font-sans text-[10px] text-outline mt-1">或点击上传本地文件作为上下文</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
