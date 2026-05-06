export type ChatMessageType = 'text' | 'interactive' | 'image' | 'video' | 'audio' | 'file' | string;

export type ChatMessage = {
  id: string | number;
  text: string;
  date?: string | number | Date;
  time?: string;
  sent?: boolean;
  read?: boolean;
  type?: ChatMessageType;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | string;
  error?: boolean;
  fileUrl?: string | null;
  filename?: string | null;
  size?: number | null;
  duration?: number | null;
};

export type ConversationPadron = {
  number?: string;
  location?: string;
  debtStatus?: string;
  [key: string]: unknown;
};

export type Conversation = {
  id: number;
  name?: string;
  nombre?: string;
  phone: string;
  unread?: number;
  archived?: boolean;
  avatar?: string;
  profilePic?: string | null;
  time?: string;
  lastMessage?: string;
  lastMessageDate?: string;
  lastUserInteraction?: string;
  conversationStatus?: string;
  botActive?: boolean;
  padron?: ConversationPadron;
  notes?: Array<{ id: number; text: string }>;
  messages: ChatMessage[];
  [key: string]: unknown;
};

export type ChatContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  type: 'chat' | 'message' | 'blank' | null;
  targetId?: number;
};

export type RawSocketMessage = {
  id?: string | number;
  emisor?: string;
  tipo?: string;
  telefono?: string;
  cliente_telefono?: string;
  mensaje?: unknown;
  cuerpo?: unknown;
  nombre?: string | Record<string, unknown>;
  timestamp?: string;
  created_at?: string;
  createdAt?: string;
  fecha?: string;
  url_archivo?: string;
  archivo_nombre?: string;
  archivo_tamanio?: number;
  duracion?: number;
};

export type RawApiMessage = {
  id?: string | number;
  emisor?: string;
  tipo?: string;
  contenido?: unknown;
  cuerpo?: unknown;
  mensaje?: unknown;
  created_at?: string;
  createdAt?: string;
  fecha?: string;
  timestamp?: string;
  url_archivo?: string;
  archivo_nombre?: string;
  archivo_tamanio?: number;
  duracion?: number;
};

export type ChatStoreSnapshot = {
  conversationsState: Conversation[];
  selectedChat: number | null;
  allMessagesCache: Record<string, ChatMessage[]>;
  messagesLoading: Record<string, boolean>;
  messagesEndReached: Record<string, boolean>;
  currentMessageIndex: Record<string, number>;
  typingUsers: Record<string, boolean>;
  isLoadingMoreMessages: boolean;
};