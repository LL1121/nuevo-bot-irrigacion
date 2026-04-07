import { useCallback } from 'react';
import type { SetStateAction } from 'react';
import type { ChatContextMenuState } from '../types/chat';

type UseChatMutationsParams = {
  setContextMenu: (next: SetStateAction<ChatContextMenuState>) => void;
  markConversationReadById: (conversationId: number) => void;
  setConversationArchivedById: (conversationId: number, archived: boolean) => void;
  deleteConversationByIdFromStore: (conversationId: number) => void;
};

export const useChatMutations = ({
  setContextMenu,
  markConversationReadById,
  setConversationArchivedById,
  deleteConversationByIdFromStore
}: UseChatMutationsParams) => {
  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  }, [setContextMenu]);

  const markChatReadById = useCallback(
    (id: number) => {
      markConversationReadById(id);
      closeContextMenu();
    },
    [markConversationReadById, closeContextMenu]
  );

  const deleteConversationById = useCallback(
    (id: number) => {
      deleteConversationByIdFromStore(id);
      closeContextMenu();
    },
    [deleteConversationByIdFromStore, closeContextMenu]
  );

  const archiveConversationById = useCallback(
    (id: number) => {
      setConversationArchivedById(id, true);
      closeContextMenu();
    },
    [setConversationArchivedById, closeContextMenu]
  );

  const unarchiveConversationById = useCallback(
    (id: number) => {
      setConversationArchivedById(id, false);
    },
    [setConversationArchivedById]
  );

  return {
    markChatReadById,
    deleteConversationById,
    archiveConversationById,
    unarchiveConversationById
  };
};
