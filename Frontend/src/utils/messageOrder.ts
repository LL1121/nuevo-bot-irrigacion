import { parseTimestamp } from './dateTime';

type MessageLike = {
  id?: string | number;
  date?: string | number | Date;
  text?: unknown;
  sent?: boolean;
};

const asSafeNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && /^\d+$/.test(value.trim())) {
    return Number(value);
  }
  return Number.NaN;
};

const normalizeTextKey = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return String(value ?? '');
  }
};

export const getMessageTimestamp = (message: MessageLike) => {
  if (!message?.date) return 0;
  const ts = parseTimestamp(message.date).valueOf();
  return Number.isFinite(ts) ? ts : 0;
};

export const compareMessages = (a: MessageLike, b: MessageLike) => {
  const timeDiff = getMessageTimestamp(a) - getMessageTimestamp(b);
  if (timeDiff !== 0) return timeDiff;

  const idA = asSafeNumber(a?.id);
  const idB = asSafeNumber(b?.id);
  const bothNumeric = !Number.isNaN(idA) && !Number.isNaN(idB);
  if (bothNumeric) return idA - idB;

  const strA = String(a?.id ?? '');
  const strB = String(b?.id ?? '');
  if (strA !== strB) return strA.localeCompare(strB);

  const textDiff = normalizeTextKey(a?.text).localeCompare(normalizeTextKey(b?.text));
  if (textDiff !== 0) return textDiff;

  return (a?.sent ? 1 : 0) - (b?.sent ? 1 : 0);
};

export const buildMessageIdentity = (message: MessageLike) => {
  if (message?.id !== undefined && message?.id !== null && message?.id !== '') {
    return `id:${String(message.id)}`;
  }

  const ts = getMessageTimestamp(message);
  const bucket = ts ? Math.floor(ts / 5000) : 0;
  const textKey = normalizeTextKey(message?.text);
  return `fallback:${textKey}:${message?.sent ? 'sent' : 'recv'}:${bucket}`;
};

export const sortAndDedupeMessages = <T extends MessageLike>(messages: T[]) => {
  const byIdentity = new Map<string, T>();

  for (const message of messages) {
    const identity = buildMessageIdentity(message);
    const existing = byIdentity.get(identity);

    if (!existing) {
      byIdentity.set(identity, message);
      continue;
    }

    const candidateIsBetter = compareMessages(existing, message) <= 0;
    if (candidateIsBetter) {
      byIdentity.set(identity, message);
    }
  }

  return Array.from(byIdentity.values()).sort((a, b) => compareMessages(a, b));
};
