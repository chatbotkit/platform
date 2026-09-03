/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'

import handler, {
  doSetup,
} from '@/pages/api/v1/integration/instagram/[instagramIntegrationId]/setup'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  withDebug: (fetch) => fetch,
  withInit: (fetch) => fetch,
  withCache: (fetch) => fetch,
  withNextCache: (fetch) => fetch,
  withTimeout: (fetch) => fetch,
  withBodyTimeout: (fetch) => fetch,
  withRetry: (fetch) => fetch,
  withLimit: (fetch) => fetch,
}))

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
  withGet: (fn) => fn,
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/debug', () => {
  const logger = { log: jest.fn() }
  const debug = jest.fn(() => logger)

  return {
    __esModule: true,
    default: debug,
  }
})

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  SystemError: class SystemError extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  },
}))

jest.mock('@/lib/response', () => {
  const actual = jest.requireActual('@/lib/response')

  return {
    ...actual,
    respondFromError: jest.fn(() => ({ status: 500, json: async () => ({}) })),
  }
})

describe('doSetup', () => {
  const baseIntegration = {
    id: 'instagram-123',
    userId: 'user-123',
    accessToken: 'EAAxxxvalidtoken',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Default: Meta Graph API call succeeds
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success' }),
    })
  })

  describe('credential validation', () => {
    it('throws conflict when accessToken is null', async () => {
      const integration = { ...baseIntegration, accessToken: null }

      await expect(doSetup(integration)).rejects.toThrow(/No access token/)
    })

    it('throws conflict when accessToken is empty string', async () => {
      const integration = { ...baseIntegration, accessToken: '' }

      await expect(doSetup(integration)).rejects.toThrow(/No access token/)
    })

    it('throws conflict when accessToken is undefined', async () => {
      const integration = { ...baseIntegration, accessToken: undefined }

      await expect(doSetup(integration)).rejects.toThrow(/No access token/)
    })
  })

  describe('ice breaker setup', () => {
    it('calls Meta Graph API to configure ice breakers', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/messenger_profile'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('includes platform instagram in the request body', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining('"platform":"instagram"'),
        })
      )
    })

    it('includes ice_breakers array in the request body', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining('ice_breakers'),
        })
      )
    })

    it('sends access token as query parameter', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`access_token=${baseIntegration.accessToken}`),
        expect.anything()
      )
    })

    it('uses the v21.0 Meta Graph API version', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('v21.0'),
        expect.anything()
      )
    })

    it('makes exactly one API call', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('resolves without a return value on success', async () => {
      const result = await doSetup(baseIntegration)

      expect(result).toBeUndefined()
    })
  })

  describe('API error handling', () => {
    it('throws conflict with API error message when response is not ok', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Invalid OAuth access token - Cannot parse access token',
          },
        }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Invalid OAuth access token/
      )
    })

    it('throws generic conflict message when API response has no error message', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Failed to setup ice breakers/
      )
    })

    it('throws generic conflict message when API response error has no message field', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: {} }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Failed to setup ice breakers/
      )
    })
  })

  describe('ice breaker content', () => {
    it('includes HUMAN_AGENT action payload', async () => {
      await doSetup(baseIntegration)

      const [, options] = fetch.mock.calls[0]

      expect(options.body).toContain('HUMAN_AGENT')
    })

    it('includes GET_STARTED action payload', async () => {
      await doSetup(baseIntegration)

      const [, options] = fetch.mock.calls[0]

      expect(options.body).toContain('GET_STARTED')
    })
  })
})

describe('POST /api/v1/integration/instagram/[instagramIntegrationId]/setup', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success' }),
    })
  })

  it('returns 404 when integration is not found', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const req = { query: { instagramIntegrationId: 'nonexistent' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(404)
  })

  it('returns 403 when user does not own the integration', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'instagram-123',
      userId: 'other-user',
      accessToken: 'EAAxxxtoken',
    })

    const req = { query: { instagramIntegrationId: 'instagram-123' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(403)
  })

  it('returns 200 with integration id on success', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'instagram-123',
      userId: 'user-123',
      accessToken: 'EAAxxxtoken',
    })

    const req = { query: { instagramIntegrationId: 'instagram-123' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ id: 'instagram-123' })
  })

  it('captures error and calls respondFromError when doSetup throws', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'instagram-123',
      userId: 'user-123',
      accessToken: null, // will trigger conflict in doSetup
    })

    const req = { query: { instagramIntegrationId: 'instagram-123' } }

    await handler(req, mockSession)

    const { captureError } = jest.requireMock('@/lib/error')
    const { respondFromError } = jest.requireMock('@/lib/response')

    expect(captureError).toHaveBeenCalled()
    expect(respondFromError).toHaveBeenCalled()
  })
})
