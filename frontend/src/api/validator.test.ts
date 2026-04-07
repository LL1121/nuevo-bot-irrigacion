/**
 * Tests for API validator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  validateResponse,
  withValidation,
  validateBatch,
  validatePartial,
  getValidationSummary,
} from '../api/validator';
import * as monitoring from '../utils/monitoring';
import * as logger from '../utils/logger';

// Mock dependencies
vi.mock('../utils/monitoring', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('API Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateResponse', () => {
    const TestSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    it('should validate correct data', () => {
      const data = { name: 'John', age: 30 };
      
      const result = validateResponse(data, TestSchema);
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should throw on invalid data', () => {
      const data = { name: 'John', age: 'invalid' };
      
      expect(() => validateResponse(data, TestSchema)).toThrow();
    });

    it('should log errors when enabled', () => {
      const data = { name: 123, age: 'invalid' };
      
      try {
        validateResponse(data, TestSchema, { logErrors: true });
      } catch (error) {
        // Expected
      }

      expect(logger.logger.error).toHaveBeenCalled();
    });

    it('should track validation errors', () => {
      const data = { name: 123, age: 'invalid' };
      
      try {
        validateResponse(data, TestSchema, { trackValidationErrors: true });
      } catch (error) {
        // Expected
      }

      expect(monitoring.trackEvent).toHaveBeenCalledWith(
        'validation_error',
        expect.objectContaining({
          type: 'api_response',
        })
      );
    });

    it('should not throw when throwOnError is false', () => {
      const data = { name: 123, age: 'invalid' };
      
      const result = validateResponse(data, TestSchema, { throwOnError: false });
      expect(result).toBeUndefined();
    });
  });

  describe('withValidation', () => {
    const TestSchema = z.object({
      value: z.number(),
    });

    it('should validate async API call', async () => {
      const apiCall = async () => ({ value: 42 });
      
      const result = await withValidation(apiCall, TestSchema);
      expect(result.value).toBe(42);
    });

    it('should throw on invalid response', async () => {
      const apiCall = async () => ({ value: 'invalid' });
      
      await expect(withValidation(apiCall, TestSchema)).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      const apiCall = async () => {
        throw new Error('Network error');
      };
      
      await expect(withValidation(apiCall, TestSchema)).rejects.toThrow('Network error');
    });
  });

  describe('validateBatch', () => {
    const ItemSchema = z.object({
      id: z.string(),
      name: z.string(),
    });

    it('should validate multiple items', () => {
      const data = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ];

      const results = validateBatch(data, ItemSchema);
      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Item 1');
    });

    it('should skip invalid items', () => {
      const data = [
        { id: '1', name: 'Item 1' },
        { id: 2, name: 'Invalid' }, // id should be string
        { id: '3', name: 'Item 3' },
      ];

      const results = validateBatch(data, ItemSchema);
      expect(results).toHaveLength(2);
    });

    it('should log warnings for failed items', () => {
      const data = [
        { id: '1', name: 'Item 1' },
        { id: 2, name: 'Invalid' },
      ];

      validateBatch(data, ItemSchema);
      expect(logger.logger.warn).toHaveBeenCalled();
    });
  });

  describe('validatePartial', () => {
    const TestSchema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    });

    it('should validate partial data', () => {
      const data = { name: 'John' };
      
      const result = validatePartial(data, TestSchema);
      expect(result.name).toBe('John');
      expect(result.age).toBeUndefined();
    });

    it('should validate multiple partial fields', () => {
      const data = { name: 'John', age: 30 };
      
      const result = validatePartial(data, TestSchema);
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
      expect(result.email).toBeUndefined();
    });

    it('should still validate present fields', () => {
      const data = { email: 'invalid-email' };
      
      expect(() => validatePartial(data, TestSchema)).toThrow();
    });
  });

  describe('getValidationSummary', () => {
    it('should summarize validation errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });

      const result = schema.safeParse({
        name: 123,
        age: 'invalid',
        email: 'not-an-email',
      });

      if (!result.success) {
        const summary = getValidationSummary(result.error);
        
        expect(summary.totalErrors).toBeGreaterThan(0);
        expect(summary.errorsByField.name).toBeDefined();
        expect(summary.flatErrors).toBeInstanceOf(Array);
      }
    });

    it('should group errors by field', () => {
      const schema = z.object({
        password: z.string()
          .min(8)
          .regex(/[A-Z]/)
          .regex(/[0-9]/),
      });

      const result = schema.safeParse({ password: 'short' });

      if (!result.success) {
        const summary = getValidationSummary(result.error);
        expect(summary.errorsByField.password).toBeDefined();
        expect(summary.errorsByField.password.length).toBeGreaterThan(0);
      }
    });
  });
});
