import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { auth } from '@/config/auth'

describe('auth configuration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getToken', () => {
    it('should return token from localStorage', () => {
      const token = 'test-access-token'
      localStorage.setItem('token', token)
      
      expect(auth.getToken()).toBe(token)
    })

    it('should return null if no token stored', () => {
      expect(auth.getToken()).toBeNull()
    })
  })

  describe('setToken', () => {
    it('should save and retrieve token', () => {
      const token = 'new-access-token'
      auth.setToken(token)
      
      expect(auth.getToken()).toBe(token)
    })
  })

  describe('getRefreshToken', () => {
    it('should return refresh token from localStorage', () => {
      const refreshToken = 'test-refresh-token'
      localStorage.setItem('refreshToken', refreshToken)
      
      expect(auth.getRefreshToken()).toBe(refreshToken)
    })

    it('should return null if no refresh token stored', () => {
      expect(auth.getRefreshToken()).toBeNull()
    })
  })

  describe('setRefreshToken', () => {
    it('should save and retrieve refresh token', () => {
      const token = 'new-refresh-token'
      auth.setRefreshToken(token)
      
      expect(auth.getRefreshToken()).toBe(token)
    })
  })

  describe('getOperador', () => {
    it('should return operador from localStorage', () => {
      const operador = { id: '1', nombre: 'Test User' }
      localStorage.setItem('operador', JSON.stringify(operador))
      
      expect(auth.getOperador()).toEqual(operador)
    })

    it('should return null if no operador stored', () => {
      expect(auth.getOperador()).toBeNull()
    })
  })

  describe('setOperador', () => {
    it('should save and retrieve operador', () => {
      const operador = { id: '1', nombre: 'Test User' }
      auth.setOperador(operador)
      
      expect(auth.getOperador()).toEqual(operador)
    })
  })

  describe('clearSession', () => {
    it('should remove all auth-related items from localStorage', () => {
      auth.setToken('token')
      auth.setRefreshToken('refresh')
      auth.setOperador({ id: '1', nombre: 'Test' })

      auth.clearSession()

      expect(auth.getToken()).toBeNull()
      expect(auth.getRefreshToken()).toBeNull()
      expect(auth.getOperador()).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('should return true if token exists', () => {
      auth.setToken('valid-token')
      expect(auth.isAuthenticated()).toBe(true)
    })

    it('should return false if no token', () => {
      localStorage.clear()
      expect(auth.isAuthenticated()).toBe(false)
    })

    it('should return false if token is empty string', () => {
      auth.setToken('')
      expect(auth.isAuthenticated()).toBe(false)
    })
  })
})
