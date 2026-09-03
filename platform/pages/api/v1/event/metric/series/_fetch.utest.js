/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/metric', () => ({
  getEventMetricSeries: jest.fn(),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((value) => value),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((body) => ({ status: 200, body })),
}))

describe('GET /api/v1/event/metric/series/fetch', () => {
  const { requiredUrlParam } = require('@/lib/query.get')
  const { getEventMetricSeries } = require('@/lib/metric')
  const { makeJsonSafe } = require('@/lib/struct')

  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches metric series with required type and returns mapped values', async () => {
    getEventMetricSeries.mockResolvedValue([
      { date: 1732060800000, total: 10, ignored: 'x' },
      { date: 1732147200000, total: 20 },
    ])

    const req = { query: { type: 'message_count' } }
    const result = await handler(req, session)

    expect(requiredUrlParam).toHaveBeenCalledWith(req, 'type')
    expect(getEventMetricSeries).toHaveBeenCalledWith(
      session.user,
      'message_count'
    )
    expect(makeJsonSafe).toHaveBeenCalledWith({
      values: [
        { date: 1732060800000, total: 10 },
        { date: 1732147200000, total: 20 },
      ],
    })
    expect(result).toEqual({
      status: 200,
      body: {
        values: [
          { date: 1732060800000, total: 10 },
          { date: 1732147200000, total: 20 },
        ],
      },
    })
  })

  it('returns empty values when metrics are empty', async () => {
    getEventMetricSeries.mockResolvedValue([])

    const result = await handler({ query: { type: 'token_usage' } }, session)

    expect(result).toEqual({
      status: 200,
      body: { values: [] },
    })
  })

  it('propagates metric provider errors', async () => {
    getEventMetricSeries.mockRejectedValue(new Error('metric failed'))

    await expect(handler({ query: { type: 'x' } }, session)).rejects.toThrow(
      'metric failed'
    )
  })
})
