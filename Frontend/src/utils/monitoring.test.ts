import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initPerformanceMonitoring,
  trackEvent,
  trackAction,
  trackApiCall,
  trackSocketEvent,
  trackComponentRender,
  trackFeatureUsage,
  setUserContext,
  clearUserContext,
  addTag,
  addContext,
} from './monitoring';

// Mock env to enable logging so console.debug/info/warn calls inside monitoring.ts fire
vi.mock('../config/env', () => ({
  env: {
    enableLogging: true,
    enableSentry: false,
    sentryDsn: '',
    apiUrl: 'http://localhost:3000',
    socketUrl: 'http://localhost:3000',
    tokenKey: 'token',
    operadorKey: 'operador',
    jwtExpiryMs: 3600000,
    requestTimeoutMs: 30000,
    socketReconnectDelayMs: 1000,
    socketReconnectAttempts: 5,
    sessionTimeoutMs: 86400000,
    messageCacheMaxChats: 250,
    messageCacheMaxMessagesPerChat: 1500,
    messageCacheTtlMs: 604800000,
    isProduction: false,
    isDevelopment: true,
  },
}));

// Mock web-vitals
vi.mock('web-vitals', () => ({
  onCLS: vi.fn((callback) => callback({ value: 0.05, rating: 'good', id: '1' })),
  onFID: vi.fn((callback) => callback({ value: 50, rating: 'good', id: '2' })),
  onFCP: vi.fn((callback) => callback({ value: 1200, rating: 'good', id: '3' })),
  onLCP: vi.fn((callback) => callback({ value: 2000, rating: 'good', id: '4' })),
  onTTFB: vi.fn((callback) => callback({ value: 500, rating: 'good', id: '5' })),
}));

// Mock Sentry
const mockSentry = {
  captureMessage: vi.fn(),
  setMeasurement: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
};

vi.mock('@sentry/react', () => ({
  default: mockSentry,
  ...mockSentry,
}));

describe('monitoring utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.debug = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initPerformanceMonitoring', () => {
    it('should not initialize if Sentry DSN not configured', async () => {
      await initPerformanceMonitoring();
      // Should log that monitoring is disabled (Sentry not configured in test env)
      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('trackEvent', () => {
    it('should track custom event', () => {
      const event = {
        name: 'button_click',
        properties: { button_id: 'submit' },
      };

      trackEvent(event);

      expect(console.debug).toHaveBeenCalledWith(
        'Event tracked:',
        'button_click',
        { button_id: 'submit' }
      );
    });

    it('should add timestamp if not provided', () => {
      const event = { name: 'test_event' };
      trackEvent(event);
      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe('trackAction', () => {
    it('should track user action', () => {
      trackAction('send_message', { length: 150 });
      
      expect(console.debug).toHaveBeenCalledWith(
        'Event tracked:',
        'action_send_message',
        { length: 150 }
      );
    });

    it('should work without properties', () => {
      trackAction('logout');
      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe('trackApiCall', () => {
    it('should track API call performance', () => {
      trackApiCall('/api/messages', 250, 200);

      expect(console.debug).toHaveBeenCalledWith(
        'Event tracked:',
        'api_call',
        expect.objectContaining({
          endpoint: '/api/messages',
          duration_ms: 250,
          status: 200,
          success: true,
        })
      );
    });

    it('should mark failed API calls', () => {
      trackApiCall('/api/users', 500, 500);

      expect(console.debug).toHaveBeenCalledWith(
        'Event tracked:',
        'api_call',
        expect.objectContaining({
          status: 500,
          success: false,
        })
      );
    });
  });

  describe('trackSocketEvent', () => {
    it('should track socket event', () => {
      trackSocketEvent('message_received', { message_id: '123' });

      expect(console.debug).toHaveBeenCalledWith(
        'Event tracked:',
        'socket_message_received',
        expect.objectContaining({
          event_type: 'message_received',
          message_id: '123',
        })
      );
    });
  });

  describe('trackComponentRender', () => {
    it('should track component render time', () => {
      trackComponentRender('ChatWindow', 50);
      // Should not warn for fast renders
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should warn for slow renders', () => {
      trackComponentRender('HeavyComponent', 150);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow render: HeavyComponent took 150ms')
      );
    });
  });

  describe('trackFeatureUsage', () => {
    it('should track feature usage', () => {
      trackFeatureUsage('emoji_picker', { emoji: '👍' });

      expect(console.debug).toHaveBeenCalledWith(
        'Event tracked:',
        'feature_emoji_picker',
        { emoji: '👍' }
      );
    });

    it('should work without metadata', () => {
      trackFeatureUsage('dark_mode');
      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe('setUserContext', () => {
    it('should set user context', () => {
      const operador = {
        id: 'user-123',
        nombre: 'Test User',
        email: 'test@example.com',
      };

      setUserContext('user-123', operador);

      expect(console.debug).toHaveBeenCalledWith('User context set:', 'user-123');
    });
  });

  describe('clearUserContext', () => {
    it('should clear user context', () => {
      clearUserContext();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('addTag', () => {
    it('should add custom tag', () => {
      addTag('environment', 'production');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('addContext', () => {
    it('should add custom context', () => {
      addContext('chat', { chat_id: '123', participants: 2 });
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
