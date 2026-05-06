import { describe, it, expect, beforeEach } from 'vitest'
import {
  decodeJWT,
  getTokenExpiry,
  isTokenExpired,
  isTokenExpiringSoon,
  isTokenValid,
  getTokenTimeRemaining,
} from '@/utils/jwt'

// Mock JWT tokens
const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

// Expired token (exp: 1516239022 = Feb 17, 2018)
const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.n-6X1T1K4_RLYRLTb0WE_3YdLdNzLYRTfMkLYHXWfAU'

// Token expiring soon (exp: timestamp 30 seconds from now)
const getTokenExpiringSoon = (secondsFromNow: number) => {
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow
  const payload = JSON.stringify({
    sub: '1234567890',
    name: 'John Doe',
    iat: Math.floor(Date.now() / 1000),
    exp,
  })
  const base64Payload = btoa(payload)
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.signature`
}

describe('JWT utilities', () => {
  describe('decodeJWT', () => {
    it('should decode valid JWT', () => {
      const decoded = decodeJWT(validToken)
      expect(decoded).toBeDefined()
      expect(decoded?.sub).toBe('1234567890')
      expect(decoded?.name).toBe('John Doe')
    })

    it('should return null for invalid token', () => {
      expect(decodeJWT('invalid.token.here')).toBeNull()
    })

    it('should return null for malformed token', () => {
      expect(decodeJWT('notavalidtoken')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(decodeJWT('')).toBeNull()
    })
  })

  describe('getTokenExpiry', () => {
    it('should return expiry timestamp in milliseconds', () => {
      const expiry = getTokenExpiry(expiredToken)
      // returns in milliseconds
      expect(expiry).toBe(1516239022000)
    })

    it('should return null for token without exp claim', () => {
      expect(getTokenExpiry(validToken)).toBeNull()
    })

    it('should return null for invalid token', () => {
      expect(getTokenExpiry('invalid.token')).toBeNull()
    })
  })

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      expect(isTokenExpired(expiredToken)).toBe(true)
    })

    it('should return false for non-expired token', () => {
      const futureToken = getTokenExpiringSoon(3600) // 1 hour from now
      expect(isTokenExpired(futureToken)).toBe(false)
    })

    it('should return true for invalid token', () => {
      expect(isTokenExpired('invalid')).toBe(true)
    })
  })

  describe('isTokenExpiringSoon', () => {
    it('should return true if token expires within threshold', () => {
      const token = getTokenExpiringSoon(30) // 30 seconds from now
      expect(isTokenExpiringSoon(token, 60000)).toBe(true) // 60s threshold
    })

    it('should return false if token expires after threshold', () => {
      const token = getTokenExpiringSoon(3600) // 1 hour from now
      expect(isTokenExpiringSoon(token, 60000)).toBe(false) // 60s threshold
    })

    it('should use default threshold of 5 minutes', () => {
      const token = getTokenExpiringSoon(120) // 2 minutes from now
      expect(isTokenExpiringSoon(token)).toBe(true) // default 5min threshold
    })
  })

  describe('isTokenValid', () => {
    it('should return false for expired token', () => {
      expect(isTokenValid(expiredToken)).toBe(false)
    })

    it('should return true for non-expired token', () => {
      const futureToken = getTokenExpiringSoon(3600)
      expect(isTokenValid(futureToken)).toBe(true)
    })

    it('should return false for invalid token', () => {
      expect(isTokenValid('not.a.token')).toBe(false)
    })
  })

  describe('getTokenTimeRemaining', () => {
    it('should return positive milliseconds for valid token', () => {
      const token = getTokenExpiringSoon(3600)
      const remaining = getTokenTimeRemaining(token)
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(3600000)
    })

    it('should return 0 for expired token', () => {
      const remaining = getTokenTimeRemaining(expiredToken)
      expect(remaining).toBeLessThanOrEqual(0)
    })

    it('should return 0 for invalid token', () => {
      expect(getTokenTimeRemaining('invalid')).toBe(0)
    })
  })
})
