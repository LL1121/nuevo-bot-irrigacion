import React, { memo, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { Send, Paperclip, Smile, X, Image as ImageIcon, FileText, Video, Music } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import type { Conversation } from '../types/chat';
import type { ThemeColorBundle } from '../types/theme';
import type { ChatLockInfo } from './ChatMainHeader';

export type ChatComposerPaneProps = {
  currentChat: Conversation;
  currentChatLock: ChatLockInfo;
  isHumanConversation: (status?: string | null) => boolean;
  normalizePhoneKey: (phone: string) => string;
  handoffActionLoading: Record<string, 'accept' | 'complete' | undefined>;
  completeOperatorChat: (phone: string) => Promise<void>;
  replyingTo: { id: number; text: string } | null;
  editingMessage: { id: number; text: string } | null;
  cancelEdit: () => void;
  setReplyingTo: Dispatch<SetStateAction<{ id: number; text: string } | null>>;
  sessionExpired: boolean;
  reactivationTema: string;
  setReactivationTema: Dispatch<SetStateAction<string>>;
  reactivating: boolean;
  handleSendReactivationTemplate: () => void | Promise<void>;
  themeColors: ThemeColorBundle;
  theme: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  attachMenuRef: RefObject<HTMLDivElement | null>;
  showAttachMenu: boolean;
  setShowAttachMenu: Dispatch<SetStateAction<boolean>>;
  handleAttachmentType: (accept: string) => void;
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  handleSendMessage: () => void;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  showEmojiPicker: boolean;
  setShowEmojiPicker: Dispatch<SetStateAction<boolean>>;
  handleEmojiClick: (emojiObject: { emoji: string }) => void;
};

export const ChatComposerPane = memo(function ChatComposerPane(p: ChatComposerPaneProps) {
  const {
    currentChat,
    currentChatLock,
    isHumanConversation,
    normalizePhoneKey,
    handoffActionLoading,
    completeOperatorChat,
    replyingTo,
    editingMessage,
    cancelEdit,
    setReplyingTo,
    sessionExpired,
    reactivationTema,
    setReactivationTema,
    reactivating,
    handleSendReactivationTemplate,
    themeColors,
    theme,
    fileInputRef,
    handleFileSelect,
    attachMenuRef,
    showAttachMenu,
    setShowAttachMenu,
    handleAttachmentType,
    message,
    setMessage,
    handleSendMessage,
    emojiPickerRef,
    showEmojiPicker,
    setShowEmojiPicker,
    handleEmojiClick
  } = p;

  return (
        <>
          <div className="relative">
            <div className="absolute left-0 right-0 bottom-full pb-2 px-4 pointer-events-none">
            {(() => {
              const isHuman = isHumanConversation(currentChat.conversationStatus);
              const phoneKey = normalizePhoneKey(currentChat.phone);
              const actionState = handoffActionLoading[phoneKey];
              if (!isHuman || currentChatLock.isLockedByAnotherOperator) return null;
              return (
                <div className="lg:hidden flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-200 dark:border-emerald-800">
                  <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                    Estás atendiendo este chat
                  </span>
                  <button
                    type="button"
                    onClick={() => void completeOperatorChat(currentChat.phone)}
                    disabled={actionState !== undefined}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors"
                  >
                    {actionState === 'complete' ? 'Finalizando...' : 'Finalizar conversación'}
                  </button>
                </div>
              );
            })()}
            </div>
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          {(replyingTo || editingMessage) && (
            <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {editingMessage ? 'Editando mensaje' : 'Respondiendo a'}
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                  {editingMessage ? editingMessage.text : replyingTo?.text}
                </p>
              </div>
              <button
                onClick={() => {
                  if (editingMessage) cancelEdit();
                  else setReplyingTo(null);
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <X size={16} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          <div className="flex items-center gap-3">
            {sessionExpired ? (
              <div className="w-full flex flex-col gap-2 p-3 rounded-lg border bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-100 border-amber-200 dark:border-amber-800">
                <div className="text-sm">
                  La sesión de 24hs ha caducado. Envía una plantilla de reactivación para continuar.
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={reactivationTema}
                    onChange={e => setReactivationTema(e.target.value)}
                    placeholder="Tema (ej: turno de riego, deuda...)"
                    className="flex-1 px-3 py-1.5 text-sm rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1"
                  />
                  <button
                    onClick={handleSendReactivationTemplate}
                    disabled={reactivating}
                    className="px-3 py-1.5 rounded-md text-white text-sm font-medium disabled:opacity-70 whitespace-nowrap"
                    style={{ backgroundColor: themeColors[theme].hex }}
                  >
                    {reactivating ? 'Enviando…' : 'Enviar plantilla'}
                  </button>
                </div>
              </div>
            ) : currentChatLock.isLockedByAnotherOperator ? (
              <div className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-100 border-rose-200 dark:border-rose-800">
                <div className="text-sm">
                  Este chat está tomado por <strong>{currentChatLock.lockedBy}</strong>. Puedes ver los mensajes, pero no enviar ni modificar acciones.
                </div>
              </div>
            ) : (
              <>
                <div className="relative" ref={attachMenuRef}>
                  <button 
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    onClick={() => setShowAttachMenu((v) => !v)}
                  >
                    <Paperclip size={22} className="text-gray-600 dark:text-gray-300" />
                  </button>
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-slideInUp">
                      <button 
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => handleAttachmentType('image/*')}
                      >
                        <ImageIcon size={18} className="text-blue-600" />
                        <span className="text-gray-700">Imagen</span>
                      </button>
                      <button 
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => handleAttachmentType('.pdf,.doc,.docx,.txt')}
                      >
                        <FileText size={18} className="text-emerald-600" />
                        <span className="text-gray-700">Documento</span>
                      </button>
                      <button 
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => handleAttachmentType('video/*')}
                      >
                        <Video size={18} className="text-purple-600" />
                        <span className="text-gray-700">Video</span>
                      </button>
                      <button 
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
                        onClick={() => handleAttachmentType('audio/*')}
                      >
                        <Music size={18} className="text-orange-600" />
                        <span className="text-gray-700">Audio</span>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2 relative">
                  <textarea
                    placeholder="Escribe un mensaje..."
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      const textarea = e.target;
                      setTimeout(() => {
                        textarea.style.height = 'auto';
                        const newHeight = Math.min(textarea.scrollHeight, 120);
                        textarea.style.height = `${newHeight}px`;
                      }, 0);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 resize-none min-h-[24px] max-h-[120px] py-1"
                    rows={1}
                  />
                  <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                    <button 
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                    >
                      <Smile size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-full mb-2 right-0 z-50 animate-slideInUp">
                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSendMessage}
                  className="p-3 text-white rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${themeColors[theme].hex}, #14b8a6)`
                  }}
                >
                  <Send size={20} />
                </button>
              </>
            )}
          </div>
        </div>
        </div>
        </>
  );
});

