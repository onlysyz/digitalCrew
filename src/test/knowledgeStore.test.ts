import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import { knowledgeApi } from '../services/api';

vi.mock('../services/api', () => ({
  knowledgeApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getStats: vi.fn(),
    deleteDocument: vi.fn(),
    reindex: vi.fn(),
    search: vi.fn(),
  },
}));

describe('KnowledgeStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useKnowledgeStore.setState({
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
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('has empty knowledgeBases array', () => {
      const { knowledgeBases } = useKnowledgeStore.getState();
      expect(knowledgeBases).toEqual([]);
    });

    it('has null selectedKBId', () => {
      const { selectedKBId } = useKnowledgeStore.getState();
      expect(selectedKBId).toBeNull();
    });

    it('has empty documents array', () => {
      const { documents } = useKnowledgeStore.getState();
      expect(documents).toEqual([]);
    });

    it('has isLoading false', () => {
      const { isLoading } = useKnowledgeStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has isUploading false', () => {
      const { isUploading } = useKnowledgeStore.getState();
      expect(isUploading).toBe(false);
    });

    it('has uploadProgress 0', () => {
      const { uploadProgress } = useKnowledgeStore.getState();
      expect(uploadProgress).toBe(0);
    });

    it('has isReindexing false', () => {
      const { isReindexing } = useKnowledgeStore.getState();
      expect(isReindexing).toBe(false);
    });

    it('has reindexProgress 0', () => {
      const { reindexProgress } = useKnowledgeStore.getState();
      expect(reindexProgress).toBe(0);
    });

    it('has null error', () => {
      const { error } = useKnowledgeStore.getState();
      expect(error).toBeNull();
    });

    it('has empty searchQuery', () => {
      const { searchQuery } = useKnowledgeStore.getState();
      expect(searchQuery).toBe('');
    });

    it('has empty searchResults array', () => {
      const { searchResults } = useKnowledgeStore.getState();
      expect(searchResults).toEqual([]);
    });
  });

  describe('fetchKnowledgeBases', () => {
    it('sets isLoading true when fetching', async () => {
      vi.mocked(knowledgeApi.list).mockResolvedValue({ knowledge_bases: [], total: 0 });

      const promise = useKnowledgeStore.getState().fetchKnowledgeBases();

      expect(useKnowledgeStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates knowledgeBases on success', async () => {
      const mockKBs = [
        { id: 'kb-1', name: 'KB 1', embedding_model: 'nomic-embed-text' },
        { id: 'kb-2', name: 'KB 2', embedding_model: 'nomic-embed-text' },
      ];
      vi.mocked(knowledgeApi.list).mockResolvedValue({ knowledge_bases: mockKBs, total: 2 });

      await useKnowledgeStore.getState().fetchKnowledgeBases();

      expect(useKnowledgeStore.getState().knowledgeBases).toEqual(mockKBs);
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(knowledgeApi.list).mockRejectedValue(new Error('Failed to fetch'));

      await useKnowledgeStore.getState().fetchKnowledgeBases();

      expect(useKnowledgeStore.getState().error).toBe('Failed to fetch');
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });

    it('clears previous error on new fetch', async () => {
      useKnowledgeStore.setState({ error: 'Previous error' });
      vi.mocked(knowledgeApi.list).mockResolvedValue({ knowledge_bases: [], total: 0 });

      await useKnowledgeStore.getState().fetchKnowledgeBases();

      expect(useKnowledgeStore.getState().error).toBeNull();
    });
  });

  describe('createKnowledgeBase', () => {
    it('sets isLoading true when creating', async () => {
      vi.mocked(knowledgeApi.create).mockResolvedValue({ knowledge_base: {}, message: 'Created' });
      vi.mocked(knowledgeApi.list).mockResolvedValue({ knowledge_bases: [], total: 0 });

      const promise = useKnowledgeStore.getState().createKnowledgeBase('New KB');

      expect(useKnowledgeStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('calls knowledgeApi.create with name and default embedding model', async () => {
      vi.mocked(knowledgeApi.create).mockResolvedValue({ knowledge_base: {}, message: 'Created' });
      vi.mocked(knowledgeApi.list).mockResolvedValue({ knowledge_bases: [], total: 0 });

      await useKnowledgeStore.getState().createKnowledgeBase('New KB');

      expect(knowledgeApi.create).toHaveBeenCalledWith({
        name: 'New KB',
        embedding_provider: 'ollama',
        embedding_model: 'nomic-embed-text',
      });
    });

    it('calls knowledgeApi.create with custom embedding model', async () => {
      vi.mocked(knowledgeApi.create).mockResolvedValue({ knowledge_base: {}, message: 'Created' });
      vi.mocked(knowledgeApi.list).mockResolvedValue({ knowledge_bases: [], total: 0 });

      await useKnowledgeStore.getState().createKnowledgeBase('New KB', 'custom-model');

      expect(knowledgeApi.create).toHaveBeenCalledWith({
        name: 'New KB',
        embedding_provider: 'ollama',
        embedding_model: 'custom-model',
      });
    });

    it('calls fetchKnowledgeBases after successful creation', async () => {
      vi.mocked(knowledgeApi.create).mockResolvedValue({ knowledge_base: {}, message: 'Created' });
      vi.mocked(knowledgeApi.list).mockResolvedValue({ knowledge_bases: [], total: 0 });

      await useKnowledgeStore.getState().createKnowledgeBase('New KB');

      expect(knowledgeApi.list).toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
      vi.mocked(knowledgeApi.create).mockRejectedValue(new Error('Creation failed'));

      await useKnowledgeStore.getState().createKnowledgeBase('New KB');

      expect(useKnowledgeStore.getState().error).toBe('Creation failed');
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });
  });

  describe('deleteKnowledgeBase', () => {
    it('sets isLoading true when deleting', async () => {
      vi.mocked(knowledgeApi.delete).mockResolvedValue({ message: 'Deleted' });

      const promise = useKnowledgeStore.getState().deleteKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('calls knowledgeApi.delete with kbId', async () => {
      vi.mocked(knowledgeApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useKnowledgeStore.getState().deleteKnowledgeBase('kb-1');

      expect(knowledgeApi.delete).toHaveBeenCalledWith('kb-1');
    });

    it('removes knowledge base from knowledgeBases array', async () => {
      useKnowledgeStore.setState({
        knowledgeBases: [
          { id: 'kb-1', name: 'KB 1', embedding_model: 'nomic-embed-text' },
          { id: 'kb-2', name: 'KB 2', embedding_model: 'nomic-embed-text' },
        ],
      });
      vi.mocked(knowledgeApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useKnowledgeStore.getState().deleteKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().knowledgeBases).toHaveLength(1);
      expect(useKnowledgeStore.getState().knowledgeBases[0].id).toBe('kb-2');
    });

    it('clears selectedKBId if deleted KB was selected', async () => {
      useKnowledgeStore.setState({
        knowledgeBases: [{ id: 'kb-1', name: 'KB 1', embedding_model: 'nomic-embed-text' }],
        selectedKBId: 'kb-1',
      });
      vi.mocked(knowledgeApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useKnowledgeStore.getState().deleteKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().selectedKBId).toBeNull();
    });

    it('does not clear selectedKBId if different KB was selected', async () => {
      useKnowledgeStore.setState({
        knowledgeBases: [
          { id: 'kb-1', name: 'KB 1', embedding_model: 'nomic-embed-text' },
          { id: 'kb-2', name: 'KB 2', embedding_model: 'nomic-embed-text' },
        ],
        selectedKBId: 'kb-2',
      });
      vi.mocked(knowledgeApi.delete).mockResolvedValue({ message: 'Deleted' });

      await useKnowledgeStore.getState().deleteKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().selectedKBId).toBe('kb-2');
    });

    it('sets error on failure', async () => {
      vi.mocked(knowledgeApi.delete).mockRejectedValue(new Error('Delete failed'));

      await useKnowledgeStore.getState().deleteKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().error).toBe('Delete failed');
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });
  });

  describe('selectKnowledgeBase', () => {
    it('sets selectedKBId to given id', () => {
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      useKnowledgeStore.getState().selectKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().selectedKBId).toBe('kb-1');
    });

    it('clears documents when selecting new KB', () => {
      useKnowledgeStore.setState({
        documents: [{ id: 'doc-1', name: 'Doc 1', kb_id: 'kb-1' }],
      });
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      useKnowledgeStore.getState().selectKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().documents).toEqual([]);
    });

    it('clears searchResults when selecting new KB', () => {
      useKnowledgeStore.setState({
        searchResults: [{ content: 'result', score: 0.9, doc_id: 'doc-1' }],
      });
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      useKnowledgeStore.getState().selectKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().searchResults).toEqual([]);
    });

    it('calls fetchDocuments when selecting a KB', async () => {
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      useKnowledgeStore.getState().selectKnowledgeBase('kb-1');

      await vi.waitFor(() => {
        expect(knowledgeApi.getStats).toHaveBeenCalledWith('kb-1');
      });
    });

    it('sets selectedKBId to null and clears documents', () => {
      useKnowledgeStore.setState({
        documents: [{ id: 'doc-1', name: 'Doc 1', kb_id: 'kb-1' }],
      });

      useKnowledgeStore.getState().selectKnowledgeBase(null);

      expect(useKnowledgeStore.getState().selectedKBId).toBeNull();
      expect(useKnowledgeStore.getState().documents).toEqual([]);
    });
  });

  describe('fetchDocuments', () => {
    it('sets isLoading true when fetching', async () => {
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      const promise = useKnowledgeStore.getState().fetchDocuments('kb-1');

      expect(useKnowledgeStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates documents on success', async () => {
      const mockDocs = [
        { id: 'doc-1', name: 'Doc 1', kb_id: 'kb-1' },
        { id: 'doc-2', name: 'Doc 2', kb_id: 'kb-1' },
      ];
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 2, total_chunks: 100, documents: mockDocs });

      await useKnowledgeStore.getState().fetchDocuments('kb-1');

      expect(useKnowledgeStore.getState().documents).toEqual(mockDocs);
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(knowledgeApi.getStats).mockRejectedValue(new Error('Failed to fetch documents'));

      await useKnowledgeStore.getState().fetchDocuments('kb-1');

      expect(useKnowledgeStore.getState().error).toBe('Failed to fetch documents');
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });
  });

  describe('deleteDocument', () => {
    it('sets isLoading true when deleting', async () => {
      vi.mocked(knowledgeApi.deleteDocument).mockResolvedValue({ message: 'Deleted' });
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      const promise = useKnowledgeStore.getState().deleteDocument('kb-1', 'doc-1');

      expect(useKnowledgeStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('calls knowledgeApi.deleteDocument with kbId and docId', async () => {
      vi.mocked(knowledgeApi.deleteDocument).mockResolvedValue({ message: 'Deleted' });
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      await useKnowledgeStore.getState().deleteDocument('kb-1', 'doc-1');

      expect(knowledgeApi.deleteDocument).toHaveBeenCalledWith('kb-1', 'doc-1');
    });

    it('calls fetchDocuments after successful deletion', async () => {
      vi.mocked(knowledgeApi.deleteDocument).mockResolvedValue({ message: 'Deleted' });
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 0, total_chunks: 0, documents: [] });

      await useKnowledgeStore.getState().deleteDocument('kb-1', 'doc-1');

      expect(knowledgeApi.getStats).toHaveBeenCalledWith('kb-1');
    });

    it('sets error on failure', async () => {
      vi.mocked(knowledgeApi.deleteDocument).mockRejectedValue(new Error('Delete failed'));

      await useKnowledgeStore.getState().deleteDocument('kb-1', 'doc-1');

      expect(useKnowledgeStore.getState().error).toBe('Delete failed');
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });
  });

  describe('search', () => {
    it('sets searchQuery when searching', async () => {
      vi.mocked(knowledgeApi.search).mockResolvedValue({ results: [], total: 0 });

      await useKnowledgeStore.getState().search('kb-1', 'test query');

      expect(useKnowledgeStore.getState().searchQuery).toBe('test query');
    });

    it('sets isLoading true when searching', async () => {
      vi.mocked(knowledgeApi.search).mockResolvedValue({ results: [], total: 0 });

      const promise = useKnowledgeStore.getState().search('kb-1', 'test');

      expect(useKnowledgeStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates searchResults on success', async () => {
      const mockResults = [
        { content: 'result 1', relevance_score: 0.9, doc_id: 'doc-1', source_file: 'file1.txt', page_number: 1 },
        { content: 'result 2', relevance_score: 0.8, doc_id: 'doc-2', source_file: 'file2.txt', page_number: null },
      ];
      vi.mocked(knowledgeApi.search).mockResolvedValue({ results: mockResults, total: 2 });

      await useKnowledgeStore.getState().search('kb-1', 'test');

      expect(useKnowledgeStore.getState().searchResults).toHaveLength(2);
      expect(useKnowledgeStore.getState().searchResults[0].content).toBe('result 1');
      expect(useKnowledgeStore.getState().searchResults[0].score).toBe(0.9);
      expect(useKnowledgeStore.getState().searchResults[0].doc_id).toBe('doc-1');
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(knowledgeApi.search).mockRejectedValue(new Error('Search failed'));

      await useKnowledgeStore.getState().search('kb-1', 'test');

      expect(useKnowledgeStore.getState().error).toBe('Search failed');
      expect(useKnowledgeStore.getState().isLoading).toBe(false);
    });

    it('clears previous error on new search', async () => {
      useKnowledgeStore.setState({ error: 'Previous error' });
      vi.mocked(knowledgeApi.search).mockResolvedValue({ results: [], total: 0 });

      await useKnowledgeStore.getState().search('kb-1', 'test');

      expect(useKnowledgeStore.getState().error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      useKnowledgeStore.setState({ error: 'Some error' });

      useKnowledgeStore.getState().clearError();

      expect(useKnowledgeStore.getState().error).toBeNull();
    });
  });

  describe('Reindex Knowledge Base', () => {
    it('sets isReindexing true and reindexProgress 0 when starting reindex', async () => {
      vi.useFakeTimers();
      vi.mocked(knowledgeApi.reindex).mockResolvedValue({ message: 'Reindex started', estimated_time: '10s' });
      vi.mocked(knowledgeApi.getStats).mockResolvedValue({ document_count: 5, total_chunks: 100, documents: [] });

      const promise = useKnowledgeStore.getState().reindexKnowledgeBase('kb-1');

      expect(useKnowledgeStore.getState().isReindexing).toBe(true);
      expect(useKnowledgeStore.getState().reindexProgress).toBe(0);

      await promise;
      vi.useRealTimers();
    });

    it('sets error on failure', async () => {
      vi.useFakeTimers();
      vi.mocked(knowledgeApi.reindex).mockRejectedValue(new Error('Reindex failed'));

      try {
        await useKnowledgeStore.getState().reindexKnowledgeBase('kb-1');
      } catch {}

      expect(useKnowledgeStore.getState().error).toBe('Reindex failed');
      expect(useKnowledgeStore.getState().isReindexing).toBe(false);
      expect(useKnowledgeStore.getState().reindexProgress).toBe(0);
      vi.useRealTimers();
    });
  });
});