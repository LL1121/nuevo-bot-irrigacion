/**
 * Auth utilities
 * Funciones helper para manejo de autenticación y tokens
 */

import { authConfig } from './authConfig';
import { sensitiveStorage } from '../utils/sensitiveStorage';
import { logger } from '../utils/logger';

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
    return sensitiveStorage.getAccessToken();
  },

  /**
   * Guardar token (capa sensitiveStorage; migración futura: cookie HttpOnly)
   */
  setToken: (token: string): void => {
    sensitiveStorage.setAccessToken(token);
  },

  /**
   * Obtener refresh token
   */
  getRefreshToken: (): string | null => {
    return sensitiveStorage.getRefreshToken();
  },

  /**
   * Guardar refresh token
   */
  setRefreshToken: (token: string): void => {
    sensitiveStorage.setRefreshToken(token);
  },

  /**
   * Obtener información del operador
   */
  getOperador: (): OperadorInfo | null => {
    const stored = sensitiveStorage.getOperadorJson();
    return stored ? (JSON.parse(stored) as OperadorInfo) : null;
  },

  /**
   * Guardar información del operador
   */
  setOperador: (operador: OperadorInfo): void => {
    sensitiveStorage.setOperadorJson(JSON.stringify(operador));
  },

  /**
   * Limpiar sesión (logout) - completo
   */
  clearSession: (): void => {
    sensitiveStorage.clearAuthSession();
    sensitiveStorage.clearMessageCacheEntries();
    logger.info('Sesión de operador limpiada (tokens y caché de mensajes)');
  },

  /**
   * Verificar si está autenticado
   */
  isAuthenticated: (): boolean => {
    return !!sensitiveStorage.getAccessToken();
  }
};
