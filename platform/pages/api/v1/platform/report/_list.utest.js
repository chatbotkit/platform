/**
 * @jest-environment node
 */
import handler from './list'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor:
    (fn) =>
    async (req = {}) =>
      fn(req.query?.cursor || null),
}))

jest.mock('@/lib/report', () => ({
  registry: {
    reportA: {
      name: 'Report A',
      description: 'First report',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-02T00:00:00.000Z'),
    },
    reportB: {
      name: 'Report B',
      description: 'Second report',
      createdAt: new Date('2025-02-01T00:00:00.000Z'),
      updatedAt: new Date('2025-02-02T00:00:00.000Z'),
    },
  },
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/platform/report/list', () => {
  it('returns empty items when cursor is provided', async () => {
    const response = await handler({ query: { cursor: 'next' } })

    expect(response).toEqual({ items: [] })
  })

  it('returns mapped report registry items when cursor is not provided', async () => {
    const response = await handler({ query: {} })

    expect(response.items).toEqual(
      expect.arrayContaining([
        {
          id: 'reportA',
          name: 'Report A',
          description: 'First report',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-02T00:00:00.000Z'),
        },
        {
          id: 'reportB',
          name: 'Report B',
          description: 'Second report',
          createdAt: new Date('2025-02-01T00:00:00.000Z'),
          updatedAt: new Date('2025-02-02T00:00:00.000Z'),
        },
      ])
    )
  })
})
