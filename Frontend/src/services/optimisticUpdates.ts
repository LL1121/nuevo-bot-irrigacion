import { parseTimestamp } from '../utils/dateTime';

type PendingEntry = {
  tempId: string | number;
  phone: string;
  textKey: string;
  createdAt: number;
};

const MAX_ENTRY_AGE_MS = 2 * 60 * 1000;
const pendingByPhone = new Map<string, PendingEntry[]>();

const normalizeTextKey = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return String(value ?? '');
  }
};

const normalizePhone = (phone?: string) => (phone || '').replace(/\D/g, '');

const cleanup = (phone: string, nowMs = Date.now()) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;
  const list = pendingByPhone.get(normalizedPhone) || [];
  const fresh = list.filter((entry) => nowMs - entry.createdAt <= MAX_ENTRY_AGE_MS);
  if (fresh.length === 0) {
    pendingByPhone.delete(normalizedPhone);
    return;
  }
  pendingByPhone.set(normalizedPhone, fresh);
};

export const registerPendingMessage = (params: {
  tempId: string | number;
  phone?: string;
  text?: unknown;
  createdAt?: string | number | Date;
}) => {
  const phone = normalizePhone(params.phone);
  if (!phone) return;

  const createdAt = params.createdAt ? parseTimestamp(params.createdAt).valueOf() : Date.now();
  const entry: PendingEntry = {
    tempId: params.tempId,
    phone,
    textKey: normalizeTextKey(params.text),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now()
  };

  cleanup(phone, Date.now());
  const list = pendingByPhone.get(phone) || [];
  pendingByPhone.set(phone, [...list, entry]);
};

export const removePendingMessage = (phone?: string, tempId?: string | number) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || tempId === undefined || tempId === null) return;

  const list = pendingByPhone.get(normalizedPhone) || [];
  const next = list.filter((entry) => entry.tempId !== tempId);
  if (next.length === 0) {
    pendingByPhone.delete(normalizedPhone);
    return;
  }
  pendingByPhone.set(normalizedPhone, next);
};

export const consumePendingByMatch = (params: {
  phone?: string;
  text?: unknown;
  timestamp?: string | number | Date;
}) => {
  const phone = normalizePhone(params.phone);
  if (!phone) return null;

  cleanup(phone, Date.now());
  const list = pendingByPhone.get(phone) || [];
  if (list.length === 0) return null;

  const textKey = normalizeTextKey(params.text);
  const targetTs = params.timestamp ? parseTimestamp(params.timestamp).valueOf() : Date.now();

  const index = list.findIndex((entry) => {
    const closeInTime = Math.abs(entry.createdAt - targetTs) <= MAX_ENTRY_AGE_MS;
    return entry.textKey === textKey && closeInTime;
  });

  if (index === -1) return null;

  const [matched] = list.splice(index, 1);
  if (list.length === 0) {
    pendingByPhone.delete(phone);
  } else {
    pendingByPhone.set(phone, list);
  }

  return matched.tempId;
};
