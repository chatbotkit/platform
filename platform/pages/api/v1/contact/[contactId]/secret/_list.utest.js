/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: (req, param) => req.query[param],
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: () => {
    throw new Error('Not found')
  },
  throwNotAuthorized: () => {
    throw new Error('Not authorized')
  },
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('/api/v1/contact/{contactId}/secret/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  it('should list and map contact secrets', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue({
      id: 'contact_1',
      userId: 'user_123',
    })
    prisma.secretValue.findMany.mockResolvedValue([
      {
        name: '',
        description: '',
        secret: {
          id: 'sec_1',
          name: 'Slack Token',
          description: 'token',
          type: 'bearer',
        },
        meta: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        name: 'Override Name',
        description: 'Override Description',
        secret: {
          id: 'sec_2',
          name: 'Original Name',
          description: 'Original Description',
          type: 'oauth',
        },
        meta: { source: 'manual' },
        createdAt: new Date('2026-01-02'),
        updatedAt: new Date('2026-01-02'),
      },
      {
        name: 'No Secret',
        description: '',
        secret: null,
        meta: null,
        createdAt: new Date('2026-01-03'),
        updatedAt: new Date('2026-01-03'),
      },
    ])

    const result = await handler(
      null,
      { query: { contactId: 'contact_1' } },
      null,
      mockSession
    )

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sec_1',
          name: 'Slack Token',
          description: 'token',
          type: 'bearer',
        }),
        expect.objectContaining({
          id: 'sec_2',
          name: 'Override Name',
          description: 'Override Description',
          type: 'oauth',
        }),
      ])
    )
    expect(result.items).toHaveLength(2)
  })

  it('should throw not found when contact does not exist', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(
      handler(null, { query: { contactId: 'missing' } }, null, mockSession)
    ).rejects.toThrow('Not found')
  })

  it('should throw not authorized when contact belongs to another user', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue({
      id: 'contact_1',
      userId: 'other_user',
    })

    await expect(
      handler(null, { query: { contactId: 'contact_1' } }, null, mockSession)
    ).rejects.toThrow('Not authorized')
    expect(prisma.secretValue.findMany).not.toHaveBeenCalled()
  })
})
