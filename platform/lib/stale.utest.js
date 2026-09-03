import {
  MAX_RECOVERY_ATTEMPTS,
  RECOVERY_WINDOW_MS,
  consumeStaleDeployment,
  isChunkLoadError,
  markStaleDeployment,
  recoverFromChunkError,
} from './stale'

describe('chunk-error', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  describe('isChunkLoadError', () => {
    it('detects an Error whose name is ChunkLoadError', () => {
      const error = new Error('Loading chunk 86957 failed.')

      error.name = 'ChunkLoadError'

      expect(isChunkLoadError(error)).toBe(true)
    })

    it('detects the failure from the message alone (timeout variant)', () => {
      const error = new Error(
        'Loading chunk 86957 failed.\n(timeout: https://chatbotkit.com/_next/static/chunks/86957.86a04c99f2d4a59e.js)'
      )

      expect(isChunkLoadError(error)).toBe(true)
    })

    it('detects CSS chunk failures', () => {
      expect(isChunkLoadError(new Error('Loading CSS chunk 42 failed.'))).toBe(
        true
      )
    })

    it('detects dynamic import failures', () => {
      expect(
        isChunkLoadError(
          new Error('Failed to fetch dynamically imported module: /x.js')
        )
      ).toBe(true)
    })

    it('detects a plain-string rejection reason', () => {
      expect(isChunkLoadError('Loading chunk vendors-foo failed.')).toBe(true)
    })

    it('ignores unrelated errors and falsy values', () => {
      expect(isChunkLoadError(new Error('Something else broke'))).toBe(false)
      expect(isChunkLoadError(null)).toBe(false)
      expect(isChunkLoadError(undefined)).toBe(false)
      expect(isChunkLoadError({})).toBe(false)
    })
  })

  describe('stale deployment marker', () => {
    it('round-trips and clears on consume (single-shot)', () => {
      expect(consumeStaleDeployment()).toBe(false)

      markStaleDeployment()

      expect(consumeStaleDeployment()).toBe(true)
      expect(consumeStaleDeployment()).toBe(false)
    })
  })

  describe('recoverFromChunkError', () => {
    it('reloads on the first failure', () => {
      const reload = jest.fn()

      expect(recoverFromChunkError({ reload, now: 1_000 })).toBe('recovering')
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('gives up after the budget is exhausted within the window', () => {
      const reload = jest.fn()

      // consume the full budget back-to-back (e.g. the reload itself re-throws)
      for (let i = 0; i < MAX_RECOVERY_ATTEMPTS; i++) {
        expect(recoverFromChunkError({ reload, now: 1_000 + i })).toBe(
          'recovering'
        )
      }

      expect(recoverFromChunkError({ reload, now: 1_500 })).toBe('exhausted')
      expect(reload).toHaveBeenCalledTimes(MAX_RECOVERY_ATTEMPTS)
    })

    it('starts a fresh budget once the window has elapsed', () => {
      const reload = jest.fn()

      for (let i = 0; i < MAX_RECOVERY_ATTEMPTS; i++) {
        recoverFromChunkError({ reload, now: 1_000 })
      }

      expect(recoverFromChunkError({ reload, now: 1_000 })).toBe('exhausted')

      // a failure from a later deployment, past the window, recovers again
      expect(
        recoverFromChunkError({ reload, now: 1_000 + RECOVERY_WINDOW_MS + 1 })
      ).toBe('recovering')
    })
  })
})
