import React, { useEffect, useState } from 'react';
import { Database, Edit, Box, Play, Pause, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AgentStatus, AgentMetrics } from '../../types/api';
import { agentApi } from '../../services/api';

interface AgentCardProps {
  agentId: string;
  name: string;
  role: string;
  status: AgentStatus;
  description?: string;
  metrics?: AgentMetrics;
  icon?: React.ElementType;
  primary?: boolean;
  onStart?: (agentId: string) => void;
  onPause?: (agentId: string) => void;
  onResume?: (agentId: string) => void;
  onEdit?: (agentId: string) => void;
  onMemory?: (agentId: string) => void;
  onDelete?: (agentId: string) => void;
}

export default function AgentCard({
  agentId,
  name,
  role,
  status,
  description,
  metrics: passedMetrics,
  icon: Icon = Box,
  primary = false,
  onStart,
  onPause,
  onResume,
  onEdit,
  onMemory,
  onDelete,
}: AgentCardProps) {
  const [localMetrics, setLocalMetrics] = useState<AgentMetrics | null>(passedMetrics ?? null);

  useEffect(() => {
    if (passedMetrics) {
      setLocalMetrics(passedMetrics);
      return;
    }
    agentApi.getStats(agentId).then(res => setLocalMetrics(res.stats)).catch(() => {});
  }, [agentId, passedMetrics]);

  const statusLabel = status === 'running' ? '运行中' : status === 'waiting' ? '等待中' : status === 'paused' ? '已暂停' : '空闲';
  const load = localMetrics?.tasks_completed ?? 0;
  const successRate = localMetrics?.success_rate ?? 0;
  const latency = localMetrics?.avg_latency_ms ? `~${localMetrics.avg_latency_ms}ms` : '--';

  return (
    <div className={cn(
      "glass-panel rounded-2xl p-6 relative overflow-hidden group transition-all duration-400 flex flex-col h-full",
      primary ? "border-primary/20 active-glow" : "border-white/5 opacity-80 hover:opacity-100",
      "hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),0_0_30px_-5px_rgba(173,198,255,0.1)] hover:border-primary/20"
    )}>
      {/* Background glow */}
      <div className={cn(
        "absolute top-0 right-0 w-48 h-48 rounded-full blur-[40px] -mr-20 -mt-20 pointer-events-none transition-opacity opacity-30 group-hover:opacity-60",
        status === 'running' ? "bg-primary/20" : status === 'waiting' ? "bg-tertiary/20" : "bg-outline/10"
      )} />

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-lg bg-[#11192b] border flex items-center justify-center shadow-[inset_0_0_12px_rgba(255,255,255,0.02)]",
            primary ? "border-primary/20 text-primary" : "border-white/10 text-outline"
          )}>
            <Icon size={24} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-display text-[18px] text-on-surface leading-tight font-semibold tracking-tight">{name}</h2>
            <p className={cn(
              "font-mono text-[10px] uppercase tracking-widest mt-1",
              primary ? "text-primary/70" : "text-outline"
            )}>{role}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Control buttons */}
          {status === 'idle' && onStart && (
            <button
              onClick={() => onStart(agentId)}
              className="p-1.5 rounded-md bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
              title="启动"
            >
              <Play size={14} fill="currentColor" />
            </button>
          )}
          {status === 'running' && onPause && (
            <button
              onClick={() => onPause(agentId)}
              className="p-1.5 rounded-md bg-tertiary/10 border border-tertiary/20 text-tertiary hover:bg-tertiary/20 transition-colors"
              title="暂停"
            >
              <Pause size={14} fill="currentColor" />
            </button>
          )}
          {status === 'paused' && onResume && (
            <button
              onClick={() => onResume(agentId)}
              className="p-1.5 rounded-md bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20 transition-colors"
              title="恢复"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(agentId)}
              className="p-1.5 rounded-md bg-error/10 border border-error/20 text-error hover:bg-error/20 transition-colors"
              title="删除"
            >
              <Trash2 size={14} />
            </button>
          )}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border",
            status === 'running' ? "bg-primary/10 border-primary/20 text-primary" :
            status === 'waiting' ? "bg-tertiary/10 border-tertiary/20 text-tertiary" :
            "bg-white/5 border-white/10 text-outline"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              status === 'running' ? "bg-primary animate-pulse" :
              status === 'waiting' ? "bg-tertiary animate-pulse" :
              "bg-outline/50"
            )} />
            <span className="font-label text-[10px] uppercase tracking-widest">
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {description && (
        <p className="font-sans text-sm text-on-surface-variant mb-4 line-clamp-2 relative z-10">
          {description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
        <div className="bg-surface/40 border border-white/5 p-4 rounded-xl flex flex-col gap-1.5">
          <span className="font-label text-[10px] text-outline uppercase tracking-widest">今日处理量</span>
          <span className="font-mono text-[20px] text-on-surface font-semibold">{load}</span>
        </div>
        <div className="bg-surface/40 border border-white/5 p-4 rounded-xl flex flex-col gap-1.5">
          <span className="font-label text-[10px] text-outline uppercase tracking-widest">成功率</span>
          <span className={cn(
            "font-mono text-[20px] font-semibold",
            successRate > 95 ? "text-secondary" : successRate > 85 ? "text-tertiary" : "text-error"
          )}>{successRate > 0 ? `${successRate}%` : '--'}</span>
        </div>
      </div>

      <div className="bg-surface/40 border border-white/5 p-4 rounded-xl mb-6 relative z-10 flex-1">
        <div className="flex justify-between items-center mb-4">
          <span className="font-label text-[10px] text-outline uppercase tracking-widest">耗时趋势 (ms)</span>
          <span className="font-mono text-[11px] text-primary/80">{latency}</span>
        </div>

        <div className={cn(
          "flex items-end h-8 gap-1 opacity-80",
          status === 'running' ? "text-primary" : status === 'waiting' ? "text-tertiary" : "text-outline/30"
        )}>
          {[40, 45, 35, 50, 60, 40, 30, 45, 55, 35, 25, 40, 45, 50].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-current rounded-t-[2px] transition-all duration-300 hover:brightness-125"
              style={{ height: status === 'idle' ? '12%' : `${h}%` }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 relative z-10 mt-auto">
        <button
          onClick={() => onEdit?.(agentId)}
          className="flex-1 bg-transparent border border-white/10 text-outline hover:text-on-surface font-label text-[10px] tracking-widest uppercase py-2.5 rounded-lg hover:bg-white/5 hover:border-white/20 transition-all"
        >
          <div className="flex items-center justify-center gap-2">
            <Edit size={14} /> <span>编辑配置</span>
          </div>
        </button>
        <button
          onClick={() => onMemory?.(agentId)}
          className={cn(
            "flex-1 font-label text-[10px] tracking-widest uppercase py-2.5 rounded-lg transition-all",
            primary
              ? "bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40"
              : "border border-white/10 text-outline hover:text-on-surface hover:bg-white/5"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <Database size={14} /> <span>访问记忆</span>
          </div>
        </button>
      </div>
    </div>
  );
}
