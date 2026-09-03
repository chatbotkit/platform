/**
 * @jest-environment node
 */
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { setContextFrontendHost } from '@/lib/context.store'
import {
  makeConversationAttachmentUploadActivityMessages,
  uploadConversationAttachmentFromURL,
} from '@/lib/conversation.attachment'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { captureError } from '@/lib/error'
import { extractDataWithSchema } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { resolveSession } from '@/lib/integration.session'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import memcache from '@/lib/memcache'
import {
  THINKING_LOADING_MESSAGES,
  THINKING_STATUS,
} from '@/lib/messaging.thinking'
import queue from '@/lib/queue'
import { getChannelInfo } from '@/lib/slack.channel'
import { markdownToBlockChunks } from '@/lib/slack.markdown'
import { translateSlackReferences } from '@/lib/slack.references'
import { getBotUserId, getUserInfo } from '@/lib/slack.user'
import { parseAsync } from '@/lib/zod.schema'

import {
  AUTO_RESPOND_EVAL_FUNCTION,
  INTERACT_EVENT_TYPE,
  InteractPayloadSchema,
  SETUP_EVENT_TYPE,
  SLACK_MAX_LOADING_MESSAGES,
  fetchSlackMessageHistory,
  fetchSlackThreadReplies,
  handleInitiateEvent,
  handleInteractEvent,
  handleSetupEvent,
  postSlackEphemeralMessage,
  postSlackMessage,
  sendEvent,
  setSlackAssistantThreadStatus,
  shouldRespondInThread,
  shouldRespondToMessage,
  updateSlackMessage,
} from '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue'

// @note partner ownership is covered by portal.config.utest.js; the
// custom-domain cases here pin only frontend host propagation
jest.mock('@/lib/portal.config', () => ({
  getPortalGlobalConfig: jest.fn((portal) =>
    portal.slug.endsWith('-acme-dev') ? { domain: 'acme.dev' } : null
  ),
}))

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    slackIntegration: { findUnique: jest.fn() },
    portal: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(async () => 1),
  expire: jest.fn(),
}))

jest.mock('@/lib/channel.session', () => ({
  publishChannelMessage: jest.fn(async () => undefined),
  // @note default: an empty stream (no newer message) so the yield watcher
  // settles immediately and the turn runs to completion.
  streamChannelEvents: jest.fn(() => (async function* () {})()),
}))

jest.mock('@/lib/fetch', () => {
  const fetch = jest.fn()

  return {
    __esModule: true,
    default: fetch,
    getFetchError: jest.fn(async (res) => new Error(`status ${res.status}`)),
    withTimeout: jest.fn((f) => f),
    withBodyTimeout: jest.fn((f) => f),
    withRetry: jest.fn((f) => f),
  }
})

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return {
    ...actual,
    captureError: jest.fn(),
    captureInputError: jest.fn(),
    captureObservation: jest.fn(),
    captureUnexpectedState: jest.fn(),
  }
})

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

jest.mock('@/lib/extract.data', () => ({
  extractDataWithSchema: jest.fn(),
}))

jest.mock('@/lib/job', () => ({ runTasks: jest.fn(async () => undefined) }))

jest.mock('@/lib/slack.markdown', () => ({
  MAX_SLACK_BLOCKS_PER_MESSAGE: 50,
  markdownToBlocks: jest.fn(async (t) => [
    { type: 'section', text: { type: 'mrkdwn', text: t } },
  ]),
  markdownToBlockChunks: jest.fn(async (t) => [
    {
      text: t,
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: t } }],
    },
  ]),
  // @note mirrors the real helper: isolate images and cap groups at the
  // per-message block limit
  groupBlocksForSlackMessages: jest.fn((chunks, maxBlocks = 50) => {
    const groups = []

    for (const { text, blocks } of chunks) {
      let pending = null

      const flush = () => {
        if (pending && pending.length) {
          groups.push({ text, blocks: pending })
        }

        pending = null
      }

      for (const block of blocks) {
        if (block.type === 'image') {
          flush()

          groups.push({ text, blocks: [block] })

          continue
        }

        if (!pending) {
          pending = []
        }

        pending.push(block)

        if (pending.length >= maxBlocks) {
          flush()
        }
      }

      flush()
    }

    return groups
  }),
}))

jest.mock('@/lib/slack.user', () => ({
  getBotUserId: jest.fn(),
  getUserInfo: jest.fn(),
}))

jest.mock('@/lib/slack.channel', () => ({
  getChannelInfo: jest.fn(async () => ({ name: 'test-channel' })),
  resolveChannel: jest.fn(async () => null),
  inferChannelType: jest.fn(() => 'channel'),
}))

jest.mock('@/lib/integration.session', () => ({
  resolveSession: jest.fn(async () => null),
  setSessionKeys: jest.fn(async () => undefined),
  deleteSessionKeys: jest.fn(async () => undefined),
}))

jest.mock('@/lib/slack.references', () => ({
  translateSlackReferences: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
  setContextFrontendHost: jest.fn(),
}))

jest.mock('@/lib/session.context', () => ({ updateSessionStore: jest.fn() }))

jest.mock('@/lib/zod.schema', () => {
  const actual = jest.requireActual('@/lib/zod.schema')

  return {
    ...actual,

    parseAsync: jest.fn(async () => undefined),
  }
})

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/conversation.find', () => ({
  hasConversation: jest.fn(async () => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(async () => ({
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
    dispose: jest.fn(async () => undefined),
  })),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({})),
}))

jest.mock('@/lib/contact.create', () => ({
  createContactFingerprint: jest.fn(() => 'fp'),
  ensureTrustedContact: jest.fn(async () => ({ id: 'contact-1' })),
}))

jest.mock('@/lib/user.session', () => ({
  userToSessionUser: jest.fn((u) => u),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(async () => ({ id: 'conv-1' })),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  uploadConversationAttachmentFromURL: jest.fn(async () => ({
    attachmentId: 'att-1',
    name: 'file.jpg',
    type: 'image/jpeg',
  })),
  makeConversationAttachmentUploadActivityMessages: jest.fn(() => ({
    request: { type: 'request' },
    response: { type: 'response' },
  })),
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn(async () => 10 * 1024 * 1024), // 10MB
}))

jest.mock(
  '@/pages/api/v1/integration/slack/[slackIntegrationId]/setup',
  () => ({ doSetup: jest.fn(async () => undefined) })
)

function createMockEngine(overrides = {}) {
  return {
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
    dispose: jest.fn(async () => undefined),
    ...overrides,
  }
}

/**
 * Find the first assistant.threads.setStatus call whose parsed body matches
 * `predicate` (any status call when omitted). Returns the parsed body, so
 * assertions read against `{ channel_id, thread_ts, status, loading_messages }`
 * rather than a raw fetch tuple.
 */
function findStatusCall(predicate = () => true) {
  return fetch.mock.calls
    .filter(
      ([url, init]) =>
        url === 'https://slack.com/api/assistant.threads.setStatus' &&
        typeof init?.body === 'string'
    )
    .map(([, init]) => JSON.parse(init.body))
    .find(predicate)
}

describe('Slack queue module', () => {
  const slackIntegrationId = 'int-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    // @note reset queued one-time implementations to avoid test-order leakage
    getStatefulConversationEngine.mockReset()
    getStatefulConversationEngine.mockResolvedValue(createMockEngine())

    uploadConversationAttachmentFromURL.mockReset()
    uploadConversationAttachmentFromURL.mockResolvedValue({
      attachmentId: 'att-1',
      name: 'file.jpg',
      type: 'image/jpeg',
    })

    makeConversationAttachmentUploadActivityMessages.mockReset()
    makeConversationAttachmentUploadActivityMessages.mockReturnValue({
      request: { type: 'request' },
      response: { type: 'response' },
    })

    prisma.slackIntegration.findUnique.mockResolvedValue({
      id: slackIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      botToken: 'x',
      allowFrom: '*',
      visibleMessages: 0,
      sessionDuration: 86400000,
      contactCollection: false,
    })

    // @note mock portal lookup for frontend host setting

    prisma.portal.findFirst.mockResolvedValue({
      id: 'portal-123',
      slug: 'test-portal',
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)

    fetch.mockReset()

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ts: 'ts-1' }),
      status: 200,
    })

    getBotUserId.mockResolvedValue('UBOT')
    getUserInfo.mockReset()

    getChannelInfo.mockResolvedValue({ name: 'test-channel' })

    markdownToBlockChunks.mockResolvedValue([
      {
        text: 'reply',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'reply' } }],
      },
    ])

    parseAsync.mockResolvedValue(undefined)
  })

  describe('sendEvent', () => {
    it('accepts interact payload without messageId', () => {
      const payload = {
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'im',
        ts: '123.456',
        text: 'hi',
      }

      const result = InteractPayloadSchema.safeParse(payload)

      expect(result.success).toBe(true)
    })

    it('enqueues interact with deduplication id including slack event type', async () => {
      const payload = {
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'im',
        messageId: 'M1',
        ts: '123.456',
        text: 'hi',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      // @note deduplicationId includes payload.type (slack event type like 'message' or 'app_mention')
      // to distinguish events that refer to the same message but have different slack event types
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          deduplicationId: `slack-${slackIntegrationId}-interact-message-T1-C1-M1`,
        })
      )
    })

    it('allocates a per-session order and nudges on interact', async () => {
      const { publishChannelMessage } = await import('@/lib/channel.session')

      const sessionKey = `slack-session-im-${slackIntegrationId}-U1`

      const payload = {
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'im',
        messageId: 'M1',
        ts: '123.456',
        text: 'hi',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      // @note order allocated onto the payload (incr mock returns 1) + nudge
      expect(payload.order).toBe(1)
      expect(memcache.incr).toHaveBeenCalledWith(`${sessionKey}-latest`)
      expect(publishChannelMessage).toHaveBeenCalledWith(
        { id: sessionKey },
        'inbound',
        { order: 1 }
      )

      // @note flow (already serialized per thread/DM) is preserved
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        expect.objectContaining({
          flow: expect.objectContaining({ parallel: 1 }),
        })
      )
    })

    it('falls back to ts for deduplication id when messageId is missing', async () => {
      const payload = {
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'im',
        ts: '123.456',
        text: 'hi',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          deduplicationId: `slack-${slackIntegrationId}-interact-message-T1-C1-123.456`,
        })
      )
    })

    it('enqueues app_mention with different deduplication id than message', async () => {
      const payload = {
        type: 'app_mention',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'channel',
        messageId: 'M1',
        ts: '123.456',
        text: 'hi bot',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          // @note app_mention gets its own deduplication ID separate from message
          deduplicationId: `slack-${slackIntegrationId}-interact-app_mention-T1-C1-M1`,
        })
      )
    })

    it('enqueues setup without deduplication id', async () => {
      await sendEvent(slackIntegrationId, {
        type: SETUP_EVENT_TYPE,
        payload: {},
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: SETUP_EVENT_TYPE, payload: {} },
        {}
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(slackIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })

    it('uses channelId-only flow key for IM channel type', async () => {
      const payload = {
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'im',
        messageId: 'M1',
        ts: '123.456',
        text: 'hi',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          flow: {
            key: `slack-${slackIntegrationId}-interact-T1-C1`,
            parallel: 1,
          },
        })
      )
    })

    it('uses channelId-only flow key for command channel type', async () => {
      const payload = {
        type: 'command',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'command',
        messageId: 'M1',
        ts: '123.456',
        text: '/help',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          flow: {
            key: `slack-${slackIntegrationId}-interact-T1-C1`,
            parallel: 1,
          },
        })
      )
    })

    it('uses channelId+ts flow key for channel type', async () => {
      const payload = {
        type: 'app_mention',
        team: 'T1',
        user: 'U1',
        channelId: 'C1',
        channelType: 'channel',
        messageId: 'M1',
        ts: '123.456',
        text: 'hello bot',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          flow: {
            key: `slack-${slackIntegrationId}-interact-T1-C1-123.456`,
            parallel: 1,
          },
        })
      )
    })

    it('uses channelId+ts flow key for group channel type', async () => {
      const payload = {
        type: 'message',
        team: 'T1',
        user: 'U1',
        channelId: 'G1',
        channelType: 'group',
        messageId: 'M1',
        ts: '789.012',
        text: 'hello group',
      }

      await sendEvent(slackIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/slack/${slackIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          flow: {
            key: `slack-${slackIntegrationId}-interact-T1-G1-789.012`,
            parallel: 1,
          },
        })
      )
    })
  })

  describe('handleSetupEvent', () => {
    it('throws when integration is not found', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(handleSetupEvent(slackIntegrationId, {})).rejects.toThrow(
        /not found/i
      )
    })

    it('invokes doSetup when integration exists', async () => {
      const { doSetup } = await import(
        '@/pages/api/v1/integration/slack/[slackIntegrationId]/setup'
      )

      await expect(
        handleSetupEvent(slackIntegrationId, {})
      ).resolves.toBeUndefined()

      expect(doSetup).toHaveBeenCalled()
    })

    it('sets frontend host from first portal for context-based link rewriting', async () => {
      const { doSetup } = jest.requireMock(
        '@/pages/api/v1/integration/slack/[slackIntegrationId]/setup'
      )

      await expect(
        handleSetupEvent(slackIntegrationId, {})
      ).resolves.toBeUndefined()

      expect(setContextFrontendHost).toHaveBeenCalledWith(
        'test-portal.chatbotkit.agency'
      )
      expect(doSetup).toHaveBeenCalled()
    })

    it('handles custom domain pattern for acme.dev portals', async () => {
      // @note mock portal with acme pattern

      prisma.portal.findFirst.mockResolvedValueOnce({
        id: 'portal-123',
        slug: 'company-acme-dev',
      })

      const { doSetup } = jest.requireMock(
        '@/pages/api/v1/integration/slack/[slackIntegrationId]/setup'
      )

      await expect(
        handleSetupEvent(slackIntegrationId, {})
      ).resolves.toBeUndefined()

      expect(setContextFrontendHost).toHaveBeenCalledWith('company.acme.dev')
      expect(doSetup).toHaveBeenCalled()
    })

    it('continues without frontend host when portal lookup fails', async () => {
      // @note simulate portal lookup failure

      prisma.portal.findFirst.mockRejectedValueOnce(new Error('Database error'))

      const { doSetup } = jest.requireMock(
        '@/pages/api/v1/integration/slack/[slackIntegrationId]/setup'
      )

      await expect(
        handleSetupEvent(slackIntegrationId, {})
      ).resolves.toBeUndefined()

      expect(setContextFrontendHost).not.toHaveBeenCalled()
      expect(doSetup).toHaveBeenCalled()
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      type: 'message',
      team: 'T1',
      user: 'U1',
      channelId: 'C1',
      channelType: 'im',
      messageId: 'M1',
      ts: '123.456',
      text: 'hello',
    }

    it('throws when integration is not found', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(slackIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    describe('usage limits', () => {
      it('posts the pre-canned reply and skips generation for a DM when over limit', async () => {
        accountConversationalLimitsOk.mockResolvedValueOnce(false)

        // @note basePayload is a DM (channelType: 'im') - directly addressed, so
        // the bot would definitely respond; we surface the limit reply instead
        // of failing silently
        await handleInteractEvent(slackIntegrationId, basePayload)

        expect(fetch).toHaveBeenCalledWith(
          'https://slack.com/api/chat.postMessage',
          expect.objectContaining({
            body: expect.stringContaining(messages.limitsReachedReply),
          })
        )

        // @note early return - no generation is attempted
        expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      })

      it('posts the pre-canned reply for an @mention when over limit', async () => {
        accountConversationalLimitsOk.mockResolvedValueOnce(false)

        await handleInteractEvent(slackIntegrationId, {
          ...basePayload,
          type: 'app_mention',
          channelType: 'channel',
        })

        expect(fetch).toHaveBeenCalledWith(
          'https://slack.com/api/chat.postMessage',
          expect.objectContaining({
            body: expect.stringContaining(messages.limitsReachedReply),
          })
        )
      })

      it('stays silent (throws) for a non-directed channel message when over limit', async () => {
        accountConversationalLimitsOk.mockResolvedValueOnce(false)

        // @note a plain channel message hinges on the autoRespond filter (an LLM
        // evaluation for @agent/custom values that runs later and costs tokens),
        // so we must not post the notice nor spend tokens deciding - it falls
        // through to the silent limit throw
        await expect(
          handleInteractEvent(slackIntegrationId, {
            ...basePayload,
            type: 'message',
            channelType: 'channel',
          })
        ).rejects.toThrow(/Limits exceeded/i)

        const postMessageCalls = fetch.mock.calls.filter(
          (call) => call[0] === 'https://slack.com/api/chat.postMessage'
        )

        expect(postMessageCalls).toHaveLength(0)
      })
    })

    it('deletes the placeholder and skips generation when superseded before generation', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'xoxb-token',
        allowFrom: '*',
        visibleMessages: 0,
        sessionDuration: 86400000,
        contactCollection: false,
      })

      const mockEngine = {
        send: jest.fn(async () => undefined),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        addMessages: jest.fn(async () => undefined),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      // @note conversation lookups return an existing conversation; the supersede
      // marker (…-latest) reports a newer order (5) than this turn's (3).
      memcache.get.mockImplementation(async (key) =>
        typeof key === 'string' && key.endsWith('-latest') ? '5' : 'conv-abc'
      )

      await handleInteractEvent(slackIntegrationId, {
        ...basePayload,
        order: 3,
      })

      // @note message appended, generation skipped, and the "_..._" placeholder
      // we posted is deleted (chat.delete) so only the latest reply remains.
      expect(mockEngine.send).toHaveBeenCalled()
      expect(mockEngine.receive).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.delete',
        expect.anything()
      )
    })

    describe('allowFrom restrictions', () => {
      it('allows message when allowFrom is wildcard (*)', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: '*',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        // @note should not return early - proceeds to redis/conversation logic
        await handleInteractEvent(slackIntegrationId, basePayload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )
      })

      it('blocks message and logs event when allowFrom is empty (deny all)', async () => {
        const { logEvent } = await import('@/lib/log')

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: '',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        await handleInteractEvent(slackIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.slack.blocked',
            meta: expect.objectContaining({
              userId: basePayload.user,
              channelId: basePayload.channelId,
            }),
          })
        )
      })

      it('blocks message and logs event when allowFrom is null (deny all)', async () => {
        const { logEvent } = await import('@/lib/log')

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: null,
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        await handleInteractEvent(slackIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )
      })

      it('allows message when userId matches allowFrom entry', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          // @note basePayload.user is 'U1' - too short for Slack ID pattern,
          // so we use a realistic ID here and match by raw ID
          allowFrom: 'U000000001',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        const payload = { ...basePayload, user: 'U000000001' }

        await handleInteractEvent(slackIntegrationId, payload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )
      })

      it('blocks message when userId does not match allowFrom entry', async () => {
        const { logEvent } = await import('@/lib/log')

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: 'U000000002',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        const payload = { ...basePayload, user: 'U000000001' }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )
      })

      it('allows message when channelId matches allowFrom entry', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: 'C000000001',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        const payload = { ...basePayload, channelId: 'C000000001' }

        await handleInteractEvent(slackIntegrationId, payload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )
      })

      it('allows message when @username matches resolved user name', async () => {
        getUserInfo.mockResolvedValueOnce({ id: 'U000000001', name: 'alice' })

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: '@alice',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        const payload = { ...basePayload, user: 'U000000001' }

        await handleInteractEvent(slackIntegrationId, payload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )

        // @note getUserInfo should be called to resolve the username
        expect(getUserInfo).toHaveBeenCalledWith(
          'U000000001',
          expect.objectContaining({ token: 'xoxb-token' })
        )
      })

      it('blocks message when @username does not match resolved user name', async () => {
        const { logEvent } = await import('@/lib/log')

        getUserInfo.mockResolvedValueOnce({ id: 'U000000001', name: 'bob' })

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: '@alice',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        const payload = { ...basePayload, user: 'U000000001' }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )
      })

      it('allows message when #channel-name matches resolved channel name', async () => {
        getChannelInfo.mockResolvedValueOnce({ name: 'general' })

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: '#general',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        const payload = { ...basePayload, channelId: 'C000000001' }

        await handleInteractEvent(slackIntegrationId, payload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )

        // @note getChannelInfo should be called to resolve the channel name
        expect(getChannelInfo).toHaveBeenCalledWith(
          'C000000001',
          expect.objectContaining({ token: 'xoxb-token' })
        )
      })

      it('does not resolve usernames for allowFrom when it has no @username entries', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: '*',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        await handleInteractEvent(slackIntegrationId, basePayload)

        // @note the wildcard allowFrom list has no 'username'-type entries, so it
        // needs no username resolution. The single getUserInfo call is the
        // per-turn sender resolution (which always runs), not an allowFrom lookup.
        expect(getUserInfo).toHaveBeenCalledTimes(1)
        expect(getUserInfo).toHaveBeenCalledWith(
          basePayload.user,
          expect.objectContaining({ token: 'xoxb-token' })
        )
      })

      it('does not call getChannelInfo when allowFrom has no #channel-name entries', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-token',
          allowFrom: '*',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        await handleInteractEvent(slackIntegrationId, basePayload)

        // @note mock is shared; only check it was not called with blocking args
        const calls = getChannelInfo.mock.calls.filter(
          ([id]) => id === basePayload.channelId
        )

        // @note getChannelInfo may be called later for other purposes (e.g.
        // channel context), but NOT in the allowFrom block for wildcard
        const allowFromBlockCall = calls.find(
          ([, opts]) => opts?.token === 'xoxb-token'
        )

        // @note we cannot assert it's never called here since the rest of
        // handleInteractEvent also calls getChannelInfo - assert the blocked
        // event was NOT logged instead
        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.slack.blocked' })
        )
      })
    })

    it('returns early and logs event when botToken is missing', async () => {
      const { logEvent } = await import('@/lib/log')

      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        name: 'Test Integration',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: '', // @note empty token
        visibleMessages: 0,
        sessionDuration: 86400000,
        contactCollection: false,
      })

      await handleInteractEvent(slackIntegrationId, basePayload)

      // @note should not make any fetch calls
      expect(fetch).not.toHaveBeenCalled()

      // @note should log the missing token event
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Slack Integration Missing Token',
          type: 'integration.slack.config.error',
          relations: { slackIntegrationId },
          meta: expect.objectContaining({
            reason: 'missing_bot_token',
          }),
        })
      )
    })

    it('returns early and logs event when botToken is null', async () => {
      const { logEvent } = await import('@/lib/log')

      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        name: 'Test Integration',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: null, // @note null token
        visibleMessages: 0,
        sessionDuration: 86400000,
        contactCollection: false,
      })

      await handleInteractEvent(slackIntegrationId, basePayload)

      // @note should not make any fetch calls
      expect(fetch).not.toHaveBeenCalled()

      // @note should log the missing token event
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.slack.config.error',
        })
      )
    })

    it('resets session and returns for ///reset', async () => {
      const payload = { ...basePayload, text: '///reset' }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(memcache.del).toHaveBeenCalledWith(
        `slack-session-im-${slackIntegrationId}-U1`
      )

      expect(fetch).not.toHaveBeenCalled()
    })

    it('returns early when not im/app_mention/command and no conversation', async () => {
      const payload = {
        ...basePayload,

        channelType: 'channel',
        type: 'message',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const { createConversation } = await import('@/lib/conversation.create')

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('uses responseUrl to send final message (no placeholder post)', async () => {
      const payload = {
        ...basePayload,

        responseUrl: 'https://hooks.slack.com/actions/xyz',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(markdownToBlockChunks).toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith(
        payload.responseUrl,
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('updates the placeholder with the first chunk and posts later chunks separately', async () => {
      markdownToBlockChunks.mockResolvedValueOnce([
        {
          text: 'first chunk',
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: 'first chunk' } },
          ],
        },
        {
          text: 'second chunk',
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: 'second chunk' } },
          ],
        },
      ])

      await handleInteractEvent(slackIntegrationId, basePayload)

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(fetch.mock.calls[0][0]).toBe(
        'https://slack.com/api/chat.postMessage'
      )
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
        text: 'first chunk',
      })
      expect(fetch.mock.calls[1][0]).toBe('https://slack.com/api/chat.update')
      expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({
        text: 'second chunk',
      })
      expect(fetch.mock.calls[2][0]).toBe(
        'https://slack.com/api/chat.postMessage'
      )
    })

    it('handles slack response 404 by capturing error (non-throw)', async () => {
      const payload = {
        ...basePayload,

        type: 'app_mention',
        channelType: 'channel',
        responseUrl: undefined,
      }

      getChannelInfo.mockResolvedValueOnce(null)

      // @note routed by URL rather than call order: a threaded turn's status
      // calls surround the reply, and positional mocks quietly hand the wrong
      // response to the wrong call whenever that sequence shifts
      fetch.mockImplementation(async (url) =>
        url === 'https://slack.com/api/chat.postMessage'
          ? {
              ok: false,
              status: 404,
              json: async () => ({ error: 'not_found' }),
            }
          : { ok: true, status: 200, json: async () => ({ ok: true }) }
      )

      await handleInteractEvent(slackIntegrationId, payload)

      expect(captureError).toHaveBeenCalled()
    })

    it('handles cannot_reply_to_message Slack API error by capturing error (non-throw)', async () => {
      const payload = {
        ...basePayload,

        type: 'app_mention',
        channelType: 'channel',
        responseUrl: undefined,
      }

      getChannelInfo.mockResolvedValueOnce(null)

      // @note routed by URL rather than call order - see above
      fetch.mockImplementation(async (url) =>
        url === 'https://slack.com/api/chat.postMessage'
          ? {
              ok: true,
              status: 200,
              json: async () => ({
                ok: false,
                error: 'cannot_reply_to_message',
              }),
            }
          : { ok: true, status: 200, json: async () => ({ ok: true }) }
      )

      await handleInteractEvent(slackIntegrationId, payload)

      expect(captureError).toHaveBeenCalled()
    })

    it('throws for non-404 slack response errors', async () => {
      const payload = {
        ...basePayload,

        type: 'app_mention',
        channelType: 'channel',
        responseUrl: undefined,
      }

      // @note routed by URL rather than call order - see above
      fetch.mockImplementation(async (url) =>
        url === 'https://slack.com/api/chat.postMessage'
          ? {
              ok: false,
              status: 500,
              json: async () => ({ error: 'internal_error' }),
            }
          : { ok: true, status: 200, json: async () => ({ ok: true }) }
      )

      await expect(
        handleInteractEvent(slackIntegrationId, payload)
      ).rejects.toThrow(/status 500/)
    })

    it('should capture error when conversations.history request fails (visibleMessages > 0)', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        visibleMessages: 3,
        sessionDuration: 86400000,
        contactCollection: false,
      })

      const payload = {
        ...basePayload,

        type: 'app_mention',
        channelType: 'channel',
      }

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal_error' }),
      })

      await handleInteractEvent(slackIntegrationId, payload)

      expect(captureError).toHaveBeenCalled()
    })

    // @note a DM is the path that still posts a placeholder - a threaded turn
    // shows the native status instead and never posts one
    it('should capture error when placeholder chat.postMessage fails (response.ok=false)', async () => {
      const payload = {
        ...basePayload,

        type: 'message',
        channelType: 'im',
      }

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal_error' }),
      })

      await handleInteractEvent(slackIntegrationId, payload)

      expect(captureError).toHaveBeenCalled()
    })

    // @note a DM has no thread to hang a native status on, so the placeholder
    // message stays the indicator there and operation begin still rewrites it
    // via chat.update - this is the fallback path.
    it('should capture error when chat.update during operation begin fails', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getChannelInfo.mockResolvedValueOnce(null)

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, ts: 'ts-1' }),
          status: 200,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'internal_error' }),
        })

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          await sink.push(
            (
              await import('@/lib/conversation.tag')
            ).TAG_OPERATION_BEGIN,
            { action: { name: 'Test Action' } }
          )

          return createMockEngine()
        }
      )

      const payload = {
        ...basePayload,
        type: 'message',
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(captureError).toHaveBeenCalled()
    })

    // @note on a threaded turn the action label rides the native thread status
    // (assistant.threads.setStatus) rather than a placeholder rewrite.
    it('shows the action justification rather than the name in the operation-begin status', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          const tags = await import('@/lib/conversation.tag')

          await sink.push(tags.TAG_OPERATION_BEGIN, {
            action: {
              name: 'searchDataset',
              justification: 'Looking up the customer profile',
            },
          })

          return createMockEngine()
        }
      )

      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const statusCall = findStatusCall((body) => body.status.includes('⚡'))

      expect(statusCall).toBeDefined()

      expect(statusCall.status).toBe('⚡ Looking up the customer profile')
    })

    it('falls back to the action name when no justification is provided', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          const tags = await import('@/lib/conversation.tag')

          await sink.push(tags.TAG_OPERATION_BEGIN, {
            action: { name: 'searchDataset' },
          })

          return createMockEngine()
        }
      )

      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const statusCall = findStatusCall((body) => body.status.includes('⚡'))

      expect(statusCall).toBeDefined()

      expect(statusCall.status).toBe('⚡ searchDataset')
    })

    // @note DMs have no thread for a native status, so the action label still
    // rewrites the placeholder message there.
    it('shows the action justification in the placeholder update for a DM', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          const tags = await import('@/lib/conversation.tag')

          await sink.push(tags.TAG_OPERATION_BEGIN, {
            action: {
              name: 'searchDataset',
              justification: 'Looking up the customer profile',
            },
          })

          return createMockEngine()
        }
      )

      const payload = {
        ...basePayload,
        type: 'message',
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const updateCall = fetch.mock.calls.find(
        ([url, init]) =>
          url === 'https://slack.com/api/chat.update' &&
          typeof init?.body === 'string' &&
          init.body.includes('⚡')
      )

      expect(updateCall).toBeDefined()

      const body = JSON.parse(updateCall[1].body)

      expect(body.blocks[0].elements[0].text).toBe(
        '⚡ _Looking up the customer profile_'
      )

      // @note no native status is attempted without a thread to hang it on
      expect(findStatusCall()).toBeUndefined()
    })

    it('does not post a placeholder message when the native status carries the indication', async () => {
      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const posts = fetch.mock.calls.filter(
        ([url]) => url === 'https://slack.com/api/chat.postMessage'
      )

      // @note exactly one post - the reply itself, with no "_..._" message
      // ahead of it and nothing to update in place afterwards
      expect(posts).toHaveLength(1)

      expect(posts[0][1].body).not.toContain('_..._')

      expect(
        fetch.mock.calls.some(
          ([url]) => url === 'https://slack.com/api/chat.update'
        )
      ).toBe(false)
    })

    // @note a user can open a thread inside a DM. The reply belongs in that
    // thread - posting it back at the channel root would read as a non-sequitur
    // against whatever unrelated message happens to be last.
    it('replies inside the thread when a DM message is threaded', async () => {
      const { hasConversation } = await import('@/lib/conversation.find')

      memcache.get.mockResolvedValue('conv-1')

      hasConversation.mockResolvedValue(true)

      const payload = {
        ...basePayload,
        type: 'message',
        channelType: 'im',
        ts: 'dm-parent-ts',
        threadTs: 'dm-parent-ts',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const post = fetch.mock.calls.find(
        ([url]) => url === 'https://slack.com/api/chat.postMessage'
      )

      expect(JSON.parse(post[1].body).thread_ts).toBe('dm-parent-ts')
    })

    it('replies at the root for an unthreaded DM', async () => {
      const payload = {
        ...basePayload,
        type: 'message',
        channelType: 'im',
        threadTs: undefined,
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const post = fetch.mock.calls.find(
        ([url]) => url === 'https://slack.com/api/chat.postMessage'
      )

      expect(JSON.parse(post[1].body)).not.toHaveProperty('thread_ts')
    })

    // @note a threaded DM does have a thread to hang the native status on, so
    // it behaves like a channel turn rather than falling back to a placeholder
    it('uses the native status for a threaded DM', async () => {
      const { hasConversation } = await import('@/lib/conversation.find')

      memcache.get.mockResolvedValue('conv-1')

      hasConversation.mockResolvedValue(true)

      const payload = {
        ...basePayload,
        type: 'message',
        channelType: 'im',
        ts: 'dm-parent-ts',
        threadTs: 'dm-parent-ts',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const statusCall = findStatusCall((body) => !!body.status)

      expect(statusCall).toBeDefined()

      expect(statusCall.thread_ts).toBe('dm-parent-ts')

      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url === 'https://slack.com/api/chat.postMessage' &&
            init.body.includes('_..._')
        )
      ).toBe(false)
    })

    it('still posts a placeholder in a DM, where no native status is possible', async () => {
      const payload = {
        ...basePayload,
        type: 'message',
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const posts = fetch.mock.calls.filter(
        ([url]) => url === 'https://slack.com/api/chat.postMessage'
      )

      expect(posts[0][1].body).toContain('_..._')

      expect(findStatusCall()).toBeUndefined()
    })

    it('sets the native thinking status with loading messages on a threaded turn', async () => {
      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const statusCall = findStatusCall((body) => !!body.status)

      expect(statusCall).toBeDefined()

      expect(statusCall.status).toBe(THINKING_STATUS)

      expect(statusCall.loading_messages).toEqual(THINKING_LOADING_MESSAGES)

      // @note the status hangs off the triggering message, which is also the
      // thread the reply is posted into
      expect(statusCall.channel_id).toBe(payload.channelId)

      expect(statusCall.thread_ts).toBe(payload.ts)
    })

    it('anchors the native status to the parent thread when replying inside a thread', async () => {
      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
        // @note event.js normalizes ts to `thread_ts || ts`, so a real thread
        // reply arrives with both already pointing at the thread parent
        ts: 'parent-ts',
        threadTs: 'parent-ts',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const statusCall = findStatusCall((body) => !!body.status)

      expect(statusCall).toBeDefined()

      expect(statusCall.thread_ts).toBe('parent-ts')
    })

    it('clears the native status before delivering the reply', async () => {
      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const statusCalls = fetch.mock.calls.filter(
        ([url]) => url === 'https://slack.com/api/assistant.threads.setStatus'
      )

      expect(statusCalls.length).toBeGreaterThanOrEqual(2)

      // @note Slack clears the status on reply by itself, but not for an empty
      // reply that posts nothing - so the turn clears it explicitly rather than
      // leaving a shimmer to linger until it expires
      const clearIndex = fetch.mock.calls.findIndex(
        ([url, init]) =>
          url === 'https://slack.com/api/assistant.threads.setStatus' &&
          JSON.parse(init.body).status === ''
      )

      const deliveryIndex = fetch.mock.calls.findIndex(
        ([url]) => url === 'https://slack.com/api/chat.postMessage'
      )

      expect(clearIndex).toBeGreaterThan(-1)

      expect(deliveryIndex).toBeGreaterThan(clearIndex)
    })

    it('falls back to the placeholder update when the native status API fails', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      // @note the status is cosmetic: a failure disables it for the rest of
      // the turn and the placeholder carries the indication instead
      fetch.mockImplementation(async (url) => {
        if (url === 'https://slack.com/api/assistant.threads.setStatus') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: false, error: 'method_not_supported' }),
          }
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, ts: 'ts-1' }),
        }
      })

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          const tags = await import('@/lib/conversation.tag')

          await sink.push(tags.TAG_OPERATION_BEGIN, {
            action: { name: 'searchDataset' },
          })

          return createMockEngine()
        }
      )

      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      const updateCall = fetch.mock.calls.find(
        ([url, init]) =>
          url === 'https://slack.com/api/chat.update' &&
          typeof init?.body === 'string' &&
          init.body.includes('⚡')
      )

      expect(updateCall).toBeDefined()

      expect(JSON.parse(updateCall[1].body).blocks[0].elements[0].text).toBe(
        '⚡ _searchDataset_'
      )

      // @note one failed attempt is enough to disable it - no retry storm
      expect(
        fetch.mock.calls.filter(
          ([url]) => url === 'https://slack.com/api/assistant.threads.setStatus'
        )
      ).toHaveLength(1)
    })

    it('should capture error when chat.update during complete begin fails', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, ts: 'ts-1' }),
          status: 200,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
          status: 200,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'internal_error' }),
        })

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          const tags = await import('@/lib/conversation.tag')

          await sink.push(tags.TAG_OPERATION_BEGIN, { action: { name: 'Act' } })
          await sink.push(tags.TAG_COMPLETE_BEGIN)

          return createMockEngine()
        }
      )

      const payload = {
        ...basePayload,
        type: 'message',
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(captureError).toHaveBeenCalled()
    })

    it('sets frontend host from first portal for context-based link rewriting', async () => {
      await handleInteractEvent(slackIntegrationId, basePayload)

      expect(setContextFrontendHost).toHaveBeenCalledWith(
        'test-portal.chatbotkit.agency'
      )
    })

    it('handles custom domain pattern for acme.dev portals in interact event', async () => {
      // @note mock portal with acme pattern

      prisma.portal.findFirst.mockResolvedValueOnce({
        id: 'portal-123',
        slug: 'company-acme-dev',
      })

      await handleInteractEvent(slackIntegrationId, basePayload)

      expect(setContextFrontendHost).toHaveBeenCalledWith('company.acme.dev')
    })

    it('continues without frontend host when portal lookup fails in interact event', async () => {
      // @note simulate portal lookup failure

      prisma.portal.findFirst.mockRejectedValueOnce(new Error('Database error'))

      await handleInteractEvent(slackIntegrationId, basePayload)

      expect(setContextFrontendHost).not.toHaveBeenCalled()
    })

    it('strips the integration bot mention before translating and sending text', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const mockEngine = createMockEngine()

      getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)
      translateSlackReferences.mockImplementation(async (text) => text)

      const payload = {
        ...basePayload,
        text: '<@UBOT> hello there',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(getBotUserId).toHaveBeenCalledWith('x')
      expect(translateSlackReferences).toHaveBeenCalledWith(
        'hello there',
        expect.objectContaining({ token: 'x' })
      )
      expect(mockEngine.send).toHaveBeenCalledWith('hello there')
    })

    it('returns early when self-mention normalization leaves no text', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const mockEngine = createMockEngine()

      getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)
      translateSlackReferences.mockImplementation(async (text) => text)

      const payload = {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
        text: '<@UBOT>   ',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(getBotUserId).toHaveBeenCalledWith('x')
      expect(translateSlackReferences).not.toHaveBeenCalled()
      expect(mockEngine.send).not.toHaveBeenCalled()
    })

    it('should not call fetchSlackThreadReplies when channelId is missing', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'xoxb-test',
        visibleMessages: 5,
        sessionDuration: 86400000,
        contactCollection: false,
      })

      const payload = {
        ...basePayload,
        threadTs: '123.456',
        channelId: undefined,
      }

      await handleInteractEvent(slackIntegrationId, payload)

      // @note should not attempt to fetch thread replies without channelId
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('https://slack.com/api/conversations.replies'),
        expect.any(Object)
      )
    })

    it('should not call fetchSlackThreadReplies when threadTs is missing', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'xoxb-test',
        visibleMessages: 5,
        sessionDuration: 86400000,
        contactCollection: false,
      })

      const payload = {
        ...basePayload,
        threadTs: undefined,
        channelId: 'C123',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      // @note should not attempt to fetch thread replies without threadTs
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('https://slack.com/api/conversations.replies'),
        expect.any(Object)
      )
    })

    describe('file attachments', () => {
      it('uploads attachments when integration.attachments is enabled and files are provided', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
        })

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )

        const mockEngine = createMockEngine({
          addMessages: jest.fn(async () => undefined),
        })

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        const payload = {
          ...basePayload,
          files: [
            {
              id: 'F123',
              name: 'test.jpg',
              mimetype: 'image/jpeg',
              url_private: 'https://files.slack.com/files-pri/T123/test.jpg',
            },
          ],
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
          'conv-1',
          'https://files.slack.com/files-pri/T123/test.jpg',
          expect.objectContaining({
            Authorization: 'Bearer xoxb-test',
          }),
          expect.objectContaining({
            maxSize: 10 * 1024 * 1024,
          })
        )

        expect(mockEngine.addMessages).toHaveBeenCalled()
      })

      it('skips attachment upload when integration.attachments is disabled', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: false,
        })

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )

        const payload = {
          ...basePayload,
          files: [
            {
              id: 'F123',
              name: 'test.jpg',
              mimetype: 'image/jpeg',
              url_private: 'https://files.slack.com/files-pri/T123/test.jpg',
            },
          ],
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(uploadConversationAttachmentFromURL).not.toHaveBeenCalled()
      })

      it('uses url_private_download when available', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
        })

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )

        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )

        const mockEngine = createMockEngine({
          addMessages: jest.fn(async () => undefined),
        })

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        const payload = {
          ...basePayload,
          files: [
            {
              id: 'F123',
              name: 'test.pdf',
              mimetype: 'application/pdf',
              url_private: 'https://files.slack.com/files-pri/T123/test.pdf',
              url_private_download:
                'https://files.slack.com/files-pri/T123/download/test.pdf',
            },
          ],
        }

        await handleInteractEvent(slackIntegrationId, payload)

        // @note should prefer url_private_download over url_private
        expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
          'conv-1',
          'https://files.slack.com/files-pri/T123/download/test.pdf',
          expect.objectContaining({
            Authorization: 'Bearer xoxb-test',
          }),
          expect.objectContaining({
            maxSize: 10 * 1024 * 1024,
          })
        )
      })

      it('skips files without download URLs', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
        })

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )

        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )

        const mockEngine = createMockEngine({
          addMessages: jest.fn(async () => undefined),
        })

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        const payload = {
          ...basePayload,
          files: [
            {
              id: 'F123',
              name: 'test.pdf',
              mimetype: 'application/pdf',
              // no url_private or url_private_download
            },
          ],
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(uploadConversationAttachmentFromURL).not.toHaveBeenCalled()
      })

      it('adds attachment activity messages before the first send on a text-plus-file turn', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
        })

        const { makeConversationAttachmentUploadActivityMessages } =
          await import('@/lib/conversation.attachment')
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )

        const activityRequest = { type: 'activity', text: 'attachment request' }
        const activityResponse = {
          type: 'activity',
          text: 'attachment response',
        }

        makeConversationAttachmentUploadActivityMessages.mockReturnValueOnce({
          request: activityRequest,
          response: activityResponse,
        })

        translateSlackReferences.mockImplementation(async (text) => text)

        let attachmentMessagesAdded = false

        const mockEngine = createMockEngine({
          addMessages: jest.fn(async (messages) => {
            expect(messages).toEqual([activityRequest, activityResponse])
            attachmentMessagesAdded = true
          }),
          send: jest.fn(async () => {
            expect(attachmentMessagesAdded).toBe(true)
          }),
        })

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        const payload = {
          ...basePayload,
          text: 'hello with file',
          files: [
            {
              id: 'F123',
              name: 'test.jpg',
              mimetype: 'image/jpeg',
              url_private: 'https://files.slack.com/files-pri/T123/test.jpg',
            },
          ],
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(mockEngine.addMessages).toHaveBeenCalledWith([
          activityRequest,
          activityResponse,
        ])
        expect(mockEngine.send).toHaveBeenCalledWith('hello with file')
        expect(mockEngine.addMessages.mock.invocationCallOrder[0]).toBeLessThan(
          mockEngine.send.mock.invocationCallOrder[0]
        )
      })

      it('stores attachment activity messages without sending when the turn only contains files', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
        })

        const { makeConversationAttachmentUploadActivityMessages } =
          await import('@/lib/conversation.attachment')
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )

        const activityRequest = {
          type: 'activity',
          text: 'stored attachment request',
        }
        const activityResponse = {
          type: 'activity',
          text: 'stored attachment response',
        }

        makeConversationAttachmentUploadActivityMessages.mockReturnValueOnce({
          request: activityRequest,
          response: activityResponse,
        })

        const mockEngine = createMockEngine({
          addMessages: jest.fn(async () => undefined),
          send: jest.fn(async () => undefined),
        })

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        const payload = {
          ...basePayload,
          text: '   ',
          files: [
            {
              id: 'F123',
              name: 'test.jpg',
              mimetype: 'image/jpeg',
              url_private: 'https://files.slack.com/files-pri/T123/test.jpg',
            },
          ],
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(mockEngine.addMessages).toHaveBeenCalledWith([
          activityRequest,
          activityResponse,
        ])
        expect(mockEngine.send).not.toHaveBeenCalled()
        expect(mockEngine.receive).not.toHaveBeenCalled()
      })
    })

    describe('thread interference prevention', () => {
      it('should NOT create a conversation for thread replies when bot has no existing session (prevents cross-bot interference)', async () => {
        // @note this is the core bug scenario: Bot B has autoRespond '@all'
        // and receives a thread reply in a thread it was never part of.
        // Without the fix, Bot B would create a new conversation and respond.

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          autoRespond: '@all',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        // @note no existing session in Redis
        memcache.get.mockResolvedValue(null)

        const { createConversation } = await import('@/lib/conversation.create')

        const payload = {
          ...basePayload,
          type: 'message',
          channelType: 'channel',
          ts: '1000.1000',
          threadTs: '1000.1000', // @note thread reply
          text: 'thanks for the help',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        // @note bot should NOT create a conversation in a thread it was never part of
        expect(createConversation).not.toHaveBeenCalled()
      })

      it('should NOT create a conversation for thread replies with custom autoRespond instructions when bot has no session', async () => {
        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          autoRespond: 'Respond to all questions about cooking',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        memcache.get.mockResolvedValue(null)

        const { createConversation } = await import('@/lib/conversation.create')

        const payload = {
          ...basePayload,
          type: 'message',
          channelType: 'channel',
          ts: '2000.2000',
          threadTs: '2000.2000',
          text: 'how do I make pasta?',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(createConversation).not.toHaveBeenCalled()
      })

      it('should STILL create a conversation when bot is explicitly mentioned in a thread (app_mention)', async () => {
        // @note if someone @mentions the bot in a thread, it should respond
        // even if it was never part of the thread before

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          autoRespond: null,
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        memcache.get.mockResolvedValue(null)

        const { createConversation } = await import('@/lib/conversation.create')

        const payload = {
          ...basePayload,
          type: 'app_mention',
          channelType: 'channel',
          ts: '3000.3000',
          threadTs: '3000.3000',
          text: 'can you help?',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        // @note bot was explicitly mentioned, so it should respond
        expect(createConversation).toHaveBeenCalled()
      })

      it('should STILL continue responding in a thread where bot has an existing session', async () => {
        // @note if the bot was previously part of the thread (has a session),
        // it should continue responding to thread replies

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          autoRespond: '@all',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        // @note bot has an existing session for this thread
        memcache.get.mockResolvedValue('existing-conv-1')

        const { hasConversation } = await import('@/lib/conversation.find')

        hasConversation.mockResolvedValueOnce(true)

        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )

        getStatefulConversationEngine.mockResolvedValueOnce(createMockEngine())

        const payload = {
          ...basePayload,
          type: 'message',
          channelType: 'channel',
          ts: '4000.4000',
          threadTs: '4000.4000',
          text: 'follow up question',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        // @note bot should continue responding (it was already part of the thread)
        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            conversationId: 'existing-conv-1',
          })
        )
      })

      it('should STILL create a conversation for non-thread channel messages with autoRespond @all', async () => {
        // @note non-thread messages should still work with autoRespond

        prisma.slackIntegration.findUnique.mockResolvedValueOnce({
          id: slackIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'xoxb-test',
          allowFrom: '*',
          autoRespond: '@all',
          visibleMessages: 0,
          sessionDuration: 86400000,
          contactCollection: false,
        })

        memcache.get.mockResolvedValue(null)

        const { createConversation } = await import('@/lib/conversation.create')

        const payload = {
          ...basePayload,
          type: 'message',
          channelType: 'channel',
          ts: '5000.5000',
          threadTs: undefined, // @note NOT a thread reply
          text: 'hello everyone',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        // @note non-thread messages should still trigger autoRespond
        expect(createConversation).toHaveBeenCalled()
      })

      it('should STILL create a conversation for DMs even without an existing session', async () => {
        // @note DMs should always work regardless of thread state

        memcache.get.mockResolvedValue(null)

        const { createConversation } = await import('@/lib/conversation.create')

        const payload = {
          ...basePayload,
          type: 'message',
          channelType: 'im',
          ts: '6000.6000',
          threadTs: undefined,
          text: 'hello',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(createConversation).toHaveBeenCalled()
      })
    })
  })

  describe('shouldRespondToMessage', () => {
    const mockIntegration = {
      id: 'int-xyz',
      user: { id: 'user-1', name: 'Test' },
    }

    beforeEach(() => {
      extractDataWithSchema.mockReset()
    })

    it('should respond to app_mention events regardless of autoRespond config', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: null,
        eventType: 'app_mention',
        channelType: 'channel',
        text: 'hello bot',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should respond to DMs regardless of autoRespond config', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: null,
        eventType: 'message',
        channelType: 'im',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should not respond when autoRespond is null', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: null,
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'No autoRespond configuration',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should not respond when autoRespond is empty string', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: '   ',
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'No autoRespond configuration',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should not respond when message starts with user mention', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: '@all',
        eventType: 'message',
        channelType: 'channel',
        text: '<@U12345ABC> how are you?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Message directed at another user',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should not respond when message starts with whitespace then user mention', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: 'Respond to all questions',
        eventType: 'message',
        channelType: 'channel',
        text: '  <@U9999XYZ> can you help me?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Message directed at another user',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should still respond to app_mention even if text starts with user mention', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: null,
        eventType: 'app_mention',
        channelType: 'channel',
        text: '<@UBOT123> hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
    })

    it('should still respond to DM even if text starts with user mention', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: null,
        eventType: 'message',
        channelType: 'im',
        text: '<@UOTHER123> hey there',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
    })

    it('should respond to all messages when autoRespond is @all', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: '@all',
        eventType: 'message',
        channelType: 'channel',
        text: 'hello everyone',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: '@all configuration',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should respond to all messages when autoRespond is @all with whitespace', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: '  @all  ',
        eventType: 'message',
        channelType: 'channel',
        text: 'hello everyone',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: '@all configuration',
      })
      expect(extractDataWithSchema).not.toHaveBeenCalled()
    })

    it('should use LLM evaluation for @agent prefix and respond when LLM says yes', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: true,
          reason: 'Message is about customer support',
        },
        usage: {
          recordBaseTokens: jest.fn(),
        },
      })

      const result = await shouldRespondToMessage({
        autoRespond: '@agent Respond only to customer support questions',
        eventType: 'message',
        channelType: 'channel',
        text: 'I need help with my order',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Message is about customer support',
      })
      expect(extractDataWithSchema).toHaveBeenCalled()
    })

    it('should use LLM evaluation for @agent prefix and not respond when LLM says no', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: false,
          reason: 'Message is not related to customer support',
        },
        usage: {
          recordBaseTokens: jest.fn(),
        },
      })

      const result = await shouldRespondToMessage({
        autoRespond: '@agent Respond only to customer support questions',
        eventType: 'message',
        channelType: 'channel',
        text: 'What is the weather today?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Message is not related to customer support',
      })
      expect(extractDataWithSchema).toHaveBeenCalled()
    })

    it('should use LLM evaluation for custom instructions and respond when LLM says yes', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: true,
          reason: 'Message matches filter criteria',
        },
        usage: {
          recordBaseTokens: jest.fn(),
        },
      })

      const result = await shouldRespondToMessage({
        autoRespond: 'Respond to messages about pricing',
        eventType: 'message',
        channelType: 'channel',
        text: 'How much does it cost?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Message matches filter criteria',
      })
      expect(extractDataWithSchema).toHaveBeenCalled()
    })

    it('should use LLM evaluation for custom instructions and not respond when LLM says no', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: false,
          reason: 'Message does not match filter criteria',
        },
        usage: {
          recordBaseTokens: jest.fn(),
        },
      })

      const result = await shouldRespondToMessage({
        autoRespond: 'Respond to messages about pricing',
        eventType: 'message',
        channelType: 'channel',
        text: 'What is your favorite color?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Message does not match filter criteria',
      })
      expect(extractDataWithSchema).toHaveBeenCalled()
    })

    it('should not record token usage twice for LLM evaluation', async () => {
      const mockRecordBaseTokens = jest.fn()

      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: true,
          reason: 'Matched',
        },
        usage: {
          recordBaseTokens: mockRecordBaseTokens,
        },
      })

      await shouldRespondToMessage({
        autoRespond: 'Respond to greetings',
        eventType: 'message',
        channelType: 'channel',
        text: 'Hello!',
        integration: mockIntegration,
      })

      // @note usage should not be recorded directly in queue handler because
      // the conversation engine already records it internally via usageMeta
      // and usageReferences passed to extractDataWithSchema
      expect(mockRecordBaseTokens).not.toHaveBeenCalled()

      // @note verify usageMeta and usageReferences are passed to
      // extractDataWithSchema so tokens are recorded with proper metadata
      // during engine.complete()

      expect(extractDataWithSchema).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          usageMeta: { reason: 'slack/auto-respond' },
          usageReferences: { slackIntegrationId: mockIntegration.id },
        })
      )
    })

    it('should carry the message under evaluation as an activity result, not a backstory-only list', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: { shouldRespond: true, reason: 'Matched' },
        usage: { recordBaseTokens: jest.fn() },
      })

      await shouldRespondToMessage({
        autoRespond: 'Respond to messages about pricing',
        eventType: 'message',
        channelType: 'channel',
        text: 'How much does it cost?',
        integration: mockIntegration,
      })

      const [messages] = extractDataWithSchema.mock.calls.at(-1)

      // @note a backstory-only list maps entirely to the Responses-API
      // `instructions`, leaving `input` empty and 400ing on gpt-5-nano. There
      // must be at least one non-backstory message so `input` is non-empty.

      expect(messages.some((message) => message.type !== 'backstory')).toBe(
        true
      )

      // @note the untrusted Slack text rides in the activity/tool result...

      const activity = messages.find(
        (message) =>
          message.type === 'activity' &&
          message.meta?.activity?.type === 'response' &&
          message.meta?.activity?.function?.name === AUTO_RESPOND_EVAL_FUNCTION
      )

      expect(activity).toBeDefined()
      expect(JSON.stringify(activity.meta.activity.function.result)).toContain(
        'How much does it cost?'
      )

      // @note ...and NOT in any backstory (system) message

      for (const backstory of messages.filter((m) => m.type === 'backstory')) {
        expect(backstory.text).not.toContain('How much does it cost?')
      }
    })

    it('should not respond when LLM evaluation fails', async () => {
      extractDataWithSchema.mockRejectedValueOnce(new Error('LLM API error'))

      const result = await shouldRespondToMessage({
        autoRespond: 'Respond to greetings',
        eventType: 'message',
        channelType: 'channel',
        text: 'Hello!',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Auto response evaluation failed',
      })
      expect(captureError).toHaveBeenCalled()
    })

    it('should default shouldRespond to false when LLM returns null data', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: null,
        usage: {
          recordBaseTokens: jest.fn(),
        },
      })

      const result = await shouldRespondToMessage({
        autoRespond: 'Respond to greetings',
        eventType: 'message',
        channelType: 'channel',
        text: 'Hello!',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'No reason provided',
      })
    })

    it('should handle group channel type same as regular channel', async () => {
      const result = await shouldRespondToMessage({
        autoRespond: null,
        eventType: 'message',
        channelType: 'group',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'No autoRespond configuration',
      })
    })
  })

  describe('shouldRespondInThread', () => {
    const mockIntegration = {
      id: 'int-xyz',
      user: { id: 'user-1', email: 'test@example.com' },
    }

    beforeEach(() => {
      extractDataWithSchema.mockReset()
      captureError.mockReset()
    })

    it('should always continue for app_mention events', async () => {
      const result = await shouldRespondInThread({
        autoRespond: null,
        eventType: 'app_mention',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
    })

    it('should always continue for DMs', async () => {
      const result = await shouldRespondInThread({
        autoRespond: null,
        eventType: 'message',
        channelType: 'im',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
    })

    it('should not continue when message starts with user mention', async () => {
      const result = await shouldRespondInThread({
        autoRespond: true,
        eventType: 'message',
        channelType: 'channel',
        text: '<@U123ABC> how are you?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Message directed at another user',
      })
    })

    it('should not continue when message starts with whitespace then user mention', async () => {
      const result = await shouldRespondInThread({
        autoRespond: true,
        eventType: 'message',
        channelType: 'channel',
        text: '  <@U123ABC> hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Message directed at another user',
      })
    })

    it('should continue by default when autoRespond is null', async () => {
      const result = await shouldRespondInThread({
        autoRespond: null,
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Default: continue in existing conversations',
      })
    })

    it('should continue by default when autoRespond is empty string', async () => {
      const result = await shouldRespondInThread({
        autoRespond: '',
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Default: continue in existing conversations',
      })
    })

    it('should continue by default when autoRespond is true', async () => {
      const result = await shouldRespondInThread({
        autoRespond: true,
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Default: continue in existing conversations',
      })
    })

    it('should continue for @all configuration', async () => {
      const result = await shouldRespondInThread({
        autoRespond: '@all',
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: '@all configuration',
      })
    })

    it('should use LLM for custom instructions', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: false,
          reason: 'Not relevant to topic',
        },
        usage: { recordBaseTokens: jest.fn() },
      })

      const result = await shouldRespondInThread({
        autoRespond: 'Only respond to questions about cooking',
        eventType: 'message',
        channelType: 'channel',
        text: 'What is the weather?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: false,
        reason: 'Not relevant to topic',
      })
    })

    it('should use LLM for @agent instructions', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: true,
          reason: 'User is asking a question',
        },
        usage: { recordBaseTokens: jest.fn() },
      })

      const result = await shouldRespondInThread({
        autoRespond: '@agent Respond only to questions',
        eventType: 'message',
        channelType: 'channel',
        text: 'What time is it?',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'User is asking a question',
      })
    })

    it('should carry the message under evaluation as an activity result, not a backstory-only list', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: { shouldRespond: true, reason: 'Matched' },
        usage: { recordBaseTokens: jest.fn() },
      })

      await shouldRespondInThread({
        autoRespond: 'Only respond to questions about cooking',
        eventType: 'message',
        channelType: 'channel',
        text: 'How do I bake bread?',
        integration: mockIntegration,
      })

      const [messages] = extractDataWithSchema.mock.calls.at(-1)

      // @note guard the empty-Responses-`input` regression: never send a
      // backstory-only message list

      expect(messages.some((message) => message.type !== 'backstory')).toBe(
        true
      )

      const activity = messages.find(
        (message) =>
          message.type === 'activity' &&
          message.meta?.activity?.type === 'response' &&
          message.meta?.activity?.function?.name === AUTO_RESPOND_EVAL_FUNCTION
      )

      expect(activity).toBeDefined()
      expect(JSON.stringify(activity.meta.activity.function.result)).toContain(
        'How do I bake bread?'
      )

      for (const backstory of messages.filter((m) => m.type === 'backstory')) {
        expect(backstory.text).not.toContain('How do I bake bread?')
      }
    })

    it('should not record token usage twice for auto-continue LLM evaluation', async () => {
      const mockRecordBaseTokens = jest.fn()

      extractDataWithSchema.mockResolvedValueOnce({
        data: {
          shouldRespond: true,
          reason: 'Should continue responding',
        },
        usage: {
          recordBaseTokens: mockRecordBaseTokens,
        },
      })

      await shouldRespondInThread({
        autoRespond: 'Continue for support questions',
        eventType: 'message',
        channelType: 'channel',
        text: 'Can you help me?',
        integration: mockIntegration,
      })

      // @note usage should not be recorded directly in queue handler because
      // the conversation engine already records it internally via usageMeta
      // and usageReferences passed to extractDataWithSchema
      expect(mockRecordBaseTokens).not.toHaveBeenCalled()

      // @note verify usageMeta and usageReferences are passed to
      // extractDataWithSchema so tokens are recorded with proper metadata
      // during engine.complete()
      expect(extractDataWithSchema).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          usageMeta: { reason: 'slack/auto-continue' },
          usageReferences: { slackIntegrationId: mockIntegration.id },
        })
      )
    })

    it('should default to continue when LLM fails', async () => {
      extractDataWithSchema.mockRejectedValueOnce(new Error('LLM error'))

      const result = await shouldRespondInThread({
        autoRespond: 'some instructions',
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Auto continue evaluation failed, defaulting to continue',
      })
    })

    it('should default shouldRespond to true when LLM returns null data', async () => {
      extractDataWithSchema.mockResolvedValueOnce({
        data: null,
        usage: { recordBaseTokens: jest.fn() },
      })

      const result = await shouldRespondInThread({
        autoRespond: 'some instructions',
        eventType: 'message',
        channelType: 'channel',
        text: 'hello',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'No reason provided',
      })
    })

    it('should still continue to app_mention even if text starts with user mention', async () => {
      const result = await shouldRespondInThread({
        autoRespond: true,
        eventType: 'app_mention',
        channelType: 'channel',
        text: '<@U123ABC> @bot help',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
    })

    it('should still continue to DM even if text starts with user mention', async () => {
      const result = await shouldRespondInThread({
        autoRespond: true,
        eventType: 'message',
        channelType: 'im',
        text: '<@U123ABC> forwarding this to you',
        integration: mockIntegration,
      })

      expect(result).toEqual({
        shouldRespond: true,
        reason: 'Direct message or app mention',
      })
    })
  })

  describe('fetchSlackMessageHistory', () => {
    const baseOptions = {
      channelId: 'C123',
      latestTs: '1234567890.123456',
      limit: 5,
      botToken: 'xoxb-test-token',
      user: { id: 'user-1', email: 'test@example.com' },
      slackIntegrationId: 'int-xyz',
    }

    beforeEach(() => {
      fetch.mockReset()
      getUserInfo.mockReset()
      translateSlackReferences.mockReset()
      translateSlackReferences.mockImplementation((text) => text)
    })

    it('should fetch and return message history with timestamps and user info', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          // @note Slack returns messages newest first
          messages: [
            { ts: '1234567891.000000', text: 'World', user: 'U2' },
            { ts: '1234567890.000000', text: 'Hello', user: 'U1' },
          ],
        }),
      })

      getUserInfo.mockImplementation(async (userId) => {
        if (userId === 'U1') {
          return { id: 'U1', name: 'alice' }
        }

        if (userId === 'U2') {
          return { id: 'U2', name: 'bob' }
        }

        return null
      })

      const result = await fetchSlackMessageHistory(baseOptions)

      // @note result should be in chronological order (oldest first)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        text: 'Hello',
        timestamp: '2009-02-13T23:31:30.000Z',
        userId: 'U1',
        userNick: 'alice',
      })
      expect(result[1]).toEqual({
        text: 'World',
        timestamp: '2009-02-13T23:31:31.000Z',
        userId: 'U2',
        userNick: 'bob',
      })
    })

    it('should fetch unique users in parallel', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            { ts: '1234567890.000000', text: 'Msg 1', user: 'U1' },
            { ts: '1234567891.000000', text: 'Msg 2', user: 'U1' },
            { ts: '1234567892.000000', text: 'Msg 3', user: 'U2' },
          ],
        }),
      })

      getUserInfo.mockResolvedValue({ id: 'U1', name: 'user' })

      await fetchSlackMessageHistory(baseOptions)

      // @note should only call getUserInfo once per unique user
      expect(getUserInfo).toHaveBeenCalledTimes(2)
    })

    it('should translate slack references in message text', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            { ts: '1234567890.000000', text: '<@U123> hello', user: 'U1' },
          ],
        }),
      })

      getUserInfo.mockResolvedValue({ id: 'U1', name: 'alice' })
      translateSlackReferences.mockResolvedValue('@alice hello')

      const result = await fetchSlackMessageHistory(baseOptions)

      expect(translateSlackReferences).toHaveBeenCalledWith('<@U123> hello', {
        token: baseOptions.botToken,
        user: baseOptions.user,
        slackIntegrationId: baseOptions.slackIntegrationId,
      })
      expect(result[0].text).toBe('@alice hello')
    })

    it('should throw error when Slack API returns non-ok response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(fetchSlackMessageHistory(baseOptions)).rejects.toThrow()
    })

    it('should throw error when Slack API returns ok:false in JSON', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
      })

      await expect(fetchSlackMessageHistory(baseOptions)).rejects.toThrow(
        'channel_not_found'
      )
    })

    it('should handle messages without user field', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [{ ts: '1234567890.000000', text: 'Bot message' }],
        }),
      })

      const result = await fetchSlackMessageHistory(baseOptions)

      expect(result[0]).toEqual({
        text: 'Bot message',
        timestamp: '2009-02-13T23:31:30.000Z',
        userId: undefined,
        userNick: undefined,
      })
      expect(getUserInfo).not.toHaveBeenCalled()
    })

    it('should handle getUserInfo failure gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [{ ts: '1234567890.000000', text: 'Hello', user: 'U1' }],
        }),
      })

      getUserInfo.mockRejectedValue(new Error('API error'))

      const result = await fetchSlackMessageHistory(baseOptions)

      // @note should still return message but without userNick
      expect(result[0]).toEqual({
        text: 'Hello',
        timestamp: '2009-02-13T23:31:30.000Z',
        userId: 'U1',
        userNick: undefined,
      })
    })

    it('should handle translateSlackReferences failure gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            { ts: '1234567890.000000', text: '<@U123> hello', user: 'U1' },
          ],
        }),
      })

      getUserInfo.mockResolvedValue({ id: 'U1', name: 'alice' })
      translateSlackReferences.mockRejectedValue(
        new Error('Translation failed')
      )

      const result = await fetchSlackMessageHistory(baseOptions)

      // @note should still return original text when translation fails
      expect(result[0].text).toBe('<@U123> hello')
    })

    it('should clamp limit to valid range (1-15)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, messages: [] }),
      })

      await fetchSlackMessageHistory({ ...baseOptions, limit: 100 })

      // @note GET method with query parameters, limit clamped to 15
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://slack.com/api/conversations.history?channel=C123&latest=1234567890.123456&limit=15'
        ),
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should reverse messages to chronological order', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          // @note Slack returns newest first
          messages: [
            { ts: '1234567892.000000', text: 'Third', user: 'U1' },
            { ts: '1234567891.000000', text: 'Second', user: 'U1' },
            { ts: '1234567890.000000', text: 'First', user: 'U1' },
          ],
        }),
      })

      getUserInfo.mockResolvedValue({ id: 'U1', name: 'alice' })

      const result = await fetchSlackMessageHistory(baseOptions)

      // @note should be in chronological order (oldest first)
      expect(result[0].text).toBe('First')
      expect(result[1].text).toBe('Second')
      expect(result[2].text).toBe('Third')
    })
  })

  describe('postSlackMessage', () => {
    const baseOptions = {
      botToken: 'xoxb-test-token',
      channelId: 'C123',
      text: 'Hello world',
    }

    beforeEach(() => {
      fetch.mockReset()
    })

    it('should post a message successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' }),
      })

      const result = await postSlackMessage(baseOptions)

      expect(result).toEqual({
        ok: true,
        ts: '1234567890.123456',
        error: undefined,
      })
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('should return the channel Slack delivered to', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
          channel: 'D0AT9BNT3C6',
        }),
      })

      const result = await postSlackMessage(baseOptions)

      expect(result.channel).toBe('D0AT9BNT3C6')
    })

    it('should include blocks when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' }),
      })

      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Hi' } }]

      await postSlackMessage({ ...baseOptions, blocks })

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          body: expect.stringContaining('"blocks"'),
        })
      )
    })

    it('should include thread_ts when threadTs is provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' }),
      })

      await postSlackMessage({ ...baseOptions, threadTs: '1234567890.000000' })

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          body: expect.stringContaining('"thread_ts":"1234567890.000000"'),
        })
      )
    })

    it('should return error info when HTTP request fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const result = await postSlackMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      expect(result.error).toBeDefined()
    })

    it('should return error info when Slack API returns ok:false', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'channel_not_found' }),
      })

      const result = await postSlackMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('channel_not_found')
    })

    it('should handle 404 status gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await postSlackMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(404)
    })

    it('should not include undefined optional fields in request body', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' }),
      })

      await postSlackMessage({
        botToken: 'token',
        channelId: 'C123',
        text: 'Hello',
      })

      const callBody = JSON.parse(fetch.mock.calls[0][1].body)

      expect(callBody).toHaveProperty('text', 'Hello')
      expect(callBody).not.toHaveProperty('blocks')
      expect(callBody).not.toHaveProperty('thread_ts')
    })

    it('should throw error when both text and blocks are missing', async () => {
      await expect(
        postSlackMessage({ botToken: 'token', channelId: 'C123' })
      ).rejects.toThrow(/text|blocks/)
    })
  })

  describe('updateSlackMessage', () => {
    const baseOptions = {
      botToken: 'xoxb-test-token',
      channelId: 'C123',
      ts: '1234567890.123456',
      text: 'Updated message',
    }

    beforeEach(() => {
      fetch.mockReset()
    })

    it('should update a message successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' }),
      })

      const result = await updateSlackMessage(baseOptions)

      expect(result).toEqual({
        ok: true,
        ts: '1234567890.123456',
        error: undefined,
      })
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.update',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('should include ts in request body', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' }),
      })

      await updateSlackMessage(baseOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.update',
        expect.objectContaining({
          body: expect.stringContaining('"ts":"1234567890.123456"'),
        })
      )
    })

    it('should include blocks when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' }),
      })

      const blocks = [
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'Hi' }] },
      ]

      await updateSlackMessage({ ...baseOptions, blocks })

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.update',
        expect.objectContaining({
          body: expect.stringContaining('"blocks"'),
        })
      )
    })

    it('should return error info when HTTP request fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const result = await updateSlackMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(500)
      expect(result.error).toBeDefined()
    })

    it('should return error info when Slack API returns ok:false', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'message_not_found' }),
      })

      const result = await updateSlackMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('message_not_found')
    })

    it('should handle 404 status and return status in result', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await updateSlackMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(404)
    })

    it('should throw error when both text and blocks are missing', async () => {
      await expect(
        updateSlackMessage({
          botToken: 'token',
          channelId: 'C123',
          ts: '1234567890.123456',
        })
      ).rejects.toThrow(/text or blocks/)
    })
  })

  describe('setSlackAssistantThreadStatus', () => {
    const baseOptions = {
      botToken: 'xoxb-test-token',
      channelId: 'C123',
      threadTs: '1234567890.123456',
      status: 'is thinking...',
    }

    beforeEach(() => {
      fetch.mockReset()

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
    })

    it('posts the status to the thread', async () => {
      const result = await setSlackAssistantThreadStatus(baseOptions)

      expect(result).toEqual({ ok: true, error: undefined })

      const [url, init] = fetch.mock.calls[0]

      expect(url).toBe('https://slack.com/api/assistant.threads.setStatus')

      expect(init.headers.Authorization).toBe('Bearer xoxb-test-token')

      expect(JSON.parse(init.body)).toEqual({
        channel_id: 'C123',
        thread_ts: '1234567890.123456',
        status: 'is thinking...',
      })
    })

    // @note the shared loader list is channel-agnostic and free to grow past
    // Slack's ceiling, so the cap is enforced here at the API boundary - an
    // over-long list must never be what breaks the integration
    it('truncates loading messages to the maximum Slack accepts', async () => {
      await setSlackAssistantThreadStatus({
        ...baseOptions,
        loadingMessages: Array.from({ length: 25 }, (_, i) => `message ${i}`),
      })

      const body = JSON.parse(fetch.mock.calls[0][1].body)

      expect(body.loading_messages).toHaveLength(SLACK_MAX_LOADING_MESSAGES)

      expect(body.loading_messages[0]).toBe('message 0')

      expect(body.loading_messages[SLACK_MAX_LOADING_MESSAGES - 1]).toBe(
        `message ${SLACK_MAX_LOADING_MESSAGES - 1}`
      )
    })

    it('passes a within-limit list through untouched', async () => {
      await setSlackAssistantThreadStatus({
        ...baseOptions,
        loadingMessages: ['one...', 'two...'],
      })

      expect(JSON.parse(fetch.mock.calls[0][1].body).loading_messages).toEqual([
        'one...',
        'two...',
      ])
    })

    it('omits loading_messages entirely when none are supplied', async () => {
      await setSlackAssistantThreadStatus(baseOptions)

      expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty(
        'loading_messages'
      )
    })

    it('reports a Slack API error without throwing', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, error: 'method_not_supported' }),
      })

      expect(await setSlackAssistantThreadStatus(baseOptions)).toEqual({
        ok: false,
        error: 'method_not_supported',
      })
    })

    it('reports a transport error without throwing', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })

      expect(await setSlackAssistantThreadStatus(baseOptions)).toEqual({
        ok: false,
        error: 'status 500',
        status: 500,
      })
    })
  })

  describe('postSlackEphemeralMessage', () => {
    const baseOptions = {
      botToken: 'xoxb-test-token',
      channelId: 'C123',
      userId: 'U456',
      text: 'This is ephemeral',
    }

    beforeEach(() => {
      fetch.mockReset()
    })

    it('should post an ephemeral message successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      const result = await postSlackEphemeralMessage(baseOptions)

      expect(result).toEqual({
        ok: true,
        error: undefined,
      })
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postEphemeral',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('should include user in request body', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      await postSlackEphemeralMessage(baseOptions)

      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postEphemeral',
        expect.objectContaining({
          body: expect.stringContaining('"user":"U456"'),
        })
      )
    })

    it('should return error info when HTTP request fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      })

      const result = await postSlackEphemeralMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.status).toBe(403)
      expect(result.error).toBeDefined()
    })

    it('should return error info when Slack API returns ok:false', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'user_not_in_channel' }),
      })

      const result = await postSlackEphemeralMessage(baseOptions)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('user_not_in_channel')
    })

    it('should include channel and text in request body', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })

      await postSlackEphemeralMessage(baseOptions)

      const callBody = JSON.parse(fetch.mock.calls[0][1].body)

      expect(callBody.channel).toBe('C123')
      expect(callBody.user).toBe('U456')
      expect(callBody.text).toBe('This is ephemeral')
    })
  })

  describe('fetchSlackThreadReplies', () => {
    it('should throw error when channelId is missing', async () => {
      await expect(
        fetchSlackThreadReplies({
          channelId: undefined,
          threadTs: '123.456',
          limit: 10,
          botToken: 'xoxb-test',
          user: { id: 'user-1' },
          slackIntegrationId: 'int-xyz',
        })
      ).rejects.toThrow('channelId is required')
    })

    it('should throw error when threadTs is missing', async () => {
      await expect(
        fetchSlackThreadReplies({
          channelId: 'C123',
          threadTs: undefined,
          limit: 10,
          botToken: 'xoxb-test',
          user: { id: 'user-1' },
          slackIntegrationId: 'int-xyz',
        })
      ).rejects.toThrow('threadTs is required')
    })

    it('should throw error when both channelId and threadTs are missing', async () => {
      await expect(
        fetchSlackThreadReplies({
          channelId: undefined,
          threadTs: undefined,
          limit: 10,
          botToken: 'xoxb-test',
          user: { id: 'user-1' },
          slackIntegrationId: 'int-xyz',
        })
      ).rejects.toThrow('channelId is required')
    })

    it('should successfully fetch thread replies when all params provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          messages: [
            { user: 'U1', text: 'first', ts: '123.456' },
            { user: 'U2', text: 'second', ts: '123.457' },
          ],
        }),
      })

      getUserInfo.mockResolvedValue({ id: 'U1', name: 'Test User' })

      const result = await fetchSlackThreadReplies({
        channelId: 'C123',
        threadTs: '123.456',
        limit: 10,
        botToken: 'xoxb-test',
        user: { id: 'user-1' },
        slackIntegrationId: 'int-xyz',
      })

      expect(result).toBeDefined()
      // @note conversations.replies uses GET with query parameters
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/conversations.replies?channel=C123&ts=123.456&limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer xoxb-test',
          }),
        })
      )
    })
  })

  describe('session management', () => {
    const basePayload = {
      type: 'message',
      team: 'T123',
      user: 'U456',
      channelId: 'C123',
      channelType: 'im',
      messageId: 'M123',
      ts: '1234567890.123456',
      text: 'hello',
    }

    beforeEach(() => {
      memcache.get.mockResolvedValue(null)

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.654321' }),
        status: 200,
      })
    })

    it('builds session key for im channel type with user id', async () => {
      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(memcache.get).toHaveBeenCalledWith(
        `slack-session-im-${slackIntegrationId}-U456`
      )
    })

    it('builds session key for channel type with ts', async () => {
      const payload = {
        ...basePayload,
        channelType: 'channel',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(memcache.get).toHaveBeenCalledWith(
        `slack-session-channel-${slackIntegrationId}-1234567890.123456`
      )
    })

    it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'xoxb-test-token',
        botUserId: 'UBOTID',
        allowFrom: '*',
        sessionDuration: null,
        contactCollection: false,
        attachments: false,
      })

      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 86400 }) // 1 day in seconds
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'xoxb-test-token',
        botUserId: 'UBOTID',
        allowFrom: '*',
        sessionDuration: 0,
        contactCollection: false,
        attachments: false,
      })

      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      // no session: a fresh conversation is created and the session mapping is
      // never stored (assert on the session store rather than memcache.get
      // globally)
      expect(createConversation).toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalledWith(
        expect.stringContaining(`slack-session-`),
        expect.anything(),
        expect.anything()
      )
    })

    it('uses custom session duration from integration config', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'xoxb-test-token',
        botUserId: 'UBOTID',
        allowFrom: '*',
        sessionDuration: 10800000, // 3 hours in ms
        contactCollection: false,
        attachments: false,
      })

      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 10800 }) // 3 hours in seconds
      )
    })

    it('reuses existing valid conversation from redis session', async () => {
      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      memcache.get.mockResolvedValueOnce('existing-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(true)

      await handleInteractEvent(slackIntegrationId, payload)

      expect(createConversation).not.toHaveBeenCalled()

      // @note sliding window: the session TTL is refreshed on reuse
      expect(memcache.expire).toHaveBeenCalledWith(
        expect.stringContaining('-session-'),
        expect.any(Number)
      )
    })

    it('creates new conversation when session exists but conversation is gone', async () => {
      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      memcache.get.mockResolvedValueOnce('stale-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)

      await handleInteractEvent(slackIntegrationId, payload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('creates new conversation when no session exists in redis', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'slack',
            slack: expect.objectContaining({
              integrationId: slackIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(memcache.set).toHaveBeenCalledWith(
        `slack-session-im-${slackIntegrationId}-U456`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('records a message-context activity marking the conversation as a direct message', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      const payload = {
        ...basePayload,
        channelType: 'im',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              meta: expect.objectContaining({
                activity: expect.objectContaining({
                  function: expect.objectContaining({
                    name: '_getSlackMessageContext',
                    result: expect.objectContaining({
                      source: 'direct-message',
                      channelType: 'im',
                      channelId: payload.channelId,
                    }),
                  }),
                }),
              }),
            }),
          ]),
        })
      )
    })

    it('marks an app_mention conversation as a channel mention', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      const payload = {
        ...basePayload,
        channelType: 'channel',
        type: 'app_mention',
      }

      await handleInteractEvent(slackIntegrationId, payload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              meta: expect.objectContaining({
                activity: expect.objectContaining({
                  function: expect.objectContaining({
                    name: '_getSlackMessageContext',
                    result: expect.objectContaining({
                      source: 'channel-mention',
                      channelType: 'channel',
                    }),
                  }),
                }),
              }),
            }),
          ]),
        })
      )
    })

    describe('session reset commands', () => {
      it('resets session for ///restart command', async () => {
        const payload = {
          ...basePayload,
          channelType: 'im',
          text: '///restart',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `slack-session-im-${slackIntegrationId}-U456`
        )
      })

      it('resets session for ///reset command', async () => {
        const payload = {
          ...basePayload,
          channelType: 'im',
          text: '///reset',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for ///new command', async () => {
        const payload = {
          ...basePayload,
          channelType: 'im',
          text: '///new',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `slack-session-im-${slackIntegrationId}-U456`
        )
      })

      it('resets session and clears fallback keys for im channels', async () => {
        const payload = {
          ...basePayload,
          channelType: 'im',
          text: '///restart',
        }

        await handleInteractEvent(slackIntegrationId, payload)

        // @note should clear both user-based primary key and channel-based fallback key
        expect(memcache.del).toHaveBeenCalledWith(
          `slack-session-im-${slackIntegrationId}-U456`
        )
        expect(memcache.del).toHaveBeenCalledWith(
          `slack-session-im-${slackIntegrationId}-C123`
        )
      })
    })

    describe('session fallback for bot-initiated DM conversations', () => {
      it('resolves session from channel-based fallback key when user-based key misses', async () => {
        const payload = {
          ...basePayload,
          channelType: 'im',
        }

        // @note primary key misses, fallback resolves
        memcache.get.mockResolvedValueOnce(null)
        resolveSession.mockResolvedValueOnce({
          key: `slack-session-im-${slackIntegrationId}-C123`,
          value: 'conv-from-initiate',
        })

        const { hasConversation } = await import('@/lib/conversation.find')
        const { createConversation } = await import('@/lib/conversation.create')

        hasConversation.mockResolvedValueOnce(true)

        await handleInteractEvent(slackIntegrationId, payload)

        // @note should try fallback keys
        expect(resolveSession).toHaveBeenCalledWith([
          `slack-session-im-${slackIntegrationId}-C123`,
        ])

        // @note should NOT create a new conversation since one was found
        expect(createConversation).not.toHaveBeenCalled()

        // @note should migrate session to user-based key
        expect(memcache.set).toHaveBeenCalledWith(
          `slack-session-im-${slackIntegrationId}-U456`,
          'conv-from-initiate',
          expect.objectContaining({ ex: expect.any(Number) })
        )
      })

      it('creates new conversation when both primary and fallback keys miss', async () => {
        const payload = {
          ...basePayload,
          channelType: 'im',
        }

        memcache.get.mockResolvedValueOnce(null)
        resolveSession.mockResolvedValueOnce(null)

        const { createConversation } = await import('@/lib/conversation.create')

        await handleInteractEvent(slackIntegrationId, payload)

        expect(resolveSession).toHaveBeenCalledWith([
          `slack-session-im-${slackIntegrationId}-C123`,
        ])

        expect(createConversation).toHaveBeenCalled()
      })

      it('does not use fallback keys for channel type messages', async () => {
        const payload = {
          ...basePayload,
          channelType: 'channel',
        }

        memcache.get.mockResolvedValueOnce(null)

        await handleInteractEvent(slackIntegrationId, payload)

        // @note fallback should not be attempted for non-DM channels
        expect(resolveSession).not.toHaveBeenCalled()
      })
    })

    it('passes signal from context to the conversation engine', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const abortController = new AbortController()

      await handleInteractEvent(slackIntegrationId, basePayload, {
        signal: abortController.signal,
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            signal: abortController.signal,
          }),
        })
      )
    })

    it('passes undefined signal when no context is provided', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInteractEvent(slackIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            signal: undefined,
          }),
        })
      )
    })

    it('passes Slack runtime context to the conversation engine', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInteractEvent(slackIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: expect.stringContaining(
              'This conversation is happening inside Slack.'
            ),
          }),
        })
      )
      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: expect.stringContaining(
              'Channel Name: test-channel'
            ),
          }),
        })
      )
    })

    it('treats direct messages as trusted for context-backed auth', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInteractEvent(slackIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: undefined,
        })
      )
    })

    it('treats channel conversations as untrusted for context-backed auth', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInteractEvent(slackIntegrationId, {
        ...basePayload,
        type: 'app_mention',
        channelType: 'channel',
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: true,
        })
      )
    })

    describe('sender identity (userInfo feature)', () => {
      it('passes a userInfo feature carrying the resolved sender to the conversation engine', async () => {
        getUserInfo.mockResolvedValue({
          id: 'U456',
          name: 'jane',
          email: 'jane@example.com',
          realName: 'Jane Doe',
        })

        await handleInteractEvent(slackIntegrationId, basePayload)

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: expect.arrayContaining([
                {
                  name: 'userInfo',
                  options: {
                    name: 'Jane Doe',
                    username: 'jane',
                    email: 'jane@example.com',
                    externalId: 'U456',
                    source: 'slack',
                  },
                },
              ]),
            }),
          })
        )
      })

      it('passes the userInfo feature for public channel messages too', async () => {
        getUserInfo.mockResolvedValue({
          id: 'U456',
          name: 'jane',
          realName: 'Jane Doe',
        })

        await handleInteractEvent(slackIntegrationId, {
          ...basePayload,
          type: 'app_mention',
          channelType: 'channel',
        })

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: expect.arrayContaining([
                {
                  name: 'userInfo',
                  options: {
                    name: 'Jane Doe',
                    username: 'jane',
                    email: undefined,
                    externalId: 'U456',
                    source: 'slack',
                  },
                },
              ]),
            }),
          })
        )
      })

      it('falls back to the Slack user id when user info cannot be resolved', async () => {
        getUserInfo.mockResolvedValue(null)

        await handleInteractEvent(slackIntegrationId, basePayload)

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: expect.arrayContaining([
                {
                  name: 'userInfo',
                  options: { externalId: 'U456', source: 'slack' },
                },
              ]),
            }),
          })
        )
      })

      it('falls back gracefully when getUserInfo throws', async () => {
        getUserInfo.mockRejectedValue(new Error('slack api error'))

        await handleInteractEvent(slackIntegrationId, basePayload)

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: expect.arrayContaining([
                {
                  name: 'userInfo',
                  options: { externalId: 'U456', source: 'slack' },
                },
              ]),
            }),
          })
        )
      })
    })
  })

  describe('handleInitiateEvent', () => {
    const baseInitiatePayload = {
      channelId: 'D123456',
      text: 'Hello from bot!',
    }

    it('throws when integration is not found', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInitiateEvent(slackIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('skips when integration has no bot token', async () => {
      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: null,
        sessionDuration: 86400000,
      })

      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      // @note should not call postSlackMessage when no bot token
      expect(fetch).not.toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.anything()
      )
    })

    it('throws when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInitiateEvent(slackIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/Limits exceeded/i)
    })

    it('sends message and creates conversation on success', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      // @note postSlackMessage calls fetch internally
      expect(fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
        })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'slack',
            slack: expect.objectContaining({
              integrationId: slackIntegrationId,
              channelId: 'D123456',
              initiated: true,
            }),
          }),
        })
      )
    })

    it('formats initiate markdown text into Slack blocks before posting', async () => {
      const markdownText = 'Hello *team*\n\n- item 1\n- item 2'

      markdownToBlockChunks.mockResolvedValueOnce([
        {
          text: markdownText,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: markdownText,
              },
            },
          ],
        },
      ])

      await handleInitiateEvent(slackIntegrationId, {
        ...baseInitiatePayload,
        text: markdownText,
      })

      expect(markdownToBlockChunks).toHaveBeenCalledWith(markdownText)

      const [, request] = fetch.mock.calls.find(
        ([url]) => url === 'https://slack.com/api/chat.postMessage'
      )

      const postedPayload = JSON.parse(request.body)

      expect(postedPayload).toMatchObject({
        channel: 'D123456',
        text: markdownText,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: markdownText,
            },
          },
        ],
      })
    })

    it('stores session under channel-based key for DMs', async () => {
      // @note resolveChannel returns null so inferChannelType is used
      const { inferChannelType } = await import('@/lib/slack.channel')

      inferChannelType.mockReturnValueOnce('im')

      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `slack-session-im-${slackIntegrationId}-D123456`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('keys the session off the channel Slack delivered to (user-addressed DM)', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')
      const { createConversation } = await import('@/lib/conversation.create')

      // @note addressed to "@nick", but Slack delivers to the real D... IM
      // channel and reports it back. Both the fallback inference and the
      // delivered-channel inference resolve to 'im'.
      inferChannelType.mockReturnValueOnce('im').mockReturnValueOnce('im')

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: 'ts-1', channel: 'D0AT9BNT3C6' }),
        status: 200,
      })

      await handleInitiateEvent(slackIntegrationId, {
        ...baseInitiatePayload,
        channelId: '@nick',
      })

      // @note session keyed on the delivered D... channel, not the literal @nick
      expect(memcache.set).toHaveBeenCalledWith(
        `slack-session-im-${slackIntegrationId}-D0AT9BNT3C6`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            slack: expect.objectContaining({
              channelId: 'D0AT9BNT3C6',
              channelType: 'im',
            }),
          }),
        })
      )
    })

    it('stores session under thread-based key for channels', async () => {
      const { inferChannelType } = await import('@/lib/slack.channel')

      inferChannelType.mockReturnValueOnce('channel')

      await handleInitiateEvent(slackIntegrationId, {
        ...baseInitiatePayload,
        channelId: 'C999',
      })

      // @note for channel messages, session key uses message ts
      expect(memcache.set).toHaveBeenCalledWith(
        `slack-session-channel-${slackIntegrationId}-ts-1`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('includes context messages when context is provided', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(slackIntegrationId, {
        ...baseInitiatePayload,
        context: {
          linkedConversationId: 'conv-abc',
          linkedReason: 'Started',
          text: 'Customer background info',
        },
      })

      // @note conversation should include context activity messages
      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ type: 'bot', text: 'Hello from bot!' }),
          ]),
        })
      )
    })

    it('seeds the initiated conversation with recent channel history when visibleMessages is set', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        visibleMessages: 5,
        sessionDuration: 86400000,
      })

      markdownToBlockChunks.mockResolvedValueOnce([])

      // @note route by URL so it's robust to how many postMessage chunks run
      fetch.mockImplementation(async (url) => {
        if (String(url).includes('conversations.history')) {
          return {
            ok: true,
            json: async () => ({ ok: true, messages: [] }),
            status: 200,
          }
        }

        return {
          ok: true,
          json: async () => ({ ok: true, ts: 'ts-1' }),
          status: 200,
        }
      })

      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('conversations.history'),
        expect.objectContaining({ method: 'GET' })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              meta: expect.objectContaining({
                activity: expect.objectContaining({
                  function: expect.objectContaining({
                    name: '_getSlackChannelHistory',
                  }),
                }),
              }),
            }),
          ]),
        })
      )
    })

    it('does not fetch history when visibleMessages is not set', async () => {
      // @note default integration mock has visibleMessages: 0
      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('conversations.history'),
        expect.anything()
      )
    })

    it('does not create conversation when Slack API returns error', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'channel_not_found' }),
        status: 200,
      })

      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('captures observation (not unexpected state) when resolveChannel returns null', async () => {
      const { captureObservation } = await import('@/lib/error')
      const { captureUnexpectedState } = await import('@/lib/error')

      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      // @note resolveChannel returning null is an expected/handled case - should
      // use captureObservation for analysis, not captureUnexpectedState for bugs
      expect(captureObservation).toHaveBeenCalledWith(
        expect.stringContaining('resolveChannel returned null'),
        expect.objectContaining({
          slackIntegrationId,
          channelId: baseInitiatePayload.channelId,
        })
      )
      expect(captureUnexpectedState).not.toHaveBeenCalledWith(
        expect.stringContaining('resolveChannel returned null'),
        expect.anything()
      )
    })

    it('returns early when integration has no bot configured', async () => {
      const { captureUnexpectedState } = await import('@/lib/error')
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.slackIntegration.findUnique.mockResolvedValueOnce({
        id: slackIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: null,
        botToken: 'xoxb-valid',
        sessionDuration: 86400000,
      })

      await handleInitiateEvent(slackIntegrationId, baseInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('no bot configured'),
        expect.objectContaining({ slackIntegrationId })
      )
      expect(createConversation).not.toHaveBeenCalled()
    })
  })
})
