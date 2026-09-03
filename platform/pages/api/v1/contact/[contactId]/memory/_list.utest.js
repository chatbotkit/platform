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

const {
  getMetaQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/contact/{contactId}/memory/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  it('should list memories for a contact owned by the authenticated user', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue({
      id: 'contact_1',
      userId: 'user_123',
    })
    prisma.memory.findMany.mockResolvedValue([
      {
        id: 'mem_1',
        name: 'Memory 1',
        description: 'desc',
        botId: 'bot_1',
        text: 'hello',
        meta: { source: 'test' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ])

    const result = await handler(
      null,
      { query: { contactId: 'contact_1' } },
      null,
      mockSession
    )

    expect(result.items).toHaveLength(1)
    expect(prisma.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ contactId: 'contact_1' }],
        },
      })
    )
  })

  it('should throw not found when contact does not exist', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(
      handler(null, { query: { contactId: 'missing' } }, null, mockSession)
    ).rejects.toThrow('Not found')
    expect(prisma.memory.findMany).not.toHaveBeenCalled()
  })

  it('should throw not authorized when contact belongs to another user', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue({
      id: 'contact_1',
      userId: 'other_user',
    })

    await expect(
      handler(null, { query: { contactId: 'contact_1' } }, null, mockSession)
    ).rejects.toThrow('Not authorized')
    expect(prisma.memory.findMany).not.toHaveBeenCalled()
  })

  it('should apply pagination constraints when provided', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 'mem_1' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 25 })
    prisma.contact.findUniqueByIdentifier.mockResolvedValue({
      id: 'contact_1',
      userId: 'user_123',
    })
    prisma.memory.findMany.mockResolvedValue([])

    await handler(
      'mem_1',
      { query: { contactId: 'contact_1', take: '25' } },
      null,
      mockSession
    )

    expect(getCursorConstraints).toHaveBeenCalled()
    expect(getTakeConstraints).toHaveBeenCalled()
    expect(prisma.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'mem_1' },
        skip: 1,
        take: 25,
      })
    )
  })
})
