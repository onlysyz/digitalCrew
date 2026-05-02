import React, { useState, useEffect } from 'react';
import {
  Key,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Cpu,
  FolderOpen,
  Languages,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  Terminal,
  Zap,
  Activity,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSystemStore } from '../stores/systemStore';

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

export default function Settings() {
  const { settings, resources, isLoading, error, fetchSettings, updateSettings, fetchResources } = useSystemStore();

  const [showKey, setShowKey] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [temp, setTemp] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [contextWindow, setContextWindow] = useState(8192);
  const [language, setLanguage] = useState('zh');
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [ollamaUrlError, setOllamaUrlError] = useState<string | null>(null);
  const [sandboxTimeout, setSandboxTimeout] = useState(60);
  const [maxConcurrentAgents, setMaxConcurrentAgents] = useState(5);
  const [errorReporting, setErrorReporting] = useState(false);
  const [anonymousStats, setAnonymousStats] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restartRequired, setRestartRequired] = useState<string[]>([]);
  const [showRestartBanner, setShowRestartBanner] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchResources();
  }, []);

  useEffect(() => {
    if (settings) {
      setOllamaUrl(settings.ollama_base_url || 'http://localhost:11434');
      setTemp(settings.temperature ?? 0.7);
      setTopP(settings.top_p ?? 0.9);
      setContextWindow(settings.context_window ?? 8192);
      setLanguage(settings.language || 'zh');
      setWorkspaceDir(settings.workspace_dir || '');
      setSandboxTimeout(settings.sandbox_timeout ?? 60);
      setMaxConcurrentAgents(settings.max_concurrent_agents ?? 5);
      setErrorReporting(settings.enable_error_reporting ?? false);
      setAnonymousStats(settings.enable_anonymous_stats ?? false);
    }
  }, [settings]);

  const testOllamaConnection = async () => {
    setConnectionStatus('testing');
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`);
      if (response.ok) {
        setConnectionStatus('connected');
        fetchResources();
      } else {
        setConnectionStatus('failed');
      }
    } catch {
      setConnectionStatus('failed');
    }
  };

  const validateSettings = (): string | null => {
    // Validate Ollama URL format
    if (!ollamaUrl.startsWith('http://') && !ollamaUrl.startsWith('https://')) {
      setOllamaUrlError('必须以 http:// 或 https:// 开头');
      return 'Ollama URL 格式无效';
    }
    try {
      new URL(ollamaUrl);
    } catch {
      setOllamaUrlError('URL 格式无效');
      return 'Ollama URL 格式无效';
    }
    // Validate sandbox timeout range
    if (sandboxTimeout < 10 || sandboxTimeout > 300) {
      return '沙箱超时时间必须在 10-300 秒之间';
    }
    // Validate workspace directory is not empty
    if (workspaceDir.trim().length === 0) {
      return '工作目录不能为空';
    }
    return null;
  };

  const handleSaveSettings = async () => {
    const validationError = validateSettings();
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await updateSettings({
        ollama_base_url: ollamaUrl,
        temperature: temp,
        top_p: topP,
        context_window: contextWindow,
        language,
        workspace_dir: workspaceDir,
        sandbox_timeout: sandboxTimeout,
        max_concurrent_agents: maxConcurrentAgents,
        enable_error_reporting: errorReporting,
        enable_anonymous_stats: anonymousStats,
      } as any).then((response: any) => {
        if (response?.restart_required?.length > 0) {
          setRestartRequired(response.restart_required);
          setShowRestartBanner(true);
        }
      });
      // Persist LLM defaults to localStorage for agent creation
      localStorage.setItem('agent_defaults', JSON.stringify({ temperature: temp, top_p: topP, context_window: contextWindow }));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveError((err as Error).message || '保存失败，请重试');
      setSaveStatus('idle');
    }
  };

  const formatMemory = (gb: number) => {
    return gb.toFixed(1);
  };

  return (
    <div className="max-w-[1240px] mx-auto p-8 flex flex-col xl:flex-row gap-8 items-start animate-in fade-in duration-500 pb-24">
      {/* Left Column: Settings Content Panels */}
      <div className="flex-1 flex flex-col gap-8 w-full order-2 xl:order-1">

        {/* Page Header */}
        <div className="mb-2">
          <h1 className="font-display text-[32px] font-bold text-on-surface mb-2">配置与监控</h1>
          <p className="font-sans text-[15px] text-on-surface-variant/80">管理数字员工的全局参数、模型密钥，并实时监控本地资源分配。</p>
        </div>

        {/* Save Status Banner */}
        {saveStatus === 'saved' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-secondary/10 border border-secondary/20 rounded-lg text-secondary">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">设置已保存</span>
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-error/10 border border-error/20 rounded-lg text-error">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{saveError}</span>
          </div>
        )}

        {/* Restart Required Banner */}
        {showRestartBanner && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-tertiary/10 border border-tertiary/20 rounded-lg text-tertiary">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">
                部分设置 ({restartRequired.join(', ')}) 需要重启服务才能生效
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/v1/system/settings/apply', { method: 'POST' });
                    setShowRestartBanner(false);
                  } catch { /* ignore */ }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-tertiary/20 hover:bg-tertiary/30 rounded-lg transition-colors"
              >
                立即应用
              </button>
              <button
                onClick={() => setShowRestartBanner(false)}
                className="px-3 py-1.5 text-xs font-medium text-outline hover:text-on-surface transition-colors"
              >
                稍后
              </button>
            </div>
          </div>
        )}

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
                  <div className={cn(
                    "w-2 h-2 rounded-full shadow-[0_0_8px_rgba(78,222,163,0.6)]",
                    connectionStatus === 'connected' ? "bg-secondary" : connectionStatus === 'failed' ? "bg-error" : connectionStatus === 'testing' ? "bg-tertiary animate-pulse" : "bg-white/30"
                  )} />
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => { setOllamaUrl(e.target.value); setOllamaUrlError(null); }}
                    className="font-mono text-[13px] text-on-surface-variant flex-1 bg-transparent border-none outline-none focus:text-on-surface"
                  />
                  {connectionStatus === 'connected' && (
                    <span className="font-label text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">已连接</span>
                  )}
                  {ollamaUrlError && (
                    <span className="text-[10px] text-error">{ollamaUrlError}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={testOllamaConnection}
                    disabled={connectionStatus === 'testing'}
                    className="text-[11px] font-label uppercase tracking-widest px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {connectionStatus === 'testing' ? (
                      <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 测试中</span>
                    ) : connectionStatus === 'connected' ? '重测' : '测试连接'}
                  </button>
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
              <button
                onClick={() => { setTemp(0.7); setTopP(0.9); }}
                className="text-outline hover:text-on-surface p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
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
                  <span className="font-mono text-[13px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 min-w-[3rem] text-center">{temp.toFixed(1)}</span>
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
                  <span className="font-mono text-[13px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 min-w-[3rem] text-center">{topP.toFixed(2)}</span>
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
                  <select
                    value={contextWindow}
                    onChange={(e) => setContextWindow(parseInt(e.target.value))}
                    className="w-full bg-[#0F172A] border border-outline-variant/40 rounded-lg p-2.5 font-mono text-sm text-on-surface focus:outline-none focus:border-primary/50 appearance-none shadow-inner"
                  >
                    <option value={4096}>4096 (4k)</option>
                    <option value={8192}>8192 (8k)</option>
                    <option value={32768}>32768 (32k)</option>
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
          <div className="flex justify-between items-center">
            <h3 className="font-display text-xl font-bold text-on-surface flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center border border-secondary/20">
                <SettingsIcon className="text-secondary" size={18} />
              </div>
              通用设置
            </h3>
            <button
              onClick={handleSaveSettings}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={16} />
                  保存设置
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="font-display font-bold text-[14px] text-on-surface block">工作目录 (Workspace)</label>
              <div className="flex border border-outline-variant/40 rounded-lg overflow-hidden shadow-inner group">
                <div className="bg-surface-container-highest flex items-center px-3 text-outline group-hover:text-primary transition-colors">
                  <FolderOpen size={16} />
                </div>
                <input
                  type="text"
                  value={workspaceDir}
                  onChange={(e) => setWorkspaceDir(e.target.value)}
                  className="flex-1 bg-[#0F172A] py-2.5 px-4 font-mono text-sm text-on-surface truncate outline-none focus:text-on-surface"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-display font-bold text-[14px] text-on-surface block">界面语言 (Language)</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-outline flex items-center gap-2">
                  <Languages size={18} />
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-[#0F172A] border border-outline-variant/40 rounded-lg pl-10 pr-3 py-2.5 font-sans text-sm text-on-surface focus:outline-none focus:border-primary/50 appearance-none shadow-inner"
                >
                  <option value="zh">简体中文</option>
                  <option value="en">English</option>
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-display font-bold text-[14px] text-on-surface block">沙箱超时 (Sandbox Timeout)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={sandboxTimeout}
                  onChange={(e) => setSandboxTimeout(parseInt(e.target.value) || 60)}
                  className="w-24 bg-[#0F172A] border border-outline-variant/40 rounded-lg px-3 py-2.5 font-mono text-sm text-on-surface text-center shadow-inner"
                />
                <span className="text-sm text-on-surface-variant">秒</span>
                <div className="flex gap-1 ml-2">
                  {[30, 60, 120].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSandboxTimeout(val)}
                      className={cn(
                        "px-2 py-1 rounded text-[11px] font-mono transition-colors",
                        sandboxTimeout === val
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : "bg-[#0F172A] text-outline border border-outline-variant/30 hover:text-on-surface"
                      )}
                    >
                      {val}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-display font-bold text-[14px] text-on-surface block">最大并发 Agent 数</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={maxConcurrentAgents}
                  onChange={(e) => setMaxConcurrentAgents(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-[#0F172A] rounded-full appearance-none cursor-pointer accent-primary"
                />
                <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded border border-primary/20 min-w-[3rem] text-center">
                  {maxConcurrentAgents}
                </span>
              </div>
              <div className="flex justify-between font-mono text-[10px] text-outline/50">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="font-display font-bold text-[14px] text-on-surface block">隐私与反馈</label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setErrorReporting(!errorReporting)}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-colors shadow-inner cursor-pointer",
                      errorReporting ? "bg-primary" : "bg-[#0F172A] border border-outline-variant/40"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all",
                      errorReporting ? "right-0.5" : "left-0.5"
                    )} />
                  </div>
                  <div>
                    <span className="text-sm text-on-surface block">错误报告</span>
                    <span className="text-[10px] text-on-surface-variant/60">自动发送错误日志以改进产品</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setAnonymousStats(!anonymousStats)}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-colors shadow-inner cursor-pointer",
                      anonymousStats ? "bg-primary" : "bg-[#0F172A] border border-outline-variant/40"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all",
                      anonymousStats ? "right-0.5" : "left-0.5"
                    )} />
                  </div>
                  <div>
                    <span className="text-sm text-on-surface block">匿名统计</span>
                    <span className="text-[10px] text-on-surface-variant/60">发送匿名使用统计数据</span>
                  </div>
                </label>
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
            <button
              onClick={() => fetchResources()}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {resources ? (
            <>
              {[
                { label: '处理器占用', value: resources.cpu_percent, unit: '%', type: 'CPU', color: 'primary', icon: Cpu },
                { label: '图形运算', value: resources.gpu_percent, unit: '%', type: 'GPU', color: 'tertiary', icon: Zap },
                { label: '系统内存', value: resources.memory_used_gb, unit: 'GB', type: 'RAM', color: 'secondary', icon: DatabaseZap }
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-[#0F172A] border border-outline-variant/20 relative overflow-hidden group">
                  <div className="flex justify-between items-end mb-4 relative z-10">
                    <div>
                      <div className="font-label text-[10px] text-outline uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <item.icon size={11} /> {item.label}
                      </div>
                      <div className="font-mono text-2xl font-bold text-on-surface">
                        {item.type === 'RAM' ? formatMemory(item.value) : item.value}
                        <span className="text-sm text-outline/50 ml-0.5">{item.unit}</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 relative flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/5" strokeWidth="2.5" />
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          fill="none"
                          className="stroke-secondary"
                          strokeWidth="2.5"
                          strokeDasharray="100"
                          strokeDashoffset={100 - (item.type === 'RAM' ? (resources.memory_percent) : item.value)}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>

                  {item.type === 'RAM' ? (
                    <div className="space-y-1.5">
                      <div className="w-full h-1 bg-white/5 rounded-full">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${resources.memory_percent}%` }} />
                      </div>
                      <div className="flex justify-between font-mono text-[9px] text-outline/40">
                        <span>已使用</span>
                        <span>{resources.memory_total_gb.toFixed(1)} GB 总计</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-6 flex items-end gap-1 opacity-40">
                      {[3, 5, 2, 8, 4, 3, 7, 5, 4, 6].map((h, j) => (
                        <div key={j} className="flex-1 rounded-t-sm bg-secondary" style={{ height: `${h * 10}%` }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Ollama Models */}
              {resources.ollama_models && resources.ollama_models.length > 0 && (
                <div className="space-y-2">
                  <div className="font-label text-[10px] text-outline uppercase tracking-widest">已加载模型</div>
                  {resources.ollama_models.map((model: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-[#0F172A] rounded-lg border border-outline-variant/20">
                      <span className="font-mono text-[12px] text-on-surface">{model.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-outline">{model.size}</span>
                        {model.loaded && (
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_6px_rgba(78,222,163,0.8)]" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-outline" />
            </div>
          )}

          <button className="w-full py-3 mt-2 border border-outline-variant/20 rounded-xl text-[12px] font-bold text-on-surface uppercase tracking-widest hover:bg-white/5 hover:border-outline-variant/40 transition-all flex items-center justify-center gap-2">
            <RefreshCw size={14} className="text-primary" />
            <span>释放闲置资源</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const DatabaseZap = ({ size, className }: { size?: number; className?: string }) => (
  <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="m13 12-3 5h4l-3 5" />
  </svg>
);