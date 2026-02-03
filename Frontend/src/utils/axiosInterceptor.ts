/**
 * Axios Interceptor Configuration
 * Maneja refresh automático de tokens y reintentos
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { authConfig } from '../config/authConfig';
import { auth } from '../config/auth';
import { isTokenExpiringSoon, isTokenValid } from './jwt';
import { env } from '../config/env';

// Flag para evitar múltiples refresh requests simultáneos
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

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
      console.warn('⚠️ No hay refreshToken disponible');
      return null;
    }

    if (env.enableLogging) {
      console.log('🔄 Intentando refrescar token...');
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

      console.log('✅ Token refrescado correctamente');
      return newToken;
    }
  } catch (error) {
    console.error('❌ Error refrescando token:', error);
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
   * Interceptor de request: Agregar token + verificar expiración
   */
  axiosInstance.interceptors.request.use(
    async (config) => {
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
        return Promise.reject(error);
      }

      // Inicializar contador de intentos
      if (!config._retryCount) {
        config._retryCount = 0;
      }

      // Si 401 (token expirado o inválido)
      if (error.response?.status === 401 && config._retryCount === 0) {
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
          console.log(`🔄 Reintentando request (intento ${config._retryCount}/${authConfig.retry.maxAttempts}) en ${delayMs}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
        return axiosInstance(config);
      }

      return Promise.reject(error);
    }
  );
};
