/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler from './index'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn(() => ({ status: 200, body: {} })),
}))

describe('GET /api/v1', () => {
  const { ok } = require('@/lib/response')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns ok response', async () => {
    const result = await handler({})

    expect(ok).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ status: 200, body: {} })
  })
})
