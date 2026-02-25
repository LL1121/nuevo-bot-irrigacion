import { create } from 'zustand';
import type { SetStateAction } from 'react';

type Updater<T> = (next: SetStateAction<T>) => void;

type ChatStoreState = {
  conversationsState: any[];
  selectedChat: number | null;
  allMessagesCache: Record<string, any[]>;
  messagesLoading: Record<string, boolean>;
  messagesEndReached: Record<string, boolean>;
  currentMessageIndex: Record<string, number>;
  typingUsers: Record<string, boolean>;
  isLoadingMoreMessages: boolean;
  setConversationsState: Updater<any[]>;
  setSelectedChat: Updater<number | null>;
  setAllMessagesCache: Updater<Record<string, any[]>>;
  setMessagesLoading: Updater<Record<string, boolean>>;
  setMessagesEndReached: Updater<Record<string, boolean>>;
  setCurrentMessageIndex: Updater<Record<string, number>>;
  setTypingUsers: Updater<Record<string, boolean>>;
  setIsLoadingMoreMessages: Updater<boolean>;
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
      allMessagesCache: resolveState(state.allMessagesCache, next)
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
