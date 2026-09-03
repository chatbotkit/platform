import {
  getSafeSessionStore,
  getSession,
  getSessionStore,
  hasSession,
  isSession,
  runInSessionContext,
  updateSessionStore,
  wrapInSessionContext,
} from './session.context'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

describe('session.context', () => {
  describe('wrapInSessionContext', () => {
    it('should wrap function in session context', async () => {
      const fn = jest.fn().mockResolvedValue('result')
      const wrapped = wrapInSessionContext(fn)

      const result = await wrapped('arg1', 'arg2')

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result).toBe('result')
    })

    it('should handle sync functions', async () => {
      const fn = jest.fn().mockReturnValue('sync-result')
      const wrapped = wrapInSessionContext(fn)

      const result = await wrapped()

      expect(fn).toHaveBeenCalled()
      expect(result).toBe('sync-result')
    })

    it('should handle function errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Function error'))
      const wrapped = wrapInSessionContext(fn)

      await expect(wrapped()).rejects.toThrow('Function error')
    })
  })

  describe('runInSessionContext', () => {
    it('should run function in session context with args', async () => {
      const fn = jest.fn().mockResolvedValue('result')

      const result = await runInSessionContext(fn, 'arg1', 'arg2')

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result).toBe('result')
    })

    it('should run function without args', async () => {
      const fn = jest.fn().mockResolvedValue('no-args')

      const result = await runInSessionContext(fn)

      expect(fn).toHaveBeenCalled()
      expect(result).toBe('no-args')
    })
  })

  describe('getSafeSessionStore', () => {
    it('should return empty object when no store exists', async () => {
      const fn = () => {
        const store = getSafeSessionStore()

        expect(store).toEqual({})
      }

      await runInSessionContext(fn)
    })

    it('should return store when in context', async () => {
      const fn = () => {
        updateSessionStore({ userId: '123' })

        const store = getSafeSessionStore()

        expect(store).toEqual({ userId: '123' })
      }

      await runInSessionContext(fn)
    })
  })

  describe('getSessionStore', () => {
    it('should throw when no store exists outside context', () => {
      expect(() => getSessionStore()).toThrow('Session store not found')
    })

    it('should return store when in context', async () => {
      const fn = () => {
        const store = getSessionStore()

        expect(store).toBeDefined()
        expect(typeof store).toBe('object')
      }

      await runInSessionContext(fn)
    })
  })

  describe('updateSessionStore', () => {
    it('should update session store with new values', async () => {
      const fn = () => {
        updateSessionStore({ userId: '123', name: 'Test User' })

        const store = getSessionStore()

        expect(store.userId).toBe('123')
        expect(store.name).toBe('Test User')
      }

      await runInSessionContext(fn)
    })

    it('should merge updates into existing store', async () => {
      const fn = () => {
        updateSessionStore({ userId: '123' })
        updateSessionStore({ name: 'Test User' })

        const store = getSessionStore()

        expect(store.userId).toBe('123')
        expect(store.name).toBe('Test User')
      }

      await runInSessionContext(fn)
    })

    it('should throw when updating outside context', () => {
      expect(() => updateSessionStore({ userId: '123' })).toThrow(
        'Session store not found'
      )
    })
  })

  describe('isSession', () => {
    it('should return true for valid session object', () => {
      const session = {
        id: 'session-id',
        user: { id: 'user-id' },
      }

      expect(isSession(session)).toBe(true)
    })

    it('should return false for null', () => {
      expect(isSession(null)).toBeFalsy()
    })

    it('should return false for undefined', () => {
      expect(isSession(undefined)).toBeFalsy()
    })

    it('should return false for non-object', () => {
      expect(isSession('not-an-object')).toBe(false)
      expect(isSession(123)).toBe(false)
      expect(isSession(true)).toBe(false)
    })

    it('should return false for object without id', () => {
      expect(isSession({ user: {} })).toBe(false)
    })

    it('should return false for object without user', () => {
      expect(isSession({ id: 'session-id' })).toBe(false)
    })

    it('should return false for object with non-string id', () => {
      expect(isSession({ id: 123, user: {} })).toBe(false)
    })
  })

  describe('getSession', () => {
    it('should return session when valid', async () => {
      const fn = () => {
        updateSessionStore({
          id: 'session-id',
          user: { id: 'user-id' },
        })

        const session = getSession()

        expect(session.id).toBe('session-id')
        expect(session.user).toEqual({ id: 'user-id' })
      }

      await runInSessionContext(fn)
    })

    it('should throw when session is invalid', async () => {
      const fn = () => {
        updateSessionStore({ invalid: 'data' })
        expect(() => getSession()).toThrow('Invalid session object')
      }

      await runInSessionContext(fn)
    })

    it('should throw when no session exists', () => {
      expect(() => getSession()).toThrow('Session store not found')
    })
  })

  describe('hasSession', () => {
    it('should return true when valid session exists', async () => {
      const fn = () => {
        updateSessionStore({
          id: 'session-id',
          user: { id: 'user-id' },
        })
        expect(hasSession()).toBe(true)
      }

      await runInSessionContext(fn)
    })

    it('should return false when no session exists', () => {
      expect(hasSession()).toBe(false)
    })

    it('should return false when invalid session exists', async () => {
      const fn = () => {
        updateSessionStore({ invalid: 'data' })
        expect(hasSession()).toBe(false)
      }

      await runInSessionContext(fn)
    })
  })
})
