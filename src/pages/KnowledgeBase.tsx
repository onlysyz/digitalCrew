import React, { useEffect, useState, useRef } from 'react';
import {
  BookOpen,
  Upload,
  Search,
  Trash2,
  RefreshCw,
  FileText,
  Database,
  Plus,
  X,
  Loader2,
  ChevronRight,
  File,
  Archive,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import type { KnowledgeBase, Document } from '../types/api';

export default function KnowledgeBasePage() {
  const {
    knowledgeBases,
    selectedKBId,
    documents,
    isLoading,
    isUploading,
    uploadProgress,
    isReindexing,
    reindexProgress,
    error,
    searchQuery,
    searchResults,
    fetchKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    selectKnowledgeBase,
    uploadDocument,
    deleteDocument,
    reindexKnowledgeBase,
    search,
  } = useKnowledgeStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const selectedKB = knowledgeBases.find(kb => kb.id === selectedKBId);

  const handleCreateKB = async () => {
    if (!newKBName.trim()) return;
    setIsCreating(true);
    try {
      await createKnowledgeBase(newKBName);
      setShowCreateModal(false);
      setNewKBName('');
      toast.success(`知识库"${newKBName}"创建成功`);
    } catch (err) {
      console.error('Failed to create KB:', err);
      toast.error('创建知识库失败，请重试');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !selectedKBId) return;
    const fileCount = files.length;
    for (const file of Array.from(files)) {
      toast.promise(uploadDocument(selectedKBId, file), {
        loading: `上传"${file.name}"中...`,
        success: `"${file.name}"上传成功`,
        error: `"${file.name}"上传失败`,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedKBId && searchInput.trim()) {
      search(selectedKBId, searchInput);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-[1440px] mx-auto p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-display text-[32px] font-bold text-on-surface mb-2 tracking-tight">知识库</h1>
          <p className="font-sans text-[14px] text-on-surface-variant/70">管理和检索您的文档知识库</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label text-[12px] uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          新建知识库
        </button>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar: Knowledge Base List */}
        <aside className="w-72 flex-shrink-0 bg-surface-container-high rounded-xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="font-label text-[10px] text-outline uppercase tracking-widest">知识库列表</h3>
          </div>
          <div className="p-2">
            {knowledgeBases.length === 0 ? (
              <div className="text-center p-6">
                <Database size={32} className="text-outline mx-auto mb-3 opacity-50" />
                <p className="font-sans text-[13px] text-on-surface-variant mb-3">暂无知识库</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-primary hover:text-primary/80 transition-colors font-sans text-[12px] flex items-center gap-1 mx-auto"
                >
                  <Plus size={14} />
                  新建知识库
                </button>
              </div>
            ) : (
              knowledgeBases.map((kb) => (
                <button
                  key={kb.id}
                  onClick={() => selectKnowledgeBase(kb.id)}
                  className={cn(
                    'w-full p-3 rounded-lg text-left transition-all flex items-start gap-3',
                    selectedKBId === kb.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-white/5 border border-transparent'
                  )}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    selectedKBId === kb.id ? 'bg-primary/20 text-primary' : 'bg-surface text-outline'
                  )}>
                    <Database size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[13px] font-semibold text-on-surface truncate">{kb.name}</p>
                    <p className="font-sans text-[10px] text-on-surface-variant">
                      {kb.document_count} 文档 · {kb.total_chunks} chunks
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/5 font-mono text-[9px] text-on-surface-variant">
                        {kb.embedding_model}
                      </span>
                    </div>
                  </div>
                  {selectedKBId === kb.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Content: Document Management */}
        <div className="flex-1 space-y-6">
          {selectedKB ? (
            <>
              {/* KB Header */}
              <div className="bg-surface-container-high rounded-xl border border-white/5 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-display text-[22px] font-bold text-on-surface mb-1">{selectedKB.name}</h2>
                    <p className="font-sans text-[13px] text-on-surface-variant">
                      基于 {selectedKB.embedding_model} · {selectedKB.document_count} 个文档
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {isReindexing ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/30">
                        <Loader2 size={16} className="text-primary animate-spin" />
                        <span className="font-mono text-[11px] text-primary">{reindexProgress.toFixed(0)}%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => reindexKnowledgeBase(selectedKB.id)}
                        className="p-2.5 rounded-lg border border-outline-variant/30 text-outline hover:text-primary hover:border-primary transition-all"
                        title="重新索引"
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('确定删除此知识库？')) {
                          deleteKnowledgeBase(selectedKB.id);
                        }
                      }}
                      className="p-2.5 rounded-lg border border-outline-variant/30 text-outline hover:text-error hover:border-error transition-all"
                      title="删除知识库"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-surface border border-outline-variant/30 rounded-lg px-4 py-2.5 focus-within:border-primary/50 transition-all">
                    <Search size={18} className="text-outline" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="搜索知识库内容..."
                      className="flex-1 bg-transparent border-none focus:outline-none font-sans text-sm text-on-surface placeholder-on-surface-variant/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!searchInput.trim()}
                    className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-label text-[11px] uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    搜索
                  </button>
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="font-label text-[10px] text-outline uppercase tracking-widest">
                      搜索结果 ({searchResults.length})
                    </h4>
                    {searchResults.map((result, i) => (
                      <div key={i} className="bg-surface p-4 rounded-lg border border-white/5">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className="font-sans text-[13px] text-on-surface flex-1">{result.content}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              'font-mono text-[10px] px-2 py-1 rounded',
                              result.score >= 0.8 ? 'bg-primary/20 text-primary' :
                              result.score >= 0.5 ? 'bg-warning/20 text-warning' :
                              'bg-white/5 text-outline'
                            )}>
                              {(result.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        {'source_file' in result && result.source_file && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                            <File size={12} className="text-outline" />
                            <span className="font-mono text-[10px] text-outline">{result.source_file}</span>
                            {'page_number' in result && result.page_number && (
                              <span className="font-mono text-[10px] text-outline">· 页码 {result.page_number}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all',
                  isDragging ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/50 hover:bg-white/2',
                  isUploading && 'cursor-not-allowed opacity-70'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  disabled={isUploading}
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                {isUploading ? (
                  <>
                    <div className="relative mb-3">
                      <Loader2 size={32} className="text-primary animate-spin" />
                    </div>
                    <p className="font-display text-[16px] text-on-surface mb-2">上传中...</p>
                    <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="font-mono text-[11px] text-on-surface-variant mt-1">{uploadProgress}%</p>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-outline mb-3" />
                    <p className="font-display text-[16px] text-on-surface mb-1">拖拽文件至此或点击上传</p>
                    <p className="font-sans text-[12px] text-on-surface-variant">支持 PDF, TXT, Markdown, CSV 格式</p>
                  </>
                )}
              </div>

              {/* Document List */}
              <div className="bg-surface-container-high rounded-xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                  <h3 className="font-label text-[11px] font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} className="text-primary/70" />
                    文档列表 ({documents.length})
                  </h3>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center p-12">
                    <Archive size={48} className="text-outline mx-auto mb-4 opacity-50" />
                    <p className="font-display text-[14px] text-on-surface mb-1">暂无文档</p>
                    <p className="font-sans text-[12px] text-on-surface-variant/60 mb-4">拖拽文件至上方或点击上传区域添加文档</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-primary hover:text-primary/80 transition-colors font-sans text-[12px] flex items-center gap-1 mx-auto"
                    >
                      <Upload size={14} />
                      立即上传
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-4 flex items-center gap-4 hover:bg-white/2 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-outline">
                          <File size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-[14px] font-semibold text-on-surface truncate">{doc.filename}</p>
                          <p className="font-sans text-[11px] text-on-surface-variant">
                            {formatFileSize(doc.file_size)} · {doc.chunk_count} chunks
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setDocToDelete(doc);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-outline hover:text-error transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-surface-container-high rounded-xl border border-white/5 p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen size={32} className="text-primary" />
              </div>
              <h3 className="font-display text-[18px] text-on-surface mb-2">选择或创建知识库</h3>
              <p className="font-sans text-[13px] text-on-surface-variant max-w-md">
                在左侧选择一个知识库以管理文档，或创建新的知识库开始构建您的知识体系
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Knowledge Base Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-md bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="font-display text-xl font-bold text-on-surface">新建知识库</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-outline hover:text-on-surface transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">知识库名称</label>
                <input
                  type="text"
                  value={newKBName}
                  onChange={(e) => setNewKBName(e.target.value)}
                  placeholder="例如：产品文档、技术手册"
                  className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface placeholder-on-surface-variant/40 focus:border-primary/50 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block font-label text-[10px] text-outline uppercase tracking-widest mb-2">嵌入模型</label>
                <select className="w-full bg-surface border border-outline-variant/30 rounded-lg px-4 py-3 font-sans text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors">
                  <option value="nomic-embed-text">nomic-embed-text (默认)</option>
                </select>
                <p className="font-sans text-[11px] text-on-surface-variant mt-2">用于将文档转换为向量以便语义搜索</p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-white/5">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-on-surface font-label text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleCreateKB}
                disabled={!newKBName.trim() || isCreating}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label text-[11px] uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    创建中...
                  </>
                ) : (
                  '创建知识库'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Modal */}
      {showDeleteModal && docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-sm bg-surface-container-highest border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="font-display text-lg font-bold text-on-surface">删除文档</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-2 text-outline hover:text-on-surface transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <p className="font-display text-[14px] font-semibold text-on-surface mb-1">{docToDelete.filename}</p>
                  <p className="font-sans text-[12px] text-on-surface-variant">
                    {formatFileSize(docToDelete.file_size)} · {docToDelete.chunk_count} chunks
                  </p>
                </div>
              </div>
              <p className="font-sans text-[13px] text-on-surface-variant">
                确定要删除此文档吗？此操作不可撤销。
              </p>
            </div>

            <div className="flex gap-3 p-6 border-t border-white/5">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-on-surface font-label text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (selectedKBId && docToDelete) {
                    setDeletingDocId(docToDelete.id);
                    setShowDeleteModal(false);
                    try {
                      await deleteDocument(selectedKBId, docToDelete.id);
                      toast.success(`文档"${docToDelete.filename}"已删除`);
                    } catch {
                      toast.error('删除文档失败，请重试');
                    } finally {
                      setDeletingDocId(null);
                      setDocToDelete(null);
                    }
                  }
                }}
                disabled={deletingDocId === docToDelete.id}
                className="flex-1 px-4 py-2.5 rounded-lg bg-error text-white font-label text-[11px] uppercase tracking-widest hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {deletingDocId === docToDelete.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}