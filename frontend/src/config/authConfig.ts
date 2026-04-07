/**
 * Auth Configuration
 * Tiempos, endpoints, y constantes para autenticación
 */

export const authConfig = {
  // Endpoints
  endpoints: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout'
  },

  // Tiempos (en milisegundos)
  tokens: {
    // Cuándo refrescar el token antes de que expire (5 minutos)
    refreshThresholdMs: 5 * 60 * 1000,
    // Máximo tiempo de espera para un request de auth
    requestTimeoutMs: 10000
  },

  // Reintentos
  retry: {
    // Máximo de intentos por request
    maxAttempts: 3,
    // Delay inicial (exponencial: 1000ms, 2000ms, 4000ms)
    initialDelayMs: 1000,
    // Solo reintentar estos status codes
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  },

  // Storage keys
  storage: {
    token: 'token',
    refreshToken: 'refreshToken',
    tokenExpiresAt: 'tokenExpiresAt'
  }
};
