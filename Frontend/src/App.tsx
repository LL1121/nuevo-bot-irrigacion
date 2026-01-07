import { useState, useRef, useEffect } from 'react';
import { Send, Search, MoreVertical, Paperclip, Smile, Check, CheckCheck, X, Image as ImageIcon, FileText, Video, Music, Moon, Sun, ArrowLeft, Trash, Play, Pause, Copy, ChevronUp, Volume2, Volume1, VolumeX } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import Login from './components/Login';

// Configurar conexión con backend
const socket: Socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Log de conexión del socket
socket.on('connect', () => {
  console.log('✅ Socket conectado con ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Socket desconectado');
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión del socket:', error);
});

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('authToken');
  });

  // Theme color mapping
  const themeColors: Record<string, { primary: string; gradient: string; light: string; hex: string }> = {
    emerald: { primary: 'emerald-600', gradient: 'from-emerald-500 to-teal-500', light: 'emerald-50', hex: '#10b981' },
    blue: { primary: 'blue-600', gradient: 'from-blue-500 to-cyan-500', light: 'blue-50', hex: '#3b82f6' },
    violet: { primary: 'violet-600', gradient: 'from-violet-500 to-purple-500', light: 'violet-50', hex: '#7c3aed' },
    amber: { primary: 'amber-600', gradient: 'from-amber-500 to-orange-500', light: 'amber-50', hex: '#d97706' }
  };

  const [selectedChat, setSelectedChat] = useState<number | null>(null);
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
  const [lightboxMessageId, setLightboxMessageId] = useState<number | null>(null);
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
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'videos' | 'files' | 'urls'>('all');
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState<Record<number, number>>({});
  const [showVolumeControl, setShowVolumeControl] = useState<number | null>(null);
  const [messagesOffset, setMessagesOffset] = useState<Record<string, number>>({});
  const [messagesLimit] = useState(50);
  const [messagesLoading, setMessagesLoading] = useState<Record<string, boolean>>({});
  const [messagesEndReached, setMessagesEndReached] = useState<Record<string, boolean>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const preferencesRef = useRef<HTMLDivElement>(null);
  const chatSearchRef = useRef<HTMLDivElement>(null);

  // Helpers para fechas de ejemplo
  const makeDate = (hours: number, minutes: number, daysOffset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  // Estado dinámico de conversaciones (se carga desde la API)
  const [conversationsState, setConversationsState] = useState<any[]>([]);
  const currentChat = selectedChat !== null ? conversationsState[selectedChat] : null;
  const selectedId = selectedChat !== null ? conversationsState[selectedChat]?.id : undefined;

  // Funciones auxiliares para formateo (definidas ANTES de los useEffect)
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es-AR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    }
  };
  
  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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
  return `http://localhost:3000/api/media/${mediaId}`;
};

  // Auth handlers
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // Reconectar socket después del login
    if (!socket.connected) {
      socket.connect();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // Limpiar estado de conversaciones
    setConversationsState([]);
    setSelectedChat(null);
    setMessage('');
    
    // Desconectar y reconectar socket sin autenticación
    socket.disconnect();
    
    // Actualizar estado de autenticación
    setIsAuthenticated(false);
  };

  // ⚡ useEffect para cargar chats desde el backend
  useEffect(() => {
    // Solo cargar chats si está autenticado
    if (!isAuthenticated) return;

    const loadChats = async () => {
      try {
        const token = localStorage.getItem('authToken');
        console.log('🔄 Cargando chats desde la API...');
        const response = await axios.get('http://localhost:3000/api/chats', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        console.log('📦 Respuesta completa del backend:', response.data);
        console.log('📦 Tipo de response.data:', typeof response.data);
        console.log('📦 Es array?', Array.isArray(response.data));
        
        // El backend devuelve { success: true, data: [...], total: N }
        const chats = Array.isArray(response.data) ? response.data : (response.data.data || response.data.chats || []);
        console.log('✅ Chats extraídos:', chats.length, chats);
        
        // Mapear los datos del backend a la estructura esperada por la UI
        const mappedChats = chats.map((chat: any) => ({
          id: chat.id,
          name: chat.nombre || chat.telefono,
          phone: chat.telefono,
          lastMessage: chat.ultimo_mensaje || '',
          time: chat.ultimo_mensaje_fecha ? formatTime(new Date(chat.ultimo_mensaje_fecha)) : '',
          unread: chat.mensajes_no_leidos || 0,
          avatar: getInitials(chat.nombre || chat.telefono),
          operator: chat.operador || null,
          conversationStatus: chat.estado || 'unattended',
          archived: chat.archivado || false,
          padron: {
            number: chat.padron || '',
            location: chat.ubicacion || '',
            debtStatus: chat.estado_deuda || ''
          },
          notes: chat.notas ? JSON.parse(chat.notas) : [],
          messages: [] // Los mensajes se cargan al seleccionar el chat
        }));
        
        console.log('✅ Chats mapeados y listos:', mappedChats);
        setConversationsState(mappedChats);
      } catch (error) {
        console.error('❌ Error cargando chats:', error);
      }
    };
    
    loadChats();
    
    // Escuchar mensajes en tiempo real
    socket.on('nuevo_mensaje', (newMsg: any) => {
      console.log('📨 Nuevo mensaje recibido del socket:', newMsg);
      console.log('📱 Teléfono del mensaje:', newMsg.telefono);
      console.log('💬 Contenido:', newMsg.mensaje);
      
      setConversationsState(prev => {
        console.log('📋 Conversaciones actuales:', prev.length);
        const existingChatIndex = prev.findIndex(c => c.phone === newMsg.telefono);
        console.log('🔍 Índice de chat encontrado:', existingChatIndex);
        
        if (existingChatIndex !== -1) {
          // Invalidar caché para este chat
          const cacheKey = `messages_${newMsg.telefono}`;
          localStorage.removeItem(cacheKey);
          console.log('🗑️ Caché invalidado para:', newMsg.telefono);
          
          // Actualizar conversación existente
          const updated = [...prev];
          const chat = updated[existingChatIndex];
          
          // Agregar mensaje al array de mensajes si ya están cargados (al FINAL por orden ASC)
          if (chat.messages && Array.isArray(chat.messages)) {
            // Verificar si el mensaje ya existe (evitar duplicados del optimistic update)
            // Comprobamos por ID O por texto+timestamp reciente (5 segundos)
            const now = new Date();
            const msgTimestamp = new Date(newMsg.timestamp || now);
            const messageExists = chat.messages.some((m: any) => {
              // Verificar por ID si ambos lo tienen
              if (newMsg.id && m.id === newMsg.id) return true;
              
              // Verificar por texto y timestamp cercano (mismo mensaje en los últimos 5 seg)
              const mTimestamp = new Date(m.date);
              const diffSeconds = Math.abs((msgTimestamp.getTime() - mTimestamp.getTime()) / 1000);
              return m.text === (newMsg.mensaje || '') && diffSeconds < 5;
            });
            
            if (!messageExists) {
              const emisorLimpio = (newMsg.emisor || '').trim().toLowerCase();
              
              // Si es un mensaje del operador, buscar si ya existe como optimistic update
              // y NO reemplazarlo, para mantener el timestamp original
              const isOperatorMessage = emisorLimpio === 'operador';
              const existingOptimisticMsg = isOperatorMessage 
                ? chat.messages.find((m: any) => m.text === (newMsg.mensaje || '') && m.sent === true)
                : null;
              
              if (existingOptimisticMsg) {
                // Actualizar solo el ID, mantener el timestamp original
                console.log('🔄 Actualizando ID del mensaje optimista:', existingOptimisticMsg.id, '→', newMsg.id);
                existingOptimisticMsg.id = newMsg.id;
                existingOptimisticMsg.read = true;
              } else {
                // Agregar nuevo mensaje
                const mappedMessage = {
                  id: newMsg.id || Date.now(),
                  text: newMsg.mensaje || '',
                  time: formatTime(msgTimestamp),
                  date: newMsg.timestamp || msgTimestamp.toISOString(),
                  sent: emisorLimpio === 'bot' || emisorLimpio === 'operador', // true = derecha/verde, false = izquierda/blanco
                  read: true,
                  type: newMsg.tipo || 'text',
                  fileUrl: newMsg.url_archivo,
                  filename: newMsg.archivo_nombre,
                  size: newMsg.archivo_tamanio,
                  duration: newMsg.duracion
                };
                console.log('➕ Agregando mensaje:', { id: mappedMessage.id, sent: mappedMessage.sent, emisor: newMsg.emisor, texto: mappedMessage.text.substring(0, 30) });
                chat.messages.push(mappedMessage);
                
                // IMPORTANTE: Ordenar por fecha para mantener el orden correcto aunque los sockets lleguen desordenados
                chat.messages.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                console.log('📅 Mensajes ordenados por fecha');
              }
            } else {
              console.log('⏭️ Mensaje ya existe, no se duplica:', newMsg.mensaje?.substring(0, 30));
            }
          }
          
          // Actualizar último mensaje y traer al frente
          chat.lastMessage = newMsg.mensaje || '';
          chat.time = formatTime(new Date(newMsg.timestamp || new Date()));
          if ((newMsg.emisor || '').trim() === 'usuario') {
            chat.unread = (chat.unread || 0) + 1;
          }
          
          // Mover al inicio del array
          updated.splice(existingChatIndex, 1);
          updated.unshift(chat);
          
          return updated;
        } else {
          // Crear nueva conversación
          const newChat = {
            id: Date.now(),
            name: newMsg.nombre || newMsg.telefono,
            phone: newMsg.telefono,
            lastMessage: newMsg.mensaje || '',
            time: formatTime(new Date(newMsg.timestamp || new Date())),
            unread: (newMsg.emisor || '').trim() === 'usuario' ? 1 : 0,
            avatar: getInitials(newMsg.nombre || newMsg.telefono),
            operator: null,
            conversationStatus: 'unattended',
            archived: false,
            padron: { number: '', location: '', debtStatus: '' },
            notes: [],
            messages: [{
              id: newMsg.id || Date.now(),
              text: newMsg.mensaje || '',
              time: formatTime(new Date(newMsg.timestamp || new Date())),
              date: newMsg.timestamp || new Date().toISOString(),
              sent: (newMsg.emisor || '').trim() !== 'usuario',
              read: true,
              type: newMsg.tipo || 'text',
              fileUrl: newMsg.url_archivo
            }]
          };
          return [newChat, ...prev];
        }
      });
    });
    
    // Escuchar cambios en el modo del bot
    socket.on('bot_mode_changed', (data: { telefono: string; bot_activo: boolean }) => {
      console.log('🤖 Cambio en modo del bot:', data);
      setConversationsState(prev => {
        const chatIndex = prev.findIndex(c => c.phone === data.telefono);
        if (chatIndex !== -1) {
          const updated = [...prev];
          updated[chatIndex].botActive = data.bot_activo;
          return updated;
        }
        return prev;
      });
    });
    
    // Cleanup al desmontar
    return () => {
      socket.off('nuevo_mensaje');
      socket.off('bot_mode_changed');
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

  // Persist preferences to storage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('backgroundPattern', String(backgroundPattern));
    localStorage.setItem('soundEnabled', String(soundEnabled));
  }, [theme, backgroundPattern, soundEnabled]);

  // Cargar mensajes cuando se selecciona un chat
  useEffect(() => {
    if (selectedChat === null) return;
    
    const currentChat = conversationsState[selectedChat];
    if (!currentChat || !currentChat.phone) return;
    
    // Solo cargar si aún no hay mensajes cargados
    if (!currentChat.messages || currentChat.messages.length === 0) {
      const loadMessages = async () => {
        try {
          // Intentar cargar desde caché primero
          const cacheKey = `messages_${currentChat.phone}`;
          const cachedData = localStorage.getItem(cacheKey);
          
          if (cachedData) {
            try {
              const { messages: cachedMessages, timestamp } = JSON.parse(cachedData);
              // Usar caché si tiene menos de 5 minutos
              const cacheAge = Date.now() - timestamp;
              if (cacheAge < 5 * 60 * 1000) {
                console.log('💾 Usando mensajes desde caché:', currentChat.phone);
                setConversationsState(prev => {
                  const updated = [...prev];
                  updated[selectedChat] = {
                    ...updated[selectedChat],
                    messages: cachedMessages
                  };
                  return updated;
                });
                return; // Salir, ya tenemos los mensajes en caché
              }
            } catch (e) {
              console.log('⚠️ Error parseando caché, cargando desde API');
            }
          }
          
          console.log('📨 Cargando mensajes para:', currentChat.phone);
          const currentOffset = messagesOffset[currentChat.phone] || 0;
          const token = localStorage.getItem('authToken');
          const response = await axios.get(`http://localhost:3000/api/messages/${currentChat.phone}?limit=${messagesLimit}&offset=${currentOffset}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          console.log('📦 Respuesta de mensajes:', response.data);
          
          // El backend devuelve { success, messages, telefono, limit, offset, total }
          const messages = response.data.messages || [];
          console.log('✅ Mensajes extraídos:', messages.length, 'de', response.data.total, 'total');
          console.log('📋 Primer mensaje completo:', messages[0]);
          console.log('📋 Campos del primer mensaje:', Object.keys(messages[0] || {}));
          
          // Mapear mensajes al formato esperado por la UI
          const mappedMessages = messages.map((msg: any) => {
            const emisor = (msg.emisor || '').trim(); // Limpiar espacios en blanco
            console.log('🔍 Mensaje:', { id: msg.id, emisor: emisor, cuerpo: msg.cuerpo?.substring(0, 30) });
            const sent = emisor !== 'usuario';
            console.log('📍 sent =', sent, '(emisor limpio:', emisor, ')');
            
            return {
              id: msg.id,
              text: msg.cuerpo || '',
              time: formatTime(new Date(msg.fecha)),
              date: msg.fecha,
              sent: sent,
              read: true,
              type: msg.tipo || 'text',
              fileUrl: msg.url_archivo,
              filename: msg.archivo_nombre,
              size: msg.archivo_tamanio,
              duration: msg.duracion
            };
          });
          
          console.log('✅ Mensajes mapeados:', mappedMessages);
          
          // Actualizar offset y detectar si llegamos al final
          setMessagesOffset(prev => ({ ...prev, [currentChat.phone]: currentOffset + messages.length }));
          if (messages.length < messagesLimit) {
            setMessagesEndReached(prev => ({ ...prev, [currentChat.phone]: true }));
          }
          
          // Guardar en caché (solo si no hay errores)
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              messages: mappedMessages,
              timestamp: Date.now()
            }));
            console.log('💾 Mensajes guardados en caché');
          } catch (e) {
            console.warn('⚠️ No se pudo guardar en caché (posiblemente lleno):', e);
            // Si falla, intentar limpiar caché antiguo
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('messages_')) {
                  const data = localStorage.getItem(key);
                  if (data) {
                    const { timestamp } = JSON.parse(data);
                    // Eliminar cachés de más de 1 hora
                    if (Date.now() - timestamp > 60 * 60 * 1000) {
                      localStorage.removeItem(key);
                    }
                  }
                }
              }
            } catch (cleanupError) {
              console.warn('Error limpiando caché:', cleanupError);
            }
          }
          
          // Actualizar el chat con los mensajes cargados
          setConversationsState(prev => {
            const updated = [...prev];
            updated[selectedChat] = {
              ...updated[selectedChat],
              messages: mappedMessages
            };
            return updated;
          });
        } catch (error: any) {
          console.error('❌ Error cargando mensajes:', error);
          console.error('❌ Detalles del error:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
          });
          
          // Establecer array vacío para que no quede en loading infinito
          setConversationsState(prev => {
            const updated = [...prev];
            updated[selectedChat] = {
              ...updated[selectedChat],
              messages: []
            };
            return updated;
          });
        }
      };
      
      loadMessages();
    }
  }, [selectedChat]);
  
  // Simulate audio playback progress based on real duration
  useEffect(() => {
    if (audioPlaying === null) return;
    
    // Find the audio message to get its duration
    let totalSeconds = 32; // default fallback
    for (const conv of conversationsState as any[]) {
      if (conv.messages && Array.isArray(conv.messages)) {
        const msg = conv.messages.find((m: any) => m.id === audioPlaying);
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
  
  // Funciones para control del bot
  const pauseBot = async (phone: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.post(`http://localhost:3000/api/chats/${phone}/pause`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      console.log('✅ Bot pausado para:', phone);
    } catch (error) {
      console.error('❌ Error pausando bot:', error);
    }
  };
  
  const activateBot = async (phone: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.post(`http://localhost:3000/api/chats/${phone}/activate`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      console.log('✅ Bot activado para:', phone);
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

  const handleSendMessage = async () => {
    if (message.trim() && selectedChat !== null) {
      if (editingMessage) {
        saveEditMessage();
      } else {
        const currentChat = conversationsState[selectedChat];
        if (!currentChat || !currentChat.phone) return;
        
        const messageText = message.trim();
        const tempId = Date.now();
        
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
          duration: null
        };
        
        // Actualizar UI inmediatamente (optimistic update)
        setConversationsState(prev => {
          const updated = [...prev];
          if (!updated[selectedChat].messages) {
            updated[selectedChat].messages = [];
          }
          updated[selectedChat].messages.push(tempMessage);
          updated[selectedChat].lastMessage = messageText;
          updated[selectedChat].time = formatTime(new Date());
          return updated;
        });
        
        // Limpiar input
        setMessage('');
        setReplyingTo(null);
        
        // Invalidar caché
        const cacheKey = `messages_${currentChat.phone}`;
        localStorage.removeItem(cacheKey);
        
        // Enviar al backend
        try {
          const token = localStorage.getItem('authToken');
          const response = await axios.post('http://localhost:3000/api/send', {
            telefono: currentChat.phone,
            mensaje: messageText,
            operador: 'Panel Frontend',
            emisor: 'operador' // Explícitamente marcar como operador
          }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          
          console.log('✅ Mensaje enviado:', response.data);
          
          // Actualizar con el ID real del backend si viene
          if (response.data && response.data.id) {
            setConversationsState(prev => {
              const updated = [...prev];
              const msgIndex = updated[selectedChat].messages.findIndex((m: any) => m.id === tempId);
              if (msgIndex !== -1) {
                updated[selectedChat].messages[msgIndex].id = response.data.id;
              }
              return updated;
            });
          }
        } catch (error) {
          console.error('❌ Error enviando mensaje:', error);
          // Marcar el mensaje como error
          setConversationsState(prev => {
            const updated = [...prev];
            const msgIndex = updated[selectedChat].messages.findIndex((m: any) => m.id === tempId);
            if (msgIndex !== -1) {
              updated[selectedChat].messages[msgIndex].error = true;
            }
            return updated;
          });
        }
      }
    }
  };

  const handleEmojiClick = (emojiObject: any) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Archivo seleccionado: ${file.name}`);
    }
  };

  const handleAttachmentType = (accept: string) => {
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

  const markChatReadById = (id: number) => {
    setConversationsState(prev => prev.map((c: any) => c.id === id ? { ...c, unread: 0 } : c));
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const deleteConversationById = (id: number) => {
    setConversationsState(prev => prev.filter((c: any) => c.id !== id));
    if (currentChat?.id === id) setSelectedChat(0);
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
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

  const archiveConversationById = (id: number) => {
    setConversationsState(prev => prev.map((c: any) => c.id === id ? { ...c, archived: true } : c));
    setContextMenu({ visible: false, x: 0, y: 0, type: null });
  };

  const unarchiveConversationById = (id: number) => {
    setConversationsState(prev => prev.map((c: any) => c.id === id ? { ...c, archived: false } : c));
  };

  const copyMessageById = (id: number) => {
    if (selectedChat === null) return;
    const msg: any = conversationsState[selectedChat].messages.find((m: any) => m.id === id);
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
        setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter((m: any) => m.id !== id) } : c));
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
        setConfirmDialog(null);
      }
    });
  };

  const replyToMessage = (id: number) => {
    if (selectedChat === null) return;
    const msg: any = conversationsState[selectedChat].messages.find((m: any) => m.id === id);
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
    const msg: any = conversationsState[selectedChat].messages.find((m: any) => m.id === forwardMessageId);
    if (msg) {
      const targetChat = conversationsState.find(c => c.id === targetChatId);
      if (targetChat) {
        const newMsgId = Math.max(...targetChat.messages.map((m: any) => m.id), 0) + 1;
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
    const msg: any = conversationsState[selectedChat].messages.find((m: any) => m.id === id);
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
      messages: c.messages.map((m: any) => m.id === editingMessage.id ? { ...m, text: message } : m)
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
        return messages.filter((m: any) => m.type === 'image');
      case 'videos':
        return messages.filter((m: any) => m.type === 'video');
      case 'files':
        return messages.filter((m: any) => m.type === 'file');
      case 'urls':
        return messages.filter((m: any) => m.text && /https?:\/\/[^\s]+/.test(m.text));
      default:
        return messages.filter((m: any) => m.type === 'image' || m.type === 'video' || m.type === 'file' || (m.text && /https?:\/\/[^\s]+/.test(m.text)));
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
    const msg: any = conversationsState[selectedChat].messages.find((m: any) => m.id === messageId);
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
      const m: any = chat.messages.find((mm: any) => mm.id === id);
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
        setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter((m: any) => !ownSelectedIds.includes(m.id)) } : c));
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
    if (!chatSearchText.trim()) return chat.messages;
    return chat.messages.filter((msg: any) => 
      msg.text.toLowerCase().includes(chatSearchText.toLowerCase())
    );
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
    setConversationsState(prev => prev.map(c => c.id === chatId ? { ...c, notes: (c.notes || []).filter((n: any) => n.id !== noteId) } : c));
  };

  const insertQuickText = (text: string) => {
    setMessage((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleCopyMessage = async (msg: any) => {
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

  const filteredConversations = conversationsState.filter(conv => {
    // Filtrar archivadas
    if (conv.archived) return false;
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      conv.name.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query) ||
      conv.messages.some((msg: any) => msg.text.toLowerCase().includes(query))
    );
  });

  const archivedConversations = conversationsState.filter(conv => conv.archived);

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
      return next.length ? next : prev; // avoid empty for demo
    });
    setSelectedChat((idx) => {
      if (idx === null) return null;
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
            <div className="flex items-center gap-2 relative absolute left-6" ref={sidebarMenuRef}>
              <button 
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                onClick={() => setShowSidebarMenu((v) => !v)}
              >
                <MoreVertical size={20} />
              </button>
              {showSidebarMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 animate-slideInDown">
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
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv, idx) => (
            <div
              key={conv.id}
              onContextMenu={(e) => openContextMenu(e, 'chat', conv.id)}
              onClick={() => {
                const originalIndex = conversationsState.findIndex((c) => c.id === conv.id);
                setSelectedChat(originalIndex === -1 ? idx : originalIndex);
                setChatClosed(false);
              }}
              className={`p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700`}
              style={selectedId === conv.id ? {
                backgroundColor: darkMode ? `${themeColors[theme].hex}20` : `${themeColors[theme].hex}10`,
                borderLeft: `4px solid ${themeColors[theme].hex}`
              } : {}}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold transition-colors" style={{
                    backgroundColor: selectedId === conv.id ? themeColors[theme].hex : undefined,
                    backgroundImage: selectedId !== conv.id ? `linear-gradient(135deg, ${themeColors[theme].hex}, #14b8a6)` : undefined
                  }}>
                    {conv.avatar}
                  </div>
                  {(() => {
                    const lastMsgDate = conv.messages && conv.messages.length > 0 
                      ? conv.messages[conv.messages.length - 1].date 
                      : new Date();
                    const status = getContactStatus(lastMsgDate);
                    return (
                      <div className={`absolute bottom-0 right-0 w-3 h-3 ${status.color} rounded-full border-2 border-white dark:border-gray-800`}></div>
                    );
                  })()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{conv.name}</h3>
                    {conv.unread > 0 ? (
                      <span className="text-white text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: themeColors[theme].hex }}>
                        {conv.unread}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{conv.time}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-1">{conv.lastMessage}</p>
                  <div className="flex items-center justify-end">
                  </div>
                </div>
              </div>
            </div>
          ))}
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
              onClick={() => setSelectedChat(null)}
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="flex items-center gap-3 text-left focus:outline-none"
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{
                  backgroundImage: `linear-gradient(135deg, ${themeColors[theme].hex}, #14b8a6)`
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
                <div 
                  className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  onContextMenu={(e) => { e.preventDefault(); startEditName(); }}
                >
                  {currentChat.name}
                </div>
                {(() => {
                  const lastMsgDate = currentChat.messages && currentChat.messages.length > 0 
                    ? currentChat.messages[currentChat.messages.length - 1].date 
                    : new Date();
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
              </div>
            </button>
          </div>
          
          <div className="flex items-center gap-2">
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
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 animate-slideInDown">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={markResolved}
                >
                  Marcar como atendida
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={deleteConversation}
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
          className="flex-1 overflow-y-auto p-6 space-y-4 relative pb-6 animate-fadeIn"
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
              console.log('Archivos soltados:', Array.from(files).map(f => f.name));
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
                  
                  if (messagesLoading[phone]) return;
                  
                  setMessagesLoading(prev => ({ ...prev, [phone]: true }));
                  
                  try {
                    const currentOffset = messagesOffset[phone] || 0;
                    const token = localStorage.getItem('authToken');
                    const response = await axios.get(`http://localhost:3000/api/messages/${phone}?limit=${messagesLimit}&offset=${currentOffset}`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    const newMessages = response.data.messages || [];
                    
                    if (newMessages.length > 0) {
                      const mappedMessages = newMessages.map((msg: any) => {
                        const emisor = (msg.emisor || '').trim();
                        return {
                          id: msg.id,
                          text: msg.cuerpo || '',
                          time: formatTime(new Date(msg.fecha)),
                          date: msg.fecha,
                          sent: emisor !== 'usuario',
                          read: true,
                          type: msg.tipo || 'text',
                          fileUrl: msg.url_archivo,
                          filename: msg.archivo_nombre,
                          size: msg.archivo_tamanio,
                          duration: msg.duracion
                        };
                      });
                      
                      setConversationsState(prev => {
                        const updated = [...prev];
                        const chatIndex = updated.findIndex(c => c.phone === phone);
                        if (chatIndex !== -1) {
                          // Concatenar al FINAL (orden ASC)
                          updated[chatIndex].messages = [...updated[chatIndex].messages, ...mappedMessages];
                        }
                        return updated;
                      });
                      
                      setMessagesOffset(prev => ({ ...prev, [phone]: currentOffset + newMessages.length }));
                      
                      if (newMessages.length < messagesLimit) {
                        setMessagesEndReached(prev => ({ ...prev, [phone]: true }));
                      }
                    } else {
                      setMessagesEndReached(prev => ({ ...prev, [phone]: true }));
                    }
                  } catch (error) {
                    console.error('❌ Error cargando más mensajes:', error);
                  } finally {
                    setMessagesLoading(prev => ({ ...prev, [phone]: false }));
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
                    const m: any = conversationsState[selectedChat].messages.find((mm: any) => mm.id === id);
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
                        const m: any = conversationsState[selectedChat].messages.find((mm: any) => mm.id === id);
                        return m?.sent === true;
                      });
                      return `(${ownIds.length})`;
                    })()}
                  </span>
                </div>
              </button>
            </div>
          )}
          {getFilteredMessages().map((msg: any, idx: any) => {
            const filteredMessages = getFilteredMessages();
            const prev = idx > 0 ? filteredMessages[idx - 1] : null;
            const labelFor = (m: any) => {
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
            const isImage = (msg as any).type === 'image' || (typeof msg.text === 'string' && (msg.text.startsWith('http') || msg.text.startsWith('data:image')));
            
            // Delay escalonado: 50ms por mensaje (máximo 20 mensajes = 1 segundo)
            const animationDelay = Math.min(idx * 50, 1000);
            
            return (
              <div 
                key={msg.id} 
                className="space-y-2"
                style={{
                  animation: 'messageSlideIn 0.4s ease-out forwards',
                  animationDelay: `${animationDelay}ms`,
                  opacity: 0
                }}
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
                        setLightboxImage(getMediaUrl((msg as any).fileUrl) || msg.text); 
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
                      <img src={getMediaUrl((msg as any).fileUrl) || msg.text} alt="imagen" className="w-full h-auto object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 flex items-center justify-end gap-1 text-white/90">
                        <span className="text-[10px] leading-none">{msg.time}</span>
                        {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                      </div>
                    </div>
                  ) : (msg as any).type === 'video' ? (
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
                        src={getMediaUrl((msg as any).fileUrl)} 
                        className="w-full h-auto object-cover cursor-pointer"
                        preload="metadata"
                        onClick={() => { setLightboxVideo(getMediaUrl((msg as any).fileUrl)); setLightboxMessageId(msg.id); }}
                      />
                      {/* Botón Play centrado */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        onClick={() => { setLightboxVideo(getMediaUrl((msg as any).fileUrl)); setLightboxMessageId(msg.id); }}
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
                  ) : (msg as any).type === 'audio' ? (
                    <>
                      <audio
                        id={`audio-${msg.id}`}
                        src={getMediaUrl((msg as any).fileUrl)}
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
                  ) : (msg as any).type === 'interactive' ? (
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
                          const menuData = typeof msg.text === 'string' ? JSON.parse(msg.text) : msg.text;
                          
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
                                <div className="px-4 pb-3">
                                  <p className="text-sm opacity-90">{menuData.body}</p>
                                </div>
                              )}
                              
                              {/* Botón principal */}
                              {menuData.buttonText && (
                                <div className="px-4 pb-2">
                                  <div 
                                    className="w-full px-3 py-2 rounded-lg border text-center text-sm font-medium cursor-pointer transition"
                                    style={{
                                      borderColor: msg.sent ? 'rgba(255,255,255,0.4)' : themeColors[theme].hex,
                                      color: msg.sent ? 'white' : themeColors[theme].hex,
                                      backgroundColor: msg.sent ? 'rgba(255,255,255,0.1)' : 'transparent'
                                    }}
                                  >
                                    {menuData.buttonText}
                                  </div>
                                </div>
                              )}
                              
                              {/* Secciones con opciones */}
                              {menuData.sections && menuData.sections.length > 0 && (
                                <div className="border-t" style={{ borderColor: msg.sent ? 'rgba(255,255,255,0.2)' : (darkMode ? '#374151' : '#e5e7eb') }}>
                                  {menuData.sections.map((section: any, sIdx: number) => (
                                    <div key={sIdx}>
                                      {section.title && (
                                        <div className="px-4 pt-3 pb-1">
                                          <h4 className="text-xs font-semibold uppercase tracking-wide opacity-70">
                                            {section.title}
                                          </h4>
                                        </div>
                                      )}
                                      <div className="px-2 pb-2">
                                        {(section.rows || []).map((option: any, oIdx: number) => (
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
                                    </div>
                                  ))}
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
                  ) : (msg as any).type === 'file' ? (
                    <a
                      href={getMediaUrl((msg as any).fileUrl) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`relative group max-w-[260px] sm:max-w-sm px-4 py-3 rounded-2xl shadow-sm block hover:opacity-90 transition-opacity ${
                        msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                      }`}
                      style={msg.sent ? {
                        backgroundImage: `linear-gradient(to right, ${themeColors[theme].hex}, #14b8a6)`,
                        ...( selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})
                      } : (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: `0 0 0 2px ${themeColors[theme].hex}` } : {})}
                      onClick={(e) => e.stopPropagation()}
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
                          const isPdf = (msg as any).filename?.toLowerCase().endsWith('.pdf');
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test((msg as any).filename || '');
                          
                          if (isPdf && (msg as any).fileUrl) {
                            return (
                              <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-white/20">
                                <iframe 
                                  src={`${getMediaUrl((msg as any).fileUrl)}#page=1&toolbar=0&navpanes=0&scrollbar=0`}
                                  className="w-full h-full pointer-events-none scale-150 origin-top-left"
                                />
                              </div>
                            );
                          } else if (isImage && (msg as any).fileUrl) {
                            return (
                              <img 
                                src={getMediaUrl((msg as any).fileUrl)} 
                                alt={(msg as any).filename}
                                className="flex-shrink-0 w-16 h-16 rounded object-cover"
                              />
                            );
                          } else {
                            return <FileText size={32} className={msg.sent ? 'text-white/80 flex-shrink-0' : `flex-shrink-0`} style={!msg.sent ? { color: themeColors[theme].hex } : undefined} />;
                          }
                        })()}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{(msg as any).filename || msg.text}</p>
                          <p className={`text-xs ${msg.sent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                            {(msg as any).filename?.split('.')?.pop()?.toUpperCase() || 'FILE'} • {(msg as any).size || '0 MB'}
                          </p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 justify-end mt-2 ${msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                        <span className="text-xs">{msg.time}</span>
                        {msg.sent && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                      </div>
                    </a>
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
                        const fullText = msg.text || ''; // Manejar mensajes sin texto
                        const isExpanded = expandedMessages.has(msg.id);
                        const isTruncated = fullText.length > 300;
                        const displayText = isTruncated && !isExpanded ? fullText.substring(0, 300) + '...' : fullText;
                        
                        return (
                          <>
                            <p className="text-sm">{displayText}</p>
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
                        {msg.sent && (msg.read ? <CheckCheck size={14} /> : <Check size={14} />)}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
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
                className={`overflow-hidden transition-all duration-300 ease-out ${showQuickMenu ? 'max-h-28 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'}`}
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
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-white text-3xl font-semibold mb-4" style={{
              backgroundImage: `linear-gradient(135deg, ${themeColors[theme].hex}, #14b8a6)`
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
                {(currentChat.notes || []).map((note: any) => (
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
                  } as any}
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
                    {['all', 'images', 'videos', 'files', 'urls'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setMediaFilter(filter as any)}
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
                    {getMediaMessages().map((msg: any) => (
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
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => { setSelectedChat(conversationsState.findIndex(c => c.id === contextMenu.targetId)); setChatClosed(false); setContextMenu({ visible: false, x: 0, y: 0, type: null }); }}>Abrir</button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => markChatReadById(contextMenu.targetId!)}>Marcar como leída</button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => archiveConversationById(contextMenu.targetId!)}>Archivar</button>
              <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => deleteConversationById(contextMenu.targetId!)}>Eliminar</button>
            </div>
          )}
          {contextMenu.type === 'message' && (() => {
            const msg = selectedChat !== null ? conversationsState[selectedChat].messages.find((m: any) => m.id === contextMenu.targetId) : null;
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
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => { setSelectedChat(null); setChatClosed(true); setContextMenu({ visible: false, x: 0, y: 0, type: null }); }}>Cerrar chat</button>
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
                archivedConversations.map((conv: any) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: themeColors[theme].hex }}>
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
              {conversationsState.filter(c => !c.archived).map((conv: any) => (
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
    </div>
  );
}

