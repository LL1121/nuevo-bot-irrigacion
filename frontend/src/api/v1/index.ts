/**
 * API Client v1 - Versión inicial (DEPRECATED en v2)
 * 
 * Cambios en v2:
 * - getPaginatedChats: nuevo parámetro 'sortBy'
 * - Chat.messageCount → Chat.stats.messageCount (breaking change)
 * - refreshToken endpoint cambió
 */

import { ApiResponse, PaginatedResponse, User, Chat, Message, AuthToken } from '../types';
import { logger } from '../../utils/logger';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Error handler centralizado para v1
 */
function handleError(error: unknown): never {
  if (error instanceof Error) {
    logger.error('API v1 Error:', error.message);
    throw new Error(`API v1 Error: ${error.message}`);
  }
  throw error;
}

/**
 * Obtener headers con autenticación
 */
function getHeaders(token?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Version': 'v1',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}

// ============= Auth =============

/**
 * @deprecated Use v2/auth.login() instead
 * Login endpoint v1
 */
export async function login(email: string, password: string): Promise<ApiResponse<AuthToken>> {
  try {
    const response = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleError(error);
  }
}

/**
 * @deprecated Use v2/auth.refreshToken() instead
 * Refresh token endpoint v1
 */
export async function refreshToken(token: string): Promise<ApiResponse<AuthToken>> {
  try {
    const response = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(token: string): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`${API_URL}/v1/auth/me`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleError(error);
  }
}

// ============= Chats =============

/**
 * @deprecated Use v2/chats.getPaginatedChats() instead - now with sortBy parameter
 * Get paginated chats (v1 version)
 */
export async function getPaginatedChats(
  token: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<ApiResponse<PaginatedResponse<Chat>>> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    
    const response = await fetch(`${API_URL}/v1/chats?${params}`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get single chat by ID
 */
export async function getChat(chatId: string, token: string): Promise<ApiResponse<Chat>> {
  try {
    const response = await fetch(`${API_URL}/v1/chats/${chatId}`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
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
  try {
    const response = await fetch(`${API_URL}/v1/chats`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
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
  try {
    const params = new URLSearchParams({ page: String(page) });
    const response = await fetch(`${API_URL}/v1/chats/${chatId}/messages?${params}`, {
      headers: getHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
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
  try {
    const response = await fetch(`${API_URL}/v1/chats/${chatId}/messages`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ content }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    return handleError(error);
  }
}
