/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      secret: {
        create: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  conflict: (msg) => ({ status: 409, message: msg }),
  ok: (data) => ({ status: 200, ...data }),
}))

// @note prisma types are mocked so the module loads cleanly without a real DB client
jest.mock('@/prisma/types', () => ({
  SecretKind: { shared: 'shared', personal: 'personal' },
  SecretType: { plain: 'plain', bearer: 'bearer', oauth: 'oauth' },
  SecretVisibility: { private: 'private', public: 'public' },
}))

describe('POST /api/v1/secret/create', () => {
  const mockSession = { user: { id: 'user-123' } }
  const mockReq = {}

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('security - personal secrets cannot store a value', () => {
    it('should reject a personal secret that includes a value', async () => {
      const body = { kind: 'personal', type: 'bearer', value: 'sk_live_abc' }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(409)
      expect(prisma.secret.create).not.toHaveBeenCalled()
    })

    it('should allow a personal secret without a value', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-personal-1' })

      const body = { kind: 'personal', type: 'bearer' }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.id).toBe('secret-personal-1')
    })

    it('should always write null as the value for personal secrets', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-personal-2' })

      const body = { kind: 'personal', type: 'oauth' }

      await handler(mockReq, mockSession, body)

      const createData = prisma.secret.create.mock.calls[0][0].data

      expect(createData.value).toBeNull()
    })
  })

  describe('shared secrets', () => {
    it('should create a shared secret and return its id', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-shared-1' })

      const body = {
        name: 'My API Key',
        kind: 'shared',
        type: 'bearer',
        value: 'Bearer sk_live_abc123',
        visibility: 'private',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.id).toBe('secret-shared-1')
    })

    it('should persist the value for shared secrets', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-shared-2' })

      const body = { kind: 'shared', type: 'bearer', value: 'sk_live_xyz' }

      await handler(mockReq, mockSession, body)

      const createData = prisma.secret.create.mock.calls[0][0].data

      expect(createData.value).toBe('sk_live_xyz')
    })

    it('should associate the new secret with the session user', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-shared-3' })

      const body = { kind: 'shared', type: 'plain', value: 'token' }

      await handler(mockReq, mockSession, body)

      const createData = prisma.secret.create.mock.calls[0][0].data

      expect(createData.userId).toBe('user-123')
    })

    it('should forward name, description, meta, and visibility to the database', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-shared-4' })

      const body = {
        name: 'Named Secret',
        description: 'A test description',
        kind: 'shared',
        type: 'plain',
        value: 'some-value',
        visibility: 'private',
        meta: { env: 'production' },
      }

      await handler(mockReq, mockSession, body)

      const createData = prisma.secret.create.mock.calls[0][0].data

      expect(createData.name).toBe('Named Secret')
      expect(createData.description).toBe('A test description')
      expect(createData.visibility).toBe('private')
      expect(createData.meta).toEqual({ env: 'production' })
    })

    it('should forward blueprintId when provided as an object', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-shared-5' })

      // Blueprint can be provided as an object with an id property
      const body = {
        kind: 'shared',
        type: 'bearer',
        value: 'token',
        blueprintId: { id: 'bp-1' },
      }

      await handler(mockReq, mockSession, body)

      const createData = prisma.secret.create.mock.calls[0][0].data

      expect(createData.blueprintId).toBe('bp-1')
    })

    it('should only select the id from the created record', async () => {
      prisma.secret.create.mockResolvedValue({ id: 'secret-shared-6' })

      const body = { kind: 'shared', type: 'bearer', value: 'token' }

      await handler(mockReq, mockSession, body)

      const selectArg = prisma.secret.create.mock.calls[0][0].select

      expect(selectArg).toEqual({ id: true })
    })
  })
})
