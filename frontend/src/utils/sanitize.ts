/**
 * Sanitization utilities for user inputs
 * Prevents XSS attacks and injection vulnerabilities
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
};

/**
 * Sanitize user input: trim, remove leading/trailing whitespace, prevent very long strings
 */
export const sanitizeString = (input: string, maxLength: number = 5000): string => {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
};

/**
 * Sanitize phone number: only allow digits and +, -, (, )
 */
export const sanitizePhone = (phone: string): string => {
  if (typeof phone !== 'string') return '';
  // Remove all chars except digits, +, -, (, )
  return phone.replace(/[^\d+\-()]/g, '').slice(0, 20);
};

/**
 * Sanitize email: basic validation
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') return '';
  const sanitized = sanitizeString(email, 254); // RFC 5321
  // basic regex: alphanumeric, dots, hyphens, underscores @ domain
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
};

/**
 * Sanitize username: alphanumeric, underscores, hyphens only
 */
export const sanitizeUsername = (username: string): string => {
  if (typeof username !== 'string') return '';
  const sanitized = sanitizeString(username, 50);
  return sanitized.replace(/[^\w\-]/g, ''); // word chars + hyphen
};

/**
 * Sanitize message text: escape HTML + trim
 */
export const sanitizeMessage = (message: string): string => {
  const sanitized = sanitizeString(message, 5000);
  // React escapes by default, but if sending to backend, escape for safety
  return escapeHtml(sanitized);
};

/**
 * Validate input format and return error message if invalid
 */
export const validateInput = (
  value: string,
  type: 'email' | 'phone' | 'username' | 'message',
  required: boolean = true
): { valid: boolean; error?: string } => {
  if (!value && required) {
    return { valid: false, error: `${type} is required` };
  }
  if (!value) return { valid: true };

  switch (type) {
    case 'email': {
      const sanitized = sanitizeEmail(value);
      if (!sanitized) return { valid: false, error: 'Invalid email format' };
      return { valid: true };
    }
    case 'phone': {
      const sanitized = sanitizePhone(value);
      if (sanitized.length < 7) return { valid: false, error: 'Phone number too short' };
      return { valid: true };
    }
    case 'username': {
      const sanitized = sanitizeUsername(value);
      if (sanitized.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
      return { valid: true };
    }
    case 'message': {
      if (value.trim().length === 0) return { valid: false, error: 'Message cannot be empty' };
      return { valid: true };
    }
    default:
      return { valid: true };
  }
};

export default {
  escapeHtml,
  sanitizeString,
  sanitizePhone,
  sanitizeEmail,
  sanitizeUsername,
  sanitizeMessage,
  validateInput
};
