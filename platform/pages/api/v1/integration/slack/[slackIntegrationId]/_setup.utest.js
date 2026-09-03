import fetch from '@/lib/fetch'
import { logEvent } from '@/lib/log'

import { doSetup } from '@/pages/api/v1/integration/slack/[slackIntegrationId]/setup'

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

describe('Slack setup - doSetup', () => {
  const baseIntegration = {
    id: 'slack-int-123',
    userId: 'user-123',
    name: 'Test Slack Integration',
    signingSecret: 'valid-signing-secret',
    botToken: 'xoxb-valid-token',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // @note default mock: valid token
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        team: 'Test Team',
        user: 'test-bot',
        bot_id: 'B123',
      }),
    })
  })

  describe('credential validation', () => {
    it('throws conflict when signingSecret is null', async () => {
      const integration = { ...baseIntegration, signingSecret: null }

      await expect(doSetup(integration)).rejects.toThrow(/No signingSecret/)
    })

    it('throws conflict when signingSecret is empty', async () => {
      const integration = { ...baseIntegration, signingSecret: '' }

      await expect(doSetup(integration)).rejects.toThrow(/No signingSecret/)
    })

    it('throws conflict when botToken is null', async () => {
      const integration = { ...baseIntegration, botToken: null }

      await expect(doSetup(integration)).rejects.toThrow(/No botToken/)
    })

    it('throws conflict when botToken is empty', async () => {
      const integration = { ...baseIntegration, botToken: '' }

      await expect(doSetup(integration)).rejects.toThrow(/No botToken/)
    })
  })

  describe('Slack API token validation', () => {
    it('calls Slack auth.test endpoint with bot token', async () => {
      await doSetup(baseIntegration)

      expect(fetch).toHaveBeenCalledWith('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${baseIntegration.botToken}`,
          'Content-Type': 'application/json',
        },
      })
    })

    it('succeeds when Slack returns ok: true', async () => {
      await expect(doSetup(baseIntegration)).resolves.toBeUndefined()
    })

    it('throws conflict when Slack returns HTTP error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Failed to validate bot token: HTTP 500/
      )
    })

    it('throws conflict with user-friendly message for not_authed error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'not_authed' }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Bot token is missing, invalid, or the app has been uninstalled/
      )
    })

    it('throws conflict with user-friendly message for invalid_auth error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'invalid_auth' }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Bot token is invalid or has expired/
      )
    })

    it('throws conflict with user-friendly message for token_revoked error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'token_revoked' }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /bot token has been explicitly revoked/
      )
    })

    it('throws conflict with generic message for unknown Slack error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'unknown_error' }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Bot token validation failed: unknown_error/
      )
    })

    it('logs event when token validation fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'not_authed' }),
      })

      await expect(doSetup(baseIntegration)).rejects.toThrow()

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Slack Bot Token Invalid',
          type: 'integration.slack.auth.error',
          relations: {
            slackIntegrationId: baseIntegration.id,
          },
          meta: expect.objectContaining({
            error: 'not_authed',
          }),
        })
      )
    })

    it('does not log event when validation succeeds', async () => {
      await doSetup(baseIntegration)

      expect(logEvent).not.toHaveBeenCalled()
    })
  })

  describe('User token validation (optional)', () => {
    const integrationWithUserToken = {
      ...baseIntegration,
      userToken: 'xoxp-valid-user-token',
    }

    it('skips user token validation when userToken is not provided', async () => {
      await doSetup(baseIntegration)

      // @note only one call for bot token
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('validates user token when provided', async () => {
      await doSetup(integrationWithUserToken)

      // @note two calls: bot token + user token
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenLastCalledWith(
        'https://slack.com/api/auth.test',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${integrationWithUserToken.userToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('throws conflict when user token validation returns HTTP error', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, team: 'Test', user: 'bot' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      await expect(doSetup(integrationWithUserToken)).rejects.toThrow(
        /Failed to validate user token: HTTP 500/
      )
    })

    it('throws conflict with user-friendly message for not_authed error on user token', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, team: 'Test', user: 'bot' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: false, error: 'not_authed' }),
        })

      await expect(doSetup(integrationWithUserToken)).rejects.toThrow(
        /User token is missing, invalid, or the user has revoked access/
      )
    })

    it('logs event when user token validation fails', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, team: 'Test', user: 'bot' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: false, error: 'token_revoked' }),
        })

      await expect(doSetup(integrationWithUserToken)).rejects.toThrow()

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Slack User Token Invalid',
          type: 'integration.slack.auth.error',
          meta: expect.objectContaining({
            error: 'token_revoked',
            tokenType: 'user',
          }),
        })
      )
    })

    it('succeeds when both bot and user tokens are valid', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            team: 'Test',
            user: 'bot',
            bot_id: 'B1',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, team: 'Test', user: 'real-user' }),
        })

      await expect(doSetup(integrationWithUserToken)).resolves.toBeUndefined()

      expect(logEvent).not.toHaveBeenCalled()
    })
  })
})
