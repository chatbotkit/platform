/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'

import handler, {
  doSetup,
} from '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/setup'

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
  withFormDataPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  SystemError: class SystemError extends Error {},
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
    id: 'messenger-123',
    userId: 'user-123',
    accessToken: 'EAAxxxvalidtoken',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // @note default: both API calls succeed
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
  })

  describe('get started button setup', () => {
    it('calls Facebook API to set up get started button', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/messenger_profile'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('GET_STARTED'),
        })
      )
    })

    it('includes access token in URL', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `access_token=${encodeURIComponent(baseIntegration.accessToken)}`
        ),
        expect.anything()
      )
    })

    it('throws conflict when get started button setup fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Invalid OAuth access token' },
        }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Invalid OAuth access token/
      )
    })

    it('throws generic conflict when API returns no error message', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Facebook API error/
      )
    })
  })

  describe('persistent menu setup', () => {
    it('calls Facebook API to set up persistent menu', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/messenger_profile'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('persistent_menu'),
        })
      )
    })

    it('includes HUMAN_AGENT action in persistent menu', async () => {
      await doSetup(baseIntegration)

      const secondCall = fetch.mock.calls[1]

      expect(secondCall[1].body).toContain('HUMAN_AGENT')
    })

    it('throws conflict when persistent menu setup fails', async () => {
      // first call succeeds, second fails
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            error: { message: 'Persistent menu update failed' },
          }),
        })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Persistent menu update failed/
      )
    })
  })

  describe('successful setup', () => {
    it('makes exactly two API calls (get started + persistent menu)', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('resolves without returning a value on success', async () => {
      const result = await doSetup(baseIntegration)

      expect(result).toBeUndefined()
    })
  })
})

describe('POST /api/v1/integration/messenger/[messengerIntegrationId]/setup', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should setup messenger integration successfully', async () => {
      const mockMessengerIntegration = {
        id: 'messenger-123',
        userId: 'user-123',
        accessToken: 'EAAxxxtoken',
      }

      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMessengerIntegration
      )

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'success' }),
      })

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: 'messenger-123' })
    })
  })

  describe('error handling', () => {
    it('should return 404 when messenger integration not found', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { messengerIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the integration', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'messenger-123',
        userId: 'other-user',
        accessToken: 'EAAxxxtoken',
      })

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should respond with error when doSetup throws', async () => {
      prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'messenger-123',
        userId: 'user-123',
        accessToken: null, // will trigger conflict
      })

      const req = {
        query: { messengerIntegrationId: 'messenger-123' },
      }

      await handler(req, mockSession)

      const { captureError } = jest.requireMock('@/lib/error')
      const { respondFromError } = jest.requireMock('@/lib/response')

      expect(captureError).toHaveBeenCalled()
      expect(respondFromError).toHaveBeenCalled()
    })
  })
})
