import React from 'react';
import { Settings as SettingsIcon, Database, Edit, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AgentCardProps {
  name: string;
  role: string;
  status: 'running' | 'idle' | 'waiting';
  load: number;
  successRate: number;
  latency: string;
  icon: React.ElementType;
  primary?: boolean;
}

export default function AgentCard({ 
  name, 
  role, 
  status, 
  load, 
  successRate, 
  latency, 
  icon: Icon,
  primary = false
}: AgentCardProps) {
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
            {status === 'running' ? '运行中' : status === 'waiting' ? '等待中' : '空闲'}
          </span>
        </div>
      </div>

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
          )}>{successRate}%</span>
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
        <button className="flex-1 bg-transparent border border-white/10 text-outline hover:text-on-surface font-label text-[10px] tracking-widest uppercase py-2.5 rounded-lg hover:bg-white/5 hover:border-white/20 transition-all">
          <div className="flex items-center justify-center gap-2">
            <Edit size={14} /> <span>编辑配置</span>
          </div>
        </button>
        <button className={cn(
          "flex-1 font-label text-[10px] tracking-widest uppercase py-2.5 rounded-lg transition-all",
          primary 
            ? "bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40" 
            : "border border-white/10 text-outline hover:text-on-surface hover:bg-white/5"
        )}>
          <div className="flex items-center justify-center gap-2">
            <Database size={14} /> <span>访问记忆</span>
          </div>
        </button>
      </div>
    </div>
  );
}
