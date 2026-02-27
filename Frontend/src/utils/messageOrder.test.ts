import { describe, expect, it } from 'vitest';
import { buildMessageIdentity, sortAndDedupeMessages } from './messageOrder';
import type { ChatMessage } from '../types/chat';

const mk = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: overrides.id ?? 'id',
  text: overrides.text ?? 'msg',
  date: overrides.date ?? '2026-01-01T10:00:00.000Z',
  sent: overrides.sent ?? false,
  ...overrides,
});

describe('messageOrder', () => {
  it('sorts messages by timestamp and id', () => {
    const messages = [
      mk({ id: 3, date: '2026-01-01T10:00:03.000Z' }),
      mk({ id: 1, date: '2026-01-01T10:00:01.000Z' }),
      mk({ id: 2, date: '2026-01-01T10:00:01.000Z' }),
    ];

    const result = sortAndDedupeMessages(messages);
    expect(result.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('dedupes by id keeping best candidate', () => {
    const older = mk({ id: 'same', text: 'old', date: '2026-01-01T10:00:00.000Z' });
    const newer = mk({ id: 'same', text: 'new', date: '2026-01-01T10:00:05.000Z' });

    const result = sortAndDedupeMessages([older, newer]);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('new');
  });

  it('uses fallback identity when id is missing and dedupes inside 5s bucket', () => {
    const first = mk({ id: '', text: 'hola', sent: true, date: '2026-01-01T10:00:00.100Z' });
    const second = mk({ id: '', text: 'hola', sent: true, date: '2026-01-01T10:00:03.900Z' });

    const result = sortAndDedupeMessages([first, second]);

    expect(result).toHaveLength(1);
  });

  it('builds different identities for same text with different direction', () => {
    const incoming = mk({ id: '', text: 'ok', sent: false, date: '2026-01-01T10:00:00.000Z' });
    const outgoing = mk({ id: '', text: 'ok', sent: true, date: '2026-01-01T10:00:00.000Z' });

    expect(buildMessageIdentity(incoming)).not.toBe(buildMessageIdentity(outgoing));
  });
});
