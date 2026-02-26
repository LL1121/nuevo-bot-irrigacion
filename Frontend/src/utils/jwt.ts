/**
 * JWT Utilities
 * Decodificar, validar y extraer información de JWT tokens
 */

interface JWTPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

/**
 * Decodificar un JWT token (solo payload, sin verificación de firma)
 * NOTA: En producción, el servidor debe validar la firma. Esto es solo para extraer claims.
 */
export const decodeJWT = (token: string): JWTPayload | null => {
  try {
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('⚠️ Token JWT inválido (no tiene 3 partes)');
      return null;
    }

    // Decodificar payload (segunda parte)
    const payload = parts[1];
    // Agregar padding si es necesario
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    
    return JSON.parse(decoded);
  } catch (error) {
    console.error('❌ Error decodificando JWT:', error);
    return null;
  }
};

/**
 * Obtener tiempo de expiración del token (en ms desde epoch)
 */
export const getTokenExpiry = (token: string): number | null => {
  const payload = decodeJWT(token);
  if (!payload?.exp) return null;
  // exp está en segundos, convertir a ms
  return payload.exp * 1000;
};

/**
 * Verificar si un token está expirado
 */
export const isTokenExpired = (token: string): boolean => {
  const expiresAt = getTokenExpiry(token);
  if (!expiresAt) return true;
  return Date.now() >= expiresAt;
};

/**
 * Verificar si un token está próximo a expirar (dentro de N ms)
 */
export const isTokenExpiringSoon = (token: string, thresholdMs: number = 5 * 60 * 1000): boolean => {
  const expiresAt = getTokenExpiry(token);
  if (!expiresAt) return true;
  return Date.now() >= (expiresAt - thresholdMs);
};

/**
 * Validar que un token sea válido (formato + no expirado)
 */
export const isTokenValid = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  const payload = decodeJWT(token);
  if (!payload) return false;
  // Token válido si no está expirado y tiene exp
  return payload.exp ? !isTokenExpired(token) : false;
};

/**
 * Obtener tiempo restante del token (en ms)
 */
export const getTokenTimeRemaining = (token: string): number => {
  const expiresAt = getTokenExpiry(token);
  if (!expiresAt) return 0;
  const remaining = expiresAt - Date.now();
  return Math.max(0, remaining);
};
