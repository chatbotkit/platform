/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { captureException } from '@/lib/error'
import { validateSlackRequest } from '@/lib/slack.signature'

import handler from '@/pages/api/v1/integration/slack/[slackIntegrationId]/command'
import { sendEvent } from '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  slackIntegration: {
    findUnique: jest.fn(),
  },
}))

jest.mock('@/lib/slack.signature', () => ({
  validateSlackRequest: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureException: jest.fn(),
}))

describe('Slack command API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    validateSlackRequest.mockResolvedValue(true)
  })

  function makeRequest(body, { slackIntegrationId = 'int-123' } = {}) {
    const url = `https://example.com/api/v1/integration/slack/${slackIntegrationId}/command?slackIntegrationId=${slackIntegrationId}`

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-slack-request-timestamp': '1640995200',
        'x-slack-signature': 'v0=valid-signature',
      },
      body: body ?? '',
    })
  }

  describe('integration lookup', () => {
    it('returns 404 when integration is not found', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue(null)

      const res = await handler(makeRequest(''))

      expect(res.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('signature validation', () => {
    it('validates signature when signingSecret is set', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        signingSecret: 'test-secret',
      })

      const body =
        'command=%2Fask&text=hello&user_id=U1&channel_id=C1&team_id=T1&trigger_id=trigger1&response_url=https%3A%2F%2Fexample.com'
      const res = await handler(makeRequest(body))

      expect(validateSlackRequest).toHaveBeenCalled()
      expect(res.status).toBe(200)
    })

    it('returns 403 and triggers setup when signature validation fails', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        signingSecret: 'test-secret',
      })

      validateSlackRequest.mockRejectedValue(new Error('Invalid signature'))

      const res = await handler(makeRequest('any=body'))

      expect(captureException).toHaveBeenCalled()
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'setup',
        payload: {},
      })
      expect(res.status).toBe(403)
    })

    it('bypasses signature validation when signingSecret is absent', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        signingSecret: null,
      })

      const body =
        'command=%2Fask&text=hello&user_id=U1&channel_id=C1&team_id=T1&trigger_id=trigger1&response_url=https%3A%2F%2Fexample.com'
      const res = await handler(makeRequest(body))

      expect(validateSlackRequest).not.toHaveBeenCalled()
      expect(res.status).toBe(200)
    })
  })

  describe('command payload forwarding', () => {
    it('queues an interact event with extracted command fields', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        signingSecret: 'test-secret',
      })

      const body = [
        'command=%2Fask',
        'text=how+do+I+reset+my+password',
        'user_id=U1',
        'channel_id=C1',
        'team_id=T1',
        'trigger_id=trigger1',
        'response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2Fcallback',
      ].join('&')

      const res = await handler(makeRequest(body))

      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: {
          type: 'command',
          team: 'T1',
          user: 'U1',
          channelId: 'C1',
          channelType: 'command',
          messageId: 'trigger1',
          ts: 'trigger1',
          text: '/ask how do I reset my password',
          responseUrl: 'https://hooks.slack.com/commands/callback',
        },
      })
      expect(res.status).toBe(200)
    })

    it('returns empty string body in success response', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        signingSecret: null,
      })

      const body =
        'user_id=U1&channel_id=C1&team_id=T1&trigger_id=t1&response_url=https%3A%2F%2Fexample.com&text=ping'
      const res = await handler(makeRequest(body))

      expect(res.status).toBe(200)
      expect(await res.text()).toBe('')
    })
  })

  describe('error recovery', () => {
    it('captures exception and triggers setup on invalid body encoding', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        signingSecret: null,
      })

      // @note URLSearchParams never throws, but we can simulate by patching it
      const OriginalURLSearchParams = global.URLSearchParams

      global.URLSearchParams = jest.fn().mockImplementationOnce(() => {
        throw new Error('parse error')
      })

      const res = await handler(makeRequest('bad-body'))

      global.URLSearchParams = OriginalURLSearchParams

      expect(captureException).toHaveBeenCalled()
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'setup',
        payload: {},
      })
      expect(res.status).toBe(403)
    })
  })
})
