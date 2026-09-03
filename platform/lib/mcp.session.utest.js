/* eslint-disable @typescript-eslint/no-require-imports */
import {
  createSession,
  deleteSession,
  getOrCreateSession,
  getSession,
  validateSession,
} from './mcp.session'

jest.mock('@/lib/cuid', () => jest.fn(() => 'mock-cuid-12345'))

jest.mock('@/lib/memcache', () => ({
  setex: jest.fn(),
  get: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
}))

const memcache = require('@/lib/memcache')
const cuid = require('@/lib/cuid')

describe('mcp.session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createSession', () => {
    it('should create a new session with generated ID', async () => {
      const user = { id: 'user-123' }

      const sessionId = await createSession(user)

      expect(sessionId).toBe('mock-cuid-12345')
      expect(cuid).toHaveBeenCalled()
      expect(memcache.setex).toHaveBeenCalledWith(
        'mcp:session:mock-cuid-12345',
        86400, // 24 hours in seconds
        {
          id: 'mock-cuid-12345',
          userId: 'user-123',
          createdAt: expect.any(Number),
        }
      )
    })

    it('should store createdAt timestamp', async () => {
      const user = { id: 'user-456' }
      const beforeTime = Date.now()

      await createSession(user)

      const callArgs = memcache.setex.mock.calls[0][2]

      expect(callArgs.createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(callArgs.createdAt).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('getSession', () => {
    it('should retrieve existing session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        createdAt: 1234567890,
      }

      memcache.get.mockResolvedValue(mockSession)

      const result = await getSession('session-123')

      expect(result).toEqual(mockSession)
      expect(memcache.get).toHaveBeenCalledWith('mcp:session:session-123')
    })

    it('should return null for non-existent session', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await getSession('non-existent')

      expect(result).toBeNull()
    })

    it('should return null when redis returns undefined', async () => {
      memcache.get.mockResolvedValue(undefined)

      const result = await getSession('undefined-session')

      expect(result).toBeNull()
    })

    it('should handle empty string session ID', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await getSession('')

      expect(result).toBeNull()
      expect(memcache.get).toHaveBeenCalledWith('mcp:session:')
    })
  })

  describe('validateSession', () => {
    it('should validate session belonging to correct user', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        createdAt: 1234567890,
      }

      memcache.get.mockResolvedValue(mockSession)
      memcache.expire.mockResolvedValue(1)

      const user = { id: 'user-123' }
      const result = await validateSession(user, 'session-123')

      expect(result).toEqual(mockSession)
      expect(memcache.expire).toHaveBeenCalledWith(
        'mcp:session:session-123',
        86400
      )
    })

    it('should return null for wrong user', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        createdAt: 1234567890,
      }

      memcache.get.mockResolvedValue(mockSession)

      const user = { id: 'user-456' }
      const result = await validateSession(user, 'session-123')

      expect(result).toBeNull()
      expect(memcache.expire).not.toHaveBeenCalled()
    })

    it('should return null for non-existent session', async () => {
      memcache.get.mockResolvedValue(null)

      const user = { id: 'user-123' }
      const result = await validateSession(user, 'non-existent')

      expect(result).toBeNull()
      expect(memcache.expire).not.toHaveBeenCalled()
    })

    it('should refresh TTL on successful validation', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        createdAt: 1234567890,
      }

      memcache.get.mockResolvedValue(mockSession)

      const user = { id: 'user-123' }

      await validateSession(user, 'session-123')

      expect(memcache.expire).toHaveBeenCalledTimes(1)
      expect(memcache.expire).toHaveBeenCalledWith(
        'mcp:session:session-123',
        86400
      )
    })
  })

  describe('getOrCreateSession', () => {
    it('should return existing valid session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        createdAt: 1234567890,
      }

      memcache.get.mockResolvedValue(mockSession)

      const user = { id: 'user-123' }
      const result = await getOrCreateSession(user, 'session-123')

      expect(result).toBe('session-123')
      expect(memcache.setex).not.toHaveBeenCalled()
    })

    it('should create new session if sessionId not provided', async () => {
      const user = { id: 'user-123' }

      const result = await getOrCreateSession(user)

      expect(result).toBe('mock-cuid-12345')
      expect(memcache.setex).toHaveBeenCalled()
    })

    it('should create new session if sessionId is null', async () => {
      const user = { id: 'user-123' }

      const result = await getOrCreateSession(user, null)

      expect(result).toBe('mock-cuid-12345')
      expect(memcache.setex).toHaveBeenCalled()
    })

    it('should create new session if existing session is invalid', async () => {
      memcache.get.mockResolvedValue(null)

      const user = { id: 'user-123' }
      const result = await getOrCreateSession(user, 'invalid-session')

      expect(result).toBe('mock-cuid-12345')
      expect(memcache.setex).toHaveBeenCalled()
    })

    it('should create new session if session belongs to different user', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-456',
        createdAt: 1234567890,
      }

      memcache.get.mockResolvedValue(mockSession)

      const user = { id: 'user-123' }
      const result = await getOrCreateSession(user, 'session-123')

      expect(result).toBe('mock-cuid-12345')
      expect(memcache.setex).toHaveBeenCalled()
    })
  })

  describe('deleteSession', () => {
    it('should delete session from redis', async () => {
      memcache.del.mockResolvedValue(1)

      await deleteSession('session-123')

      expect(memcache.del).toHaveBeenCalledWith('mcp:session:session-123')
    })

    it('should handle deleting non-existent session', async () => {
      memcache.del.mockResolvedValue(0)

      await deleteSession('non-existent')

      expect(memcache.del).toHaveBeenCalledWith('mcp:session:non-existent')
    })

    it('should handle empty session ID', async () => {
      memcache.del.mockResolvedValue(0)

      await deleteSession('')

      expect(memcache.del).toHaveBeenCalledWith('mcp:session:')
    })
  })
})
