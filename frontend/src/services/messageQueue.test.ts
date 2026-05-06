import { describe, expect, it } from 'vitest';
import { appendIncomingMessage, mergeMessageBatches } from './messageQueue';
import type { ChatMessage } from '../types/chat';

const msg = (id: string | number, date: string, text = 'x'): ChatMessage => ({
  id,
  date,
  text,
  sent: false,
});

describe('messageQueue', () => {
  it('merges batches sorted and deduped', () => {
    const result = mergeMessageBatches(
      [msg(2, '2026-01-01T10:00:02.000Z'), msg(1, '2026-01-01T10:00:01.000Z')],
      [msg(2, '2026-01-01T10:00:03.000Z', 'updated')]
    );

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual([1, 2]);
    expect(result[1].text).toBe('updated');
  });

  it('appends incoming message respecting limit', () => {
    const current = [
      msg(1, '2026-01-01T10:00:01.000Z'),
      msg(2, '2026-01-01T10:00:02.000Z'),
      msg(3, '2026-01-01T10:00:03.000Z'),
    ];

    const result = appendIncomingMessage(current, msg(4, '2026-01-01T10:00:04.000Z'), { limit: 3 });

    expect(result.map((m) => m.id)).toEqual([2, 3, 4]);
  });
});
