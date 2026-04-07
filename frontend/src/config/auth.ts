/**
 * Auth utilities
 * Funciones helper para manejo de autenticación y tokens
 */

import { authConfig } from './authConfig';

export type OperadorInfo = {
  id?: string | number;
  username?: string;
  nombre?: string;
  email?: string;
  role?: string;
  subdelegacion_id?: string | number | null;
  subdelegacion_nombre?: string | null;
  subdelegacion_codigo?: string | null;
  permissions?: {
    queueScope?: string;
    [key: string]: unknown;
  } | string[];
  [key: string]: unknown;
};

export const auth = {
  /**
   * Obtener token del localStorage
   */
  getToken: (): string | null => {
    return localStorage.getItem(authConfig.storage.token);
  },

  /**
   * Guardar token en localStorage
   */
  setToken: (token: string): void => {
    localStorage.setItem(authConfig.storage.token, token);
  },

  /**
   * Obtener refresh token
   */
  getRefreshToken: (): string | null => {
    return localStorage.getItem(authConfig.storage.refreshToken);
  },

  /**
   * Guardar refresh token
   */
  setRefreshToken: (token: string): void => {
    localStorage.setItem(authConfig.storage.refreshToken, token);
  },

  /**
   * Obtener información del operador
   */
  getOperador: (): OperadorInfo | null => {
    const stored = localStorage.getItem('operador');
    return stored ? (JSON.parse(stored) as OperadorInfo) : null;
  },

  /**
   * Guardar información del operador
   */
  setOperador: (operador: OperadorInfo): void => {
    localStorage.setItem('operador', JSON.stringify(operador));
  },

  /**
   * Limpiar sesión (logout) - completo
   */
  clearSession: (): void => {
    // Remover tokens
    localStorage.removeItem(authConfig.storage.token);
    localStorage.removeItem(authConfig.storage.refreshToken);
    localStorage.removeItem(authConfig.storage.tokenExpiresAt);
    localStorage.removeItem('operador');
    
    // Limpiar caché de mensajes
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('messages_')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('🗑️ Sesión limpiada completamente');
  },

  /**
   * Verificar si está autenticado
   */
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem(authConfig.storage.token);
    return !!token;
  }
};
