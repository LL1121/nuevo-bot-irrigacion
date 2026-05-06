import { useChatStore } from './chatStore';

/** Selectores finos para evitar re-renders cuando cambian otras porciones del store */

export const useConversationsState = () => useChatStore((s) => s.conversationsState);
export const useSetConversationsState = () => useChatStore((s) => s.setConversationsState);

export const useSelectedChatIndex = () => useChatStore((s) => s.selectedChat);
export const useSetSelectedChat = () => useChatStore((s) => s.setSelectedChat);

export const useAllMessagesCache = () => useChatStore((s) => s.allMessagesCache);
export const useSetAllMessagesCache = () => useChatStore((s) => s.setAllMessagesCache);

export const useMessagesLoading = () => useChatStore((s) => s.messagesLoading);
export const useSetMessagesLoading = () => useChatStore((s) => s.setMessagesLoading);

export const useMessagesEndReached = () => useChatStore((s) => s.messagesEndReached);
export const useSetMessagesEndReached = () => useChatStore((s) => s.setMessagesEndReached);

export const useCurrentMessageIndex = () => useChatStore((s) => s.currentMessageIndex);
export const useSetCurrentMessageIndex = () => useChatStore((s) => s.setCurrentMessageIndex);

export const useTypingUsers = () => useChatStore((s) => s.typingUsers);
export const useSetTypingUsers = () => useChatStore((s) => s.setTypingUsers);

export const useIsLoadingMoreMessages = () => useChatStore((s) => s.isLoadingMoreMessages);
export const useSetIsLoadingMoreMessages = () => useChatStore((s) => s.setIsLoadingMoreMessages);

export const useMarkConversationReadById = () => useChatStore((s) => s.markConversationReadById);
export const useSetConversationArchivedById = () => useChatStore((s) => s.setConversationArchivedById);
export const useDeleteConversationByIdFromStore = () => useChatStore((s) => s.deleteConversationById);
export const useResetChatStore = () => useChatStore((s) => s.resetChatStore);
