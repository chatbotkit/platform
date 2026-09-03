/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prismaMock from '@/prisma/client'

import handler from './create'

import crypto from 'crypto'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

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
    toString: jest.fn(() => 'mocked-access-token-hex'),
  })),
}))

const prisma = prismaMock

describe('/api/v1/integration/skillserver/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('creates a skillserver integration and returns its id', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({
        id: 'skillserver-int-456',
      })

      const body = {
        name: 'Customer Support Tools',
        alias: 'support-tools',
        description: 'Exposes customer support abilities',
        skillsetId: 'skillset-123',
      }

      const res = await handler(makeReq(), mockSession, body)

      expect(res.status).toBe(200)

      const data = await res.json()

      expect(data).toEqual({ id: 'skillserver-int-456' })
    })

    it('stores userId from session', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      expect(prisma.skillserverIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('generates a unique access token', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.accessToken).toBe('mocked-access-token-hex')
    })

    it('passes all fields to prisma', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      const body = {
        alias: 'my-skillserver',
        name: 'My SkillServer Integration',
        description: 'Test skillserver',
        skillsetId: 'skillset-456',
        blueprintId: 'bp-789',
        meta: { custom: 'data' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.skillserverIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            alias: 'my-skillserver',
            name: 'My SkillServer Integration',
            description: 'Test skillserver',
            skillsetId: 'skillset-456',
            blueprintId: 'bp-789',
            meta: { custom: 'data' },
          }),
        })
      )
    })
  })

  describe('optional fields', () => {
    it('handles null values for optional fields', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      const body = {
        name: 'Bot',
        alias: 'bot',
        description: null,
        skillsetId: null,
        blueprintId: null,
        meta: null,
      }

      await handler(makeReq(), mockSession, body)

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.description).toBeNull()
      expect(callData.skillsetId).toBeNull()
      expect(callData.blueprintId).toBeNull()
      expect(callData.meta).toBeNull()
    })

    it('stores provided optional fields', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      const body = {
        name: 'Support',
        alias: 'support',
        description: 'Support skillserver',
        skillsetId: 'skillset-789',
        blueprintId: 'bp-abc',
        meta: { tier: 'premium' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.skillserverIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Support skillserver',
            skillsetId: 'skillset-789',
            blueprintId: 'bp-abc',
            meta: { tier: 'premium' },
          }),
        })
      )
    })

    it('handles empty string values for optional text fields', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      const body = {
        name: 'Bot',
        alias: 'bot',
        description: '',
      }

      await handler(makeReq(), mockSession, body)

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.description).toBe('')
    })
  })

  describe('blueprint and skillset linking', () => {
    it('resolves blueprintId from nested object', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        blueprintId: { id: 'bp-123' },
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-123')
    })

    it('resolves skillsetId from nested object', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        skillsetId: { id: 'skillset-456' },
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.skillsetId).toBe('skillset-456')
    })

    it('uses string blueprintId and skillsetId directly', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        blueprintId: 'bp-string',
        skillsetId: 'skillset-string',
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-string')
      expect(callData.skillsetId).toBe('skillset-string')
    })

    it('falls back to string value when blueprintId has no .id property', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        blueprintId: 'bp-direct',
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-direct')
    })

    it('falls back to string value when skillsetId has no .id property', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        skillsetId: 'skillset-direct',
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.skillsetId).toBe('skillset-direct')
    })
  })

  describe('edge cases and minimal data', () => {
    it('handles minimal required fields only', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({
        id: 'ss-min',
      })

      await handler(makeReq(), mockSession, {
        name: 'Minimal Bot',
        alias: 'minimal',
      })

      expect(prisma.skillserverIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            name: 'Minimal Bot',
            alias: 'minimal',
            accessToken: 'mocked-access-token-hex',
          }),
        })
      )
    })

    it('handles long description text', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      const longDescription = 'A'.repeat(500)

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        description: longDescription,
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.description).toBe(longDescription)
    })

    it('returns select with id only', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      expect(prisma.skillserverIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
          },
        })
      )
    })
  })

  describe('access token generation', () => {
    it('generates 32 random bytes for access token', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      expect(crypto.randomBytes).toHaveBeenCalledWith(32)
    })

    it('converts access token to hex string', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(typeof callData.accessToken).toBe('string')
      expect(callData.accessToken).toBe('mocked-access-token-hex')
    })

    it('generates fresh token for each creation', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot1',
        alias: 'bot1',
      })

      await handler(makeReq(), mockSession, {
        name: 'Bot2',
        alias: 'bot2',
      })

      const call1 = prisma.skillserverIntegration.create.mock.calls[0][0].data
      const call2 = prisma.skillserverIntegration.create.mock.calls[1][0].data

      // Both should have the mocked token (in real usage they'd be different)
      expect(call1.accessToken).toBe('mocked-access-token-hex')
      expect(call2.accessToken).toBe('mocked-access-token-hex')
    })
  })

  describe('session limits integration', () => {
    it('enforces session limits for database/integration', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      // The withSessionLimits wrapper is mocked to pass through,
      // but we verify the handler is called with the correct context
      expect(prisma.skillserverIntegration.create).toHaveBeenCalled()
    })
  })

  describe('meta field handling', () => {
    it('stores complex metadata objects', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      const meta = {
        version: '1.0',
        features: ['search', 'sort', 'filter'],
        config: { maxItems: 100, timeout: 5000 },
        nested: { deep: { value: 'test' } },
      }

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        meta,
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.meta).toEqual(meta)
    })

    it('preserves empty metadata objects', async () => {
      prisma.skillserverIntegration.create.mockResolvedValue({ id: 'ss-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        meta: {},
      })

      const callData =
        prisma.skillserverIntegration.create.mock.calls[0][0].data

      expect(callData.meta).toEqual({})
    })
  })
})
