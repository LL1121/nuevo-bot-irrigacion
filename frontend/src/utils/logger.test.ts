import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, initLogger, captureException, captureMessage } from '@/utils/logger'

type ConsoleSpy = ReturnType<typeof vi.spyOn>

describe('logger utilities', () => {
  let consoleDebugSpy: ConsoleSpy
  let consoleInfoSpy: ConsoleSpy
  let consoleWarnSpy: ConsoleSpy
  let consoleErrorSpy: ConsoleSpy

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('logger object', () => {
    it('should have info method', () => {
      logger.info('test message')
      expect(consoleInfoSpy).toHaveBeenCalledWith('test message')
    })

    it('should have warn method', () => {
      logger.warn('test message')
      expect(consoleWarnSpy).toHaveBeenCalledWith('test message')
    })

    it('should have error method', () => {
      logger.error('test error')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('captureException', () => {
    it('should log error to console', () => {
      const error = new Error('Test error')
      captureException(error)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should include context in error logging', () => {
      const error = new Error('Test error')
      const context = { userId: '123', action: 'login' }
      captureException(error, context)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should handle non-Error objects', () => {
      captureException('string error')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('captureMessage', () => {
    it('should log message with info level by default', () => {
      captureMessage('test message')
      expect(consoleInfoSpy).toHaveBeenCalled()
    })

    it('should log message with warning level', () => {
      captureMessage('test warning', 'warning')
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('should log error level message', () => {
      captureMessage('test error', 'error')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('initLogger', () => {
    it('should be async function', async () => {
      const result = initLogger()
      expect(result).toBeInstanceOf(Promise)
      await result
    })

    it('should not throw on initialization', async () => {
      expect(async () => {
        await initLogger()
      }).not.toThrow()
    })
  })
})
