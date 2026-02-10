/**
 * Zod Schemas para validación de formularios
 * Mensajes de error en español y reglas de negocio
 */

import { z } from 'zod';

// ============= Custom Error Messages =============

const errorMessages = {
  required: 'Este campo es obligatorio',
  email: 'Email inválido',
  minLength: (min: number) => `Debe tener al menos ${min} caracteres`,
  maxLength: (max: number) => `Debe tener como máximo ${max} caracteres`,
  password: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
  passwordMatch: 'Las contraseñas no coinciden',
  url: 'URL inválida',
  phone: 'Número de teléfono inválido',
  numeric: 'Debe ser un número',
  positive: 'Debe ser un número positivo',
  integer: 'Debe ser un número entero',
};

// ============= Login Form =============

export const LoginFormSchema = z.object({
  email: z.string({ required_error: errorMessages.required })
    .trim()
    .toLowerCase()
    .email(errorMessages.email)
    .min(5, errorMessages.minLength(5))
    .max(100, errorMessages.maxLength(100)),
  password: z.string({ required_error: errorMessages.required })
    .min(8, errorMessages.minLength(8))
    .max(100, errorMessages.maxLength(100)),
  rememberMe: z.boolean().default(false),
});

export type LoginFormData = z.infer<typeof LoginFormSchema>;

// ============= Register Form =============

const passwordSchema = z.string({ required_error: errorMessages.required })
  .min(8, errorMessages.minLength(8))
  .max(100, errorMessages.maxLength(100))
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, errorMessages.password);

export const RegisterFormSchema = z.object({
  name: z.string({ required_error: errorMessages.required })
    .min(2, errorMessages.minLength(2))
    .max(50, errorMessages.maxLength(50))
    .trim(),
  email: z.string({ required_error: errorMessages.required })
    .trim()
    .toLowerCase()
    .email(errorMessages.email)
    .min(5, errorMessages.minLength(5))
    .max(100, errorMessages.maxLength(100)),
  password: passwordSchema,
  confirmPassword: z.string({ required_error: errorMessages.required }),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: errorMessages.passwordMatch,
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof RegisterFormSchema>;

// ============= Profile Form =============

export const ProfileFormSchema = z.object({
  name: z.string({ required_error: errorMessages.required })
    .min(2, errorMessages.minLength(2))
    .max(50, errorMessages.maxLength(50))
    .trim(),
  email: z.string({ required_error: errorMessages.required })
    .trim()
    .toLowerCase()
    .email(errorMessages.email),
  avatar: z.string().url(errorMessages.url).optional().or(z.literal('')),
  phone: z.string()
    .regex(/^[\d\s\+\-\(\)]+$/, errorMessages.phone)
    .optional()
    .or(z.literal('')),
  bio: z.string()
    .max(500, errorMessages.maxLength(500))
    .optional(),
});

export type ProfileFormData = z.infer<typeof ProfileFormSchema>;

// ============= Change Password Form =============

export const ChangePasswordFormSchema = z.object({
  currentPassword: z.string({ required_error: errorMessages.required })
    .min(8, errorMessages.minLength(8)),
  newPassword: passwordSchema,
  confirmNewPassword: z.string({ required_error: errorMessages.required }),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: errorMessages.passwordMatch,
  path: ['confirmNewPassword'],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'La nueva contraseña debe ser diferente a la actual',
  path: ['newPassword'],
});

export type ChangePasswordFormData = z.infer<typeof ChangePasswordFormSchema>;

// ============= Message Form =============

export const MessageFormSchema = z.object({
  content: z.string({ required_error: errorMessages.required })
    .min(1, 'El mensaje no puede estar vacío')
    .max(5000, errorMessages.maxLength(5000))
    .trim(),
  attachments: z.array(z.object({
    file: z.instanceof(File),
    name: z.string(),
    size: z.number(),
    type: z.string(),
  })).max(5, 'Máximo 5 archivos por mensaje').default([]),
});

export type MessageFormData = z.infer<typeof MessageFormSchema>;

// ============= Settings Form =============

export const SettingsFormSchema = z.object({
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(false),
    sms: z.boolean().default(false),
  }),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  language: z.enum(['es', 'en']).default('es'),
  autoSave: z.boolean().default(true),
  dataRetention: z.number()
    .int(errorMessages.integer)
    .min(7, 'Mínimo 7 días')
    .max(365, 'Máximo 365 días')
    .default(30),
});

export type SettingsFormData = z.infer<typeof SettingsFormSchema>;

// ============= Search Form =============

export const SearchFormSchema = z.object({
  query: z.string()
    .min(1, 'Ingresa un término de búsqueda')
    .max(200, errorMessages.maxLength(200))
    .trim(),
  filters: z.object({
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    type: z.enum(['all', 'chats', 'messages', 'devices']).default('all'),
    status: z.enum(['all', 'active', 'archived']).default('all'),
  }).optional(),
  sortBy: z.enum(['relevance', 'date', 'name']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type SearchFormData = z.infer<typeof SearchFormSchema>;

// ============= Validation Helpers =============

/**
 * Validate form data and return formatted errors
 */
export function validateForm<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  const issues = result.error?.issues ?? result.error?.errors ?? [];
  issues.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return { success: false, errors };
}

/**
 * Get error message for a specific field
 */
export function getFieldError(
  error: z.ZodError | undefined,
  fieldName: string
): string | undefined {
  const issues = error?.issues ?? error?.errors ?? [];
  if (issues.length === 0) return undefined;
  
  const fieldError = issues.find(err => err.path.join('.') === fieldName);
  
  return fieldError?.message;
}

/**
 * Validate single field
 */
export function validateField<T extends z.ZodTypeAny>(
  value: unknown,
  schema: T
): { valid: true; value: z.infer<T> } | { valid: false; error: string } {
  const result = schema.safeParse(value);
  
  if (result.success) {
    return { valid: true, value: result.data };
  }
  
  const errorMessage = result.error?.errors?.[0]?.message || 'Valor inválido';
  return { valid: false, error: errorMessage };
}

// ============= Export all schemas =============

export const formSchemas = {
  Login: LoginFormSchema,
  Register: RegisterFormSchema,
  Profile: ProfileFormSchema,
  ChangePassword: ChangePasswordFormSchema,
  Message: MessageFormSchema,
  Settings: SettingsFormSchema,
  Search: SearchFormSchema,
} as const;
