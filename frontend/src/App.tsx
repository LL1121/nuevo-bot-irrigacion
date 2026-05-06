import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Paperclip, Smile, Check, CheckCheck, X, Image as ImageIcon, FileText, Video, Music, Moon, Sun, Trash, Play, Pause, Copy, Volume2, Volume1, VolumeX } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import axios from 'axios';
import type { Socket } from 'socket.io-client';
import { useVirtualizer } from '@tanstack/react-virtual';
import Login from './components/Login';
import { SidebarContainer } from './components/SidebarContainer';
import { ChatMainHeader } from './components/ChatMainHeader';
import { ChatMessagesPane } from './components/ChatMessagesPane';
import { ChatComposerPane } from './components/ChatComposerPane';
import { toast, Toaster } from 'sonner';
import { env } from './config/env';
import { setupAxiosInterceptors } from './utils/axiosInterceptor';
import { auth } from './config/auth';
import { parseTimestamp, formatMessageTime, formatChatHeaderTime, isSessionExpired } from './utils/dateTime';
import { sortAndDedupeMessages } from './utils/messageOrder';
import { appendIncomingMessage, mergeMessageBatches } from './services/messageQueue';
import { consumePendingByMatch, registerPendingMessage, removePendingMessage } from './services/optimisticUpdates';
import {
  useConversationsState,
  useSetConversationsState,
  useSelectedChatIndex,
  useSetSelectedChat,
  useAllMessagesCache,
  useSetAllMessagesCache,
  useMessagesLoading,
  useSetMessagesLoading,
  useMessagesEndReached,
  useSetMessagesEndReached,
  useCurrentMessageIndex,
  useSetCurrentMessageIndex,
  useTypingUsers,
  useSetTypingUsers,
  useIsLoadingMoreMessages,
  useSetIsLoadingMoreMessages,
  useMarkConversationReadById,
  useSetConversationArchivedById,
  useDeleteConversationByIdFromStore,
  useResetChatStore
} from './stores/chatStoreSelectors';
import { useSocket } from './contexts/SocketProvider';
import { logger } from './utils/logger';
import { formatChatMarkdownToSafeHtml } from './utils/sanitize';
import { getTemplateDisplayText, normalizeMessageContent } from './services/messageParser';
import { useChatSelection } from './hooks/useChatSelection';
import { useChatMutations } from './hooks/useChatMutations';
import { trackAction, trackErrorRecovery, trackSocketEvent } from './utils/monitoring';
import { applyMessageCachePolicy } from './utils/messageCachePolicy';
import type { ChatMessage, Conversation, RawApiMessage, RawSocketMessage } from './types/chat';
import type { OperadorInfo } from './config/auth';
import type { MediaFilter } from './components/InfoPanel';
import { InfoPanel } from './components/InfoPanel';
import { normalizePhoneKey, phonesMatch } from './utils/phoneFormat';

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

type Subdelegacion = {
  id: string | number;
  nombre: string;
  codigo?: string;
  [key: string]: unknown;
};

type TicketTransferredPayload = {
  telefono?: string;
  cliente_telefono?: string;
  ticket_id?: string | number;
  ticketId?: string | number;
  subdelegacion_origen_id?: string | number;
  subdelegacion_destino_id?: string | number;
  subdelegacionDestinoId?: string | number;
  operador?: string;
  motivo?: string | null;
  transferred_at?: string;
  transferredAt?: string;
};

type AuthMeResponse = {
  id?: string | number;
  username?: string;
  email?: string;
  role?: string;
  subdelegacion_id?: string | number | null;
  subdelegacion_nombre?: string | null;
  subdelegacion_codigo?: string | null;
  permissions?: {
    queueScope?: string;
    [key: string]: unknown;
  } | string[];
};

// Configurar Axios base
axios.defaults.baseURL = env.apiUrl;
axios.defaults.timeout = env.requestTimeoutMs;

// Configurar interceptores de axios (refresh automático + reintentos)
setupAxiosInterceptors(axios);

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
  const { socket, refreshSocketAuth } = useSocket();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => auth.isAuthenticated());

  // Theme color mapping
  const themeColors: Record<string, { primary: string; gradient: string; light: string; hex: string }> = {
    emerald: { primary: 'emerald-600', gradient: 'from-emerald-500 to-teal-500', light: 'emerald-50', hex: '#10b981' },
    blue: { primary: 'blue-600', gradient: 'from-blue-500 to-cyan-500', light: 'blue-50', hex: '#3b82f6' },
    violet: { primary: 'violet-600', gradient: 'from-violet-500 to-purple-500', light: 'violet-50', hex: '#7c3aed' },
    amber: { primary: 'amber-600', gradient: 'from-amber-500 to-orange-500', light: 'amber-50', hex: '#d97706' }
  };

  const conversationsState = useConversationsState();
  const setConversationsState = useSetConversationsState();
  const selectedChat = useSelectedChatIndex();
  const setSelectedChat = useSetSelectedChat();
  const allMessagesCache = useAllMessagesCache();
  const setAllMessagesCache = useSetAllMessagesCache();
  const messagesLoading = useMessagesLoading();
  const setMessagesLoading = useSetMessagesLoading();
  const messagesEndReached = useMessagesEndReached();
  const setMessagesEndReached = useSetMessagesEndReached();
  const currentMessageIndex = useCurrentMessageIndex();
  const setCurrentMessageIndex = useSetCurrentMessageIndex();
  const typingUsers = useTypingUsers();
  const setTypingUsers = useSetTypingUsers();
  const isLoadingMoreMessages = useIsLoadingMoreMessages();
  const setIsLoadingMoreMessages = useSetIsLoadingMoreMessages();
  const markConversationReadById = useMarkConversationReadById();
  const setConversationArchivedById = useSetConversationArchivedById();
  const deleteConversationByIdFromStore = useDeleteConversationByIdFromStore();
  const resetChatStore = useResetChatStore();

  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem('pref_darkMode') === 'true'; } catch { return false; }
  });
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('pref_theme') || 'emerald'; } catch { return 'emerald'; }
  });
  const [backgroundPattern, setBackgroundPattern] = useState<boolean>(() => {
    try { const v = localStorage.getItem('pref_backgroundPattern'); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('pref_soundEnabled') === 'true'; } catch { return false; }
  });
  const [fontFamily, setFontFamily] = useState<string>(() => {
    try { return localStorage.getItem('pref_fontFamily') || 'default'; } catch { return 'default'; }
  });
  const [messageFontSize, setMessageFontSize] = useState<number>(() => {
    try { const v = localStorage.getItem('pref_messageFontSize'); return v ? Number(v) : 14; } catch { return 14; }
  });
  const [showPreferences, setShowPreferences] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);

  // Persist preferences to localStorage whenever they change
  useEffect(() => { try { localStorage.setItem('pref_darkMode', String(darkMode)); } catch {} }, [darkMode]);
  useEffect(() => { try { localStorage.setItem('pref_theme', theme); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem('pref_backgroundPattern', String(backgroundPattern)); } catch {} }, [backgroundPattern]);
  useEffect(() => { try { localStorage.setItem('pref_soundEnabled', String(soundEnabled)); } catch {} }, [soundEnabled]);
  useEffect(() => { try { localStorage.setItem('pref_fontFamily', fontFamily); } catch {} }, [fontFamily]);
  useEffect(() => { try { localStorage.setItem('pref_messageFontSize', String(messageFontSize)); } catch {} }, [messageFontSize]);
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
  const [reactivationTema, setReactivationTema] = useState<string>('');
  const [pendingOperatorTickets, setPendingOperatorTickets] = useState<OperatorHandoffTicket[]>([]);
  const [handoffActionLoading, setHandoffActionLoading] = useState<Record<string, 'accept' | 'complete' | undefined>>({});
  const [operatorProfile, setOperatorProfile] = useState<OperadorInfo | null>(() => auth.getOperador());
  const [newChatAnimations, setNewChatAnimations] = useState<Record<string, boolean>>({});
  const newChatAnimationTimersRef = useRef<Record<string, number>>({});

  // Estados para transferencia de chats hacia otras subdelegaciones
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [subdelegaciones, setSubdelegaciones] = useState<Subdelegacion[]>([]);
  const [subdelegacionesLoading, setSubdelegacionesLoading] = useState(false);
  const [selectedSubdelegation, setSelectedSubdelegation] = useState<string>('');
  const [transferMotive, setTransferMotive] = useState('');

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
      const token = auth.getToken();
      const primerNombre = (currentChat.name || '').split(' ')[0] || 'cliente';
      const tema = reactivationTema.trim() || 'su consulta de Irrigación';
      await axios.post(`/api/chats/${currentChat.phone}/reactivate`, {
        templateName: 'plantilla_reactivacion',
        languageCode: 'es_AR',
        components: [
          {
            type: 'body',
            parameters: [
              // Variables posicionales de la plantilla:
              // 1) nombre del cliente, 2) tema.
              { type: 'text', text: primerNombre },
              { type: 'text', text: tema }
            ]
          }
        ]
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const templateText = getTemplateDisplayText('plantilla_reactivacion');
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
      setReactivationTema('');
      // Plantilla de reactivación enviada
      toast.success('Plantilla de reactivación enviada');
    } catch (err) {
      logger.error(err, { phase: 'reactivationTemplate' });
      toast.error('No se pudo enviar la plantilla de reactivación');
    } finally {
      setReactivating(false);
    }
  };

  const getOperatorName = () => {
    const operador = operatorProfile || auth.getOperador();
    if (!operador) return undefined;
    const candidate = [operador.username, operador.nombre, operador.email].find((value) => typeof value === 'string' && value.trim().length > 0);
    return candidate?.trim();
  };

  const normalizeOperatorIdentity = (value?: string | null) => {
    return (value || '').trim().toLowerCase();
  };

  const currentOperatorName = getOperatorName() || 'Panel Frontend';

  const triggerNewChatAnimation = (phone?: string) => {
    const phoneKey = normalizePhoneKey(phone);
    if (!phoneKey) return;

    setNewChatAnimations((prev) => ({ ...prev, [phoneKey]: true }));

    const existingTimer = newChatAnimationTimersRef.current[phoneKey];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    newChatAnimationTimersRef.current[phoneKey] = window.setTimeout(() => {
      setNewChatAnimations((prev) => {
        if (!prev[phoneKey]) return prev;
        const next = { ...prev };
        delete next[phoneKey];
        return next;
      });
      delete newChatAnimationTimersRef.current[phoneKey];
    }, 650);
  };

  useEffect(() => {
    return () => {
      Object.values(newChatAnimationTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      newChatAnimationTimersRef.current = {};
    };
  }, []);

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
    if (!canTakeOperatorQueue) {
      toast.warning('Sin permiso para tomar chats', {
        description: 'Tu perfil actual no permite tomar tickets de la cola.'
      });
      return;
    }

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
      const token = auth.getToken();
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

      logger.error(error, { phase: 'acceptOperatorTicket' });
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
      const token = auth.getToken();
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

      toast.success('Conversación finalizada');
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

      logger.error(error, { phase: 'completeOperatorTicket' });
      toast.error('No se pudo finalizar la conversación', {
        description: 'Reintenta en unos segundos.'
      });
    } finally {
      setHandoffActionLoading((prev) => ({ ...prev, [phoneKey]: undefined }));
    }
  };

  const handleTransferChat = async () => {
    if (!currentChat || !selectedSubdelegation) {
      toast.error('Por favor selecciona una subdelegación destino');
      return;
    }

    const chat = conversationsState.find((item) => phonesMatch(item.phone, currentChat.phone));
    const lockInfo = getChatLockInfo(chat || null);
    if (lockInfo.isLockedByAnotherOperator) {
      toast.warning('No puedes transferir este chat', {
        description: `Está siendo atendido por ${lockInfo.lockedBy}.`
      });
      return;
    }

    setTransferLoading(true);
    try {
      const token = auth.getToken();
      const response = await axios.post(
        `/api/tickets/${encodeURIComponent(currentChat.phone)}/transfer`,
        {
          subdelegacion_id: selectedSubdelegation,
          ...(transferMotive ? { motivo: transferMotive } : {})
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      // Remover de la cola actual
      removePendingTicket({ phone: currentChat.phone });

      // Remover del listado de conversaciones
      setConversationsState(prev => prev.filter(c => !phonesMatch(c.phone, currentChat.phone)));

      // Cerrar dialog y limpiar campos
      setShowTransferDialog(false);
      setSelectedSubdelegation('');
      setTransferMotive('');

      // Cerrar el chat actual
      closeSelectedChat();

      toast.success('Chat transferido correctamente', {
        description: 'El chat ha sido transferido a la subdelegación seleccionada.'
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 409) {
        // El estado del chat cambió concurrentemente
        setShowTransferDialog(false);
        setSelectedSubdelegation('');
        setTransferMotive('');

        // Refrescar la cola
        try {
          const token = auth.getToken();
          const response = await axios.get('/api/tickets', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          const tickets = (response.data?.data || response.data || []) as OperatorHandoffTicket[];
          setPendingOperatorTickets(tickets);
        } catch {
          logger.warn('Error refrescando cola después de transferencia conflictiva');
        }

        toast.warning('Transferencia bloqueada', {
          description: 'El estado del chat cambió en otro panel. Recarga la lista.'
        });
        return;
      }

      logger.error(error, { phase: 'transferChat' });
      toast.error('No se pudo transferir el chat', {
        description: 'Verifica los datos e intenta nuevamente.'
      });
    } finally {
      setTransferLoading(false);
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

const normalizeQueueScope = (scope?: string | null) => (scope || '').trim().toUpperCase();

const canViewQueueByScope = (scope?: string | null) => {
  const normalized = normalizeQueueScope(scope);
  if (!normalized) return true;
  return !['NONE', 'NO_QUEUE', 'DISABLED', 'OFF'].includes(normalized);
};

const canTakeQueueByScope = (scope?: string | null) => {
  const normalized = normalizeQueueScope(scope);
  if (!normalized) return true;
  return !['READ_ONLY', 'VIEW_ONLY', 'NONE', 'NO_QUEUE', 'DISABLED', 'OFF'].includes(normalized);
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
    logger.warn('No se pudo reproducir sonido', e);
  }
};

// Función para mostrar notificación
const showNotification = (title: string, options: NotificationOptions = {}) => {
  if (!('Notification' in window)) {
    logger.warn('Este navegador no soporta notificaciones');
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
        logger.info('Notificaciones push habilitadas');
      }
    });
  };

  const handleLogout = async () => {
    trackAction('logout');
    try {
      // Intentar logout en el backend (no bloquea si falla)
      await axios.post('/api/auth/logout').catch(err => {
        if (env.enableLogging) {
          logger.warn('Logout en backend falló', err.message);
        }
      });
    } catch (err) {
      if (env.enableLogging) {
        logger.warn('Error durante logout', err);
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

    const token = auth.getToken();
    refreshSocketAuth();

    const loadAuthProfile = async () => {
      try {
        const response = await axios.get('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        const profile = (response.data?.data || response.data || {}) as AuthMeResponse;
        const mappedProfile: OperadorInfo = {
          ...profile,
          nombre: typeof profile.username === 'string' ? profile.username : undefined,
          email: profile.email,
          permissions: profile.permissions
        };

        auth.setOperador(mappedProfile);
        setOperatorProfile(mappedProfile);
      } catch (error: unknown) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 || status === 403) {
          handleLogout();
          return;
        }
        logger.error(error, { phase: 'authMe' });
      }
    };

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
          description: 'La plataforma volvió a estar disponible.'
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
        title: 'Conexión perdida',
        description: 'Reconectando automáticamente. Los cambios se sincronizarán cuando se restaure la conexión.'
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

        if (!auth.getToken() || authFailureCountRef.current >= 2) {
          handleLogout();
          return;
        }

        refreshSocketAuth();
      }

      emitConnectionAlert({
        kind: 'warning',
        title: 'Problema de conexión',
        description: 'Verificando la conexión... Si persiste, intenta refrescar la página o contacta a soporte.'
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
        title: 'Error de conexión persistente',
        description: 'Si el problema persiste, recarga la página o comunícate con el equipo de informática.'
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
        description: 'Verifica tu conexión de red. La plataforma se sincronizará automáticamente cuando se restaure.'
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
            unread: 0, // El backend envía el total histórico, no los realmente no leídos. Solo incrementar vía socket.
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
        
        setConversationsState((prev) => {
          const mergedChats = mappedChats.map((mapped) => {
            const existing = prev.find((item) => phonesMatch(item.phone, mapped.phone));
            if (!existing) return mapped;

            return {
              ...mapped,
              // Preserve local HUMANO if the 15s poll returns ESPERA_OPERADOR during in-flight accept.
              conversationStatus: (existing.conversationStatus === 'HUMANO' && mapped.conversationStatus === 'ESPERA_OPERADOR')
                ? 'HUMANO'
                : mapped.conversationStatus,
              // Preservar mensajes ya cargados para evitar "borrados" visuales al refrescar lista.
              messages: Array.isArray(existing.messages) ? existing.messages : mapped.messages,
              // Si backend no trae última interacción, conservar la local.
              lastUserInteraction: mapped.lastUserInteraction || existing.lastUserInteraction || null,
              // El backend envía mensajes_no_leidos con el total histórico (no los realmente no leídos).
              // Siempre preservar el contador local: lo incrementamos vía socket y lo reseteamos al abrir.
              unread: existing.unread ?? mapped.unread
            } as Conversation;
          });

          const mergedPhoneKeys = new Set(mergedChats.map((chat) => normalizePhoneKey(chat.phone)));
          const now = Date.now();
          const recentlySeenLocalChats = prev.filter((chat) => {
            const phoneKey = normalizePhoneKey(chat.phone);
            if (!phoneKey || mergedPhoneKeys.has(phoneKey)) return false;

            const lastTs = chat.lastMessageDate ? new Date(chat.lastMessageDate).getTime() : 0;
            return Number.isFinite(lastTs) && now - lastTs < 3 * 60 * 1000;
          });

          return [...mergedChats, ...recentlySeenLocalChats];
        });
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
      const storedOperator = auth.getOperador();
      const scope = (storedOperator?.permissions && !Array.isArray(storedOperator.permissions))
        ? storedOperator.permissions.queueScope
        : undefined;

      if (!canViewQueueByScope(scope)) {
        setPendingOperatorTickets([]);
        return;
      }

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
        logger.error(error, { phase: 'pendingTickets' });
      }
    };
    
    loadChats();
    loadAuthProfile();
    loadPendingTickets();

    // Cargar subdelegaciones disponibles para transferencias
    const loadSubdelegaciones = async () => {
      if (!token || !isAuthenticated) return;
      try {
        setSubdelegacionesLoading(true);
        const response = await axios.get('/api/subdelegaciones', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = (response.data?.data || response.data || []) as Subdelegacion[];
        setSubdelegaciones(Array.isArray(data) ? data : []);
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 401 || status === 403) {
          // No hay permisos para cargar subdelegaciones
          logger.debug('No se pueden cargar subdelegaciones (403/401)');
          return;
        }
        logger.error(error, { phase: 'subdelegaciones' });
      } finally {
        setSubdelegacionesLoading(false);
      }
    };

    loadSubdelegaciones();

    const chatsRefreshInterval = window.setInterval(() => {
      loadChats();
    }, 15_000);

    const pendingTicketsInterval = window.setInterval(() => {
      loadPendingTickets();
    }, 20_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadChats();
        loadPendingTickets();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Escuchar mensajes en tiempo real
    const normalizeSocketPayload = (payload: unknown): RawSocketMessage | null => {
      if (!payload || typeof payload !== 'object') {
        logger.warn('Socket payload inválido (no es objeto)', payload);
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
        logger.warn('Socket payload sin phone o mensaje', {
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

      let shouldAnimateNewChat = false;
      let newChatPhoneForAnimation: string | null = null;

      if (env.enableLogging) {
        logger.debug('Socket mensaje entrante', {
          emisor: data.emisor,
          tipo: data.tipo,
          telefono: data.telefono || data.cliente_telefono,
          tiene_archivo: !!data.url_archivo
        });
      }
      
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
            
            if (env.enableLogging) {
              logger.debug('Socket detección de emisor', { emisor: newMsg.emisor, tipo: newMsg.tipo, incomingSent });
            }
            
            // Deduplicacion basada en contenido:
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
            
            if (env.enableLogging) {
              logger.debug('Socket check duplicado', { messageExists, newMsgId: newMsg.id, currentMessagesCount: chat.messages.length });
            }
            
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
                
                if (env.enableLogging) {
                  logger.debug('Socket agregando mensaje', { id: mappedMessage.id, sent: mappedMessage.sent });
                }
                
                // Mantener el tamaño de ventana actualmente visible (si el operador ya cargó más,
                // no volver a recortar a 20 al llegar un mensaje nuevo).
                const visibleWindowSize = Math.max(messagesLimit, chat.messages.length || messagesLimit);
                chat.messages = appendIncomingMessage(chat.messages, mappedMessage, { limit: visibleWindowSize });
                
                // Incrementar contador solo si es mensaje del usuario Y no es del operador
                const isUserMessage = isUserSender(emisorLimpio);
                const isCurrentOpenChat = selectedId !== null && selectedId !== undefined && selectedId === chat.id;
                if (isUserMessage && !isCurrentOpenChat) {
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
                if (isUserMessage && !isCurrentOpenChat) {
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
          
          // Actualizar último mensaje y mover conversación al inicio inmediatamente.
          // newMsg.mensaje ya está normalizado a string en la parte superior de handleNewMessage
          chat.lastMessage = messagePreview || newMsg.mensaje || '[Mensaje sin contenido]';
          chat.lastMessageDate = msgTimestamp.toISOString();
          chat.time = formatTime(msgTimestamp);

          const selectedIdSnapshot = selectedId !== null && selectedId !== undefined
            ? selectedId
            : (selectedChat !== null ? prev[selectedChat]?.id ?? null : null);

          // Reordenar: el chat con nuevo mensaje sube al tope.
          updated.splice(existingChatIndex, 1);
          updated.unshift(chat);

          // Mantener chat abierto por ID, no por posición.
          if (selectedIdSnapshot !== null) {
            const nextSelectedIndex = updated.findIndex((c) => c.id === selectedIdSnapshot);
            if (nextSelectedIndex !== -1 && nextSelectedIndex !== selectedChat) {
              setSelectedChat(nextSelectedIndex);
            }
          }

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
          shouldAnimateNewChat = true;
          newChatPhoneForAnimation = newMsg.telefono;
          const withNewChatOnTop = [newChat, ...prev];
          const selectedIdSnapshot = selectedId !== null && selectedId !== undefined
            ? selectedId
            : (selectedChat !== null ? prev[selectedChat]?.id ?? null : null);
          if (selectedIdSnapshot !== null) {
            const nextSelectedIndex = withNewChatOnTop.findIndex((c) => c.id === selectedIdSnapshot);
            if (nextSelectedIndex !== -1 && nextSelectedIndex !== selectedChat) {
              setSelectedChat(nextSelectedIndex);
            }
          }
          return withNewChatOnTop;
        }
      });

      if (shouldAnimateNewChat && newChatPhoneForAnimation) {
        triggerNewChatAnimation(newChatPhoneForAnimation);
      }
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

    const handleTicketTransferred = (data: TicketTransferredPayload) => {
      const phone = data.telefono || data.cliente_telefono || '';
      if (!phone) return;

      // Remover de la cola actual
      removePendingTicket({ phone, ticketId: data.ticket_id || data.ticketId });

      // Remover del listado de conversaciones
      setConversationsState(prev => prev.filter(c => !phonesMatch(c.phone, phone)));

      // Si es el chat actual, cerrar
      if (currentChat && phonesMatch(currentChat.phone, phone)) {
        closeSelectedChat();
      }

      toast.info('Chat transferido', {
        description: `El chat ha sido transferido a otra subdelegación.`
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
    socket.on('ticket_transferred', handleTicketTransferred);

    const handleAnyRealtimeEvent = (eventName: string, ...args: unknown[]) => {
      const event = (eventName || '').trim().toLowerCase();

      if (!['nuevo_chat', 'new_chat', 'chat_created', 'conversation_created', 'conversation_updated', 'chat_updated'].includes(event)) {
        return;
      }

      const payload = args[0];
      if (payload && typeof payload === 'object') {
        handleNewMessage(payload);
      }

      loadChats();
    };

    socket.onAny(handleAnyRealtimeEvent);

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
      socket.off('ticket_transferred', handleTicketTransferred);
      socket.offAny(handleAnyRealtimeEvent);
      window.clearInterval(chatsRefreshInterval);
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
          
          const token = auth.getToken();
          
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
            
            if (env.enableLogging) {
              logger.debug('Mensaje API mapeado', { msg_id: msg.id, tipo: tipo, sent });
            }
            
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

          logger.error(error, { phase: 'loadMessages' });
          logger.warn('Detalles error carga mensajes', {
            status: responseStatus,
            statusText: responseStatusText,
            data: responseData,
            message: errorMessage
          });
          
          // Mantener mensajes previos para evitar vaciados por fallos transitorios de red/backend.
          setConversationsState(prev => {
            const targetIndex = prev.findIndex((chat) => chat.id === selectedConversationId);
            if (targetIndex === -1) return prev;

            const updated = [...prev];
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

  // Mantener selectedChat sincronizado por ID (estable ante inserciones al inicio).
  useEffect(() => {
    if (selectedChat === null || selectedId === null || selectedId === undefined) {
      return;
    }

    if (!conversationsState.length) {
      setSelectedChat(null);
      return;
    }

    const stableIndex = conversationsState.findIndex((chat) => chat.id === selectedId);
    if (stableIndex === -1) {
      setSelectedChat(Math.max(0, Math.min(selectedChat, conversationsState.length - 1)));
      return;
    }

    if (stableIndex !== selectedChat) {
      setSelectedChat(stableIndex);
    }
  }, [conversationsState, selectedChat, selectedId]);
  
  // Funciones para control del bot
  const pauseBot = async (phone: string) => {
    try {
      await axios.post(`/api/chats/${phone}/pause`, {}, {
        headers: {}
      });
      // Bot pausado
    } catch (error) {
      logger.error(error, { phase: 'pauseBot' });
    }
  };
  
  const activateBot = async (phone: string) => {
    try {
      const token = auth.getToken();
      await axios.post(`/api/chats/${phone}/activate`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      // Bot activado
    } catch (error) {
      logger.error(error, { phase: 'activateBot' });
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

          logger.error(error, { phase: 'sendMessage' });
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

  const handleCopyMessage = async (msg: ChatMessage) => {
    if (!navigator.clipboard || !msg?.text) return;
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMessageId(msg.id);
      setTimeout(() => setCopiedMessageId(null), 1200);
    } catch (e) {
      logger.error(e, { phase: 'clipboardCopy' });
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
  const queueScope = useMemo(() => {
    const permissions = operatorProfile?.permissions;
    if (!permissions || Array.isArray(permissions)) return undefined;
    return typeof permissions.queueScope === 'string' ? permissions.queueScope : undefined;
  }, [operatorProfile]);
  const canViewOperatorQueue = canViewQueueByScope(queueScope);
  const canTakeOperatorQueue = canTakeQueueByScope(queueScope);

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
      <SidebarContainer
        selectedChat={selectedChat}
        theme={theme}
        darkMode={darkMode}
        themeColors={themeColors}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showSidebarMenu={showSidebarMenu}
        setShowSidebarMenu={setShowSidebarMenu}
        sidebarMenuRef={sidebarMenuRef}
        setShowNewConversation={setShowNewConversation}
        setShowArchived={setShowArchived}
        setShowPreferences={setShowPreferences}
        handleLogout={handleLogout}
        setConversationsState={setConversationsState}
        canViewOperatorQueue={canViewOperatorQueue}
        pendingOperatorTickets={pendingOperatorTickets}
        operatorProfile={operatorProfile}
        handoffActionLoading={handoffActionLoading}
        acceptOperatorChat={acceptOperatorChat}
        canTakeOperatorQueue={canTakeOperatorQueue}
        conversationsContainerRef={conversationsContainerRef}
        conversationsVirtualizer={conversationsVirtualizer}
        filteredConversations={filteredConversations}
        normalizePhoneKey={normalizePhoneKey}
        openContextMenu={openContextMenu}
        selectChatById={selectChatById}
        setChatClosed={setChatClosed}
        markChatReadById={markChatReadById}
        newChatAnimations={newChatAnimations}
        getContactStatus={getContactStatus}
        selectedId={selectedId}
        isHumanConversation={isHumanConversation}
        normalizeOperatorIdentity={normalizeOperatorIdentity}
        currentOperatorName={currentOperatorName}
        getStatusBadgeMeta={getStatusBadgeMeta}
        normalizeMessage={normalizeMessage}
        phonesMatch={phonesMatch}
      />

      {/* Chat Principal */}
      <div className={`${selectedChat === null ? 'hidden md:hidden' : 'flex md:flex'} flex-1 flex-col bg-gray-50 dark:bg-gray-900 transition-opacity duration-200`}>
        {/* Chat Header */}
        {currentChat && (
        <ChatMainHeader
          currentChat={currentChat}
          theme={theme}
          themeColors={themeColors}
          closeSelectedChat={closeSelectedChat}
          setShowInfo={setShowInfo}
          startEditName={startEditName}
          getContactStatus={getContactStatus}
          getRelativeTime={getRelativeTime}
          currentChatLock={currentChatLock}
          pendingOperatorTickets={pendingOperatorTickets}
          isWaitingOperator={isWaitingOperator}
          isHumanConversation={isHumanConversation}
          getStatusBadgeMeta={getStatusBadgeMeta}
          normalizePhoneKey={normalizePhoneKey}
          phonesMatch={phonesMatch}
          handoffActionLoading={handoffActionLoading}
          acceptOperatorChat={acceptOperatorChat}
          completeOperatorChat={completeOperatorChat}
          canTakeOperatorQueue={canTakeOperatorQueue}
          chatSearchRef={chatSearchRef}
          chatSearchMode={chatSearchMode}
          setChatSearchMode={setChatSearchMode}
          chatSearchText={chatSearchText}
          setChatSearchText={setChatSearchText}
          chatMenuRef={chatMenuRef}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
          markResolved={markResolved}
          activateBot={activateBot}
          setShowTransferDialog={setShowTransferDialog}
          setSelectedSubdelegation={setSelectedSubdelegation}
          setTransferMotive={setTransferMotive}
          deleteConversation={deleteConversation}
        />
        )}

        {/* Mensajes */}
        {currentChat && (
          <ChatMessagesPane
            currentChat={currentChat}
            selectedChat={selectedChat}
            messagesContainerRef={messagesContainerRef}
            darkMode={darkMode}
            backgroundPattern={backgroundPattern}
            messageFontSize={messageFontSize}
            fontFamily={fontFamily}
            openBlankMenu={openBlankMenu}
            dragOverChat={dragOverChat}
            setDragOverChat={setDragOverChat}
            allMessagesCache={allMessagesCache}
            messagesEndReached={messagesEndReached}
            messagesLoading={messagesLoading}
            messagesLimit={messagesLimit}
            currentMessageIndex={currentMessageIndex}
            setIsLoadingMoreMessages={setIsLoadingMoreMessages}
            setConversationsState={setConversationsState}
            setMessagesEndReached={setMessagesEndReached}
            setMessagesLoading={setMessagesLoading}
            setAllMessagesCache={setAllMessagesCache}
            setCurrentMessageIndex={setCurrentMessageIndex}
            selectionMode={selectionMode}
            exitSelection={exitSelection}
            selectedMessageIds={selectedMessageIds}
            conversationsState={conversationsState}
            toggleMessageSelection={toggleMessageSelection}
            deleteSelectedMessages={deleteSelectedMessages}
            filteredMessages={filteredMessages}
            themeColors={themeColors}
            theme={theme}
            highlightedMessage={highlightedMessage}
            openContextMenu={openContextMenu}
            handleCopyMessage={handleCopyMessage}
            copiedMessageId={copiedMessageId}
            setLightboxImage={setLightboxImage}
            setLightboxVideo={setLightboxVideo}
            setLightboxMessageId={setLightboxMessageId}
            setLightboxFile={setLightboxFile}
            audioVolume={audioVolume}
            setAudioVolume={setAudioVolume}
            audioPlaying={audioPlaying}
            setAudioPlaying={setAudioPlaying}
            setAudioProgress={setAudioProgress}
            expandedMessages={expandedMessages}
            expandedMenus={expandedMenus}
            setExpandedMenus={setExpandedMenus}
            toggleExpandMessage={toggleExpandMessage}
            typingUsers={typingUsers}
            setUrlContextMenu={setUrlContextMenu}
            showVolumeControl={showVolumeControl}
            setShowVolumeControl={setShowVolumeControl}
            formatTime={formatTime}
            isUserSender={isUserSender}
            normalizeSenderType={normalizeSenderType}
            normalizeMessageType={normalizeMessageType}
            extractFileUrlFromText={extractFileUrlFromText}
            deriveFilenameFromUrl={deriveFilenameFromUrl}
            emitConnectionAlert={emitConnectionAlert}
            formatFileSize={formatFileSize}
            getFileExtension={getFileExtension}
          />
        )}
        {/* Input de mensaje */}
        {currentChat && (
          <ChatComposerPane
            currentChat={currentChat}
            currentChatLock={currentChatLock}
            isHumanConversation={isHumanConversation}
            normalizePhoneKey={normalizePhoneKey}
            handoffActionLoading={handoffActionLoading}
            completeOperatorChat={completeOperatorChat}
            replyingTo={replyingTo}
            editingMessage={editingMessage}
            cancelEdit={cancelEdit}
            setReplyingTo={setReplyingTo}
            sessionExpired={sessionExpired}
            reactivationTema={reactivationTema}
            setReactivationTema={setReactivationTema}
            reactivating={reactivating}
            handleSendReactivationTemplate={handleSendReactivationTemplate}
            themeColors={themeColors}
            theme={theme}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            attachMenuRef={attachMenuRef}
            showAttachMenu={showAttachMenu}
            setShowAttachMenu={setShowAttachMenu}
            handleAttachmentType={handleAttachmentType}
            message={message}
            setMessage={setMessage}
            handleSendMessage={handleSendMessage}
            emojiPickerRef={emojiPickerRef}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            handleEmojiClick={handleEmojiClick}
          />
        )}
      </div>

      {/* Panel lateral de información (toggleable) */}
      {showInfo && currentChat && (
        <InfoPanel
          currentChat={currentChat}
          darkMode={darkMode}
          theme={theme}
          themeColors={themeColors}
          infoPanelClosing={infoPanelClosing}
          closeInfoPanel={closeInfoPanel}
          editingName={editingName}
          tempName={tempName}
          setTempName={setTempName}
          saveEditName={saveEditName}
          cancelEditName={cancelEditName}
          startEditName={startEditName}
          updatePadronField={updatePadronField}
          noteDrafts={noteDrafts}
          setNoteDrafts={setNoteDrafts}
          addNote={addNote}
          deleteNote={deleteNote}
          showMediaMenu={showMediaMenu}
          setShowMediaMenu={setShowMediaMenu}
          mediaFilter={mediaFilter}
          setMediaFilter={setMediaFilter}
          getMediaMessages={getMediaMessages}
          setLightboxImage={setLightboxImage}
        />
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
            <div className="mb-6 flex items-center justify-between">
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

            {/* Font Family */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Fuente</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'default', label: 'Sistema', sample: 'Aa' },
                  { key: 'Georgia, serif', label: 'Serif', sample: 'Aa' },
                  { key: "'Courier New', monospace", label: 'Monoespaciada', sample: 'Aa' },
                  { key: "'Comic Sans MS', cursive", label: 'Redondeada', sample: 'Aa' }
                ] as { key: string; label: string; sample: string }[]).map(({ key, label, sample }) => (
                  <button
                    key={key}
                    onClick={() => setFontFamily(key)}
                    className={`px-3 py-2 rounded-lg border-2 text-left transition-all ${
                      fontFamily === key
                        ? 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-700'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400'
                    }`}
                  >
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</span>
                    <span className="text-gray-900 dark:text-gray-100" style={{ fontFamily: key === 'default' ? 'inherit' : key }}>{sample}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Font Size */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Tamaño del texto</label>
                <span className="text-sm text-gray-500 dark:text-gray-400">{messageFontSize}px</span>
              </div>
              <input
                type="range"
                min={11}
                max={20}
                step={1}
                value={messageFontSize}
                onChange={(e) => setMessageFontSize(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: themeColors[theme].hex }}
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>Pequeño</span>
                <span>Grande</span>
              </div>
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

      {/* Dialog Transferencia de Chat */}
      {showTransferDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Transferir chat a otra subdelegación
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {currentChat?.phone}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Selección de subdelegación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subdelegación destino *
                </label>
                {subdelegacionesLoading ? (
                  <div className="p-3 text-center text-sm text-gray-500">Cargando...</div>
                ) : subdelegaciones.length === 0 ? (
                  <div className="p-3 text-center text-sm text-red-600">
                    No hay subdelegaciones disponibles
                  </div>
                ) : (
                  <select
                    value={selectedSubdelegation}
                    onChange={(e) => setSelectedSubdelegation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2"
                    style={{ focusRing: themeColors[theme].hex }}
                  >
                    <option value="">-- Selecciona una subdelegación --</option>
                    {subdelegaciones.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.nombre} {sub.codigo ? `(${sub.codigo})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Motivo (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motivo (opcional)
                </label>
                <textarea
                  value={transferMotive}
                  onChange={(e) => setTransferMotive(e.target.value)}
                  placeholder="Ej: Requiere especialista en deudas..."
                  maxLength={200}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {transferMotive.length}/200
                </p>
              </div>
            </div>

            {/* Botones */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowTransferDialog(false);
                  setSelectedSubdelegation('');
                  setTransferMotive('');
                }}
                disabled={transferLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleTransferChat()}
                disabled={transferLoading || !selectedSubdelegation}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
                style={{ backgroundColor: themeColors[theme].hex }}
              >
                {transferLoading ? 'Transfiriendo...' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

