/**
 * @jest-environment node
 */
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { getMetaUserInfo } from '@/lib/meta.user'
import queue from '@/lib/queue'
import memcache from '@/lib/memcache'
import { parseAsync } from '@/lib/zod.schema'

import {
  INITIATE_EVENT_TYPE,
  INSTAGRAM_CONTACT_NAMESPACE,
  INTERACT_EVENT_TYPE,
  InteractPayloadSchema,
  META_GRAPH_API_VERSION,
  META_PAGE_INBOX_APP_ID,
  handleInitiateEvent,
  handleInteractEvent,
  sendEvent,
} from '@/pages/api/v1/integration/instagram/[instagramIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    instagramIntegration: { findUnique: jest.fn() },
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
    fetchPlusPlus: fetch,
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
    captureUnexpectedState: jest.fn(),
  }
})

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

jest.mock('@/lib/meta.user', () => ({
  __esModule: true,
  META_GRAPH_API_VERSION: 'v21.0',
  getMetaUserInfo: jest.fn(),
}))

jest.mock('@/lib/job', () => ({ runTasks: jest.fn(async () => undefined) }))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
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
    addMessages: jest.fn(async () => undefined),
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

jest.mock('@/lib/instagram.markdown', () => ({
  markdownToMessages: jest.fn(async (text) => [{ text: { body: text } }]),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  uploadConversationAttachmentFromURL: jest.fn(async () => ({
    attachmentId: 'att-1',
    name: 'image.jpg',
    type: 'image/jpeg',
  })),
  makeConversationAttachmentUploadActivityMessages: jest.fn(() => ({
    request: { type: 'activity', text: 'uploading' },
    response: { type: 'activity', text: 'uploaded' },
  })),
}))

jest.mock('@/lib/user.limits', () => ({
  // @note 5MB - the account plan's attachment cap. The queue must forward this
  // as `maxSize` to the upload, otherwise the shared guard defaults to 0 and
  // rejects every file (the bug this suite regression-tests).
  getMaxFileSize: jest.fn(async () => 5 * 1024 * 1024),
}))

describe('Instagram queue module', () => {
  const instagramIntegrationId = 'int-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.instagramIntegration.findUnique.mockResolvedValue({
      id: instagramIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      pageId: 'page-123',
      accessToken: 'access-token-xyz',
      sessionDuration: 86400000,
      contactCollection: false,
      attachments: false,
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)

    fetch.mockReset()

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recipient_id: 'sender-1', message_id: 'msg-1' }),
      status: 200,
    })

    // @note reset so the sender lookup returns undefined by default; tests that
    // need a resolved name set it explicitly
    getMetaUserInfo.mockReset()

    parseAsync.mockResolvedValue(undefined)
  })

  describe('constants and exports', () => {
    it('exports INSTAGRAM_CONTACT_NAMESPACE as a valid UUID', () => {
      expect(INSTAGRAM_CONTACT_NAMESPACE).toBe(
        '7e8f92a3-c4d5-4b6e-9f1a-2b3c4d5e6f7a'
      )
    })

    it('exports INTERACT_EVENT_TYPE constant', () => {
      expect(INTERACT_EVENT_TYPE).toBe('interact')
    })

    it('exports INITIATE_EVENT_TYPE constant', () => {
      expect(INITIATE_EVENT_TYPE).toBe('initiate')
    })

    it('exports META_GRAPH_API_VERSION constant', () => {
      expect(META_GRAPH_API_VERSION).toBe('v21.0')
    })

    it('exports META_PAGE_INBOX_APP_ID constant', () => {
      expect(META_PAGE_INBOX_APP_ID).toBe('263902037430900')
    })

    it('exports InteractPayloadSchema as a Zod schema', () => {
      expect(InteractPayloadSchema).toBeDefined()
      expect(InteractPayloadSchema.parse).toBeDefined()
    })
  })

  describe('sendEvent', () => {
    it('enqueues interact event', async () => {
      const payload = {
        sender: { id: 'sender-1' },
        recipient: { id: 'recipient-1' },
        timestamp: 1234567890,
        message: { mid: 'msg-123', text: 'hello' },
      }

      await sendEvent(instagramIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/instagram/${instagramIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.any(Object)
      )
    })

    it('allocates a per-sender order, nudges, and serializes interact dispatch', async () => {
      const { publishChannelMessage } = await import('@/lib/channel.session')

      const sessionKey = `instagram-session-${instagramIntegrationId}-sender-1`

      const payload = {
        sender: { id: 'sender-1' },
        recipient: { id: 'recipient-1' },
        timestamp: 1234567890,
        message: { mid: 'msg-123', text: 'hello' },
      }

      await sendEvent(instagramIntegrationId, {
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

      // @note dispatch now serialized per sender (was unserialized before)
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/instagram/${instagramIntegrationId}/queue`,
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        { flow: { key: sessionKey, parallel: 1 } }
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(instagramIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })

    it('enqueues initiate event', async () => {
      const payload = {
        instagramUserId: 'ig-user-123',
        recipientId: 'recipient-123',
        text: 'hello',
      }

      await sendEvent(instagramIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/instagram/${instagramIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload },
        {}
      )
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      sender: { id: 'sender-1' },
      recipient: { id: 'recipient-1' },
      timestamp: 1234567890,
      message: { mid: 'msg-123', text: 'hello' },
    }

    it('skips generation when superseded before generation', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(async () => undefined),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        addMessages: jest.fn(async () => undefined),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      // @note the supersede marker (…-latest) reports a newer order (5) than
      // this turn's (3); conversation lookups return null → fresh conversation.
      memcache.get.mockImplementation(async (key) =>
        typeof key === 'string' && key.endsWith('-latest') ? '5' : null
      )

      await handleInteractEvent(instagramIntegrationId, {
        ...basePayload,
        order: 3,
      })

      // @note message still appended, but generation is skipped.
      expect(mockEngine.send).toHaveBeenCalled()
      expect(mockEngine.receive).not.toHaveBeenCalled()
    })

    it('throws when integration is not found', async () => {
      prisma.instagramIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(instagramIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('posts the pre-canned limits reply and does not throw when conversational limits are exceeded', async () => {
      // @note over-limit no longer throws for the reactive path: the handler
      // posts a visible pre-canned reply via the Instagram Send API and returns.
      // basePayload carries credentials so the handler reaches the limit check,
      // consuming the once-mock (otherwise it would leak into a later test).
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInteractEvent(instagramIntegrationId, basePayload)
      ).resolves.toBeUndefined()

      const limitReplyCalls = fetch.mock.calls.filter(([url, init]) => {
        if (!String(url).includes('graph.facebook.com')) {
          return false
        }

        return String(init?.body).includes(messages.limitsReachedReply)
      })

      expect(limitReplyCalls).toHaveLength(1)
    })

    describe('session reset commands', () => {
      it('resets session for /restart command', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-123', text: '/restart' },
        }

        await handleInteractEvent(instagramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `instagram-session-${instagramIntegrationId}-sender-1`
        )
      })

      it('resets session for /reset command', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-123', text: '/reset' },
        }

        await handleInteractEvent(instagramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for /new command', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-123', text: '/new' },
        }

        await handleInteractEvent(instagramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles case insensitive reset commands', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-123', text: '/RESTART' },
        }

        await handleInteractEvent(instagramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles reset commands with whitespace', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-123', text: '  /restart  ' },
        }

        await handleInteractEvent(instagramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })
    })

    describe('session management - conversation creation', () => {
      it('creates new conversation when no session exists in redis', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            meta: expect.objectContaining({
              app: 'instagram',
              instagram: expect.objectContaining({
                integrationId: instagramIntegrationId,
              }),
            }),
          })
        )
      })

      it('stores session in redis after creating conversation', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          `instagram-session-${instagramIntegrationId}-sender-1`,
          'conv-1',
          expect.objectContaining({ ex: expect.any(Number) })
        )
      })

      it('uses custom session duration from integration config', async () => {
        const customDuration = 3600000 // 1 hour in ms

        prisma.instagramIntegration.findUnique.mockResolvedValueOnce({
          id: instagramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          pageId: 'page-123',
          accessToken: 'access-token-xyz',
          sessionDuration: customDuration,
          contactCollection: false,
          attachments: false,
        })

        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          expect.any(String),
          'conv-1',
          expect.objectContaining({ ex: 3600 }) // 1 hour in seconds
        )
      })

      it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
        prisma.instagramIntegration.findUnique.mockResolvedValueOnce({
          id: instagramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          pageId: 'page-123',
          accessToken: 'access-token-xyz',
          sessionDuration: null,
          contactCollection: false,
          attachments: false,
        })

        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          expect.any(String),
          'conv-1',
          expect.objectContaining({ ex: 86400 }) // 1 day in seconds
        )
      })

      it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
        const { createConversation } = await import('@/lib/conversation.create')

        prisma.instagramIntegration.findUnique.mockResolvedValueOnce({
          id: instagramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          pageId: 'page-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 0,
          contactCollection: false,
          attachments: false,
        })

        await handleInteractEvent(instagramIntegrationId, basePayload)

        // no session: every event starts a fresh conversation
        expect(memcache.get).not.toHaveBeenCalled()
        expect(memcache.set).not.toHaveBeenCalled()
        expect(createConversation).toHaveBeenCalled()
      })

      it('reuses existing conversation from session', async () => {
        memcache.get.mockResolvedValue('existing-conv-1')

        const { hasConversation } = await import('@/lib/conversation.find')

        hasConversation.mockResolvedValue(true)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).not.toHaveBeenCalled()
      })

      it('creates new conversation if session exists but conversation is gone', async () => {
        memcache.get.mockResolvedValue('old-conv-1')

        const { hasConversation } = await import('@/lib/conversation.find')

        hasConversation.mockResolvedValue(false)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).toHaveBeenCalled()
      })

      it('builds session key using integration id and sender id', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        expect(memcache.get).toHaveBeenCalledWith(
          `instagram-session-${instagramIntegrationId}-sender-1`
        )
      })
    })

    describe('session management - contact collection', () => {
      it('creates contact when contactCollection is enabled', async () => {
        prisma.instagramIntegration.findUnique.mockResolvedValueOnce({
          id: instagramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          pageId: 'page-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: true,
          attachments: false,
        })

        getMetaUserInfo.mockResolvedValueOnce({
          name: 'Test User',
          username: 'testuser',
        })

        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).toHaveBeenCalled()
      })

      it('does not create contact when contactCollection is disabled', async () => {
        prisma.instagramIntegration.findUnique.mockResolvedValueOnce({
          id: instagramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          pageId: 'page-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: false,
        })

        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).not.toHaveBeenCalled()
      })

      it('surfaces the resolved sender name even when contact collection is disabled', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const { ensureTrustedContact } = await import('@/lib/contact.create')

        // @note contactCollection is disabled (default integration mock), yet
        // the name is still resolved on every turn and surfaced via the
        // userInfo feature - without persisting a contact
        getMetaUserInfo.mockResolvedValue({
          name: 'Jane Doe',
          username: 'janedoe',
        })

        await handleInteractEvent(instagramIntegrationId, basePayload)

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: expect.arrayContaining([
                {
                  name: 'userInfo',
                  options: {
                    name: 'Jane Doe',
                    username: 'janedoe',
                    externalId: 'sender-1',
                    source: 'instagram',
                  },
                },
              ]),
            }),
          })
        )
        expect(ensureTrustedContact).not.toHaveBeenCalled()
      })
    })

    describe('text message handling', () => {
      it('processes text messages', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest
            .fn()
            .mockResolvedValue({ text: 'response', messages: [] }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        await handleInteractEvent(instagramIntegrationId, basePayload)

        expect(mockEngine.send).toHaveBeenCalledWith('hello')
      })

      it('skips sending when message text is empty', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest
            .fn()
            .mockResolvedValue({ text: 'response', messages: [] }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        const payload = {
          ...basePayload,
          message: { mid: 'msg-123', text: '' },
        }

        await handleInteractEvent(instagramIntegrationId, payload)

        expect(mockEngine.send).not.toHaveBeenCalled()
      })

      it('processes attachment-only messages and still generates a response', async () => {
        prisma.instagramIntegration.findUnique.mockResolvedValueOnce({
          id: instagramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          pageId: 'page-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
        })

        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest
            .fn()
            .mockResolvedValue({ text: 'response', messages: [] }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        const payload = {
          ...basePayload,
          message: {
            mid: 'msg-123',
            attachments: [
              {
                type: 'image',
                payload: { url: 'https://cdn.instagram.com/attachment.jpg' },
              },
            ],
          },
        }

        await handleInteractEvent(instagramIntegrationId, payload)

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: [
                {
                  name: 'userInfo',
                  options: { externalId: 'sender-1', source: 'instagram' },
                },
                { name: 'timeoutMarks' },
                { name: 'auth' },
                { name: 'time' },
                { name: 'attachments' },
              ],
            }),
          })
        )

        // @note the plan limit is resolved from the integration's user and
        // forwarded as `maxSize`; without it the upload throws "Attachment is
        // too large" (LIMITS_REACHED) and the attachment-only message is
        // dropped with no reply.
        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )
        const { getMaxFileSize } = await import('@/lib/user.limits')

        expect(getMaxFileSize).toHaveBeenCalledWith({
          id: 'user-1',
          name: 'Test',
        })
        expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
          expect.any(String),
          'https://cdn.instagram.com/attachment.jpg',
          undefined,
          { maxSize: 5 * 1024 * 1024 }
        )
        expect(mockEngine.addMessages).toHaveBeenCalled()
        expect(mockEngine.receive).toHaveBeenCalled()
      })
    })

    describe('postback handling', () => {
      it('handles GET_STARTED postback by sending welcome message', async () => {
        const postbackPayload = {
          sender: { id: 'sender-1' },
          recipient: { id: 'recipient-1' },
          timestamp: 1234567890,
          postback: { title: 'Get Started', payload: 'GET_STARTED' },
        }

        // GET_STARTED returns early after sending welcome message
        await handleInteractEvent(instagramIntegrationId, postbackPayload)

        // Should have called fetch to send welcome message
        expect(fetch).toHaveBeenCalled()
      })

      it('handles HUMAN_AGENT postback by transferring to human agent', async () => {
        const postbackPayload = {
          sender: { id: 'sender-1' },
          recipient: { id: 'recipient-1' },
          timestamp: 1234567890,
          postback: { title: 'Human Agent', payload: 'HUMAN_AGENT' },
        }

        await handleInteractEvent(instagramIntegrationId, postbackPayload)

        // Should have called fetch to transfer conversation
        expect(fetch).toHaveBeenCalled()
      })

      it('does not transfer thread control for unknown postback payloads', async () => {
        const postbackPayload = {
          sender: { id: 'sender-1' },
          recipient: { id: 'recipient-1' },
          timestamp: 1234567890,
          postback: { title: 'Help', payload: 'SHOW_HELP' },
        }

        await handleInteractEvent(instagramIntegrationId, postbackPayload)

        const passThreadControlCalls = fetch.mock.calls.filter(([url]) =>
          String(url).includes('pass_thread_control')
        )

        expect(passThreadControlCalls).toHaveLength(0)
      })
    })
  })

  describe('handleInitiateEvent', () => {
    const basePayload = {
      instagramUserId: 'ig-user-123',
      recipientId: 'recipient-123',
      text: 'Hello from Instagram',
    }

    it('throws when integration is not found', async () => {
      prisma.instagramIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInitiateEvent(instagramIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('throws when integration has no access token', async () => {
      prisma.instagramIntegration.findUnique.mockResolvedValueOnce({
        id: instagramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: null,
        sessionDuration: 0,
      })

      await expect(
        handleInitiateEvent(instagramIntegrationId, basePayload)
      ).rejects.toThrow(/not configured/i)
    })

    it('throws when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInitiateEvent(instagramIntegrationId, basePayload)
      ).rejects.toThrow(/Limits exceeded/i)
    })

    it('sends message to Instagram API and creates conversation', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(instagramIntegrationId, basePayload)

      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/ig-user-123/messages?access_token=access-token-xyz',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"recipient":{"id":"recipient-123"}'),
        })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'instagram',
            instagram: expect.objectContaining({
              integrationId: instagramIntegrationId,
              instagramUserId: 'ig-user-123',
              recipientId: 'recipient-123',
              initiated: true,
            }),
          }),
        })
      )
    })

    it('stores session under recipient-based key', async () => {
      await handleInitiateEvent(instagramIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `instagram-session-${instagramIntegrationId}-recipient-123`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('does not create conversation when Instagram API returns error', async () => {
      const { createConversation } = await import('@/lib/conversation.create')
      const { logEvent } = await import('@/lib/log')

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })

      await handleInitiateEvent(instagramIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.instagram.api.error',
          name: 'Instagram Initiate Message Error',
          meta: expect.objectContaining({
            operation: 'messages.create',
            instagramUserId: 'ig-user-123',
            recipientId: 'recipient-123',
            error: expect.objectContaining({
              message: expect.stringContaining('status 400'),
            }),
          }),
        })
      )
    })
  })
})
