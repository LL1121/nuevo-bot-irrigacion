/**
 * Axios Interceptor Configuration
 * Maneja refresh automático de tokens y reintentos
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { authConfig } from '../config/authConfig';
import { auth } from '../config/auth';
import { isTokenExpiringSoon, isTokenValid } from './jwt';
import { env } from '../config/env';
import { logger, captureException } from './logger';

// Flag para evitar múltiples refresh requests simultáneos
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Rate limiting: track request times per endpoint
const requestTimestamps: Record<string, number[]> = {};
const RATE_LIMIT_WINDOW_MS = 60000; // 60 segundos
const RATE_LIMIT_MAX_REQUESTS = 10; // máximo 10 requests por ventana

/**
 * Check if request exceeds rate limit
 */
const isRateLimited = (endpoint: string): boolean => {
  const now = Date.now();
  if (!requestTimestamps[endpoint]) {
    requestTimestamps[endpoint] = [];
  }

  // Limpiar timestamps viejos (fuera de la ventana)
  requestTimestamps[endpoint] = requestTimestamps[endpoint].filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (requestTimestamps[endpoint].length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  requestTimestamps[endpoint].push(now);
  return false;
};

/**
 * Suscribirse a eventos de refresh completado
 */
const onRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

/**
 * Agregar callback a ejecutar cuando refresh se complete
 */
const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

/**
 * Intentar refrescar el token usando refreshToken
 */
const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const refreshToken = localStorage.getItem(authConfig.storage.refreshToken);
    
    if (!refreshToken) {
      logger.warn('⚠️ No hay refreshToken disponible');
      return null;
    }

    if (env.enableLogging) {
      logger.info('🔄 Intentando refrescar token...');
    }

    const response = await axios.post(
      authConfig.endpoints.refresh,
      { refreshToken },
      { timeout: authConfig.tokens.requestTimeoutMs }
    );

    const newToken = response.data?.token;
    
    if (newToken) {
      auth.setToken(newToken);

      // Actualizar expiración si viene en la respuesta
      if (response.data?.expiresIn) {
        const expiresAt = Date.now() + (response.data.expiresIn * 1000);
        localStorage.setItem(authConfig.storage.tokenExpiresAt, expiresAt.toString());
      }

      logger.info('✅ Token refrescado correctamente');
      return newToken;
    }
  } catch (error) {
    captureException(error, { phase: 'refreshAccessToken' });
    // Si refresh falla, logout forzado
    auth.clearSession();
  }

  return null;
};

/**
 * Configurar interceptores de Axios
 */
export const setupAxiosInterceptors = (axiosInstance: AxiosInstance) => {
  /**
   * Interceptor de request: Agregar token + verificar expiración + rate limiting
   */
  axiosInstance.interceptors.request.use(
    async (config) => {
      const endpoint = config.url || '';

      // No aplicar auth ni rate limit en login/refresh
      if (endpoint.includes(authConfig.endpoints.login) || endpoint.includes(authConfig.endpoints.refresh)) {
        return config;
      }

      // Rate limiting check (skip para endpoint de refresh)
      if (!endpoint.includes('/refresh') && isRateLimited(endpoint)) {
        const err = new Error('Rate limit exceeded. Too many requests to this endpoint.');
        captureException(err, { phase: 'rateLimited', endpoint });
        return Promise.reject(err);
      }

      const token = auth.getToken();

      // Si el token expira pronto, refrescarlo ahora
      if (token && isTokenExpiringSoon(token, authConfig.tokens.refreshThresholdMs)) {
        if (env.enableLogging) {
          console.log('🔄 Token expira pronto, refrescando...');
        }
        
        if (!isRefreshing) {
          isRefreshing = true;
          const newToken = await refreshAccessToken();
          isRefreshing = false;

          if (newToken) {
            onRefreshed(newToken);
            config.headers.Authorization = `Bearer ${newToken}`;
          } else {
            // Si refresh falló, no agregar token (será 401)
            return config;
          }
        } else {
          // Refresh ya en progreso, esperar
          return new Promise((resolve) => {
            addRefreshSubscriber((newToken: string) => {
              config.headers.Authorization = `Bearer ${newToken}`;
              resolve(config);
            });
          });
        }
      } else if (token) {
        // Token válido, agregarlo
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  /**
   * Interceptor de response: Manejar 401 y reintentos
   */
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as any;

      // Si no hay config, no podemos reintentar
      if (!config) {
        captureException(error, { phase: 'axiosResponse', note: 'no-config' });
        return Promise.reject(error);
      }

      // Inicializar contador de intentos
      if (!config._retryCount) {
        config._retryCount = 0;
      }

      // Si 401 (token expirado o inválido)
      if (
        error.response?.status === 401 &&
        config._retryCount === 0 &&
        !String(config.url || '').includes(authConfig.endpoints.login)
      ) {
        config._retryCount++;

        if (!isRefreshing) {
          isRefreshing = true;
          const newToken = await refreshAccessToken();
          isRefreshing = false;

          if (newToken) {
            onRefreshed(newToken);
            config.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstance(config);
          } else {
            // Refresh falló, logout forzado
            return Promise.reject(error);
          }
        } else {
          // Esperar a que refresh se complete
          return new Promise((resolve) => {
            addRefreshSubscriber((newToken: string) => {
              config.headers.Authorization = `Bearer ${newToken}`;
              resolve(axiosInstance(config));
            });
          });
        }
      }

      // Reintentos exponenciales para otros errores
      if (
        authConfig.retry.retryableStatusCodes.includes(error.response?.status || 0) &&
        config._retryCount < authConfig.retry.maxAttempts
      ) {
        config._retryCount++;
        const delayMs = authConfig.retry.initialDelayMs * Math.pow(2, config._retryCount - 1);

        if (env.enableLogging) {
          logger.info(`🔄 Reintentando request (intento ${config._retryCount}/${authConfig.retry.maxAttempts}) en ${delayMs}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
        return axiosInstance(config);
      }

      captureException(error, { phase: 'axiosResponse', retryCount: config._retryCount });
      return Promise.reject(error);
    }
  );
};
