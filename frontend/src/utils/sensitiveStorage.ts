/**
 * Capa única para tokens y datos de sesión del operador en el cliente.
 *
 * Hoy persiste en localStorage por compatibilidad con el flujo actual.
 * Cuando el backend exponga login con cookies HttpOnly + SameSite y axios
 * use `withCredentials: true`, sustituir los métodos aquí por no-ops en
 * cliente y dejar que el navegador envíe la cookie automáticamente.
 */

import { env } from '../config/env';
import { authConfig } from '../config/authConfig';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
};

const remove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const accessTokenKey = () => env.tokenKey || authConfig.storage.token;
const refreshTokenKey = () => authConfig.storage.refreshToken;
const expiresAtKey = () => authConfig.storage.tokenExpiresAt;
const operadorKey = () => env.operadorKey || 'operador';

export const sensitiveStorage = {
  getAccessToken: (): string | null => read(accessTokenKey()),
  setAccessToken: (token: string) => write(accessTokenKey(), token),

  getRefreshToken: (): string | null => read(refreshTokenKey()),
  setRefreshToken: (token: string) => write(refreshTokenKey(), token),

  getTokenExpiresAt: (): string | null => read(expiresAtKey()),
  setTokenExpiresAt: (iso: string) => write(expiresAtKey(), iso),

  getOperadorJson: (): string | null => read(operadorKey()),
  setOperadorJson: (json: string) => write(operadorKey(), json),

  clearAuthSession: () => {
    remove(accessTokenKey());
    remove(refreshTokenKey());
    remove(expiresAtKey());
    remove(operadorKey());
  },

  clearMessageCacheEntries: () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith('messages_')) keys.push(k);
      }
      keys.forEach((k) => remove(k));
    } catch {
      /* ignore */
    }
  }
};
