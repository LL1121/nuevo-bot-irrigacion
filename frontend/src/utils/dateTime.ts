/**
 * Sistema robusto de manejo de fechas y timestamps
 * Soluciona problemas de timezone, parsing inconsistente y formateo
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import 'dayjs/locale/es';

// Configurar plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(isSameOrBefore);
dayjs.locale('es');

// Timezone del usuario (Argentina)
const USER_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Parsea cualquier formato de timestamp a dayjs
 * Maneja: ISO 8601, timestamps numéricos, strings, Date objects
 */
export function parseTimestamp(value: unknown): dayjs.Dayjs {
  if (!value) {
    return dayjs();
  }

  // Si ya es dayjs, retornar
  if (dayjs.isDayjs(value)) {
    return value;
  }

  // Si es Date object
  if (value instanceof Date) {
    return dayjs(value);
  }

  // Si es número (unix timestamp en ms o seg)
  if (typeof value === 'number') {
    // Si es mayor a año 3000 en segundos, asumir que está en ms
    return value > 32503680000 ? dayjs(value) : dayjs.unix(value);
  }

  // Si es string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Intentar parsear como ISO 8601 (con o sin timezone)
    if (trimmed.includes('T') || trimmed.includes('Z')) {
      const parsed = dayjs(trimmed);
      if (parsed.isValid()) {
        return parsed;
      }
    }

    // Intentar parsear como unix timestamp string
    const asNumber = Number(trimmed);
    if (!isNaN(asNumber)) {
      return parseTimestamp(asNumber);
    }

    // Último intento: parseo genérico
    const parsed = dayjs(trimmed);
    if (parsed.isValid()) {
      return parsed;
    }
  }

  // Fallback: ahora
  console.warn('⚠️ No se pudo parsear timestamp:', value);
  return dayjs();
}

/**
 * Formatea un timestamp para mostrar en mensajes
 * - Hoy: "HH:mm" (24hs)
 * - Ayer: "Ayer"
 * - Esta semana: "lun", "mar", etc
 * - Más viejo: "DD/MM"
 */
export function formatMessageTime(timestamp: unknown): string {
  const date = parseTimestamp(timestamp).tz(USER_TIMEZONE);
  const now = dayjs().tz(USER_TIMEZONE);

  // Mismo día
  if (date.isSame(now, 'day')) {
    return date.format('HH:mm');
  }

  // Ayer
  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Ayer';
  }

  // Esta semana (últimos 7 días)
  const diffDays = now.diff(date, 'day');
  if (diffDays < 7) {
    return date.format('ddd'); // lun, mar, mié, etc
  }

  // Más viejo
  return date.format('DD/MM');
}

/**
 * Formatea timestamp para header de chat (más detalle)
 * - Hoy: "Hoy a las HH:mm"
 * - Ayer: "Ayer a las HH:mm"
 * - Esta semana: "Lunes a las HH:mm"
 * - Más viejo: "DD/MM/YYYY HH:mm"
 */
export function formatChatHeaderTime(timestamp: unknown): string {
  const date = parseTimestamp(timestamp).tz(USER_TIMEZONE);
  const now = dayjs().tz(USER_TIMEZONE);

  const timeStr = date.format('HH:mm');

  // Mismo día
  if (date.isSame(now, 'day')) {
    return `Hoy a las ${timeStr}`;
  }

  // Ayer
  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return `Ayer a las ${timeStr}`;
  }

  // Esta semana
  const diffDays = now.diff(date, 'day');
  if (diffDays < 7) {
    const dayName = date.format('dddd'); // lunes, martes, etc
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} a las ${timeStr}`;
  }

  // Más viejo
  return date.format('DD/MM/YYYY HH:mm');
}

/**
 * Convierte un timestamp a ISO 8601 UTC para almacenamiento
 */
export function toUTC(timestamp: unknown): string {
  return parseTimestamp(timestamp).utc().toISOString();
}

/**
 * Convierte un timestamp a la zona horaria del usuario
 */
export function toUserTimezone(timestamp: unknown): dayjs.Dayjs {
  return parseTimestamp(timestamp).tz(USER_TIMEZONE);
}

/**
 * Verifica si un timestamp es válido
 */
export function isValidTimestamp(timestamp: unknown): boolean {
  if (!timestamp) return false;
  const parsed = parseTimestamp(timestamp);
  return parsed.isValid();
}

/**
 * Obtiene el timestamp actual en UTC
 */
export function nowUTC(): string {
  return dayjs().utc().toISOString();
}

/**
 * Obtiene el timestamp actual en timezone del usuario
 */
export function now(): dayjs.Dayjs {
  return dayjs().tz(USER_TIMEZONE);
}

/**
 * Verifica si una sesión de chat está expirada (>24hs)
 */
export function isSessionExpired(lastInteraction: unknown): boolean {
  if (!lastInteraction) return false;
  
  const last = parseTimestamp(lastInteraction);
  const now = dayjs();
  const diffHours = now.diff(last, 'hour');
  
  return diffHours > 24;
}

/**
 * Agrupa mensajes por día para separadores en UI
 */
export function groupMessagesByDay<T extends { date: unknown }>(messages: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  messages.forEach((msg) => {
    const date = parseTimestamp(msg.date).tz(USER_TIMEZONE);
    const dayKey = date.format('YYYY-MM-DD');

    if (!groups.has(dayKey)) {
      groups.set(dayKey, []);
    }
    groups.get(dayKey)!.push(msg);
  });

  return groups;
}

/**
 * Formatea una key de día para mostrar en separadores
 * Ej: "Hoy", "Ayer", "Lunes 23 de Febrero"
 */
export function formatDaySeparator(dayKey: string): string {
  const date = dayjs(dayKey).tz(USER_TIMEZONE);
  const now = dayjs().tz(USER_TIMEZONE);

  if (date.isSame(now, 'day')) {
    return 'Hoy';
  }

  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Ayer';
  }

  const diffDays = now.diff(date, 'day');
  if (diffDays < 7) {
    return date.format('dddd D [de] MMMM');
  }

  return date.format('D [de] MMMM [de] YYYY');
}

/**
 * Debug: Muestra información detallada del timestamp
 */
export function debugTimestamp(timestamp: unknown): void {
  const parsed = parseTimestamp(timestamp);
  console.log('🕐 DEBUG TIMESTAMP:', {
    input: timestamp,
    parsed: parsed.format('YYYY-MM-DD HH:mm:ss Z'),
    utc: parsed.utc().format('YYYY-MM-DD HH:mm:ss'),
    local: parsed.tz(USER_TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
    unix: parsed.unix(),
    isValid: parsed.isValid()
  });
}
