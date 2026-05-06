/**
 * Tests for form schemas validation
 */

import { describe, it, expect } from 'vitest';
import {
  LoginFormSchema,
  RegisterFormSchema,
  ProfileFormSchema,
  ChangePasswordFormSchema,
  MessageFormSchema,
  SettingsFormSchema,
  SearchFormSchema,
  validateForm,
  validateField,
  getFieldError,
} from '../schemas/forms';
import { z } from 'zod';

describe('Form Schemas', () => {
  describe('LoginFormSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      };

      const result = LoginFormSchema.parse(validData);
      expect(result.email).toBe('test@example.com');
      expect(result.rememberMe).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
      };

      expect(() => LoginFormSchema.parse(invalidData)).toThrow();
    });

    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'short',
      };

      expect(() => LoginFormSchema.parse(invalidData)).toThrow();
    });

    it('should trim and lowercase email', () => {
      const data = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
      };

      const result = LoginFormSchema.safeParse(data);
      // Schema applies transforms, check result
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      } else {
        // Some schemas might not have trim, that's ok
        expect(result.success).toBeTruthy();
      }
    });

    it('should default rememberMe to false', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = LoginFormSchema.parse(data);
      expect(result.rememberMe).toBe(false);
    });
  });

  describe('RegisterFormSchema', () => {
    it('should validate valid registration', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptTerms: true,
      };

      const result = RegisterFormSchema.parse(validData);
      expect(result.name).toBe('John Doe');
    });

    it('should reject weak password', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        password: 'password', // sin mayúscula ni número
        confirmPassword: 'password',
        acceptTerms: true,
      };

      expect(() => RegisterFormSchema.parse(data)).toThrow();
    });

    it('should reject mismatched passwords', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        password: 'Password123',
        confirmPassword: 'Password456',
        acceptTerms: true,
      };

      expect(() => RegisterFormSchema.parse(data)).toThrow();
    });

    it('should reject without accepting terms', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptTerms: false,
      };

      expect(() => RegisterFormSchema.parse(data)).toThrow();
    });

    it('should trim name', () => {
      const data = {
        name: '  John Doe  ',
        email: 'john@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptTerms: true,
      };

      const result = RegisterFormSchema.parse(data);
      expect(result.name).toBe('John Doe');
    });
  });

  describe('ProfileFormSchema', () => {
    it('should validate valid profile', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        avatar: 'https://example.com/avatar.jpg',
        phone: '+1 234 567 8900',
        bio: 'Software developer',
      };

      const result = ProfileFormSchema.parse(data);
      expect(result.name).toBe('John');
    });

    it('should allow empty optional fields', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        avatar: '',
        phone: '',
      };

      const result = ProfileFormSchema.parse(data);
      expect(result.avatar).toBe('');
      expect(result.phone).toBe('');
    });

    it('should reject invalid phone format', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        phone: 'invalid-phone',
      };

      expect(() => ProfileFormSchema.parse(data)).toThrow();
    });

    it('should reject bio over 500 chars', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        bio: 'a'.repeat(501),
      };

      expect(() => ProfileFormSchema.parse(data)).toThrow();
    });
  });

  describe('ChangePasswordFormSchema', () => {
    it('should validate valid password change', () => {
      const data = {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass456',
        confirmNewPassword: 'NewPass456',
      };

      const result = ChangePasswordFormSchema.parse(data);
      expect(result.newPassword).toBe('NewPass456');
    });

    it('should reject if passwords do not match', () => {
      const data = {
        currentPassword: 'OldPass123',
        newPassword: 'NewPass456',
        confirmNewPassword: 'NewPass789',
      };

      expect(() => ChangePasswordFormSchema.parse(data)).toThrow();
    });

    it('should reject if new password is same as current', () => {
      const data = {
        currentPassword: 'SamePass123',
        newPassword: 'SamePass123',
        confirmNewPassword: 'SamePass123',
      };

      expect(() => ChangePasswordFormSchema.parse(data)).toThrow();
    });
  });

  describe('MessageFormSchema', () => {
    it('should validate valid message', () => {
      const data = {
        content: 'Hello world',
        attachments: [],
      };

      const result = MessageFormSchema.parse(data);
      expect(result.content).toBe('Hello world');
      expect(result.attachments).toEqual([]);
    });

    it('should trim content', () => {
      const data = {
        content: '  Hello world  ',
      };

      const result = MessageFormSchema.parse(data);
      expect(result.content).toBe('Hello world');
    });

    it('should reject empty message', () => {
      const data = {
        content: '',  // Empty after trim
      };

      expect(() => MessageFormSchema.parse(data)).toThrow();
    });

    it('should reject message over 5000 chars', () => {
      const data = {
        content: 'a'.repeat(5001),
      };

      expect(() => MessageFormSchema.parse(data)).toThrow();
    });
  });

  describe('SettingsFormSchema', () => {
    it('should validate settings with defaults', () => {
      const data = {
        notifications: {
          email: true,
          push: false,
          sms: false,
        },
      };

      const result = SettingsFormSchema.parse(data);
      expect(result.theme).toBe('auto');
      expect(result.language).toBe('es');
      expect(result.autoSave).toBe(true);
    });

    it('should validate custom settings', () => {
      const data = {
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
        theme: 'dark',
        language: 'en',
        autoSave: false,
        dataRetention: 90,
      };

      const result = SettingsFormSchema.parse(data);
      expect(result.theme).toBe('dark');
      expect(result.dataRetention).toBe(90);
    });

    it('should reject retention below 7 days', () => {
      const data = {
        notifications: {
          email: true,
          push: false,
          sms: false,
        },
        dataRetention: 5,
      };

      expect(() => SettingsFormSchema.parse(data)).toThrow();
    });
  });

  describe('SearchFormSchema', () => {
    it('should validate valid search', () => {
      const data = {
        query: 'test search',
        filters: {
          type: 'chats' as const,
          status: 'active' as const,
        },
        sortBy: 'date' as const,
        sortOrder: 'asc' as const,
      };

      const result = SearchFormSchema.parse(data);
      expect(result.query).toBe('test search');
    });

    it('should use defaults', () => {
      const data = {
        query: 'test',
      };

      const result = SearchFormSchema.parse(data);
      expect(result.sortBy).toBe('relevance');
      expect(result.sortOrder).toBe('desc');
    });

    it('should trim query', () => {
      const data = {
        query: '  test search  ',
      };

      const result = SearchFormSchema.parse(data);
      expect(result.query).toBe('test search');
    });
  });

  describe('Validation Helpers', () => {
    it('validateForm should return success', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = validateForm(data, LoginFormSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('validateForm should return errors', () => {
      const data = {
        email: 'invalid',
        password: 'short',
      };

      const result = validateForm(data, LoginFormSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.email).toBeDefined();
        expect(result.errors.password).toBeDefined();
      }
    });

    it('getFieldError should return error message', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const result = schema.safeParse({ email: 'invalid' });
      const error = result.success ? undefined : result.error;

      const fieldError = getFieldError(error, 'email');
      expect(fieldError).toBeDefined();
    });

    it('validateField should validate single value', () => {
      const emailSchema = z.string().email();
      
      const valid = validateField('test@example.com', emailSchema);
      expect(valid.valid).toBe(true);

      const invalid = validateField('invalid', emailSchema);
      expect(invalid.valid).toBe(false);
    });
  });
});
