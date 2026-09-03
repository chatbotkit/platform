import prisma from '@/prisma/client'

import { captureException } from '@/lib/error'

import { sendEvent } from '@/pages/api/user/[userId]/queue'

import { adapter } from './auth.adapter'

import { __createVerificationToken } from '@next-auth/prisma-adapter'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
    },
    verificationToken: {
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/pages/api/user/[userId]/queue', () => ({
  sendEvent: jest.fn(),
}))

jest.mock('@next-auth/prisma-adapter', () => {
  // @note surfaced so tests can assert against the wrapped method
  const createVerificationToken = jest.fn(async (data) => data)

  return {
    __createVerificationToken: createVerificationToken,
    PrismaAdapter: jest.fn(() => ({
      createUser: jest.fn(async (user) => ({
        id: 'user-123',
        email: user.email,
        name: user.name,
        emailVerified: null,
      })),
      createVerificationToken,
      getUserByEmail: jest.fn(),
      getUserByAccount: jest.fn(),
      linkAccount: jest.fn(),
      createSession: jest.fn(),
      getSessionAndUser: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      updateUser: jest.fn(),
    })),
  }
})

describe('auth.adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('adapter structure', () => {
    it('should be defined and have required methods', () => {
      expect(adapter).toBeDefined()
      expect(typeof adapter.createUser).toBe('function')
    })

    it('should expose standard adapter methods', () => {
      expect(adapter).toHaveProperty('createUser')
      expect(adapter).toHaveProperty('getUserByEmail')
      expect(adapter).toHaveProperty('getUserByAccount')
    })
  })

  describe('createUser', () => {
    it('should create user and trigger setup event', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
      }

      sendEvent.mockResolvedValue({ success: true })

      const result = await adapter.createUser(userData)

      expect(result).toBeDefined()
      expect(result.id).toBe('user-123')
      expect(result.email).toBe('test@example.com')
      expect(sendEvent).toHaveBeenCalledWith('user-123', {
        type: 'setup',
        payload: {},
      })
    })

    it('should handle setup event errors without failing user creation', async () => {
      const userData = {
        email: 'error@example.com',
        name: 'Error Test',
      }

      sendEvent.mockRejectedValueOnce(new Error('Queue error'))

      const result = await adapter.createUser(userData)

      expect(result).toBeDefined()
      expect(result.id).toBe('user-123')
      expect(captureException).toHaveBeenCalledTimes(1)
      expect(captureException).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should send only the setup event on creation', async () => {
      const userData = {
        email: 'order@example.com',
        name: 'Order Test',
      }

      const eventCalls = []

      sendEvent.mockImplementation((userId, event) => {
        eventCalls.push(event.type)

        return Promise.resolve({ success: true })
      })

      await adapter.createUser(userData)

      expect(eventCalls).toEqual(['setup'])
    })

    it('should block account creation for a disallowed (disposable) email', async () => {
      await expect(
        adapter.createUser({ email: 'spam@throwawaymail.com', name: 'X' })
      ).rejects.toThrow('Email is not allowed')

      // no downstream side effects: no setup event fired
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should block account creation for a throwaway-looking local part', async () => {
      await expect(
        adapter.createUser({ email: 'qwv8trzk3lmn@example.com', name: 'X' })
      ).rejects.toThrow('Email is not allowed')

      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should handle user creation with minimal data', async () => {
      const userData = {
        email: 'minimal@example.com',
      }

      sendEvent.mockResolvedValue({ success: true })

      const result = await adapter.createUser(userData)

      expect(result).toBeDefined()
      expect(result.email).toBe('minimal@example.com')
    })

    it('should pass created user ID to the setup event', async () => {
      const userData = {
        email: 'id-test@example.com',
        name: 'ID Test',
      }

      sendEvent.mockResolvedValue({ success: true })

      await adapter.createUser(userData)

      expect(sendEvent).toHaveBeenNthCalledWith(1, 'user-123', {
        type: 'setup',
        payload: {},
      })
    })
  })

  describe('createVerificationToken', () => {
    it('retires every earlier code for the address before issuing a new one', async () => {
      const data = {
        identifier: 'victim@example.com',
        token: 'hashed',
        expires: new Date(Date.now() + 60_000),
      }

      const result = await adapter.createVerificationToken(data)

      expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { identifier: 'victim@example.com' },
      })
      expect(result).toEqual(data)

      const deleteOrder =
        prisma.verificationToken.deleteMany.mock.invocationCallOrder[0]
      const createOrder =
        __createVerificationToken.mock.invocationCallOrder[0]

      expect(deleteOrder).toBeLessThan(createOrder)
    })
  })

  describe('proxy behavior', () => {
    it('should delegate other adapter methods through proxy', () => {
      expect(typeof adapter.getUserByEmail).toBe('function')
      expect(typeof adapter.getUserByAccount).toBe('function')
      expect(typeof adapter.linkAccount).toBe('function')
    })

    it('should intercept only createUser and createVerificationToken', () => {
      // the rest are passed through
      expect(adapter.createUser).toBeDefined()
      expect(adapter.getUserByEmail).toBeDefined()
      expect(adapter.linkAccount).toBeDefined()
    })
  })
})
