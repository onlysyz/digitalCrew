import React from 'react';
import { Search, Radio, Share2, Bell, Plus } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="h-16 shrink-0 bg-[#0b1326]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold tracking-tighter text-primary font-display">CrewOS</span>
        
        <div className="relative ml-8 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline/70" size={18} strokeWidth={1.5} />
          <input 
            type="text" 
            placeholder="搜索资源、日志或代理..." 
            className="bg-surface-container-low border border-white/5 rounded-full pl-10 pr-4 py-1.5 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:bg-surface-container transition-all w-72 placeholder-outline-variant"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {[Radio, Share2, Bell].map((Icon, i) => (
            <button 
              key={i} 
              className="w-9 h-9 flex items-center justify-center rounded-full text-outline hover:bg-white/5 hover:text-white transition-all active:scale-95 relative"
            >
              <Icon size={20} strokeWidth={1.5} />
              {i === 2 && (
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(173,198,255,0.8)]" />
              )}
            </button>
          ))}
        </div>
        
        <button className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-on-primary font-label text-[12px] font-semibold px-5 py-2 rounded-md flex items-center gap-2 transition-all duration-300 active:scale-95 shadow-[0_0_15px_rgba(173,198,255,0.1)] hover:shadow-[0_0_20px_rgba(173,198,255,0.3)]">
          <Plus size={18} />
          <span>新建任务</span>
        </button>
      </div>
    </header>
  );
}
