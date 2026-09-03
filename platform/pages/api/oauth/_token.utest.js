/**
 * @jest-environment node
 */
import { checkAuthRate } from '@/lib/auth.rate'
import oauthServer, { responseToResponse } from '@/lib/oauth.server'

import refreshHandler from './refresh'
import tokenHandler from './token'

const previousTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS

jest.mock('@/lib/oauth.server', () => ({
  __esModule: true,
  default: { token: jest.fn() },
  Request: jest.fn(function () {}),
  Response: jest.fn(function () {}),
  responseToResponse: jest.fn(),
  errorToResponse: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
  setTag: jest.fn(),
}))

jest.mock('@/lib/env', () => ({
  isDevelopment: false,
}))

jest.mock('@/lib/auth.rate', () => {
  const actual = jest.requireActual('@/lib/auth.rate')

  return { ...actual, checkAuthRate: jest.fn() }
})

function mockRes() {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    setHeader: jest.fn(() => res),
    end: jest.fn(() => res),
  }

  return res
}

describe.each([
  ['token', tokenHandler],
  ['refresh', refreshHandler],
])('OAuth %s handler abuse controls', (_name, handler) => {
  beforeAll(() => {
    process.env.TRUST_PROXY_HEADERS = 'true'
  })

  afterAll(() => {
    if (previousTrustProxyHeaders === undefined) {
      delete process.env.TRUST_PROXY_HEADERS
    } else {
      process.env.TRUST_PROXY_HEADERS = previousTrustProxyHeaders
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()

    checkAuthRate.mockResolvedValue(true)
    oauthServer.token.mockResolvedValue({})
  })

  it('charges the source address and the client id before exchanging', async () => {
    const res = mockRes()

    await handler(
      {
        method: 'POST',
        headers: {
          'x-real-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.9',
        },
        body: { grant_type: 'authorization_code', client_id: 'client-a' },
      },
      res
    )

    expect(checkAuthRate).toHaveBeenCalledWith('oauth-token', [
      expect.objectContaining({ identity: '203.0.113.7' }),
      expect.objectContaining({ identity: 'client-a' }),
    ])
    expect(oauthServer.token).toHaveBeenCalled()
    expect(responseToResponse).toHaveBeenCalled()
  })

  it('answers 429 slow_down without touching the token model when over limit', async () => {
    checkAuthRate.mockResolvedValue(false)

    const res = mockRes()

    await handler(
      { method: 'POST', headers: {}, body: { client_id: 'client-a' } },
      res
    )

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'slow_down' })
    )
    expect(oauthServer.token).not.toHaveBeenCalled()
  })
})
