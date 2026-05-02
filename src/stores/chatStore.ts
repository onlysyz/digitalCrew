/**
 * Zustand store for chat state management
 */
import { create } from 'zustand';
import type { ChatMessage, ChatSession } from '../types/api';
import { chatApi } from '../services/api';

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  fetchSessions: () => Promise<void>;
  sendMessage: (message: string, agentId?: string) => Promise<void>;
  intervene: (sessionId: string, message: string) => Promise<void>;
  setCurrentSession: (sessionId: string | null, loadMessages?: boolean) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await chatApi.listSessions();
      set({ sessions: response.sessions as unknown as ChatSession[], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendMessage: async (message, agentId) => {
    set({ isSending: true, error: null });
    try {
      const response = await chatApi.single({
        message,
        agent_id: agentId,
        session_id: get().currentSessionId || undefined,
      });

      const assistantMessage = response.message as unknown as ChatMessage;

      set((state) => ({
        messages: [
          ...state.messages,
          { role: 'user', content: message, id: crypto.randomUUID(), timestamp: new Date().toISOString(), metadata: {} },
          assistantMessage,
        ],
        currentSessionId: response.session_id,
        isSending: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isSending: false });
    }
  },

  intervene: async (sessionId, message) => {
    try {
      await chatApi.intervene(sessionId, message);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setCurrentSession: (sessionId: string | null, loadMessages = true) => {
    set({ currentSessionId: sessionId });
    if (sessionId && loadMessages) {
      // Load messages for session
      chatApi.getSessionMessages(sessionId).then((response) => {
        set({ messages: response.messages as unknown as ChatMessage[] });
      }).catch(() => {
        set({ messages: [] });
      });
    } else {
      set({ messages: [] });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));