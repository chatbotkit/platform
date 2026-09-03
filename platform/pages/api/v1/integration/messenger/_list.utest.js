/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { makeJsonSafe } from '@/lib/struct'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      messengerIntegration: {
        findMany: jest.fn(),
      },
    },
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

describe('GET /api/v1/integration/messenger/list', () => {
  const session = { user: { id: 'user_123' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((data) => data)
  })

  it('returns items from prisma for the current user', async () => {
    prisma.messengerIntegration.findMany.mockResolvedValue([
      { id: 'messenger_1', name: 'Messenger One', accessToken: null },
    ])

    const result = await handler(null, { query: {} }, null, session)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('messenger_1')
    expect(prisma.messengerIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user_123' }],
        },
      })
    )
  })

  it('applies meta, blueprint, cursor, and take filters', async () => {
    getMetaQueryFilter.mockReturnValue([{ meta: { env: 'prod' } }])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_42' }])
    getCursorConstraints.mockReturnValue({
      cursor: { id: 'messenger_5' },
      skip: 1,
    })
    getTakeConstraints.mockReturnValue({ take: 10 })
    prisma.messengerIntegration.findMany.mockResolvedValue([])

    await handler(
      'messenger_5',
      { query: { meta: 'x', blueprintId: 'bp_42' } },
      null,
      session
    )

    expect(prisma.messengerIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_123' },
            { meta: { env: 'prod' } },
            { blueprintId: 'bp_42' },
          ],
        },
        cursor: { id: 'messenger_5' },
        skip: 1,
        take: 10,
      })
    )
  })

  it('selects accessToken and appSecret so they can be reported as configured', async () => {
    prisma.messengerIntegration.findMany.mockResolvedValue([])

    await handler(null, { query: {} }, null, session)

    const call = prisma.messengerIntegration.findMany.mock.calls[0][0]

    expect(call.select).toEqual(
      expect.objectContaining({
        verifyToken: true,
        accessToken: true,
        appSecret: true,
      })
    )
    expect(call.select.userId).toBeUndefined()
  })

  it('masks accessToken and appSecret when configured', async () => {
    prisma.messengerIntegration.findMany.mockResolvedValue([
      {
        id: 'messenger_1',
        accessToken: 'real-access-token',
        appSecret: 'real-app-secret',
      },
    ])

    const result = await handler(null, { query: {} }, null, session)

    expect(result.items[0].accessToken).toBe('********')
    expect(result.items[0].appSecret).toBe('********')
  })

  it('returns null accessToken and appSecret when not configured', async () => {
    prisma.messengerIntegration.findMany.mockResolvedValue([
      { id: 'messenger_1', accessToken: null, appSecret: null },
    ])

    const result = await handler(null, { query: {} }, null, session)

    expect(result.items[0].accessToken).toBeNull()
    expect(result.items[0].appSecret).toBeNull()
  })

  it('propagates prisma errors', async () => {
    prisma.messengerIntegration.findMany.mockRejectedValue(new Error('db failed'))

    await expect(handler(null, { query: {} }, null, session)).rejects.toThrow(
      'db failed'
    )
  })
})
