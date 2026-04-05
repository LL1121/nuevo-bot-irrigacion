import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Search, MoreVertical, Paperclip, Smile, Check, CheckCheck, X, Image as ImageIcon, FileText, Video, Music, Moon, Sun, ArrowLeft, Trash, Play, Pause, Copy, ChevronUp, Volume2, Volume1, VolumeX } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useVirtualizer } from '@tanstack/react-virtual';
import Login from './components/Login';
import { toast, Toaster } from 'sonner';
import { env } from './config/env';
import { setupAxiosInterceptors } from './utils/axiosInterceptor';
import { auth } from './config/auth';
import { parseTimestamp, formatMessageTime, formatChatHeaderTime, isSessionExpired, toUTC } from './utils/dateTime';
import { sortAndDedupeMessages } from './utils/messageOrder';
import { appendIncomingMessage, mergeMessageBatches } from './services/messageQueue';
import { consumePendingByMatch, registerPendingMessage, removePendingMessage } from './services/optimisticUpdates';
import { useChatStore } from './stores/chatStore';
import { getTemplateDisplayText, normalizeMessageContent } from './services/messageParser';
import { useChatSelection } from './hooks/useChatSelection';
import { useChatMutations } from './hooks/useChatMutations';
import { trackAction, trackErrorRecovery, trackSocketEvent } from './utils/monitoring';
import { applyMessageCachePolicy } from './utils/messageCachePolicy';
import type { ChatMessage, Conversation, RawApiMessage, RawSocketMessage } from './types/chat';

type MediaFilter = 'all' | 'images' | 'videos' | 'files' | 'urls';

type RawChatSummary = {
  id: number;
  telefono: string;
  nombre_whatsapp?: string;
  nombre_asignado?: string;
  ultimo_mensaje?: { cuerpo?: unknown; created_at?: string; fecha?: string } | string;
  ultimo_mensaje_fecha?: string;
  ultima_interaccion?: string;
  mensajes_no_leidos?: number;
  foto_perfil?: string | null;
  operador?: string | null;
  estado?: string;
  archivado?: boolean;
  padron?: string;
  ubicacion?: string;
  estado_deuda?: string;
  notas?: string | null;
};

type InteractiveOption = {
  id?: string | number;
  title?: string;
  description?: string;
};

type InteractiveSection = {
  title?: string;
  rows?: InteractiveOption[];
};

type InteractiveButton = {
  id?: string | number;
  title?: string;
};

type InteractiveMessagePayload = {
  type?: string;
  header?: string;
  body?: string;
  buttonText?: string;
  sections?: InteractiveSection[];
  buttons?: InteractiveButton[];
};

type LegacyAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type OperatorConversationStatus =
  | 'BOT'
  | 'ESPERA_OPERADOR'
  | 'HUMANO'
  | 'ENCUESTA_POST_OPERADOR'
  | 'FOLLOWUP_POST_OPERADOR';

type OperatorHandoffTicket = {
  phone: string;
  ticketId?: string | number | null;
  subdelegacion?: string | null;
  subdelegacionId?: string | number | null;
  motivo?: string | null;
  requestedAt?: string | null;
};

type OperatorHandoffRequestedPayload = {
  telefono?: string;
  cliente_telefono?: string;
  ticket_id?: string | number;
  ticketId?: string | number;
  subdelegacion?: string;
  subdelegacion_id?: string | number;
  subdelegacionId?: string | number;
  motivo?: string;
  requested_at?: string;
  requestedAt?: string;
};

type OperatorHandoffAcceptedPayload = {
  telefono?: string;
  cliente_telefono?: string;
  ticket_id?: string | number;
  ticketId?: string | number;
  operador?: string;
  accepted_at?: string;
  acceptedAt?: string;
};

type OperatorHandoffCompletedPayload = {
  telefono?: string;
  cliente_telefono?: string;
  ticket_id?: string | number;
  ticketId?: string | number;
  operador?: string;
  completed_at?: string;
  completedAt?: string;
};

type BotModeChangedPayload = {
  telefono: string;
  bot_activo: boolean;
  estado_conversacion?: string;
  ticket_id?: string | number;
  subdelegacion_id?: string | number;
};

// Configurar Axios base
axios.defaults.baseURL = env.apiUrl;
axios.defaults.timeout = env.requestTimeoutMs;

// Configurar interceptores de axios (refresh automático + reintentos)
setupAxiosInterceptors(axios);

// Configurar conexión con backend
const socket: Socket = io(env.socketUrl, {
  transports: ['websocket', 'polling'],
  auth: (cb) => cb({ token: localStorage.getItem(env.tokenKey) || undefined }),
  reconnection: true,
  reconnectionDelay: env.socketReconnectDelayMs,
  reconnectionDelayMax: Math.max(env.socketReconnectDelayMs * 10, 10_000),
  reconnectionAttempts: env.socketReconnectAttempts,
  timeout: Math.max(env.requestTimeoutMs, 10_000),
  autoConnect: false
});

const refreshSocketAuth = () => {
  socket.auth = { token: localStorage.getItem(env.tokenKey) || undefined };
};

const isSocketAuthError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('unauthorized') ||
    message.includes('auth') ||
    message.includes('jwt') ||
    message.includes('token')
  );
};

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem(env.tokenKey);
  });

  // Theme color mapping
  const themeColors: Record<string, { primary: string; gradient: string; light: string; hex: string }> = {
    emerald: { primary: 'emerald-600', gradient: 'from-emerald-500 to-teal-500', light: 'emerald-50', hex: '#10b981' },
    blue: { primary: 'blue-600', gradient: 'from-blue-500 to-cyan-500', light: 'blue-50', hex: '#3b82f6' },
    violet: { primary: 'violet-600', gradient: 'from-violet-500 to-purple-500', light: 'violet-50', hex: '#7c3aed' },
    amber: { primary: 'amber-600', gradient: 'from-amber-500 to-orange-500', light: 'amber-50', hex: '#d97706' }
  };

  const {
    conversationsState,
    setConversationsState,
    selectedChat,
    setSelectedChat,
    allMessagesCache,
    setAllMessagesCache,
    messagesLoading,
    setMessagesLoading,
    messagesEndReached,
    setMessagesEndReached,
    currentMessageIndex,
    setCurrentMessageIndex,
    typingUsers,
    setTypingUsers,
    isLoadingMoreMessages,
    setIsLoadingMoreMessages,
    markConversationReadById,
    setConversationArchivedById,
    deleteConversationById: deleteConversationByIdFromStore,
    resetChatStore
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [theme, setTheme] = useState('emerald');
  const [backgroundPattern, setBackgroundPattern] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newConvName, setNewConvName] = useState('');
  const [newConvPhone, setNewConvPhone] = useState('');
  const [newConvMessage, setNewConvMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; message: string; onConfirm: () => void } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; type: 'chat' | 'message' | 'blank' | null; targetId?: number }>({ visible: false, x: 0, y: 0, type: null });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [chatClosed, setChatClosed] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});
  const [chatSearchMode, setChatSearchMode] = useState(false);
  const [chatSearchText, setChatSearchText] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);
  const [lightboxFile, setLightboxFile] = useState<{ url: string; filename: string } | null>(null);
  const [lightboxMessageId, setLightboxMessageId] = useState<number | null>(null);
  const [urlContextMenu, setUrlContextMenu] = useState<{ visible: boolean; x: number; y: number; url: string }>({ visible: false, x: 0, y: 0, url: '' });
  const [highlightedMessage, setHighlightedMessage] = useState<number | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [dragOverChat, setDragOverChat] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [infoPanelClosing, setInfoPanelClosing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; text: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: number; text: string } | null>(null);
  const [showForwardMenu, setShowForwardMenu] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set()); // Para controlar qué menús de opciones están expandidos
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState<Record<number, number>>({});
  const [showVolumeControl, setShowVolumeControl] = useState<number | null>(null);
  const [messagesLimit] = useState(20); // Mostrar solo 20 mensajes inicialmente
  const previousMessageCountRef = useRef<number>(0); // Para detectar si se agregó al final
  const previousLastMessageKeyRef = useRef<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const chatSearchRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const conversationsContainerRef = useRef<HTMLDivElement>(null);
  const reconnectFallbackTimerRef = useRef<number | null>(null);
  const authFailureCountRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const selectedConversationIdRef = useRef<number | null>(null);
  const prevSelectedChatRef = useRef<number | null>(null);
  const alertStateRef = useRef<{ lastAt: number; lastKind: string | null }>({
    lastAt: 0,
    lastKind: null
  });

  // Helpers para fechas de ejemplo
  const makeDate = (hours: number, minutes: number, daysOffset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const { currentChat, selectedId, selectChatById, closeSelectedChat } = useChatSelection({
    conversationsState,
    selectedChat,
    setSelectedChat
  });

  const {
    markChatReadById,
    deleteConversationById,
    archiveConversationById,
    unarchiveConversationById
  } = useChatMutations({
    setContextMenu,
    markConversationReadById,
    setConversationArchivedById,
    deleteConversationByIdFromStore
  });

  // Estado para gestionar reactivación de sesión 24h por chat
  const [reactivating, setReactivating] = useState<boolean>(false);
  const [reactivationSent, setReactivationSent] = useState<Record<string, boolean>>({});
  const [pendingOperatorTickets, setPendingOperatorTickets] = useState<OperatorHandoffTicket[]>([]);
  const [handoffActionLoading, setHandoffActionLoading] = useState<Record<string, 'accept' | 'complete' | undefined>>({});

  // Determinar si la sesión (24h) está vencida según el último mensaje del usuario (cliente)
  const sessionExpired = useMemo(() => {
    if (!currentChat) return false;

    // Priorizar última interacción real del usuario (DB)
    if (currentChat.lastUserInteraction) {
      const lastUser = new Date(currentChat.lastUserInteraction);
      const diffMs = Date.now() - lastUser.getTime();
      return diffMs > 24 * 60 * 60 * 1000; // > 24 horas
    }

    if (!currentChat.messages || currentChat.messages.length === 0) return false;
    // Buscar el último mensaje del usuario (en nuestro mapeo, usuario => sent === false)
    for (let i = currentChat.messages.length - 1; i >= 0; i--) {
      const m = currentChat.messages[i];
      if (m && m.sent === false) {
        const lastUser = new Date(m.date);
        const diffMs = Date.now() - lastUser.getTime();
        return diffMs > 24 * 60 * 60 * 1000; // > 24 horas
      }
    }
    return false;
  }, [currentChat?.lastUserInteraction, currentChat?.messages, selectedChat]);

  // Cerrar menús que no aplican si está expirada la sesión
  useEffect(() => {
    if (sessionExpired) {
      setShowAttachMenu(false);
      setShowEmojiPicker(false);
    }
  }, [sessionExpired]);

  // Enviar plantilla de reactivación (desbloquea conversación luego de respuesta del usuario)
  const handleSendReactivationTemplate = async () => {
    if (!currentChat?.phone) return;
    try {
      setReactivating(true);
      const token = localStorage.getItem(env.tokenKey);
      await axios.post(`/api/chats/${currentChat.phone}/reactivate`, {
        templateName: 'reactivacion_tramite',
        languageCode: 'es_AR'
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const templateText = getTemplateDisplayText('reactivacion_tramite');
      const now = new Date();
      setConversationsState(prev => {
        const updated = [...prev];
        const chatIndex = updated.findIndex(c => phonesMatch(c.phone, currentChat.phone));
        if (chatIndex !== -1) {
          const chat = updated[chatIndex];
          const newMessage = {
            id: `template_${Date.now()}`,
            text: templateText,
            time: formatTime(now),
            date: now.toISOString(),
            sent: true,
            read: true,
            type: 'text'
          };
          chat.messages = dedupeMessages([...(chat.messages || []), newMessage]).slice(-messagesLimit);
          chat.lastMessage = templateText;
          chat.lastMessageDate = now.toISOString();
          chat.time = formatTime(now);
        }
        return updated;
      });
      // Marcar como enviada para este chat
      setReactivationSent(prev => ({ ...prev, [currentChat.phone]: true }));
      // Plantilla de reactivación enviada
      toast.success('Plantilla de reactivación enviada');
    } catch (err) {
      console.error('❌ Error enviando plantilla de reactivación:', err);
      toast.error('No se pudo enviar la plantilla de reactivación');
    } finally {
      setReactivating(false);
    }
  };

  const getOperatorName = () => {
    const operador = auth.getOperador();
    if (!operador) return undefined;
    const candidate = [operador.nombre, operador.email].find((value) => typeof value === 'string' && value.trim().length > 0);
    return candidate?.trim();
  };

  const normalizeOperatorIdentity = (value?: string | null) => {
    return (value || '').trim().toLowerCase();
  };

  const currentOperatorName = getOperatorName() || 'Panel Frontend';

  const getChatLockInfo = (chat?: Conversation | null) => {
    if (!chat || !isHumanConversation(chat.conversationStatus)) {
      return {
        isLockedByAnotherOperator: false,
        lockedBy: null as string | null
      };
    }

    const assignedOperator = typeof chat.operator === 'string' ? chat.operator.trim() : '';
    if (!assignedOperator) {
      return {
        isLockedByAnotherOperator: false,
        lockedBy: null as string | null
      };
    }

    const mine = normalizeOperatorIdentity(currentOperatorName);
    const assigned = normalizeOperatorIdentity(assignedOperator);
    const isLockedByAnotherOperator = !mine || (assigned !== mine);

    return {
      isLockedByAnotherOperator,
      lockedBy: isLockedByAnotherOperator ? assignedOperator : null
    };
  };

  const upsertPendingTicket = (incoming: OperatorHandoffTicket) => {
    setPendingOperatorTickets((prev) => {
      const phoneKey = normalizePhoneKey(incoming.phone);
      const existingIndex = prev.findIndex((ticket) => {
        if (incoming.ticketId && ticket.ticketId) {
          return String(ticket.ticketId) === String(incoming.ticketId);
        }
        return normalizePhoneKey(ticket.phone) === phoneKey;
      });

      if (existingIndex === -1) {
        return [incoming, ...prev];
      }

      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...incoming };
      return next;
    });
  };

  const removePendingTicket = (params: { phone?: string; ticketId?: string | number | null }) => {
    setPendingOperatorTickets((prev) => {
      return prev.filter((ticket) => {
        const sameTicket = params.ticketId && ticket.ticketId
          ? String(params.ticketId) === String(ticket.ticketId)
          : false;
        const samePhone = params.phone ? phonesMatch(ticket.phone, params.phone) : false;
        return !(sameTicket || samePhone);
      });
    });
  };

  const acceptOperatorChat = async (phone: string) => {
    if (!phone) return;
    const chat = conversationsState.find((item) => phonesMatch(item.phone, phone));
    const lockInfo = getChatLockInfo(chat || null);
    if (lockInfo.isLockedByAnotherOperator) {
      toast.warning('Chat bloqueado por otro operador', {
        description: `Actualmente lo atiende ${lockInfo.lockedBy}.`
      });
      return;
    }

    const phoneKey = normalizePhoneKey(phone);
    setHandoffActionLoading((prev) => ({ ...prev, [phoneKey]: 'accept' }));

    try {
      const token = localStorage.getItem(env.tokenKey);
      const operador = getOperatorName();
      const response = await axios.post(
        `/api/tickets/${encodeURIComponent(phone)}/accept`,
        operador ? { operador } : {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      const payload = response.data || {};
      const ticketPayload = payload.ticket || {};
      const ticketId =
        payload.ticket_id ||
        payload.ticketId ||
        ticketPayload.ticket_id ||
        ticketPayload.ticketId ||
        ticketPayload.id ||
        null;
      const status = normalizeConversationStatus(payload.estado_conversacion) || 'HUMANO';
      let takenChatId: number | null = null;

      setConversationsState((prev) => {
        const idx = prev.findIndex((chat) => phonesMatch(chat.phone, phone));
        if (idx === -1) return prev;
        const next = [...prev];
        takenChatId = next[idx].id;
        next[idx] = {
          ...next[idx],
          operator: payload.operador || ticketPayload.operador || next[idx].operator || operador || null,
          ticketId,
          botActive: payload.bot_activo === undefined ? false : Boolean(payload.bot_activo),
          conversationStatus: status
        };
        return next;
      });

      removePendingTicket({ phone, ticketId });

      if (takenChatId !== null) {
        selectChatById(takenChatId);
      }

      toast.success('Chat tomado por operador', {
        description: `Se activó la atención humana para ${phone}.`
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if ((status === 409 || status === 423) && axios.isAxiosError(error)) {
        const payload = (error.response?.data || {}) as Record<string, unknown>;
        const ticketPayload = (payload.ticket || {}) as Record<string, unknown>;
        const conflictOperator =
          (typeof payload.operador === 'string' && payload.operador) ||
          (typeof ticketPayload.operador === 'string' && ticketPayload.operador) ||
          'otro operador';
        const ticketId =
          (payload.ticket_id as string | number | undefined) ||
          (payload.ticketId as string | number | undefined) ||
          (ticketPayload.ticket_id as string | number | undefined) ||
          (ticketPayload.ticketId as string | number | undefined) ||
          null;
        const statusFromConflict = normalizeConversationStatus(
          typeof payload.estado_conversacion === 'string' ? payload.estado_conversacion : undefined
        ) || 'HUMANO';

        setConversationsState((prev) => prev.map((item) => {
          if (!phonesMatch(item.phone, phone)) return item;
          return {
            ...item,
            operator: conflictOperator,
            ticketId: ticketId || item.ticketId || null,
            conversationStatus: statusFromConflict,
            botActive: false
          };
        }));
        removePendingTicket({ phone, ticketId });

        toast.warning('Otro operador tomó este chat', {
          description: `Asignado a ${conflictOperator}. Se abrió en modo solo lectura.`
        });
        return;
      }

      console.error('Error aceptando ticket de operador:', error);
      toast.error('No se pudo tomar el chat', {
        description: 'Reintenta en unos segundos.'
      });
    } finally {
      setHandoffActionLoading((prev) => ({ ...prev, [phoneKey]: undefined }));
    }
  };

  const completeOperatorChat = async (phone: string) => {
    if (!phone) return;
    const chat = conversationsState.find((item) => phonesMatch(item.phone, phone));
    const lockInfo = getChatLockInfo(chat || null);
    if (lockInfo.isLockedByAnotherOperator) {
      toast.warning('No puedes finalizar este chat', {
        description: `Está siendo atendido por ${lockInfo.lockedBy}.`
      });
      return;
    }

    const phoneKey = normalizePhoneKey(phone);
    setHandoffActionLoading((prev) => ({ ...prev, [phoneKey]: 'complete' }));

    try {
      const token = localStorage.getItem(env.tokenKey);
      const operador = getOperatorName();
      const response = await axios.post(
        `/api/tickets/${encodeURIComponent(phone)}/complete`,
        operador ? { operador } : {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      const payload = response.data || {};
      const ticketPayload = payload.ticket || {};
      const ticketId =
        payload.ticket_id ||
        payload.ticketId ||
        ticketPayload.ticket_id ||
        ticketPayload.ticketId ||
        ticketPayload.id ||
        null;
      const status = normalizeConversationStatus(payload.estado_conversacion) || 'ENCUESTA_POST_OPERADOR';

      setConversationsState((prev) => {
        const idx = prev.findIndex((chat) => phonesMatch(chat.phone, phone));
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ticketId,
          botActive: payload.bot_activo === undefined ? true : Boolean(payload.bot_activo),
          conversationStatus: status
        };
        return next;
      });

      removePendingTicket({ phone, ticketId });

      toast.success('Conversación finalizada', {
        description: 'El backend continuará con encuesta y seguimiento automático.'
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if ((status === 409 || status === 423) && axios.isAxiosError(error)) {
        const payload = (error.response?.data || {}) as Record<string, unknown>;
        const conflictOperator = typeof payload.operador === 'string' ? payload.operador : null;
        const statusFromConflict = normalizeConversationStatus(
          typeof payload.estado_conversacion === 'string' ? payload.estado_conversacion : undefined
        );

        setConversationsState((prev) => prev.map((item) => {
          if (!phonesMatch(item.phone, phone)) return item;
          return {
            ...item,
            ...(conflictOperator ? { operator: conflictOperator } : {}),
            ...(statusFromConflict ? { conversationStatus: statusFromConflict } : {})
          };
        }));

        toast.warning('Acción bloqueada por concurrencia', {
          description: conflictOperator
            ? `El chat ahora lo atiende ${conflictOperator}.`
            : 'El estado del chat cambió en otro panel.'
        });
        return;
      }

      console.error('Error finalizando ticket de operador:', error);
      toast.error('No se pudo finalizar la conversación', {
        description: 'Reintenta en unos segundos.'
      });
    } finally {
      setHandoffActionLoading((prev) => ({ ...prev, [phoneKey]: undefined }));
    }
  };

  // Funciones auxiliares para formateo (definidas ANTES de los useEffect)
  const formatTime = (date: Date | string | number): string => {
    return formatMessageTime(date);
  };
  
  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Función para normalizar mensajes (convertir JSON a string)
  const normalizeMessage = (msg: unknown): string => {
    if (typeof msg === 'string') return msg;
    if (typeof msg === 'object' && msg !== null) {
      return msg.cuerpo || msg.text || msg.contenido || msg.body || JSON.stringify(msg).substring(0, 50) || '[Mensaje sin contenido]';
    }
    return String(msg || '[Mensaje sin contenido]');
  };

const getContactStatus = (lastMessageDate: string | Date) => {
  const now = new Date();
  const lastMsg = new Date(lastMessageDate);
  const diffMinutes = Math.floor((now.getTime() - lastMsg.getTime()) / (1000 * 60));
  
  if (diffMinutes < 5) {
    return { color: 'bg-green-500', label: 'En línea', code: 'online' };
  } else if (diffMinutes < 1440) { // 24 horas = 1440 minutos
    return { color: 'bg-amber-400', label: 'Ausente', code: 'away' };
  } else {
    return { color: 'bg-gray-400', label: 'Sesión Vencida', code: 'expired' };
  }
};

const getRelativeTime = (lastMessageDate: string | Date) => {
  const now = new Date();
  const lastMsg = new Date(lastMessageDate);
  const diffMinutes = Math.floor((now.getTime() - lastMsg.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) return 'hace un momento';
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
};

const getMediaUrl = (mediaId: string | null | undefined): string => {
  if (!mediaId) return '';
  return `${env.apiUrl}/api/media/${mediaId}`;
};

const detectAndRenderUrls = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <span key={i}>
          <a 
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
        </span>
      );
    }
    return part;
  });
};

const normalizeSenderType = (value?: string) => (value || '').trim().toLowerCase();
const isUserSender = (value?: string) => {
  const v = normalizeSenderType(value);
  return [
    'usuario',
    'cliente',
    'user',
    'customer',
    'contacto',
    'contact',
    'incoming',
    'inbound',
    'received',
    'recibido',
    'from_user',
    'fromuser',
    'wa_in'
  ].includes(v);
};

const normalizePhoneKey = (value?: string) => (value || '').replace(/\D/g, '');

const phonesMatch = (a?: string, b?: string) => {
  const na = normalizePhoneKey(a);
  const nb = normalizePhoneKey(b);
  return !!na && !!nb && na === nb;
};

const normalizeConversationStatus = (value?: string | null): OperatorConversationStatus | null => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'BOT') return 'BOT';
  if (normalized === 'ESPERA_OPERADOR') return 'ESPERA_OPERADOR';
  if (normalized === 'HUMANO') return 'HUMANO';
  if (normalized === 'ENCUESTA_POST_OPERADOR') return 'ENCUESTA_POST_OPERADOR';
  if (normalized === 'FOLLOWUP_POST_OPERADOR') return 'FOLLOWUP_POST_OPERADOR';
  return null;
};

const isWaitingOperator = (status?: string | null) => normalizeConversationStatus(status) === 'ESPERA_OPERADOR';
const isHumanConversation = (status?: string | null) => normalizeConversationStatus(status) === 'HUMANO';

const getStatusBadgeMeta = (status?: string | null, botActive?: boolean | null) => {
  const normalized = normalizeConversationStatus(status);

  if (normalized === 'ESPERA_OPERADOR') {
    return {
      label: 'Espera operador',
      classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
    };
  }

  if (normalized === 'HUMANO') {
    return {
      label: 'Atención humana',
      classes: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200'
    };
  }

  if (normalized === 'ENCUESTA_POST_OPERADOR') {
    return {
      label: 'Encuesta post chat',
      classes: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200'
    };
  }

  if (normalized === 'FOLLOWUP_POST_OPERADOR') {
    return {
      label: 'Follow-up',
      classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
    };
  }

  if (normalized === 'BOT' || botActive === true) {
    return {
      label: 'Bot activo',
      classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
    };
  }

  return null;
};

const FILE_URL_REGEX = /(https?:\/\/[^\s"']+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt|zip|rar|7z|jpg|jpeg|png|gif|webp|mp3|wav|ogg|mp4|mov|avi|mkv))(?:\?[^\s"']*)?/i;

const extractFileUrlFromText = (text?: string) => {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(FILE_URL_REGEX);
  return match ? match[0] : null;
};

const deriveFilenameFromUrl = (url?: string) => {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').pop() || '';
    return segment ? decodeURIComponent(segment) : null;
  } catch {
    const segment = url.split('?')[0].split('/').pop() || '';
    return segment ? decodeURIComponent(segment) : null;
  }
};

const normalizeMessageType = (
  rawType: unknown,
  normalizedType: string,
  options?: { fileUrl?: string | null; filename?: string | null; text?: string }
) => {
  const raw = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
  const normalized = (normalizedType || '').trim().toLowerCase();

  const explicitType = raw === 'interactive_list' || raw === 'interactive_buttons'
    ? 'interactive'
    : (raw || normalized || 'text');

  const inferredFileUrl = options?.fileUrl || extractFileUrlFromText(options?.text);
  const hasAttachment = !!inferredFileUrl || !!options?.filename;

  if (hasAttachment) {
    if (['image', 'video', 'audio', 'file', 'interactive'].includes(explicitType)) {
      return explicitType;
    }
    return 'file';
  }

  return explicitType;
};

const parseMessageDate = (value: unknown) => {
  return parseTimestamp(value).toDate();
};

// Formatear texto con estilos de WhatsApp: *negrita*, _cursiva_, ~tachado~, ```monospace```
const formatWhatsAppText = (text: string): string => {
  if (!text || typeof text !== 'string') return text;
  
  let formatted = text;
  
  // *negrita* → <strong>negrita</strong>
  formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  
  // _cursiva_ → <em>cursiva</em>
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // ~tachado~ → <del>tachado</del>
  formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');
  
  // ```monospace``` → <code>monospace</code>
  formatted = formatted.replace(/```([^`]+)```/g, '<code class="bg-black/10 dark:bg-white/10 px-1 rounded">$1</code>');
  
  return formatted;
};

const formatFileSize = (size?: number | null) => {
  if (!size || size <= 0) return 'Tamaño desconocido';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const getFileExtension = (filename?: string | null) => {
  if (!filename) return 'FILE';
  const ext = filename.split('.').pop()?.trim();
  return ext ? ext.toUpperCase() : 'FILE';
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const buildStableMessageId = (params: {
  phone?: string;
  timestamp?: string | Date;
  emisor?: string;
  text?: string;
  type?: string;
}) => {
  const ts = params.timestamp ? new Date(params.timestamp).toISOString() : '';
  const key = [params.phone || '', params.emisor || '', params.type || '', ts, params.text || ''].join('|');
  return `sock_${hashString(key)}`;
};

// Dedupe helper to avoid duplicated IDs in UI
const dedupeMessages = (msgs: ChatMessage[]) => {
  return sortAndDedupeMessages(msgs || []);
};

const parseConversationNotes = (rawNotes: string | null | undefined): Array<{ id: number; text: string }> => {
  if (!rawNotes || typeof rawNotes !== 'string') return [];
  try {
    const parsed = JSON.parse(rawNotes);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((note) => typeof note === 'object' && note !== null)
      .map((note) => {
        const candidate = note as { id?: unknown; text?: unknown };
        return {
          id: Number(candidate.id) || Date.now(),
          text: typeof candidate.text === 'string' ? candidate.text : ''
        };
      })
      .filter((note) => note.text.trim().length > 0);
  } catch {
    return [];
  }
};

// Función para reproducir sonido de notificación
const playNotificationSound = () => {
  // Sonido beep simple usando Web Audio API
  try {
    const AudioContextCtor = window.AudioContext || (window as LegacyAudioWindow).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Frecuencia en Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('No se pudo reproducir sonido:', e);
  }
};

// Función para mostrar notificación
const showNotification = (title: string, options: NotificationOptions = {}) => {
  if (!('Notification' in window)) {
    console.log('Este navegador no soporta notificaciones');
    return;
  }

  if (Notification.permission === 'granted') {
    // Reproducir sonido
    playNotificationSound();
    
    // Mostrar notificación
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: {
          ...options,
          icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💧</text></svg>',
          badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💧</text></svg>',
          tag: 'irrigacion-notification'
        }
      });
    } else {
      new Notification(title, options);
    }
  }
};

// Función para solicitar permisos de notificación
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

const dedupeDisplayMessages = (msgs: ChatMessage[]) => {
  return sortAndDedupeMessages(msgs || []);
};

  const emitConnectionAlert = (params: {
    kind: 'warning' | 'error' | 'success';
    title: string;
    description?: string;
  }) => {
    const now = Date.now();
    const cooldownMs = 15_000;
    const last = alertStateRef.current;
    const sameKind = last.lastKind === params.kind;

    if (sameKind && now - last.lastAt < cooldownMs) {
      return;
    }

    alertStateRef.current = { lastAt: now, lastKind: params.kind };

    if (params.kind === 'error') {
      toast.error(params.title, { description: params.description });
      return;
    }

    if (params.kind === 'success') {
      toast.success(params.title, { description: params.description });
      return;
    }

    toast.warning(params.title, { description: params.description });
  };

  // Auth handlers
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    trackAction('login_success');
    requestNotificationPermission().then(granted => {
      if (granted) {
        console.log('✅ Notificaciones push habilitadas');
      }
    });
  };

  const handleLogout = async () => {
    trackAction('logout');
    try {
      // Intentar logout en el backend (no bloquea si falla)
      await axios.post('/api/auth/logout').catch(err => {
        if (env.enableLogging) {
          console.warn('⚠️ Logout en backend falló:', err.message);
        }
      });
    } catch (err) {
      if (env.enableLogging) {
        console.warn('⚠️ Error durante logout:', err);
      }
    }
    
    // Limpiar tokens y datos locales
    auth.clearSession();
    
    // Limpiar estado de conversaciones
    resetChatStore();
    setMessage('');
    
    // Cerrar todos los menus y modales abiertos
    setShowMenu(false);
    setShowInfo(false);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    setShowSidebarMenu(false);
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
    
    // Desconectar y reconectar socket sin autenticación
    socket.disconnect();
    
    // Actualizar estado de autenticación
    setIsAuthenticated(false);
  };

  // ⚡ useEffect para cargar chats desde el backend
  useEffect(() => {
    const clearReconnectFallback = () => {
      if (reconnectFallbackTimerRef.current !== null) {
        window.clearTimeout(reconnectFallbackTimerRef.current);
        reconnectFallbackTimerRef.current = null;
      }
    };

    const scheduleReconnectFallback = () => {
      if (!isAuthenticated || reconnectFallbackTimerRef.current !== null) return;

      const delay = Math.min(
        env.socketReconnectDelayMs * Math.max(1, authFailureCountRef.current + 1),
        30_000
      );

      reconnectFallbackTimerRef.current = window.setTimeout(() => {
        reconnectFallbackTimerRef.current = null;
        if (!isAuthenticated || socket.connected || !navigator.onLine) return;

        refreshSocketAuth();
        socket.connect();
      }, delay);

      trackSocketEvent('reconnect_fallback_scheduled', { delay_ms: delay });
    };

    // Conectar/desconectar socket y cargar datos solo autenticado
    if (!isAuthenticated) {
      clearReconnectFallback();
      authFailureCountRef.current = 0;
      if (socket.connected) {
        socket.disconnect();
      }
      return;
    }

    const token = localStorage.getItem(env.tokenKey);
    refreshSocketAuth();

    if (!socket.connected) {
      socket.connect();
    }

    const handleSocketConnect = () => {
      const recoveredAfterAttempts = reconnectAttemptRef.current;
      authFailureCountRef.current = 0;
      reconnectAttemptRef.current = 0;
      clearReconnectFallback();
      trackSocketEvent('connect', {
        recovered_after_attempts: recoveredAfterAttempts,
        socket_id: socket.id,
        transport: socket.io.engine.transport.name
      });

      if (recoveredAfterAttempts > 0) {
        emitConnectionAlert({
          kind: 'success',
          title: 'Conexión restablecida',
          description: 'La mensajería en tiempo real volvió a estar disponible.'
        });
      }
    };

    const handleSocketDisconnect = (reason: Socket.DisconnectReason) => {
      trackSocketEvent('disconnect', { reason });
      if (!isAuthenticated) return;

      if (reason === 'io client disconnect') {
        return;
      }

      if (reason === 'io server disconnect') {
        trackErrorRecovery('socket_server_disconnect', 'manual_reconnect');
        refreshSocketAuth();
        socket.connect();
        return;
      }

      emitConnectionAlert({
        kind: 'warning',
        title: 'Conexión inestable',
        description: 'Intentando reconectar al servidor de mensajes...'
      });

      scheduleReconnectFallback();
    };

    const handleSocketConnectError = (error: Error) => {
      const authError = isSocketAuthError(error);
      trackSocketEvent('connect_error', {
        message: error.message,
        is_auth_error: authError,
        auth_failure_count: authFailureCountRef.current
      });

      if (isSocketAuthError(error)) {
        authFailureCountRef.current += 1;

        if (!localStorage.getItem(env.tokenKey) || authFailureCountRef.current >= 2) {
          handleLogout();
          return;
        }

        refreshSocketAuth();
      }

      emitConnectionAlert({
        kind: 'warning',
        title: 'Problema de conexión',
        description: 'No se pudo conectar con el socket. Reintentando automáticamente.'
      });

      scheduleReconnectFallback();
    };

    const handleReconnectAttempt = () => {
      reconnectAttemptRef.current += 1;
      trackSocketEvent('reconnect_attempt', {
        attempt: reconnectAttemptRef.current
      });
      refreshSocketAuth();
    };

    const handleReconnectFailed = () => {
      trackSocketEvent('reconnect_failed', {
        attempts: reconnectAttemptRef.current
      });
      emitConnectionAlert({
        kind: 'error',
        title: 'No se pudo reconectar',
        description: 'La conexión en tiempo real quedó interrumpida. Reintentaremos en segundo plano.'
      });
      scheduleReconnectFallback();
    };

    const handleOnline = () => {
      trackAction('network_online');
      if (!isAuthenticated || socket.connected) return;
      refreshSocketAuth();
      socket.connect();
    };

    const handleOffline = () => {
      trackAction('network_offline');
      emitConnectionAlert({
        kind: 'warning',
        title: 'Sin conexión a internet',
        description: 'El panel seguirá intentando reconectar cuando vuelva la red.'
      });
      clearReconnectFallback();
    };

    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('connect_error', handleSocketConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect_failed', handleReconnectFailed);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const loadChats = async () => {
      try {
        if (!token) {
          handleLogout();
          return;
        }
        const response = await axios.get('/api/chats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // El backend devuelve { success: true, data: [...], total: N }
        const chats = Array.isArray(response.data) ? response.data : (response.data.data || response.data.chats || []);
        
        // Mapear los datos del backend a la estructura esperada por la UI
        const mappedChats: Conversation[] = chats.map((chat: RawChatSummary, chatIndex: number) => {
          const rawLastMessage = chat.ultimo_mensaje?.cuerpo ?? chat.ultimo_mensaje ?? '';
          const normalizedLast = normalizeMessageContent(rawLastMessage);
          const lastDateRaw = chat.ultimo_mensaje_fecha || chat.ultimo_mensaje?.created_at || chat.ultimo_mensaje?.fecha || null;
          const lastDate = lastDateRaw ? parseMessageDate(lastDateRaw) : new Date();
          const numericChatId = Number(chat.id);
          const fallbackId = Number.parseInt(
            hashString(`${chat.telefono || ''}|${chat.nombre_whatsapp || ''}|${chatIndex}`),
            36
          );
          const resolvedChatId = Number.isFinite(numericChatId) && numericChatId > 0
            ? numericChatId
            : (Number.isFinite(fallbackId) && fallbackId > 0 ? fallbackId : chatIndex + 1);
          
          return {
            id: resolvedChatId,
            name: chat.nombre_whatsapp || chat.nombre_asignado || chat.telefono,
            phone: chat.telefono,
            lastMessage: normalizedLast.preview,
            lastMessageDate: lastDate.toISOString(),
            lastUserInteraction: chat.ultima_interaccion || null,
            time: lastDateRaw ? formatTime(lastDate) : '',
            unread: chat.mensajes_no_leidos || 0,
            avatar: getInitials(chat.nombre_whatsapp || chat.nombre_asignado || chat.telefono),
            profilePic: chat.foto_perfil || null,
            operator: chat.operador || null,
            conversationStatus: chat.estado || 'unattended',
            archived: chat.archivado || false,
            padron: {
              number: chat.padron || '',
              location: chat.ubicacion || '',
              debtStatus: chat.estado_deuda || ''
            },
            notes: parseConversationNotes(chat.notas),
            messages: [] // Los mensajes se cargan al seleccionar el chat
          };
        });
        
        setConversationsState(mappedChats);
        trackAction('chats_loaded', { count: mappedChats.length });
      } catch (error: unknown) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        trackAction('chats_load_failed', { status: status || 0 });
        // Si el token es inválido/expirado, forzar logout para reautenticar
        if (status === 401 || status === 403) {
          handleLogout();
        }
      }
    };

    const loadPendingTickets = async () => {
      try {
        const response = await axios.get('/api/tickets', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const tickets = Array.isArray(response.data)
          ? response.data
          : (response.data?.data || response.data?.tickets || []);

        const mappedTickets: OperatorHandoffTicket[] = tickets
          .map((ticket: Record<string, unknown>) => ({
            phone: String(ticket.telefono || ticket.phone || ticket.cliente_telefono || ''),
            ticketId: (ticket.ticket_id || ticket.ticketId || ticket.id || null) as string | number | null,
            subdelegacion: typeof ticket.subdelegacion === 'string' ? ticket.subdelegacion : null,
            subdelegacionId: (ticket.subdelegacion_id || ticket.subdelegacionId || null) as string | number | null,
            motivo: typeof ticket.motivo === 'string' ? ticket.motivo : null,
            requestedAt: typeof ticket.requested_at === 'string'
              ? ticket.requested_at
              : (typeof ticket.requestedAt === 'string' ? ticket.requestedAt : null)
          }))
          .filter((ticket: OperatorHandoffTicket) => ticket.phone);

        setPendingOperatorTickets(mappedTickets);
        const pendingPhoneKeys = new Set(mappedTickets.map((ticket) => normalizePhoneKey(ticket.phone)));

        setConversationsState((prev) => prev.map((chat) => {
          const pendingTicket = mappedTickets.find((item) => phonesMatch(item.phone, chat.phone));
          if (pendingTicket) {
            return {
              ...chat,
              ticketId: pendingTicket.ticketId || chat.ticketId || null,
              subdelegacion: pendingTicket.subdelegacion || chat.subdelegacion || null,
              subdelegacionId: pendingTicket.subdelegacionId || chat.subdelegacionId || null,
              handoffReason: pendingTicket.motivo || chat.handoffReason || null,
              handoffRequestedAt: pendingTicket.requestedAt || chat.handoffRequestedAt || null,
              conversationStatus: 'ESPERA_OPERADOR',
              botActive: false
            };
          }

          if (normalizeConversationStatus(chat.conversationStatus) === 'ESPERA_OPERADOR' && !pendingPhoneKeys.has(normalizePhoneKey(chat.phone))) {
            return {
              ...chat,
              conversationStatus: 'BOT',
              botActive: true
            };
          }

          return chat;
        }));
      } catch (error: unknown) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 403) {
          // Si no hay permisos para listar, mantenemos sincronización solo por eventos socket.
          return;
        }
        console.error('Error cargando tickets pendientes:', error);
      }
    };
    
    loadChats();
    loadPendingTickets();

    const pendingTicketsInterval = window.setInterval(() => {
      loadPendingTickets();
    }, 20_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadPendingTickets();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Escuchar mensajes en tiempo real
    const normalizeSocketPayload = (payload: unknown): RawSocketMessage | null => {
      if (!payload || typeof payload !== 'object') {
        console.warn('⚠️ Socket payload inválido (no es objeto):', payload);
        return null;
      }

      const raw = payload as Record<string, unknown>;

      // Backend variants: direct message, wrapped in `message`, or wrapped in `data`.
      const candidate =
        (raw.message && typeof raw.message === 'object' ? raw.message : null) ||
        (raw.data && typeof raw.data === 'object' ? raw.data : null) ||
        raw;

      const normalized = candidate as RawSocketMessage;
      const phone = normalized.telefono || normalized.cliente_telefono;
      const nestedPayload =
        normalized.mensaje && typeof normalized.mensaje === 'object'
          ? (normalized.mensaje as Record<string, unknown>)
          : null;
      const nestedFileUrl = nestedPayload && typeof nestedPayload.url_archivo === 'string'
        ? nestedPayload.url_archivo
        : (nestedPayload && typeof nestedPayload.url === 'string' ? nestedPayload.url : undefined);
      const hasMessageBody =
        normalized.mensaje !== undefined ||
        normalized.cuerpo !== undefined ||
        normalized.url_archivo !== undefined ||
        nestedFileUrl !== undefined;

      if (!phone || !hasMessageBody) {
        console.warn('⚠️ Socket payload sin phone o mensaje:', {
          tiene_phone: !!phone,
          tiene_mensaje: hasMessageBody,
          keys: Object.keys(raw)
        });
        return null;
      }

      return normalized;
    };

    const handleNewMessage = (payload: unknown) => {
      const data = normalizeSocketPayload(payload);
      if (!data) return;

      // 🔍 DEBUG: Log del mensaje entrante para ver estructura real
      console.log('🔍 DEBUG - Mensaje recibido del socket:', {
        raw_data: data,
        emisor: data.emisor,
        tipo: data.tipo,
        telefono: data.telefono || data.cliente_telefono,
        mensaje: data.mensaje,
        cuerpo: data.cuerpo,
        timestamp: data.timestamp || data.created_at || data.createdAt || data.fecha,
        tiene_archivo: !!data.url_archivo,
        nombre_archivo: data.archivo_nombre
      });
      
      // Normalizar datos del socket: mapear campos de BD a campos esperados
      // IMPORTANTE: Asegurar que 'mensaje' siempre sea un string, no un objeto
      const rawMessageContent =
        data.cuerpo ??
        (data.mensaje && typeof data.mensaje === 'object'
          ? (data.mensaje.cuerpo || data.mensaje.text || data.mensaje.contenido || data.mensaje.body || data.mensaje)
          : data.mensaje) ??
        '';
      const nestedPayload =
        data.mensaje && typeof data.mensaje === 'object'
          ? (data.mensaje as Record<string, unknown>)
          : null;
      const nestedFileUrl = nestedPayload
        ? ((typeof nestedPayload.url_archivo === 'string' && nestedPayload.url_archivo) ||
           (typeof nestedPayload.url === 'string' && nestedPayload.url) ||
           (typeof nestedPayload.fileUrl === 'string' && nestedPayload.fileUrl) ||
           (typeof nestedPayload.media_url === 'string' && nestedPayload.media_url) ||
           null)
        : null;
      const nestedFilename = nestedPayload
        ? ((typeof nestedPayload.archivo_nombre === 'string' && nestedPayload.archivo_nombre) ||
           (typeof nestedPayload.filename === 'string' && nestedPayload.filename) ||
           (typeof nestedPayload.name === 'string' && nestedPayload.name) ||
           null)
        : null;
      const normalizedContent = normalizeMessageContent(rawMessageContent);
      const messageText = normalizedContent.text;
      const messagePreview = normalizedContent.preview;
      const resolvedFileUrl = data.url_archivo || nestedFileUrl || extractFileUrlFromText(messageText);
      const resolvedFilename = data.archivo_nombre || nestedFilename || deriveFilenameFromUrl(resolvedFileUrl || undefined);
      const resolvedDisplayText =
        messageText ||
        messagePreview ||
        (resolvedFileUrl ? '📎 Archivo adjunto' : '[Mensaje sin contenido]');
      const messageType = normalizeMessageType(data.tipo, normalizedContent.type, {
        fileUrl: resolvedFileUrl,
        filename: resolvedFilename,
        text: messageText
      });
      
      // Normalizar nombre: si es objeto JSON, convertir a string
      let nombre = data.nombre || '';
      if (typeof nombre === 'object') {
        nombre = JSON.stringify(nombre);
      }
      
      const rawTimestamp = data.timestamp || data.created_at || data.createdAt || data.fecha;
      const fallbackTimestamp = new Date().toISOString();
      const timestampForId = rawTimestamp || fallbackTimestamp;
      const hasBackendId = data.id !== undefined && data.id !== null && data.id !== '';
      const stableId = data.id || buildStableMessageId({
        phone: data.telefono || data.cliente_telefono,
        timestamp: timestampForId,
        emisor: data.emisor || data.tipo,
        text: messageText,
        type: messageType
      });
      // Cuando backend no manda ID persistente, generar un ID único local para evitar
      // colisiones que oculten mensajes nuevos en el panel principal.
      const generatedId = `sock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const finalId = hasBackendId ? (data.id as string | number) : generatedId;
      const newMsg = {
        id: finalId,
        telefono: data.telefono || data.cliente_telefono,
        mensaje: resolvedDisplayText,
        tipo: messageType,
        emisor: data.emisor,
        timestamp: rawTimestamp || fallbackTimestamp,
        url_archivo: resolvedFileUrl,
        archivo_nombre: resolvedFilename,
        archivo_tamanio: data.archivo_tamanio,
        duracion: data.duracion,
        cuerpo: data.cuerpo,
        nombre: nombre  // Siempre un string normalizado
      };
      
      setConversationsState(prev => {
        const existingChatIndex = prev.findIndex(c => phonesMatch(c.phone, newMsg.telefono));
        
        if (existingChatIndex !== -1) {
          // Invalidar caché para este chat
          const cacheKey = `messages_${newMsg.telefono}`;
          localStorage.removeItem(cacheKey);
          
          // Actualizar conversación existente
          const updated = [...prev];
          const chat = updated[existingChatIndex];
          const msgTimestamp = parseMessageDate(newMsg.timestamp);
          
          // Agregar mensaje al array de mensajes si ya están cargados (al FINAL por orden ASC)
          if (chat.messages && Array.isArray(chat.messages)) {
            // newMsg.mensaje ya está normalizado a string en handleNewMessage
            const incomingText = newMsg.mensaje;
            const incomingTextKey = typeof incomingText === 'string' ? incomingText.trim() : JSON.stringify(incomingText ?? '');
            const incomingBucket = Math.floor(msgTimestamp.getTime() / 1000);
            const incomingSent = !isUserSender(newMsg.emisor || newMsg.tipo);
            const emisorLimpio = normalizeSenderType(newMsg.emisor || newMsg.tipo);
            const isOutgoingFromPanelOperator = ['operador', 'operadora', 'agent', 'agente'].includes(emisorLimpio);
            const matchedTempId = isOutgoingFromPanelOperator
              ? consumePendingByMatch({
                  phone: newMsg.telefono,
                  text: incomingText,
                  timestamp: msgTimestamp.toISOString()
                })
              : null;
            
            // 🔍 DEBUG: Log del sender detection
            console.log('🔍 DEBUG - Detección de emisor:', {
              emisor: newMsg.emisor,
              tipo: newMsg.tipo,
              isUserSender_result: isUserSender(newMsg.emisor || newMsg.tipo),
              incomingSent: incomingSent,
              expected: 'sent=true significa operador (verde), sent=false significa usuario (blanco)'
            });
            
            // ✅ DEDUPLICACIÓN CONTENT-BASED:
            // Verificar si el mensaje ya existe usando CONTENIDO como clave, no solo ID.
            // Esto previene duplicados cuando el backend envía IDs en milisegundos cercanos.
            // Clave: phone + emisor + tipo + timestamp_segundo + texto normalizado
            const msgTimestampDate = parseMessageDate(newMsg.timestamp);
            const msgTimestampSecond = Math.floor(msgTimestampDate.getTime() / 1000); // Tiempo en segundos, no milisegundos
            const normalizedMsgText = (newMsg.mensaje || '').trim().toLowerCase();
            
            const contentSignature = `${newMsg.telefono}|${normalizeSenderType(newMsg.emisor || newMsg.tipo)}|${newMsg.tipo}|${msgTimestampSecond}|${normalizedMsgText}`;
            
            // Buscar en mensajes actuales
            const existsInVisible = chat.messages.some((m: ChatMessage) => {
              const visibleTimestampSecond = Math.floor(new Date(m.date || 0).getTime() / 1000);
              const normalizedVisibleText = (m.text || '').trim().toLowerCase();
              const visibleSignature = `${chat.phone}|${normalizeSenderType(m.sent ? 'operador' : 'usuario')}|${m.type}|${visibleTimestampSecond}|${normalizedVisibleText}`;
              return visibleSignature === contentSignature;
            });
            
            // Buscar en caché de memoria (en caso de que ya esté fuera de la ventana visible)
            const phoneKey = normalizePhoneKey(newMsg.telefono);
            const phoneCache = allMessagesCache[phoneKey] || [];
            const existsInCache = phoneCache.some((m: ChatMessage) => {
              const cacheTimestampSecond = Math.floor(new Date(m.date || 0).getTime() / 1000);
              const normalizedCacheText = (m.text || '').trim().toLowerCase();
              const cacheSignature = `${newMsg.telefono}|${normalizeSenderType(m.sent ? 'operador' : 'usuario')}|${m.type}|${cacheTimestampSecond}|${normalizedCacheText}`;
              return cacheSignature === contentSignature;
            });
            
            const messageExists = existsInVisible || existsInCache;
            
            console.log('🔍 DEBUG - Check duplicado:', {
              messageExists,
              contentSignature,
              existsInVisible,
              existsInCache,
              newMsgId: newMsg.id,
              newMsgText: newMsg.mensaje,
              currentMessagesCount: chat.messages.length,
              cacheSize: phoneCache.length
            });
            
            if (!messageExists) {
              
              // Si es un mensaje del operador, buscar si ya existe como optimistic update
              // y NO reemplazarlo, para mantener el timestamp original
              const isOperatorMessage = ['operador', 'operadora', 'agent', 'agente', 'bot'].includes(emisorLimpio);
              const existingOptimisticMsg = isOperatorMessage 
                ? chat.messages.find((m: ChatMessage) => {
                    const isTempId = typeof m.id === 'string' && m.id.startsWith('temp_');
                    const isSending = m.status === 'sending';
                    const canBeReplaced = isTempId || isSending;

                    if (!canBeReplaced) return false;
                    return matchedTempId ? m.id === matchedTempId : (m.text === incomingText && m.sent === true);
                  })
                : null;
              
              if (existingOptimisticMsg) {
                // Actualizar solo el ID, mantener el timestamp original (crear nuevo array)
                chat.messages = chat.messages.map((m: ChatMessage) => 
                  m === existingOptimisticMsg
                    ? { ...existingOptimisticMsg, id: newMsg.id, read: true, status: undefined }
                    : m
                );

                setAllMessagesCache(prev => {
                  const phoneKey = normalizePhoneKey(chat.phone);
                  const phoneCache = prev[phoneKey] || [];
                  const updatedCache = phoneCache.map((m: ChatMessage) =>
                    m.id === existingOptimisticMsg.id
                      ? { ...m, id: newMsg.id, read: true, status: undefined }
                      : m
                  );
                  const nextCache = { ...prev, [phoneKey]: mergeMessageBatches(updatedCache) };
                  return applyMessageCachePolicy(nextCache);
                });
              } else {
                // Agregar nuevo mensaje
                const messageText = incomingText || '📩 Mensaje recibido';
                const mappedMessage = {
                  id: newMsg.id || `temp_${Date.now()}_${Math.random()}`,
                  text: messageText,
                  time: formatTime(msgTimestamp),
                  date: msgTimestamp.toISOString(),
                  sent: !isUserSender(newMsg.emisor || newMsg.tipo),
                  read: true,
                  type: newMsg.tipo || 'text',
                  fileUrl: newMsg.url_archivo,
                  filename: newMsg.archivo_nombre,
                  size: newMsg.archivo_tamanio,
                  duration: newMsg.duracion
                };
                
                console.log('✅ ADDING MESSAGE:', {
                  mappedMessageId: mappedMessage.id,
                  mappedMessageText: mappedMessage.text,
                  mappedMessageTime: mappedMessage.time,
                  sent: mappedMessage.sent
                });
                
                // Mantener el tamaño de ventana actualmente visible (si el operador ya cargó más,
                // no volver a recortar a 20 al llegar un mensaje nuevo).
                const visibleWindowSize = Math.max(messagesLimit, chat.messages.length || messagesLimit);
                chat.messages = appendIncomingMessage(chat.messages, mappedMessage, { limit: visibleWindowSize });
                
                // Incrementar contador solo si es mensaje del usuario Y no es del operador
                const isUserMessage = isUserSender(emisorLimpio);
                if (isUserMessage && selectedChat !== existingChatIndex) {
                  // Solo incrementar si NO estamos en este chat
                  chat.unread = (chat.unread || 0) + 1;
                }
                
                // FORCE UPDATE: Crear nuevo objeto de chat para triggear re-render
                updated[existingChatIndex] = { ...chat };
                
                // También agregar al caché de memoria
                setAllMessagesCache(prev => {
                  const cacheKey = normalizePhoneKey(chat.phone);
                  const phoneCache = prev[cacheKey] || [];
                  const updatedCache = mergeMessageBatches(phoneCache, [mappedMessage]);
                  const nextCache = { ...prev, [cacheKey]: updatedCache };
                  return applyMessageCachePolicy(nextCache);
                });
                
                // 📢 Mostrar notificación si el usuario no está en este chat
                if (isUserMessage && selectedChat !== existingChatIndex) {
                  const contactName = chat.nombre || chat.phone;
                  const messagePreview = messageText.substring(0, 100);
                  showNotification(`Mensaje de ${contactName}`, {
                    body: messagePreview,
                    silent: false
                  });
                }
              }
            } else {
              // Mensaje duplicado detectado por contenido, ignorar
            }
          }
          
          // Actualizar último mensaje y mantener posición del chat
          // newMsg.mensaje ya está normalizado a string en la parte superior de handleNewMessage
          chat.lastMessage = messagePreview || newMsg.mensaje || '[Mensaje sin contenido]';
          chat.lastMessageDate = msgTimestamp.toISOString();
          chat.time = formatTime(msgTimestamp);
          
          // NO mover el chat al inicio - mantener el orden de la lista
          // Simplemente actualizar el chat en su posición actual
          updated[existingChatIndex] = chat;
          
          return updated;
        } else {
          // Crear nueva conversación
          const messageText = typeof newMsg.mensaje === 'string' ? newMsg.mensaje : JSON.stringify(newMsg.mensaje || '');
          const messagePreview = normalizeMessageContent(messageText).preview;
          const msgTimestamp = parseMessageDate(newMsg.timestamp);
          const newChat = {
            id: Date.now(),
            name: newMsg.nombre || newMsg.telefono,
            phone: newMsg.telefono,
            lastMessage: messagePreview || resolvedDisplayText,
            lastMessageDate: msgTimestamp.toISOString(),
            time: formatTime(msgTimestamp),
            unread: isUserSender(newMsg.emisor || newMsg.tipo) ? 1 : 0,
            avatar: getInitials(newMsg.nombre || newMsg.telefono),
            profilePic: null, // Se actualizará con la foto de perfil cuando se recarguen los chats
            operator: null,
            conversationStatus: 'unattended',
            archived: false,
            padron: { number: '', location: '', debtStatus: '' },
            notes: [],
            messages: [{
              id: newMsg.id || `temp_${Date.now()}_${Math.random()}`,
              text: resolvedDisplayText,
              time: formatTime(msgTimestamp),
              date: msgTimestamp.toISOString(),
              sent: !isUserSender(newMsg.emisor || newMsg.tipo),
              read: true,
              type: newMsg.tipo || 'text',
              fileUrl: newMsg.url_archivo
            }]
          };
          return [newChat, ...prev];
        }
      });
    };

    const handleOperatorHandoffRequested = (payload: OperatorHandoffRequestedPayload) => {
      const phone = payload.telefono || payload.cliente_telefono;
      if (!phone) return;

      const ticket: OperatorHandoffTicket = {
        phone,
        ticketId: payload.ticket_id || payload.ticketId || null,
        subdelegacion: payload.subdelegacion || null,
        subdelegacionId: payload.subdelegacion_id || payload.subdelegacionId || null,
        motivo: payload.motivo || null,
        requestedAt: payload.requested_at || payload.requestedAt || new Date().toISOString()
      };

      upsertPendingTicket(ticket);

      setConversationsState((prev) => prev.map((chat) => {
        if (!phonesMatch(chat.phone, phone)) return chat;
        return {
          ...chat,
          ticketId: ticket.ticketId || chat.ticketId || null,
          subdelegacion: ticket.subdelegacion || chat.subdelegacion || null,
          subdelegacionId: ticket.subdelegacionId || chat.subdelegacionId || null,
          handoffReason: ticket.motivo || chat.handoffReason || null,
          handoffRequestedAt: ticket.requestedAt || chat.handoffRequestedAt || null,
          conversationStatus: 'ESPERA_OPERADOR',
          botActive: false
        };
      }));

      playNotificationSound();
      showNotification('Cliente esperando operador', {
        body: `${phone}${ticket.motivo ? ` · ${ticket.motivo}` : ''}`,
        tag: `handoff-${normalizePhoneKey(phone)}`
      });
      toast.warning('Solicitud de operador en espera', {
        description: `${phone}${ticket.subdelegacion ? ` · ${ticket.subdelegacion}` : ''}`
      });
    };

    const handleOperatorHandoffAccepted = (payload: OperatorHandoffAcceptedPayload) => {
      const phone = payload.telefono || payload.cliente_telefono;
      if (!phone) return;
      const ticketId = payload.ticket_id || payload.ticketId || null;

      removePendingTicket({ phone, ticketId });
      setConversationsState((prev) => prev.map((chat) => {
        if (!phonesMatch(chat.phone, phone)) return chat;
        return {
          ...chat,
          ticketId: ticketId || chat.ticketId || null,
          operator: payload.operador || chat.operator || null,
          conversationStatus: 'HUMANO',
          botActive: false,
          handoffAcceptedAt: payload.accepted_at || payload.acceptedAt || new Date().toISOString()
        };
      }));

      toast.success('Chat tomado por operador', {
        description: payload.operador ? `Asignado a ${payload.operador}.` : `Cliente ${phone} en atención humana.`
      });
    };

    const handleOperatorHandoffCompleted = (payload: OperatorHandoffCompletedPayload) => {
      const phone = payload.telefono || payload.cliente_telefono;
      if (!phone) return;
      const ticketId = payload.ticket_id || payload.ticketId || null;

      removePendingTicket({ phone, ticketId });
      setConversationsState((prev) => prev.map((chat) => {
        if (!phonesMatch(chat.phone, phone)) return chat;
        return {
          ...chat,
          ticketId: ticketId || chat.ticketId || null,
          conversationStatus: 'ENCUESTA_POST_OPERADOR',
          handoffCompletedAt: payload.completed_at || payload.completedAt || new Date().toISOString()
        };
      }));

      toast.success('Atención finalizada', {
        description: `Se activó el cierre automático para ${phone}.`
      });
    };

    const handleBotModeChanged = (data: BotModeChangedPayload) => {
      let chatLabel = data.telefono;
      const normalizedStatus = normalizeConversationStatus(data.estado_conversacion);

      setConversationsState(prev => {
        const chatIndex = prev.findIndex(c => phonesMatch(c.phone, data.telefono));
        if (chatIndex !== -1) {
          const updated = [...prev];
          chatLabel = updated[chatIndex].name || data.telefono;
          updated[chatIndex] = {
            ...updated[chatIndex],
            botActive: data.bot_activo,
            ticketId: data.ticket_id || updated[chatIndex].ticketId || null,
            subdelegacionId: data.subdelegacion_id || updated[chatIndex].subdelegacionId || null,
            ...(normalizedStatus ? { conversationStatus: normalizedStatus } : {})
          };
          return updated;
        }
        return prev;
      });

      if (normalizedStatus === 'ESPERA_OPERADOR') {
        upsertPendingTicket({
          phone: data.telefono,
          ticketId: data.ticket_id || null,
          subdelegacionId: data.subdelegacion_id || null,
          requestedAt: new Date().toISOString()
        });
      }

      if (normalizedStatus === 'HUMANO' || normalizedStatus === 'ENCUESTA_POST_OPERADOR' || normalizedStatus === 'FOLLOWUP_POST_OPERADOR' || normalizedStatus === 'BOT') {
        removePendingTicket({ phone: data.telefono, ticketId: data.ticket_id || null });
      }

      if (!data.bot_activo) {
        playNotificationSound();

        if (document.visibilityState !== 'visible' || !document.hasFocus()) {
          showNotification('Atención requerida', {
            body: `El bot se desactivó para ${chatLabel}. Un operador debe continuar la conversación.`,
            tag: `bot-off-${data.telefono}`
          });
        }

        toast.warning(`El bot se desactivó para ${chatLabel}.`, {
          description: 'Se requiere intervención de un operador.'
        });
      }
    };

    const handleTyping = (data: { telefono: string; typing: boolean }) => {
      setTypingUsers(prev => {
        const updated = { ...prev };
        if (data.typing) {
          updated[data.telefono] = true;
          // Auto-limpiar el indicador después de 3 segundos si no llega otro evento
          setTimeout(() => {
            setTypingUsers(p => {
              const cleaned = { ...p };
              delete cleaned[data.telefono];
              return cleaned;
            });
          }, 3000);
        } else {
          delete updated[data.telefono];
        }
        return updated;
      });
    };

    socket.on('nuevo_mensaje', handleNewMessage);
    socket.on('new_message', handleNewMessage);
    socket.on('message', handleNewMessage);
    socket.on('operator_handoff_requested', handleOperatorHandoffRequested);
    socket.on('operator_handoff_accepted', handleOperatorHandoffAccepted);
    socket.on('operator_handoff_completed', handleOperatorHandoffCompleted);
    socket.on('bot_mode_changed', handleBotModeChanged);
    socket.on('typing', handleTyping);

    const handleE2ENewMessage = (event: Event) => {
      const customEvent = event as CustomEvent<RawSocketMessage>;
      if (!customEvent?.detail) return;
      handleNewMessage(customEvent.detail);
    };

    window.addEventListener('e2e:nuevo_mensaje', handleE2ENewMessage as EventListener);
    
    // Cleanup al desmontar
    return () => {
      clearReconnectFallback();
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('connect_error', handleSocketConnectError);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.io.off('reconnect_failed', handleReconnectFailed);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(pendingTicketsInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.off('nuevo_mensaje', handleNewMessage);
      socket.off('new_message', handleNewMessage);
      socket.off('message', handleNewMessage);
      socket.off('operator_handoff_requested', handleOperatorHandoffRequested);
      socket.off('operator_handoff_accepted', handleOperatorHandoffAccepted);
      socket.off('operator_handoff_completed', handleOperatorHandoffCompleted);
      socket.off('bot_mode_changed', handleBotModeChanged);
      socket.off('typing', handleTyping);
      window.removeEventListener('e2e:nuevo_mensaje', handleE2ENewMessage as EventListener);
    };
  }, [isAuthenticated]);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
      if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(event.target as Node)) {
        setShowSidebarMenu(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dark mode: hydrate from storage and apply to html
  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored) setDarkMode(stored === 'true');
  }, []);

  // Load preferences from storage
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || 'emerald';
    const storedBg = localStorage.getItem('backgroundPattern');
    const storedSound = localStorage.getItem('soundEnabled');
    setTheme(storedTheme);
    if (storedBg !== null) setBackgroundPattern(storedBg === 'true');
    if (storedSound !== null) setSoundEnabled(storedSound === 'true');
  }, []);

  // Auto-scroll cuando cambia el último mensaje visible (no depende del largo del array)
  useEffect(() => {
    if (!currentChat || !currentChat.messages || currentChat.messages.length === 0) return;

    const currentCount = currentChat.messages.length;
    const previousCount = previousMessageCountRef.current;
    const lastMessage = currentChat.messages[currentCount - 1];
    const currentLastKey = `${String(lastMessage?.id ?? '')}|${String(lastMessage?.date ?? '')}|${String(lastMessage?.text ?? '')}`;
    const previousLastKey = previousLastMessageKeyRef.current;

    // Si estamos cargando más mensajes antiguos, NO hacer scroll
    if (isLoadingMoreMessages) {
      previousMessageCountRef.current = currentCount;
      previousLastMessageKeyRef.current = currentLastKey;
      return;
    }

    // Si es la primera carga (previousCount === 0), hacer scroll instantáneo sin animación
    if (previousCount === 0) {
      const messagesEnd = document.getElementById('messages-end');
      if (messagesEnd) {
        messagesEnd.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
      previousMessageCountRef.current = currentCount;
      previousLastMessageKeyRef.current = currentLastKey;
      return;
    }

    // Si cambió el último mensaje visible, mantener el chat anclado al final.
    if (currentLastKey !== previousLastKey) {
      const timer = setTimeout(() => {
        const messagesEnd = document.getElementById('messages-end');
        if (messagesEnd) {
          messagesEnd.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
      }, 50);
      previousMessageCountRef.current = currentCount;
      previousLastMessageKeyRef.current = currentLastKey;
      return () => clearTimeout(timer);
    }

    // Actualizar el contador sin hacer scroll
    previousMessageCountRef.current = currentCount;
    previousLastMessageKeyRef.current = currentLastKey;
  }, [currentChat?.messages, selectedChat, isLoadingMoreMessages]);
  
  // Resetear el contador cuando cambia de chat
  useEffect(() => {
    previousMessageCountRef.current = 0;
  }, [selectedChat]);

  // Persist preferences to storage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('backgroundPattern', String(backgroundPattern));
    localStorage.setItem('soundEnabled', String(soundEnabled));
  }, [theme, backgroundPattern, soundEnabled]);

  // Cargar mensajes cuando se selecciona un chat
  useEffect(() => {
    if (!currentChat?.id || !currentChat.phone) return;
    const selectedConversationId = currentChat.id;
    
    // Verificar si necesitamos cargar mensajes (no hay mensajes O el caché expiró)
    const shouldLoadMessages = !currentChat.messages || currentChat.messages.length === 0;
    const cacheKey = `messages_${currentChat.phone}`;
    const cachedData = localStorage.getItem(cacheKey);
    let cacheExpired = false;
    
    if (cachedData && !shouldLoadMessages) {
      try {
        const { timestamp } = JSON.parse(cachedData);
        const cacheAge = Date.now() - timestamp;
        cacheExpired = cacheAge >= 10 * 1000; // 10 segundos
      } catch (e) {
        cacheExpired = true;
      }
    }
    
    // Solo cargar si no hay mensajes O si el caché expiró
    if (shouldLoadMessages || cacheExpired) {
      const loadMessages = async () => {
        try {
          // Eliminar caché viejo para forzar recarga desde API
          const cacheKey = `messages_${currentChat.phone}`;
          localStorage.removeItem(cacheKey);
          
          const token = localStorage.getItem(env.tokenKey);
          
          // Traer hasta 100 mensajes para optimizar y quedarnos con los últimos 20
          const response = await axios.get(`/api/messages/${currentChat.phone}?limit=100&offset=0`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          
          const allMessages = response.data.mensajes || response.data.messages || [];
          const totalMessages = response.data.total || allMessages.length;
          
          // Quedarnos solo con los últimos N mensajes
          const messages = allMessages.slice(-messagesLimit);
          
          // Mapear mensajes al formato esperado por la UI
          const mappedMessages = messages.map((msg: RawApiMessage) => {
            const tipo = normalizeSenderType(msg.emisor || msg.tipo || '');
            const sent = !isUserSender(tipo);
            
            // 🔍 DEBUG: Log de detección de emisor al cargar mensajes
            console.log('🔍 DEBUG - Mensaje cargado:', {
              msg_id: msg.id,
              tipo_raw: msg.tipo,
              emisor_raw: msg.emisor,
              tipo_normalizado: tipo,
              isUserSender_result: isUserSender(tipo),
              sent_final: sent,
              contenido: (msg.contenido ?? msg.cuerpo ?? msg.mensaje ?? '').substring(0, 50)
            });
            
            const rawTimestamp = msg.created_at ?? msg.createdAt ?? msg.fecha ?? msg.timestamp;
            const normalizedContent = normalizeMessageContent(msg.contenido ?? msg.cuerpo ?? msg.mensaje ?? '');
            const resolvedFileUrl = msg.url_archivo || extractFileUrlFromText(normalizedContent.text);
            const resolvedFilename = msg.archivo_nombre || deriveFilenameFromUrl(resolvedFileUrl || undefined);
            const normalizedType = normalizeMessageType(msg.tipo, normalizedContent.type, {
              fileUrl: resolvedFileUrl,
              filename: resolvedFilename,
              text: normalizedContent.text
            });
            const msgDate = parseMessageDate(rawTimestamp);
            
            const stableId = msg.id || buildStableMessageId({
              phone: currentChat.phone,
              timestamp: msgDate.toISOString(),
              emisor: tipo || msg.tipo || msg.emisor,
              text: normalizedContent.text,
              type: normalizedType
            });
            
            return {
              id: stableId,
              text: normalizedContent.text || '',
              time: formatTime(msgDate),
              date: msgDate.toISOString(),
              sent: sent,
              read: true,
              type: normalizedType,
              fileUrl: resolvedFileUrl,
              filename: resolvedFilename,
              size: msg.archivo_tamanio,
              duration: msg.duracion
            };
          });
          
          // Guardar TODOS los mensajes mapeados en caché de memoria
          const allMappedMessages = allMessages.map((msg: RawApiMessage) => {
            const tipo = normalizeSenderType(msg.emisor || msg.tipo || '');
            const normalizedContent = normalizeMessageContent(msg.contenido ?? msg.cuerpo ?? msg.mensaje ?? '');
            const resolvedFileUrl = msg.url_archivo || extractFileUrlFromText(normalizedContent.text);
            const resolvedFilename = msg.archivo_nombre || deriveFilenameFromUrl(resolvedFileUrl || undefined);
            const normalizedType = normalizeMessageType(msg.tipo, normalizedContent.type, {
              fileUrl: resolvedFileUrl,
              filename: resolvedFilename,
              text: normalizedContent.text
            });
            const msgDate = parseMessageDate(msg.created_at ?? msg.createdAt ?? msg.fecha ?? msg.timestamp);
            const stableId = msg.id || buildStableMessageId({
              phone: currentChat.phone,
              timestamp: msgDate.toISOString(),
              emisor: msg.tipo || msg.emisor,
              text: normalizedContent.text,
              type: normalizedType
            });
            return {
              id: stableId,
              text: normalizedContent.text || '',
              time: formatTime(msgDate),
              date: msgDate.toISOString(),
              sent: !isUserSender(tipo),
              read: true,
              type: normalizedType,
              fileUrl: resolvedFileUrl,
              filename: resolvedFilename,
              size: msg.archivo_tamanio,
              duration: msg.duracion
            };
          });
          const sortedAllMessages = mergeMessageBatches(allMappedMessages);
          
          // Guardar en caché de memoria
          setAllMessagesCache(prev => {
            const phoneKey = normalizePhoneKey(currentChat.phone);
            const nextCache = { ...prev, [phoneKey]: sortedAllMessages };
            return applyMessageCachePolicy(nextCache);
          });
          setCurrentMessageIndex(prev => ({ ...prev, [currentChat.phone]: sortedAllMessages.length - messagesLimit }));
          
          // Solo mostrar los últimos N
          const messagesToShow = sortedAllMessages.slice(-messagesLimit);
          const lastMsg = sortedAllMessages.length > 0 ? sortedAllMessages[sortedAllMessages.length - 1] : null;
          const lastMsgPreview = lastMsg ? normalizeMessageContent(lastMsg.text).preview : null;
          
          // Marcar que NO llegamos al final si hay más mensajes en caché o en BD
          if (allMappedMessages.length > messagesLimit || allMessages.length >= 100) {
            setMessagesEndReached(prev => ({ ...prev, [currentChat.phone]: false }));
          } else {
            setMessagesEndReached(prev => ({ ...prev, [currentChat.phone]: true }));
          }
          
          // Actualizar el chat con los mensajes a mostrar
          setConversationsState(prev => {
            const targetIndex = prev.findIndex((chat) => chat.id === selectedConversationId);
            if (targetIndex === -1) return prev;

            const updated = [...prev];
            updated[targetIndex] = {
              ...updated[targetIndex],
              messages: messagesToShow,
              ...(lastMsg ? {
                lastMessage: lastMsgPreview || lastMsg.text || updated[targetIndex].lastMessage,
                lastMessageDate: lastMsg.date || updated[targetIndex].lastMessageDate,
                time: lastMsg.date ? formatTime(new Date(lastMsg.date)) : updated[targetIndex].time
              } : {})
            };
            return updated;
          });
        } catch (error: unknown) {
          const responseStatus = axios.isAxiosError(error) ? error.response?.status : undefined;
          const responseStatusText = axios.isAxiosError(error) ? error.response?.statusText : undefined;
          const responseData = axios.isAxiosError(error) ? error.response?.data : undefined;
          const errorMessage = error instanceof Error ? error.message : String(error);

          console.error('❌ Error cargando mensajes:', error);
          console.error('❌ Detalles del error:', {
            status: responseStatus,
            statusText: responseStatusText,
            data: responseData,
            message: errorMessage
          });
          
          // Establecer array vacío para que no quede en loading infinito
          setConversationsState(prev => {
            const targetIndex = prev.findIndex((chat) => chat.id === selectedConversationId);
            if (targetIndex === -1) return prev;

            const updated = [...prev];
            updated[targetIndex] = {
              ...updated[targetIndex],
              messages: []
            };
            return updated;
          });
        }
      };
      
      loadMessages();
    }
  }, [currentChat?.id]);
  
  // Simulate audio playback progress based on real duration
  useEffect(() => {
    if (audioPlaying === null) return;
    
    // Find the audio message to get its duration
    let totalSeconds = 32; // default fallback
    for (const conv of conversationsState) {
      if (conv.messages && Array.isArray(conv.messages)) {
        const msg = conv.messages.find((m) => m.id === audioPlaying);
        if (msg && msg.type === 'audio') {
          const duration = msg.duration || '0:32';
          const [mins, secs] = duration.split(':').map(Number);
          totalSeconds = mins * 60 + secs;
          break;
        }
      }
    }
    
    // Actualización suave cada 50ms para progreso continuo
    const interval = setInterval(() => {
      setAudioProgress(prev => {
        const incrementPerUpdate = (100 / totalSeconds) / 20; // 20 actualizaciones por segundo
        const newProgress = Math.min((prev[audioPlaying] || 0) + incrementPerUpdate, 100);
        
        if (newProgress >= 100) {
          setAudioPlaying(null);
        }
        
        return {
          ...prev,
          [audioPlaying]: newProgress
        };
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [audioPlaying, conversationsState]);

  // En desktop, selecciona la primera conversación por defecto si no está cerrado
  useEffect(() => {
    if (!chatClosed && selectedChat === null && conversationsState.length > 0 && window.matchMedia('(min-width: 768px)').matches) {
      setSelectedChat(0);
    }
  }, [selectedChat, chatClosed, conversationsState]);

  // Close preferences on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (preferencesRef.current && !preferencesRef.current.contains(event.target as Node)) {
        setShowPreferences(false);
      }
    };
    if (showPreferences) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPreferences]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Función para cerrar el panel de información con animación
  const closeInfoPanel = () => {
    setInfoPanelClosing(true);
    setTimeout(() => {
      setShowInfo(false);
      setInfoPanelClosing(false);
    }, 300); // Duración de la animación slideOutRight
  };

  // Mantener selectedChat válido cuando cambia la lista
  useEffect(() => {
    if (selectedChat === null) {
      selectedConversationIdRef.current = null;
      prevSelectedChatRef.current = null;
      return;
    }

    if (!conversationsState.length) {
      selectedConversationIdRef.current = null;
      prevSelectedChatRef.current = null;
      setSelectedChat(null);
      return;
    }

    const selectedByIndex = conversationsState[selectedChat];
    const selectedChatChanged = prevSelectedChatRef.current !== selectedChat;
    const selectedIdSnapshot = selectedConversationIdRef.current;

    if (!selectedByIndex) {
      setSelectedChat(Math.max(0, conversationsState.length - 1));
      prevSelectedChatRef.current = selectedChat;
      return;
    }

    if (selectedIdSnapshot !== null) {
      // Si cambió el índice seleccionado, asumir cambio intencional y actualizar snapshot.
      if (selectedChatChanged && selectedByIndex.id !== selectedIdSnapshot) {
        selectedConversationIdRef.current = selectedByIndex.id;
        prevSelectedChatRef.current = selectedChat;
        return;
      }

      // Si el índice no cambió pero el id sí, hubo drift por cambios en la lista: restaurar por id.
      if (!selectedChatChanged && selectedByIndex.id !== selectedIdSnapshot) {
        const stableIndex = conversationsState.findIndex((chat) => chat.id === selectedIdSnapshot);
        if (stableIndex !== -1 && stableIndex !== selectedChat) {
          setSelectedChat(stableIndex);
          prevSelectedChatRef.current = selectedChat;
          return;
        }
      }
    }

    selectedConversationIdRef.current = selectedByIndex.id;
    prevSelectedChatRef.current = selectedChat;
  }, [conversationsState, selectedChat]);
  
  // Funciones para control del bot
  const pauseBot = async (phone: string) => {
    try {
      await axios.post(`/api/chats/${phone}/pause`, {}, {
        headers: {}
      });
      // Bot pausado
    } catch (error) {
      console.error('❌ Error pausando bot:', error);
    }
  };
  
  const activateBot = async (phone: string) => {
    try {
      const token = localStorage.getItem(env.tokenKey);
      await axios.post(`/api/chats/${phone}/activate`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      // Bot activado
    } catch (error) {
      console.error('❌ Error activando bot:', error);
    }
  };

  // Cierra la barra de búsqueda al hacer click fuera
  useEffect(() => {
    if (!chatSearchMode) return;
    const handler = (e: MouseEvent) => {
      if (chatSearchRef.current && !chatSearchRef.current.contains(e.target as Node)) {
        setChatSearchMode(false);
        setChatSearchText('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chatSearchMode]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K: Abrir búsqueda de chats
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setChatSearchMode(true);
        setTimeout(() => chatSearchRef.current?.focus(), 100);
      }
      // Ctrl+Shift+F: Toggle filtro por estado (unread, resolved, all)
      // TODO: Implementar filtros por estado de chat cuando esté listo
      // if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
      //   e.preventDefault();
      // }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSendMessage = async () => {
    if (message.trim() && selectedChat !== null) {
      if (editingMessage) {
        saveEditMessage();
      } else {
        const currentChat = conversationsState[selectedChat];
        if (!currentChat || !currentChat.phone) return;
        const lockInfo = getChatLockInfo(currentChat);
        if (lockInfo.isLockedByAnotherOperator) {
          toast.warning('Chat en modo solo lectura', {
            description: `Este chat está tomado por ${lockInfo.lockedBy}.`
          });
          return;
        }
        
        const messageText = message.trim();
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        // Crear mensaje temporal para mostrar inmediatamente
        const tempMessage = {
          id: tempId,
          text: messageText,
          time: formatTime(new Date()),
          date: new Date().toISOString(),
          sent: true,
          read: false,
          type: 'text',
          fileUrl: null,
          filename: null,
          size: null,
          duration: null,
          status: 'sending'  // Estado inicial: enviando
        };

        registerPendingMessage({
          tempId,
          phone: currentChat.phone,
          text: messageText,
          createdAt: tempMessage.date
        });
        
        // Actualizar UI inmediatamente (optimistic update)
        setConversationsState(prev => {
          const updated = [...prev];
          if (!updated[selectedChat].messages) {
            updated[selectedChat].messages = [];
          }
          updated[selectedChat].messages = dedupeMessages([...updated[selectedChat].messages, tempMessage]);
          updated[selectedChat].lastMessage = messageText;
          updated[selectedChat].lastMessageDate = new Date().toISOString();
          updated[selectedChat].time = formatTime(new Date());
          return updated;
        });
        
        // También agregar al caché de memoria
        setAllMessagesCache(prev => {
          const phoneKey = normalizePhoneKey(currentChat.phone);
          const phoneCache = prev[phoneKey] || [];
          const updatedCache = dedupeMessages([...phoneCache, tempMessage]);
          return { ...prev, [phoneKey]: updatedCache };
        });
        
        // Limpiar input
        setMessage('');
        setReplyingTo(null);
        
        // Invalidar caché
        const cacheKey = `messages_${currentChat.phone}`;
        localStorage.removeItem(cacheKey);
        
        // Enviar al backend
        try {
          const response = await axios.post('/api/send', {
            telefono: currentChat.phone,
            mensaje: messageText,
            operador: 'Panel Frontend'
          }, {
            headers: {}
          });

          trackAction('message_send_success', { phone: currentChat.phone });
          
          // Scroll al final después de enviar
          setTimeout(() => {
            const messagesContainer = document.querySelector('[data-messages-container]');
            if (messagesContainer) {
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          }, 50);
          
          // Actualizar con el ID real del backend si viene
          if (response.data && response.data.message && response.data.message.id) {
            const realId = response.data.message.id;
            removePendingMessage(currentChat.phone, tempId);

            setConversationsState(prev => {
              const updated = [...prev];
              const targetChatIndex = updated.findIndex((c) => phonesMatch(c.phone, currentChat.phone));

              if (targetChatIndex !== -1 && updated[targetChatIndex].messages) {
                // Verificar si ya existe un mensaje con el ID real (fue actualizado por el socket)
                const msgAlreadyUpdated = updated[targetChatIndex].messages.some((m) => m.id === realId);
                
                if (!msgAlreadyUpdated) {
                  // Solo actualizar si el socket aún no lo hizo
                  updated[targetChatIndex].messages = updated[targetChatIndex].messages.map((m) =>
                    m.id === tempId ? { ...m, id: realId, status: undefined, read: true } : m
                  );
                  updated[targetChatIndex].messages = dedupeMessages(updated[targetChatIndex].messages);
                } else {
                  // Limpiar el status del mensaje temporal si existe
                  updated[targetChatIndex].messages = updated[targetChatIndex].messages.map((m) =>
                    m.id === tempId ? { ...m, status: undefined } : m
                  );
                }
              }
              return updated;
            });
            
            // También actualizar en el caché de memoria
            setAllMessagesCache(prev => {
              const phoneKey = normalizePhoneKey(currentChat.phone);
              const phoneCache = prev[phoneKey] || [];
              const msgAlreadyUpdated = phoneCache.some((m) => m.id === realId);
              
              if (!msgAlreadyUpdated) {
                const updatedCache = dedupeMessages(phoneCache.map(msg => 
                  msg.id === tempId ? { ...msg, id: realId, status: undefined, read: true } : msg
                ));
                const nextCache = { ...prev, [phoneKey]: updatedCache };
                return applyMessageCachePolicy(nextCache);
              } else {
                return prev;
              }
            });
          }
        } catch (error) {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          if ((status === 409 || status === 423) && axios.isAxiosError(error)) {
            const payload = (error.response?.data || {}) as Record<string, unknown>;
            const conflictOperator = typeof payload.operador === 'string' ? payload.operador : null;
            const conflictStatus = normalizeConversationStatus(
              typeof payload.estado_conversacion === 'string' ? payload.estado_conversacion : undefined
            ) || 'HUMANO';

            removePendingMessage(currentChat.phone, tempId);
            setConversationsState(prev => {
              const updated = [...prev];
              const targetChatIndex = updated.findIndex((c) => phonesMatch(c.phone, currentChat.phone));
              if (targetChatIndex !== -1) {
                updated[targetChatIndex] = {
                  ...updated[targetChatIndex],
                  ...(conflictOperator ? { operator: conflictOperator } : {}),
                  conversationStatus: conflictStatus,
                  botActive: false,
                  messages: (updated[targetChatIndex].messages || []).filter((m) => m.id !== tempId)
                };
              }
              return updated;
            });

            toast.warning('No se pudo enviar por concurrencia', {
              description: conflictOperator
                ? `El chat fue tomado por ${conflictOperator}. Se habilitó modo solo lectura.`
                : 'El chat cambió de estado en otro panel.'
            });
            return;
          }

          console.error('❌ Error enviando mensaje:', error);
          trackAction('message_send_failed', { phone: currentChat.phone });
          emitConnectionAlert({
            kind: 'warning',
            title: 'No se pudo enviar el mensaje',
            description: 'El mensaje quedó marcado con error para que puedas reintentar.'
          });
          removePendingMessage(currentChat.phone, tempId);
          // Marcar el mensaje como error
          setConversationsState(prev => {
            const updated = [...prev];
            const targetChatIndex = updated.findIndex((c) => phonesMatch(c.phone, currentChat.phone));
            if (targetChatIndex !== -1 && updated[targetChatIndex].messages) {
              const msgIndex = updated[targetChatIndex].messages.findIndex((m) => m.id === tempId);
              if (msgIndex !== -1) {
                updated[targetChatIndex].messages[msgIndex].error = true;
              }
            }
            return updated;
          });
        }
      }
    }
  };

  const handleEmojiClick = (emojiObject: { emoji: string }) => {
    const lockInfo = getChatLockInfo(currentChat);
    if (lockInfo.isLockedByAnotherOperator) {
      toast.warning('No puedes editar este chat', {
        description: `Actualmente lo atiende ${lockInfo.lockedBy}.`
      });
      return;
    }
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lockInfo = getChatLockInfo(currentChat);
    if (lockInfo.isLockedByAnotherOperator) {
      toast.warning('No puedes adjuntar archivos', {
        description: `Este chat está tomado por ${lockInfo.lockedBy}.`
      });
      if (e.target) {
        e.target.value = '';
      }
      return;
    }

    const file = e.target.files?.[0];
    if (file) {
      alert(`Archivo seleccionado: ${file.name}`);
    }
  };

  const handleAttachmentType = (accept: string) => {
    const lockInfo = getChatLockInfo(currentChat);
    if (lockInfo.isLockedByAnotherOperator) {
      toast.warning('No puedes adjuntar archivos', {
        description: `Este chat está tomado por ${lockInfo.lockedBy}.`
      });
      setShowAttachMenu(false);
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
    setShowAttachMenu(false);
  };

  // Context menu handlers
  const openContextMenu = (e: React.MouseEvent, type: 'chat' | 'message', targetId: number) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type, targetId });
  };

  const openBlankMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'blank' });
  };


  const createNewConversation = () => {
    if (!newConvName.trim() || !newConvPhone.trim()) return;
    
    const newId = Math.max(...conversationsState.map(c => c.id), 0) + 1;
    const newConv = {
      id: newId,
      name: newConvName.trim(),
      phone: newConvPhone.trim(),
      padron: Math.floor(Math.random() * 90000) + 10000,
      lastMessage: newConvMessage.trim() || 'Nueva conversación',
      time: 'Ahora',
      unread: 0,
      conversationStatus: 'unattended' as const,
      archived: false,
      messages: newConvMessage.trim() ? [{
        id: 1,
        text: newConvMessage.trim(),
        sent: false,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        read: false
      }] : []
    };
    
    setConversationsState(prev => [newConv, ...prev]);
    setSelectedChat(0);
    setChatClosed(false);
    setShowNewConversation(false);
    setNewConvName('');
    setNewConvPhone('');
    setNewConvMessage('');
  };

  const copyMessageById = (id: number) => {
    if (selectedChat === null) return;
    const msg = conversationsState[selectedChat].messages.find((m) => m.id === id);
    if (msg && navigator.clipboard) navigator.clipboard.writeText(msg.text);
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const deleteMessageById = (id: number) => {
    if (selectedChat === null) return;
    const chatId = conversationsState[selectedChat].id;
    setConfirmDialog({
      visible: true,
      message: '¿Eliminar este mensaje?',
      onConfirm: () => {
        setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== id) } : c));
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
        setConfirmDialog(null);
      }
    });
  };

  const replyToMessage = (id: number) => {
    if (selectedChat === null) return;
    const msg = conversationsState[selectedChat].messages.find((m) => m.id === id);
    if (msg) {
      let displayText = msg.text;
      if (msg.type === 'image') displayText = '📷 Imagen';
      else if (msg.type === 'video') displayText = '🎥 Video';
      else if (msg.type === 'audio') displayText = '🎤 Audio';
      else if (msg.type === 'file') displayText = `📄 ${msg.filename || 'Archivo'}`;
      setReplyingTo({ id: msg.id, text: displayText });
    }
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const forwardMessage = (id: number) => {
    setForwardMessageId(id);
    setShowForwardMenu(true);
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const confirmForward = (targetChatId: number) => {
    if (selectedChat === null || forwardMessageId === null) return;
    const msg = conversationsState[selectedChat].messages.find((m) => m.id === forwardMessageId);
    if (msg) {
      const targetChat = conversationsState.find(c => c.id === targetChatId);
      if (targetChat) {
        const maxNumericMessageId = targetChat.messages.reduce((maxId, message) => {
          const numericId = typeof message.id === 'number' ? message.id : Number(message.id);
          if (!Number.isFinite(numericId)) return maxId;
          return Math.max(maxId, numericId);
        }, 0);
        const newMsgId = maxNumericMessageId + 1;
        setConversationsState(prev => prev.map(c => c.id === targetChatId ? {
          ...c,
          messages: [...c.messages, {
            id: newMsgId,
            text: msg.text,
            sent: true,
            time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            read: false,
            type: msg.type,
            fileUrl: msg.fileUrl,
            filename: msg.filename,
            size: msg.size,
            duration: msg.duration
          }]
        } : c));
      }
    }
    setShowForwardMenu(false);
    setForwardMessageId(null);
  };

  const startEditMessage = (id: number) => {
    if (selectedChat === null) return;
    const msg = conversationsState[selectedChat].messages.find((m) => m.id === id);
    if (msg && msg.sent) {
      setEditingMessage({ id: msg.id, text: msg.text });
      setMessage(msg.text);
    }
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const saveEditMessage = () => {
    if (selectedChat === null || editingMessage === null) return;
    const chatId = conversationsState[selectedChat].id;
    setConversationsState(prev => prev.map(c => c.id === chatId ? {
      ...c,
      messages: c.messages.map((m) => m.id === editingMessage.id ? { ...m, text: message } : m)
    } : c));
    setEditingMessage(null);
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessage('');
  };

  const startEditName = () => {
    if (selectedChat === null) return;
    setTempName(conversationsState[selectedChat].name);
    setEditingName(true);
  };

  const saveEditName = () => {
    if (selectedChat === null || !tempName.trim()) return;
    const chatId = conversationsState[selectedChat].id;
    setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, name: tempName.trim() } : c));
    setEditingName(false);
    setTempName('');
  };

  const cancelEditName = () => {
    setEditingName(false);
    setTempName('');
  };

  const getMediaMessages = () => {
    if (selectedChat === null) return [];
    const messages = conversationsState[selectedChat].messages;
    
    switch (mediaFilter) {
      case 'images':
        return messages.filter((m) => m.type === 'image');
      case 'videos':
        return messages.filter((m) => m.type === 'video');
      case 'files':
        return messages.filter((m) => m.type === 'file');
      case 'urls':
        return messages.filter((m) => m.text && /https?:\/\/[^\s]+/.test(m.text));
      default:
        return messages.filter((m) => m.type === 'image' || m.type === 'video' || m.type === 'file' || (m.text && /https?:\/\/[^\s]+/.test(m.text)));
    }
  };

  const goToMessage = (messageId: number) => {
    setLightboxImage(null);
    setLightboxVideo(null);
    setImageZoom(1);
    setImageRotation(0);
    
    // Scroll al mensaje
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessage(messageId);
        setTimeout(() => setHighlightedMessage(null), 2000);
      }
    }, 100);
  };

  const replyFromLightbox = (messageId: number) => {
    if (selectedChat === null) return;
    const msg = conversationsState[selectedChat].messages.find((m) => m.id === messageId);
    if (msg) {
      let displayText = msg.text;
      if (msg.type === 'image') displayText = '📷 Imagen';
      else if (msg.type === 'video') displayText = '🎥 Video';
      else if (msg.type === 'audio') displayText = '🎤 Audio';
      else if (msg.type === 'file') displayText = `📄 ${msg.filename || 'Archivo'}`;
      setReplyingTo({ id: msg.id, text: displayText });
      setLightboxImage(null);
      setLightboxVideo(null);
      setLightboxMessageId(null);
      setImageZoom(1);
      setImageRotation(0);
    }
  };

  const forwardFromLightbox = (messageId: number) => {
    setForwardMessageId(messageId);
    setShowForwardMenu(true);
    setLightboxImage(null);
    setLightboxVideo(null);
    setLightboxMessageId(null);
    setImageZoom(1);
    setImageRotation(0);
  };

  const startSelection = () => {
    setSelectionMode(true);
    setSelectedMessageIds([]);
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const toggleMessageSelection = (id: number) => {
    setSelectedMessageIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const deleteSelectedMessages = () => {
    if (selectedChat === null) return;
    if (selectedMessageIds.length === 0) {
      setContextMenu({ visible: false, x: 0, y: 0, type: null });
      return;
    }
    const chat = conversationsState[selectedChat];
    const ownSelectedIds = selectedMessageIds.filter(id => {
      const m = chat.messages.find((mm) => mm.id === id);
      return m?.sent === true;
    });
    if (ownSelectedIds.length === 0) {
      // Nada propio para borrar
      setContextMenu({ visible: false, x: 0, y: 0, type: null });
      return;
    }
    const chatId = chat.id;
    setConfirmDialog({
      visible: true,
      message: `¿Eliminar ${ownSelectedIds.length} mensaje(s) propios?`,
      onConfirm: () => {
        setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter((m) => !ownSelectedIds.includes(Number(m.id)) ) } : c));
        setSelectedMessageIds([]);
        setSelectionMode(false);
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
        setConfirmDialog(null);
      }
    });
  };

  const exitSelection = () => {
    setSelectedMessageIds([]);
    setSelectionMode(false);
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const toggleExpandMessage = (id: number) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const getFilteredMessages = () => {
    if (selectedChat === null) return [];
    const chat = conversationsState[selectedChat];
    const base = !chatSearchText.trim()
      ? chat.messages
      : chat.messages.filter((msg) =>
          msg.text.toLowerCase().includes(chatSearchText.toLowerCase())
        );
    // No aplicar dedupe en display, ya se aplicó al agregar
    return base;
  };

  const updatePadronField = (field: 'number' | 'location' | 'debtStatus', value: string) => {
    if (selectedChat === null) return;
    const chatId = conversationsState[selectedChat].id;
    setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, padron: { ...(c.padron || {}), [field]: value } } : c));
  };

  const addNote = () => {
    if (selectedChat === null) return;
    const chatId = conversationsState[selectedChat].id;
    const draft = noteDrafts[chatId] || '';
    if (!draft.trim()) return;
    const newNote = { id: Date.now(), text: draft.trim() };
    setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, notes: [ ...(c.notes || []), newNote ] } : c));
    setNoteDrafts(prev => ({ ...prev, [chatId]: '' }));
  };

  const deleteNote = (noteId: number) => {
    if (selectedChat === null) return;
    const chatId = conversationsState[selectedChat].id;
    setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, notes: (c.notes || []).filter((n) => n.id !== noteId) } : c));
  };

  const insertQuickText = (text: string) => {
    const lockInfo = getChatLockInfo(currentChat);
    if (lockInfo.isLockedByAnotherOperator) {
      toast.warning('No puedes responder en este chat', {
        description: `Actualmente lo atiende ${lockInfo.lockedBy}.`
      });
      return;
    }
    setMessage((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    if (!navigator.clipboard || !msg?.text) return;
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMessageId(msg.id);
      setTimeout(() => setCopiedMessageId(null), 1200);
    } catch (e) {
      console.error('No se pudo copiar', e);
    }
  };

  // Mock isOnline state for connection bar
  const isOnline = true;

  const filteredMessages = useMemo(() => {
    const activeChat = selectedId !== undefined && selectedId !== null
      ? conversationsState.find((chat) => chat.id === selectedId) || null
      : (selectedChat !== null ? conversationsState[selectedChat] : null);

    if (!activeChat) return [];

    const base = !chatSearchText.trim()
      ? activeChat.messages
      : activeChat.messages.filter((msg) =>
          msg.text.toLowerCase().includes(chatSearchText.toLowerCase())
        );

    return base;
  }, [conversationsState, selectedId, selectedChat, chatSearchText]);

  const currentChatLock = getChatLockInfo(currentChat);

  const filteredConversations = conversationsState.filter(conv => {
    // Filtrar archivadas
    if (conv.archived) return false;
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      conv.name.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query) ||
      conv.messages.some((msg) => msg.text.toLowerCase().includes(query))
    );
  });

  const archivedConversations = conversationsState.filter(conv => conv.archived);

  const conversationsVirtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => conversationsContainerRef.current,
    estimateSize: () => 92,
    overscan: 8,
    initialRect: {
      width: 0,
      height: 900
    },
    getItemKey: (index) => filteredConversations[index]?.id ?? index
  });


  const markResolved = () => {
    if (selectedChat === null) return;
    setConversationsState((prev) => {
      const next = [...prev];
      next[selectedChat] = { ...next[selectedChat], conversationStatus: 'resolved', unread: 0 };
      return next;
    });
    setShowMenu(false);
  };

  const deleteConversation = () => {
    if (selectedChat === null) return;
    setConversationsState((prev) => {
      const next = prev.filter((_, idx) => idx !== selectedChat);
      return next;
    });
    setSelectedChat((idx) => {
      if (idx === null) return null;
      // Si el índice eliminado era el último, ir al anterior
      // Si no, mantener el mismo índice (que ahora apunta al siguiente chat)
      return Math.max(0, idx - 1);
    });
    setShowMenu(false);
    setShowInfo(false);
  };

  // Si no está autenticado, mostrar pantalla de login
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} theme={theme} darkMode={darkMode} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 dark:text-gray-100 flex-col">
      <Toaster richColors closeButton position="top-right" />
      {!isOnline && (
        <div className="bg-orange-500 text-white px-4 py-2 text-center text-sm font-medium animate-pulse">
          Sin conexión - Intentando reconectar...
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar - Lista de conversaciones */}
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
        {pendingOperatorTickets.length > 0 && (
          <div className="mx-3 mt-3 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-800 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-100">
                Clientes esperando operador: {pendingOperatorTickets.length}
              </p>
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
                        disabled={loading}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-60"
                        style={{ backgroundColor: themeColors[theme].hex }}
                      >
                        {loading ? 'Tomando...' : 'Tomar chat'}
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

      {/* Chat Principal */}
      <div className={`${selectedChat === null ? 'hidden md:hidden' : 'flex md:flex'} flex-1 flex-col bg-gray-50 dark:bg-gray-900 transition-opacity duration-200`}>
        {/* Chat Header */}
        {currentChat && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button only on mobile */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={closeSelectedChat}
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="flex items-center gap-3 text-left focus:outline-none"
            >
              <div className="relative">
                {currentChat.profilePic ? (
                  <img 
                    src={currentChat.profilePic} 
                    alt={currentChat.name}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{
                  backgroundImage: `linear-gradient(135deg, ${themeColors[theme].hex}, #14b8a6)`,
                  display: currentChat.profilePic ? 'none' : 'flex'
                }}>
                  {currentChat.avatar}
                </div>
                {(() => {
                  const lastMsgDate = currentChat.messages && currentChat.messages.length > 0 
                    ? currentChat.messages[currentChat.messages.length - 1].date 
                    : new Date();
                  const status = getContactStatus(lastMsgDate);
                  return (
                    <div className={`absolute bottom-0 right-0 w-3 h-3 ${status.color} rounded-full border-2 border-white dark:border-gray-800`}></div>
                  );
                })()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div 
                    className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                    onContextMenu={(e) => { e.preventDefault(); startEditName(); }}
                  >
                    {currentChat.name}
                  </div>
                  {(() => {
                    // Calcular tiempo para expiración
                    const lastUserMsg = [...(currentChat.messages || [])].reverse().find((m) => m.sent === false)?.date;
                    if (!lastUserMsg) return null;
                    const lastUser = new Date(lastUserMsg);
                    const diffMs = Date.now() - lastUser.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);
                    const diffDays = diffHours / 24;
                    if (diffDays > 1) {
                      return <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 text-xs rounded-full font-medium">Sesión vencida</span>;
                    } else if (diffHours > 22) {
                      return <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 text-xs rounded-full font-medium">Por expirar (~{Math.round(24 - diffHours)}h)</span>;
                    }
                    return null;
                  })()}
                </div>
                {(() => {
                  const lastMsgDate = currentChat.lastMessageDate 
                    || (currentChat.messages && currentChat.messages.length > 0 
                      ? currentChat.messages[currentChat.messages.length - 1].date 
                      : new Date());
                  const status = getContactStatus(lastMsgDate);
                  const relativeTime = getRelativeTime(lastMsgDate);
                  return (
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 ${status.color} rounded-full`}></div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {status.code === 'online' ? 'En línea ahora' : `Último mnj: ${relativeTime}`}
                      </p>
                    </div>
                  );
                })()}
                {currentChatLock.isLockedByAnotherOperator && (
                  <p className="text-xs text-rose-600 dark:text-rose-300 font-medium mt-0.5">
                    Tomado por {currentChatLock.lockedBy} · Solo lectura
                  </p>
                )}
              </div>
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {(() => {
              const phoneKey = normalizePhoneKey(currentChat.phone);
              const hasPendingHandoff = pendingOperatorTickets.some((ticket) => phonesMatch(ticket.phone, currentChat.phone));
              const isWaiting = hasPendingHandoff || isWaitingOperator(currentChat.conversationStatus);
              const isHuman = isHumanConversation(currentChat.conversationStatus);
              const statusMeta = getStatusBadgeMeta(isWaiting ? 'ESPERA_OPERADOR' : currentChat.conversationStatus, currentChat.botActive);
              const actionState = handoffActionLoading[phoneKey];

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
                      onClick={() => void acceptOperatorChat(currentChat.phone)}
                      disabled={actionState !== undefined}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: themeColors[theme].hex }}
                    >
                      {actionState === 'accept' ? 'Tomando...' : 'Tomar chat'}
                    </button>
                  )}
                  {isHuman && (
                    <button
                      type="button"
                      onClick={() => void completeOperatorChat(currentChat.phone)}
                      disabled={actionState !== undefined || currentChatLock.isLockedByAnotherOperator}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                    >
                      {actionState === 'complete' ? 'Finalizando...' : 'Terminar conversación'}
                    </button>
                  )}
                </div>
              );
            })()}
            <div className="relative flex items-center" ref={chatSearchRef}>
              <div
                className={`flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden transition-all duration-200 ease-out ${
                  chatSearchMode ? 'w-48 px-3 py-2 opacity-100' : 'w-0 px-0 py-0 opacity-0 pointer-events-none'
                }`}
                style={{ boxShadow: chatSearchMode ? '0 4px 12px rgba(0,0,0,0.08)' : undefined }}
              >
                <Search size={16} className="text-gray-500 mr-2 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={chatSearchText}
                  onChange={(e) => setChatSearchText(e.target.value)}
                  className="bg-transparent text-sm flex-1 focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  autoFocus={chatSearchMode}
                />
                <button
                  className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
                  onClick={() => {
                    setChatSearchText('');
                    setChatSearchMode(false);
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <button
                className={`p-2 rounded-lg transition-all duration-200 ease-out ${
                  chatSearchMode
                    ? 'opacity-0 scale-90 pointer-events-none'
                    : 'opacity-100 scale-100 pointer-events-auto'
                } hover:bg-gray-100 dark:hover:bg-gray-700`}
                style={{ transitionDelay: chatSearchMode ? '0ms' : '160ms' }}
                onClick={() => setChatSearchMode(true)}
              >
                <Search size={20} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            <div className="relative" ref={chatMenuRef}>
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              onClick={() => setShowMenu((v) => !v)}
            >
              <MoreVertical size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            {showMenu && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 animate-slideInDown">
                {(() => {
                  const phoneKey = normalizePhoneKey(currentChat.phone);
                  const hasPendingHandoff = pendingOperatorTickets.some((ticket) => phonesMatch(ticket.phone, currentChat.phone));
                  const isWaiting = hasPendingHandoff || isWaitingOperator(currentChat.conversationStatus);
                  const isHuman = isHumanConversation(currentChat.conversationStatus);
                  const actionState = handoffActionLoading[phoneKey];

                  return (
                    <>
                      {isWaiting && (
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={() => void acceptOperatorChat(currentChat.phone)}
                          disabled={actionState !== undefined}
                        >
                          {actionState === 'accept' ? 'Tomando chat...' : 'Tomar chat'}
                        </button>
                      )}
                      {isHuman && (
                        <button
                          className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                          onClick={() => void completeOperatorChat(currentChat.phone)}
                          disabled={actionState !== undefined || currentChatLock.isLockedByAnotherOperator}
                        >
                          {actionState === 'complete' ? 'Finalizando...' : 'Terminar conversación'}
                        </button>
                      )}
                      {currentChatLock.isLockedByAnotherOperator && (
                        <div className="px-3 py-2 text-xs text-rose-600 dark:text-rose-300 border-t border-gray-200 dark:border-gray-700">
                          Tomado por {currentChatLock.lockedBy}. Solo lectura.
                        </div>
                      )}
                    </>
                  );
                })()}
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={markResolved}
                  disabled={currentChatLock.isLockedByAnotherOperator}
                >
                  Marcar como atendida
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={async () => {
                    if (currentChat?.phone) {
                      await activateBot(currentChat.phone);
                      setShowMenu(false);
                      toast.success('Bot reactivado');
                    }
                  }}
                  disabled={currentChatLock.isLockedByAnotherOperator}
                  style={{ color: themeColors[theme].hex }}
                >
                  🤖 Reactivar Bot
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={deleteConversation}
                  disabled={currentChatLock.isLockedByAnotherOperator}
                >
                  Eliminar conversación
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
        )}

        {/* Mensajes */}
        {currentChat && (
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
            opacity: darkMode ? 1 : 0.98
          }}
        >
          {/* Botón Cargar Más Mensajes */}
          {currentChat && currentChat.messages && currentChat.messages.length > 0 && !messagesEndReached[currentChat.phone] && (
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
                    console.log('🔎 LOAD_MORE_START', {
                      phone,
                      visibleCount,
                      cachedCount: cachedMessages.length,
                      currentIndex
                    });
                  }
                  
                  if (cachedMessages.length > visibleCount) {
                    // Hay mensajes en caché para mostrar

                    // Aumentar la ventana visible de forma determinista: +messagesLimit mensajes más antiguos.
                    const nextVisibleCount = Math.min(cachedMessages.length, visibleCount + messagesLimit);
                    const startIndex = Math.max(0, cachedMessages.length - nextVisibleCount);
                    const nextVisibleMessages = cachedMessages.slice(startIndex);

                    if (env.enableLogging) {
                      console.log('🔎 LOAD_MORE_FROM_CACHE', {
                        phone,
                        nextVisibleCount,
                        startIndex,
                        resultingVisible: nextVisibleMessages.length
                      });
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
                        console.log('🔎 LOAD_MORE_API_PAGE', {
                          phone,
                          requestedOffset: currentOffset,
                          requestedLimit: 100,
                          fetchedCount: fetchedMessages.length
                        });
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
                            console.log('🔎 LOAD_MORE_API_RETRY', {
                              phone,
                              requestedOffset: 0,
                              requestedLimit: expandedLimit,
                              retryFetchedCount: retryMessages.length
                            });
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
                          console.log('🔎 LOAD_MORE_RESULT', {
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
                      console.error('❌ Error al cargar más mensajes:', error);
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
                            let node: any = part;
                            node = node.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
                            node = node.replace(/_([^_]+)_/g, '<em>$1</em>');
                            node = node.replace(/~([^~]+)~/g, '<del>$1</del>');
                            
                            return <span key={i} dangerouslySetInnerHTML={{ __html: node }} />;
                          });
                        };
                        
                        return (
                          <>
                            <p className="text-sm whitespace-pre-wrap">
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
        )}

        {/* Input de mensaje */}
        {currentChat && (
        <>
          <div className="relative">
            <div className="absolute left-0 right-0 bottom-full pb-2 px-4 pointer-events-none">
              <div className="flex items-center justify-center pointer-events-auto">
                <button
                  className="p-2 transition flex items-center justify-center hover:opacity-80"
                  onClick={() => setShowQuickMenu((v) => !v)}
                  disabled={currentChatLock.isLockedByAnotherOperator}
                  aria-label="Mostrar acciones rápidas"
                  style={{ color: themeColors[theme].hex }}
                >
                  <ChevronUp
                    size={18}
                    className={`transition-transform ${showQuickMenu ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${showQuickMenu && !currentChatLock.isLockedByAnotherOperator ? 'max-h-28 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'}`}
              >
                <div className="flex overflow-x-auto gap-2 pb-3 -mx-1 px-1 text-sm justify-center pointer-events-auto">
                  {[
                    { label: 'Pedir DNI', text: 'Por favor, podrías enviarme tu DNI para avanzar?' },
                    { label: 'Pedir Boleta', text: '¿Podrías mandarme la boleta o comprobante de pago?' },
                    { label: 'Enviar Ubicación', text: 'Te comparto mi ubicación para coordinar: ' },
                    { label: 'Enviar CBU', text: 'Te paso el CBU para la transferencia: ' }
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      className="whitespace-nowrap px-3 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-emerald-400 hover:text-emerald-600 transition shadow-sm"
                      disabled={currentChatLock.isLockedByAnotherOperator}
                      onClick={() => insertQuickText(chip.text)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
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
              <div className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-100 border-amber-200 dark:border-amber-800">
                <div className="text-sm">
                  La sesión de 24hs ha caducado. Envía una plantilla de reactivación para continuar.
                </div>
                <button
                  onClick={handleSendReactivationTemplate}
                  disabled={reactivating}
                  className="px-3 py-2 rounded-md text-white font-medium disabled:opacity-70"
                  style={{ backgroundColor: themeColors[theme].hex }}
                >
                  {reactivating ? 'Enviando…' : 'Enviar Plantilla de Reactivación'}
                </button>
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
        )}
      </div>

      {/* Panel lateral de información (toggleable) */}
      {showInfo && currentChat && (
        <div className={`w-80 border-l p-6 pt-12 relative overflow-y-auto ${infoPanelClosing ? 'animate-slideOutRight' : 'animate-slideInRight'}`} style={{
          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
          borderColor: darkMode ? '#374151' : '#e5e7eb'
        }}>
          <button
            aria-label="Cerrar panel"
            className="absolute top-4 right-4 p-2 rounded-full transition"
            onClick={closeInfoPanel}
            style={{ color: darkMode ? '#9ca3af' : '#4b5563', backgroundColor: darkMode ? '#374151' : '#f3f4f6' }}
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-center mb-6">
            {currentChat.profilePic ? (
              <img 
                src={currentChat.profilePic} 
                alt={currentChat.name}
                className="w-24 h-24 mx-auto rounded-full object-cover mb-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-white text-3xl font-semibold mb-4" style={{
              backgroundImage: `linear-gradient(135deg, ${themeColors[theme].hex}, #14b8a6)`,
              display: currentChat.profilePic ? 'none' : 'flex'
            }}>
              {currentChat.avatar}
            </div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveEditName()}
                  className="flex-1 px-3 py-1 rounded-md border focus:outline-none text-center font-semibold"
                  style={{
                    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                    borderColor: darkMode ? '#4b5563' : '#d1d5db',
                    color: darkMode ? '#f3f4f6' : '#111827'
                  }}
                  autoFocus
                />
                <button onClick={saveEditName} className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded">
                  <Check size={18} className="text-green-600" />
                </button>
                <button onClick={cancelEditName} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded">
                  <X size={18} className="text-red-600" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-xl font-semibold mb-1" style={{ color: darkMode ? '#f3f4f6' : '#111827' }}>{currentChat.name}</h3>
                <button onClick={startEditName} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100">
                  <Copy size={14} style={{ color: darkMode ? '#9ca3af' : '#6b7280' }} />
                </button>
              </div>
            )}
            <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>+54 9 11 1234-5678</p>
          </div>

          <div className="space-y-4">
            {/* Datos del Padrón */}
            <div className="rounded-lg p-4 border" style={{
              backgroundColor: darkMode ? '#374151' : '#f9fafb',
              borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: darkMode ? '#e5e7eb' : '#1f2937' }}>Datos del Padrón</h4>
              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-1">
                  <label style={{ color: darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Nº Padrón / Cuenta</label>
                  <input
                    type="number"
                    value={currentChat.padron?.number || ''}
                    onChange={(e) => updatePadronField('number', e.target.value)}
                    className="w-full px-3 py-2 rounded-md border focus:outline-none transition"
                    style={{
                      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                      borderColor: darkMode ? '#4b5563' : '#d1d5db',
                      color: darkMode ? '#f3f4f6' : '#111827',
                      boxShadow: 'var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 0 #0000'
                    }}
                    onFocus={(e) => e.currentTarget.style.boxShadow = `0 0 0 3px ${themeColors[theme].hex}40`}
                    onBlur={(e) => e.currentTarget.style.boxShadow = ''}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ color: darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Ubicación</label>
                  <input
                    type="text"
                    value={currentChat.padron?.location || ''}
                    onChange={(e) => updatePadronField('location', e.target.value)}
                    className="w-full px-3 py-2 rounded-md border focus:outline-none transition"
                    style={{
                      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                      borderColor: darkMode ? '#4b5563' : '#d1d5db',
                      color: darkMode ? '#f3f4f6' : '#111827'
                    }}
                    onFocus={(e) => e.currentTarget.style.boxShadow = `0 0 0 3px ${themeColors[theme].hex}40`}
                    onBlur={(e) => e.currentTarget.style.boxShadow = ''}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ color: darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Estado Deuda</label>
                  <select
                    value={currentChat.padron?.debtStatus || 'Al Día'}
                    onChange={(e) => updatePadronField('debtStatus', e.target.value)}
                    className="w-full px-3 py-2 rounded-md border focus:outline-none transition"
                    style={{
                      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                      borderColor: darkMode ? '#4b5563' : '#d1d5db',
                      color: darkMode ? '#f3f4f6' : '#111827'
                    }}
                    onFocus={(e) => e.currentTarget.style.boxShadow = `0 0 0 3px ${themeColors[theme].hex}40`}
                    onBlur={(e) => e.currentTarget.style.boxShadow = ''}
                  >
                    <option value="Al Día">🟢 Al Día</option>
                    <option value="Con Deuda">🔴 Con Deuda</option>
                    <option value="Plan de Pago">🟡 Plan de Pago</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notas Internas */}
            <div className="border rounded-lg p-4" style={{
              backgroundColor: darkMode ? '#374151' : '#fffbeb',
              borderColor: darkMode ? '#d97706' : '#fcd34d'
            }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold" style={{ color: darkMode ? '#fbbf24' : '#92400e' }}>Notas Privadas 🔒</h4>
                <span className="text-xs" style={{ color: darkMode ? '#f59e0b' : '#b45309' }}>Solo internos</span>
              </div>
              <div className="space-y-2 mb-3">
                {(currentChat.notes || []).map((note) => (
                  <div key={note.id} className="border rounded-md p-2 flex justify-between items-start transition" style={{
                    backgroundColor: darkMode ? '#1f2937' : '#fef3c7',
                    borderColor: darkMode ? '#92400e' : '#fcd34d',
                    color: darkMode ? '#fbbf24' : '#92400e'
                  }}>
                    <span className="text-sm leading-tight">{note.text}</span>
                    <button
                      className="p-1 rounded-md transition"
                      onClick={() => deleteNote(note.id)}
                      style={{ backgroundColor: darkMode ? '#374151' : '#fed7aa', color: darkMode ? '#fbbf24' : '#b45309' }}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
                {(currentChat.notes || []).length === 0 && (
                  <p className="text-sm" style={{ color: darkMode ? '#f59e0b' : '#b45309' }}>Sin notas aún.</p>
                )}
              </div>
              <div className="space-y-2">
                <textarea
                  placeholder="Nueva nota privada"
                  value={noteDrafts[currentChat.id] || ''}
                  onChange={(e) => setNoteDrafts(prev => ({ ...prev, [currentChat.id]: e.target.value }))}
                  className="w-full h-16 px-3 py-2 rounded-md border focus:outline-none transition"
                  style={{
                    backgroundColor: darkMode ? '#1f2937' : '#fffbeb',
                    borderColor: darkMode ? '#92400e' : '#fcd34d',
                    color: darkMode ? '#9ca3af' : '#6b7280'
                  }}
                  onFocus={(e) => e.currentTarget.style.boxShadow = `0 0 0 3px ${themeColors[theme].hex}40`}
                  onBlur={(e) => e.currentTarget.style.boxShadow = ''}
                />
                <button
                  className="w-full px-3 py-2 rounded-md text-white font-semibold transition"
                  onClick={addNote}
                  style={{ backgroundColor: themeColors[theme].hex }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Guardar Nota
                </button>
              </div>
            </div>

            <div className="rounded-lg p-4 border" style={{
              backgroundColor: darkMode ? '#374151' : '#f9fafb',
              borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-2" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Estado</h4>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${currentChat.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="text-sm" style={{ color: darkMode ? '#d1d5db' : '#4b5563' }}>
                  {currentChat.status === 'online' ? 'En línea' : 'Desconectado'}
                </span>
              </div>
            </div>

            <div className="rounded-lg p-4 border" style={{
              backgroundColor: darkMode ? '#374151' : '#f9fafb',
              borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Etiquetas</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs transition" style={{
                  backgroundColor: darkMode ? '#3b82f620' : '#dbeafe',
                  color: darkMode ? '#60a5fa' : '#1e40af'
                }}>Cliente nuevo</span>
                <span className="px-3 py-1 rounded-full text-xs transition" style={{
                  backgroundColor: darkMode ? '#a855f720' : '#e9d5ff',
                  color: darkMode ? '#d8b4fe' : '#6b21a8'
                }}>Consulta</span>
              </div>
            </div>

            <div className="rounded-lg p-4 border" style={{
              backgroundColor: darkMode ? '#374151' : '#f9fafb',
              borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-2" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Información</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Primera vez:</span>
                  <span style={{ color: darkMode ? '#e5e7eb' : '#111827' }}>Hace 2 días</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Mensajes:</span>
                  <span style={{ color: darkMode ? '#e5e7eb' : '#111827' }}>{currentChat.messages.length}</span>
                </div>
              </div>
            </div>

            {/* Archivos Multimedia */}
            <div className="rounded-lg p-4 border" style={{
              backgroundColor: darkMode ? '#374151' : '#f9fafb',
              borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <button
                onClick={() => setShowMediaMenu(!showMediaMenu)}
                className="w-full flex items-center justify-between mb-3"
              >
                <h4 className="text-sm font-semibold" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Archivos Multimedia</h4>
                <ChevronUp 
                  size={18} 
                  className={`transition-transform ${showMediaMenu ? 'rotate-180' : ''}`}
                  style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                />
              </button>

              {showMediaMenu && (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'images', 'videos', 'files', 'urls'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setMediaFilter(filter)}
                        className="px-3 py-1 rounded-full text-xs transition"
                        style={{
                          backgroundColor: mediaFilter === filter ? themeColors[theme].hex : (darkMode ? '#4b5563' : '#e5e7eb'),
                          color: mediaFilter === filter ? '#ffffff' : (darkMode ? '#d1d5db' : '#4b5563')
                        }}
                      >
                        {filter === 'all' ? 'Todos' : filter === 'images' ? 'Imágenes' : filter === 'videos' ? 'Videos' : filter === 'files' ? 'Archivos' : 'URLs'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                    {getMediaMessages().map((msg) => (
                      <div 
                        key={msg.id}
                        className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition border"
                        style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }}
                        onClick={() => {
                          if (msg.type === 'image') setLightboxImage(msg.fileUrl);
                        }}
                      >
                        {msg.type === 'image' ? (
                          <img src={msg.fileUrl} alt={msg.text} className="w-full h-full object-cover" />
                        ) : msg.type === 'video' ? (
                          <div className="relative w-full h-full bg-black">
                            <video 
                              src={msg.fileUrl} 
                              className="w-full h-full object-cover"
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play size={24} className="text-white" />
                            </div>
                          </div>
                        ) : msg.type === 'file' ? (
                          (() => {
                            const isPdf = msg.filename?.toLowerCase().endsWith('.pdf');
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.filename || '');
                            
                            if (isPdf && msg.fileUrl) {
                              return (
                                <div className="relative w-full h-full">
                                  <iframe 
                                    src={`${msg.fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0`}
                                    className="w-full h-full pointer-events-none"
                                    style={{ transform: 'scale(1.5)', transformOrigin: 'top left' }}
                                  />
                                  <div className="absolute inset-0 flex items-end justify-center pb-2 bg-gradient-to-t from-black/60 to-transparent">
                                    <span className="text-xs text-white font-medium">PDF</span>
                                  </div>
                                </div>
                              );
                            } else if (isImage && msg.fileUrl) {
                              return <img src={msg.fileUrl} alt={msg.text} className="w-full h-full object-cover" />;
                            } else {
                              return (
                                <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center p-2">
                                  <FileText size={24} className="text-emerald-600 mb-1" />
                                  <span className="text-xs text-center truncate w-full" style={{ color: darkMode ? '#d1d5db' : '#4b5563' }}>
                                    {msg.filename}
                                  </span>
                                </div>
                              );
                            }
                          })()
                        ) : (
                          <div className="w-full h-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center p-2">
                            <span className="text-xs text-center break-all text-blue-600 dark:text-blue-300">
                              {msg.text.match(/https?:\/\/[^\s]+/)?.[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {getMediaMessages().length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                      No hay archivos multimedia
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg animate-slideInUp"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'chat' && (
            <div className="py-1 w-56">
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => { selectChatById(contextMenu.targetId); setChatClosed(false); setContextMenu({ visible: false, x: 0, y: 0, type: null }); }}>Abrir</button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => markChatReadById(contextMenu.targetId!)}>Marcar como leída</button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => archiveConversationById(contextMenu.targetId!)}>Archivar</button>
              <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => deleteConversationById(contextMenu.targetId!)}>Eliminar</button>
            </div>
          )}
          {contextMenu.type === 'message' && (() => {
            const msg = selectedChat !== null ? conversationsState[selectedChat].messages.find((m) => m.id === contextMenu.targetId) : null;
            const isOwnMessage = msg?.sent === true;
            return (
              <div className="py-1 w-48">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => replyToMessage(contextMenu.targetId!)}>Responder</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => copyMessageById(contextMenu.targetId!)}>Copiar</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => forwardMessage(contextMenu.targetId!)}>Reenviar</button>
                {isOwnMessage && (
                  <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => startEditMessage(contextMenu.targetId!)}>Editar</button>
                )}
                <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => deleteMessageById(contextMenu.targetId!)}>Eliminar</button>
              </div>
            );
          })()}
          {contextMenu.type === 'blank' && (
            <div className="py-1 w-56">
              {!selectionMode ? (
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={startSelection}>Seleccionar mensajes</button>
              ) : (
                <>
                  <button
                    className={`w-full text-left px-3 py-2 ${selectedMessageIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    onClick={() => { if (selectedMessageIds.length > 0) deleteSelectedMessages(); }}
                  >
                    Eliminar seleccionados
                  </button>
                  <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={exitSelection}>Salir de selección</button>
                </>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => { closeSelectedChat(); setChatClosed(true); setContextMenu({ visible: false, x: 0, y: 0, type: null }); }}>Cerrar chat</button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 animate-slideInUp">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Confirmación</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                onClick={confirmDialog.onConfirm}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div ref={preferencesRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-h-96 overflow-y-auto animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Preferencias</h2>
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                onClick={() => setShowPreferences(false)}
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Theme Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Tema de Color</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(themeColors).map(([key, colors]) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      theme === key
                        ? 'border-gray-900 dark:border-gray-100'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    style={{ backgroundColor: colors.hex }}
                    title={key.charAt(0).toUpperCase() + key.slice(1)}
                  >
                    {theme === key && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="mb-6 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Modo Oscuro</label>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: darkMode ? themeColors[theme].hex : '#d1d5db'
                }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: darkMode ? 'translateX(24px)' : 'translateX(4px)'
                  }}
                />
              </button>
            </div>

            {/* Background Pattern Toggle */}
            <div className="mb-6 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Patrón de Fondo</label>
              <button
                onClick={() => setBackgroundPattern(!backgroundPattern)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: backgroundPattern ? themeColors[theme].hex : '#d1d5db'
                }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: backgroundPattern ? 'translateX(24px)' : 'translateX(4px)'
                  }}
                />
              </button>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Sonidos</label>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: soundEnabled ? themeColors[theme].hex : '#d1d5db'
                }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: soundEnabled ? 'translateX(24px)' : 'translateX(4px)'
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nueva Conversación Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nueva Conversación</h2>
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                onClick={() => {
                  setShowNewConversation(false);
                  setNewConvName('');
                  setNewConvPhone('');
                  setNewConvMessage('');
                }}
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nombre</label>
                <input
                  type="text"
                  value={newConvName}
                  onChange={(e) => setNewConvName(e.target.value)}
                  placeholder="Ingresa el nombre"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={newConvPhone}
                  onChange={(e) => setNewConvPhone(e.target.value)}
                  placeholder="+54 9 11 1234-5678"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Mensaje inicial (opcional)</label>
                <textarea
                  value={newConvMessage}
                  onChange={(e) => setNewConvMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>

              <button
                onClick={createNewConversation}
                disabled={!newConvName.trim() || !newConvPhone.trim()}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  newConvName.trim() && newConvPhone.trim()
                    ? `bg-${themeColors[theme].primary} hover:opacity-90 text-white`
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                style={newConvName.trim() && newConvPhone.trim() ? { backgroundColor: themeColors[theme].hex } : {}}
              >
                Crear Conversación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversaciones Archivadas Modal */}
      {showArchived && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-[500px] max-h-[600px] animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conversaciones Archivadas</h2>
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                onClick={() => setShowArchived(false)}
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[450px] space-y-2">
              {archivedConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No hay conversaciones archivadas
                </div>
              ) : (
                archivedConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {conv.profilePic ? (
                        <img 
                          src={conv.profilePic} 
                          alt={conv.name}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium" style={{ 
                        backgroundColor: themeColors[theme].hex,
                        display: conv.profilePic ? 'none' : 'flex'
                      }}>
                        {conv.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{conv.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => unarchiveConversationById(conv.id)}
                      className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                    >
                      Desarchivar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reenvío */}
      {showForwardMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-[400px] max-h-[500px] animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reenviar mensaje a:</h2>
              <button
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                onClick={() => { setShowForwardMenu(false); setForwardMessageId(null); }}
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[350px] space-y-2">
              {conversationsState.filter(c => !c.archived).map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => confirmForward(conv.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: themeColors[theme].hex }}>
                    {conv.avatar}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{conv.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Lightbox Modal para imágenes */}
      {lightboxImage && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fadeIn"
          style={{ backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' }}
          onClick={() => { setLightboxImage(null); setLightboxMessageId(null); setImageZoom(1); setImageRotation(0); }}
        >
          <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg p-2 backdrop-blur-sm"
            style={{ backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setImageZoom(Math.max(0.5, imageZoom - 0.25)); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: darkMode ? '#f3f4f6' : '#111827', backgroundColor: 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Alejar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <span className="text-sm font-medium min-w-[60px] text-center" style={{ color: darkMode ? '#f3f4f6' : '#111827' }}>{Math.round(imageZoom * 100)}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setImageZoom(Math.min(3, imageZoom + 0.25)); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Acercar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <div className="w-px h-6 bg-white/20"></div>
            <button
              onClick={(e) => { e.stopPropagation(); setImageRotation((imageRotation - 90) % 360); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Rotar izquierda"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"></path>
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setImageRotation((imageRotation + 90) % 360); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Rotar derecha"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"></path>
              </svg>
            </button>
            <div className="w-px h-6" style={{ backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }}></div>
            <a
              href={lightboxImage}
              download
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg transition-colors"
              style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Descargar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </a>
          </div>

          {/* Botones de acciones de mensaje */}
          {lightboxMessageId && (
            <div 
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1 sm:gap-2 rounded-lg p-2 backdrop-blur-sm max-w-[90vw]"
              style={{ backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); replyFromLightbox(lightboxMessageId); }}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm"
                style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Responder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4"></polyline>
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Responder</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToMessage(lightboxMessageId); }}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm"
                style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Ir al mensaje"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span className="font-medium hidden sm:inline">Ir al mensaje</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); forwardFromLightbox(lightboxMessageId); }}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm"
                style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Reenviar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 14 20 9 15 4"></polyline>
                  <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Reenviar</span>
              </button>
            </div>
          )}

          <button
            onClick={() => { setLightboxImage(null); setLightboxMessageId(null); setImageZoom(1); setImageRotation(0); }}
            className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
            style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={24} />
          </button>
          <img 
            src={lightboxImage} 
            alt="full-resolution" 
            className="max-w-[90vw] sm:max-w-4xl max-h-[80vh] sm:max-h-screen object-contain animate-slideInUp transition-transform duration-200" 
            style={{ 
              transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
              cursor: imageZoom > 1 ? 'move' : 'default'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Reproductor de Video Modal */}
      {lightboxVideo && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fadeIn"
          style={{ backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' }}
          onClick={() => { 
            setLightboxVideo(null); 
            setLightboxMessageId(null); 
            setVideoPlaying(false);
            setVideoProgress(0);
            setVideoCurrentTime(0);
          }}
        >
          <button
            onClick={() => { 
              setLightboxVideo(null); 
              setLightboxMessageId(null);
              setVideoPlaying(false);
              setVideoProgress(0);
              setVideoCurrentTime(0);
            }}
            className="absolute top-4 right-4 p-2 rounded-lg transition-colors z-10"
            style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={24} />
          </button>
          
          {/* Botones de acciones de mensaje */}
          {lightboxMessageId && (
            <div 
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1 sm:gap-2 rounded-lg p-2 backdrop-blur-sm z-10 max-w-[90vw]"
              style={{ backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); replyFromLightbox(lightboxMessageId); }}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm"
                style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Responder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4"></polyline>
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Responder</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToMessage(lightboxMessageId); }}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm"
                style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Ir al mensaje"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span className="font-medium hidden sm:inline">Ir al mensaje</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); forwardFromLightbox(lightboxMessageId); }}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm"
                style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Reenviar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 14 20 9 15 4"></polyline>
                  <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Reenviar</span>
              </button>
            </div>
          )}
          
          <div className="w-[90vw] sm:w-full max-w-5xl mx-4 animate-slideInUp" onClick={(e) => e.stopPropagation()}>
            <div className="relative rounded-lg overflow-hidden shadow-2xl bg-black">
              <video 
                ref={videoRef}
                src={lightboxVideo}
                className="w-full"
                style={{ maxHeight: '75vh' }}
                onClick={() => setVideoPlaying(!videoPlaying)}
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  setVideoCurrentTime(video.currentTime);
                  setVideoProgress((video.currentTime / video.duration) * 100);
                }}
                onLoadedMetadata={(e) => {
                  setVideoDuration(e.currentTarget.duration);
                }}
                onEnded={() => setVideoPlaying(false)}
              />
              
              {/* Controles personalizados */}
              <div 
                className="absolute bottom-0 left-0 right-0 p-3 backdrop-blur-sm transition-opacity"
                style={{ backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Barra de progreso */}
                <div 
                  className="w-full h-1.5 rounded-full mb-3 cursor-pointer group"
                  style={{ backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                  onClick={(e) => {
                    if (!videoRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    videoRef.current.currentTime = percent * videoRef.current.duration;
                  }}
                >
                  <div 
                    className="h-full rounded-full transition-all relative"
                    style={{ 
                      width: `${videoProgress}%`,
                      backgroundColor: themeColors[theme].hex
                    }}
                  >
                    <div 
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: themeColors[theme].hex }}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  <button
                    onClick={() => {
                      if (!videoRef.current) return;
                      if (videoPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current.play();
                      }
                      setVideoPlaying(!videoPlaying);
                    }}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {videoPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  
                  {/* Tiempo */}
                  <span className="text-xs font-medium" style={{ color: darkMode ? '#f3f4f6' : '#111827' }}>
                    {Math.floor(videoCurrentTime / 60)}:{String(Math.floor(videoCurrentTime % 60)).padStart(2, '0')} / {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, '0')}
                  </span>
                  
                  <div className="flex-1" />
                  
                  {/* Volumen */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!videoRef.current) return;
                        const newMuted = !videoMuted;
                        videoRef.current.muted = newMuted;
                        setVideoMuted(newMuted);
                      }}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {videoMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5 6 9H2v6h4l5 4V5Z"></path>
                          <line x1="22" x2="16" y1="9" y2="15"></line>
                          <line x1="16" x2="22" y1="9" y2="15"></line>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 5 6 9H2v6h4l5 4V5Z"></path>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                        </svg>
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={videoVolume}
                      onChange={(e) => {
                        if (!videoRef.current) return;
                        const vol = parseFloat(e.target.value);
                        videoRef.current.volume = vol;
                        setVideoVolume(vol);
                        setVideoMuted(vol === 0);
                      }}
                      className="w-20 h-1 rounded-full cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${themeColors[theme].hex} 0%, ${themeColors[theme].hex} ${videoVolume * 100}%, ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} ${videoVolume * 100}%, ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} 100%)`
                      }}
                    />
                  </div>
                  
                  {/* Pantalla completa */}
                  <button
                    onClick={() => {
                      if (!videoRef.current) return;
                      if (document.fullscreenElement) {
                        document.exitFullscreen();
                      } else {
                        videoRef.current.requestFullscreen();
                      }
                    }}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: darkMode ? '#f3f4f6' : '#111827' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
                      <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
                      <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
                      <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Previsualizador de Archivos (PDF, Word, etc.) */}
      {lightboxFile && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 animate-fadeIn"
          style={{ backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(0, 0, 0, 0.95)' }}
          onClick={() => setLightboxFile(null)}
        >
          <button
            onClick={() => setLightboxFile(null)}
            className="absolute top-4 right-4 p-2 rounded-lg transition-colors z-10"
            style={{ color: '#f3f4f6' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={24} />
          </button>
          
          <div className="w-[95vw] h-[90vh] rounded-lg overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {lightboxFile.url.toLowerCase().endsWith('.pdf') ? (
              <iframe 
                src={lightboxFile.url}
                className="w-full flex-1"
                title="PDF Viewer"
              />
            ) : lightboxFile.url.match(/\.(docx?|xlsx?|pptx?)$/i) ? (
              <iframe 
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(lightboxFile.url)}`}
                className="w-full flex-1"
                title="Document Viewer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <div className="text-center text-gray-400">
                  <FileText size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">{lightboxFile.filename}</p>
                  <a 
                    href={lightboxFile.url}
                    download
                    className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Descargar archivo
                  </a>
                </div>
              </div>
            )}
            
            <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
              <span className="text-white text-sm">{lightboxFile.filename}</span>
              <a 
                href={lightboxFile.url}
                download
                className="text-white p-2 hover:bg-white/10 rounded-lg transition"
                title="Descargar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu para URLs */}
      {urlContextMenu.visible && (
        <div
          className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 py-1 min-w-48"
          style={{
            top: `${urlContextMenu.y}px`,
            left: `${urlContextMenu.x}px`
          }}
          onMouseLeave={() => setUrlContextMenu({ ...urlContextMenu, visible: false })}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            onClick={() => {
              window.open(urlContextMenu.url, '_blank');
              setUrlContextMenu({ ...urlContextMenu, visible: false });
            }}
          >
            Abrir en nueva pestaña
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            onClick={() => {
              navigator.clipboard.writeText(urlContextMenu.url);
              setUrlContextMenu({ ...urlContextMenu, visible: false });
              toast.success('URL copiada al portapapeles');
            }}
          >
            Copiar URL
          </button>
          <a
            href={urlContextMenu.url}
            download
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            onClick={() => setUrlContextMenu({ ...urlContextMenu, visible: false })}
          >
            Descargar
          </a>
        </div>
      )}
    </div>
  );
}

