import React, { useEffect, useState } from 'react';
import { Users, Cpu, HardDrive, UserPlus, SearchCode, X, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AgentCard from '../components/dashboard/AgentCard';
import AgentModal from '../components/modals/AgentModal';
import AgentEditModal from '../components/modals/AgentEditModal';
import { useAgentStore } from '../stores/agentStore';
import { useSystemStore } from '../stores/systemStore';
import type { Agent } from '../types/api';

export default function Overview() {
  const { agents, fetchAgents, isLoading, createAgent, startAgent, pauseAgent, resumeAgent } = useAgentStore();
  const { models, fetchModels } = useSystemStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [viewingMemoryAgent, setViewingMemoryAgent] = useState<{ id: string; name: string } | null>(null);
  const [memoryData, setMemoryData] = useState<unknown[]>([]);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'supervisor' | 'worker'>('all');

  useEffect(() => {
    fetchAgents();
    fetchModels();
    const interval = setInterval(() => {
      fetchAgents();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents, fetchModels]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else if (showMemoryModal) setShowMemoryModal(false);
        else if (showEditModal) { setShowEditModal(false); setEditingAgent(null); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm, showMemoryModal, showEditModal]);

  const handleCreateAgent = async (data: {
    name: string;
    description: string;
    role: 'supervisor' | 'worker';
    model_name: string;
    system_prompt: string;
    tool_permissions: Array<{ tool_name: string; enabled: boolean }>;
  }) => {
    setIsCreating(true);
    try {
      await createAgent({
        name: data.name,
        description: data.description,
        role: data.role,
        model_name: data.model_name,
        system_prompt: data.system_prompt,
        tool_permissions: data.tool_permissions,
      });
      toast.success(`代理 "${data.name}" 创建成功`);
      setShowCreateModal(false);
    } catch (err) {
      toast.error('创建代理失败');
    } finally {
      setIsCreating(false);
    }
  };

  const activeCount = agents.filter(a => a.status === 'running' || a.status === 'idle').length;

  const filteredAgents = agents.filter(a => {
    const matchesSearch = searchQuery === '' ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || a.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleStartAgent = async (agentId: string) => {
    try {
      await startAgent(agentId);
      toast.success('代理启动成功');
    } catch (err) {
      toast.error('启动代理失败');
    }
  };

  const handlePauseAgent = async (agentId: string) => {
    try {
      await pauseAgent(agentId);
      toast.success('代理已暂停');
    } catch (err) {
      toast.error('暂停代理失败');
    }
  };

  const handleResumeAgent = async (agentId: string) => {
    try {
      await resumeAgent(agentId);
      toast.success('代理已恢复');
    } catch (err) {
      toast.error('恢复代理失败');
    }
  };

  const handleEditAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setEditingAgent(agent);
      setShowEditModal(true);
    }
  };

  const handleUpdateAgent = async (data: {
    name: string;
    description: string;
    role: 'supervisor' | 'worker';
    model_name: string;
    system_prompt: string;
    tool_permissions: Array<{ tool_name: string; enabled: boolean }>;
  }) => {
    if (!editingAgent) return;
    try {
      await useAgentStore.getState().updateAgent(editingAgent.id, {
        name: data.name,
        description: data.description,
        role: data.role,
        system_prompt: data.system_prompt,
        tool_permissions: data.tool_permissions,
      });
      setShowEditModal(false);
      setEditingAgent(null);
    } catch (err) {
      toast.error('更新代理失败');
    }
  };

  const handleViewMemory = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setViewingMemoryAgent({ id: agent.id, name: agent.name });
      setShowMemoryModal(true);
      setIsLoadingMemory(true);
      try {
        const response = await fetch(`/api/v1/agents/${agentId}/memory/episodic`);
        const data = await response.json();
        setMemoryData(data.memories || []);
      } catch (err) {
        console.error('Failed to fetch memory:', err);
        setMemoryData([]);
      } finally {
        setIsLoadingMemory(false);
      }
    }
  };

  const handleDeleteAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setDeletingAgent({ id: agent.id, name: agent.name });
      setShowDeleteConfirm(true);
    }
  };

  const confirmDeleteAgent = async () => {
    if (deletingAgent) {
      try {
        await useAgentStore.getState().deleteAgent(deletingAgent.id);
        toast.success(`代理 "${deletingAgent.name}" 已删除`);
        setShowDeleteConfirm(false);
        setDeletingAgent(null);
      } catch (err) {
        toast.error('删除代理失败');
      }
    }
  };

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
              <p className="font-mono text-[24px] font-bold text-on-surface leading-none">{activeCount} <span className="text-outline/50 text-[14px] font-normal">/ {agents.length}</span></p>
            </div>
          </div>

          {/* Summary Widget 2 */}
          <div className="glass-panel rounded-xl p-5 flex-1 sm:w-72 flex flex-col justify-center gap-3 border-t border-t-white/10">
            <div className="flex justify-between items-center">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest flex items-center gap-2">
                <Cpu size={14} className="text-outline/70" /> 本地模型
              </span>
              <span className="font-mono text-[13px] text-primary font-medium">
                {models?.model_count ?? 0} 实例
              </span>
            </div>
            <div className="w-full h-px bg-white/5" />
            <div className="flex justify-between items-center">
              <span className="font-label text-[10px] text-outline uppercase tracking-widest flex items-center gap-2">
                <HardDrive size={14} className="text-outline/70" /> 显存占用
              </span>
              <span className="font-mono text-[13px] text-tertiary font-medium">
                {models?.total_vram_gb ?? 0} GB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Agent Banner */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full glass-panel rounded-2xl p-8 border border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-500 group flex items-center justify-center gap-6"
      >
        <div className="w-14 h-14 rounded-full bg-surface-container border border-white/5 flex items-center justify-center text-outline group-hover:text-primary group-hover:border-primary/30 group-hover:bg-primary/10 transition-all duration-500 relative">
          <UserPlus size={28} strokeWidth={1.5} />
        </div>
        <div className="text-left">
          <h3 className="font-display text-[20px] text-on-surface group-hover:text-primary transition-colors font-semibold tracking-tight">新增数字员工</h3>
          <p className="font-sans text-[14px] text-outline mt-1 text-on-surface-variant/60">配置新的本地代理或连接远程服务</p>
        </div>
      </button>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索代理..."
            className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2.5 pl-10 font-sans text-sm text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors"
          />
          <SearchCode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
        </div>
        <div className="flex gap-2">
          {(['all', 'supervisor', 'worker'] as const).map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label uppercase tracking-widest transition-all ${
                roleFilter === role
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-surface border border-white/10 text-outline hover:text-on-surface'
              }`}
            >
              {role === 'all' ? '全部' : role === 'supervisor' ? '主管' : '工作'}
            </button>
          ))}
        </div>
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <AgentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateAgent}
          models={models?.models?.map((m: { name: string }) => m.name) || []}
        />
      )}

      {/* Agent Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel rounded-xl p-6 animate-pulse">
              <div className="h-24 bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <AgentCard
              agentId={agent.id}
              name={agent.name}
              role={agent.role}
              status={agent.status}
              description={agent.description}
              metrics={agent.metrics}
              onStart={handleStartAgent}
              onPause={handlePauseAgent}
              onResume={handleResumeAgent}
              onEdit={handleEditAgent}
              onMemory={handleViewMemory}
              onDelete={handleDeleteAgent}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-on-surface-variant">
          <p className="font-sans text-lg mb-2">{agents.length === 0 ? '暂无代理' : '未找到匹配的代理'}</p>
          <p className="font-sans text-sm">{agents.length === 0 ? '点击上方按钮创建您的第一个数字员工' : '尝试调整搜索条件或筛选器'}</p>
        </div>
      )}

      {/* Edit Agent Modal */}
      {showEditModal && editingAgent && (
        <AgentEditModal
          isOpen={showEditModal}
          agent={editingAgent}
          onClose={() => {
            setShowEditModal(false);
            setEditingAgent(null);
          }}
          onSubmit={handleUpdateAgent}
          models={models?.models?.map((m: { name: string }) => m.name) || []}
        />
      )}

      {/* Memory Modal */}
      {showMemoryModal && viewingMemoryAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMemoryModal(false)} />
          <div className="relative w-full max-w-lg bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="font-display text-xl font-bold text-on-surface">{viewingMemoryAgent.name} - 记忆</h2>
              <button
                onClick={() => setShowMemoryModal(false)}
                className="p-2 text-outline hover:text-on-surface transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingMemory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : memoryData.length > 0 ? (
                <div className="space-y-4">
                  {memoryData.map((mem: any, idx: number) => (
                    <div key={idx} className="bg-surface border border-white/5 rounded-lg p-4">
                      <p className="font-sans text-sm text-on-surface">{mem.content || mem.text || JSON.stringify(mem)}</p>
                      <p className="font-mono text-[10px] text-outline mt-2">{mem.timestamp || mem.created_at || ''}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-outline py-8">暂无记忆数据</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                  <Trash2 size={20} className="text-error" />
                </div>
                <h2 className="font-display text-lg font-bold text-on-surface">删除代理</h2>
              </div>
              <p className="text-on-surface-variant text-sm mb-6">
                确定要删除代理 <span className="font-semibold text-on-surface">{deletingAgent.name}</span> 吗？此操作不可撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-on-surface font-label text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteAgent}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-error text-white font-label text-[11px] uppercase tracking-widest hover:bg-error/90 transition-all"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
