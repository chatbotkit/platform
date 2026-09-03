/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { captureException } from '@/lib/error'
import { validateSlackRequest } from '@/lib/slack.signature'

import handler from '@/pages/api/v1/integration/slack/[slackIntegrationId]/interaction'
import { sendEvent } from '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  slackIntegration: {
    findUnique: jest.fn(),
  },
  message: {
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

jest.mock('@/lib/cloak', () => ({
  encrypt: jest.fn((value) => Promise.resolve(`encrypted_${value}`)),
  decrypt: jest.fn((value) => Promise.resolve(value.replace('encrypted_', ''))),
}))

global.fetch = jest.fn()

describe('Slack interaction API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // @note mock signature validation to pass by default
    validateSlackRequest.mockResolvedValue(true)
  })

  function makeRequest(payload, { slackIntegrationId = 'int-123' } = {}) {
    const url = `https://example.com/api/v1/integration/slack/${slackIntegrationId}/interaction?slackIntegrationId=${slackIntegrationId}`

    // Slack sends interaction payloads as form-encoded data
    const body = payload
      ? `payload=${encodeURIComponent(JSON.stringify(payload))}`
      : ''

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
  })

  it('returns notAuthorized and triggers setup on malformed payload', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const url = `https://example.com/api/v1/integration/slack/int-123/interaction?slackIntegrationId=int-123`
    const req = new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-slack-request-timestamp': '1640995200',
        'x-slack-signature': 'v0=valid-signature',
      },
      body: 'payload=invalid-json',
    })

    const res = await handler(req)

    expect(captureException).toHaveBeenCalled()
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'setup',
      payload: {},
    })
    expect(res.status).toBe(403)
  })

  it('returns notAuthorized when no payload parameter is found', async () => {
    prisma.slackIntegration.findUnique.mockResolvedValue({
      botToken: 'x',
      signingSecret: 'test-secret',
    })

    const url = `https://example.com/api/v1/integration/slack/int-123/interaction?slackIntegrationId=int-123`
    const req = new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-slack-request-timestamp': '1640995200',
        'x-slack-signature': 'v0=valid-signature',
      },
      body: 'other_param=value',
    })

    const res = await handler(req)

    expect(captureException).toHaveBeenCalled()
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'setup',
      payload: {},
    })
    expect(res.status).toBe(403)
  })

  describe('block_actions interactions', () => {
    it('handles show_references button click successfully', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      const sampleReferences = [
        {
          url: 'https://example.com/doc1',
          name: 'Document 1',
          description: 'First doc',
        },
        {
          url: 'https://example.com/doc2',
          name: 'Document 2',
          description: 'Second doc',
        },
      ]

      prisma.message.findUnique.mockResolvedValue({
        meta: {
          slackReferences: sampleReferences,
        },
      })

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        trigger_id: 'trigger123', // Required for modal display
        actions: [
          {
            action_id: 'show_references',
            value: 'encrypted_msg-123',
          },
        ],
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should retrieve references from message (after decryption)
      expect(prisma.message.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'msg-123',
        },
        select: {
          meta: true,
        },
      })

      // Should open modal with references via Slack Web API
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/views.open',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trigger_id: 'trigger123',
            view: {
              type: 'modal',
              title: {
                type: 'plain_text',
                text: 'References',
                emoji: true,
              },
              close: {
                type: 'plain_text',
                text: 'Close',
              },
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: '📄 References (2)',
                    emoji: true,
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*1.* <https://example.com/doc1|Document 1>\n_First doc_',
                  },
                },
                {
                  type: 'divider',
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*2.* <https://example.com/doc2|Document 2>\n_Second doc_',
                  },
                },
              ],
            },
          }),
        }
      )

      // Should return acknowledgment only (empty 200 OK)
      const responseBody = await res.text()

      expect(responseBody).toBe('')
    })

    it('escapes pipe characters in reference names to prevent breaking Slack mrkdwn', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      // @note references with pipe characters that would break Slack link syntax
      const referencesWithPipes = [
        {
          url: 'https://example.com/report',
          name: 'Smith | Jones Report',
          description: 'A report about things',
        },
      ]

      prisma.message.findUnique.mockResolvedValue({
        meta: {
          slackReferences: referencesWithPipes,
        },
      })

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        trigger_id: 'trigger123',
        actions: [
          {
            action_id: 'show_references',
            value: 'encrypted_msg-pipes',
          },
        ],
      }

      await handler(makeRequest(payload))

      // @note verify the pipe character is escaped with Unicode replacement
      const fetchCall = global.fetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const referenceBlock = body.view.blocks[1]

      // Should escape | to ǀ (Latin letter pipe) in link text
      expect(referenceBlock.text.text).toContain('Smith ǀ Jones Report')
      expect(referenceBlock.text.text).not.toContain('Smith | Jones')
    })

    it('converts markdown to plain text in reference descriptions', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      // @note references with markdown in descriptions
      const referencesWithMarkdown = [
        {
          url: 'https://example.com/doc',
          name: 'Important Document',
          description:
            '**Bold** and _italic_ text with [link](http://example.com)',
        },
      ]

      prisma.message.findUnique.mockResolvedValue({
        meta: {
          slackReferences: referencesWithMarkdown,
        },
      })

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        trigger_id: 'trigger123',
        actions: [
          {
            action_id: 'show_references',
            value: 'encrypted_msg-markdown',
          },
        ],
      }

      await handler(makeRequest(payload))

      // @note verify markdown is stripped to plain text
      const fetchCall = global.fetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const referenceBlock = body.view.blocks[1]

      // Should contain plain text without markdown syntax
      expect(referenceBlock.text.text).toContain(
        'Bold and italic text with link'
      )
      expect(referenceBlock.text.text).not.toContain('**Bold**')
      expect(referenceBlock.text.text).not.toContain('_italic_')
      expect(referenceBlock.text.text).not.toContain('[link]')
    })

    it('sends error message when references are not found', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      prisma.message.findUnique.mockResolvedValue({
        meta: {},
      })

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        trigger_id: 'trigger123',
        actions: [
          {
            action_id: 'show_references',
            value: 'encrypted_msg-no-refs',
          },
        ],
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should retrieve message
      expect(prisma.message.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'msg-no-refs',
        },
        select: {
          meta: true,
        },
      })

      // Should open error modal via Slack Web API
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/views.open',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trigger_id: 'trigger123',
            view: {
              type: 'modal',
              title: {
                type: 'plain_text',
                text: 'No References',
                emoji: true,
              },
              close: {
                type: 'plain_text',
                text: 'Close',
              },
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '⚠️ References are no longer available.',
                  },
                },
              ],
            },
          }),
        }
      )

      // Should return acknowledgment only
      const responseBody = await res.text()

      expect(responseBody).toBe('')
    })

    it('sends error message when message retrieval fails', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      prisma.message.findUnique.mockRejectedValue(new Error('Database error'))

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        trigger_id: 'trigger123',
        actions: [
          {
            action_id: 'show_references',
            value: 'encrypted_msg-error',
          },
        ],
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should capture the exception
      expect(captureException).toHaveBeenCalledWith(expect.any(Error))

      // Should open error modal via Slack Web API
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/views.open',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trigger_id: 'trigger123',
            view: {
              type: 'modal',
              title: {
                type: 'plain_text',
                text: 'Error',
                emoji: true,
              },
              close: {
                type: 'plain_text',
                text: 'Close',
              },
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '❌ Failed to retrieve references. Please try again.',
                  },
                },
              ],
            },
          }),
        }
      )

      // Should return acknowledgment only
      const responseBody = await res.text()

      expect(responseBody).toBe('')
    })

    it('sends error message when decryption fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { decrypt } = require('@/lib/cloak')

      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      // @note mock decryption failure
      decrypt.mockRejectedValueOnce(new Error('Decryption failed'))

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        trigger_id: 'trigger123',
        actions: [
          {
            action_id: 'show_references',
            value: 'invalid_encrypted_data',
          },
        ],
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should capture the exception
      expect(captureException).toHaveBeenCalledWith(expect.any(Error))

      // Should open error modal via Slack Web API
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/views.open',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trigger_id: 'trigger123',
            view: {
              type: 'modal',
              title: {
                type: 'plain_text',
                text: 'Error',
                emoji: true,
              },
              close: {
                type: 'plain_text',
                text: 'Close',
              },
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '❌ Failed to retrieve references. Please try again.',
                  },
                },
              ],
            },
          }),
        }
      )

      // Should return acknowledgment only
      const responseBody = await res.text()

      expect(responseBody).toBe('')
    })

    it('ignores block_actions with unknown action_id', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        actions: [
          {
            action_id: 'unknown_action',
            value: 'some-value',
          },
        ],
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should not call message lookup or fetch
      expect(prisma.message.findUnique).not.toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('handles block_actions without actions array', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should not call message lookup or fetch
      expect(prisma.message.findUnique).not.toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('other interaction types', () => {
    it('queues shortcut interactions as command-style events', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'shortcut',
        team: { id: 'T123' },
        user: { id: 'U123' },
        callback_id: 'test_shortcut',
        trigger_id: 'trigger123',
        response_url: 'https://hooks.slack.com/commands/test',
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: {
          type: 'shortcut',
          team: 'T123',
          user: 'U123',
          channelId: 'shortcut-U123',
          channelType: 'command',
          messageId: 'trigger123',
          ts: 'trigger123',
          text: 'Shortcut: test_shortcut',
          responseUrl: 'https://hooks.slack.com/commands/test',
        },
      })
    })

    it('queues message_action interactions as command-style events', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'message_action',
        team: { id: 'T123' },
        user: { id: 'U123' },
        callback_id: 'test_message_action',
        trigger_id: 'trigger123',
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: {
          type: 'message_action',
          team: 'T123',
          user: 'U123',
          channelId: 'C123',
          channelType: 'command',
          messageId: 'trigger123',
          ts: 'trigger123',
          text: 'Shortcut: test_message_action',
          responseUrl: undefined,
        },
      })
    })

    it('includes selected message text for message_action queue payloads', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'message_action',
        team: { id: 'T123' },
        user: { id: 'U123' },
        callback_id: 'summarize_message',
        trigger_id: 'trigger123',
        channel: { id: 'C123' },
        message: { ts: '1234567890.123', text: 'Please summarize this thread' },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: expect.objectContaining({
          type: 'message_action',
          text: expect.stringContaining(
            'Selected message:\nPlease summarize this thread'
          ),
        }),
      })
    })

    it('acknowledges view_submission interactions', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'view_submission',
        team: { id: 'T123' },
        user: { id: 'U123' },
        view: {
          id: 'view123',
          callback_id: 'test_modal',
        },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
    })

    it('processes downvote reason modal submission', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'view_submission',
        team: { id: 'T123' },
        user: { id: 'U123' },
        view: {
          id: 'view123',
          callback_id: 'downvote_reason_modal',
          private_metadata: JSON.stringify({
            token: 'slack-feedback-int-123-C123-key',
            channelId: 'C123',
            slackIntegrationId: 'int-123',
          }),
          state: {
            values: {
              reason_input: {
                reason: {
                  value: 'The response was not helpful',
                },
              },
            },
          },
        },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should send ratings event to queue with reason
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'ratings',
        payload: {
          token: 'slack-feedback-int-123-C123-key',
          action: 'downvote',
          channelId: 'C123',
          slackIntegrationId: 'int-123',
          reason: 'The response was not helpful',
        },
      })
    })

    it('processes downvote reason modal submission with empty reason', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'view_submission',
        team: { id: 'T123' },
        user: { id: 'U123' },
        view: {
          id: 'view123',
          callback_id: 'downvote_reason_modal',
          private_metadata: JSON.stringify({
            token: 'slack-feedback-int-123-C123-key',
            channelId: 'C123',
            slackIntegrationId: 'int-123',
          }),
          state: {
            values: {
              reason_input: {
                reason: {
                  value: '',
                },
              },
            },
          },
        },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should send ratings event to queue without reason when empty
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'ratings',
        payload: {
          token: 'slack-feedback-int-123-C123-key',
          action: 'downvote',
          channelId: 'C123',
          slackIntegrationId: 'int-123',
          reason: undefined,
        },
      })
    })

    it('acknowledges view_closed interactions', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'view_closed',
        team: { id: 'T123' },
        user: { id: 'U123' },
        view: {
          id: 'view123',
          callback_id: 'test_modal',
        },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
    })

    it('acknowledges unknown interaction types', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'x',
        signingSecret: 'test-secret',
      })

      const payload = {
        type: 'unknown_type',
        team: { id: 'T123' },
        user: { id: 'U123' },
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
    })
  })

  describe('feedback interactions', () => {
    it('sends thumbs up feedback to queue', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        actions: [
          {
            action_id: 'upvote',
            value: 'slack-feedback-int-123-C123-key',
          },
        ],
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should send feedback event to queue instead of processing directly
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'ratings',
        payload: {
          token: 'slack-feedback-int-123-C123-key',
          action: 'upvote',
          channelId: 'C123',
          slackIntegrationId: 'int-123',
        },
      })

      // Should not call fetch directly (handled by queue)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('shows downvote reason modal instead of immediate feedback', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValue({
        botToken: 'xoxb-test-token',
      })

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      })

      const payload = {
        type: 'block_actions',
        team: { id: 'T123' },
        user: { id: 'U123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123' },
        trigger_id: 'trigger123',
        actions: [
          {
            action_id: 'downvote',
            value: 'slack-feedback-int-123-C123-key',
          },
        ],
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)

      // Should open downvote modal instead of sending direct event
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/views.open',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trigger_id: 'trigger123',
            view: {
              type: 'modal',
              callback_id: 'downvote_reason_modal',
              title: {
                type: 'plain_text',
                text: 'Downvote Feedback',
                emoji: true,
              },
              submit: {
                type: 'plain_text',
                text: 'Downvote',
              },
              close: {
                type: 'plain_text',
                text: 'Cancel',
              },
              private_metadata: JSON.stringify({
                token: 'slack-feedback-int-123-C123-key',
                channelId: 'C123',
                slackIntegrationId: 'int-123',
              }),
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '👎 *Help us improve*\n\nPlease share why you found this response unsatisfactory. Your feedback helps us provide better assistance.',
                  },
                },
                {
                  type: 'input',
                  block_id: 'reason_input',
                  element: {
                    type: 'plain_text_input',
                    action_id: 'reason',
                    placeholder: {
                      type: 'plain_text',
                      text: 'Optional: Tell us what went wrong...',
                    },
                    multiline: true,
                    max_length: 500,
                  },
                  label: {
                    type: 'plain_text',
                    text: 'Reason for downvote',
                  },
                  optional: true,
                },
              ],
            },
          }),
        }
      )

      // Should not send event directly to queue (handled by modal submission)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })
})
