/**
 * Environment Configuration
 * Centraliza todas las variables de entorno y proporciona valores por defecto seguros
 */

export const env = {
  // API & Socket
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  socketUrl: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000',

  // Auth
  tokenKey: import.meta.env.VITE_TOKEN_KEY || 'token',
  operadorKey: import.meta.env.VITE_OPERADOR_KEY || 'operador',
  jwtExpiryMs: parseInt(import.meta.env.VITE_JWT_EXPIRY_MS || '3600000', 10),

  // Feature Flags
  enableLogging: import.meta.env.VITE_ENABLE_LOGGING === 'true',
  enableSentry: import.meta.env.VITE_ENABLE_SENTRY === 'true',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || '',

  // Timeouts
  requestTimeoutMs: parseInt(import.meta.env.VITE_REQUEST_TIMEOUT_MS || '30000', 10),
  socketReconnectDelayMs: parseInt(import.meta.env.VITE_SOCKET_RECONNECT_DELAY_MS || '1000', 10),
  socketReconnectAttempts: parseInt(import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS || '5', 10),
  sessionTimeoutMs: parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MS || '86400000', 10),

  // Derived values
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
};

// Validator: Asegurar que URLs no terminen con /
if (env.apiUrl.endsWith('/')) {
  env.apiUrl = env.apiUrl.slice(0, -1);
}
if (env.socketUrl.endsWith('/')) {
  env.socketUrl = env.socketUrl.slice(0, -1);
}

// Log config en desarrollo
if (env.isDevelopment && env.enableLogging) {
  console.log('📋 Configuración cargada:', {
    apiUrl: env.apiUrl,
    socketUrl: env.socketUrl,
    enableSentry: env.enableSentry,
    sessionTimeoutMs: env.sessionTimeoutMs
  });
}
