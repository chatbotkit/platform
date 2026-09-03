/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/types', () => ({
  IntegrationVisibility: {
    private: 'private',
    public: 'public',
    unlisted: 'unlisted',
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mocked-verify-token-hex'),
  })),
}))

describe('/api/v1/integration/instagram/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('creates an instagram integration and returns its id', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({
        id: 'instagram-int-456',
      })

      const body = {
        name: 'My Instagram Bot',
        description: 'A test bot',
        accessToken: 'token-abc',
      }

      const res = await handler(makeReq(), mockSession, body)

      expect(res.status).toBe(200)

      const data = await res.json()

      expect(data).toEqual({ id: 'instagram-int-456' })
    })

    it('stores userId from session', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
      })

      expect(prisma.instagramIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('generates a unique verify token', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.verifyToken).toBe('mocked-verify-token-hex')
    })
  })

  describe('optional fields', () => {
    it('stores all provided optional fields', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      const body = {
        name: 'Bot',
        description: 'Test description',
        accessToken: 'token-xyz',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: true,
        meta: { foo: 'bar' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.instagramIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Bot',
            description: 'Test description',
            accessToken: 'token-xyz',
            contactCollection: true,
            sessionDuration: 3600000,
            attachments: true,
            meta: { foo: 'bar' },
          }),
        })
      )
    })

    it('handles null and empty string values for optional fields', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      const body = {
        name: 'Bot',
        accessToken: '',
        sessionDuration: null,
      }

      await handler(makeReq(), mockSession, body)

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.accessToken).toBe('')
      expect(callData.sessionDuration).toBeNull()
    })
  })

  describe('masked credential handling', () => {
    it('strips accessToken when submitted as masked value "********"', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        accessToken: '********',
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.accessToken).toBeUndefined()
    })

    it('preserves real accessToken that is not masked', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        accessToken: 'real-token-123',
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.accessToken).toBe('real-token-123')
    })
    it('strips appSecret when submitted as masked value "********"', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        appSecret: '********',
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.appSecret).toBeUndefined()
    })

    it('stores the Meta app secret when a real value is provided', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        appSecret: 'meta-app-secret',
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.appSecret).toBe('meta-app-secret')
    })

    it('allows clearing the Meta app secret with null', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        appSecret: null,
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.appSecret).toBeNull()
    })
  })

  describe('blueprint and bot linking', () => {
    it('resolves blueprintId from nested object', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        blueprintId: { id: 'bp-123' },
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-123')
    })

    it('resolves botId from nested object', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        botId: { id: 'bot-456' },
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.botId).toBe('bot-456')
    })

    it('uses string blueprintId and botId directly', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        blueprintId: 'bp-string',
        botId: 'bot-string',
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-string')
      expect(callData.botId).toBe('bot-string')
    })
  })

  describe('sessionDuration validation', () => {
    it('accepts sessionDuration within valid range', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        sessionDuration: 86400000,
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.sessionDuration).toBe(86400000)
    })

    it('accepts zero as sessionDuration', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        sessionDuration: 0,
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.sessionDuration).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles minimal required fields only', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-min' })

      await handler(makeReq(), mockSession, {
        name: 'Minimal Bot',
      })

      expect(prisma.instagramIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            name: 'Minimal Bot',
            verifyToken: 'mocked-verify-token-hex',
          }),
        })
      )
    })

    it('handles contactCollection toggle', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        contactCollection: false,
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.contactCollection).toBe(false)
    })

    it('handles attachments toggle', async () => {
      prisma.instagramIntegration.create.mockResolvedValue({ id: 'ig-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        attachments: false,
      })

      const callData = prisma.instagramIntegration.create.mock.calls[0][0].data

      expect(callData.attachments).toBe(false)
    })
  })
})
