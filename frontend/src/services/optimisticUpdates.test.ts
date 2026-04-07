import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumePendingByMatch, registerPendingMessage, removePendingMessage } from './optimisticUpdates';

describe('optimisticUpdates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers and consumes by text + near timestamp', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T10:00:15.000Z').getTime());

    const createdAt = '2026-01-01T10:00:00.000Z';
    registerPendingMessage({
      tempId: 'temp-1',
      phone: '+54 9 261 123 4567',
      text: 'hola',
      createdAt,
    });

    const consumed = consumePendingByMatch({
      phone: '5492611234567',
      text: 'hola',
      timestamp: '2026-01-01T10:00:10.000Z',
    });

    expect(consumed).toBe('temp-1');
  });

  it('removes pending entry explicitly', () => {
    registerPendingMessage({
      tempId: 'temp-2',
      phone: '2611112222',
      text: 'chau',
      createdAt: '2026-01-01T10:00:00.000Z',
    });

    removePendingMessage('2611112222', 'temp-2');

    const consumed = consumePendingByMatch({
      phone: '2611112222',
      text: 'chau',
      timestamp: '2026-01-01T10:00:05.000Z',
    });

    expect(consumed).toBeNull();
  });

  it('returns null when phone is missing', () => {
    const consumed = consumePendingByMatch({ text: 'x' });
    expect(consumed).toBeNull();
  });
});
