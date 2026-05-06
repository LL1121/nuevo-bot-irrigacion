import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chatStore';
import { mergeMessageBatches } from '../services/messageQueue';
import { applyMessageCachePolicy } from '../utils/messageCachePolicy';
import { deleteConversationByIdWithSelection } from '../utils/chatMutations';
import { env } from '../config/env';
import type { ChatMessage, Conversation } from '../types/chat';

const mkMessage = (id: string | number, dateIso: string, sent = false): ChatMessage => ({
  id,
  text: `msg-${id}`,
  date: dateIso,
  sent,
  read: true,
  type: 'text'
});

const mkConversation = (id: number): Conversation => ({
  id,
  name: `Conv ${id}`,
  phone: `+5492604${String(id).padStart(6, '0')}`,
  unread: id % 5,
  archived: false,
  messages: []
});

describe('stress: high conversation and message load', () => {
  beforeEach(() => {
    useChatStore.getState().resetChatStore();
  });

  it('keeps message ordering and dedupe stable under large merges', () => {
    const baseDate = new Date('2026-01-01T10:00:00.000Z').getTime();
    const batchA: ChatMessage[] = [];
    const batchB: ChatMessage[] = [];

    // 10k + 10k entries, with 5k overlapping IDs to stress dedupe path.
    for (let i = 0; i < 10_000; i++) {
      const isoA = new Date(baseDate + i * 1000).toISOString();
      batchA.push(mkMessage(`id-${i}`, isoA, i % 2 === 0));
    }

    for (let i = 5_000; i < 15_000; i++) {
      const isoB = new Date(baseDate + i * 1000 + 300).toISOString();
      batchB.push(mkMessage(`id-${i}`, isoB, i % 2 !== 0));
    }

    const merged = mergeMessageBatches(batchA, batchB);

    expect(merged).toHaveLength(15_000);
    expect(merged[0].id).toBe('id-0');
    expect(merged[merged.length - 1].id).toBe('id-14999');
  });

  it('enforces cache policy with many chats and many messages per chat', () => {
    const cache: Record<string, ChatMessage[]> = {};
    const now = Date.now();

    for (let c = 0; c < 400; c++) {
      const phone = `+54 9 2604 ${String(c).padStart(6, '0')}`;
      cache[phone] = [];

      for (let m = 0; m < 120; m++) {
        cache[phone].push(
          mkMessage(
            `c${c}-m${m}`,
            new Date(now - (120 - m) * 1000).toISOString(),
            m % 2 === 0
          )
        );
      }
    }

    const constrained = applyMessageCachePolicy(cache, {
      maxChats: 250,
      maxMessagesPerChat: 80,
      ttlMs: 1000 * 60 * 60 * 24
    });

    const chatCount = Object.keys(constrained).length;
    expect(chatCount).toBeLessThanOrEqual(250);

    for (const messages of Object.values(constrained)) {
      expect(messages.length).toBeLessThanOrEqual(80);
    }
  });

  it('updates Zustand store safely with thousands of conversations and constrained cache', () => {
    const store = useChatStore.getState();
    const conversations = Array.from({ length: 5_000 }, (_, i) => mkConversation(i + 1));

    store.setConversationsState(conversations);
    expect(useChatStore.getState().conversationsState).toHaveLength(5_000);

    const heavyCache: Record<string, ChatMessage[]> = {};
    const now = Date.now();

    for (let c = 0; c < 350; c++) {
      const phone = `+5492604${String(c).padStart(6, '0')}`;
      heavyCache[phone] = [
        mkMessage(`a-${c}`, new Date(now - 2000).toISOString()),
        mkMessage(`b-${c}`, new Date(now - 1000).toISOString()),
        mkMessage(`c-${c}`, new Date(now).toISOString()),
      ];
    }

    store.setAllMessagesCache(heavyCache);
    const cachedChats = Object.keys(useChatStore.getState().allMessagesCache).length;
    expect(cachedChats).toBeLessThanOrEqual(env.messageCacheMaxChats);
  });

  it('handles deletion/index shifting correctly on long conversation lists', () => {
    const conversations = Array.from({ length: 3_000 }, (_, i) => mkConversation(i + 1));

    const result = deleteConversationByIdWithSelection(conversations, 1001, 2000);

    expect(result.conversations).toHaveLength(2_999);
    expect(result.selectedChat).toBe(1999);
  });
});