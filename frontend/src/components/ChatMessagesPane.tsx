import React, { memo, type RefObject, type Dispatch, type SetStateAction } from 'react';
import axios from 'axios';
import {
  Check,
  CheckCheck,
  X,
  Trash,
  Play,
  Pause,
  Copy,
  Volume1,
  Volume2,
  VolumeX,
  FileText
} from 'lucide-react';
import type { ChatMessage, Conversation, RawApiMessage } from '../types/chat';
import type {
  InteractiveButton,
  InteractiveMessagePayload,
  InteractiveOption,
  InteractiveSection
} from '../types/interactiveMessage';
import type { ThemeColorBundle } from '../types/theme';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { parseTimestamp } from '../utils/dateTime';
import { formatChatMarkdownToSafeHtml } from '../utils/sanitize';
import { mergeMessageBatches } from '../services/messageQueue';
import { applyMessageCachePolicy } from '../utils/messageCachePolicy';
import { trackAction } from '../utils/monitoring';
import { normalizePhoneKey, phonesMatch } from '../utils/phoneFormat';

const getMediaUrl = (mediaId: string | null | undefined): string => {
  if (!mediaId) return '';
  return `${env.apiUrl}/api/media/${mediaId}`;
};

const parseMessageDate = (value: unknown) => parseTimestamp(value).toDate();

export type ChatMessagesPaneProps = {
  currentChat: Conversation;
  selectedChat: number | null;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  darkMode: boolean;
  backgroundPattern: boolean;
  messageFontSize: number;
  fontFamily: string;
  openBlankMenu: (e: React.MouseEvent) => void;
  dragOverChat: boolean;
  setDragOverChat: Dispatch<SetStateAction<boolean>>;
  allMessagesCache: Record<string, ChatMessage[]>;
  messagesEndReached: Record<string, boolean>;
  messagesLoading: Record<string, boolean>;
  messagesLimit: number;
  currentMessageIndex: Record<string, number>;
  setIsLoadingMoreMessages: Dispatch<SetStateAction<boolean>>;
  setConversationsState: Dispatch<SetStateAction<Conversation[]>>;
  setMessagesEndReached: Dispatch<SetStateAction<Record<string, boolean>>>;
  setMessagesLoading: Dispatch<SetStateAction<Record<string, boolean>>>;
  setAllMessagesCache: Dispatch<SetStateAction<Record<string, ChatMessage[]>>>;
  setCurrentMessageIndex: Dispatch<SetStateAction<Record<string, number>>>;
  selectionMode: boolean;
  exitSelection: () => void;
  selectedMessageIds: number[];
  conversationsState: Conversation[];
  toggleMessageSelection: (id: number) => void;
  deleteSelectedMessages: () => void;
  filteredMessages: ChatMessage[];
  themeColors: ThemeColorBundle;
  theme: string;
  highlightedMessage: number | null;
  openContextMenu: (e: React.MouseEvent, type: 'chat' | 'message', id: number) => void;
  handleCopyMessage: (msg: ChatMessage) => void | Promise<void>;
  copiedMessageId: string | number | null;
  setLightboxImage: (url: string | null | undefined) => void;
  setLightboxVideo: (url: string | null | undefined) => void;
  setLightboxMessageId: (id: number | null) => void;
  setLightboxFile: (file: { url: string; filename: string } | null) => void;
  audioVolume: Record<number, number>;
  setAudioVolume: Dispatch<SetStateAction<Record<number, number>>>;
  audioPlaying: number | null;
  setAudioPlaying: Dispatch<SetStateAction<number | null>>;
  setAudioProgress: Dispatch<SetStateAction<Record<number, number>>>;
  expandedMessages: Set<number>;
  expandedMenus: Set<string>;
  setExpandedMenus: Dispatch<SetStateAction<Set<string>>>;
  toggleExpandMessage: (id: number) => void;
  typingUsers: Record<string, boolean>;
  setUrlContextMenu: Dispatch<SetStateAction<{ visible: boolean; x: number; y: number; url: string }>>;
  showVolumeControl: number | null;
  setShowVolumeControl: Dispatch<SetStateAction<number | null>>;
  formatTime: (date: Date | string | number) => string;
  isUserSender: (value?: string) => boolean;
  normalizeSenderType: (value?: string) => string;
  normalizeMessageType: (
    rawType: unknown,
    normalizedType: string,
    options?: { fileUrl?: string | null; filename?: string | null; text?: string }
  ) => string;
  extractFileUrlFromText: (text?: string) => string | null;
  deriveFilenameFromUrl: (url?: string) => string | null;
  emitConnectionAlert: (params: { kind: string; title: string; description: string }) => void;
  formatFileSize: (size?: number | null) => string;
  getFileExtension: (filename?: string | null) => string;
};

export const ChatMessagesPane = memo(function ChatMessagesPane(p: ChatMessagesPaneProps) {
  const {
    currentChat,
    selectedChat,
    messagesContainerRef,
    darkMode,
    backgroundPattern,
    messageFontSize,
    fontFamily,
    openBlankMenu,
    dragOverChat,
    setDragOverChat,
    allMessagesCache,
    messagesEndReached,
    messagesLoading,
    messagesLimit,
    currentMessageIndex,
    setIsLoadingMoreMessages,
    setConversationsState,
    setMessagesEndReached,
    setMessagesLoading,
    setAllMessagesCache,
    setCurrentMessageIndex,
    selectionMode,
    exitSelection,
    selectedMessageIds,
    conversationsState,
    toggleMessageSelection,
    deleteSelectedMessages,
    filteredMessages,
    themeColors,
    theme,
    highlightedMessage,
    openContextMenu,
    handleCopyMessage,
    copiedMessageId,
    setLightboxImage,
    setLightboxVideo,
    setLightboxMessageId,
    setLightboxFile,
    audioVolume,
    setAudioVolume,
    audioPlaying,
    setAudioPlaying,
    setAudioProgress,
    expandedMessages,
    expandedMenus,
    setExpandedMenus,
    toggleExpandMessage,
    typingUsers,
    setUrlContextMenu,
    showVolumeControl,
    setShowVolumeControl,
    formatTime,
    isUserSender,
    normalizeSenderType,
    normalizeMessageType,
    extractFileUrlFromText,
    deriveFilenameFromUrl,
    emitConnectionAlert,
    formatFileSize,
    getFileExtension
  } = p;

  return (
        <div 
          key={selectedChat}
          data-messages-container
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 relative pb-6 animate-fadeIn"
          onContextMenu={openBlankMenu}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverChat(true);
          }}
          onDragLeave={() => setDragOverChat(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverChat(false);
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              // Archivos soltados
            }
          }}
          style={{
            backgroundImage: backgroundPattern ? `
              url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png),
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255, 255, 255, 0.03) 10px,
                rgba(255, 255, 255, 0.03) 20px
              )
            ` : undefined,
            backgroundColor: darkMode ? '#0b141a' : '#efeae2',
            backgroundBlendMode: 'overlay',
            opacity: darkMode ? 1 : 0.98,
            '--msg-font-size': `${messageFontSize}px`,
            '--msg-font-family': fontFamily === 'default' ? 'inherit' : fontFamily
          } as React.CSSProperties}
        >
          {/* Botón Cargar Más Mensajes (solo si hay historial pendiente real) */}
          {currentChat && currentChat.messages && currentChat.messages.length > 0 && (() => {
            const phoneKey = normalizePhoneKey(currentChat.phone);
            const cachedCount = (allMessagesCache[phoneKey] || []).length;
            const visibleCount = currentChat.messages.length;
            const hasMoreInCache = cachedCount > visibleCount;
            const couldHaveMoreInBackend = cachedCount >= 100 && !messagesEndReached[currentChat.phone];
            return hasMoreInCache || couldHaveMoreInBackend;
          })() && (
            <div className="flex justify-center mb-4">
              <button
                onClick={async () => {
                  if (!currentChat || !currentChat.phone) return;
                  const phone = currentChat.phone;
                  const cachePhone = normalizePhoneKey(phone);
                  
                  if (messagesLoading[phone]) return;
                  
                  // � Activar flag para evitar auto-scroll
                  setIsLoadingMoreMessages(true);
                  
                  // �📍 GUARDAR posición de scroll antes de cargar mensajes
                  const messagesContainer = document.querySelector('[data-messages-container]');
                  const scrollHeightBefore = messagesContainer?.scrollHeight || 0;
                  const scrollTopBefore = messagesContainer?.scrollTop || 0;
                  
                  // Primero verificar si hay mensajes en el caché de memoria
                  const cachedMessages = allMessagesCache[cachePhone] || [];
                  const currentIndex = currentMessageIndex[phone] || 0;
                  const visibleCount = currentChat.messages?.length || 0;

                  if (env.enableLogging) {
                    logger.debug('LOAD_MORE_START', { phone, visibleCount, cachedCount: cachedMessages.length, currentIndex });
                  }
                  
                  if (cachedMessages.length > visibleCount) {
                    // Hay mensajes en caché para mostrar

                    // Aumentar la ventana visible de forma determinista: +messagesLimit mensajes más antiguos.
                    const nextVisibleCount = Math.min(cachedMessages.length, visibleCount + messagesLimit);
                    const startIndex = Math.max(0, cachedMessages.length - nextVisibleCount);
                    const nextVisibleMessages = cachedMessages.slice(startIndex);

                    if (env.enableLogging) {
                      logger.debug('LOAD_MORE_FROM_CACHE', { phone, nextVisibleCount, startIndex, resultingVisible: nextVisibleMessages.length });
                    }

                    if (nextVisibleMessages.length === 0) {
                      setMessagesEndReached(prev => ({ ...prev, [phone]: true }));
                      setIsLoadingMoreMessages(false);
                      return;
                    }
                    
                    // Unificar merge/dedupe con la misma política central del resto de rutas
                    setConversationsState(prev => {
                      const updated = [...prev];
                      const chatIndex = updated.findIndex(c => phonesMatch(c.phone, phone));
                      if (chatIndex !== -1) {
                        updated[chatIndex].messages = nextVisibleMessages;
                      }
                      return updated;
                    });
                    
                    // Actualizar el índice (inicio de la ventana visible en caché)
                    setCurrentMessageIndex(prev => ({ ...prev, [phone]: startIndex }));
                    
                    // 📍 RESTAURAR posición de scroll después de que se agreguen los mensajes
                    setTimeout(() => {
                      if (messagesContainer) {
                        const scrollHeightAfter = messagesContainer.scrollHeight;
                        const heightDifference = scrollHeightAfter - scrollHeightBefore;
                        messagesContainer.scrollTop = scrollTopBefore + heightDifference;
                      }
                      // 🔓 Desactivar flag después de restaurar scroll (delay mayor para asegurar render completo)
                      setTimeout(() => setIsLoadingMoreMessages(false), 100);
                    }, 100);
                    
                    // Si llegamos al inicio del caché, marcar que no hay más en memoria
                    if (startIndex === 0) {
                      // Caché de memoria agotado
                      // Verificar si hay más en la BD
                      if (cachedMessages.length >= 100) {
                        // Puede haber más mensajes en BD
                      } else {
                        setMessagesEndReached(prev => ({ ...prev, [phone]: true }));
                      }
                    }
                  } else {
                    // No hay más en caché, hacer llamada a la API
                    
                    setMessagesLoading(prev => ({ ...prev, [phone]: true }));
                    
                    try {
                      const currentOffset = cachedMessages.length; // Offset basado en mensajes ya cargados
                      const response = await axios.get(`/api/messages/${phone}`, {
                        params: { limit: 100, offset: currentOffset },
                        headers: {}
                      });
                      let fetchedMessages: RawApiMessage[] = response.data.mensajes || response.data.messages || [];

                      if (env.enableLogging) {
                        logger.debug('LOAD_MORE_API_PAGE', { phone, requestedOffset: currentOffset, fetchedCount: fetchedMessages.length });
                      }
                      
                      if (fetchedMessages.length > 0) {
                        
                        const allMappedMessages: ChatMessage[] = fetchedMessages.map((msg) => {
                          const emisor = normalizeSenderType(msg.emisor || msg.tipo || '');
                          const rawTimestamp = msg.created_at ?? msg.createdAt ?? msg.fecha ?? msg.timestamp;
                          const msgDate = parseMessageDate(rawTimestamp);
                          const rawContent = (msg.contenido ?? msg.cuerpo ?? msg.mensaje ?? '[Mensaje sin contenido]') as string;
                          const resolvedFileUrl = msg.url_archivo || extractFileUrlFromText(rawContent);
                          const resolvedFilename = msg.archivo_nombre || deriveFilenameFromUrl(resolvedFileUrl || undefined);
                          const normalizedType = normalizeMessageType(msg.tipo, 'text', {
                            fileUrl: resolvedFileUrl,
                            filename: resolvedFilename,
                            text: rawContent
                          });
                          return {
                            id: msg.id,
                            text: rawContent,
                            time: formatTime(msgDate),
                            date: msgDate.toISOString(),
                            sent: !isUserSender(emisor),
                            read: true,
                            type: normalizedType,
                            fileUrl: resolvedFileUrl,
                            filename: resolvedFilename,
                            size: msg.archivo_tamanio,
                            duration: msg.duracion
                          };
                        });
                        
                        // Añadir al caché (al principio, porque son mensajes más antiguos)
                        let updatedCache = mergeMessageBatches(cachedMessages, allMappedMessages);

                        // Fallback: algunos backends ignoran offset y devuelven siempre la misma página.
                        // Si no crece la caché, pedimos una ventana mayor desde offset=0.
                        if (updatedCache.length <= cachedMessages.length) {
                          const expandedLimit = Math.min(cachedMessages.length + 100, 1000);
                          const retryResponse = await axios.get(`/api/messages/${phone}`, {
                            params: { limit: expandedLimit, offset: 0 },
                            headers: {}
                          });
                          const retryMessages: RawApiMessage[] = retryResponse.data.mensajes || retryResponse.data.messages || [];

                          if (env.enableLogging) {
                            logger.debug('LOAD_MORE_API_RETRY', { phone, requestedLimit: expandedLimit, retryFetchedCount: retryMessages.length });
                          }

                          if (retryMessages.length > fetchedMessages.length) {
                            fetchedMessages = retryMessages;
                            const retryMapped = retryMessages.map((msg) => {
                              const emisor = normalizeSenderType(msg.emisor || msg.tipo || '');
                              const rawTimestamp = msg.created_at ?? msg.createdAt ?? msg.fecha ?? msg.timestamp;
                              const msgDate = parseMessageDate(rawTimestamp);
                              const rawContent = (msg.contenido ?? msg.cuerpo ?? msg.mensaje ?? '[Mensaje sin contenido]') as string;
                              const resolvedFileUrl = msg.url_archivo || extractFileUrlFromText(rawContent);
                              const resolvedFilename = msg.archivo_nombre || deriveFilenameFromUrl(resolvedFileUrl || undefined);
                              const normalizedType = normalizeMessageType(msg.tipo, 'text', {
                                fileUrl: resolvedFileUrl,
                                filename: resolvedFilename,
                                text: rawContent
                              });
                              return {
                                id: msg.id,
                                text: rawContent,
                                time: formatTime(msgDate),
                                date: msgDate.toISOString(),
                                sent: !isUserSender(emisor),
                                read: true,
                                type: normalizedType,
                                fileUrl: resolvedFileUrl,
                                filename: resolvedFilename,
                                size: msg.archivo_tamanio,
                                duration: msg.duracion
                              } as ChatMessage;
                            });
                            updatedCache = mergeMessageBatches(cachedMessages, retryMapped);
                          }
                        }
                        setAllMessagesCache(prev => {
                          const nextCache = { ...prev, [cachePhone]: updatedCache };
                          return applyMessageCachePolicy(nextCache);
                        });
                        
                        // Aumentar ventana visible en +messagesLimit tomando desde el final de caché.
                        const currentVisible = currentChat.messages || [];
                        const nextVisibleCount = Math.min(
                          updatedCache.length,
                          (currentVisible.length || 0) + messagesLimit
                        );
                        const startIndex = Math.max(0, updatedCache.length - nextVisibleCount);
                        const nextVisibleMessages = updatedCache.slice(startIndex);

                        if (env.enableLogging) {
                          logger.debug('LOAD_MORE_RESULT', {
                            phone,
                            updatedCacheCount: updatedCache.length,
                            previousVisible: currentVisible.length,
                            nextVisible: nextVisibleMessages.length,
                            startIndex
                          });
                        }
                        
                        setConversationsState(prev => {
                          const updated = [...prev];
                          const chatIndex = updated.findIndex(c => phonesMatch(c.phone, phone));
                          if (chatIndex !== -1) {
                            updated[chatIndex].messages = nextVisibleMessages;
                          }
                          return updated;
                        });
                        
                        // 📍 RESTAURAR posición de scroll después de que se agreguen los mensajes
                        setTimeout(() => {
                          if (messagesContainer) {
                            const scrollHeightAfter = messagesContainer.scrollHeight;
                            const heightDifference = scrollHeightAfter - scrollHeightBefore;
                            messagesContainer.scrollTop = scrollTopBefore + heightDifference;
                          }
                          // 🔓 Desactivar flag después de restaurar scroll (delay mayor para asegurar render completo)
                          setTimeout(() => setIsLoadingMoreMessages(false), 100);
                        }, 100);
                        
                        // Actualizar índice según inicio de ventana visible
                        setCurrentMessageIndex(prev => ({
                          ...prev,
                          [phone]: startIndex
                        }));

                        // Si no creció la caché, asumir que no hay más para evitar clicks inútiles
                        if (updatedCache.length <= cachedMessages.length) {
                          setMessagesEndReached(prev => ({ ...prev, [phone]: true }));
                        }
                        
                        if (fetchedMessages.length < 100) {
                          setMessagesEndReached(prev => ({ ...prev, [phone]: true }));
                        }
                      } else {
                        setMessagesEndReached(prev => ({ ...prev, [phone]: true }));
                        setIsLoadingMoreMessages(false); // Desactivar flag si no hay más mensajes
                      }
                    } catch (error) {
                      logger.error(error, { phase: 'loadMoreMessages' });
                      trackAction('messages_load_more_failed', { phone });
                      emitConnectionAlert({
                        kind: 'warning',
                        title: 'Error al cargar mensajes',
                        description: 'No se pudieron traer mensajes anteriores. Probá de nuevo.'
                      });
                      setIsLoadingMoreMessages(false); // Desactivar flag en caso de error
                    } finally {
                      setMessagesLoading(prev => ({ ...prev, [phone]: false }));
                    }
                  }
                }}
                disabled={messagesLoading[currentChat.phone]}
                className="px-4 py-2 rounded-full shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                style={{
                  backgroundColor: themeColors[theme].hex,
                  color: 'white'
                }}
              >
                {messagesLoading[currentChat.phone] ? 'Cargando...' : 'Cargar más mensajes'}
              </button>
            </div>
          )}
          {dragOverChat && (
            <div className="absolute inset-0 bg-black/30 rounded-lg border-2 border-dashed border-white flex items-center justify-center z-40">
              <div className="text-white text-center">
                <p className="text-lg font-semibold">Soltá el archivo aquí</p>
              </div>
            </div>
          )}
          {selectionMode && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                className="p-2 rounded-full shadow-lg bg-gray-600 text-white hover:bg-gray-700 transition"
                title="Cancelar selección"
                onClick={() => exitSelection()}
              >
                <X className="w-5 h-5" />
              </button>
              <button
                className={`p-2 rounded-full shadow-lg bg-red-600 text-white hover:bg-red-700 transition ${(() => {
                  if (selectedChat === null) return 'opacity-50 cursor-not-allowed';
                  const ownIds = selectedMessageIds.filter(id => {
                    const m = conversationsState[selectedChat].messages.find((mm) => mm.id === id);
                    return m?.sent === true;
                  });
                  return ownIds.length === 0 ? 'opacity-50 cursor-not-allowed' : '';
                })()}`}
                title="Eliminar seleccionados"
                onClick={() => deleteSelectedMessages()}
              >
                <div className="flex items-center gap-2">
                  <Trash className="w-5 h-5" />
                  <span className="text-sm font-semibold">
                    {(() => {
                      if (selectedChat === null) return '(0)';
                      const ownIds = selectedMessageIds.filter(id => {
                        const m = conversationsState[selectedChat].messages.find((mm) => mm.id === id);
                        return m?.sent === true;
                      });
                      return `(${ownIds.length})`;
                    })()}
                  </span>
                </div>
              </button>
            </div>
          )}
          {filteredMessages.map((msg, idx) => {
            const prev = idx > 0 ? filteredMessages[idx - 1] : null;
            const labelFor = (m: ChatMessage | null) => {
              if (!m?.date) return '';
              const d = new Date(m.date);
              const today = new Date();
              const yday = new Date();
              yday.setDate(today.getDate() - 1);
              const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
              if (sameDay(d, today)) return 'Hoy';
              if (sameDay(d, yday)) return 'Ayer';
              return d.toLocaleDateString();
            };
            const currLabel = labelFor(msg);
            const prevLabel = labelFor(prev);
            const isImage = msg.type === 'image' || (typeof msg.text === 'string' && (msg.text.startsWith('http') || msg.text.startsWith('data:image')));
            
            // Animación rápida: 0.25s para aparición inmediata, sin delay escalonado
            // Usar key estable (msg.id) evita re-render al actualizar el ID del mensaje
            
            return (
              <div 
                key={msg.id} 
                className="space-y-2 pb-3"
              >
                {currLabel && currLabel !== prevLabel && (
                  <div className="flex justify-center my-2 animate-fadeIn">
                    <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-xs">
                      {currLabel}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className="relative" 
                    onClick={() => selectionMode && toggleMessageSelection(msg.id)}
                    data-message-id={msg.id}
                  >
                    <div 
                      className={`absolute inset-0 rounded-2xl transition-all duration-500 pointer-events-none ${
                        highlightedMessage === msg.id ? 'ring-4 ring-yellow-400 dark:ring-yellow-500 animate-pulse' : ''
                      }`}
                    />
                    {selectionMode && (
                      <button
                        className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md border shadow"
                        style={{
                          backgroundColor: selectedMessageIds.includes(msg.id) ? themeColors[theme].hex : 'white',
                          borderColor: selectedMessageIds.includes(msg.id) ? themeColors[theme].hex : '#d1d5db'
                        }}
                        onClick={(e) => { e.stopPropagation(); toggleMessageSelection(msg.id); }}
                        aria-label={selectedMessageIds.includes(msg.id) ? 'Deseleccionar' : 'Seleccionar'}
                      >
                        {selectedMessageIds.includes(msg.id) && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                    )}
                  {isImage ? (
                    <div
                      className="relative max-w-[280px] sm:max-w-xs rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity group"
                      style={selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {}}
                      onContextMenu={(e) => { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}
                      onClick={() => { 
                        setLightboxImage(getMediaUrl(msg.fileUrl) || msg.text); 
                        setLightboxMessageId(msg.id); 
                      }}
                    >
                      <button
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-black/40 text-white p-1 rounded-full"
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                        title="Copiar"
                      >
                        {copiedMessageId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <img src={getMediaUrl(msg.fileUrl) || msg.text} alt="imagen" className="w-full h-auto object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 flex items-center justify-end gap-1 text-white/90">
                        <span className="text-[10px] leading-none">{msg.time}</span>
                        {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                      </div>
                    </div>
                  ) : msg.type === 'video' ? (
                    <div
                      className="relative max-w-[280px] sm:max-w-xs rounded-2xl overflow-hidden shadow-sm group"
                      style={selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {}}
                      onContextMenu={(e) => { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}
                    >
                      <button
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-black/40 text-white p-1 rounded-full z-10"
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                        title="Copiar"
                      >
                        {copiedMessageId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <video 
                        src={getMediaUrl(msg.fileUrl)} 
                        className="w-full h-auto object-cover cursor-pointer"
                        preload="metadata"
                        onClick={() => { setLightboxVideo(getMediaUrl(msg.fileUrl)); setLightboxMessageId(msg.id); }}
                      />
                      {/* Botón Play centrado */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        onClick={() => { setLightboxVideo(getMediaUrl(msg.fileUrl)); setLightboxMessageId(msg.id); }}
                      >
                        <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-black/80 hover:scale-110">
                          <Play size={32} className="text-white ml-1" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 flex items-center justify-end gap-1 text-white/90">
                        <span className="text-[10px] leading-none">{msg.time}</span>
                        {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                      </div>
                    </div>
                  ) : msg.type === 'audio' ? (
                    <>
                      <audio
                        id={`audio-${msg.id}`}
                        src={getMediaUrl(msg.fileUrl)}
                        onLoadedData={(e) => {
                          const audio = e.currentTarget;
                          audio.volume = audioVolume[msg.id] ?? 1;
                        }}
                        onTimeUpdate={(e) => {
                          const audio = e.currentTarget;
                          const progress = (audio.currentTime / audio.duration) * 100;
                          setAudioProgress(prev => ({ ...prev, [msg.id]: progress }));
                        }}
                        onEnded={() => {
                          setAudioPlaying(null);
                          setAudioProgress(prev => ({ ...prev, [msg.id]: 0 }));
                        }}
                        className="hidden"
                      />
                      <div
                        className={`relative group max-w-[280px] sm:max-w-sm px-4 py-3 rounded-2xl shadow-sm ${
                          msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                        }`}
                        style={msg.sent ? {
                          backgroundImage: `linear-gradient(to right, ${themeColors[theme].hex}, #14b8a6)`,
                          ...( selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})
                        } : (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})}
                        onContextMenu={(e) => { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}
                      >
                        <button
                          className={`absolute top-2 right-2 p-1 rounded-full transition opacity-0 group-hover:opacity-100 ${msg.sent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}
                          onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                          title="Copiar"
                        >
                          {copiedMessageId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const audioElement = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
                              if (audioElement) {
                                if (audioPlaying === msg.id) {
                                  audioElement.pause();
                                  setAudioPlaying(null);
                                } else {
                                  if (audioPlaying !== null) {
                                    const otherAudio = document.getElementById(`audio-${audioPlaying}`) as HTMLAudioElement;
                                    if (otherAudio) otherAudio.pause();
                                  }
                                  audioElement.play();
                                  setAudioPlaying(msg.id);
                                }
                              }
                            }}
                            className={`p-2 rounded-full flex-shrink-0 transition-all ${
                              msg.sent
                                ? 'bg-white/20 hover:bg-white/30 text-white'
                                : `hover:bg-gray-100 dark:hover:bg-gray-700`
                            }`}
                            style={!msg.sent ? { color: themeColors[theme].hex } : undefined}
                          >
                            {audioPlaying === msg.id ? (
                              <Pause size={20} />
                            ) : (
                              <Play size={20} />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            {(() => {
                              const audioElement = typeof document !== 'undefined' ? document.getElementById(`audio-${msg.id}`) as HTMLAudioElement | null : null;
                              const duration = audioElement?.duration || 0;
                              const currentTime = audioElement?.currentTime || 0;
                              const durationMins = Math.floor(duration / 60);
                              const durationSecs = Math.floor(duration % 60);
                              const currentMins = Math.floor(currentTime / 60);
                              const currentSecs = Math.floor(currentTime % 60);
                              const isPlaying = audioPlaying === msg.id;
                              
                              return (
                                <>
                                  <div 
                                    className="w-full bg-white/30 rounded-full h-1 mb-1 cursor-pointer"
                                    onClick={(e) => {
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                      const percent = (e.clientX - rect.left) / rect.width;
                                      const audioElement = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
                                      if (audioElement) {
                                        audioElement.currentTime = percent * audioElement.duration;
                                      }
                                    }}
                                  >
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${(currentTime / duration) * 100 || 0}%`,
                                        backgroundColor: msg.sent ? 'white' : themeColors[theme].hex
                                      }}
                                    />
                                  </div>
                                  <div className={`text-xs ${msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {isPlaying ? (
                                      <span>{String(currentMins).padStart(2, '0')}:{String(currentSecs).padStart(2, '0')} / {String(durationMins).padStart(2, '0')}:{String(durationSecs).padStart(2, '0')}</span>
                                    ) : (
                                      <span>{String(durationMins).padStart(2, '0')}:{String(durationSecs).padStart(2, '0')}</span>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          
                          {/* Volume control */}
                          <div 
                            className="relative flex items-center"
                            onMouseEnter={() => setShowVolumeControl(msg.id)}
                            onMouseLeave={() => setShowVolumeControl(null)}
                          >
                            <button onClick={() => {
                              const audioElement = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
                              if (audioElement) {
                                const currentVol = audioVolume[msg.id] ?? 1;
                                if (currentVol > 0) {
                                  audioElement.volume = 0;
                                  setAudioVolume(prev => ({ ...prev, [msg.id]: 0 }));
                                } else {
                                  audioElement.volume = 1;
                                  setAudioVolume(prev => ({ ...prev, [msg.id]: 1 }));
                                }
                              }
                            }}
                            className={`p-1 flex-shrink-0 transition-all ${
                              msg.sent
                                ? 'hover:bg-white/20 text-white'
                                : `hover:bg-gray-100 dark:hover:bg-gray-700`
                            }`}
                            style={!msg.sent ? { color: themeColors[theme].hex } : undefined}
                            >
                              {(() => {
                                const vol = audioVolume[msg.id] ?? 1;
                                if (vol === 0) return <VolumeX size={18} />;
                                if (vol < 0.5) return <Volume1 size={18} />;
                                return <Volume2 size={18} />;
                              })()}
                            </button>
                            
                            <div className={`absolute right-full mr-2 transition-all duration-300 ease-out ${
                              showVolumeControl === msg.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
                            }`}>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={(audioVolume[msg.id] ?? 1) * 100}
                                onChange={(e) => {
                                  const audioElement = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
                                  const volume = parseFloat(e.target.value) / 100;
                                  if (audioElement) audioElement.volume = volume;
                                  setAudioVolume(prev => ({ ...prev, [msg.id]: volume }));
                                }}
                                className="w-24 accent-emerald-500"
                                style={{
                                  background: `linear-gradient(to right, ${msg.sent ? 'white' : themeColors[theme].hex} 0%, ${msg.sent ? 'white' : themeColors[theme].hex} ${(audioVolume[msg.id] ?? 1) * 100}%, ${msg.sent ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'} ${(audioVolume[msg.id] ?? 1) * 100}%, ${msg.sent ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'} 100%)`
                                }}
                              />
                              <div className={`text-xs mt-1 text-center ${msg.sent ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                                {Math.round((audioVolume[msg.id] ?? 1) * 100)}%
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 justify-end mt-2 ${msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                          <span className="text-xs">{msg.time}</span>
                          {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>
                      </div>
                    </>
                  ) : msg.type === 'interactive' ? (
                    <div
                      className={`relative group max-w-[320px] rounded-2xl shadow-lg overflow-hidden ${
                        msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                      }`}
                      style={msg.sent ? {
                        backgroundImage: `linear-gradient(to right, ${themeColors[theme].hex}, #14b8a6)`,
                        ...( selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})
                      } : (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})}
                      onContextMenu={(e) => { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}
                    >
                      <button
                        className={`absolute top-2 right-2 p-1 rounded-full transition opacity-0 group-hover:opacity-100 z-10 ${msg.sent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                        title="Copiar"
                      >
                        {copiedMessageId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      
                      {(() => {
                        try {
                          const menuData = (typeof msg.text === 'string' ? JSON.parse(msg.text) : msg.text) as InteractiveMessagePayload;
                          
                          return (
                            <>
                              {/* Header */}
                              {menuData.header && (
                                <div className="px-4 pt-4 pb-2">
                                  <div className="flex items-center gap-2">
                                    <svg className={msg.sent ? 'text-white' : ''} style={!msg.sent ? { color: themeColors[theme].hex } : undefined} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M3 12h18M3 6h18M3 18h18"/>
                                    </svg>
                                    <h3 className="font-semibold text-base">{menuData.header}</h3>
                                  </div>
                                </div>
                              )}
                              
                              {/* Body */}
                              {menuData.body && (
                                <div className={`px-4 pb-3 ${menuData.header ? 'pt-1' : 'pt-4'}`}>
                                  <p className="text-sm opacity-90">{menuData.body}</p>
                                </div>
                              )}

                              {/* Botones interactivos (WhatsApp interactive_buttons) */}
                              {menuData.buttons && menuData.buttons.length > 0 && (
                                <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: msg.sent ? 'rgba(255,255,255,0.2)' : (darkMode ? '#374151' : '#e5e7eb') }}>
                                  {menuData.buttons.map((button: InteractiveButton, bIdx: number) => (
                                    <div
                                      key={button.id || bIdx}
                                      className="w-full px-3 py-2.5 rounded-lg border text-sm font-medium text-center"
                                      style={{
                                        borderColor: msg.sent ? 'rgba(255,255,255,0.35)' : themeColors[theme].hex,
                                        color: msg.sent ? 'white' : themeColors[theme].hex,
                                        backgroundColor: msg.sent ? 'rgba(255,255,255,0.08)' : 'transparent'
                                      }}
                                    >
                                      {button.title || 'Opcion'}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Secciones con opciones - Compacto por defecto, expandible */}
                              {menuData.sections && menuData.sections.length > 0 && (
                                <div className="border-t" style={{ borderColor: msg.sent ? 'rgba(255,255,255,0.2)' : (darkMode ? '#374151' : '#e5e7eb') }}>
                                  {menuData.sections.map((section: InteractiveSection, sIdx: number) => {
                                    const menuId = `menu_${msg.id}_${sIdx}`;
                                    const isExpanded = expandedMenus.has(menuId);
                                    const totalOptions = (section.rows || []).length;
                                    
                                    return (
                                      <div key={sIdx}>
                                        {/* Botón principal para expandir/colapsar */}
                                        {menuData.buttonText && (
                                          <div className="px-4 py-2">
                                            <div 
                                              onClick={() => {
                                                setExpandedMenus(prev => {
                                                  const newSet = new Set(prev);
                                                  if (newSet.has(menuId)) {
                                                    newSet.delete(menuId);
                                                  } else {
                                                    newSet.add(menuId);
                                                  }
                                                  return newSet;
                                                });
                                              }}
                                              className="w-full px-3 py-2 rounded-lg border text-center text-sm font-medium cursor-pointer transition hover:opacity-80"
                                              style={{
                                                borderColor: msg.sent ? 'rgba(255,255,255,0.4)' : themeColors[theme].hex,
                                                color: msg.sent ? 'white' : themeColors[theme].hex,
                                                backgroundColor: msg.sent ? 'rgba(255,255,255,0.1)' : 'transparent'
                                              }}
                                            >
                                              {menuData.buttonText} {isExpanded ? '▲' : '▼'}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Opciones expandibles */}
                                        {isExpanded && (
                                          <div className="px-2 pb-2 max-h-96 overflow-y-auto">
                                            {section.title && (
                                              <div className="px-4 pt-2 pb-1">
                                                <h4 className="text-xs font-semibold uppercase tracking-wide opacity-70">
                                                  {section.title}
                                                </h4>
                                              </div>
                                            )}
                                            {(section.rows || []).map((option: InteractiveOption, oIdx: number) => (
                                              <div 
                                                key={option.id || oIdx}
                                                className="mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all border"
                                                style={{
                                                  backgroundColor: msg.sent ? 'rgba(255,255,255,0.05)' : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'),
                                                  borderColor: msg.sent ? 'rgba(255,255,255,0.15)' : (darkMode ? '#374151' : '#e5e7eb')
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.backgroundColor = msg.sent ? 'rgba(255,255,255,0.15)' : (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.backgroundColor = msg.sent ? 'rgba(255,255,255,0.05)' : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)');
                                                }}
                                              >
                                                <div className="font-medium text-sm leading-tight">{option.title}</div>
                                                {option.description && (
                                                  <div className="text-xs opacity-75 mt-1 leading-snug">{option.description}</div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Timestamp */}
                              <div className={`px-4 py-2 flex items-center gap-1 justify-end ${msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                <span className="text-xs">{msg.time}</span>
                                {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                              </div>
                            </>
                          );
                        } catch (e) {
                          // Si no se puede parsear JSON, mostrar como texto plano
                          return (
                            <div className="px-4 py-3">
                              <p className="text-sm">{msg.text}</p>
                              <div className={`flex items-center gap-1 justify-end mt-2 ${msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                <span className="text-xs">{msg.time}</span>
                                {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  ) : msg.type === 'file' ? (
                    <div
                      role="button"
                      tabIndex={0}
                      className={`relative group max-w-[300px] sm:max-w-md px-4 py-3 rounded-2xl shadow-sm block transition-all duration-200 cursor-pointer ${
                        msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                      }`}
                      style={msg.sent ? {
                        backgroundImage: `linear-gradient(to right, ${themeColors[theme].hex}, #14b8a6)`,
                        border: '1px solid rgba(255,255,255,0.18)',
                        ...( selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})
                      } : {
                        border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                        ...(selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (msg.fileUrl) {
                          setLightboxFile({ url: getMediaUrl(msg.fileUrl), filename: msg.filename || 'document' });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          if (msg.fileUrl) {
                            setLightboxFile({ url: getMediaUrl(msg.fileUrl), filename: msg.filename || 'document' });
                          }
                        }
                      }}
                      onContextMenu={(e) => { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}
                    >
                      <button
                        className={`absolute top-2 right-2 p-1 rounded-full transition opacity-0 group-hover:opacity-100 ${msg.sent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                        title="Copiar"
                      >
                        {copiedMessageId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <div className="flex items-start gap-3">
                        {(() => {
                          const isPdf = msg.filename?.toLowerCase().endsWith('.pdf');
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.filename || '');
                          
                          if (isPdf && msg.fileUrl) {
                            return (
                              <div className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border ${msg.sent ? 'border-white/20' : 'border-gray-200 dark:border-gray-600'}`}>
                                <iframe 
                                  src={`${getMediaUrl(msg.fileUrl)}#page=1&toolbar=0&navpanes=0&scrollbar=0`}
                                  className="w-full h-full pointer-events-none scale-150 origin-top-left"
                                />
                              </div>
                            );
                          } else if (isImage && msg.fileUrl) {
                            return (
                              <img 
                                src={getMediaUrl(msg.fileUrl)} 
                                alt={msg.filename}
                                className="flex-shrink-0 w-16 h-16 rounded-xl object-cover"
                              />
                            );
                          } else {
                            return (
                              <div
                                className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${msg.sent ? 'bg-white/15 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                                style={!msg.sent ? { color: themeColors[theme].hex } : undefined}
                              >
                                <FileText size={26} />
                              </div>
                            );
                          }
                        })()}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate pr-6">{msg.filename || msg.text}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide ${msg.sent ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                              {getFileExtension(msg.filename)}
                            </span>
                            <span className={`text-xs ${msg.sent ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'}`}>
                              {formatFileSize(msg.size)}
                            </span>
                          </div>
                          <p className={`mt-1 text-[11px] ${msg.sent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                            Presiona para previsualizar
                          </p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 justify-end mt-3 pt-2 border-t ${msg.sent ? 'text-white/80 border-white/20' : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                        <span className="text-xs">{msg.time}</span>
                        {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative group max-w-[280px] sm:max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                        msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                      }`}
                      style={msg.sent ? {
                        backgroundImage: `linear-gradient(to right, ${themeColors[theme].hex}, #14b8a6)`,
                        ...( selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})
                      } : (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})}
                      onContextMenu={(e) => { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}
                    >
                      <button
                        className={`absolute top-2 right-2 p-1 rounded-full transition opacity-0 group-hover:opacity-100 ${msg.sent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                        title="Copiar"
                      >
                        {copiedMessageId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      {(() => {
                        const fullText = msg.text || '';
                        const isExpanded = expandedMessages.has(msg.id);
                        const isTruncated = fullText.length > 300;
                        const displayText = isTruncated && !isExpanded ? fullText.substring(0, 300) + '...' : fullText;
                        
                        const parseTextWithFormatting = (text: string) => {
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const parts = text.split(urlRegex);
                          
                          return parts.map((part, i) => {
                            if (urlRegex.test(part)) {
                              return (
                                <a 
                                  key={i}
                                  href={part}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline font-medium hover:opacity-80 break-all"
                                  onClick={(e) => e.stopPropagation()}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setUrlContextMenu({ visible: true, x: e.clientX, y: e.clientY, url: part });
                                  }}
                                >
                                  {part}
                                </a>
                              );
                            }
                            const safeHtml = formatChatMarkdownToSafeHtml(part);
                            return <span key={i} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
                          });
                        };
                        
                        return (
                          <>
                            <p className="whitespace-pre-wrap" style={{ fontSize: 'var(--msg-font-size, 14px)', fontFamily: 'var(--msg-font-family, inherit)' }}>
                              {parseTextWithFormatting(displayText)}
                            </p>
                            {isTruncated && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandMessage(msg.id);
                                }}
                                className={`text-xs mt-1 font-medium ${
                                  msg.sent 
                                    ? 'text-white/80 hover:text-white' 
                                    : `hover:opacity-80`
                                }`}
                                style={!msg.sent ? { color: themeColors[theme].hex } : undefined}
                              >
                                {isExpanded ? 'Leer menos' : 'Leer más'}
                              </button>
                            )}
                          </>
                        );
                      })()}
                      <div className={`flex items-center gap-1 justify-end mt-1 ${msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                        <span className="text-xs">{msg.time}</span>
                        {msg.sent && (() => {
                          if (msg.status === 'sending') {
                            return <Check size={14} className="opacity-60" />;
                          }
                          return <CheckCheck size={14} />;
                        })()}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Indicador de escritura */}
          {currentChat && typingUsers[currentChat.phone] && (
            <div className="flex items-center gap-2 mb-3 ml-4">
              <div className="text-sm italic text-gray-600 dark:text-gray-400">
                <span>{currentChat.name || 'El cliente'} está escribiendo</span>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          {/* Elemento para hacer scroll al final */}
          <div id="messages-end" style={{ height: '1px', float: 'left', clear: 'both' }}></div>
        </div>
  );
});

