import React, { memo, type RefObject } from 'react';
import { Search, MoreVertical } from 'lucide-react';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { Conversation } from '../types/chat';
import type { OperadorInfo } from '../config/auth';
import type { ThemeColorBundle } from '../types/theme';

export type { ThemeColorBundle };

export type OperatorHandoffTicketLite = {
  phone: string;
  ticketId?: string | number | null;
  subdelegacion?: string | null;
  motivo?: string | null;
};

export type SidebarContainerProps = {
  selectedChat: number | null;
  theme: string;
  darkMode: boolean;
  themeColors: ThemeColorBundle;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showSidebarMenu: boolean;
  setShowSidebarMenu: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarMenuRef: RefObject<HTMLDivElement | null>;
  setShowNewConversation: (v: boolean) => void;
  setShowArchived: (v: boolean) => void;
  setShowPreferences: (v: boolean) => void;
  handleLogout: () => void | Promise<void>;
  setConversationsState: React.Dispatch<React.SetStateAction<Conversation[]>>;
  canViewOperatorQueue: boolean;
  pendingOperatorTickets: OperatorHandoffTicketLite[];
  operatorProfile: OperadorInfo | null;
  handoffActionLoading: Record<string, 'accept' | 'complete' | undefined>;
  acceptOperatorChat: (phone: string) => Promise<void>;
  canTakeOperatorQueue: boolean;
  conversationsContainerRef: RefObject<HTMLDivElement | null>;
  conversationsVirtualizer: Virtualizer<HTMLDivElement, Element>;
  filteredConversations: Conversation[];
  normalizePhoneKey: (phone: string) => string;
  openContextMenu: (e: React.MouseEvent, type: 'chat' | 'message', id: number) => void;
  selectChatById: (chatId?: number | null, fallbackIndex?: number | null) => void;
  setChatClosed: (v: boolean) => void;
  markChatReadById: (id: number) => void;
  newChatAnimations: Record<string, boolean>;
  getContactStatus: (d: string | Date) => { color: string; label: string; code: string };
  selectedId: number | null;
  isHumanConversation: (status: string | undefined) => boolean;
  normalizeOperatorIdentity: (name: string | null | undefined) => string;
  currentOperatorName: string;
  getStatusBadgeMeta: (
    status: string | undefined,
    botActive?: boolean
  ) => { label: string; classes: string } | null;
  normalizeMessage: (text: string) => string;
  phonesMatch: (a: string, b: string) => boolean;
};

export const SidebarContainer = memo(function SidebarContainer(p: SidebarContainerProps) {
  const {
    selectedChat,
    theme,
    darkMode,
    themeColors,
    searchQuery,
    setSearchQuery,
    showSidebarMenu,
    setShowSidebarMenu,
    sidebarMenuRef,
    setShowNewConversation,
    setShowArchived,
    setShowPreferences,
    handleLogout,
    setConversationsState,
    canViewOperatorQueue,
    pendingOperatorTickets,
    operatorProfile,
    handoffActionLoading,
    acceptOperatorChat,
    canTakeOperatorQueue,
    conversationsContainerRef,
    conversationsVirtualizer,
    filteredConversations,
    normalizePhoneKey,
    openContextMenu,
    selectChatById,
    setChatClosed,
    markChatReadById,
    newChatAnimations,
    getContactStatus,
    selectedId,
    isHumanConversation,
    normalizeOperatorIdentity,
    currentOperatorName,
    getStatusBadgeMeta,
    normalizeMessage,
    phonesMatch
  } = p;

  return (
      <div className={`${selectedChat === null ? 'block' : 'hidden'} md:flex w-full md:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col`}>
        {/* Header */}
        <div className="p-4 text-white" style={{ background: `linear-gradient(to right, ${themeColors[theme].hex}, #14b8a6)` }}>
          <div className="flex items-center justify-center mb-4">
            <img src="/Marca-IRRIGACIÓN-blanco.png" alt="Irrigación" className="h-24 w-auto" />
            <div className="flex items-center gap-2 absolute left-6" ref={sidebarMenuRef}>
              <button 
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                onClick={() => setShowSidebarMenu((v) => !v)}
              >
                <MoreVertical size={20} />
              </button>
              {showSidebarMenu && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 animate-slideInDown">
                  <button 
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100"
                    onClick={() => { setShowNewConversation(true); setShowSidebarMenu(false); }}
                  >
                    Nueva conversación
                  </button>
                  <button 
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100"
                    onClick={() => setConversationsState(prev => prev.map(c => ({ ...c, unread: 0 })))}
                  >
                    Marcar todas como leídas
                  </button>
                  <button 
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100"
                    onClick={() => { setShowArchived(true); setShowSidebarMenu(false); }}
                  >
                    Archivar conversaciones
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button 
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100"
                    onClick={() => { setShowPreferences(true); setShowSidebarMenu(false); }}
                  >
                    Configuración
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button 
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                    onClick={handleLogout}
                  >
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-700 dark:text-gray-200" size={18} />
            <input
              type="text"
              placeholder="Buscar conversación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all text-gray-900 placeholder-gray-500 dark:bg-white/10 dark:text-white dark:placeholder-white dark:focus:bg-white/10"
            />
          </div>
        </div>

        {/* Conversaciones */}
        {canViewOperatorQueue && pendingOperatorTickets.length > 0 && (
          <div className="mx-3 mt-3 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-800 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-100">
                Clientes esperando operador: {pendingOperatorTickets.length}
              </p>
              {operatorProfile?.subdelegacion_nombre && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-100">
                  {operatorProfile.subdelegacion_nombre}
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {pendingOperatorTickets.map((ticket) => {
                const phoneKey = normalizePhoneKey(ticket.phone);
                const loading = handoffActionLoading[phoneKey] === 'accept';
                return (
                  <div
                    key={`${ticket.ticketId || 'pending'}-${phoneKey}`}
                    className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white/80 dark:bg-gray-900/50 px-3 py-2"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ticket.subdelegacion || 'Sin subdelegación'}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ticket.phone}</p>
                    {ticket.motivo && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{ticket.motivo}</p>
                    )}
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void acceptOperatorChat(ticket.phone)}
                        disabled={loading || !canTakeOperatorQueue}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-60"
                        style={{ backgroundColor: themeColors[theme].hex }}
                      >
                        {!canTakeOperatorQueue ? 'Solo lectura' : (loading ? 'Tomando...' : 'Tomar chat')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div ref={conversationsContainerRef} className="flex-1 overflow-y-auto">
          <div
            style={{
              height: `${conversationsVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
          {conversationsVirtualizer.getVirtualItems().map((virtualRow) => {
            const conv = filteredConversations[virtualRow.index];
            if (!conv) return null;
            // Determinar si la sesión está vencida
            const sessionExpiredForChat = (() => {
              if (conv.lastUserInteraction) {
                const lastUser = new Date(conv.lastUserInteraction);
                const diffMs = Date.now() - lastUser.getTime();
                return diffMs > 24 * 60 * 60 * 1000;
              }
              if (!conv.messages || conv.messages.length === 0) return false;
              for (let i = conv.messages.length - 1; i >= 0; i--) {
                const m = conv.messages[i];
                if (m && m.sent === false) {
                  const lastUser = new Date(m.date);
                  const diffMs = Date.now() - lastUser.getTime();
                  return diffMs > 24 * 60 * 60 * 1000;
                }
              }
              return false;
            })();
            const hasPendingHandoff = pendingOperatorTickets.some((ticket) => phonesMatch(ticket.phone, conv.phone));
            const statusMeta = getStatusBadgeMeta(hasPendingHandoff ? 'ESPERA_OPERADOR' : conv.conversationStatus, conv.botActive);

            return (
            <div
              key={conv.id ?? conv.phone ?? virtualRow.index}
              ref={conversationsVirtualizer.measureElement}
              data-index={virtualRow.index}
              onContextMenu={(e) => openContextMenu(e, 'chat', conv.id)}
              onClick={() => {
                selectChatById(conv.id);
                setChatClosed(false);
                // Marcar como leído cuando se selecciona el chat
                markChatReadById(conv.id);
              }}
              className={`p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 absolute left-0 top-0 w-full ${
                newChatAnimations[normalizePhoneKey(conv.phone)] ? 'animate-chat-entry' : ''
              } ${
                sessionExpiredForChat ? 'opacity-60' : 'opacity-100'
              }`}
              style={selectedId === conv.id ? {
                transform: `translateY(${virtualRow.start}px)`,
                backgroundColor: darkMode ? `${themeColors[theme].hex}20` : `${themeColors[theme].hex}10`,
                borderLeft: `4px solid ${themeColors[theme].hex}`,
                borderRightWidth: sessionExpiredForChat ? '3px' : '0px',
                borderRightColor: sessionExpiredForChat ? '#ef4444' : undefined,
                borderRightStyle: sessionExpiredForChat ? 'solid' : undefined
              } : {
                transform: `translateY(${virtualRow.start}px)`,
                borderRightWidth: sessionExpiredForChat ? '3px' : '0px',
                borderRightColor: sessionExpiredForChat ? '#ef4444' : undefined,
                borderRightStyle: sessionExpiredForChat ? 'solid' : undefined
              }}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  {conv.profilePic ? (
                    <img 
                      src={conv.profilePic} 
                      alt={conv.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        // Fallback a las iniciales si la imagen falla
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold transition-colors" style={{
                    backgroundColor: selectedId === conv.id ? themeColors[theme].hex : undefined,
                    backgroundImage: selectedId !== conv.id ? `linear-gradient(135deg, ${themeColors[theme].hex}, #14b8a6)` : undefined,
                    display: conv.profilePic ? 'none' : 'flex'
                  }}>
                    {conv.avatar}
                  </div>
                  {(() => {
                    const lastMsgDate = conv.lastMessageDate 
                      || (conv.messages && conv.messages.length > 0 
                        ? conv.messages[conv.messages.length - 1].date 
                        : new Date());
                    const status = getContactStatus(lastMsgDate);
                    return (
                      <div className={`absolute bottom-0 right-0 w-3 h-3 ${status.color} rounded-full border-2 border-white dark:border-gray-800`}></div>
                    );
                  })()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{conv.name}</h3>
                    {(conv.unread > 0 && selectedId !== conv.id) ? (
                      <span 
                        className="text-white text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse transition-all duration-300"
                        style={{ 
                          backgroundColor: themeColors[theme].hex,
                          opacity: 1,
                          transform: 'scale(1)'
                        }}
                      >
                        {conv.unread}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 transition-opacity duration-300">{conv.time}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-1">
                    {normalizeMessage(conv.lastMessage)}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    {statusMeta && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusMeta.classes}`}>
                        {statusMeta.label}
                      </span>
                    )}
                  </div>
                  {isHumanConversation(conv.conversationStatus) && conv.operator && normalizeOperatorIdentity(conv.operator) !== normalizeOperatorIdentity(currentOperatorName) && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-1 truncate text-right">
                      Tomado por {conv.operator}
                    </p>
                  )}
                </div>
              </div>
            </div>
            );
          })}
          </div>
        </div>
      </div>

  );
});
