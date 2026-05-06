/**
 * Zod Schemas para validación de API responses
 * Runtime type safety para todos los endpoints
 */

import { z } from 'zod';

// ============= Base Schemas =============

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  statusCode: z.number(),
});

export const ApiMetaSchema = z.object({
  timestamp: z.string(),
  version: z.string(),
  requestId: z.string(),
});

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
    meta: ApiMetaSchema.optional(),
  });

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  });

// ============= User Schemas =============

export const UserRoleSchema = z.enum(['admin', 'user', 'guest']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  avatar: z.string().url().optional(),
  createdAt: z.string().datetime().or(z.date()).transform((val) => new Date(val)),
  lastLogin: z.string().datetime().or(z.date()).transform((val) => new Date(val)).optional(),
});

export type User = z.infer<typeof UserSchema>;

// ============= Auth Schemas =============

export const AuthTokenSchema = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal('Bearer'),
});

export type AuthToken = z.infer<typeof AuthTokenSchema>;

// ============= Message Schemas =============

export const MessageTypeSchema = z.enum(['user', 'bot', 'system', 'error']);

export const MessageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  type: MessageTypeSchema,
  content: z.string(),
  timestamp: z.string().datetime().or(z.date()).transform((val) => new Date(val)),
  metadata: z.record(z.unknown()).optional(),
  attachments: z.array(z.object({
    id: z.string(),
    type: z.string(),
    url: z.string().url(),
    name: z.string(),
    size: z.number().int().nonnegative(),
  })).default([]),
});

export type Message = z.infer<typeof MessageSchema>;

// ============= Chat Schemas =============

export const ChatStatsSchema = z.object({
  messageCount: z.number().int().nonnegative(),
  lastMessageAt: z.string().datetime().or(z.date()).transform((val) => new Date(val)).optional(),
  participantCount: z.number().int().positive().default(1),
});

export const ChatSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  userId: z.string().uuid(),
  createdAt: z.string().datetime().or(z.date()).transform((val) => new Date(val)),
  updatedAt: z.string().datetime().or(z.date()).transform((val) => new Date(val)),
  stats: ChatStatsSchema,
  tags: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
});

export type Chat = z.infer<typeof ChatSchema>;

// ============= Validation Helpers =============

/**
 * Validate API response with detailed error messages
 */
export function validateApiResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
}

/**
 * Safe validation that returns result object instead of throwing
 */
export function safeValidateApiResponse<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate with transformation and default values
 */
export function validateWithDefaults<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T,
  defaults: Partial<z.infer<T>> = {}
): z.infer<T> {
  const validated = schema.parse(data);
  return { ...defaults, ...validated };
}

// ============= Export all schemas =============

export const schemas = {
  ApiError: ApiErrorSchema,
  ApiMeta: ApiMetaSchema,
  ApiResponse: ApiResponseSchema,
  PaginatedResponse: PaginatedResponseSchema,
  User: UserSchema,
  UserRole: UserRoleSchema,
  AuthToken: AuthTokenSchema,
  Message: MessageSchema,
  MessageType: MessageTypeSchema,
  Chat: ChatSchema,
  ChatStats: ChatStatsSchema,
} as const;
