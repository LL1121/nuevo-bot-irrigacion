import { create } from 'zustand';
import type { SetStateAction } from 'react';
import type { ChatMessage, Conversation } from '../types/chat';
import {
  deleteConversationByIdWithSelection,
  markConversationRead,
  setConversationArchived
} from '../utils/chatMutations';
import { applyMessageCachePolicy } from '../utils/messageCachePolicy';

type Updater<T> = (next: SetStateAction<T>) => void;

type ChatStoreState = {
  conversationsState: Conversation[];
  selectedChat: number | null;
  allMessagesCache: Record<string, ChatMessage[]>;
  messagesLoading: Record<string, boolean>;
  messagesEndReached: Record<string, boolean>;
  currentMessageIndex: Record<string, number>;
  typingUsers: Record<string, boolean>;
  isLoadingMoreMessages: boolean;
  setConversationsState: Updater<Conversation[]>;
  setSelectedChat: Updater<number | null>;
  setAllMessagesCache: Updater<Record<string, ChatMessage[]>>;
  setMessagesLoading: Updater<Record<string, boolean>>;
  setMessagesEndReached: Updater<Record<string, boolean>>;
  setCurrentMessageIndex: Updater<Record<string, number>>;
  setTypingUsers: Updater<Record<string, boolean>>;
  setIsLoadingMoreMessages: Updater<boolean>;
  markConversationReadById: (conversationId: number) => void;
  setConversationArchivedById: (conversationId: number, archived: boolean) => void;
  deleteConversationById: (conversationId: number) => void;
  resetChatStore: () => void;
};

const resolveState = <T>(current: T, next: SetStateAction<T>): T => {
  if (typeof next === 'function') {
    return (next as (prev: T) => T)(current);
  }
  return next;
};

export const useChatStore = create<ChatStoreState>((set) => ({
  conversationsState: [],
  selectedChat: null,
  allMessagesCache: {},
  messagesLoading: {},
  messagesEndReached: {},
  currentMessageIndex: {},
  typingUsers: {},
  isLoadingMoreMessages: false,

  setConversationsState: (next) =>
    set((state) => ({
      conversationsState: resolveState(state.conversationsState, next)
    })),

  setSelectedChat: (next) =>
    set((state) => ({
      selectedChat: resolveState(state.selectedChat, next)
    })),

  setAllMessagesCache: (next) =>
    set((state) => ({
      allMessagesCache: applyMessageCachePolicy(resolveState(state.allMessagesCache, next))
    })),

  setMessagesLoading: (next) =>
    set((state) => ({
      messagesLoading: resolveState(state.messagesLoading, next)
    })),

  setMessagesEndReached: (next) =>
    set((state) => ({
      messagesEndReached: resolveState(state.messagesEndReached, next)
    })),

  setCurrentMessageIndex: (next) =>
    set((state) => ({
      currentMessageIndex: resolveState(state.currentMessageIndex, next)
    })),

  setTypingUsers: (next) =>
    set((state) => ({
      typingUsers: resolveState(state.typingUsers, next)
    })),

  setIsLoadingMoreMessages: (next) =>
    set((state) => ({
      isLoadingMoreMessages: resolveState(state.isLoadingMoreMessages, next)
    })),

  markConversationReadById: (conversationId) =>
    set((state) => ({
      conversationsState: markConversationRead(state.conversationsState, conversationId)
    })),

  setConversationArchivedById: (conversationId, archived) =>
    set((state) => ({
      conversationsState: setConversationArchived(state.conversationsState, conversationId, archived)
    })),

  deleteConversationById: (conversationId) =>
    set((state) => {
      const nextState = deleteConversationByIdWithSelection(
        state.conversationsState,
        conversationId,
        state.selectedChat
      );

      return {
        conversationsState: nextState.conversations,
        selectedChat: nextState.selectedChat
      };
    }),

  resetChatStore: () =>
    set({
      conversationsState: [],
      selectedChat: null,
      allMessagesCache: {},
      messagesLoading: {},
      messagesEndReached: {},
      currentMessageIndex: {},
      typingUsers: {},
      isLoadingMoreMessages: false
    })
}));
