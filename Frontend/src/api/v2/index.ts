/**
 * API Client v2 - Versión actual con mejoras
 * 
 * Cambios desde v1:
 * - getPaginatedChats: nuevo parámetro 'sortBy' y 'order'
 * - Chat.messageCount → Chat.stats.messageCount (breaking change)
 * - refreshToken endpoint cambió a POST /v2/auth/token con diferente payload
 * - Nuevo endpoint: getControlActions()
 * - Nuevo endpoint: executeSensorRead()
 */

import { ApiResponse, PaginatedResponse, User, Chat, Message, AuthToken, ControlAction, SensorReading } from '../types';
import { logger } from '../../utils/logger';
import { trackApiCall } from '../../utils/monitoring';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Error handler centralizado para v2
 */
function handleError(error: unknown): never {
  if (error instanceof Error) {
    logger.error('API v2 Error:', error.message);
    throw new Error(`API v2 Error: ${error.message}`);
  }
  throw error;
}

/**
 * Obtener headers con autenticación
 */
function getHeaders(token?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Version': 'v2',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}

// ============= Auth =============

/**
 * Login endpoint v2
 * @param email User email
 * @param password User password
 * @returns AuthToken with access and refresh tokens
 */
export async function login(email: string, password: string): Promise<ApiResponse<AuthToken>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('POST /v2/auth/login', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('POST /v2/auth/login', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Refresh token endpoint v2 (BREAKING CHANGE)
 * v1: POST /v1/auth/refresh with token in header
 * v2: POST /v2/auth/token with refreshToken in body
 */
export async function refreshToken(refreshToken: string): Promise<ApiResponse<AuthToken>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/auth/token`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('POST /v2/auth/token', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('POST /v2/auth/token', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(token: string): Promise<ApiResponse<User>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/auth/me`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('GET /v2/auth/me', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('GET /v2/auth/me', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

// ============= Chats =============

/**
 * Get paginated chats (v2 with sortBy parameter)
 * NEW in v2: sortBy, order parameters
 * BREAKING: messageCount is now under stats object
 */
export async function getPaginatedChats(
  token: string,
  page: number = 1,
  pageSize: number = 10,
  sortBy: 'createdAt' | 'updatedAt' | 'title' = 'updatedAt',
  order: 'asc' | 'desc' = 'desc',
): Promise<ApiResponse<PaginatedResponse<Chat>>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      order,
    });
    
    const response = await fetch(`${API_URL}/v2/chats?${params}`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('GET /v2/chats', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('GET /v2/chats', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Get single chat by ID
 */
export async function getChat(chatId: string, token: string): Promise<ApiResponse<Chat>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/chats/${chatId}`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('GET /v2/chats/:id', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('GET /v2/chats/:id', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Create new chat
 */
export async function createChat(
  token: string,
  data: { title: string; description?: string },
): Promise<ApiResponse<Chat>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/chats`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    trackApiCall('POST /v2/chats', performance.now() - startTime, 'success');
    return result;
  } catch (error) {
    trackApiCall('POST /v2/chats', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Delete chat
 */
export async function deleteChat(chatId: string, token: string): Promise<ApiResponse<void>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/chats/${chatId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('DELETE /v2/chats/:id', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('DELETE /v2/chats/:id', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Get messages from a chat
 */
export async function getChatMessages(
  chatId: string,
  token: string,
  page: number = 1,
): Promise<ApiResponse<PaginatedResponse<Message>>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams({ page: String(page) });
    const response = await fetch(`${API_URL}/v2/chats/${chatId}/messages?${params}`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('GET /v2/chats/:id/messages', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('GET /v2/chats/:id/messages', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Send message to chat
 */
export async function sendMessage(
  chatId: string,
  token: string,
  content: string,
): Promise<ApiResponse<Message>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/chats/${chatId}/messages`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ content }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('POST /v2/chats/:id/messages', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('POST /v2/chats/:id/messages', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

// ============= Controls (NEW in v2) =============

/**
 * Get control actions for a device
 * NEW endpoint in v2
 */
export async function getControlActions(
  deviceId: string,
  token: string,
  page: number = 1,
): Promise<ApiResponse<PaginatedResponse<ControlAction>>> {
  const startTime = performance.now();
  try {
    const params = new URLSearchParams({ page: String(page) });
    const response = await fetch(`${API_URL}/v2/devices/${deviceId}/actions?${params}`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('GET /v2/devices/:id/actions', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('GET /v2/devices/:id/actions', performance.now() - startTime, 'error');
    return handleError(error);
  }
}

/**
 * Execute sensor read command
 * NEW endpoint in v2
 */
export async function executeSensorRead(
  deviceId: string,
  token: string,
): Promise<ApiResponse<SensorReading>> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/v2/devices/${deviceId}/read`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    trackApiCall('POST /v2/devices/:id/read', performance.now() - startTime, 'success');
    return data;
  } catch (error) {
    trackApiCall('POST /v2/devices/:id/read', performance.now() - startTime, 'error');
    return handleError(error);
  }
}
