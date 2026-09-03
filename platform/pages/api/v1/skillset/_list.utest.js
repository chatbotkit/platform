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

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

const {
  getMetaQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/skillset/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  it('should list skillsets for authenticated user', async () => {
    prisma.skillset.findMany.mockResolvedValue([
      {
        id: 's_1',
        alias: 'support',
        name: 'Support',
        description: 'Support flows',
        blueprintId: 'bp_1',
        visibility: 'private',
        meta: {},
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ])

    const result = await handler(null, { query: {} }, null, mockSession)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].alias).toBe('support')
    expect(prisma.skillset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user_123' }],
        },
      })
    )
  })

  it('should apply metadata and blueprint filters', async () => {
    getMetaQueryFilter.mockReturnValue([
      { meta: { path: ['scope'], equals: 'customer-support' } },
    ])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_1' }])
    prisma.skillset.findMany.mockResolvedValue([])

    await handler(
      null,
      { query: { blueprintId: 'bp_1', 'meta.scope': 'customer-support' } },
      null,
      mockSession
    )

    expect(getMetaQueryFilter).toHaveBeenCalled()
    expect(getBlueprintIdQueryFilter).toHaveBeenCalled()
    expect(prisma.skillset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_123' },
            { meta: { path: ['scope'], equals: 'customer-support' } },
            { blueprintId: 'bp_1' },
          ],
        },
      })
    )
  })

  it('should apply pagination constraints', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 's_1' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.skillset.findMany.mockResolvedValue([])

    await handler(
      's_1',
      { query: { take: '10', order: 'desc' } },
      null,
      mockSession
    )

    expect(getCursorConstraints).toHaveBeenCalled()
    expect(getTakeConstraints).toHaveBeenCalled()
    expect(prisma.skillset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 's_1' },
        skip: 1,
        take: 10,
      })
    )
  })

  it('should propagate database errors', async () => {
    prisma.skillset.findMany.mockRejectedValue(new Error('DB failure'))

    await expect(
      handler(null, { query: {} }, null, mockSession)
    ).rejects.toThrow('DB failure')
  })
})
