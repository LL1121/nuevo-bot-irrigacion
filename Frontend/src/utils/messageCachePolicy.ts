import { env } from '../config/env';
import type { ChatMessage } from '../types/chat';
import { sortAndDedupeMessages, getMessageTimestamp } from './messageOrder';

type MessageCache = Record<string, ChatMessage[]>;

type MessageCachePolicyOptions = {
  maxChats: number;
  maxMessagesPerChat: number;
  ttlMs: number;
};

const DEFAULT_OPTIONS: MessageCachePolicyOptions = {
  maxChats: env.messageCacheMaxChats,
  maxMessagesPerChat: env.messageCacheMaxMessagesPerChat,
  ttlMs: env.messageCacheTtlMs
};

const normalizePhoneKey = (key: string) => key.replace(/\D/g, '');

const applyPerChatPolicy = (
  messages: ChatMessage[],
  options: MessageCachePolicyOptions,
  nowMs: number
): ChatMessage[] => {
  const ttlCutoff = nowMs - options.ttlMs;

  const ttlFiltered = messages.filter((message) => {
    const ts = getMessageTimestamp(message);
    if (!ts) return true;
    return ts >= ttlCutoff;
  });

  const sortedDeduped = sortAndDedupeMessages(ttlFiltered);
  return sortedDeduped.slice(-options.maxMessagesPerChat);
};

export const applyMessageCachePolicy = (
  cache: MessageCache,
  options: Partial<MessageCachePolicyOptions> = {}
): MessageCache => {
  const resolved: MessageCachePolicyOptions = {
    maxChats: Math.max(1, options.maxChats ?? DEFAULT_OPTIONS.maxChats),
    maxMessagesPerChat: Math.max(1, options.maxMessagesPerChat ?? DEFAULT_OPTIONS.maxMessagesPerChat),
    ttlMs: Math.max(60_000, options.ttlMs ?? DEFAULT_OPTIONS.ttlMs)
  };

  const nowMs = Date.now();

  const normalizedEntries = Object.entries(cache)
    .map(([phone, messages]) => {
      const safePhone = normalizePhoneKey(phone);
      if (!safePhone || !Array.isArray(messages)) return null;

      const constrainedMessages = applyPerChatPolicy(messages, resolved, nowMs);
      if (constrainedMessages.length === 0) return null;

      const lastTs = constrainedMessages.length > 0
        ? getMessageTimestamp(constrainedMessages[constrainedMessages.length - 1])
        : 0;

      return {
        phone: safePhone,
        messages: constrainedMessages,
        lastTs
      };
    })
    .filter((entry): entry is { phone: string; messages: ChatMessage[]; lastTs: number } => !!entry)
    .sort((a, b) => b.lastTs - a.lastTs)
    .slice(0, resolved.maxChats);

  return normalizedEntries.reduce<MessageCache>((acc, entry) => {
    acc[entry.phone] = entry.messages;
    return acc;
  }, {});
};
