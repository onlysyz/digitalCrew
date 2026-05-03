import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, ChevronRight, Cpu, Database, Users, Zap, Loader2, Bot, RefreshCw, Globe, Key, Cloud } from 'lucide-react';
import { cn } from '../lib/utils';

interface SetupWizardProps {
  onComplete: () => void;
}

interface SetupStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

type LLMProvider = 'ollama' | 'openai' | 'minimax' | 'claude';

interface ModelSource {
  provider: LLMProvider;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const STEPS: SetupStep[] = [
  {
    id: 1,
    title: '环境检测',
    description: '检查 Ollama 连接和模型',
    icon: <Cpu size={20} />,
  },
  {
    id: 2,
    title: '数据目录',
    description: '配置工作空间路径',
    icon: <Database size={20} />,
  },
  {
    id: 3,
    title: '初始化 Agent',
    description: '创建默认工作代理',
    icon: <Users size={20} />,
  },
  {
    id: 4,
    title: '完成',
    description: '启动 DigitalCrew',
    icon: <Zap size={20} />,
  },
];

const MODEL_SOURCES: ModelSource[] = [
  {
    provider: 'ollama',
    name: 'Ollama (本地)',
    icon: <Cpu size={20} />,
    description: '本地运行的大语言模型',
  },
  {
    provider: 'openai',
    name: 'OpenAI',
    icon: <Cloud size={20} />,
    description: 'GPT-4o, GPT-4o-mini, o1 等',
  },
  {
    provider: 'claude',
    name: 'Claude (Anthropic)',
    icon: <Globe size={20} />,
    description: 'Claude 3.5, Claude 3 等',
  },
  {
    provider: 'minimax',
    name: 'MiniMax',
    icon: <Cloud size={20} />,
    description: 'MoE, Hailuo AI 等',
  },
];

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('ollama');
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [models, setModels] = useState<string[]>([]);
  const [chatModel, setChatModel] = useState<string>('llama3.2');
  const [embedModel, setEmbedModel] = useState<string>('');
  const [dirInitStatus, setDirInitStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [workspaceDir, setWorkspaceDir] = useState('~/DigitalCrew/workspace');
  const [knowledgeDir, setKnowledgeDir] = useState('~/DigitalCrew/knowledge');
  const [dbPath, setDbPath] = useState('~/DigitalCrew/data/db.sqlite');
  const [isEditingDirs, setIsEditingDirs] = useState(false);
  const [agentName, setAgentName] = useState('默认助手');
  const [agentRole, setAgentRole] = useState<'worker' | 'supervisor'>('worker');
  const [agentDescription, setAgentDescription] = useState('通用的 AI 助手，可以帮助用户完成各种任务');
  const [isCreatingAgents, setIsCreatingAgents] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepKey, setStepKey] = useState(1);
  const [isBack, setIsBack] = useState(false);

  // Auto-check connection when provider changes
  useEffect(() => {
    if (currentStep === 1 && selectedProvider === 'ollama') {
      checkConnection();
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (currentStep === 2) {
      initDirectories();
    }
    // Reset directory editing state when leaving step 2
    if (currentStep !== 2) {
      setIsEditingDirs(false);
    }
  }, [currentStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isCreatingAgents) {
        if (currentStep < 4) {
          handleNext();
        }
      } else if (e.key === 'Escape') {
        if (currentStep > 1) {
          handleBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isCreatingAgents]);

  const checkConnection = async () => {
    if (selectedProvider === 'ollama') {
      setOllamaStatus('checking');
      setError(null);
      try {
        const [statusRes, modelsRes] = await Promise.all([
          fetch('/api/v1/status'),
          fetch('/api/v1/models'),
        ]);
        if (statusRes.ok && modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const modelNames = modelsData.models?.map((m: { name: string }) => m.name) || [];
          setModels(modelNames);
          // Auto-select recommended chat model
          const recommended = modelNames.find(m => m.includes('llama3.2') || m.includes('phi4') || m.includes('qwen'));
          setChatModel(recommended || modelNames[0] || '');
          setOllamaStatus('connected');
        } else {
          setOllamaStatus('error');
          setError('无法连接到 Ollama');
        }
      } catch {
        setOllamaStatus('error');
        setError('无法连接到 Ollama，请确保 Ollama 已启动');
      }
    } else {
      // For cloud providers, test the connection
      setOllamaStatus('checking');
      setError(null);
      try {
        const response = await fetch('/api/v1/llm/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            api_key: apiKey,
            base_url: apiBaseUrl,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setModels(data.models || []);
            if (data.models && data.models.length > 0) {
              setChatModel(data.models[0]);
            }
            setOllamaStatus('connected');
          } else {
            setOllamaStatus('error');
            setError(data.error || '连接失败');
          }
        } else {
          setOllamaStatus('error');
          setError('连接测试失败');
        }
      } catch {
        setOllamaStatus('error');
        setError('无法连接到后端服务');
      }
    }
  };

  const initDirectories = async () => {
    setDirInitStatus('checking');
    try {
      const res = await fetch('/api/v1/dirs/init', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDirInitStatus(data.ready ? 'ready' : 'error');
      } else {
        setDirInitStatus('error');
      }
    } catch {
      setDirInitStatus('error');
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      // Save custom directories before proceeding
      if (currentStep === 2) {
        setIsEditingDirs(false);
        // In a real app, you would save the custom paths to backend here
        // await fetch('/api/v1/dirs/update', { method: 'POST', body: JSON.stringify({ workspaceDir, knowledgeDir, dbPath }) });
      }
      setIsBack(false);
      setStepKey(currentStep + 1);
      setCurrentStep(currentStep + 1);
    } else {
      setIsComplete(true);
    }
  };

  useEffect(() => {
    if (isComplete) {
      onComplete();
      navigate('/');
    }
  }, [isComplete]);

  const handleBack = () => {
    if (currentStep > 1) {
      setIsBack(true);
      setStepKey(currentStep - 1);
      setCurrentStep(currentStep - 1);
    }
  };

  const createDefaultAgents = async () => {
    setIsCreatingAgents(true);
    try {
      const response = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName || '默认助手',
          role: agentRole,
          description: agentDescription,
          system_prompt: agentRole === 'supervisor'
            ? '你是一个主管代理，负责协调工作代理完成复杂任务。'
            : '你是一个有用的 AI 助手，可以帮助用户完成各种任务。',
          llm_config: {
            provider: selectedProvider,
            model_name: chatModel || 'llama3.2',
            api_key: selectedProvider !== 'ollama' ? apiKey : undefined,
            base_url: selectedProvider !== 'ollama' ? apiBaseUrl : undefined,
          },
        }),
      });
      if (response.ok) {
        setCurrentStep(4);
      } else {
        setError('创建 Agent 失败');
      }
    } catch {
      setError('创建 Agent 失败，请重试');
    } finally {
      setIsCreatingAgents(false);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-secondary" size={40} />
          </div>
          <h1 className="text-3xl font-display font-bold text-on-surface mb-4">设置完成</h1>
          <p className="text-on-surface-variant mb-8">
            DigitalCrew 已准备就绪，正在跳转...
          </p>
          <Loader2 className="animate-spin text-primary mx-auto" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1326] flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold text-on-surface mb-3">
            DigitalCrew
          </h1>
          <p className="text-on-surface-variant">首次设置向导</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-12 relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-outline-variant/20 -z-10" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 -z-10"
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          />
          {STEPS.map((step) => (
            <div key={step.id} className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  currentStep >= step.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-outline'
                )}
              >
                {currentStep > step.id ? (
                  <CheckCircle size={20} />
                ) : (
                  step.icon
                )}
              </div>
              <span className="mt-2 text-xs font-sans text-on-surface-variant">
                {step.title}
              </span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div key={stepKey} className={cn(
          'bg-surface-container rounded-2xl p-8 mb-8 min-h-[280px] flex flex-col',
          isBack ? 'step-content-back' : 'step-content-enter'
        )}>
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-display font-bold text-on-surface mb-6">
                选择模型来源
              </h2>

              {/* Provider Selection */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {MODEL_SOURCES.map((source) => (
                  <button
                    key={source.provider}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(source.provider);
                      setOllamaStatus('idle');
                      setError(null);
                    }}
                    className={cn(
                      'p-4 rounded-lg border text-left transition-all',
                      selectedProvider === source.provider
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-outline'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {source.icon}
                      <span className="font-medium">{source.name}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant/70">{source.description}</p>
                  </button>
                ))}
              </div>

              {/* Cloud Provider Config */}
              {selectedProvider !== 'ollama' && (
                <div className="space-y-4 mb-6 p-4 bg-surface-container-lowest rounded-lg">
                  <div>
                    <label className="block text-sm text-on-surface-variant mb-2">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={apiBaseUrl}
                      onChange={(e) => { setApiBaseUrl(e.target.value); setOllamaStatus('idle'); }}
                      placeholder="https://api.openai.com/v1 或自定义地址"
                      className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-on-surface-variant mb-2">
                      API Key
                    </label>
                    <div className="relative">
                      <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => { setApiKey(e.target.value); setOllamaStatus('idle'); }}
                        placeholder="输入 API Key"
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-lg pl-10 pr-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-on-surface-variant mb-2">
                      模型名称
                    </label>
                    <input
                      type="text"
                      value={chatModel}
                      onChange={(e) => { setChatModel(e.target.value); setOllamaStatus('idle'); }}
                      placeholder={selectedProvider === 'openai' ? 'gpt-4o' : selectedProvider === 'claude' ? 'claude-3-5-sonnet' : 'moe-20251201'}
                      className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Connection Status */}
              {selectedProvider === 'ollama' ? (
                <>
                  {ollamaStatus === 'checking' && (
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <Loader2 className="animate-spin" size={20} />
                      <span>正在检查 Ollama 状态...</span>
                    </div>
                  )}
                  {ollamaStatus === 'connected' && (
                    <>
                      <div className="flex items-center gap-3 text-secondary mb-6">
                        <CheckCircle size={20} />
                        <span>Ollama 连接正常</span>
                      </div>
                      {models.length > 0 ? (
                        <div>
                          <p className="text-sm text-on-surface-variant mb-3">可用模型：</p>
                          <div className="flex flex-wrap gap-2">
                            {models.map((model) => (
                              <span
                                key={model}
                                className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full border border-primary/30"
                              >
                                {model}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-outline mt-4">
                            推荐使用 llama3.2 或 phi4 作为对话模型
                          </p>
                        </div>
                      ) : (
                        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                          <p className="text-warning mb-3">未检测到模型，请先下载模型</p>
                          <p className="text-xs text-outline mb-3">在终端运行以下命令下载 llama3.2：</p>
                          <code className="text-sm text-on-surface bg-surface-container-lowest px-3 py-2 rounded block mb-4">ollama pull llama3.2</code>
                          <button
                            onClick={checkConnection}
                            className="w-full py-2 bg-warning/10 hover:bg-warning/20 text-warning rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={14} />
                            重新检查模型
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {ollamaStatus === 'error' && (
                    <div className="animate-[fade-in_0.3s_ease-out]">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-3 text-red-400 mb-2">
                          <Circle size={20} />
                          <span className="font-medium">{error}</span>
                        </div>
                        <p className="text-red-400/70 text-sm">请确保 Ollama 已启动并正在运行</p>
                      </div>
                      <div className="bg-surface-container-lowest rounded-lg p-4 font-mono text-sm mb-4">
                        <p className="text-outline mb-2">启动 Ollama：</p>
                        <code className="text-on-surface">brew install ollama && ollama serve</code>
                      </div>
                      <button
                        onClick={checkConnection}
                        className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={16} className={ollamaStatus === 'checking' ? 'animate-spin' : ''} />
                        {ollamaStatus === 'checking' ? '检查中...' : '重新检查连接'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {ollamaStatus === 'idle' && (
                    <div className="text-center py-8">
                      <p className="text-on-surface-variant mb-4">
                        配置好 API 参数后，点击下方按钮测试连接
                      </p>
                    </div>
                  )}
                  {ollamaStatus === 'checking' && (
                    <div className="flex items-center gap-3 text-on-surface-variant">
                      <Loader2 className="animate-spin" size={20} />
                      <span>正在测试连接...</span>
                    </div>
                  )}
                  {ollamaStatus === 'connected' && (
                    <div className="flex items-center gap-3 text-secondary mb-6">
                      <CheckCircle size={20} />
                      <span>连接成功</span>
                    </div>
                  )}
                  {ollamaStatus === 'error' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-3 text-red-400 mb-2">
                        <Circle size={20} />
                        <span className="font-medium">{error}</span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={checkConnection}
                    disabled={selectedProvider !== 'ollama' && (!apiKey || !chatModel)}
                    className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={ollamaStatus === 'checking' ? 'animate-spin' : ''} />
                    {ollamaStatus === 'checking' ? '测试中...' : '测试连接'}
                  </button>
                </>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-display font-bold text-on-surface mb-6">
                配置数据目录
              </h2>
              {dirInitStatus === 'checking' && (
                <div className="flex items-center gap-3 text-on-surface-variant mb-6">
                  <Loader2 className="animate-spin" size={20} />
                  <span>正在初始化目录...</span>
                </div>
              )}
              {dirInitStatus === 'ready' && (
                <>
                  <div className="flex items-center gap-3 text-secondary mb-6">
                    <CheckCircle size={20} />
                    <span>目录初始化完成</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-on-surface-variant mb-2">
                        工作空间目录
                      </label>
                      {isEditingDirs ? (
                        <input
                          type="text"
                          value={workspaceDir}
                          onChange={(e) => setWorkspaceDir(e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      ) : (
                        <div className="bg-surface-container-lowest rounded-lg p-4 font-mono text-sm text-outline flex items-center justify-between">
                          <span>{workspaceDir}</span>
                          <button
                            onClick={() => setIsEditingDirs(true)}
                            className="text-xs text-primary hover:text-primary/80"
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-on-surface-variant mb-2">
                        知识库目录
                      </label>
                      {isEditingDirs ? (
                        <input
                          type="text"
                          value={knowledgeDir}
                          onChange={(e) => setKnowledgeDir(e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      ) : (
                        <div className="bg-surface-container-lowest rounded-lg p-4 font-mono text-sm text-outline flex items-center justify-between">
                          <span>{knowledgeDir}</span>
                          <button
                            onClick={() => setIsEditingDirs(true)}
                            className="text-xs text-primary hover:text-primary/80"
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-on-surface-variant mb-2">
                        数据库路径
                      </label>
                      {isEditingDirs ? (
                        <input
                          type="text"
                          value={dbPath}
                          onChange={(e) => setDbPath(e.target.value)}
                          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      ) : (
                        <div className="bg-surface-container-lowest rounded-lg p-4 font-mono text-sm text-outline flex items-center justify-between">
                          <span>{dbPath}</span>
                          <button
                            onClick={() => setIsEditingDirs(true)}
                            className="text-xs text-primary hover:text-primary/80"
                          >
                            编辑
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isEditingDirs && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => {
                          setWorkspaceDir('~/DigitalCrew/workspace');
                          setKnowledgeDir('~/DigitalCrew/knowledge');
                          setDbPath('~/DigitalCrew/data/db.sqlite');
                          setIsEditingDirs(false);
                        }}
                        className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                      >
                        重置为默认
                      </button>
                    </div>
                  )}
                </>
              )}
              {dirInitStatus === 'error' && (
                <div className="flex items-center gap-3 text-red-400">
                  <Circle size={20} />
                  <span>目录初始化失败，请检查权限</span>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-display font-bold text-on-surface mb-6">
                创建默认 Agent
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-on-surface-variant mb-2">
                    Agent 名称
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="输入 Agent 名称"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-on-surface-variant mb-2">
                    角色类型
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAgentRole('worker')}
                      className={cn(
                        'p-3 rounded-lg border text-sm font-medium transition-all',
                        agentRole === 'worker'
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-outline'
                      )}
                    >
                      <Users size={16} className="mx-auto mb-1" />
                      工作代理
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentRole('supervisor')}
                      className={cn(
                        'p-3 rounded-lg border text-sm font-medium transition-all',
                        agentRole === 'supervisor'
                          ? 'bg-secondary/10 border-secondary text-secondary'
                          : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:border-outline'
                      )}
                    >
                      <Bot size={16} className="mx-auto mb-1" />
                      主管代理
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-on-surface-variant mb-2">
                    对话模型
                  </label>
                  {selectedProvider === 'ollama' && models.length > 0 ? (
                    <select
                      value={chatModel}
                      onChange={(e) => setChatModel(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                    >
                      <option value="">选择模型</option>
                      {models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={chatModel}
                      onChange={(e) => setChatModel(e.target.value)}
                      placeholder={
                        selectedProvider === 'ollama'
                          ? 'llama3.2'
                          : selectedProvider === 'openai'
                            ? 'gpt-4o'
                            : selectedProvider === 'claude'
                              ? 'claude-3-5-sonnet'
                              : 'moe-20251201'
                      }
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm text-on-surface-variant mb-2">
                    描述
                  </label>
                  <textarea
                    value={agentDescription}
                    onChange={(e) => setAgentDescription(e.target.value)}
                    placeholder="描述此 Agent 的职责..."
                    rows={2}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:outline-none resize-none"
                  />
                </div>
                {/* Agent Preview Card */}
                <div className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/20">
                  <p className="text-xs text-outline mb-3">Agent 预览</p>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      {agentRole === 'worker' ? (
                        <Users size={18} className="text-primary" />
                      ) : (
                        <Bot size={18} className="text-secondary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-on-surface">{agentName || '未命名 Agent'}</span>
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          agentRole === 'worker' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                        )}>
                          {agentRole === 'worker' ? 'WORKER' : 'SUPERVISOR'}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">{agentDescription || '暂无描述'}</p>
                      <p className="text-xs text-outline mt-2 font-mono">{chatModel || '未选择模型'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6 animate-[fade-in_0.5s_ease-out]">
                <CheckCircle className="text-secondary" size={40} />
              </div>
              <h2 className="text-2xl font-display font-bold text-on-surface mb-3 animate-[fade-in-up_0.5s_ease-out_0.1s_both]">
                设置完成
              </h2>
              <p className="text-on-surface-variant mb-6 animate-[fade-in-up_0.5s_ease-out_0.2s_both]">
                {agentName} 已创建完成，正在启动 DigitalCrew...
              </p>
              <div className="bg-surface-container-lowest rounded-lg p-4 text-left w-full max-w-sm animate-[fade-in-up_0.5s_ease-out_0.3s_both]">
                <div className="flex items-center gap-3 mb-3">
                  {agentRole === 'worker' ? (
                    <Users size={16} className="text-primary" />
                  ) : (
                    <Bot size={16} className="text-secondary" />
                  )}
                  <span className="text-sm text-on-surface">{agentName}</span>
                  <span className="px-2 py-0.5 bg-secondary/20 text-secondary text-xs rounded-full">就绪</span>
                </div>
                <p className="text-xs text-outline font-mono">{chatModel || 'llama3.2'}</p>
              </div>
              <Loader2 className="animate-spin text-primary mt-8" size={24} />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={cn(
              'px-6 py-3 rounded-lg font-sans font-medium transition-colors',
              currentStep === 1
                ? 'text-outline cursor-not-allowed'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            )}
          >
            上一步
          </button>
          <button
            onClick={currentStep === 3 ? createDefaultAgents : handleNext}
            disabled={
              (currentStep === 1 && (
                (selectedProvider === 'ollama' && ollamaStatus !== 'connected') ||
                (selectedProvider !== 'ollama' && ollamaStatus !== 'connected')
              )) ||
              (currentStep === 2 && dirInitStatus !== 'ready') ||
              (currentStep === 3 && isCreatingAgents)
            }
            className={cn(
              'px-6 py-3 rounded-lg font-sans font-medium flex items-center gap-2 transition-colors',
              'bg-primary text-on-primary hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isCreatingAgents ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                创建中...
              </>
            ) : currentStep === 3 ? (
              '创建并继续'
            ) : currentStep === 4 ? (
              '完成'
            ) : isEditingDirs ? (
              '保存并继续'
            ) : (
              <>
                下一步
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}