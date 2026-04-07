import { describe, it, expect, beforeEach } from 'vitest'
import {
  escapeHtml,
  sanitizeString,
  sanitizePhone,
  sanitizeEmail,
  sanitizeUsername,
  sanitizeMessage,
  validateInput,
} from '@/utils/sanitize'

describe('sanitize utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>'
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      expect(escapeHtml(input)).toBe(expected)
    })

    it('should escape & symbol', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
    })

    it('should escape single quotes', () => {
      expect(escapeHtml("It's dangerous")).toBe("It&#039;s dangerous")
    })

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('')
    })
  })

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello')
    })

    it('should respect maxLength parameter', () => {
      expect(sanitizeString('hello world', 5)).toBe('hello')
    })

    it('should return empty string if all whitespace', () => {
      expect(sanitizeString('   ')).toBe('')
    })

    it('should handle normal strings', () => {
      expect(sanitizeString('normal text')).toBe('normal text')
    })
  })

  describe('sanitizePhone', () => {
    it('should remove spaces but keep + - ( )', () => {
      const input = '+1 (555) 123-4567'
      expect(sanitizePhone(input)).toBe('+1(555)123-4567')
    })

    it('should remove spaces and special chars', () => {
      expect(sanitizePhone('555.123.4567')).toBe('5551234567')
    })

    it('should keep leading +', () => {
      expect(sanitizePhone('+5491112345678')).toBe('+5491112345678')
    })

    it('should handle empty input', () => {
      expect(sanitizePhone('')).toBe('')
    })
  })

  describe('sanitizeEmail', () => {
    it('should validate email format', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com')
    })

    it('should trim whitespace', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com')
    })

    it('should return empty if invalid email with space', () => {
      expect(sanitizeEmail('test @example.com')).toBe('')
    })

    it('should handle valid email format', () => {
      expect(sanitizeEmail('user+tag@sub.domain.com')).toBe('user+tag@sub.domain.com')
    })
  })

  describe('sanitizeUsername', () => {
    it('should allow alphanumeric and underscore', () => {
      expect(sanitizeUsername('user_123')).toBe('user_123')
    })

    it('should remove special characters', () => {
      expect(sanitizeUsername('user@#$%')).toBe('user')
    })

    it('should preserve case for alphanumeric', () => {
      expect(sanitizeUsername('User_Name')).toBe('User_Name')
    })

    it('should trim whitespace', () => {
      expect(sanitizeUsername('  username  ')).toBe('username')
    })

    it('should enforce max 50 chars', () => {
      const longUsername = 'a'.repeat(100)
      expect(sanitizeUsername(longUsername)).toHaveLength(50)
    })
  })

  describe('sanitizeMessage', () => {
    it('should escape HTML tags', () => {
      const msg = 'Hello <script>alert("xss")</script>'
      expect(sanitizeMessage(msg)).toContain('&lt;script&gt;')
    })

    it('should trim message', () => {
      expect(sanitizeMessage('  hello  ')).toBe('hello')
    })

    it('should enforce max 5000 chars', () => {
      const longMsg = 'a'.repeat(6000)
      expect(sanitizeMessage(longMsg)).toHaveLength(5000)
    })

    it('should preserve newlines', () => {
      const msg = 'line1\nline2'
      expect(sanitizeMessage(msg)).toContain('\n')
    })
  })

  describe('validateInput', () => {
    it('should validate required field', () => {
      const result = validateInput('', 'string', true)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should allow empty optional field', () => {
      const result = validateInput('', 'string', false)
      expect(result.valid).toBe(true)
    })

    it('should validate email format', () => {
      const result = validateInput('invalid-email', 'email', true)
      expect(result.valid).toBe(false)
    })

    it('should validate valid email', () => {
      const result = validateInput('user@example.com', 'email', true)
      expect(result.valid).toBe(true)
    })

    it('should validate phone format', () => {
      const result = validateInput('+5491112345678', 'phone', true)
      expect(result.valid).toBe(true)
    })

    it('should validate username format', () => {
      const result = validateInput('user_name', 'username', true)
      expect(result.valid).toBe(true)
    })

    it('should accept sanitized username without special chars', () => {
      const result = validateInput('user_name', 'username', true)
      expect(result.valid).toBe(true)
    })

    it('should validate generic string', () => {
      const result = validateInput('hello world', 'string', true)
      expect(result.valid).toBe(true)
    })
  })
})
