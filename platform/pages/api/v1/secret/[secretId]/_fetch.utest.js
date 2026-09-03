/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((v) => v),
}))

describe('/api/v1/secret/[secretId]/fetch', () => {
  const session = { user: { id: 'user-1' } }

  const makeReq = (secretId = 'secret-1') => ({
    query: { secretId },
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('not found handling', () => {
    it('should return 404 when secret does not exist', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(makeReq(), session)

      expect(result.status).toBe(404)
    })
  })

  describe('authorization', () => {
    it('should return 403 when user does not own the secret', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue({
        id: 'secret-1',
        userId: 'other-user',
        name: 'my-secret',
      })

      const result = await handler(makeReq(), session)

      expect(result.status).toBe(403)
    })
  })

  describe('basic functionality', () => {
    it('should return secret data when owner requests it', async () => {
      const secret = {
        id: 'secret-1',
        alias: 'my-api-key',
        userId: 'user-1',
        name: 'my-api-key',
        description: 'An API key',
        kind: 'shared',
        type: 'bearer',
        config: null,
        visibility: 'private',
        blueprintId: null,
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

      const result = await handler(makeReq(), session)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret-1')
      expect(result.body.alias).toBe('my-api-key')
      expect(result.body.name).toBe('my-api-key')
    })

    it('should mask config.clientSecret and leave the rest of config intact', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue({
        id: 'secret-1',
        userId: 'user-1',
        config: {
          clientId: 'client-id',
          clientSecret: 'super-secret',
          tokenUrl: 'https://idp.example.com/token',
        },
      })

      const result = await handler(makeReq(), session)

      expect(result.status).toBe(200)
      expect(result.body.config).toEqual({
        clientId: 'client-id',
        clientSecret: '********',
        tokenUrl: 'https://idp.example.com/token',
      })
    })

    it('should return config.clientSecret as null when not configured', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue({
        id: 'secret-1',
        userId: 'user-1',
        config: { clientId: 'client-id', clientSecret: null },
      })

      const result = await handler(makeReq(), session)

      expect(result.body.config).toEqual({
        clientId: 'client-id',
        clientSecret: null,
      })
    })

    it('should pass a null config through', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue({
        id: 'secret-1',
        userId: 'user-1',
        config: null,
      })

      const result = await handler(makeReq(), session)

      expect(result.body.config).toBeNull()
    })

    it('should strip userId from the response', async () => {
      const secret = {
        id: 'secret-1',
        userId: 'user-1',
        name: 'my-api-key',
      }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

      const result = await handler(makeReq(), session)

      expect(result.status).toBe(200)
      expect(result.body.userId).toBeUndefined()
    })

    it('should look up secret using secretId from URL param', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      await handler(makeReq('abc-123'), session)

      expect(prisma.secret.findUniqueByIdentifier).toHaveBeenCalledWith(
        session.user,
        'abc-123',
        expect.objectContaining({ select: expect.any(Object) })
      )
    })

    it('should pass a select object with expected fields', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      await handler(makeReq(), session)

      const selectArg = prisma.secret.findUniqueByIdentifier.mock.calls[0][2]

      expect(selectArg.select.id).toBe(true)
      expect(selectArg.select.alias).toBe(true)
      expect(selectArg.select.name).toBe(true)
      expect(selectArg.select.userId).toBe(true)
      expect(selectArg.select.kind).toBe(true)
      expect(selectArg.select.type).toBe(true)
      expect(selectArg.select.visibility).toBe(true)
    })
  })
})
