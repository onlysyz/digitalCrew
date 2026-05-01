import React, { useState } from 'react';
import { 
  Key, 
  Settings as SettingsIcon, 
  SlidersHorizontal, 
  Cpu, 
  FolderOpen, 
  Languages, 
  RefreshCw,
  MoreVertical,
  Plus,
  Eye,
  EyeOff,
  Terminal,
  Zap,
  Activity,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Settings() {
  const [showKey, setShowKey] = useState(false);
  const [temp, setTemp] = useState(0.7);
  const [topP, setTopP] = useState(0.9);

  return (
    <div className="max-w-[1240px] mx-auto p-8 flex flex-col xl:flex-row gap-8 items-start animate-in fade-in duration-500 pb-24">
      {/* Left Column: Settings Content Panels */}
      <div className="flex-1 flex flex-col gap-8 w-full order-2 xl:order-1">
        
        {/* Page Header (Internal to content for bento feel) */}
        <div className="mb-2">
            <h1 className="font-display text-[32px] font-bold text-on-surface mb-2">配置与监控</h1>
            <p className="font-sans text-[15px] text-on-surface-variant/80">管理数字员工的全局参数、模型密钥，并实时监控本地资源分配。</p>
        </div>

        {/* Panel 1: Model Config */}
        <div className="bg-[#1E293B] border border-white/5 rounded-2xl p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          
          {/* API Keys */}
          <section className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-xl font-bold text-on-surface flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Key className="text-primary" size={18} />
                </div>
                大模型 API 密钥
              </h3>
              <button className="text-[13px] font-semibold text-primary hover:text-primary-fixed-dim transition-colors flex items-center gap-1">
                <Plus size={14} /> 添加提供商
              </button>
            </div>

            <div className="space-y-4">
              {/* OpenAI Card */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-surface-container-high rounded-xl border border-outline-variant/30 hover:border-primary/40 transition-all duration-300 shadow-sm relative group">
                <div className="flex items-center gap-4 w-full sm:w-48 shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-[#10A37F]/10 border border-[#10A37F]/20 flex items-center justify-center">
                    <div className="w-6 h-6 text-[#10A37F]" dangerouslySetInnerHTML={{ __html: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M22.28 9.82a6 6 0 0 0-.51-4.91 6.05 6.05 0 0 0-6.51-2.9 6.06 6.06 0 0 0-10.28 2.17 6 6 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 6 6 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9 6 6 0 0 0 4.4 6.2 6.03 6.03 0 0 0 5.77-4.2 6 6 0 0 0 4-2.9 6.06 6.06 0 0 0-.74-7.07zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.49zm-9.66-4.13a4.47 4.47 0 0 1-.53-3.01l.14.08 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33s-.01.07-.03.06l-4.85 2.8a4.5 4.5 0 0 1-6.14-1.65zm-1.26-10.4a4.49 4.49 0 0 1 2.37-1.97v5.6a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17s-.06.01-.07 0l-4.83-2.79a4.5 4.5 0 0 1-1.65-6.04zm16.6 3.86l-5.83-3.37 2.02-1.16s.06-.01.07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.41-.67zm2.01-3.02l-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0l-5.84 3.37V6.9s.01-.07.03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.3 12.86l-2.02-1.16a.08.08 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.78 2.76-.39.68zM9.4 10.5l2.6-1.5 2.61 1.5v3l-2.6 1.5-2.61-1.5z"/></svg>' }} />
                  </div>
                  <span className="font-display font-semibold text-on-surface">OpenAI</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="relative group/input">
                    <input 
                      type={showKey ? 'text' : 'password'} 
                      value="sk-proj-a1b2c3d4e5f6g7h8i9j0"
                      readOnly
                      className="w-full bg-[#0F172A] border border-outline-variant/40 rounded-lg pl-9 pr-12 py-2.5 font-mono text-[13px] text-on-surface focus:outline-none focus:border-primary/50 transition-all shadow-inner"
                    />
                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/50" />
                    <button 
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline/50 hover:text-primary transition-colors"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-5 bg-primary rounded-full relative shadow-inner cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                </div>
              </div>

              {/* Local Model Card */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-primary/5 rounded-xl border border-primary/20 group hover:border-primary/40 transition-all duration-300">
                <div className="flex items-center gap-4 w-full sm:w-48 shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center relative overflow-hidden">
                    <Cpu size={20} className="text-primary relative z-10" />
                    <div className="absolute inset-0 bg-primary/10 animate-pulse" />
                  </div>
                  <div>
                    <span className="font-display font-semibold text-on-surface block">本地模型 (Ollama)</span>
                    <span className="font-mono text-[10px] text-primary uppercase">Llama-3-8b</span>
                  </div>
                </div>
                <div className="flex-1 bg-[#0F172A] border border-outline-variant/40 rounded-lg px-4 py-2.5 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.6)]" />
                  <span className="font-mono text-[13px] text-on-surface-variant flex-1">http://localhost:11434</span>
                  <span className="font-label text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">已连接</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-10 h-5 bg-primary rounded-full relative shadow-inner cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="w-full h-px bg-white/5 opacity-50" />

          {/* Parameters */}
          <section className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-xl font-bold text-on-surface flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
                  <Zap className="text-tertiary" size={18} />
                </div>
                全局推理参数
              </h3>
              <button className="text-outline hover:text-on-surface p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 bg-surface-container-high/50 p-6 rounded-xl border border-outline-variant/30">
              {/* Temperature Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <label className="font-display font-bold text-[14px] text-on-surface block mb-1">Temperature (温度)</label>
                    <span className="text-[11px] text-on-surface-variant/70 font-sans tracking-tight">控制输出的随机性与创造力</span>
                  </div>
                  <span className="font-mono text-[13px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 min-w-[3rem] text-center">{temp}</span>
                </div>
                <div className="relative pt-1 pb-6">
                  <input 
                    type="range" 
                    min={0} 
                    max={2} 
                    step={0.1} 
                    value={temp} 
                    onChange={(e) => setTemp(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#0F172A] rounded-full appearance-none cursor-pointer accent-primary border border-white/5" 
                  />
                  <div className="absolute w-full flex justify-between top-6 font-mono text-[10px] text-outline/50 px-1">
                    <span>0.0 (确定)</span>
                    <span>1.0</span>
                    <span>2.0 (随机)</span>
                  </div>
                </div>
              </div>

              {/* Top P Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <label className="font-display font-bold text-[14px] text-on-surface block mb-1">Top-P</label>
                    <span className="text-[11px] text-on-surface-variant/70 font-sans tracking-tight">核采样，限制候选词汇范围</span>
                  </div>
                  <span className="font-mono text-[13px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 min-w-[3rem] text-center">{topP}</span>
                </div>
                <div className="relative pt-1 pb-6">
                  <input 
                    type="range" 
                    min={0} 
                    max={1} 
                    step={0.05} 
                    value={topP} 
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#0F172A] rounded-full appearance-none cursor-pointer accent-primary border border-white/5" 
                  />
                  <div className="absolute w-full flex justify-between top-6 font-mono text-[10px] text-outline/50 px-1">
                    <span>0.0</span>
                    <span>0.5</span>
                    <span>1.0</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="font-display font-bold text-[14px] text-on-surface block">Context Length (上下文窗口)</label>
                <div className="relative">
                  <select className="w-full bg-[#0F172A] border border-outline-variant/40 rounded-lg p-2.5 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/50 appearance-none shadow-inner">
                    <option>4096 (4k)</option>
                    <option selected>8192 (8k)</option>
                    <option>32768 (32k)</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="font-display font-bold text-[14px] text-on-surface block">System Prompt (系统提示词)</label>
                <button className="w-full h-[41px] border border-outline-variant/40 bg-[#0F172A] rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-all flex items-center justify-center gap-2 group shadow-inner">
                  <Terminal size={16} className="group-hover:text-primary transition-colors" />
                  <span>编辑全局系统预设</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Panel 2: General Settings */}
        <div className="bg-[#1E293B] border border-white/5 rounded-2xl p-8 shadow-2xl space-y-6">
          <h3 className="font-display text-xl font-bold text-on-surface flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center border border-secondary/20">
              <SettingsIcon className="text-secondary" size={18} />
            </div>
            通用设置
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="font-display font-bold text-[14px] text-on-surface block">工作目录 (Workspace)</label>
              <div className="flex border border-outline-variant/40 rounded-lg overflow-hidden shadow-inner group">
                <div className="bg-surface-container-highest flex items-center px-3 text-outline group-hover:text-primary transition-colors">
                  <FolderOpen size={16} />
                </div>
                <div className="flex-1 bg-[#0F172A] py-2.5 px-4 font-mono text-sm text-on-surface truncate cursor-default">
                  ~/DigitalCrew/workspace
                </div>
                <button className="bg-surface-container-highest px-4 text-[11px] font-label uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors">更改</button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-display font-bold text-[14px] text-on-surface block">界面语言 (Language)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-outline flex items-center gap-2">
                  <Languages size={18} />
                </div>
                <select className="w-full bg-[#0F172A] border border-outline-variant/40 rounded-lg pl-10 pr-3 py-2.5 font-sans text-sm text-on-surface focus:outline-none focus:border-primary/50 appearance-none shadow-inner">
                  <option selected>简体中文</option>
                  <option>English</option>
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Resource Monitor */}
      <div className="w-full xl:w-80 flex-shrink-0 sticky top-8 space-y-6 order-1 xl:order-2">
        <div className="bg-[#1E293B] border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="font-display text-lg font-bold text-on-surface flex items-center gap-2">
              <Activity className="text-secondary" size={20} /> 资源看板
            </h3>
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse shadow-[0_0_10px_rgba(78,222,163,0.5)]" />
          </div>

          {[
            { label: '处理器占用', value: 24, unit: '%', type: 'CPU', color: 'primary', icon: Cpu },
            { label: '图形运算', value: 41, unit: '%', type: 'GPU', color: 'tertiary', icon: Zap },
            { label: '系统内存', value: 12.4, unit: 'GB', type: 'RAM', color: 'secondary', icon: DatabaseZap }
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl bg-[#0F172A] border border-outline-variant/20 relative overflow-hidden group">
               <div className="flex justify-between items-end mb-4 relative z-10">
                 <div>
                    <div className="font-label text-[10px] text-outline uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <item.icon size={11} className={`text-${item.color}`} /> {item.label}
                    </div>
                    <div className="font-mono text-2xl font-bold text-on-surface">
                      {item.value}<span className="text-sm text-outline/50 ml-0.5">{item.unit}</span>
                    </div>
                 </div>
                 <div className="w-12 h-12 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/5" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="16" fill="none" className={`stroke-${item.color}`} strokeWidth="2.5" strokeDasharray="100" strokeDashoffset={100 - (item.value * (item.unit === '%' ? 1 : 100/32))} strokeLinecap="round" />
                    </svg>
                 </div>
               </div>
               
               {item.type === 'RAM' ? (
                 <div className="space-y-1.5">
                    <div className="w-full h-1 bg-white/5 rounded-full">
                      <div className="h-full bg-secondary rounded-full" style={{ width: '38%' }} />
                    </div>
                    <div className="flex justify-between font-mono text-[9px] text-outline/40">
                      <span>已使用</span>
                      <span>32.0 GB 总计</span>
                    </div>
                 </div>
               ) : (
                 <div className="h-6 flex items-end gap-1 opacity-40">
                    {[3, 5, 2, 8, 4, 3, 7, 5, 4, 6].map((h, j) => (
                      <div key={j} className={cn("flex-1 rounded-t-sm", `bg-${item.color}`)} style={{ height: `${h * 10}%` }} />
                    ))}
                 </div>
               )}
            </div>
          ))}

          <button className="w-full py-3 mt-2 border border-outline-variant/20 rounded-xl text-[12px] font-bold text-on-surface uppercase tracking-widest hover:bg-white/5 hover:border-outline-variant/40 transition-all flex items-center justify-center gap-2">
             <RefreshCw size={14} className="text-primary" />
             <span>释放闲置资源</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const DatabaseZap = ({ size, className }: { size?: number, className?: string }) => (
  <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="m13 12-3 5h4l-3 5" />
  </svg>
);
