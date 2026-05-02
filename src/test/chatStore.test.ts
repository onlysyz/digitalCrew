import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatStore } from '../stores/chatStore';
import { chatApi } from '../services/api';

vi.mock('../services/api', () => ({
  chatApi: {
    listSessions: vi.fn(),
    single: vi.fn(),
    team: vi.fn(),
    intervene: vi.fn(),
    getSessionMessages: vi.fn(),
  },
}));

describe('ChatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      sessions: [],
      currentSessionId: null,
      messages: [],
      isLoading: false,
      isSending: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('has empty sessions array', () => {
      const { sessions } = useChatStore.getState();
      expect(sessions).toEqual([]);
    });

    it('has null currentSessionId', () => {
      const { currentSessionId } = useChatStore.getState();
      expect(currentSessionId).toBeNull();
    });

    it('has empty messages array', () => {
      const { messages } = useChatStore.getState();
      expect(messages).toEqual([]);
    });

    it('has isLoading false', () => {
      const { isLoading } = useChatStore.getState();
      expect(isLoading).toBe(false);
    });

    it('has isSending false', () => {
      const { isSending } = useChatStore.getState();
      expect(isSending).toBe(false);
    });

    it('has null error', () => {
      const { error } = useChatStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('fetchSessions', () => {
    it('sets isLoading true when fetching', async () => {
      vi.mocked(chatApi.listSessions).mockResolvedValue({ sessions: [], total: 0 });

      const promise = useChatStore.getState().fetchSessions();

      expect(useChatStore.getState().isLoading).toBe(true);

      await promise;
    });

    it('updates sessions on success', async () => {
      const mockSessions = [
        { id: 'session-1', title: 'Session 1', created_at: '2024-01-01' },
        { id: 'session-2', title: 'Session 2', created_at: '2024-01-02' },
      ];
      vi.mocked(chatApi.listSessions).mockResolvedValue({ sessions: mockSessions, total: 2 });

      await useChatStore.getState().fetchSessions();

      expect(useChatStore.getState().sessions).toEqual(mockSessions);
      expect(useChatStore.getState().isLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(chatApi.listSessions).mockRejectedValue(new Error('Failed to fetch sessions'));

      await useChatStore.getState().fetchSessions();

      expect(useChatStore.getState().error).toBe('Failed to fetch sessions');
      expect(useChatStore.getState().isLoading).toBe(false);
    });

    it('clears previous error on new fetch', async () => {
      useChatStore.setState({ error: 'Previous error' });
      vi.mocked(chatApi.listSessions).mockResolvedValue({ sessions: [], total: 0 });

      await useChatStore.getState().fetchSessions();

      expect(useChatStore.getState().error).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('sets isSending true during send', async () => {
      vi.mocked(chatApi.single).mockResolvedValue({
        session_id: 'session-1',
        message: { id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: '2024-01-01', metadata: {} },
      });

      const promise = useChatStore.getState().sendMessage('Hi');

      expect(useChatStore.getState().isSending).toBe(true);

      await promise;
    });

    it('appends user and assistant messages on success', async () => {
      vi.mocked(chatApi.single).mockResolvedValue({
        session_id: 'session-1',
        message: { id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: '2024-01-01', metadata: {} },
      });

      await useChatStore.getState().sendMessage('Hi');

      const { messages } = useChatStore.getState();
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hi');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('Hello');
    });

    it('updates currentSessionId from response', async () => {
      vi.mocked(chatApi.single).mockResolvedValue({
        session_id: 'new-session-id',
        message: { id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: '2024-01-01', metadata: {} },
      });

      await useChatStore.getState().sendMessage('Hi');

      expect(useChatStore.getState().currentSessionId).toBe('new-session-id');
    });

    it('passes agent_id to chatApi.single when provided', async () => {
      vi.mocked(chatApi.single).mockResolvedValue({
        session_id: 'session-1',
        message: { id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: '2024-01-01', metadata: {} },
        agent_id: 'agent-1',
      });

      await useChatStore.getState().sendMessage('Hi', 'agent-1');

      expect(chatApi.single).toHaveBeenCalledWith({
        message: 'Hi',
        agent_id: 'agent-1',
      });
    });

    it('uses currentSessionId when available', async () => {
      useChatStore.setState({ currentSessionId: 'existing-session' });
      vi.mocked(chatApi.single).mockResolvedValue({
        session_id: 'existing-session',
        message: { id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: '2024-01-01', metadata: {} },
      });

      await useChatStore.getState().sendMessage('Hi');

      expect(chatApi.single).toHaveBeenCalledWith({
        message: 'Hi',
        agent_id: undefined,
        session_id: 'existing-session',
      });
    });

    it('sets error on failure', async () => {
      vi.mocked(chatApi.single).mockRejectedValue(new Error('Failed to send message'));

      await useChatStore.getState().sendMessage('Hi');

      expect(useChatStore.getState().error).toBe('Failed to send message');
      expect(useChatStore.getState().isSending).toBe(false);
    });
  });


  describe('intervene', () => {
    it('calls chatApi.intervene with sessionId and message', async () => {
      vi.mocked(chatApi.intervene).mockResolvedValue({ message: 'Intervention sent', session_id: 'session-1' });

      await useChatStore.getState().intervene('session-1', 'Please help');

      expect(chatApi.intervene).toHaveBeenCalledWith('session-1', 'Please help');
    });

    it('sets error on failure', async () => {
      vi.mocked(chatApi.intervene).mockRejectedValue(new Error('Intervention failed'));

      await useChatStore.getState().intervene('session-1', 'Please help');

      expect(useChatStore.getState().error).toBe('Intervention failed');
    });
  });

  describe('setCurrentSession', () => {
    it('sets currentSessionId when sessionId provided', () => {
      useChatStore.getState().setCurrentSession('session-1', false);

      expect(useChatStore.getState().currentSessionId).toBe('session-1');
    });

    it('loads messages when sessionId provided and loadMessages is true', async () => {
      const mockMessages = [
        { id: 'msg-1', role: 'user', content: 'Hi', timestamp: '2024-01-01', metadata: {} },
        { id: 'msg-2', role: 'assistant', content: 'Hello', timestamp: '2024-01-01', metadata: {} },
      ];
      vi.mocked(chatApi.getSessionMessages).mockResolvedValue({ messages: mockMessages, total: 2 });

      useChatStore.getState().setCurrentSession('session-1', true);

      await vi.waitFor(() => {
        expect(chatApi.getSessionMessages).toHaveBeenCalledWith('session-1');
      });
    });

    it('clears messages when sessionId is null', () => {
      useChatStore.setState({
        messages: [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: '2024-01-01', metadata: {} }],
      });

      useChatStore.getState().setCurrentSession(null, false);

      expect(useChatStore.getState().messages).toEqual([]);
    });

    it('sets currentSessionId to null', () => {
      useChatStore.setState({ currentSessionId: 'session-1' });

      useChatStore.getState().setCurrentSession(null, false);

      expect(useChatStore.getState().currentSessionId).toBeNull();
    });
  });

  describe('clearError', () => {
    it('sets error to null', () => {
      useChatStore.setState({ error: 'Some error' });

      useChatStore.getState().clearError();

      expect(useChatStore.getState().error).toBeNull();
    });
  });

  describe('Streaming State', () => {
    it('isSending is true while sendMessage is in progress', async () => {
      vi.mocked(chatApi.single).mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            session_id: 'session-1',
            message: { id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: '2024-01-01', metadata: {} },
          });
        }, 100);
      }));

      const sendPromise = useChatStore.getState().sendMessage('Hi');

      expect(useChatStore.getState().isSending).toBe(true);

      await sendPromise;
      expect(useChatStore.getState().isSending).toBe(false);
    });

  });
});