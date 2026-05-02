import React, { useState } from 'react';
import { HelpCircle, MessageSquare, Keyboard, ChevronDown, ChevronRight, ExternalLink, Github, BookOpen, Mail } from 'lucide-react';
import { cn } from '../lib/utils';

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  { q: '如何创建新的数字员工？', a: '在团队概览页面点击"新增数字员工"按钮，填写名称、选择角色（工作代理或主管代理）、配置模型和工具权限后即可创建。' },
  { q: '主管代理和工作代理有什么区别？', a: '工作代理负责执行具体任务，主管代理负责协调多个工作代理协同完成任务。主管代理可以分配子任务给工作代理。' },
  { q: '如何调整系统默认设置？', a: '在设置页面可以配置默认的模型、温度参数、Top-P等。也可以设置工作空间目录和知识库路径。' },
  { q: '任务失败后如何重试？', a: '在任务中心页面，找到失败的任务，点击操作列中的"重试"按钮即可重新加入队列执行。' },
  { q: '如何查看系统日志？', a: '点击左侧导航栏的"系统日志"，可以查看实时的系统事件和调试输出，支持按级别筛选和关键词搜索。' },
  { q: '本地模型连接失败怎么办？', a: '确保 Ollama 服务正在运行（运行 ollama serve），并且已下载所需的模型（运行 ollama pull <model-name>）。' },
  { q: '工具权限是什么？', a: '工具权限控制代理可以使用的系统工具，包括文件读取、文件写入、Shell 命令执行、网络搜索和代码执行。建议按需授权。' },
  { q: '如何导出任务日志？', a: '在任务详请页面或系统日志页面，点击"导出"按钮即可将日志下载为 .log 文件。' },
];

const shortcuts = [
  { keys: ['Ctrl', 'Enter'], desc: '发送消息（聊天面板）' },
  { keys: ['Esc'], desc: '关闭弹窗/取消操作' },
  { keys: ['Alt', 'T'], desc: '打开通知面板' },
  { keys: ['Ctrl', 'K'], desc: '快速搜索' },
];

export default function HelpSupport() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="max-w-[900px] mx-auto p-8 space-y-10 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
          <HelpCircle size={32} className="text-primary" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-[32px] font-bold text-on-surface mb-2 tracking-tight">帮助与支持</h1>
        <p className="font-sans text-[14px] text-on-surface-variant/70">快速上手 Digital Crew，查看常见问题与键盘快捷键</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="https://github.com" target="_blank" rel="noopener" className="glass-panel rounded-xl p-5 border border-white/10 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
          <Github size={24} className="text-outline mb-3 group-hover:text-primary transition-colors" strokeWidth={1.5} />
          <p className="font-display text-[15px] text-on-surface font-semibold mb-1">GitHub</p>
          <p className="font-sans text-[12px] text-outline">查看源码、参与贡献</p>
        </a>
        <a href="https://docs.example.com" target="_blank" rel="noopener" className="glass-panel rounded-xl p-5 border border-white/10 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
          <BookOpen size={24} className="text-outline mb-3 group-hover:text-primary transition-colors" strokeWidth={1.5} />
          <p className="font-display text-[15px] text-on-surface font-semibold mb-1">文档中心</p>
          <p className="font-sans text-[12px] text-outline">完整使用指南</p>
        </a>
        <a href="mailto:support@example.com" className="glass-panel rounded-xl p-5 border border-white/10 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
          <Mail size={24} className="text-outline mb-3 group-hover:text-primary transition-colors" strokeWidth={1.5} />
          <p className="font-display text-[15px] text-on-surface font-semibold mb-1">联系我们</p>
          <p className="font-sans text-[12px] text-outline">问题与反馈</p>
        </a>
      </div>

      {/* FAQs */}
      <div className="bg-surface-container-high rounded-xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <MessageSquare size={18} className="text-primary" strokeWidth={1.5} />
          <h2 className="font-label text-[11px] font-bold text-on-surface uppercase tracking-widest">常见问题</h2>
        </div>
        <div className="divide-y divide-white/5">
          {faqs.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-sans text-[14px] text-on-surface font-medium pr-4">{faq.q}</span>
                {openFaq === i ? (
                  <ChevronDown size={16} className="text-primary shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-outline shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5">
                  <p className="font-sans text-[13px] text-on-surface-variant leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-surface-container-high rounded-xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <Keyboard size={18} className="text-primary" strokeWidth={1.5} />
          <h2 className="font-label text-[11px] font-bold text-on-surface uppercase tracking-widest">键盘快捷键</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {s.keys.map((key, j) => (
                  <React.Fragment key={j}>
                    <kbd className="px-2 py-1 bg-surface border border-white/10 rounded text-[11px] font-mono text-on-surface">{key}</kbd>
                    {j < s.keys.length - 1 && <span className="text-outline text-[11px]">+</span>}
                  </React.Fragment>
                ))}
              </div>
              <span className="font-sans text-[12px] text-outline">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="bg-surface-container-high rounded-xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <ExternalLink size={18} className="text-primary" strokeWidth={1.5} />
          <h2 className="font-label text-[11px] font-bold text-on-surface uppercase tracking-widest">关于 Digital Crew</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-sans text-[13px] text-outline">版本</span>
            <span className="font-mono text-[12px] text-on-surface">v1.0.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-sans text-[13px] text-outline">构建日期</span>
            <span className="font-mono text-[12px] text-on-surface">2026-05-02</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-sans text-[13px] text-outline">后端状态</span>
            <span className="font-mono text-[12px] text-secondary flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              已连接
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-sans text-[13px] text-outline">本地模型</span>
            <span className="font-mono text-[12px] text-on-surface">llama3.2:latest</span>
          </div>
        </div>
      </div>
    </div>
  );
}