/**
 * Tipos compartidos entre versiones de API
 * Estos tipos son base y pueden extenderse en cada versión
 */

// ============= Respuestas =============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============= Auth =============
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// ============= Chats =============
export interface Chat {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  content: string;
  type: 'user' | 'assistant';
  metadata?: {
    model?: string;
    tokens?: number;
    responseTime?: number;
  };
  createdAt: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  messageId: string;
  type: 'image' | 'file' | 'document';
  url: string;
  mimeType: string;
  size: number;
  name: string;
}

// ============= Controls/Irrigación =============
export interface IrrigationSystem {
  id: string;
  userId: string;
  name: string;
  location?: string;
  status: 'active' | 'inactive' | 'error';
  lastCheckAt?: string;
  devices: Device[];
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  systemId: string;
  name: string;
  type: 'sensor' | 'pump' | 'valve' | 'controller';
  status: 'online' | 'offline' | 'error';
  batteryLevel?: number;
  lastReadAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SensorReading {
  id: string;
  deviceId: string;
  type: 'temperature' | 'humidity' | 'moisture' | 'pressure';
  value: number;
  unit: string;
  timestamp: string;
}

export interface ControlAction {
  id: string;
  deviceId: string;
  action: 'turn_on' | 'turn_off' | 'calibrate' | 'schedule';
  parameters?: Record<string, unknown>;
  status: 'pending' | 'executing' | 'success' | 'failed';
  result?: unknown;
  createdAt: string;
  completedAt?: string;
}

// ============= Notifications =============
export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

// ============= Settings =============
export interface UserSettings {
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    dataCollection: boolean;
    analyticsSharing: boolean;
  };
  updatedAt: string;
}

// ============= Analytics =============
export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}
