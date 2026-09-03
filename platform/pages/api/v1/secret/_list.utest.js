/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (req, _stream, session) =>
    fn(null, req, _stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('/api/v1/secret/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)

    const {
      getCursorConstraints,
      getTakeConstraints,
      getMetaQueryFilter,
      getBlueprintIdQueryFilter,
    } = require('@/lib/filter')

    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
  })

  describe('basic functionality', () => {
    it('should return a list of secrets for the authenticated user', async () => {
      const mockSecrets = [
        {
          id: 'secret_1',
          name: 'OpenAI API Key',
          description: '',
          blueprintId: null,
          kind: 'shared',
          type: 'bearer',
          config: {},
          visibility: 'private',
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'secret_2',
          name: 'Payment Provider Key',
          description: '',
          blueprintId: 'blueprint_abc',
          kind: 'shared',
          type: 'bearer',
          config: {},
          visibility: 'private',
          meta: {},
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.secret.findMany.mockResolvedValue(mockSecrets)

      const req = { query: {} }
      const result = await handler(req, null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('secret_1')
      expect(result.items[1].id).toBe('secret_2')
    })

    it('should return an empty list when the user has no secrets', async () => {
      prisma.secret.findMany.mockResolvedValue([])

      const req = { query: {} }
      const result = await handler(req, null, mockSession)

      expect(result.items).toHaveLength(0)
    })
  })

  describe('security - user isolation', () => {
    it('should always scope the query to the session user id', async () => {
      // @note this is the critical security check - secrets must ONLY be
      // returned for the authenticated user, never for other users
      prisma.secret.findMany.mockResolvedValue([])

      const req = { query: {} }

      await handler(req, null, mockSession)

      const findManyCall = prisma.secret.findMany.mock.calls[0][0]

      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([{ userId: 'user_123' }])
      )
    })

    it('should scope results to the correct user when multiple users exist', async () => {
      const sessionForUserB = { user: { id: 'user_456' } }

      prisma.secret.findMany.mockResolvedValue([])

      const req = { query: {} }

      await handler(req, null, sessionForUserB)

      const findManyCall = prisma.secret.findMany.mock.calls[0][0]

      // Must use user_456's id, not user_123's id
      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([{ userId: 'user_456' }])
      )
      expect(findManyCall.where.AND).not.toEqual(
        expect.arrayContaining([{ userId: 'user_123' }])
      )
    })
  })

  describe('blueprint filtering', () => {
    it('should apply blueprint filter when provided', async () => {
      const { getBlueprintIdQueryFilter } = require('@/lib/filter')

      getBlueprintIdQueryFilter.mockReturnValue([
        { blueprintId: 'blueprint_abc' },
      ])

      prisma.secret.findMany.mockResolvedValue([])

      const req = { query: { blueprintId: 'blueprint_abc' } }

      await handler(req, null, mockSession)

      expect(getBlueprintIdQueryFilter).toHaveBeenCalledWith(req)

      const findManyCall = prisma.secret.findMany.mock.calls[0][0]

      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([{ blueprintId: 'blueprint_abc' }])
      )
    })
  })

  describe('response shape', () => {
    it('should include secret metadata fields and return config with its non-credential keys as-is', async () => {
      // @note config is included in the response; the credential key inside
      // it (clientSecret) is masked - see the test below
      const secret = {
        id: 'secret_1',
        alias: 'my-api-key',
        name: 'My API Key',
        description: 'Used for production access',
        blueprintId: null,
        kind: 'shared',
        type: 'bearer',
        config: { scope: 'read' },
        visibility: 'private',
        meta: { tags: ['production'] },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.secret.findMany.mockResolvedValue([secret])

      const req = { query: {} }
      const result = await handler(req, null, mockSession)

      expect(result.items[0]).toMatchObject({
        id: 'secret_1',
        alias: 'my-api-key',
        name: 'My API Key',
        description: 'Used for production access',
        kind: 'shared',
        type: 'bearer',
        visibility: 'private',
      })
    })

    it('should mask config.clientSecret in every item', async () => {
      prisma.secret.findMany.mockResolvedValue([
        {
          id: 'secret_1',
          config: { clientId: 'id', clientSecret: 'super-secret' },
        },
        {
          id: 'secret_2',
          config: { clientId: 'id', clientSecret: null },
        },
        {
          id: 'secret_3',
          config: null,
        },
      ])

      const result = await handler({ query: {} }, null, mockSession)

      expect(result.items.map((item) => item.config)).toEqual([
        { clientId: 'id', clientSecret: '********' },
        { clientId: 'id', clientSecret: null },
        null,
      ])
    })

    it('should select exactly the documented fields', async () => {
      prisma.secret.findMany.mockResolvedValue([])

      const req = { query: {} }

      await handler(req, null, mockSession)

      const findManyCall = prisma.secret.findMany.mock.calls[0][0]

      expect(findManyCall.select).toMatchObject({
        id: true,
        alias: true,
        name: true,
        description: true,
        blueprintId: true,
        kind: true,
        type: true,
        config: true,
        visibility: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      })
    })
  })
})
