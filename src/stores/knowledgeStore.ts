/**
 * Zustand store for knowledge base state management
 */
import { create } from 'zustand';
import type { KnowledgeBase, Document } from '../types/api';
import { knowledgeApi } from '../services/api';

interface KnowledgeState {
  knowledgeBases: KnowledgeBase[];
  selectedKBId: string | null;
  documents: Document[];
  isLoading: boolean;
  isUploading: boolean;
  uploadProgress: number;
  isReindexing: boolean;
  reindexProgress: number;
  error: string | null;
  searchQuery: string;
  searchResults: Array<{ content: string; score: number; doc_id: string; source_file?: string; page_number?: number | null }>;

  fetchKnowledgeBases: () => Promise<void>;
  createKnowledgeBase: (name: string, embedding_model?: string) => Promise<void>;
  deleteKnowledgeBase: (kbId: string) => Promise<void>;
  selectKnowledgeBase: (kbId: string | null) => void;
  fetchDocuments: (kbId: string) => Promise<void>;
  uploadDocument: (kbId: string, file: File, onProgress?: (progress: number) => void) => Promise<void>;
  deleteDocument: (kbId: string, docId: string) => Promise<void>;
  reindexKnowledgeBase: (kbId: string) => Promise<void>;
  search: (kbId: string, query: string) => Promise<void>;
  clearError: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: [],
  selectedKBId: null,
  documents: [],
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  isReindexing: false,
  reindexProgress: 0,
  error: null,
  searchQuery: '',
  searchResults: [],

  fetchKnowledgeBases: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await knowledgeApi.list();
      set({ knowledgeBases: response.knowledge_bases as KnowledgeBase[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createKnowledgeBase: async (name, embedding_model = 'nomic-embed-text') => {
    set({ isLoading: true, error: null });
    try {
      await knowledgeApi.create({
        name,
        embedding_provider: 'ollama',
        embedding_model,
      });
      await get().fetchKnowledgeBases();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteKnowledgeBase: async (kbId) => {
    set({ isLoading: true, error: null });
    try {
      await knowledgeApi.delete(kbId);
      set((state) => ({
        knowledgeBases: state.knowledgeBases.filter(kb => kb.id !== kbId),
        selectedKBId: state.selectedKBId === kbId ? null : state.selectedKBId,
        isLoading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  selectKnowledgeBase: (kbId) => {
    set({ selectedKBId: kbId, documents: [], searchResults: [] });
    if (kbId) {
      get().fetchDocuments(kbId);
    }
  },

  fetchDocuments: async (kbId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await knowledgeApi.getStats(kbId);
      set({ documents: response.documents as unknown as Document[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  uploadDocument: async (kbId, file, onProgress) => {
    set({ isUploading: true, uploadProgress: 0, error: null });
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/v1/knowledge/${kbId}/documents`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          set({ uploadProgress: progress });
          onProgress?.(progress);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            await get().fetchDocuments(kbId);
          } catch {
            // ignore fetch errors for empty KB
          }
          set({ isUploading: false, uploadProgress: 100 });
          resolve();
        } else {
          set({ error: `Upload failed: ${xhr.statusText}`, isUploading: false, uploadProgress: 0 });
          reject(new Error(xhr.statusText));
        }
      };

      xhr.onerror = () => {
        set({ error: 'Network error during upload', isUploading: false, uploadProgress: 0 });
        reject(new Error('Network error'));
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  },

  deleteDocument: async (kbId, docId) => {
    set({ isLoading: true, error: null });
    try {
      await knowledgeApi.deleteDocument(kbId, docId);
      await get().fetchDocuments(kbId);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  reindexKnowledgeBase: async (kbId) => {
    set({ isReindexing: true, reindexProgress: 0, error: null });
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 90) {
        clearInterval(interval);
        progress = 90;
      }
      set({ reindexProgress: Math.min(progress, 90) });
    }, 500);

    try {
      await knowledgeApi.reindex(kbId);
      clearInterval(interval);
      set({ isReindexing: false, reindexProgress: 100 });
      await get().fetchDocuments(kbId);
    } catch (err) {
      clearInterval(interval);
      set({ error: (err as Error).message, isReindexing: false, reindexProgress: 0 });
    }
  },

  search: async (kbId, query) => {
    set({ searchQuery: query, isLoading: true, error: null });
    try {
      const response = await knowledgeApi.search(kbId, query);
      set({
        searchResults: response.results.map(r => ({
          content: r.content,
          score: r.relevance_score,
          doc_id: r.doc_id,
          source_file: r.source_file,
          page_number: r.page_number,
        })),
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));