import { memo, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { ArrowLeft, Search, MoreVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Conversation } from '../types/chat';
import type { ThemeColorBundle } from '../types/theme';

export type ChatLockInfo = {
  isLockedByAnotherOperator: boolean;
  lockedBy: string | null;
};

export type OperatorHandoffTicketLite = {
  phone: string;
  ticketId?: string | number | null;
  subdelegacion?: string | null;
  motivo?: string | null;
};

export type ChatMainHeaderProps = {
  currentChat: Conversation;
  theme: string;
  themeColors: ThemeColorBundle;
  closeSelectedChat: () => void;
  setShowInfo: Dispatch<SetStateAction<boolean>>;
  startEditName: () => void;
  getContactStatus: (d: string | Date) => { color: string; label: string; code: string };
  getRelativeTime: (d: string | Date) => string;
  currentChatLock: ChatLockInfo;
  pendingOperatorTickets: OperatorHandoffTicketLite[];
  isWaitingOperator: (status?: string | null) => boolean;
  isHumanConversation: (status: string | undefined) => boolean;
  getStatusBadgeMeta: (
    status: string | undefined,
    botActive?: boolean
  ) => { label: string; classes: string } | null;
  normalizePhoneKey: (phone: string) => string;
  phonesMatch: (a: string, b: string) => boolean;
  handoffActionLoading: Record<string, 'accept' | 'complete' | undefined>;
  acceptOperatorChat: (phone: string) => Promise<void>;
  completeOperatorChat: (phone: string) => Promise<void>;
  canTakeOperatorQueue: boolean;
  chatSearchRef: RefObject<HTMLDivElement | null>;
  chatSearchMode: boolean;
  setChatSearchMode: Dispatch<SetStateAction<boolean>>;
  chatSearchText: string;
  setChatSearchText: Dispatch<SetStateAction<string>>;
  chatMenuRef: RefObject<HTMLDivElement | null>;
  showMenu: boolean;
  setShowMenu: Dispatch<SetStateAction<boolean>>;
  markResolved: () => void;
  activateBot: (phone: string) => Promise<void>;
  setShowTransferDialog: Dispatch<SetStateAction<boolean>>;
  setSelectedSubdelegation: Dispatch<SetStateAction<string>>;
  setTransferMotive: Dispatch<SetStateAction<string>>;
  deleteConversation: () => void;
};

export const ChatMainHeader = memo(function ChatMainHeader(p: ChatMainHeaderProps) {
  const { currentChat: c } = p;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={p.closeSelectedChat}
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
        <button
          onClick={() => p.setShowInfo((v) => !v)}
          className="flex items-center gap-3 text-left focus:outline-none"
        >
          <div className="relative">
            {c.profilePic ? (
              <img
                src={c.profilePic}
                alt={c.name}
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{
                backgroundImage: `linear-gradient(135deg, ${p.themeColors[p.theme].hex}, #14b8a6)`,
                display: c.profilePic ? 'none' : 'flex'
              }}
            >
              {c.avatar}
            </div>
            {(() => {
              const lastMsgDate =
                c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].date : new Date();
              const status = p.getContactStatus(lastMsgDate as string | Date);
              return (
                <div className={`absolute bottom-0 right-0 w-3 h-3 ${status.color} rounded-full border-2 border-white dark:border-gray-800`} />
              );
            })()}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div
                className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                onContextMenu={(e) => {
                  e.preventDefault();
                  p.startEditName();
                }}
              >
                {c.name}
              </div>
              {(() => {
                const lastUserMsg = [...(c.messages || [])].reverse().find((m) => m.sent === false)?.date;
                if (!lastUserMsg) return null;
                const lastUser = new Date(lastUserMsg);
                const diffMs = Date.now() - lastUser.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                const diffDays = diffHours / 24;
                if (diffDays > 1) {
                  return (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 text-xs rounded-full font-medium">
                      Sesión vencida
                    </span>
                  );
                }
                if (diffHours > 22) {
                  return (
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 text-xs rounded-full font-medium">
                      Por expirar (~{Math.round(24 - diffHours)}h)
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            {(() => {
              const lastMsgDate =
                c.lastMessageDate ||
                (c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].date : new Date());
              const status = p.getContactStatus(lastMsgDate as string | Date);
              const relativeTime = p.getRelativeTime(lastMsgDate as string | Date);
              return (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 ${status.color} rounded-full`} />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {status.code === 'online' ? 'En línea ahora' : `Último mnj: ${relativeTime}`}
                  </p>
                </div>
              );
            })()}
            {p.currentChatLock.isLockedByAnotherOperator && (
              <p className="text-xs text-rose-600 dark:text-rose-300 font-medium mt-0.5">
                Tomado por {p.currentChatLock.lockedBy} · Solo lectura
              </p>
            )}
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {(() => {
          const phoneKey = p.normalizePhoneKey(c.phone);
          const hasPendingHandoff = p.pendingOperatorTickets.some((ticket) => p.phonesMatch(ticket.phone, c.phone));
          const isWaiting = hasPendingHandoff || p.isWaitingOperator(c.conversationStatus);
          const isHuman = p.isHumanConversation(c.conversationStatus);
          const statusMeta = p.getStatusBadgeMeta(
            isWaiting ? 'ESPERA_OPERADOR' : c.conversationStatus,
            c.botActive
          );
          const actionState = p.handoffActionLoading[phoneKey];

          return (
            <div className="hidden lg:flex items-center gap-2">
              {statusMeta && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.classes}`}>
                  {statusMeta.label}
                </span>
              )}
              {isWaiting && (
                <button
                  type="button"
                  onClick={() => void p.acceptOperatorChat(c.phone)}
                  disabled={actionState !== undefined || !p.canTakeOperatorQueue}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: p.themeColors[p.theme].hex }}
                >
                  {!p.canTakeOperatorQueue ? 'Solo lectura' : actionState === 'accept' ? 'Tomando...' : 'Tomar chat'}
                </button>
              )}
              {isHuman && (
                <button
                  type="button"
                  onClick={() => void p.completeOperatorChat(c.phone)}
                  disabled={actionState !== undefined || p.currentChatLock.isLockedByAnotherOperator}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                >
                  {actionState === 'complete' ? 'Finalizando...' : 'Terminar conversación'}
                </button>
              )}
            </div>
          );
        })()}
        <div className="relative flex items-center" ref={p.chatSearchRef}>
          <div
            className={`flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden transition-all duration-200 ease-out ${
              p.chatSearchMode ? 'w-48 px-3 py-2 opacity-100' : 'w-0 px-0 py-0 opacity-0 pointer-events-none'
            }`}
            style={{ boxShadow: p.chatSearchMode ? '0 4px 12px rgba(0,0,0,0.08)' : undefined }}
          >
            <Search size={16} className="text-gray-500 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              value={p.chatSearchText}
              onChange={(e) => p.setChatSearchText(e.target.value)}
              className="bg-transparent text-sm flex-1 focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              autoFocus={p.chatSearchMode}
            />
            <button
              className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
              onClick={() => {
                p.setChatSearchText('');
                p.setChatSearchMode(false);
              }}
            >
              <X size={14} />
            </button>
          </div>
          <button
            className={`p-2 rounded-lg transition-all duration-200 ease-out ${
              p.chatSearchMode
                ? 'opacity-0 scale-90 pointer-events-none'
                : 'opacity-100 scale-100 pointer-events-auto'
            } hover:bg-gray-100 dark:hover:bg-gray-700`}
            style={{ transitionDelay: p.chatSearchMode ? '0ms' : '160ms' }}
            onClick={() => p.setChatSearchMode(true)}
          >
            <Search size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <div className="relative" ref={p.chatMenuRef}>
          <button
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            onClick={() => p.setShowMenu((v) => !v)}
          >
            <MoreVertical size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          {p.showMenu && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 animate-slideInDown">
              {(() => {
                const phoneKey = p.normalizePhoneKey(c.phone);
                const hasPendingHandoff = p.pendingOperatorTickets.some((ticket) =>
                  p.phonesMatch(ticket.phone, c.phone)
                );
                const isWaiting = hasPendingHandoff || p.isWaitingOperator(c.conversationStatus);
                const isHuman = p.isHumanConversation(c.conversationStatus);
                const actionState = p.handoffActionLoading[phoneKey];

                return (
                  <>
                    {isWaiting && (
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => void p.acceptOperatorChat(c.phone)}
                        disabled={actionState !== undefined || !p.canTakeOperatorQueue}
                      >
                        {!p.canTakeOperatorQueue
                          ? 'Solo lectura'
                          : actionState === 'accept'
                            ? 'Tomando chat...'
                            : 'Tomar chat'}
                      </button>
                    )}
                    {isHuman && (
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                        onClick={() => void p.completeOperatorChat(c.phone)}
                        disabled={actionState !== undefined || p.currentChatLock.isLockedByAnotherOperator}
                      >
                        {actionState === 'complete' ? 'Finalizando...' : 'Terminar conversación'}
                      </button>
                    )}
                    {p.currentChatLock.isLockedByAnotherOperator && (
                      <div className="px-3 py-2 text-xs text-rose-600 dark:text-rose-300 border-t border-gray-200 dark:border-gray-700">
                        Tomado por {p.currentChatLock.lockedBy}. Solo lectura.
                      </div>
                    )}
                  </>
                );
              })()}
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={p.markResolved}
                disabled={p.currentChatLock.isLockedByAnotherOperator}
              >
                Marcar como atendida
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={async () => {
                  if (c.phone) {
                    await p.activateBot(c.phone);
                    p.setShowMenu(false);
                    toast.success('Bot reactivado');
                  }
                }}
                disabled={p.currentChatLock.isLockedByAnotherOperator || c.botActive}
                style={{
                  color: p.currentChatLock.isLockedByAnotherOperator || c.botActive ? '#999' : p.themeColors[p.theme].hex
                }}
              >
                Reactivar bot
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => {
                  p.setShowMenu(false);
                  p.setShowTransferDialog(true);
                  p.setSelectedSubdelegation('');
                  p.setTransferMotive('');
                }}
                disabled={
                  p.currentChatLock.isLockedByAnotherOperator || !p.isHumanConversation(c.conversationStatus)
                }
                style={{
                  color:
                    p.currentChatLock.isLockedByAnotherOperator || !p.isHumanConversation(c.conversationStatus)
                      ? '#999'
                      : p.themeColors[p.theme].hex
                }}
              >
                🔁 Transferir a otra subdelegación
              </button>
              <button
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={p.deleteConversation}
                disabled={p.currentChatLock.isLockedByAnotherOperator}
              >
                Eliminar conversación
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
