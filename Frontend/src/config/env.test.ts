import { describe, it, expect, vi, beforeEach } from 'vitest'
import { env } from '@/config/env'

describe('env configuration', () => {
  describe('env object structure', () => {
    it('should have apiUrl property', () => {
      expect(env).toHaveProperty('apiUrl')
      expect(typeof env.apiUrl).toBe('string')
    })

    it('should have socketUrl property', () => {
      expect(env).toHaveProperty('socketUrl')
      expect(typeof env.socketUrl).toBe('string')
    })

    it('should have tokenKey property', () => {
      expect(env).toHaveProperty('tokenKey')
      expect(typeof env.tokenKey).toBe('string')
    })

    it('should not have refreshTokenKey property in env', () => {
      // refreshTokenKey is in authConfig.storage, not in env
      expect(env).not.toHaveProperty('refreshTokenKey')
    })

    it('should have operadorKey property', () => {
      expect(env).toHaveProperty('operadorKey')
      expect(env.operadorKey).toBe('operador')
    })

    it('should have enableSentry property', () => {
      expect(env).toHaveProperty('enableSentry')
      expect(typeof env.enableSentry).toBe('boolean')
    })

    it('should have enableLogging property', () => {
      expect(env).toHaveProperty('enableLogging')
      expect(typeof env.enableLogging).toBe('boolean')
    })

    it('should have request timeout value', () => {
      expect(env).toHaveProperty('requestTimeoutMs')
      expect(env.requestTimeoutMs).toBeGreaterThan(0)
    })
  })

  describe('API URL format', () => {
    it('should not have trailing slash', () => {
      expect(env.apiUrl).not.toMatch(/\/$/)
    })

    it('should be a valid URL', () => {
      expect(() => {
        new URL(env.apiUrl)
      }).not.toThrow()
    })
  })

  describe('Socket URL format', () => {
    it('should not have trailing slash', () => {
      expect(env.socketUrl).not.toMatch(/\/$/)
    })

    it('should be a valid URL', () => {
      expect(() => {
        new URL(env.socketUrl)
      }).not.toThrow()
    })
  })

  describe('Timeout values', () => {
    it('should have reasonable request timeout (5-30s)', () => {
      expect(env.requestTimeoutMs).toBeGreaterThanOrEqual(5000)
      expect(env.requestTimeoutMs).toBeLessThanOrEqual(30000)
    })

    it('should have reasonable socket reconnect delay', () => {
      expect(env.socketReconnectDelayMs).toBeGreaterThanOrEqual(1000)
      expect(env.socketReconnectDelayMs).toBeLessThanOrEqual(10000)
    })
  })
})
