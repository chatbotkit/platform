/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { doSetup } from './setup'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/fetch', () => {
  const mockFetch = jest.fn()

  return {
    __esModule: true,
    default: mockFetch,
    getFetchError: jest.fn(async (res) => {
      const text = await res.text()

      return new Error(text || 'Fetch error')
    }),
  }
})

jest.mock('@/lib/telegram.webhook', () => ({
  getTelegramIntegrationWebhook: jest.fn(
    (id) =>
      `https://api.chatbotkit.com/api/v1/integration/telegram/${id}/webhook`
  ),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404, body: { error: 'Not found' } }),
  notAuthorized: () => ({ status: 403, body: { error: 'Not authorized' } }),
  conflict: (message) => ({ status: 409, body: { error: message } }),
  respondFromError: (err) => ({
    status: err.statusCode || 500,
    body: { error: err.message },
  }),
  throwConflict: (message) => {
    const error = new Error(message)

    error.statusCode = 409

    throw error
  },
}))

const fetch = require('@/lib/fetch').default

describe('POST /api/v1/integration/telegram/[telegramIntegrationId]/setup', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  const mockRequest = (telegramIntegrationId = 'telegram123') => ({
    query: { telegramIntegrationId },
  })

  const mockSession = {
    user: {
      id: 'user123',
      email: 'test@example.com',
    },
  }

  describe('successful setup', () => {
    it('should setup telegram integration successfully', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-12345',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      // Mock setWebhook response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, description: 'Webhook was set' }),
      })

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ id: 'telegram123' })
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('always re-registers, even when the url is already set', async () => {
      // @note there is deliberately no getWebhookInfo short-circuit: Telegram
      // never reports the secret token back, so a webhook registered before
      // the secret existed would otherwise keep its unauthenticated
      // registration forever. Re-registering the same url stamps it on.
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-12345',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(200)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch.mock.calls[0][0]).toContain('setWebhook')
    })
  })

  describe('error handling', () => {
    it('should return 404 if integration not found', async () => {
      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(mockRequest('nonexistent'), mockSession)

      expect(response.status).toBe(404)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should return 403 if user does not own integration', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'differentUser',
        botToken: 'bot-token',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(403)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should return 409 and NOT capture error when bot token is missing', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: null,
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const { captureError } = require('@/lib/error')

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(409)
      expect(response.body.error).toContain('bot token')
      expect(captureError).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should throw a conflict (NOT capture) when the bot token is invalid', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'invalid-token',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      // Mock setWebhook response - invalid token
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({ description: 'Bot token is invalid' }),
      })

      const { captureError } = require('@/lib/error')

      // @note the handler follows the GitHub pattern: it does not catch, so the
      // conflict propagates to the framework wrapper (which renders it as a 409
      // and keeps it out of Sentry via captureUnknownException). A bad bot token
      // is a user-config error, not a bug.
      await expect(handler(mockRequest(), mockSession)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(captureError).not.toHaveBeenCalled()
    })

    it('should throw a conflict (NOT capture) on setWebhook errors', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-12345',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      // Mock setWebhook response - error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ description: 'HTTPS url must be provided' }),
      })

      const { captureError } = require('@/lib/error')

      await expect(handler(mockRequest(), mockSession)).rejects.toMatchObject({
        statusCode: 409,
      })

      expect(captureError).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      prisma.telegramIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockRequest(), mockSession)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('doSetup function', () => {
    it('should call setWebhook with correct parameters', async () => {
      const mockIntegration = {
        id: 'telegram123',
        botToken: 'bot-token-12345',
      }

      // Mock setWebhook response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      await doSetup(mockIntegration)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('setWebhook'),
        expect.objectContaining({
          method: 'POST',
          signal: expect.any(AbortSignal),
        })
      )

      const setWebhookUrl = fetch.mock.calls[0][0]

      expect(setWebhookUrl).toContain('allowed_updates')
      expect(setWebhookUrl).toContain('message')
      expect(setWebhookUrl).toContain('business_message')
    })

    it('registers the secret token derived from the bot token', async () => {
      const mockIntegration = {
        id: 'telegram123',
        botToken: 'bot-token-12345',
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      await doSetup(mockIntegration)

      const { deriveTelegramSecretToken } = require('@/lib/telegram.signature')

      const url = new URL(fetch.mock.calls[0][0])

      // @note what setup registers must be exactly what the webhook handler
      // later derives, or every callback fails verification
      expect(url.searchParams.get('secret_token')).toBe(
        await deriveTelegramSecretToken('bot-token-12345')
      )
    })

    it('should throw error when setWebhook returns not ok', async () => {
      const mockIntegration = {
        id: 'telegram123',
        botToken: 'bot-token-12345',
      }

      // Mock setWebhook response - returns ok: false
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, description: 'Invalid webhook URL' }),
      })

      await expect(doSetup(mockIntegration)).rejects.toThrow(
        'Invalid webhook URL'
      )
    })
  })

  describe('authorization checks', () => {
    it('should verify user ownership before setup', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-12345',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            url: `https://api.chatbotkit.com/api/v1/integration/telegram/telegram123/webhook`,
          },
        }),
      })

      await handler(mockRequest(), mockSession)

      expect(
        prisma.telegramIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user123' }),
        'telegram123'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing telegramIntegrationId', async () => {
      const badRequest = { query: {} }

      await expect(handler(badRequest, mockSession)).rejects.toThrow()
    })

    it('should accept empty request body', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-12345',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            url: `https://api.chatbotkit.com/api/v1/integration/telegram/telegram123/webhook`,
          },
        }),
      })

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(200)
    })

    it('should propagate unexpected errors (e.g. a timeout) for the framework to capture', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
        botToken: 'bot-token-12345',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      fetch.mockRejectedValueOnce(new Error('Timeout'))

      // @note unlike a conflict, a bare Error has no known expected code, so the
      // framework wrapper will capture it to Sentry and respond 500. The handler
      // simply lets it propagate (GitHub pattern) rather than catching it.
      await expect(handler(mockRequest(), mockSession)).rejects.toThrow(
        'Timeout'
      )
    })
  })
})
