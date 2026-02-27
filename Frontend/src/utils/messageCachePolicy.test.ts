import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMessageCachePolicy } from './messageCachePolicy';
import type { ChatMessage } from '../types/chat';

const mkMessage = (id: string | number, date: string): ChatMessage => ({
  id,
  date,
  text: `m-${id}`,
  sent: false,
});

describe('messageCachePolicy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes phone keys and enforces max messages per chat', () => {
    const now = new Date('2026-01-10T12:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const result = applyMessageCachePolicy(
      {
        '+54 9 261 123-4567': [
          mkMessage(1, '2026-01-10T11:50:00.000Z'),
          mkMessage(2, '2026-01-10T11:51:00.000Z'),
          mkMessage(3, '2026-01-10T11:52:00.000Z'),
        ],
      },
      { maxMessagesPerChat: 2, ttlMs: 24 * 60 * 60 * 1000 }
    );

    expect(Object.keys(result)).toEqual(['5492611234567']);
    expect(result['5492611234567'].map((m) => m.id)).toEqual([2, 3]);
  });

  it('drops messages outside ttl and removes empty chats', () => {
    const now = new Date('2026-01-10T12:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const result = applyMessageCachePolicy(
      {
        '2611111111': [mkMessage(1, '2026-01-01T12:00:00.000Z')],
        '2612222222': [mkMessage(2, '2026-01-10T11:59:00.000Z')],
      },
      { ttlMs: 2 * 60 * 1000 }
    );

    expect(result['2611111111']).toBeUndefined();
    expect(result['2612222222']).toHaveLength(1);
  });

  it('keeps most recent chats up to maxChats', () => {
    const now = new Date('2026-01-10T12:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const result = applyMessageCachePolicy(
      {
        '1': [mkMessage('a', '2026-01-10T10:00:00.000Z')],
        '2': [mkMessage('b', '2026-01-10T11:00:00.000Z')],
        '3': [mkMessage('c', '2026-01-10T11:30:00.000Z')],
      },
      { maxChats: 2, ttlMs: 24 * 60 * 60 * 1000 }
    );

    const keys = Object.keys(result);
    expect(keys).toHaveLength(2);
    expect(keys).toContain('2');
    expect(keys).toContain('3');
    expect(keys).not.toContain('1');
  });
});
