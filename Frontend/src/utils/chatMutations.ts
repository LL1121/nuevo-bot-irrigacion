import type { Conversation } from '../types/chat';

export const markConversationRead = (conversations: Conversation[], conversationId: number) => {
  return conversations.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation
  );
};

export const setConversationArchived = (
  conversations: Conversation[],
  conversationId: number,
  archived: boolean
) => {
  return conversations.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, archived } : conversation
  );
};

export const deleteConversationByIdWithSelection = (
  conversations: Conversation[],
  conversationId: number,
  selectedChat: number | null
) => {
  const indexToDelete = conversations.findIndex((conversation) => conversation.id === conversationId);
  const filtered = conversations.filter((conversation) => conversation.id !== conversationId);

  if (selectedChat === null || indexToDelete === -1) {
    return { conversations: filtered, selectedChat };
  }

  if (selectedChat === indexToDelete) {
    if (filtered.length === 0) {
      return { conversations: filtered, selectedChat: null };
    }
    return {
      conversations: filtered,
      selectedChat: Math.min(indexToDelete, filtered.length - 1)
    };
  }

  if (selectedChat > indexToDelete) {
    const shifted = selectedChat - 1;
    return {
      conversations: filtered,
      selectedChat: shifted < filtered.length ? shifted : filtered.length - 1
    };
  }

  return {
    conversations: filtered,
    selectedChat: selectedChat < filtered.length ? selectedChat : filtered.length - 1
  };
};
