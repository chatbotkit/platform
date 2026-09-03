import { withAppAudienceCache, withCache } from '@/lib/app.cache'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import { ttlCache } from '@/lib/cache'

jest.mock('@/lib/cache', () => ({
  ttlCache: jest.fn(),
}))

describe('app.cache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('withCache', () => {
    it('should call ttlCache with correct cache key format', async () => {
      const mockFn = jest.fn().mockResolvedValue('test result')
      const mockSession = {
        id: 'session-123',
        user: { id: 'user-123' },
        payload: { aud: APP_AUDIENCE },
      }

      ttlCache.mockResolvedValue('cached result')

      await withCache(mockFn, {
        app: 'test-app',
        category: 'test-category',
        session: mockSession,
      })

      expect(ttlCache).toHaveBeenCalledWith(
        'app[test-app]:category[test-category]:session[session-123]:user[user-123]',
        60, // ONE_MINUTE_IN_SECONDS default
        mockFn
      )
    })

    it('should use custom timeInSeconds when provided', async () => {
      const mockFn = jest.fn().mockResolvedValue('test result')
      const mockSession = {
        id: 'session-456',
        user: { id: 'user-456' },
        payload: { aud: APP_AUDIENCE },
      }

      ttlCache.mockResolvedValue('cached result')

      await withCache(mockFn, {
        app: 'my-app',
        category: 'my-category',
        session: mockSession,
        timeInSeconds: 300,
      })

      expect(ttlCache).toHaveBeenCalledWith(
        'app[my-app]:category[my-category]:session[session-456]:user[user-456]',
        300,
        mockFn
      )
    })

    it('should return the cached result', async () => {
      const mockFn = jest.fn()
      const mockSession = {
        id: 'session-789',
        user: { id: 'user-789' },
        payload: { aud: APP_AUDIENCE },
      }

      ttlCache.mockResolvedValue('expected cached result')

      const result = await withCache(mockFn, {
        app: 'app',
        category: 'cat',
        session: mockSession,
      })

      expect(result).toBe('expected cached result')
    })

    it('should handle different session IDs creating different cache keys', async () => {
      const mockFn = jest.fn()
      const session1 = {
        id: 'session-1',
        user: { id: 'user-1' },
        payload: { aud: APP_AUDIENCE },
      }
      const session2 = {
        id: 'session-2',
        user: { id: 'user-2' },
        payload: { aud: APP_AUDIENCE },
      }

      ttlCache.mockResolvedValue('result')

      await withCache(mockFn, {
        app: 'app',
        category: 'cat',
        session: session1,
      })

      await withCache(mockFn, {
        app: 'app',
        category: 'cat',
        session: session2,
      })

      expect(ttlCache).toHaveBeenCalledWith(
        'app[app]:category[cat]:session[session-1]:user[user-1]',
        60,
        mockFn
      )

      expect(ttlCache).toHaveBeenCalledWith(
        'app[app]:category[cat]:session[session-2]:user[user-2]',
        60,
        mockFn
      )
    })

    it('should include the effective user in the key so one session id switched across accounts does not collide', async () => {
      const mockFn = jest.fn()

      // @note same session id, different effective user - this is exactly what a
      // dashboard account/team switch produces (run-as swaps session.user while
      // session.id stays put). The two must not share a cache entry.
      const parentSession = {
        id: 'session-shared',
        user: { id: 'user-parent' },
        payload: { aud: APP_AUDIENCE },
      }
      const childSession = {
        id: 'session-shared',
        user: { id: 'user-child' },
        payload: { aud: APP_AUDIENCE },
      }

      ttlCache.mockResolvedValue('result')

      await withCache(mockFn, {
        app: 'app',
        category: 'contact',
        session: parentSession,
      })
      await withCache(mockFn, {
        app: 'app',
        category: 'contact',
        session: childSession,
      })

      expect(ttlCache).toHaveBeenCalledWith(
        'app[app]:category[contact]:session[session-shared]:user[user-parent]',
        60,
        mockFn
      )

      expect(ttlCache).toHaveBeenCalledWith(
        'app[app]:category[contact]:session[session-shared]:user[user-child]',
        60,
        mockFn
      )
    })
  })

  describe('withAppAudienceCache', () => {
    describe('when session audience matches APP_AUDIENCE', () => {
      it('should use cache via withCache', async () => {
        const mockFn = jest.fn().mockResolvedValue('test result')
        const mockSession = {
          id: 'session-app',
          user: { id: 'user-app' },
          payload: { aud: APP_AUDIENCE },
        }

        ttlCache.mockResolvedValue('cached result')

        const result = await withAppAudienceCache(mockFn, {
          app: 'test-app',
          category: 'test-category',
          session: mockSession,
        })

        expect(ttlCache).toHaveBeenCalledWith(
          'app[test-app]:category[test-category]:session[session-app]:user[user-app]',
          60,
          mockFn
        )
        expect(result).toBe('cached result')
      })

      it('should respect custom timeInSeconds', async () => {
        const mockFn = jest.fn()
        const mockSession = {
          id: 'session-app-2',
          user: { id: 'user-app-2' },
          payload: { aud: APP_AUDIENCE },
        }

        ttlCache.mockResolvedValue('result')

        await withAppAudienceCache(mockFn, {
          app: 'app',
          category: 'cat',
          session: mockSession,
          timeInSeconds: 600,
        })

        expect(ttlCache).toHaveBeenCalledWith(
          'app[app]:category[cat]:session[session-app-2]:user[user-app-2]',
          600,
          mockFn
        )
      })
    })

    describe('when session audience does NOT match APP_AUDIENCE', () => {
      it('should bypass cache and call function directly', async () => {
        const mockFn = jest.fn().mockResolvedValue('direct result')
        const mockSession = {
          id: 'session-other',
          payload: { aud: 'OTHER_AUDIENCE' },
        }

        const result = await withAppAudienceCache(mockFn, {
          app: 'test-app',
          category: 'test-category',
          session: mockSession,
        })

        expect(ttlCache).not.toHaveBeenCalled()
        expect(mockFn).toHaveBeenCalledTimes(1)
        expect(result).toBe('direct result')
      })

      it('should not use cache even with custom timeInSeconds', async () => {
        const mockFn = jest.fn().mockResolvedValue('uncached result')
        const mockSession = {
          id: 'session-bypass',
          payload: { aud: 'DIFFERENT_AUDIENCE' },
        }

        const result = await withAppAudienceCache(mockFn, {
          app: 'app',
          category: 'cat',
          session: mockSession,
          timeInSeconds: 1000,
        })

        expect(ttlCache).not.toHaveBeenCalled()
        expect(mockFn).toHaveBeenCalledTimes(1)
        expect(result).toBe('uncached result')
      })
    })

    describe('edge cases', () => {
      it('should handle async function that throws error (with APP_AUDIENCE)', async () => {
        const mockError = new Error('Function error')
        const mockFn = jest.fn().mockRejectedValue(mockError)
        const mockSession = {
          id: 'session-error',
          user: { id: 'user-error' },
          payload: { aud: APP_AUDIENCE },
        }

        ttlCache.mockRejectedValue(mockError)

        await expect(
          withAppAudienceCache(mockFn, {
            app: 'app',
            category: 'cat',
            session: mockSession,
          })
        ).rejects.toThrow('Function error')
      })

      it('should handle async function that throws error (without APP_AUDIENCE)', async () => {
        const mockError = new Error('Direct error')
        const mockFn = jest.fn().mockRejectedValue(mockError)
        const mockSession = {
          id: 'session-error-2',
          payload: { aud: 'OTHER' },
        }

        await expect(
          withAppAudienceCache(mockFn, {
            app: 'app',
            category: 'cat',
            session: mockSession,
          })
        ).rejects.toThrow('Direct error')

        expect(ttlCache).not.toHaveBeenCalled()
      })

      it('should handle session with null/undefined audience', async () => {
        const mockFn = jest.fn().mockResolvedValue('result')
        const mockSession = {
          id: 'session-null',
          payload: { aud: null },
        }

        const result = await withAppAudienceCache(mockFn, {
          app: 'app',
          category: 'cat',
          session: mockSession,
        })

        // @note null audience doesn't match APP_AUDIENCE, so should bypass cache
        expect(ttlCache).not.toHaveBeenCalled()
        expect(mockFn).toHaveBeenCalledTimes(1)
        expect(result).toBe('result')
      })
    })
  })
})
