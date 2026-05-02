import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  ClipboardList,
  BarChart3,
  Settings as SettingsIcon,
  Terminal,
  HelpCircle,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Sidebar() {
  const navItems = [
    { name: '团队概览', icon: Users, path: '/' },
    { name: '聊天面板', icon: MessageSquare, path: '/chat' },
    { name: '任务中心', icon: ClipboardList, path: '/audit' },
    { name: '知识库', icon: BookOpen, path: '/knowledge' },
    { name: '设置', icon: SettingsIcon, path: '/settings' },
  ];

  const bottomItems = [
    { name: '系统日志', icon: Terminal, path: '/logs' },
    { name: '帮助与支持', icon: HelpCircle, path: '/support' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-lowest border-r border-outline-variant/10 flex flex-col z-40 bg-[#060a14]">
      <div className="p-6 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5Eyn0ocSj4kD6fi1Zv8RGZvYfkxSDXtfkFwErm02WBeLf-InRv6DL1ZEGCrMfFh4yvglrOl1ENfN9YIOh9lJTr8aAcuzMoziOk4gvBoVs4NH0ZWMZLQ6-Hcv-_JwDANzb9wNLQbeYG0tjkPHRqOi4lgx6aVWQ4SEhLJplUOjRqYrqSfFZtT3e3N7bfktGMSJ7w8mRTu-mkmcu2iilXDnOHDEGTwGcz8v0RP5cCFZ3_u3Hj_T3S-_CWJYQ983OB_5f56iS-kP3z-M" 
              alt="Avatar" 
              className="w-full h-full object-cover opacity-90"
            />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm tracking-tight text-on-surface">Digital Crew</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-outline-variant mt-0.5">本地协调器</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 font-display text-[13px] font-medium",
              isActive 
                ? "bg-primary/10 text-primary border-l-2 border-primary shadow-[inset_20px_0_20px_-20px_rgba(173,198,255,0.1)]" 
                : "text-outline hover:text-on-surface hover:bg-white/5"
            )}
          >
            <item.icon size={20} className="shrink-0" strokeWidth={1.5} />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 mt-auto py-6 space-y-1 relative border-t border-white/5">
        {bottomItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 font-display text-[13px] font-medium text-outline hover:text-on-surface hover:bg-white/5"
            )}
          >
            <item.icon size={20} className="shrink-0" strokeWidth={1.5} />
            {item.name}
          </NavLink>
        ))}
        
        <div className="mt-6 p-4 rounded-xl bg-surface-container-high border border-outline-variant/30 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
            <ShieldCheck size={80} />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-secondary" />
            <span className="font-label text-[10px] font-semibold text-secondary uppercase tracking-widest">隐私状态</span>
          </div>
          <p className="font-mono text-[10px] text-on-surface-variant">数据 100% 本地处理</p>
          <div className="w-full h-1 bg-surface-container-highest rounded-full mt-1">
            <div className="h-full bg-secondary rounded-full w-full"></div>
          </div>
        </div>
      </div>
    </aside>
  );
}
