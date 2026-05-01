import React from 'react';
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
  Share2
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function AuditCenter() {
  const auditLogs = [
    { id: 'TSK-8923', desc: '核心业务数据库架构级优化方案评估', status: 'success', time: '1h 12m', tokens: '342.1k', date: '10-24 09:15:33' },
    { id: 'TSK-8922', desc: '第三季度全维度财务数据摘要自动化定稿', status: 'failed', time: '22m (终止)', tokens: '89.2k', date: '10-23 16:40:11', error: 'API 频次受限' },
    { id: 'TSK-8921', desc: '代码仓库全局安全漏洞每周例行扫描评估', status: 'success', time: '22m 10s', tokens: '12.4k', date: '10-23 02:00:00' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-[32px] font-bold text-on-surface mb-2 tracking-tight">任务审计中心</h1>
          <p className="font-sans text-[14px] text-on-surface-variant/70">全局执行历史与工作流深度回放视图</p>
        </div>
        <button className="bg-surface-container border border-outline-variant/30 text-on-surface px-4 py-2 rounded-md font-label text-[12px] uppercase tracking-widest hover:border-primary/50 transition-colors flex items-center gap-2">
          <Filter size={16} /> 多维筛选
        </button>
      </div>

      {/* Main Active Task Card */}
      <div className="bg-surface-container-high rounded-xl border border-white/5 relative overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-start relative z-10 bg-surface-container/50">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-sm bg-secondary-container/10 text-secondary border border-secondary/30 font-mono text-[11px] flex items-center gap-1.5 font-bold tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                执行中 (RUNNING)
              </span>
              <span className="font-mono text-[12px] text-outline px-2 py-0.5 rounded bg-surface/50 border border-white/5">TSK-8924</span>
              <span className="font-mono text-[12px] text-primary/70 px-2 py-0.5 rounded bg-primary/10 border border-primary/20">EST: 12m remaining</span>
            </div>
            <h3 className="font-display text-[22px] text-on-surface mb-2 leading-tight font-bold">v2.0 竞品全景分析与市场调研报告生成</h3>
            <p className="font-sans text-[13px] text-on-surface-variant/80 max-w-2xl leading-relaxed">
              基于最新互联网抓取数据，综合分析各大主流平台竞品功能矩阵、定价模型及目标用户群体情绪反馈，输出多维度分析图表及结论性洞察报告。
            </p>
          </div>
          <div className="flex gap-2">
            <button className="p-2.5 rounded-lg border border-outline-variant/30 text-outline hover:text-primary hover:border-primary transition-all bg-surface" title="强制重置流">
              <RotateCcw size={18} />
            </button>
            <button className="p-2.5 rounded-lg border border-outline-variant/30 text-outline hover:text-primary hover:border-primary transition-all bg-surface" title="导出执行拓扑">
              <Download size={18} />
            </button>
          </div>
        </div>

        {/* Topology Visualizer Placeholder */}
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
                {[1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className={cn(
                      "w-14 h-14 rounded-full border-2 flex items-center justify-center relative overflow-hidden bg-surface-container-highest",
                      i === 1 ? "border-secondary shadow-[0_0_15px_rgba(78,222,163,0.1)]" : "border-outline-variant/50 grayscale opacity-50"
                    )}>
                      <Database size={24} className={i === 1 ? "text-secondary" : "text-outline"} strokeWidth={1.5} />
                      {i === 1 && <div className="absolute bottom-0 w-full h-1 bg-secondary animate-pulse" />}
                    </div>
                    <div className="text-center font-mono text-[10px]">
                      <div className={i === 1 ? "text-secondary font-bold" : "text-outline/50"}>{i === 1 ? 'Data Miner' : 'Report Gen'}</div>
                      <div className="text-outline/40 mt-1 uppercase text-[9px]">{i === 1 ? 'Processing 89%' : 'Idle'}</div>
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
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">开始时间</span>
              <span className="font-mono text-[13px] text-on-surface">14:22:05 UTC</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">已运行时长</span>
              <span className="font-mono text-[13px] text-secondary">45m 12s</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest mb-1">当前消耗 TOKEN</span>
              <span className="font-mono text-[13px] text-tertiary">~142.5k</span>
            </div>
          </div>
          <button className="bg-primary-container/10 border border-primary/20 text-primary px-4 py-2 rounded-lg font-label text-[11px] uppercase tracking-widest hover:bg-primary-container/20 transition-all flex items-center gap-2">
            <Terminal size={14} /> 实时日志流
          </button>
        </div>
      </div>

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
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-surface/30 font-label text-[10px] text-outline uppercase tracking-widest">
                <th className="py-4 px-6 font-bold">任务编号</th>
                <th className="py-4 px-6 font-bold">任务描述指派</th>
                <th className="py-4 px-6 font-bold">运行状态</th>
                <th className="py-4 px-6 font-bold">资源消耗概览</th>
                <th className="py-4 px-6 font-bold">审计时间戳</th>
                <th className="py-4 px-6 font-bold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans text-[13px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/2 transition-colors">
                  <td className="py-4 px-6 font-mono text-[12px] text-outline">{log.id}</td>
                  <td className="py-4 px-6 text-on-surface font-medium">{log.desc}</td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "px-2.5 py-1 rounded-sm border font-mono text-[10px] flex items-center gap-1.5 w-fit font-bold tracking-wider",
                      log.status === 'success' ? "bg-primary/5 text-primary border-primary/20" : "bg-error/5 text-error border-error/20"
                    )}>
                      {log.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {log.status === 'success' ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                      <span className="text-on-surface-variant">耗时: {log.time}</span>
                      <span className="text-tertiary">Token: {log.tokens}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-mono text-[11px] text-outline/60">{log.date}</td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-3 opacity-40 hover:opacity-100 transition-opacity">
                      <button className="text-outline hover:text-primary"><RotateCcw size={18} /></button>
                      <button className="text-outline hover:text-primary"><Share2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
