/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import { logEvent } from '@/lib/log'
import { deriveTelegramSecretToken } from '@/lib/telegram.signature'

import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'

import { sendEvent } from '@/pages/api/v1/integration/telegram/[telegramIntegrationId]/queue'
import handler from '@/pages/api/v1/integration/telegram/[telegramIntegrationId]/webhook'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/fetch', () => {
  const fetch = jest.fn()

  return {
    __esModule: true,
    default: fetch,
  }
})

jest.mock(
  '@/pages/api/v1/integration/telegram/[telegramIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

describe('Telegram webhook API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeRequest(payload, { telegramIntegrationId = 'int-123' } = {}) {
    const url = `https://example.com/api/v1/integration/telegram/${telegramIntegrationId}/webhook?telegramIntegrationId=${telegramIntegrationId}`

    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    })
  }

  it('returns 404 when integration not found', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue(null)

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(404)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK when message is not present', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      // @note no message or business_message
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK and ignores bot messages', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 999,
          is_bot: true,
          first_name: 'BotUser',
        },
        chat: {
          id: 100,
          type: 'private',
        },
        text: 'Hello from a bot',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK for private chat messages and sends interact event', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: 100,
          type: 'private',
        },
        text: 'Hello there',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message,
      },
    })
  })

  it('returns 200 OK and ignores group messages without entities', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'group',
        },
        text: 'Hello group',
        // @note no entities = no mention
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK and ignores group messages with entities but no bot mention', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    // @note mock Telegram API response for getMe
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          id: 777,
          username: 'mybot',
        },
      }),
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'group',
        },
        text: '@otheruser hello',
        entities: [
          {
            type: 'mention',
            offset: 0,
            length: 10,
          },
        ],
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/getMe',
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK and sends interact event when bot is mentioned via @username', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          id: 777,
          username: 'mybot',
        },
      }),
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'group',
        },
        text: '@mybot hello',
        entities: [
          {
            type: 'mention',
            offset: 0,
            length: 6,
          },
        ],
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message,
      },
    })
  })

  it('returns 200 OK and sends interact event when bot is mentioned via text_mention entity', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          id: 777,
          username: 'mybot',
        },
      }),
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'supergroup',
        },
        text: 'MyBot hello',
        entities: [
          {
            type: 'text_mention',
            offset: 0,
            length: 5,
            user: {
              id: 777, // @note matches the bot id from getMe
            },
          },
        ],
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message,
      },
    })
  })

  it('returns 200 OK and sends interact event for private command messages', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: 100,
          type: 'private',
        },
        text: '/start',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message,
      },
    })
  })

  it('handles business_message same as regular message', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      business_message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: 100,
          type: 'private',
        },
        text: 'Hello from business chat',
        business_connection_id: 'biz-123',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.business_message,
      },
    })
  })

  it('handles edited_message same as regular message', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      edited_message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: 100,
          type: 'private',
        },
        text: 'Updated message content',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.edited_message,
      },
    })
  })

  it('handles edited_business_message same as regular message', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      edited_business_message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: 100,
          type: 'private',
        },
        text: 'Updated business content',
        business_connection_id: 'biz-123',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.edited_business_message,
      },
    })
  })

  it('handles malformed JSON gracefully', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const req = makeRequest('not-valid-json')
    const res = await handler(req)

    // @note malformed JSON results in no message being parsed, so returns 200
    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('throws error when getMe API call fails', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: false,
      status: 401,
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'group',
        },
        text: '@mybot hello',
        entities: [
          {
            type: 'mention',
            offset: 0,
            length: 6,
          },
        ],
      },
    }

    const req = makeRequest(payload)

    await expect(handler(req)).rejects.toThrow(
      'Failed to retrieve bot information'
    )
  })

  it('handles command messages in group chats when command targets the bot', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          id: 777,
          username: 'mybot',
        },
      }),
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'group',
        },
        text: '/start@mybot',
        entities: [
          {
            type: 'bot_command',
            offset: 0,
            length: 13,
          },
        ],
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message,
      },
    })
  })

  it('handles callback_query interactions and acknowledges callback', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const payload = {
      update_id: 98765,
      callback_query: {
        id: 'cbq-123',
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
          username: 'john',
        },
        data: 'intent:subscribe',
        message: {
          message_id: 77,
          chat: {
            id: 100,
            type: 'private',
          },
          text: 'Please choose',
        },
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 98765,
        message: {
          message_id: 77,
          chat: {
            id: 100,
            type: 'private',
          },
          text: 'intent:subscribe',
          from: {
            id: 123,
            is_bot: false,
            first_name: 'John',
            username: 'john',
          },
        },
      },
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/answerCallbackQuery',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('handles channel type chat and ignores messages without bot mention', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'channel',
        },
        text: 'Channel message without mention',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('handles supergroup type chat same as group', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          id: 777,
          username: 'mybot',
        },
      }),
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'supergroup',
        },
        text: '@mybot hello from supergroup',
        entities: [
          {
            type: 'mention',
            offset: 0,
            length: 6,
          },
        ],
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message,
      },
    })
  })

  it('uses message over business_message when both are present', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: 100,
          type: 'private',
        },
        text: 'Regular message',
      },
      business_message: {
        message_id: 2,
        from: {
          id: 456,
          is_bot: false,
          first_name: 'Jane',
        },
        chat: {
          id: 200,
          type: 'private',
        },
        text: 'Business message',
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message, // @note uses message, not business_message
      },
    })
  })

  it('handles messages with multiple entity types and finds bot mention', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          id: 777,
          username: 'mybot',
        },
      }),
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'group',
        },
        text: 'Check this https://example.com @mybot',
        entities: [
          {
            type: 'url',
            offset: 11,
            length: 19,
          },
          {
            type: 'mention',
            offset: 31,
            length: 6,
          },
        ],
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        update_id: 12345,
        message: payload.message,
      },
    })
  })

  it('handles messages with only non-mention entity types in group', async () => {
    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      botToken: 'test-bot-token',
    })

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          id: 777,
          username: 'mybot',
        },
      }),
    })

    const payload = {
      update_id: 12345,
      message: {
        message_id: 1,
        from: {
          id: 123,
          is_bot: false,
          first_name: 'John',
        },
        chat: {
          id: -100,
          type: 'group',
        },
        text: 'Check this https://example.com',
        entities: [
          {
            type: 'url',
            offset: 11,
            length: 19,
          },
        ],
      },
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  describe('secret token verification', () => {
    // @note the header Telegram echoes is the token setup registered, which the
    // handler re-derives from the bot token - so the test derives it the same
    // way and sends it, or sends something else
    const botToken = '123456:bot-token'

    function requestWithSecret(secret) {
      return new Request(
        'https://example.com/api/v1/integration/telegram/int-123/webhook?telegramIntegrationId=int-123',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}),
          },
          // no message: the handler answers 200 early once the gate opens
          body: JSON.stringify({ update_id: 1 }),
        }
      )
    }

    it('accepts an update carrying the registered secret token', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        botToken,
      })

      const res = await handler(
        requestWithSecret(await deriveTelegramSecretToken(botToken))
      )

      expect(res.status).toBe(200)
      expect(logEvent).not.toHaveBeenCalled()
    })

    it('rejects a wrong secret token with 403 and records a configuration error', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        botToken,
      })

      const res = await handler(requestWithSecret('not-the-token'))

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.telegram.configuration.error',
        })
      )
    })

    it('rejects a token derived from a different bot token', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        botToken,
      })

      const res = await handler(
        requestWithSecret(await deriveTelegramSecretToken('999:other'))
      )

      expect(res.status).toBe(403)
    })

    it('accepts, logged, an update with no secret header (registered before the secret existed)', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        botToken,
      })

      const res = await handler(requestWithSecret(undefined))

      expect(res.status).toBe(200)
      expect(logEvent).not.toHaveBeenCalled()
    })

    it('accepts, logged, when the integration has no bot token to derive from', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        botToken: null,
      })

      const res = await handler(requestWithSecret('anything'))

      expect(res.status).toBe(200)
    })
  })
})
