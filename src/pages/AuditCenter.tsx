import React, { useEffect, useState } from 'react';
import {
  Filter,
  Download,
  RotateCcw,
  Terminal,
  Database,
  History,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Play,
  Share2,
  Loader2,
  Clock,
  UserCheck,
  Pause,
  X,
  ExternalLink,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useTaskStore } from '../stores/taskStore';
import type { Task, TaskStatus } from '../types/api';

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: '待处理', color: 'text-outline', icon: Clock },
  assigned: { label: '已分配', color: 'text-tertiary', icon: UserCheck },
  running: { label: '运行中', color: 'text-primary', icon: Play },
  completed: { label: '已完成', color: 'text-secondary', icon: CheckCircle2 },
  failed: { label: '失败', color: 'text-error', icon: XCircle },
  cancelled: { label: '已取消', color: 'text-outline', icon: XCircle },
  paused: { label: '已暂停', color: 'text-tertiary', icon: Pause },
};

export default function AuditCenter() {
  const { tasks, fetchTasks, isLoading, cancelTask, retryTask } = useTaskStore();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskLogs, setTaskLogs] = useState<unknown[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [sortField, setSortField] = useState<'created_at' | 'status' | 'priority'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    // Initial fetch
    fetchTasks();

    // SSE connection for real-time task updates
    const eventSource = new EventSource('/api/v1/tasks/stream');
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'task_event') {
          // Always refresh on task events for real-time updates
          fetchTasks();
        }
      } catch {
        // Ignore parse errors
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
      // Fallback polling if SSE fails
      const fallbackInterval = setInterval(() => {
        fetchTasks();
      }, 10000);
      return () => clearInterval(fallbackInterval);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Collect unique agent IDs from tasks for filter dropdown
  const agentOptions = Array.from(
    new Set(tasks.flatMap(t => t.assigned_agents || []))
  ).map(id => ({ id, label: id.slice(0, 12) }));

  const filteredTasks = tasks.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesAgent = filterAgent === 'all' || (t.assigned_agents || []).includes(filterAgent);
    const taskDate = new Date(t.created_at);
    const matchesFrom = !dateFrom || taskDate >= new Date(dateFrom);
    const matchesTo = !dateTo || taskDate <= new Date(dateTo + 'T23:59:59');
    return matchesStatus && matchesAgent && matchesFrom && matchesTo;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
    else if (sortField === 'priority') cmp = (a.priority ?? 0) - (b.priority ?? 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: 'created_at' | 'status' | 'priority') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const runningTask = tasks.find(t => t.status === 'running' || t.status === 'assigned');
  const historicalTasks = tasks.filter(t =>
    t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
  );

  return (
    <div className="max-w-[1440px] mx-auto p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[32px] font-bold text-on-surface mb-2 tracking-tight">任务审计中心</h1>
          <p className="font-sans text-[14px] text-on-surface-variant/70">全局执行历史与工作流深度回放视图</p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="bg-surface-container border border-outline-variant/30 text-on-surface px-4 py-2 rounded-md font-label text-[12px] uppercase tracking-widest hover:border-primary/50 transition-colors flex items-center gap-2">
          <Filter size={16} /> 多维筛选 {showFilters ? '▲' : '▼'}
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary text-on-primary px-4 py-2 rounded-md font-label text-[12px] uppercase tracking-widest hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> 新建任务
        </button>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="bg-surface-container-high rounded-xl border border-white/5 p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-1.5">状态</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
              className="bg-surface border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-on-surface focus:border-primary/50 focus:outline-none"
            >
              <option value="all">全部</option>
              <option value="pending">待处理</option>
              <option value="assigned">已分配</option>
              <option value="running">运行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="cancelled">已取消</option>
              <option value="paused">已暂停</option>
            </select>
          </div>

          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-1.5">代理</label>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-surface border border-white/10 rounded-lg px-3 py-2 font-sans text-sm text-on-surface focus:border-primary/50 focus:outline-none"
            >
              <option value="all">全部代理</option>
              {agentOptions.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-1.5">开始日期</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-surface border border-white/10 rounded-lg px-3 py-2 font-mono text-sm text-on-surface focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-1.5">结束日期</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-surface border border-white/10 rounded-lg px-3 py-2 font-mono text-sm text-on-surface focus:border-primary/50 focus:outline-none"
            />
          </div>

          <button
            onClick={() => { setFilterStatus('all'); setFilterAgent('all'); setDateFrom(''); setDateTo(''); }}
            className="px-4 py-2 rounded-lg border border-white/10 text-outline font-label text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            重置
          </button>

          <span className="ml-auto font-mono text-[11px] text-outline self-center">
            共 {filteredTasks.length} 个任务
          </span>
        </div>
      )}

      {/* Main Active Task Card */}
      {runningTask ? (
        <div className="bg-surface-container-high rounded-xl border border-white/5 relative overflow-hidden flex flex-col shadow-2xl">
          <div className="p-6 border-b border-white/5 flex justify-between items-start relative z-10 bg-surface-container/50">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-sm bg-secondary-container/10 text-secondary border border-secondary/30 font-mono text-[11px] flex items-center gap-1.5 font-bold tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  执行中 ({runningTask.status.toUpperCase()})
                </span>
                <span className="font-mono text-[12px] text-outline px-2 py-0.5 rounded bg-surface/50 border border-white/5">{runningTask.id.slice(0, 12)}</span>
              </div>
              <h3 className="font-display text-[22px] text-on-surface mb-2 leading-tight font-bold">{runningTask.description}</h3>
              {runningTask.react_trace.length > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((runningTask.react_trace.length / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-primary shrink-0">
                    Step {runningTask.react_trace.length}
                  </span>
                </div>
              )}
              {runningTask.react_trace.length === 0 && runningTask.status === 'running' && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <span className="font-mono text-[11px] text-primary shrink-0">执行中...</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await cancelTask(runningTask.id);
                    toast.success('任务已取消');
                  } catch {
                    toast.error('取消任务失败');
                  }
                }}
                className="p-2.5 rounded-lg border border-outline-variant/30 text-outline hover:text-primary hover:border-primary transition-all bg-surface"
                title="取消任务"
              >
                <RotateCcw size={18} />
              </button>
              <button className="p-2.5 rounded-lg border border-outline-variant/30 text-outline hover:text-primary hover:border-primary transition-all bg-surface" title="导出执行拓扑">
                <Download size={18} />
              </button>
            </div>
          </div>

          {/* Topology Visualizer */}
          <div className="h-80 bg-[#060a14] relative overflow-hidden flex items-center justify-center p-8">
             <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #adc6ff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

             <div className="relative w-full max-w-2xl flex justify-between items-center z-10">
                {/* Coordinator */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-surface-container-highest border border-primary/30 flex items-center justify-center relative shadow-[0_0_20px_rgba(173,198,255,0.1)]">
                    <Play size={32} className="text-primary" strokeWidth={1.5} />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full border-4 border-[#060a14]" />
                  </div>
                  <div className="text-center font-mono text-[11px]">
                    <div className="text-on-surface font-bold">Orchestrator</div>
                    <div className="text-outline/60 mt-1 uppercase tracking-tight">Active</div>
                  </div>
                </div>

                {/* Workers column */}
                <div className="flex flex-col gap-12">
                  {runningTask.assigned_agents.slice(0, 2).map((agentId, i) => (
                    <div key={i} className="flex flex-col items-center gap-3">
                      <div className={cn(
                        "w-14 h-14 rounded-full border-2 flex items-center justify-center relative overflow-hidden bg-surface-container-highest",
                        i === 0 ? "border-secondary shadow-[0_0_15px_rgba(78,222,163,0.1)]" : "border-outline-variant/50"
                      )}>
                        <Database size={24} className={i === 0 ? "text-secondary" : "text-outline"} strokeWidth={1.5} />
                        {i === 0 && <div className="absolute bottom-0 w-full h-1 bg-secondary animate-pulse" />}
                      </div>
                      <div className="text-center font-mono text-[10px]">
                        <div className={i === 0 ? "text-secondary font-bold" : "text-outline/50"}>Worker {i + 1}</div>
                        <div className="text-outline/40 mt-1 uppercase text-[9px]">{i === 0 ? 'Processing' : 'Idle'}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Data Flow Indicator (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" style={{ zIndex: -1 }}>
                  <path d="M 80 160 C 200 160 250 80 320 80" stroke="currentColor" fill="none" strokeWidth="2" strokeDasharray="4 4" className="text-primary" />
                  <path d="M 80 160 C 200 160 250 240 320 240" stroke="currentColor" fill="none" strokeWidth="2" strokeDasharray="4 4" className="text-outline" />
                </svg>
             </div>
          </div>

          <div className="p-4 bg-surface-container/50 border-t border-white/5 flex justify-between items-center">
            {/* Progress Steps */}
            <div className="flex items-center gap-1">
              {['pending', 'assigned', 'running', 'completed'].map((step, i) => {
                const statusOrder = ['pending', 'assigned', 'running', 'completed'];
                const currentIdx = statusOrder.indexOf(runningTask.status);
                const stepIdx = statusOrder.indexOf(step);
                const stepStatus = stepIdx < currentIdx ? 'done' : stepIdx === currentIdx ? 'active' : 'idle';
                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold font-mono transition-all",
                        stepStatus === 'done' ? "bg-secondary border-secondary text-[#060a14]" :
                        stepStatus === 'active' ? "bg-primary border-primary text-[#060a14] animate-pulse" :
                        "bg-surface border-outline/30 text-outline"
                      )}>
                        {stepStatus === 'done' ? '✓' : i + 1}
                      </div>
                      <span className={cn(
                        "font-mono text-[9px] mt-1 uppercase tracking-wider",
                        stepStatus === 'done' ? 'text-secondary' :
                        stepStatus === 'active' ? 'text-primary' : 'text-outline/40'
                      )}>
                        {step === 'assigned' ? '已分配' : step === 'running' ? '执行中' : step === 'completed' ? '完成' : '待处理'}
                      </span>
                    </div>
                    {i < 3 && <div className={cn(
                      "w-12 h-0.5 mb-5 transition-all",
                      stepIdx < currentIdx ? 'bg-secondary' : 'bg-white/10'
                    )} />}
                  </React.Fragment>
                );
              })}
            </div>
            <button className="bg-primary-container/10 border border-primary/20 text-primary px-4 py-2 rounded-lg font-label text-[11px] uppercase tracking-widest hover:bg-primary-container/20 transition-all flex items-center gap-2">
              <Terminal size={14} /> 实时日志流
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-high rounded-xl border border-white/5 relative overflow-hidden flex flex-col shadow-2xl p-12 items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
            <Database size={32} className="text-outline" strokeWidth={1.5} />
          </div>
          <p className="font-display text-[18px] text-on-surface mb-2">当前无运行中的任务</p>
          <p className="font-sans text-[13px] text-on-surface-variant">前往聊天面板发起新任务</p>
        </div>
      )}

      {/* Historical Tasks Table */}
      <div className="bg-surface-container-high rounded-xl border border-white/5 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-surface-container-low/50">
          <h3 className="font-label text-[11px] font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
            <History size={16} className="text-primary/70" /> 全局任务审计档案库
          </h3>
          <div className="flex gap-2">
            <button className="text-outline hover:text-on-surface p-1.5 rounded bg-surface border border-white/5"><ChevronLeft size={16} /></button>
            <button className="text-outline hover:text-on-surface p-1.5 rounded bg-surface border border-white/5"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="flex justify-end mb-3">
          <div className="flex items-center gap-2">
            <span className="font-label text-[10px] text-outline uppercase tracking-widest">排序</span>
            <select
              value={`${sortField}-${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-') as ['created_at' | 'status' | 'priority', 'asc' | 'desc'];
                setSortField(field); setSortDir(dir);
              }}
              className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 font-sans text-[12px] text-on-surface focus:border-primary/50 focus:outline-none"
            >
              <option value="created_at-desc">最新优先</option>
              <option value="created_at-asc">最旧优先</option>
              <option value="status-asc">状态 ↑</option>
              <option value="status-desc">状态 ↓</option>
              <option value="priority-desc">优先级 高→低</option>
              <option value="priority-asc">优先级 低→高</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center p-12 text-on-surface-variant">
            <p className="font-sans text-sm">暂无任务记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-surface/30 font-label text-[10px] text-outline uppercase tracking-widest">
                  <th
                        className="py-4 px-6 font-bold cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort('created_at')}
                      >
                        <span className="flex items-center gap-1">
                          审计时间戳
                          {sortField === 'created_at' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                        </span>
                      </th>
                      <th
                        className="py-4 px-6 font-bold cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort('status')}
                      >
                        <span className="flex items-center gap-1">
                          运行状态
                          {sortField === 'status' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                        </span>
                      </th>
                      <th
                        className="py-4 px-6 font-bold cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort('priority')}
                      >
                        <span className="flex items-center gap-1">
                          资源消耗概览
                          {sortField === 'priority' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                        </span>
                      </th>
                  <th className="py-4 px-6 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans text-[13px]">
                {sortedTasks.map((task) => {
                  const config = statusConfig[task.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <tr key={task.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-4 px-6 font-mono text-[12px] text-outline">{task.id.slice(0, 12)}</td>
                      <td className="py-4 px-6 text-on-surface font-medium">{task.description}</td>
                      <td className="py-4 px-6">
                        <span className={cn(
                          "px-2.5 py-1 rounded-sm border font-mono text-[10px] flex items-center gap-1.5 w-fit font-bold tracking-wider",
                          task.status === 'completed' ? "bg-primary/5 text-primary border-primary/20" :
                          task.status === 'failed' ? "bg-error/5 text-error border-error/20" :
                          "bg-white/5 text-outline border-white/10"
                        )}>
                          <StatusIcon size={12} className={config.color} />
                          {config.label}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                          <span className="text-on-surface-variant">耗时: {task.timeout_seconds}s</span>
                          <span className="text-tertiary">优先级: {task.priority}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-[11px] text-outline/60">
                        {new Date(task.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-3 opacity-40 hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              try {
                                await retryTask(task.id);
                                toast.success('任务已重新加入队列');
                              } catch {
                                toast.error('重试任务失败');
                              }
                            }}
                            className="text-outline hover:text-primary"
                            title="重试任务"
                          ><RotateCcw size={18} /></button>
                          <button
                            onClick={async () => {
                              setSelectedTask(task);
                              setShowDetailModal(true);
                              setIsLoadingLogs(true);
                              try {
                                const res = await fetch(`/api/v1/tasks/${task.id}/logs`);
                                const data = await res.json();
                                setTaskLogs(data.logs || []);
                              } catch {
                                setTaskLogs([]);
                              } finally {
                                setIsLoadingLogs(false);
                              }
                            }}
                            className="text-outline hover:text-primary"
                            title="查看详情"
                          ><ExternalLink size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
          <div className="relative w-full max-w-lg bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="font-display text-xl font-bold text-on-surface">任务详情</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-outline hover:text-on-surface transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface border border-white/5 rounded-lg p-4">
                  <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">任务编号</p>
                  <p className="font-mono text-sm text-on-surface">{selectedTask.id}</p>
                </div>
                <div className="bg-surface border border-white/5 rounded-lg p-4">
                  <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">状态</p>
                  <span className={cn(
                    "px-2.5 py-1 rounded-sm border font-mono text-[10px] flex items-center gap-1.5 w-fit font-bold tracking-wider",
                    selectedTask.status === 'completed' ? "bg-primary/5 text-primary border-primary/20" :
                    selectedTask.status === 'failed' ? "bg-error/5 text-error border-error/20" :
                    "bg-white/5 text-outline border-white/10"
                  )}>
                    {statusConfig[selectedTask.status]?.label || selectedTask.status}
                  </span>
                </div>
              </div>

              <div className="bg-surface border border-white/5 rounded-lg p-4">
                <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">任务描述</p>
                <p className="font-sans text-sm text-on-surface">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface border border-white/5 rounded-lg p-4">
                  <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">优先级</p>
                  <p className="font-mono text-sm text-on-surface">{selectedTask.priority}</p>
                </div>
                <div className="bg-surface border border-white/5 rounded-lg p-4">
                  <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">超时设置</p>
                  <p className="font-mono text-sm text-on-surface">{selectedTask.timeout_seconds}s</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface border border-white/5 rounded-lg p-4">
                  <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">创建时间</p>
                  <p className="font-mono text-xs text-on-surface">{new Date(selectedTask.created_at).toLocaleString('zh-CN')}</p>
                </div>
                {selectedTask.started_at && (
                  <div className="bg-surface border border-white/5 rounded-lg p-4">
                    <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">开始时间</p>
                    <p className="font-mono text-xs text-on-surface">{new Date(selectedTask.started_at).toLocaleString('zh-CN')}</p>
                  </div>
                )}
              </div>

              {selectedTask.assigned_agents && selectedTask.assigned_agents.length > 0 && (
                <div className="bg-surface border border-white/5 rounded-lg p-4">
                  <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-2">分配的代理</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.assigned_agents.map((agentId, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-surface-container border border-white/5 font-mono text-[11px] text-outline">
                        {agentId.slice(0, 12)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-white/5">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-on-surface font-label text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                关闭
              </button>
              {(selectedTask.status === 'failed' || selectedTask.status === 'cancelled') && (
                <button
                  onClick={async () => {
                    try {
                      await retryTask(selectedTask.id);
                      toast.success('任务已重新加入队列');
                      setShowDetailModal(false);
                    } catch {
                      toast.error('重试任务失败');
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label text-[11px] uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} />
                  重试任务
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-lg bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="font-display text-xl font-bold text-on-surface">新建任务</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-outline hover:text-on-surface transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">
                  任务描述 <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="task-desc"
                  autoFocus
                  placeholder="描述需要执行的任务..."
                  rows={3}
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">执行模式</label>
                <select
                  id="task-mode"
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors"
                >
                  <option value="sequential">顺序执行</option>
                  <option value="parallel">并行执行</option>
                  <option value="hierarchical">层级协调</option>
                </select>
              </div>
              <div>
                <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">优先级</label>
                <select
                  id="task-priority"
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors"
                >
                  <option value="1">低</option>
                  <option value="2">普通</option>
                  <option value="3">高</option>
                  <option value="4">紧急</option>
                </select>
              </div>
              <div>
                <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">超时设置 (秒)</label>
                <input
                  id="task-timeout"
                  type="number"
                  defaultValue={300}
                  min={30}
                  max={3600}
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-mono text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">指定代理</label>
                <select
                  id="task-agent"
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors"
                >
                  <option value="">自动分配</option>
                  {agentOptions.map(a => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>

              {/* Task Logs Section */}
              <div className="bg-surface border border-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-label text-[10px] text-outline uppercase tracking-widest">执行日志</p>
                  {isLoadingLogs && <Loader2 size={14} className="animate-spin text-primary" />}
                </div>
                {taskLogs.length > 0 ? (
                  <div className="bg-[#060a14] rounded-lg p-3 font-mono text-[11px] text-on-surface/80 max-h-48 overflow-y-auto space-y-1">
                    {taskLogs.map((log: any, i: number) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-outline/50 shrink-0">{log.timestamp || ''}</span>
                        <span className={log.level === 'error' ? 'text-error' : log.level === 'warn' ? 'text-yellow-500' : 'text-primary/70'}>
                          [{log.level || 'info'}]
                        </span>
                        <span>{log.message || log.content || JSON.stringify(log)}</span>
                      </div>
                    ))}
                  </div>
                ) : !isLoadingLogs ? (
                  <p className="text-center text-outline py-4 font-sans text-[13px]">暂无日志</p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/5">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-on-surface font-label text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                取消
              </button>
              <button
                id="create-task-submit"
                onClick={async () => {
                  const desc = (document.getElementById('task-desc') as HTMLTextAreaElement).value.trim();
                  if (!desc) { toast.error('请输入任务描述'); return; }
                  const mode = (document.getElementById('task-mode') as HTMLSelectElement).value;
                  const priority = parseInt((document.getElementById('task-priority') as HTMLSelectElement).value);
                  const timeout = parseInt((document.getElementById('task-timeout') as HTMLInputElement).value) || 300;
                  const target_agent_id = (document.getElementById('task-agent') as HTMLSelectElement).value || undefined;
                  try {
                    await useTaskStore.getState().createTask({ description: desc, mode, priority, timeout_seconds: timeout, target_agent_id });
                    toast.success('任务已创建');
                    setShowCreateModal(false);
                  } catch {
                    toast.error('创建任务失败');
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label text-[11px] uppercase tracking-widest hover:bg-primary/90 transition-all"
              >
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
