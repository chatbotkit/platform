/**
 * @jest-environment node
 */
import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import handler from './create'

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session, body) => fn(req, session, body),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'generated-session-id'),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
}))

jest.mock('@/lib/session.temp', () => ({
  getTemporaryAPISessionToken: jest.fn(async () => 'temporary-session-token'),
}))

describe('POST /api/v1/user/[userId]/session/create', () => {
  const { getTemporaryAPISessionToken } = jest.requireMock('@/lib/session.temp')
  const session = {
    id: 'session_1',
    user: { id: 'child-user-1' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('mints a child-scoped session token with the provided config', async () => {
    const before = Date.now()

    const body = {
      durationInSeconds: 1200,
      config: {
        allowedRoutes: ['/api/v1/bot/**', '!/api/v1/admin/**'],
        contactId: 'contact_1',
        namespace: 'parent-app',
      },
    }

    const result = await handler({}, session, body)

    expect(getTemporaryAPISessionToken).toHaveBeenCalledWith(
      {
        ...session,
        id: 'generated-session-id',
      },
      {
        ...body.config,
        durationInSeconds: 1200,
      }
    )
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      id: 'generated-session-id',
      token: 'temporary-session-token',
      expiresAt: expect.any(Number),
    })
    expect(result.body.expiresAt).toBeGreaterThanOrEqual(before + 1200 * 1000)
  })

  it('uses the default temporary session duration when config is omitted', async () => {
    const before = Date.now()

    const result = await handler({}, session, {})

    expect(getTemporaryAPISessionToken).toHaveBeenCalledWith(
      {
        ...session,
        id: 'generated-session-id',
      },
      undefined
    )
    expect(result.body.expiresAt).toBeGreaterThanOrEqual(
      before + QUARTER_HOUR_IN_SECONDS * 1000
    )
  })

  it('propagates minting errors', async () => {
    getTemporaryAPISessionToken.mockRejectedValueOnce(new Error('mint failed'))

    await expect(handler({}, session, {})).rejects.toThrow('mint failed')
  })
})
