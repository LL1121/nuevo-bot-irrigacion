/**
 * Versión actual recomendada del API Client
 * Importar funciones desde aquí
 */

export * as v1 from '../v1';
export * as v2 from '../v2';

// Re-exportar v2 como default (versión actual)
export * from '../v2';

/**
 * Hook para migración fácil entre versiones
 * Uso: const { login, chats } = useAPI()
 */
export function useAPI(version: 'v1' | 'v2' = 'v2') {
  if (version === 'v1') {
    return require('../v1');
  }
  return require('../v2');
}

/**
 * Detectar incompatibilidades entre versiones
 */
export const BREAKING_CHANGES = {
  v1_to_v2: [
    {
      endpoint: 'Chat object structure',
      before: 'chat.messageCount',
      after: 'chat.stats.messageCount',
      impact: 'HIGH - Breaking change',
      migration: 'Update all references from messageCount to stats.messageCount',
    },
    {
      endpoint: 'POST /auth/refresh',
      before: 'POST /v1/auth/refresh with token in header',
      after: 'POST /v2/auth/token with refreshToken in body',
      impact: 'HIGH - Different endpoint and payload',
      migration: 'Use v2/auth.refreshToken(refreshToken) with refresh token string',
    },
    {
      endpoint: 'GET /chats query parameters',
      before: 'page, pageSize',
      after: 'page, pageSize, sortBy, order',
      impact: 'LOW - Backward compatible, new optional parameters',
      migration: 'Optionally use sortBy and order for better UX',
    },
  ],
} as const;

export const API_VERSIONS = {
  v1: {
    status: 'DEPRECATED',
    supportedUntil: '2026-06-01',
    endpoints: ['auth', 'chats', 'messages'],
  },
  v2: {
    status: 'CURRENT',
    releasedAt: '2026-01-15',
    endpoints: ['auth', 'chats', 'messages', 'controls', 'sensors', 'devices'],
    features: ['Sorting', 'Advanced filtering', 'Control actions', 'Real-time sensor data'],
  },
} as const;
