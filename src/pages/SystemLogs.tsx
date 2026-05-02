import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Search, Trash2, Pause, Play, Download, Info, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

const LEVEL_CONFIG: Record<LogLevel, { icon: React.ElementType; color: string; label: string }> = {
  info: { icon: Info, color: 'text-primary', label: '信息' },
  warn: { icon: AlertTriangle, color: 'text-yellow-500', label: '警告' },
  error: { icon: XCircle, color: 'text-error', label: '错误' },
};

// Mock log generator for demo
const generateMockLog = (id: number): LogEntry => {
  const levels: LogLevel[] = ['info', 'info', 'info', 'warn', 'error'];
  const sources = ['AgentManager', 'TaskScheduler', 'Supervisor', 'ChatRouter', 'MemoryStore', 'ToolRegistry'];
  const messages = [
    'Agent heartbeat received from worker-1',
    'Task queue processed 12 tasks in 3.2s',
    'Supervisor assigned subtask to worker-2',
    'Slow response detected from Ollama (1.8s)',
    'Connection timeout to remote agent registry',
    'Memory buffer cleared: 128MB freed',
    'Tool permission validated for file_read',
    'New session created: sess_7f3a9b2c',
    'Embeddings computed in 234ms',
    'Agent E2E Complete Agent started',
    'Task ff1bc6d0-f1f4 completed successfully',
  ];
  return {
    id,
    timestamp: new Date(Date.now() - Math.random() * 300000).toISOString(),
    level: levels[Math.floor(Math.random() * levels.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
  };
};

export default function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  // Initialize with some mock logs
  useEffect(() => {
    const initial: LogEntry[] = [];
    for (let i = 0; i < 20; i++) {
      initial.push(generateMockLog(idCounter.current++));
    }
    setLogs(initial.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setIsLoading(false);
  }, []);

  // Auto-generate new logs
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const newLog = generateMockLog(idCounter.current++);
      setLogs(prev => {
        const updated = [newLog, ...prev];
        return updated.slice(0, 500); // Keep max 500 entries
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && !isPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const filteredLogs = logs.filter(log => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSearch = searchQuery === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const clearLogs = () => {
    setLogs([]);
    toast.success('日志已清空');
  };

  const exportLogs = () => {
    const content = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('日志已导出');
  };

  return (
    <div className="max-w-[1440px] mx-auto p-8 space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[32px] font-bold text-on-surface mb-2 tracking-tight">系统日志</h1>
          <p className="font-sans text-[14px] text-on-surface-variant/70">实时系统事件与调试输出</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPaused(p => !p)}
            className={cn(
              'px-4 py-2 rounded-lg border font-label text-[11px] uppercase tracking-widest transition-all flex items-center gap-2',
              isPaused ? 'border-primary/30 text-primary bg-primary/10 hover:bg-primary/20' : 'border-white/10 text-on-surface hover:bg-white/5'
            )}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            {isPaused ? '继续' : '暂停'}
          </button>
          <button
            onClick={exportLogs}
            className="px-4 py-2 rounded-lg border border-white/10 text-on-surface font-label text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2"
          >
            <Download size={14} /> 导出
          </button>
          <button
            onClick={clearLogs}
            className="px-4 py-2 rounded-lg border border-error/30 text-error font-label text-[11px] uppercase tracking-widest hover:bg-error/10 transition-all flex items-center gap-2"
          >
            <Trash2 size={14} /> 清空
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Level filters */}
        <div className="flex gap-1 bg-surface-container rounded-lg p-1 border border-white/5">
          {(['all', 'info', 'warn', 'error'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={cn(
                'px-3 py-1.5 rounded-md font-label text-[10px] uppercase tracking-widest transition-all',
                levelFilter === l
                  ? l === 'info' ? 'bg-primary/20 text-primary border border-primary/30' :
                    l === 'warn' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30' :
                    l === 'error' ? 'bg-error/10 text-error border border-error/30' :
                    'bg-white/10 text-on-surface border border-white/10'
                  : 'text-outline hover:text-on-surface'
              )}
            >
              {l === 'all' ? '全部' : LEVEL_CONFIG[l].label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索日志内容或来源..."
            className="w-full bg-surface border border-white/10 rounded-lg pl-9 pr-4 py-2 font-sans text-[13px] text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(s => !s)}
          className={cn(
            'px-3 py-2 rounded-lg border font-label text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5',
            autoScroll ? 'border-secondary/30 text-secondary bg-secondary/10' : 'border-white/10 text-outline'
          )}
        >
          <RefreshCw size={12} className={autoScroll ? 'animate-spin' : ''} />
          自动滚动
        </button>

        {/* Log count */}
        <span className="font-mono text-[11px] text-outline ml-auto">
          {filteredLogs.length} 条记录 {isPaused ? '(已暂停)' : ''}
        </span>
      </div>

      {/* Log Stream */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-[#060a14] rounded-xl border border-white/5 overflow-y-auto max-h-[calc(100vh-280px)] font-mono text-[12px]"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw size={20} className="animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-outline">
            <Terminal size={32} className="mb-3 opacity-50" />
            <p className="font-sans text-sm">暂无日志记录</p>
          </div>
        ) : (
          <div className="p-4 space-y-1">
            {filteredLogs.map((log) => {
              const config = LEVEL_CONFIG[log.level];
              const Icon = config.icon;
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 hover:bg-white/[0.02] px-3 py-2 rounded transition-colors group"
                >
                  <span className="text-outline/40 shrink-0 text-[10px] mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                  </span>
                  <Icon size={12} className={cn(config.color, 'shrink-0 mt-1')} />
                  <span className={cn(config.color, 'shrink-0 uppercase font-bold text-[10px] w-10')}>
                    {log.level}
                  </span>
                  <span className="text-secondary/70 shrink-0 text-[10px]">
                    [{log.source}]
                  </span>
                  <span className="text-on-surface/80 flex-1 break-all">
                    {log.message}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <Info size={12} className="text-primary" />
          <span className="text-outline">信息</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle size={12} className="text-yellow-500" />
          <span className="text-outline">警告</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle size={12} className="text-error" />
          <span className="text-outline">错误</span>
        </div>
        <span className="text-outline/40 ml-auto">最后更新: {new Date().toLocaleTimeString('zh-CN')}</span>
      </div>
    </div>
  );
}