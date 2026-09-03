/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

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
  INTERACT_EVENT_TYPE,
  InteractPayloadSchema,
  MESSENGER_CONTACT_NAMESPACE,
  handleInitiateEvent,
  handleInteractEvent,
  sendEvent,
} from '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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

jest.mock('@/lib/meta.user', () => ({
  __esModule: true,
  META_GRAPH_API_VERSION: 'v21.0',
  getMetaUserInfo: jest.fn(),
}))

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

jest.mock('@/lib/messenger.markdown', () => ({
  markdownToMessages: jest.fn(async (text) => [
    { type: 'text', text: { body: text } },
  ]),
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

describe('Messenger queue module', () => {
  const messengerIntegrationId = 'int-xyz'

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()

    prisma.messengerIntegration.findUnique.mockResolvedValue({
      id: messengerIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      accessToken: 'access-token-xyz',
      verifyToken: 'verify-token',
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
      json: async () => ({ message_id: 'msg-response-1' }),
      status: 200,
    })

    // @note reset so the sender lookup returns undefined by default; tests that
    // need a resolved name set it explicitly
    getMetaUserInfo.mockReset()

    parseAsync.mockResolvedValue(undefined)
  })

  describe('constants and exports', () => {
    it('exports MESSENGER_CONTACT_NAMESPACE as a valid UUID', () => {
      expect(MESSENGER_CONTACT_NAMESPACE).toBe(
        '44df431b-dfbb-4d9f-9041-d6ed06bae475'
      )
    })

    it('exports INTERACT_EVENT_TYPE constant', () => {
      expect(INTERACT_EVENT_TYPE).toBe('interact')
    })

    it('exports INITIATE_EVENT_TYPE constant', () => {
      expect(INITIATE_EVENT_TYPE).toBe('initiate')
    })

    it('exports InteractPayloadSchema as a Zod schema', () => {
      expect(InteractPayloadSchema).toBeDefined()
      expect(InteractPayloadSchema.parse).toBeDefined()
    })
  })

  describe('sendEvent', () => {
    it('enqueues interact event', async () => {
      const payload = {
        sender: { id: '1234567890' },
        recipient: { id: 'page-123' },
        timestamp: 1234567890,
        message: {
          mid: 'msg-1',
          text: 'hi',
        },
      }

      await sendEvent(messengerIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/messenger/${messengerIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.any(Object)
      )
    })

    it('allocates a per-sender order, nudges, and serializes interact dispatch', async () => {
      const { publishChannelMessage } = await import('@/lib/channel.session')

      const sessionKey = `messenger-session-${messengerIntegrationId}-1234567890`

      const payload = {
        sender: { id: '1234567890' },
        recipient: { id: 'page-123' },
        timestamp: 1234567890,
        message: { mid: 'msg-1', text: 'hi' },
      }

      await sendEvent(messengerIntegrationId, {
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
        `/api/v1/integration/messenger/${messengerIntegrationId}/queue`,
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        { flow: { key: sessionKey, parallel: 1 } }
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(messengerIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })

    it('enqueues initiate event', async () => {
      const payload = {
        pageId: 'page-123',
        recipientId: 'recipient-123',
        text: 'hello',
      }

      await sendEvent(messengerIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/messenger/${messengerIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload },
        {}
      )
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      sender: { id: '1234567890' },
      recipient: { id: 'page-123' },
      timestamp: 1234567890,
      message: {
        mid: 'msg-1',
        text: 'hello',
      },
    }

    it('throws when integration is not found', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(messengerIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

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

      await handleInteractEvent(messengerIntegrationId, {
        ...basePayload,
        order: 3,
      })

      // @note message still appended, but generation is skipped.
      expect(mockEngine.send).toHaveBeenCalled()
      expect(mockEngine.receive).not.toHaveBeenCalled()
    })

    it('throws when integration is not configured (missing accessToken)', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
        id: messengerIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1' },
        bot: { id: 'bot-1' },
        accessToken: null,
      })

      await expect(
        handleInteractEvent(messengerIntegrationId, basePayload)
      ).rejects.toThrow(/not configured/i)
    })

    it('posts the pre-canned limits-reached reply (and does not throw) when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      // @note over-limit no longer throws: the handler posts a visible reply to
      // the sender via the Messenger Send API and returns. Uses the default
      // integration mock (accessToken present) so the payload reaches the limit
      // check and consumes the once-mock above.
      await expect(
        handleInteractEvent(messengerIntegrationId, basePayload)
      ).resolves.toBeUndefined()

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(messages.limitsReachedReply),
        })
      )
    })

    describe('postback events', () => {
      it('handles HUMAN_AGENT postback', async () => {
        const postbackPayload = {
          sender: { id: '1234567890' },
          recipient: { id: 'page-123' },
          timestamp: 1234567890,
          postback: {
            title: 'Talk to Human',
            payload: 'HUMAN_AGENT',
          },
        }

        await handleInteractEvent(messengerIntegrationId, postbackPayload)

        // Should send message that human agent will be with them
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('graph.facebook.com'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(
              'A human agent will be with you shortly'
            ),
          })
        )

        // Should pass thread control
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('pass_thread_control'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      it('does not transfer thread control for unknown postback payloads', async () => {
        const postbackPayload = {
          sender: { id: '1234567890' },
          recipient: { id: 'page-123' },
          timestamp: 1234567890,
          postback: {
            title: 'Help',
            payload: 'SHOW_HELP',
          },
        }

        await handleInteractEvent(messengerIntegrationId, postbackPayload)

        const passThreadControlCalls = fetch.mock.calls.filter(([url]) =>
          String(url).includes('pass_thread_control')
        )

        expect(passThreadControlCalls).toHaveLength(0)
      })
    })

    describe('session reset commands', () => {
      it('resets session for /restart command', async () => {
        const payload = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            text: '/restart',
          },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `messenger-session-${messengerIntegrationId}-1234567890`
        )
      })

      it('resets session for /reset command', async () => {
        const payload = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            text: '/reset',
          },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for /new command', async () => {
        const payload = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            text: '/new',
          },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles case insensitive reset commands', async () => {
        const payload = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            text: '/RESTART',
          },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles reset commands with whitespace', async () => {
        const payload = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            text: '  /restart  ',
          },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })
    })

    describe('conversation creation', () => {
      it('creates new conversation when no session exists', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(messengerIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            meta: expect.objectContaining({
              app: 'messenger',
              messenger: expect.objectContaining({
                integrationId: messengerIntegrationId,
              }),
            }),
          })
        )
      })

      it('stores session in redis after creating conversation', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(messengerIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          `messenger-session-${messengerIntegrationId}-1234567890`,
          'conv-1',
          expect.objectContaining({ ex: expect.any(Number) })
        )
      })

      it('reuses existing conversation from session', async () => {
        memcache.get.mockResolvedValue('existing-conv-1')

        const { hasConversation } = await import('@/lib/conversation.find')

        hasConversation.mockResolvedValue(true)

        await handleInteractEvent(messengerIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).not.toHaveBeenCalled()
      })
    })

    describe('contact collection', () => {
      it('creates contact when contactCollection is enabled', async () => {
        prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
          id: messengerIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: true,
          attachments: false,
        })

        // Mock the cached Graph user-info lookup
        getMetaUserInfo.mockResolvedValueOnce({
          first_name: 'John',
          last_name: 'Doe',
        })

        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg-response-1' }),
          status: 200,
        })

        await handleInteractEvent(messengerIntegrationId, basePayload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).toHaveBeenCalled()
      })

      it('does not create contact when contactCollection is disabled', async () => {
        prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
          id: messengerIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: false,
        })

        await handleInteractEvent(messengerIntegrationId, basePayload)

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
          first_name: 'John',
          last_name: 'Doe',
        })

        await handleInteractEvent(messengerIntegrationId, basePayload)

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: expect.arrayContaining([
                {
                  name: 'userInfo',
                  options: {
                    name: 'John Doe',
                    externalId: '1234567890',
                    source: 'messenger',
                  },
                },
              ]),
            }),
          })
        )
        expect(ensureTrustedContact).not.toHaveBeenCalled()
      })
    })

    describe('message handling', () => {
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

        await handleInteractEvent(messengerIntegrationId, basePayload)

        expect(mockEngine.send).toHaveBeenCalledWith('hello')
      })

      it('skips sending when no text in message', async () => {
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

        const payloadWithoutText = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            // no text field
          },
        }

        await handleInteractEvent(messengerIntegrationId, payloadWithoutText)

        expect(mockEngine.send).not.toHaveBeenCalled()
      })
    })

    describe('attachment handling', () => {
      it('processes attachments when attachments enabled', async () => {
        prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
          id: messengerIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
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

        const payloadWithAttachment = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            text: 'Check this image',
            attachments: [
              {
                type: 'image',
                payload: {
                  url: 'https://cdn.fbsbx.com/image.jpg',
                },
              },
            ],
          },
        }

        await handleInteractEvent(messengerIntegrationId, payloadWithAttachment)

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )

        expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
          expect.any(String),
          'https://cdn.fbsbx.com/image.jpg',
          undefined,
          { maxSize: 5 * 1024 * 1024 }
        )
        expect(mockEngine.send).toHaveBeenCalledWith('Check this image')
      })

      it('processes attachment-only messages and still generates a response', async () => {
        prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
          id: messengerIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
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

        const payloadWithAttachmentOnly = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            attachments: [
              {
                type: 'image',
                payload: {
                  url: 'https://cdn.fbsbx.com/image-only.jpg',
                },
              },
            ],
          },
        }

        await handleInteractEvent(
          messengerIntegrationId,
          payloadWithAttachmentOnly
        )

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              features: [
                {
                  name: 'userInfo',
                  options: { externalId: '1234567890', source: 'messenger' },
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
          'https://cdn.fbsbx.com/image-only.jpg',
          undefined,
          { maxSize: 5 * 1024 * 1024 }
        )
        expect(mockEngine.addMessages).toHaveBeenCalled()
        expect(mockEngine.receive).toHaveBeenCalled()
      })

      it('skips attachment upload when attachments disabled', async () => {
        const payloadWithAttachment = {
          ...basePayload,
          message: {
            mid: 'msg-1',
            attachments: [
              {
                type: 'image',
                payload: {
                  url: 'https://cdn.fbsbx.com/image.jpg',
                },
              },
            ],
          },
        }

        await handleInteractEvent(messengerIntegrationId, payloadWithAttachment)

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )

        expect(uploadConversationAttachmentFromURL).not.toHaveBeenCalled()
      })
    })

    describe('response handling', () => {
      it('sends response message to Facebook Graph API', async () => {
        await handleInteractEvent(messengerIntegrationId, basePayload)

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('graph.facebook.com'),
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      it('sends typing indicators before and after response generation', async () => {
        await handleInteractEvent(messengerIntegrationId, basePayload)

        const senderActionBodies = fetch.mock.calls
          .map(([, request]) => JSON.parse(request.body))
          .filter((body) => body.sender_action)
          .map((body) => body.sender_action)

        expect(senderActionBodies).toEqual(['typing_on', 'typing_off'])
      })

      it('captures typing indicator failures without breaking reply flow', async () => {
        const { captureUnexpectedState } = await import('@/lib/error')

        fetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limited' } }),
        })
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg-response-1' }),
          status: 200,
        })

        await expect(
          handleInteractEvent(messengerIntegrationId, basePayload)
        ).resolves.toBeUndefined()

        expect(captureUnexpectedState).toHaveBeenCalledWith(
          expect.stringContaining('typing_on indicator not delivered'),
          expect.objectContaining({
            messengerIntegrationId,
            recipientId: '1234567890',
          })
        )
      })

      it('throws error when Facebook API fails', async () => {
        const { getFetchError } = await import('@/lib/fetch')
        const { logEvent } = await import('@/lib/log')

        // typing_on sender action succeeds (consumed first)
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
          status: 200,
        })

        // actual message send fails
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Invalid request' } }),
        })

        getFetchError.mockResolvedValue(new Error('Facebook API Error'))

        await expect(
          handleInteractEvent(messengerIntegrationId, basePayload)
        ).rejects.toThrow()

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.messenger.api.error',
            name: 'Messenger Message Send Error',
            meta: expect.objectContaining({
              operation: 'messages.create',
              messageType: 'text',
              error: expect.objectContaining({
                message: 'Facebook API Error',
              }),
            }),
          })
        )
      })

      it('sends quick replies when markdown contains buttons code block output', async () => {
        const { markdownToMessages } = await import('@/lib/messenger.markdown')

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'quickReplies',
            text: { body: 'Choose an option:' },
            quickReplies: [
              {
                content_type: 'text',
                title: 'Pricing',
                payload: 'Pricing',
              },
              {
                content_type: 'text',
                title: 'Demo',
                payload: 'Demo',
              },
            ],
          },
        ])

        await handleInteractEvent(messengerIntegrationId, basePayload)

        const bodies = fetch.mock.calls
          .map(([, request]) => request?.body)
          .filter(Boolean)
          .map((body) => JSON.parse(body))

        expect(
          bodies.some(
            (body) =>
              Array.isArray(body.message?.quick_replies) &&
              body.message.quick_replies.length === 2 &&
              body.message.quick_replies[0].title === 'Pricing'
          )
        ).toBe(true)
      })
    })

    describe('image response handling', () => {
      it('sends image message to Facebook Graph API', async () => {
        const { markdownToMessages } = await import('@/lib/messenger.markdown')

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'image',
            image: { link: 'https://example.com/image.png' },
          },
        ])

        await handleInteractEvent(messengerIntegrationId, basePayload)

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('graph.facebook.com'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('attachment'),
          })
        )
      })

      it('sends video message to Facebook Graph API', async () => {
        const { markdownToMessages } = await import('@/lib/messenger.markdown')

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'video',
            video: { link: 'https://example.com/video.mp4' },
          },
        ])

        await handleInteractEvent(messengerIntegrationId, basePayload)

        const bodies = fetch.mock.calls
          .map(([, request]) => request?.body)
          .filter(Boolean)

        expect(bodies.some((body) => body.includes('"type":"video"'))).toBe(
          true
        )
      })

      it('sends audio message to Facebook Graph API', async () => {
        const { markdownToMessages } = await import('@/lib/messenger.markdown')

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'audio',
            audio: { link: 'https://example.com/audio.mp3' },
          },
        ])

        await handleInteractEvent(messengerIntegrationId, basePayload)

        const bodies = fetch.mock.calls
          .map(([, request]) => request?.body)
          .filter(Boolean)

        expect(bodies.some((body) => body.includes('"type":"audio"'))).toBe(
          true
        )
      })

      it('sends file message to Facebook Graph API', async () => {
        const { markdownToMessages } = await import('@/lib/messenger.markdown')

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'file',
            file: { link: 'https://example.com/guide.pdf' },
          },
        ])

        await handleInteractEvent(messengerIntegrationId, basePayload)

        const bodies = fetch.mock.calls
          .map(([, request]) => request?.body)
          .filter(Boolean)

        expect(bodies.some((body) => body.includes('"type":"file"'))).toBe(true)
      })
    })
  })

  describe('InteractPayloadSchema validation', () => {
    it('validates correct message payload', () => {
      const validPayload = {
        sender: { id: '1234567890' },
        recipient: { id: 'page-123' },
        timestamp: 1234567890,
        message: {
          mid: 'msg-1',
          text: 'hi',
        },
      }

      expect(() => InteractPayloadSchema.parse(validPayload)).not.toThrow()
    })

    it('validates correct postback payload', () => {
      const validPayload = {
        sender: { id: '1234567890' },
        recipient: { id: 'page-123' },
        timestamp: 1234567890,
        postback: {
          title: 'Get Started',
          payload: 'GET_STARTED',
        },
      }

      expect(() => InteractPayloadSchema.parse(validPayload)).not.toThrow()
    })

    it('validates payload with attachments', () => {
      const payload = {
        sender: { id: '1234567890' },
        recipient: { id: 'page-123' },
        timestamp: 1234567890,
        message: {
          mid: 'msg-1',
          attachments: [
            {
              type: 'image',
              payload: {
                url: 'https://cdn.fbsbx.com/image.jpg',
              },
            },
          ],
        },
      }

      expect(() => InteractPayloadSchema.parse(payload)).not.toThrow()
    })

    it('rejects payload missing required fields', () => {
      const payload = {
        sender: { id: '1234567890' },
        // missing recipient and timestamp
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })
  })

  describe('session management', () => {
    const basePayload = {
      sender: { id: '1234567890' },
      recipient: { id: 'recipient-1' },
      timestamp: 1234567890,
      message: { mid: 'msg-1', text: 'hello' },
    }

    beforeEach(() => {
      memcache.get.mockResolvedValue(null)

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ recipient_id: 'sender-1', message_id: 'msg-1' }),
        status: 200,
      })
    })

    it('builds session key using integration id and sender id', async () => {
      await handleInteractEvent(messengerIntegrationId, basePayload)

      expect(memcache.get).toHaveBeenCalledWith(
        `messenger-session-${messengerIntegrationId}-1234567890`
      )
    })

    it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
        id: messengerIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: 'access-token-xyz',
        sessionDuration: null,
        contactCollection: false,
        attachments: false,
      })

      await handleInteractEvent(messengerIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 86400 }) // 1 day in seconds
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
        id: messengerIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: 'access-token-xyz',
        sessionDuration: 0,
        contactCollection: false,
        attachments: false,
      })

      await handleInteractEvent(messengerIntegrationId, basePayload)

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('uses custom session duration from integration config', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
        id: messengerIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: 'access-token-xyz',
        sessionDuration: 3600000, // 1 hour in ms
        contactCollection: false,
        attachments: false,
      })

      await handleInteractEvent(messengerIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 3600 }) // 1 hour in seconds
      )
    })

    it('reuses existing valid conversation from redis session', async () => {
      memcache.get.mockResolvedValueOnce('existing-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(true)

      await handleInteractEvent(messengerIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('creates new conversation when session exists but conversation is gone', async () => {
      memcache.get.mockResolvedValueOnce('stale-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)

      await handleInteractEvent(messengerIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('creates new conversation when no session exists in redis', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(messengerIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'messenger',
            messenger: expect.objectContaining({
              integrationId: messengerIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      await handleInteractEvent(messengerIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `messenger-session-${messengerIntegrationId}-1234567890`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    describe('session reset commands', () => {
      it('resets session for /restart command', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-1', text: '/restart' },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `messenger-session-${messengerIntegrationId}-1234567890`
        )
      })

      it('resets session for /reset command', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-1', text: '/reset' },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for /new command', async () => {
        const payload = {
          ...basePayload,
          message: { mid: 'msg-1', text: '/new' },
        }

        await handleInteractEvent(messengerIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })
    })
  })

  describe('handleInitiateEvent', () => {
    const basePayload = {
      pageId: 'page-123',
      recipientId: 'recipient-123',
      text: 'Hello from Messenger',
    }

    it('throws when integration is not found', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInitiateEvent(messengerIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('throws when integration has no access token', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValueOnce({
        id: messengerIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: null,
        sessionDuration: 0,
      })

      await expect(
        handleInitiateEvent(messengerIntegrationId, basePayload)
      ).rejects.toThrow(/not configured/i)
    })

    it('throws when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInitiateEvent(messengerIntegrationId, basePayload)
      ).rejects.toThrow(/Limits exceeded/i)
    })

    it('sends message to Messenger API and creates conversation', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(messengerIntegrationId, basePayload)

      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/page-123/messages?access_token=access-token-xyz',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"recipient":{"id":"recipient-123"}'),
        })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'messenger',
            messenger: expect.objectContaining({
              integrationId: messengerIntegrationId,
              pageId: 'page-123',
              recipientId: 'recipient-123',
              initiated: true,
            }),
          }),
        })
      )
    })

    it('stores session under recipient-based key', async () => {
      await handleInitiateEvent(messengerIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `messenger-session-${messengerIntegrationId}-recipient-123`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('does not create conversation when Messenger API returns error', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })

      await handleInitiateEvent(messengerIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })
  })
})
