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
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/integration/support/list', () => {
  const mockSession = { user: { id: 'user-1' } }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  it('lists support integrations for authenticated user', async () => {
    const items = [
      {
        id: 'sup-1',
        name: 'Support',
        description: 'Main support',
        blueprintId: 'bp-1',
        botId: 'bot-1',
        email: 'support@example.com',
        meta: {},
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
    ]

    prisma.supportIntegration.findMany.mockResolvedValue(items)

    const result = await handler(null, {}, null, mockSession)

    expect(result.items).toEqual(items)
    expect(prisma.supportIntegration.findMany).toHaveBeenCalledWith({
      where: { AND: [{ userId: 'user-1' }] },
      select: {
        id: true,
        alias: true,
        name: true,
        description: true,
        blueprintId: true,
        botId: true,
        email: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  })

  it('applies blueprint and meta filters', async () => {
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp-filter' }])
    getMetaQueryFilter.mockReturnValue([{ 'meta.env': 'prod' }])
    prisma.supportIntegration.findMany.mockResolvedValue([])

    await handler(null, {}, null, mockSession)

    expect(prisma.supportIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user-1' },
            { 'meta.env': 'prod' },
            { blueprintId: 'bp-filter' },
          ],
        },
      })
    )
  })

  it('applies pagination constraints', async () => {
    getCursorConstraints.mockReturnValue({ cursor: { id: 'sup-9' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.supportIntegration.findMany.mockResolvedValue([])

    await handler('sup-9', { query: { take: '10' } }, null, mockSession)

    expect(prisma.supportIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'sup-9' },
        skip: 1,
        take: 10,
      })
    )
  })
})
