import { useCallback, useMemo, useRef } from 'react';
import type { SetStateAction } from 'react';
import type { Conversation } from '../types/chat';

type UseChatSelectionParams = {
  conversationsState: Conversation[];
  selectedChat: number | null;
  setSelectedChat: (next: SetStateAction<number | null>) => void;
};

export const useChatSelection = ({
  conversationsState,
  selectedChat,
  setSelectedChat
}: UseChatSelectionParams) => {
  const selectedIdRef = useRef<number | null>(null);

  const currentChat = useMemo(() => {
    if (selectedChat === null) {
      selectedIdRef.current = null;
      return null;
    }

    const byIndex = conversationsState[selectedChat] ?? null;

    if (byIndex?.id !== undefined) {
      selectedIdRef.current = byIndex.id;
    }

    if (selectedIdRef.current !== null) {
      const byId = conversationsState.find((chat) => chat.id === selectedIdRef.current) ?? null;
      if (byId) {
        return byId;
      }
    }

    return byIndex;
  }, [conversationsState, selectedChat]);

  const selectedId = useMemo(() => {
    return currentChat?.id;
  }, [currentChat]);

  const selectChatById = useCallback(
    (chatId?: number | null, fallbackIndex?: number | null) => {
      if (chatId === null || chatId === undefined) {
        setSelectedChat(null);
        return;
      }

      const index = conversationsState.findIndex((chat) => chat.id === chatId);
      if (index !== -1) {
        selectedIdRef.current = chatId;
        setSelectedChat(index);
        return;
      }

      if (conversationsState.length === 0) {
        selectedIdRef.current = null;
        setSelectedChat(null);
        return;
      }

      if (fallbackIndex === null || fallbackIndex === undefined) {
        selectedIdRef.current = null;
        setSelectedChat(null);
        return;
      }

      const safeFallback = Math.max(0, Math.min(fallbackIndex, conversationsState.length - 1));
      setSelectedChat(safeFallback);
    },
    [conversationsState, setSelectedChat]
  );

  const closeSelectedChat = useCallback(() => {
    selectedIdRef.current = null;
    setSelectedChat(null);
  }, [setSelectedChat]);

  return {
    currentChat,
    selectedId,
    selectChatById,
    closeSelectedChat
  };
};
