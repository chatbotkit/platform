/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'
import { validateSlackRequest } from '@/lib/slack.signature'

import handler from '@/pages/api/v1/integration/slack/[slackIntegrationId]/event'
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

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

describe('Slack event API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // @note mock signature validation to pass by default
    validateSlackRequest.mockResolvedValue(true)
  })

  function makeRequest(payload, { slackIntegrationId = 'int-123' } = {}) {
    const url = `https://example.com/api/v1/integration/slack/${slackIntegrationId}/event?slackIntegrationId=${slackIntegrationId}`

    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-slack-request-timestamp': '1640995200',
        'x-slack-signature': 'v0=valid-signature',
      },
      body: body,
    })
  }

  it('returns notFound and triggers setup when config is missing', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue(null)

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(404)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns notAuthorized and triggers setup on malformed JSON', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const req = makeRequest('not-json')
    const res = await handler(req)

    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'setup',
      payload: {},
    })
    expect(res.status).toBe(403)
  })

  it('ignores non-thread channel messages that are not IM', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U1',
        channel: 'C1',
        channel_type: 'channel',
        client_msg_id: 'm1',
        ts: '1717.1717',
        text: 'hello',
      },
      team_id: 'T1',
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('sends interact event for IM message with text', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U1',
        channel: 'D1',
        channel_type: 'im',
        client_msg_id: 'm1',
        ts: '1717.1717',
        text: 'hello there',
      },
      team_id: 'T1',
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'D1',
        channelType: 'im',
        messageId: 'm1',
        ts: '1717.1717',
        text: 'hello there',
      }),
    })
  })

  it('preserves the raw bot mention in IM messages for queue-side normalization', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U1',
        channel: 'D1',
        channel_type: 'im',
        client_msg_id: 'm-bot-mention',
        ts: '1717.1718',
        text: '<@UBOT> hello there',
      },
      team_id: 'T1',
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'D1',
        channelType: 'im',
        messageId: 'm-bot-mention',
        ts: '1717.1718',
        text: '<@UBOT> hello there',
      }),
    })
  })

  it('preserves user mentions in IM messages', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U1',
        channel: 'D1',
        channel_type: 'im',
        client_msg_id: 'm-mentions',
        ts: '1717.2000',
        text: 'reach out to <@U999> please',
      },
      team_id: 'T1',
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'D1',
        channelType: 'im',
        messageId: 'm-mentions',
        ts: '1717.2000',
        text: 'reach out to <@U999> please',
      }),
    })
  })

  it('sends interact event for threaded channel message to allow queue-side evaluation', async () => {
    // @note Thread messages MUST be sent to the queue so that shouldRespondInThread
    // can evaluate whether to continue the conversation. Without this, thread
    // continuation doesn't work when autoRespond is empty/null.
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
      autoRespond: null, // default behavior
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U2',
        channel: 'C2',
        channel_type: 'channel',
        client_msg_id: 'm2',
        ts: '2000.2000',
        thread_ts: '1999.1999',
        text: 'in thread',
      },
      team_id: 'T2',
    }

    const res = await handler(makeRequest(payload))

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'message',
        user: 'U2',
        channelId: 'C2',
        channelType: 'channel',
        text: 'in thread',
        ts: '1999.1999', // uses thread_ts as session key
        threadTs: '1999.1999',
      }),
    })
  })

  it('ignores messages from bots (bot_profile present)', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U3',
        channel: 'D3',
        channel_type: 'im',
        client_msg_id: 'm3',
        ts: '3000.3000',
        text: 'hello',
        bot_profile: {},
      },
      team_id: 'T3',
    }

    const res = await handler(makeRequest(payload))

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('ignores messages without user', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        user: undefined,
        channel: 'D4',
        channel_type: 'im',
        client_msg_id: 'm4',
        ts: '4000.4000',
        text: 'hello',
      },
      team_id: 'T4',
    }

    const res = await handler(makeRequest(payload))

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('sends interact for app_mention with raw text for queue-side normalization', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'app_mention',
        user: 'U5',
        channel: 'C5',
        channel_type: 'channel',
        client_msg_id: 'm5',
        ts: '5000.5000',
        text: '<@UBOT> ping',
      },
      team_id: 'T5',
    }

    const res = await handler(makeRequest(payload))

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'app_mention',
        team: 'T5',
        user: 'U5',
        channelId: 'C5',
        channelType: 'channel',
        messageId: 'm5',
        ts: '5000.5000',
        text: '<@UBOT> ping',
      }),
    })
  })

  it('preserves raw app_mention text before queue normalization', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'app_mention',
        user: 'U5',
        channel: 'C5',
        channel_type: 'channel',
        client_msg_id: 'm5-extra-mention',
        ts: '5000.5001',
        text: '<@UBOT> ask <@U123> to take a look',
      },
      team_id: 'T5',
    }

    const res = await handler(makeRequest(payload))

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'app_mention',
        team: 'T5',
        user: 'U5',
        channelId: 'C5',
        channelType: 'channel',
        messageId: 'm5-extra-mention',
        ts: '5000.5001',
        text: '<@UBOT> ask <@U123> to take a look',
      }),
    })
  })

  it('preserves a leading non-bot mention in app_mention text', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'app_mention',
        user: 'U5',
        channel: 'C5',
        channel_type: 'channel',
        client_msg_id: 'm5-leading-user-mention',
        ts: '5000.5002',
        text: '<@U123> loop in <@UBOT> on this',
      },
      team_id: 'T5',
    }

    const res = await handler(makeRequest(payload))

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'app_mention',
        team: 'T5',
        user: 'U5',
        channelId: 'C5',
        channelType: 'channel',
        messageId: 'm5-leading-user-mention',
        ts: '5000.5002',
        text: '<@U123> loop in <@UBOT> on this',
      }),
    })
  })

  it('still sends mention-only app_mention text to the queue for downstream normalization', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'event_callback',
      event: {
        type: 'app_mention',
        user: 'U1',
        channel: 'C1',
        channel_type: 'channel',
        client_msg_id: 'm1',
        ts: '1717.1717',
        text: '<@UBOT>   ',
      },
      team_id: 'T1',
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        type: 'app_mention',
        text: '<@UBOT>',
      }),
    })
  })

  it('returns challenge during url_verification', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const payload = {
      type: 'url_verification',
      challenge: 'abc123',
    }

    const req = makeRequest(payload)
    const res = await handler(req)

    expect(res.status).toBe(200)

    const json = await res.json()

    expect(json).toEqual({ challenge: 'abc123' })
  })

  it('bypasses validation when signing secret is missing', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      // signingSecret is missing
    })

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(200)
    // Should not trigger setup when bypassing validation
    expect(sendEvent).not.toHaveBeenCalledWith('int-123', {
      type: 'setup',
      payload: {},
    })
  })

  it('returns notAuthorized when signature validation fails', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    // @note mock signature validation to fail
    validateSlackRequest.mockRejectedValue(new Error('Invalid signature'))

    const req = makeRequest({
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U1',
        channel: 'C1',
        text: 'test',
      },
    })
    const res = await handler(req)

    expect(res.status).toBe(403)
    expect(logEvent).toHaveBeenCalled()
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'setup',
      payload: {},
    })
  })

  describe('autoRespond field behavior', () => {
    it('uses default behavior (null autoRespond) - ignores non-thread channel messages', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: null,
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'hello',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('always responds to DM (im channel type) regardless of autoRespond', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'hello',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: 'hello',
        }),
      })
    })

    it('responds to all messages with @all keyword - channel message', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@all',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'hello world',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: 'hello world',
          channelType: 'channel',
        }),
      })
    })

    it('responds to all messages with @all (with spaces) - group message', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '  @all  ',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'G1',
          channel_type: 'group',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'group message',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: 'group message',
          channelType: 'group',
        }),
      })
    })

    it('queues message for @agent evaluation in queue handler', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@agent Check knowledge base before responding',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'hello',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      // @note @agent messages are queued for AI evaluation in the queue handler
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: {
          type: 'message',
          team: 'T1',
          user: 'U1',
          channelId: 'C1',
          channelType: 'channel',
          messageId: 'm1',
          ts: '1717.1717',
          threadTs: undefined,
          text: 'hello',
          files: [],
        },
      })
    })

    it('queues message for custom instruction evaluation in queue handler', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: 'Respond only to questions',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'hello',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      // @note custom instructions are queued for LLM evaluation in the queue handler
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: {
          type: 'message',
          team: 'T1',
          user: 'U1',
          channelId: 'C1',
          channelType: 'channel',
          messageId: 'm1',
          ts: '1717.1717',
          threadTs: undefined,
          text: 'hello',
          files: [],
        },
      })
    })

    it('ignores bot messages even with @all configured', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@all',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'bot message',
          bot_profile: {},
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('always responds to app_mention regardless of autoRespond (null)', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: null,
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '<@UBOT> can you help?',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'app_mention',
          text: '<@UBOT> can you help?',
        }),
      })
    })

    it('always responds to app_mention even with @agent autoRespond', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@agent Only respond if relevant',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '<@UBOT> hello',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'app_mention',
          text: '<@UBOT> hello',
        }),
      })
    })

    it('always responds to app_mention even with custom autoRespond instructions', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: 'Respond only to questions',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '<@UBOT> hello there',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'app_mention',
          text: '<@UBOT> hello there',
        }),
      })
    })

    it('always responds to IM even with null autoRespond', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: null,
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'direct message',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: 'direct message',
          channelType: 'im',
        }),
      })
    })

    it('always responds to IM even with @agent autoRespond', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@agent Only respond if relevant',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D2',
          channel_type: 'im',
          client_msg_id: 'm2',
          ts: '2000.2000',
          text: 'another dm',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: 'another dm',
          channelType: 'im',
        }),
      })
    })

    it('always responds to IM even with custom autoRespond instructions', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: 'Respond only to questions',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D3',
          channel_type: 'im',
          client_msg_id: 'm3',
          ts: '3000.3000',
          text: 'statement not a question',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: 'statement not a question',
          channelType: 'im',
        }),
      })
    })
  })

  describe('duplicate event prevention', () => {
    it('skips message events in channels that start with user mention to avoid race with app_mention', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@all',
      })

      // @note when user sends "@bot hi", Slack sends both app_mention and message
      // events. We skip the message event to let app_mention handle it, ensuring
      // the autoRespond LLM evaluation is bypassed for direct mentions.
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '<@U09C5DMKYMR> hi',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('skips message events in groups that start with user mention', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@all',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'G1',
          channel_type: 'group',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '<@UBOT123> hello bot',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('does NOT skip message events in DMs that start with user mention', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      // @note in DMs, we don't get app_mention events, so we should NOT skip
      // message events even if they contain mentions
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '<@U123> hey there',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: '<@U123> hey there',
          channelType: 'im',
        }),
      })
    })

    it('does NOT skip message events without user mention at start', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '@all',
      })

      // @note regular messages without mentions should still be queued
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'hello everyone',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          text: 'hello everyone',
        }),
      })
    })
  })

  describe('bot message detection', () => {
    it('ignores messages with subtype bot_message (no client_msg_id)', async () => {
      // @note Bot messages with subtype but without
      // bot_profile were not being filtered, causing ZodError on missing messageId
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          subtype: 'bot_message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          // @note bot messages don't have client_msg_id
          ts: '1717.1717',
          text: 'hello from bot',
          bot_id: 'B123',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('ignores messages with bot_id but no bot_profile', async () => {
      // @note Some bot messages have bot_id without
      // bot_profile, which bypassed the old bot detection check
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          // @note no client_msg_id
          ts: '1717.1717',
          text: 'hello from bot',
          bot_id: 'B123',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('thread continuation with empty autoRespond', () => {
    it('queues thread reply to allow queue-side shouldRespondInThread evaluation', async () => {
      // @note when autoRespond is empty but the message is a thread reply
      // (thread_ts is present), we should still queue it so that the queue
      // handler can check if there's an existing conversation and use
      // shouldRespondInThread for proper continuation logic
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '', // empty autoRespond
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U350RAUDN',
          channel: 'C042H6HBUDS',
          channel_type: 'channel',
          client_msg_id: 'msg-456',
          ts: '1769569118.075639', // message timestamp
          thread_ts: '1769569095.425359', // thread parent timestamp - indicates this is a reply
          text: 'What is your name?',
        },
        team_id: 'T351N928H',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      // @note thread replies should be queued so shouldRespondInThread can evaluate
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          team: 'T351N928H',
          user: 'U350RAUDN',
          channelId: 'C042H6HBUDS',
          channelType: 'channel',
          messageId: 'msg-456',
          ts: '1769569095.425359', // should use thread_ts as session key
          text: 'What is your name?',
        }),
      })
    })

    it('queues thread reply even when autoRespond is null', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: null,
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '2000.2000',
          thread_ts: '1999.1999', // thread parent
          text: 'follow up question',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message',
          ts: '1999.1999', // uses thread_ts
          text: 'follow up question',
        }),
      })
    })

    it('still ignores non-thread channel messages when autoRespond is empty', async () => {
      // @note this ensures we don't accidentally respond to all channel messages
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
        autoRespond: '',
      })

      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'C1',
          channel_type: 'channel',
          client_msg_id: 'm1',
          ts: '1717.1717',
          // no thread_ts - this is NOT a thread reply
          text: 'hello',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('file attachments', () => {
    beforeEach(() => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })
    })

    it('passes files array in sendEvent payload', async () => {
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'here is a file',
          files: [
            {
              id: 'F123',
              name: 'test.jpg',
              mimetype: 'image/jpeg',
              url_private: 'https://files.slack.com/files-pri/T123/test.jpg',
            },
          ],
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          files: [
            {
              id: 'F123',
              name: 'test.jpg',
              mimetype: 'image/jpeg',
              url_private: 'https://files.slack.com/files-pri/T123/test.jpg',
            },
          ],
        }),
      })
    })

    it('processes messages with files but empty text', async () => {
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '',
          files: [
            {
              id: 'F123',
              name: 'document.pdf',
              mimetype: 'application/pdf',
              url_private: 'https://files.slack.com/files-pri/T123/doc.pdf',
            },
          ],
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          text: '',
          files: expect.arrayContaining([
            expect.objectContaining({ id: 'F123' }),
          ]),
        }),
      })
    })

    it('passes empty files array when no files present', async () => {
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: 'just text',
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          text: 'just text',
          files: [],
        }),
      })
    })

    it('ignores messages with no text and no files', async () => {
      const payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          channel: 'D1',
          channel_type: 'im',
          client_msg_id: 'm1',
          ts: '1717.1717',
          text: '',
          // no files
        },
        team_id: 'T1',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })
})
