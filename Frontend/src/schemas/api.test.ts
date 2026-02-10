/**
 * Tests for API schemas validation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  UserSchema,
  AuthTokenSchema,
  MessageSchema,
  ChatSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
  validateApiResponse,
  safeValidateApiResponse,
  validateWithDefaults,
} from '../schemas/api';

describe('API Schemas', () => {
  describe('UserSchema', () => {
    it('should validate valid user', () => {
      const validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'John Doe',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = UserSchema.parse(validUser);
      expect(result.email).toBe('test@example.com');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should reject invalid email', () => {
      const invalidUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'invalid-email',
        name: 'John',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(() => UserSchema.parse(invalidUser)).toThrow();
    });

    it('should reject invalid UUID', () => {
      const invalidUser = {
        id: 'not-a-uuid',
        email: 'test@example.com',
        name: 'John',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(() => UserSchema.parse(invalidUser)).toThrow();
    });

    it('should reject invalid role', () => {
      const invalidUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'John',
        role: 'superuser',
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(() => UserSchema.parse(invalidUser)).toThrow();
    });

    it('should transform date strings to Date objects', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'John',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: '2024-01-02T00:00:00Z',
      };

      const result = UserSchema.parse(user);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('AuthTokenSchema', () => {
    it('should validate valid auth token', () => {
      const validToken = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      const result = AuthTokenSchema.parse(validToken);
      expect(result.tokenType).toBe('Bearer');
    });

    it('should reject short tokens', () => {
      const invalidToken = {
        accessToken: 'short',
        refreshToken: 'short',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      expect(() => AuthTokenSchema.parse(invalidToken)).toThrow();
    });

    it('should reject invalid token type', () => {
      const invalidToken = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        expiresIn: 3600,
        tokenType: 'Basic',
      };

      expect(() => AuthTokenSchema.parse(invalidToken)).toThrow();
    });
  });

  describe('MessageSchema', () => {
    it('should validate valid message', () => {
      const validMessage = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        chatId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'user',
        content: 'Hello world',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = MessageSchema.parse(validMessage);
      expect(result.attachments).toEqual([]);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should default attachments to empty array', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        chatId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'bot',
        content: 'Response',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = MessageSchema.parse(message);
      expect(result.attachments).toEqual([]);
    });

    it('should validate message with attachments', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        chatId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'user',
        content: 'Check this file',
        timestamp: '2024-01-01T00:00:00Z',
        attachments: [
          {
            id: 'att1',
            type: 'image/png',
            url: 'https://example.com/image.png',
            name: 'screenshot.png',
            size: 1024,
          },
        ],
      };

      const result = MessageSchema.parse(message);
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].name).toBe('screenshot.png');
    });
  });

  describe('ChatSchema', () => {
    it('should validate valid chat', () => {
      const validChat = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'My Chat',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        stats: {
          messageCount: 10,
        },
      };

      const result = ChatSchema.parse(validChat);
      expect(result.tags).toEqual([]);
      expect(result.archived).toBe(false);
    });

    it('should validate chat with all fields', () => {
      const chat = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'My Chat',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        stats: {
          messageCount: 10,
          lastMessageAt: '2024-01-02T00:00:00Z',
          participantCount: 2,
        },
        tags: ['irrigation', 'urgent'],
        archived: true,
      };

      const result = ChatSchema.parse(chat);
      expect(result.tags).toEqual(['irrigation', 'urgent']);
      expect(result.archived).toBe(true);
    });
  });

  describe('ApiResponseSchema', () => {
    it('should validate successful response', () => {
      const response = {
        success: true,
        data: { name: 'Test' },
        meta: {
          timestamp: '2024-01-01T00:00:00Z',
          version: 'v2',
          requestId: 'req-123',
        },
      };

      const schema = ApiResponseSchema(UserSchema.pick({ name: true }));
      const result = schema.parse(response);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Test');
    });

    it('should validate error response', () => {
      const response = {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Unauthorized',
          statusCode: 401,
        },
      };

      const schema = ApiResponseSchema(UserSchema);
      const result = schema.parse(response);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
    });
  });

  describe('PaginatedResponseSchema', () => {
    it('should validate paginated response', () => {
      const ItemSchema = z.object({
        id: z.string(),
        name: z.string(),
      });
      
      const response = {
        items: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ],
        total: 100,
        page: 1,
        pageSize: 2,
        hasMore: true,
      };

      const schema = PaginatedResponseSchema(ItemSchema);
      const result = schema.parse(response);
      
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('Validation Helpers', () => {
    it('validateApiResponse should throw on invalid data', () => {
      const invalidData = { email: 'invalid' };
      
      expect(() => validateApiResponse(invalidData, UserSchema)).toThrow();
    });

    it('safeValidateApiResponse should return success', () => {
      const validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'John',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = safeValidateApiResponse(validUser, UserSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('safeValidateApiResponse should return error', () => {
      const invalidUser = { email: 'invalid' };

      const result = safeValidateApiResponse(invalidUser, UserSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('validateWithDefaults should merge defaults', () => {
      const data = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'John',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = validateWithDefaults(data, UserSchema, {
        avatar: 'https://example.com/avatar.png',
      });

      expect(result.avatar).toBe('https://example.com/avatar.png');
    });
  });
});
