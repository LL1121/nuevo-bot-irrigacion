/**
 * API Validator - Wrapper para validar automáticamente responses
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import { trackEvent } from '../utils/monitoring';
import { ApiResponseSchema, safeValidateApiResponse } from '../schemas/api';

/**
 * Options para el validador
 */
interface ValidatorOptions {
  logErrors?: boolean;
  trackValidationErrors?: boolean;
  throwOnError?: boolean;
}

const defaultOptions: ValidatorOptions = {
  logErrors: true,
  trackValidationErrors: true,
  throwOnError: true,
};

/**
 * Validate API response with schema
 */
export function validateResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T,
  options: ValidatorOptions = {}
): z.infer<T> {
  const opts = { ...defaultOptions, ...options };
  
  const result = safeValidateApiResponse(data, schema);
  
  if (!result.success) {
    const errorDetails = result.error?.errors?.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    })) || [];
    
    if (opts.logErrors) {
      logger.error('Validation error:', {
        errors: errorDetails,
        data: typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : data,
      });
    }
    
    if (opts.trackValidationErrors) {
      trackEvent('validation_error', {
        type: 'api_response',
        errorCount: errorDetails.length,
        firstError: errorDetails[0]?.message,
      });
    }
    
    if (opts.throwOnError) {
      throw new Error(`Validation failed: ${errorDetails[0]?.message || 'Unknown error'}`);
    }
    
    return undefined as any;
  }
  
  return result.data as z.infer<T>;
}

/**
 * Wrap API call with validation
 */
export async function withValidation<T extends z.ZodTypeAny, R>(
  apiCall: () => Promise<R>,
  schema: T,
  options?: ValidatorOptions
): Promise<z.infer<T>> {
  try {
    const response = await apiCall();
    return validateResponse(response, schema, options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Validation error in API call:', error);
      throw new Error('Invalid response from server');
    }
    throw error;
  }
}

/**
 * Create validated API client wrapper
 */
export function createValidatedClient<T extends Record<string, (...args: any[]) => Promise<any>>>(
  client: T,
  schemas: Record<keyof T, z.ZodTypeAny>
): T {
  const validatedClient = {} as T;
  
  for (const key in client) {
    const originalMethod = client[key];
    const schema = schemas[key];
    
    if (!schema) {
      validatedClient[key] = originalMethod;
      continue;
    }
    
    validatedClient[key] = (async (...args: any[]) => {
      const response = await originalMethod(...args);
      return validateResponse(response, ApiResponseSchema(schema));
    }) as T[typeof key];
  }
  
  return validatedClient;
}

/**
 * Batch validation for multiple responses
 */
export function validateBatch<T extends z.ZodTypeAny>(
  data: unknown[],
  schema: T,
  options?: ValidatorOptions
): z.infer<T>[] {
  const results: z.infer<T>[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  
  data.forEach((item, index) => {
    try {
      results.push(validateResponse(item, schema, { ...options, throwOnError: true }));
    } catch (error) {
      errors.push({
        index,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
  
  if (errors.length > 0 && options?.logErrors !== false) {
    logger.warn(`Batch validation: ${errors.length}/${data.length} items failed`, errors);
  }
  
  return results;
}

/**
 * Partial validation - validate only present fields
 */
export function validatePartial<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T,
  options?: ValidatorOptions
): Partial<z.infer<T>> {
  if (schema instanceof z.ZodObject) {
    const partialSchema = schema.partial();
    return validateResponse(data, partialSchema, options);
  }
  
  throw new Error('Partial validation only works with ZodObject schemas');
}

/**
 * Deep validation with transformation
 */
export function validateAndTransform<T extends z.ZodTypeAny, R>(
  data: unknown,
  schema: T,
  transformer: (validated: z.infer<T>) => R,
  options?: ValidatorOptions
): R {
  const validated = validateResponse(data, schema, options);
  return transformer(validated);
}

/**
 * Validation middleware for fetch
 */
export function validatedFetch<T extends z.ZodTypeAny>(
  schema: T,
  options?: ValidatorOptions
) {
  return async (url: string, init?: RequestInit): Promise<z.infer<T>> => {
    const response = await fetch(url, init);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return validateResponse(data, schema, options);
  };
}

/**
 * Get validation summary
 */
export function getValidationSummary(error: z.ZodError): {
  totalErrors: number;
  errorsByField: Record<string, string[]>;
  flatErrors: string[];
} {
  const errorsByField: Record<string, string[]> = {};
  const flatErrors: string[] = [];
  const issues = error?.issues ?? error?.errors ?? [];
  issues.forEach(err => {
    const path = err.path.join('.') || 'root';
    if (!errorsByField[path]) {
      errorsByField[path] = [];
    }
    errorsByField[path].push(err.message);
    flatErrors.push(`${path}: ${err.message}`);
  });
  
  return {
    totalErrors: issues.length,
    errorsByField,
    flatErrors,
  };
}
