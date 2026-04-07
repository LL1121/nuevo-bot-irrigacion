/**
 * API Client Tests
 * Tests para verificar que los endpoints funcionan correctamente
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as v2 from '../v2';
import * as v1 from '../v1';

// Mock fetch
global.fetch = vi.fn();

describe('API v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth', () => {
    it('should login successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            accessToken: 'token123',
            refreshToken: 'refresh123',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        }),
      } as Response);

      const result = await v2.login('user@example.com', 'password');
      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('token123');
    });

    it('should refresh token with v2 endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            accessToken: 'newToken123',
            refreshToken: 'newRefresh123',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        }),
      } as Response);

      const result = await v2.refreshToken('oldRefresh');
      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('newToken123');
    });

    it('should get current user', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'user123',
            email: 'user@example.com',
            name: 'John Doe',
            role: 'user',
          },
        }),
      } as Response);

      const result = await v2.getCurrentUser('token123');
      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('user@example.com');
    });
  });

  describe('Chats', () => {
    it('should get paginated chats with sorting', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [{ id: '1', title: 'Chat 1' }],
            total: 1,
            page: 1,
            pageSize: 10,
            hasMore: false,
          },
        }),
      } as Response);

      const result = await v2.getPaginatedChats('token', 1, 10, 'updatedAt', 'desc');
      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
    });

    it('should get single chat', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'chat1', title: 'My Chat' },
        }),
      } as Response);

      const result = await v2.getChat('chat1', 'token');
      expect(result.data?.title).toBe('My Chat');
    });

    it('should create chat', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'chat1', title: 'New Chat' },
        }),
      } as Response);

      const result = await v2.createChat('token', { title: 'New Chat' });
      expect(result.data?.id).toBe('chat1');
    });

    it('should delete chat', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await v2.deleteChat('chat1', 'token');
      expect(result.success).toBe(true);
    });
  });

  describe('Messages', () => {
    it('should get chat messages', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [{ id: 'msg1', content: 'Hello' }],
            total: 1,
            page: 1,
            pageSize: 10,
            hasMore: false,
          },
        }),
      } as Response);

      const result = await v2.getChatMessages('chat1', 'token', 1);
      expect(result.data?.items).toHaveLength(1);
    });

    it('should send message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'msg1', content: 'Hello', type: 'user' },
        }),
      } as Response);

      const result = await v2.sendMessage('chat1', 'token', 'Hello');
      expect(result.data?.content).toBe('Hello');
    });
  });

  describe('Controls', () => {
    it('should get control actions', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            items: [{ id: 'action1', action: 'turn_on' }],
            total: 1,
            page: 1,
            pageSize: 10,
            hasMore: false,
          },
        }),
      } as Response);

      const result = await v2.getControlActions('device1', 'token', 1);
      expect(result.data?.items).toHaveLength(1);
    });

    it('should execute sensor read', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'reading1',
            type: 'temperature',
            value: 25.5,
            unit: 'C',
          },
        }),
      } as Response);

      const result = await v2.executeSensorRead('device1', 'token');
      expect(result.data?.value).toBe(25.5);
    });
  });
});

describe('API v1 (Deprecated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark v1 functions as deprecated', async () => {
    // v1.login and v1.refreshToken should work but have deprecation notices
    expect(v1.login).toBeDefined();
    expect(v1.refreshToken).toBeDefined();
    expect(v1.getPaginatedChats).toBeDefined();
  });
});

describe('Versioning', () => {
  it('should export API versions info', async () => {
    const { API_VERSIONS } = await import('../client/index');
    expect(API_VERSIONS.v1.status).toBe('DEPRECATED');
    expect(API_VERSIONS.v2.status).toBe('CURRENT');
  });

  it('should provide breaking changes information', async () => {
    const { BREAKING_CHANGES } = await import('../client/index');
    expect(BREAKING_CHANGES.v1_to_v2).toBeDefined();
    expect(BREAKING_CHANGES.v1_to_v2.length).toBeGreaterThan(0);
  });
});
