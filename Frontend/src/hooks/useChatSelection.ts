import { useCallback, useMemo } from 'react';
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
  const currentChat = useMemo(() => {
    if (selectedChat === null) return null;
    return conversationsState[selectedChat] ?? null;
  }, [conversationsState, selectedChat]);

  const selectedId = useMemo(() => {
    if (selectedChat === null) return undefined;
    return conversationsState[selectedChat]?.id;
  }, [conversationsState, selectedChat]);

  const selectChatById = useCallback(
    (chatId?: number | null, fallbackIndex = 0) => {
      if (chatId === null || chatId === undefined) {
        setSelectedChat(null);
        return;
      }

      const index = conversationsState.findIndex((chat) => chat.id === chatId);
      if (index !== -1) {
        setSelectedChat(index);
        return;
      }

      if (conversationsState.length === 0) {
        setSelectedChat(null);
        return;
      }

      const safeFallback = Math.max(0, Math.min(fallbackIndex, conversationsState.length - 1));
      setSelectedChat(safeFallback);
    },
    [conversationsState, setSelectedChat]
  );

  const closeSelectedChat = useCallback(() => {
    setSelectedChat(null);
  }, [setSelectedChat]);

  return {
    currentChat,
    selectedId,
    selectChatById,
    closeSelectedChat
  };
};
