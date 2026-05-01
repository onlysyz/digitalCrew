import React from 'react';
import { Users, Cpu, HardDrive, UserPlus, Box, SearchCode, DatabaseZap } from 'lucide-react';
import AgentCard from '../components/dashboard/AgentCard';

export default function Overview() {
  return (
    <div className="max-w-[1440px] mx-auto p-8 pb-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-end mb-10">
        <div className="flex-1">
          <h1 className="font-display text-[36px] text-on-surface mb-2 tracking-tight font-bold">团队概览</h1>
          <p className="font-sans text-[15px] text-on-surface-variant/80">管理并监控您的本地执行代理团队。</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          {/* Summary Widget 1 */}
          <div className="glass-panel rounded-xl p-5 flex-1 sm:w-56 flex items-center gap-5 border-t border-t-white/10">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary relative shadow-[inset_0_0_12px_rgba(173,198,255,0.1)]">
              <Users size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">活跃代理</p>
              <p className="font-mono text-[24px] font-bold text-on-surface leading-none">4 <span className="text-outline/50 text-[14px] font-normal">/ 7</span></p>
            </div>
          </div>

          {/* Summary Widget 2 */}
          <div className="glass-panel rounded-xl p-5 flex-1 sm:w-72 flex flex-col justify-center gap-3 border-t border-t-white/10">
            <div className="flex justify-between items-center">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest flex items-center gap-2">
                <Cpu size={14} className="text-outline/70" /> 本地模型
              </span>
              <span className="font-mono text-[13px] text-primary font-medium">2 实例</span>
            </div>
            <div className="w-full h-px bg-white/5" />
            <div className="flex justify-between items-center">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest flex items-center gap-2">
                <HardDrive size={14} className="text-outline/70" /> 显存占用
              </span>
              <span className="font-mono text-[13px] text-tertiary font-medium">14.2 GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Agent Banner */}
      <button className="w-full glass-panel rounded-2xl p-8 border border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-500 group flex items-center justify-center gap-6">
        <div className="w-14 h-14 rounded-full bg-surface-container border border-white/5 flex items-center justify-center text-outline group-hover:text-primary group-hover:border-primary/30 group-hover:bg-primary/10 transition-all duration-500 relative">
          <UserPlus size={28} strokeWidth={1.5} />
        </div>
        <div className="text-left">
          <h3 className="font-display text-[20px] text-on-surface group-hover:text-primary transition-colors font-semibold tracking-tight">新增数字员工</h3>
          <p className="font-sans text-[14px] text-outline mt-1 text-on-surface-variant/60">配置新的本地代理或连接远程服务</p>
        </div>
      </button>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AgentCard 
          name="主管代理 1号"
          role="Master Orchestrator"
          status="running"
          load={428}
          successRate={99.2}
          latency="~240ms"
          icon={Box}
          primary
        />
        <AgentCard 
          name="Python 开发"
          role="Code Specialist"
          status="idle"
          load={89}
          successRate={94.5}
          latency="~450ms"
          icon={SearchCode}
        />
        <AgentCard 
          name="数据挖掘"
          role="Deep Researcher"
          status="waiting"
          load={45}
          successRate={82.1}
          latency="~1200ms"
          icon={DatabaseZap}
        />
      </div>
    </div>
  );
}
