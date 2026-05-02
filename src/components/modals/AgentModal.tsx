import React, { useState, useEffect } from 'react';
import { X, DatabaseZap, Box, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    role: 'supervisor' | 'worker';
    model_name: string;
    system_prompt: string;
    tool_permissions: Array<{ tool_name: string; enabled: boolean }>;
    capabilities: string[];
  }) => Promise<void>;
  models: string[];
}

const TOOL_OPTIONS = [
  { name: '文件读取', tool_name: 'file_read' },
  { name: '文件写入', tool_name: 'file_write' },
  { name: 'Shell 命令', tool_name: 'shell' },
  { name: '网络搜索', tool_name: 'web_search' },
  { name: '代码执行', tool_name: 'code_execution' },
];

export default function AgentModal({ isOpen, onClose, onSubmit, models }: AgentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState<'supervisor' | 'worker'>('worker');
  const [modelName, setModelName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [toolPermissions, setToolPermissions] = useState<Array<{ tool_name: string; enabled: boolean }>>(
    TOOL_OPTIONS.map(t => ({ tool_name: t.tool_name, enabled: false }))
  );
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [capabilityInput, setCapabilityInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; modelName?: string }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const newErrors: { name?: string; modelName?: string } = {};
    if (!name.trim()) newErrors.name = '请输入代理名称';
    if (!modelName) newErrors.modelName = '请选择对话模型';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        description,
        role,
        model_name: modelName,
        system_prompt: systemPrompt,
        tool_permissions: toolPermissions,
        capabilities,
      });
      // Reset form
      setName('');
      setDescription('');
      setRole('worker');
      setModelName('');
      setSystemPrompt('');
      setToolPermissions(TOOL_OPTIONS.map(t => ({ tool_name: t.tool_name, enabled: false })));
      setCapabilities([]);
      setCapabilityInput('');
      setErrors({});
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTool = (toolName: string) => {
    setToolPermissions(prev =>
      prev.map(t => t.tool_name === toolName ? { ...t, enabled: !t.enabled } : t)
    );
  };

  const addCapability = () => {
    const cap = capabilityInput.trim();
    if (cap && !capabilities.includes(cap)) {
      setCapabilities(prev => [...prev, cap]);
    }
    setCapabilityInput('');
  };

  const removeCapability = (cap: string) => {
    setCapabilities(prev => prev.filter(c => c !== cap));
  };

  const handleCapabilityKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCapability();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-surface-container-highest">
          <h2 className="font-display text-xl font-bold text-on-surface">创建新代理</h2>
          <button onClick={onClose} className="p-2 text-outline hover:text-on-surface transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">
              代理名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })); }}
              placeholder="例如：Python 开发助手"
              className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors"
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          {/* Role Selector */}
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">代理角色</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole('worker')}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all",
                  role === 'worker'
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-surface border-white/10 text-on-surface hover:border-white/20"
                )}
              >
                <DatabaseZap size={20} className="mb-2" />
                <div className="font-display text-sm font-semibold">工作代理</div>
                <div className="font-sans text-[10px] opacity-70">执行具体任务</div>
              </button>
              <button
                onClick={() => setRole('supervisor')}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all",
                  role === 'supervisor'
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-surface border-white/10 text-on-surface hover:border-white/20"
                )}
              >
                <Box size={20} className="mb-2" />
                <div className="font-display text-sm font-semibold">主管代理</div>
                <div className="font-sans text-[10px] opacity-70">协调多代理工作</div>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">
              对话模型 <span className="text-red-400">*</span>
            </label>
            <select
              value={modelName}
              onChange={(e) => { setModelName(e.target.value); setErrors(prev => ({ ...prev, modelName: undefined })); }}
              className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors"
            >
              <option value="">选择模型</option>
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {errors.modelName && <p className="mt-1 text-xs text-red-400">{errors.modelName}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述此代理的专长和能力..."
              rows={2}
              className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Capabilities */}
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">
              能力标签 <span className="text-on-surface-variant/50 font-normal ml-1">用于智能路由</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {capabilities.map(cap => (
                <span
                  key={cap}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary text-xs"
                >
                  {cap}
                  <button
                    onClick={() => removeCapability(cap)}
                    className="hover:text-secondary/70"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={capabilityInput}
                onChange={(e) => setCapabilityInput(e.target.value)}
                onKeyDown={handleCapabilityKeyDown}
                placeholder="输入能力后按回车添加 (如: code, research, write)"
                className="flex-1 bg-surface border border-outline-variant/30 rounded-lg px-3 py-2 font-sans text-sm text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors"
              />
              <button
                onClick={addCapability}
                disabled={!capabilityInput.trim()}
                className="px-3 py-2 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary text-xs hover:bg-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                添加
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {['code', 'research', 'write', 'analysis', 'review', 'test'].map(suggested => (
                capabilities.includes(suggested) ? null : (
                  <button
                    key={suggested}
                    onClick={() => { setCapabilities(prev => [...prev, suggested]); }}
                    className="px-2 py-0.5 rounded text-[10px] bg-surface border border-white/10 text-on-surface-variant hover:border-white/20 transition-all"
                  >
                    {suggested}
                  </button>
                )
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">
              系统指令
              <span className="ml-2 text-on-surface-variant/50 font-normal">可选</span>
            </label>
            <div className="relative">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="为代理设定特定的行为和能力..."
                rows={3}
                className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 pr-16 font-sans text-sm text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors resize-none"
              />
              <span className="absolute bottom-3 right-3 font-mono text-[10px] text-outline">
                {systemPrompt.length}
              </span>
            </div>
          </div>

          {/* Tool Permissions */}
          <div>
            <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-3">工具权限</label>
            <div className="grid grid-cols-2 gap-2">
              {TOOL_OPTIONS.map((tool) => {
                const current = toolPermissions.find(t => t.tool_name === tool.tool_name);
                return (
                  <button
                    key={tool.tool_name}
                    onClick={() => toggleTool(tool.tool_name)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all text-sm",
                      current?.enabled
                        ? "bg-secondary/10 border-secondary/30 text-secondary"
                        : "bg-surface border-white/10 text-on-surface-variant hover:border-white/20"
                    )}
                  >
                    {tool.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-white/5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-on-surface font-label text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !modelName || isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label text-[11px] uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                创建中...
              </>
            ) : (
              '创建代理'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}