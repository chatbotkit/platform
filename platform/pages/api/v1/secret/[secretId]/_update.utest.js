/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { SecretKind } from '@/prisma/types'

import { getMeta } from '@/lib/meta'

import handler from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      findUniqueByIdentifier: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  SecretKind: { shared: 'shared', personal: 'personal' },
  SecretType: { plain: 'plain', bearer: 'bearer', oauth: 'oauth' },
  SecretVisibility: {
    private: 'private',
    protected: 'protected',
    public: 'public',
  },
}))

jest.mock('@/prisma/zod', () => ({
  SecretConfig: {},
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const chainable = () => {
    const obj = {}

    ;['valid', 'allow', 'zodSchema'].forEach((m) => {
      obj[m] = () => obj
    })

    return obj
  }

  return {
    __esModule: true,
    default: {
      object: () => chainable(),
      string: () => chainable(),
    },
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, existing) => meta || existing),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  conflict: (msg) => ({ status: 409, body: { error: msg } }),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/blueprintId', () => () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/meta', () => ({}))
jest.mock('@/schemas/name', () => ({}))

describe('/api/v1/secret/[secretId]/update', () => {
  const session = { user: { id: 'user-1' } }

  const makeReq = (secretId = 'secret-1') => ({
    query: { secretId },
  })

  const makeExistingSecret = (overrides = {}) => ({
    id: 'secret-1',
    userId: 'user-1',
    kind: SecretKind.shared,
    meta: null,
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.secret.update.mockResolvedValue({})
  })

  describe('personal secret value restriction', () => {
    it('should return conflict when updating personal secret with a value', async () => {
      const body = { kind: SecretKind.personal, value: 'some-value' }

      const result = await handler(makeReq(), session, body)

      expect(result.status).toBe(409)
    })

    it('should allow personal secret update without a value', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret()
      )

      const body = { kind: SecretKind.personal, value: undefined }

      const result = await handler(makeReq(), session, body)

      expect(result.status).toBe(200)
    })
  })

  describe('not found handling', () => {
    it('should return 404 when secret does not exist', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(makeReq(), session, {})

      expect(result.status).toBe(404)
    })
  })

  describe('authorization', () => {
    it('should return 403 when user does not own the secret', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret({ userId: 'other-user' })
      )

      const result = await handler(makeReq(), session, {})

      expect(result.status).toBe(403)
    })
  })

  describe('basic functionality', () => {
    it('should return the secret id on successful update', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret()
      )

      const result = await handler(makeReq(), session, { name: 'new-name' })

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('secret-1')
    })

    it('should call prisma.secret.update with correct where clause', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret()
      )

      await handler(makeReq(), session, { name: 'new-name' })

      expect(prisma.secret.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'secret-1' },
        })
      )
    })
  })

  describe('value handling based on secret kind', () => {
    it('should include value in update data for shared secrets', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret({ kind: SecretKind.shared })
      )

      await handler(makeReq(), session, { value: 'new-token' })

      const updateCall = prisma.secret.update.mock.calls[0][0]

      expect(updateCall.data.value).toBe('new-token')
    })

    it('should set value to null for personal secrets regardless of input', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret({ kind: SecretKind.personal })
      )

      // value is falsy, so no conflict check triggers
      await handler(makeReq(), session, { value: undefined })

      const updateCall = prisma.secret.update.mock.calls[0][0]

      expect(updateCall.data.value).toBeNull()
    })
  })

  describe('config credential masking', () => {
    it('should keep the stored config.clientSecret when the sentinel is echoed back', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret({
          config: { clientId: 'old-id', clientSecret: 'stored-secret' },
        })
      )

      await handler(makeReq(), session, {
        config: { clientId: 'new-id', clientSecret: '********' },
      })

      expect(prisma.secret.update.mock.calls[0][0].data.config).toEqual({
        clientId: 'new-id',
        clientSecret: 'stored-secret',
      })
    })

    it('should store a new config.clientSecret when a real value is provided', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret({
          config: { clientSecret: 'stored-secret' },
        })
      )

      await handler(makeReq(), session, {
        config: { clientSecret: 'rotated-secret' },
      })

      expect(prisma.secret.update.mock.calls[0][0].data.config).toEqual({
        clientSecret: 'rotated-secret',
      })
    })

    it('should not persist the sentinel when nothing is stored', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret({ config: null })
      )

      await handler(makeReq(), session, {
        config: { clientId: 'id', clientSecret: '********' },
      })

      expect(prisma.secret.update.mock.calls[0][0].data.config).toEqual({
        clientId: 'id',
      })
    })

    it('should leave config undefined when the body omits it', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret()
      )

      await handler(makeReq(), session, { name: 'renamed' })

      expect(prisma.secret.update.mock.calls[0][0].data.config).toBeUndefined()
    })
  })

  describe('blueprintId handling', () => {
    it('should use blueprint.id when blueprintId is an object', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret()
      )

      await handler(makeReq(), session, { blueprintId: { id: 'bp-1' } })

      const updateCall = prisma.secret.update.mock.calls[0][0]

      expect(updateCall.data.blueprintId).toBe('bp-1')
    })

    it('should use blueprintId directly when it is a string', async () => {
      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret()
      )

      await handler(makeReq(), session, { blueprintId: 'bp-2' })

      const updateCall = prisma.secret.update.mock.calls[0][0]

      expect(updateCall.data.blueprintId).toBe('bp-2')
    })
  })

  describe('meta merging', () => {
    it('should call getMeta with new meta and existing meta', async () => {
      const existingMeta = { key: 'old' }

      prisma.secret.findUniqueByIdentifier.mockResolvedValue(
        makeExistingSecret({ meta: existingMeta })
      )

      await handler(makeReq(), session, { meta: { key: 'new' } })

      expect(getMeta).toHaveBeenCalledWith({ key: 'new' }, existingMeta)
    })
  })
})
