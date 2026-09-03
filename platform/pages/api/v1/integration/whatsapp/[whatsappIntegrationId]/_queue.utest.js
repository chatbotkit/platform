/**
 * @jest-environment node
 */
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'
import { parseAsync } from '@/lib/zod.schema'

import {
  INITIATE_EVENT_TYPE,
  INTERACT_EVENT_TYPE,
  InteractPayloadSchema,
  WHATSAPP_CONTACT_NAMESPACE,
  getWhatsAppInitiateSessionKey,
  getWhatsAppInteractSessionId,
  getWhatsAppInteractSessionKey,
  handleInitiateEvent,
  handleInteractEvent,
  sendEvent,
} from '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    whatsappIntegration: { findUnique: jest.fn() },
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
    captureObservation: jest.fn(),
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

jest.mock('@/lib/whatsapp.markdown', () => ({
  markdownToMessages: jest.fn(async (text) => [{ text: { body: text } }]),
  mergeMessagesByType: jest.fn((messages) => messages),
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

describe('WhatsApp queue module', () => {
  const whatsappIntegrationId = 'int-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.whatsappIntegration.findUnique.mockResolvedValue({
      id: whatsappIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      phoneNumberId: 'phone-123',
      accessToken: 'access-token-xyz',
      verifyToken: 'verify-token',
      sessionDuration: 86400000,
      contactCollection: false,
      attachments: false,
      allowFrom: '*',
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)

    fetch.mockReset()

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg-response-1' }] }),
      status: 200,
    })

    parseAsync.mockResolvedValue(undefined)
  })

  describe('constants and exports', () => {
    it('exports WHATSAPP_CONTACT_NAMESPACE as a valid UUID', () => {
      expect(WHATSAPP_CONTACT_NAMESPACE).toBe(
        '024f30fa-decd-495f-820a-308825f979d8'
      )
    })

    it('exports INTERACT_EVENT_TYPE constant', () => {
      expect(INTERACT_EVENT_TYPE).toBe('interact')
    })

    it('exports InteractPayloadSchema as a Zod schema', () => {
      expect(InteractPayloadSchema).toBeDefined()
      expect(InteractPayloadSchema.parse).toBeDefined()
    })

    it('accepts a contact without a profile (WhatsApp omits it)', () => {
      const result = InteractPayloadSchema.safeParse({
        contacts: [{ wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'text',
            text: { body: 'hi' },
          },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('accepts a contact whose profile has no name', () => {
      const result = InteractPayloadSchema.safeParse({
        contacts: [{ profile: {}, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'text',
            text: { body: 'hi' },
          },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('accepts message notifications that omit contacts', () => {
      const result = InteractPayloadSchema.safeParse({
        messages: [{ id: 'msg-1', from: '1234567890', type: 'system' }],
      })

      expect(result.success).toBe(true)
    })

    it('still requires wa_id on contacts', () => {
      const result = InteractPayloadSchema.safeParse({
        contacts: [{ profile: { name: 'User' } }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'text',
            text: { body: 'hi' },
          },
        ],
      })

      expect(result.success).toBe(false)
    })

    it.each([
      ['video', { video: { id: 'video-1', caption: 'clip' } }],
      ['document', { document: { id: 'document-1', filename: 'notes.pdf' } }],
      ['sticker', { sticker: { id: 'sticker-1' } }],
      [
        'reaction',
        { reaction: { message_id: 'msg-0', emoji: '\ud83d\udc4d' } },
      ],
    ])('accepts a valid WhatsApp %s message', (type, media) => {
      const result = InteractPayloadSchema.safeParse({
        contacts: [{ wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type,
            ...media,
          },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('deduplicates the sender when a webhook batches their messages', () => {
      expect(
        getWhatsAppInteractSessionId({
          messages: [{ from: '1234567890' }, { from: '+1 (234) 567-890' }],
        })
      ).toBe('1234567890')
    })
  })

  describe('sendEvent', () => {
    it('enqueues interact event with deduplication id', async () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'text',
            text: { body: 'hi' },
          },
        ],
      }

      await sendEvent(whatsappIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/whatsapp/${whatsappIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          deduplicationId: `whatsapp-${whatsappIntegrationId}-interact-msg-1`,
          flow: expect.objectContaining({
            key: `whatsapp-${whatsappIntegrationId}-interact-1234567890`,
            parallel: 1,
          }),
        })
      )
    })

    it('allocates a per-sender order and nudges on interact', async () => {
      const { publishChannelMessage } = await import('@/lib/channel.session')

      const sessionKey = `whatsapp-session-${whatsappIntegrationId}-1234567890`

      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'text',
            text: { body: 'hi' },
          },
        ],
      }

      await sendEvent(whatsappIntegrationId, {
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
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(whatsappIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })

    it('uses correct deduplication for multiple messages', async () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          { id: 'msg-1', from: '1234567890', type: 'text' },
          { id: 'msg-2', from: '1234567890', type: 'text' },
        ],
      }

      await sendEvent(whatsappIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          deduplicationId: `whatsapp-${whatsappIntegrationId}-interact-msg-1,msg-2`,
        })
      )
    })

    it('splits a mixed-sender webhook into sender-scoped queue events', async () => {
      const payload = {
        contacts: [{ wa_id: '111' }, { wa_id: '222' }],
        messages: [
          { id: 'msg-1', from: '111', type: 'text', text: { body: 'one' } },
          { id: 'msg-2', from: '222', type: 'text', text: { body: 'two' } },
        ],
      }

      await sendEvent(whatsappIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledTimes(2)
      expect(queue).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          payload: expect.objectContaining({
            contacts: [{ wa_id: '111' }],
            messages: [expect.objectContaining({ from: '111' })],
          }),
        }),
        expect.objectContaining({
          flow: expect.objectContaining({
            key: `whatsapp-${whatsappIntegrationId}-interact-111`,
          }),
        })
      )
      expect(queue).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          payload: expect.objectContaining({
            contacts: [{ wa_id: '222' }],
            messages: [expect.objectContaining({ from: '222' })],
          }),
        }),
        expect.any(Object)
      )
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      contacts: [{ profile: { name: 'Test User' }, wa_id: '1234567890' }],
      messages: [
        {
          id: 'msg-1',
          from: '1234567890',
          type: 'text',
          text: { body: 'hello' },
        },
      ],
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

      await handleInteractEvent(whatsappIntegrationId, {
        ...basePayload,
        order: 3,
      })

      // @note message still appended, but generation is skipped.
      expect(mockEngine.send).toHaveBeenCalled()
      expect(mockEngine.receive).not.toHaveBeenCalled()
    })

    it('soft-yields mid-turn and skips the send when a newer message nudges', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { streamChannelEvents } = await import('@/lib/channel.session')
      const { markdownToMessages } = jest.requireMock('@/lib/whatsapp.markdown')

      // @note a newer message (order 5) nudges the channel during generation.
      streamChannelEvents.mockImplementationOnce(async function* () {
        yield { type: 'message', data: { order: 5 } }
      })

      const mockEngine = {
        send: jest.fn(async () => undefined),
        // @note the mock engine can't honor yieldSignal, so we let the watcher
        // trip (process the nudge) before receive resolves; the handler's own
        // didYield() check is what we're proving here.
        receive: jest.fn(async () => {
          await new Promise((r) => setImmediate(r))
          await new Promise((r) => setImmediate(r))

          return { text: 'reply', messages: [] }
        }),
        addMessages: jest.fn(async () => undefined),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      // @note marker NOT exceeded → the before-check passes; the yield is purely
      // mid-turn (driven by the channel nudge above).
      memcache.get.mockResolvedValue(null)

      markdownToMessages.mockClear()

      await handleInteractEvent(whatsappIntegrationId, {
        ...basePayload,
        order: 3,
      })

      expect(mockEngine.receive).toHaveBeenCalled()
      // @note suppressed: the post path (markdownToMessages → Graph send) is
      // skipped because the turn was superseded mid-flight.
      expect(markdownToMessages).not.toHaveBeenCalled()
    })

    it('throws when integration is not found', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(whatsappIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('throws when integration is not configured (missing phoneNumberId)', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1' },
        bot: { id: 'bot-1' },
        phoneNumberId: null,
        accessToken: 'token',
      })

      await expect(
        handleInteractEvent(whatsappIntegrationId, basePayload)
      ).rejects.toThrow(/not configured/i)
    })

    it('throws when integration is not configured (missing accessToken)', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1' },
        bot: { id: 'bot-1' },
        phoneNumberId: 'phone-123',
        accessToken: null,
      })

      await expect(
        handleInteractEvent(whatsappIntegrationId, basePayload)
      ).rejects.toThrow(/not configured/i)
    })

    it('posts a pre-canned reply and does not throw when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      // @note over-limit no longer throws; the handler posts a canned reply via
      // the Graph send and returns. Asserting a resolved (undefined) result also
      // proves the once-mock above was consumed (the limit check ran), so it
      // cannot leak into a later test.
      await expect(
        handleInteractEvent(whatsappIntegrationId, basePayload)
      ).resolves.toBeUndefined()

      const limitReplyCall = fetch.mock.calls.find(([url, options]) => {
        if (url !== 'https://graph.facebook.com/v21.0/phone-123/messages') {
          return false
        }

        const body = JSON.parse(options.body)

        return body.text?.body === messages.limitsReachedReply
      })

      expect(limitReplyCall).toBeDefined()
      expect(JSON.parse(limitReplyCall[1].body)).toMatchObject({
        messaging_product: 'whatsapp',
        to: '1234567890',
        text: { body: messages.limitsReachedReply },
      })
    })

    describe('allowFrom gate', () => {
      it('allows all senders when allowFrom is wildcard (*)', async () => {
        // base mock already sets allowFrom: '*'
        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.whatsapp.blocked' })
        )
        expect(accountConversationalLimitsOk).toHaveBeenCalled()
      })

      it('allows sender whose phone number matches the allowFrom list', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '1234567890', // exactly the basePayload sender
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.whatsapp.blocked' })
        )
        expect(accountConversationalLimitsOk).toHaveBeenCalled()
      })

      it('allows when allowFrom entry has + prefix and sender delivers digits only', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '+1234567890', // + prefix variant
        })

        // basePayload sender is '1234567890' (no +)
        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(accountConversationalLimitsOk).toHaveBeenCalled()
      })

      it('blocks sender not in the allowFrom list and logs blocked event', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '447911123456', // different number
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.whatsapp.blocked',
            relations: expect.objectContaining({
              whatsappIntegrationId,
            }),
            meta: expect.objectContaining({ from: '1234567890' }),
          })
        )
        // must not proceed past the gate
        expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
      })

      it('blocks all senders when allowFrom is empty (secure by default)', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '',
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.whatsapp.blocked' })
        )
        expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
      })

      it('blocks all senders when allowFrom is null (treated as empty)', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: null,
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.whatsapp.blocked' })
        )
        expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
      })

      it('allows second number in a multi-entry list when it matches', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '447911123456\n1234567890', // second entry matches
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.whatsapp.blocked' })
        )
        expect(accountConversationalLimitsOk).toHaveBeenCalled()
      })

      it('blocks when no entry in a multi-entry list matches the sender', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '447911123456\n19999999999',
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.whatsapp.blocked' })
        )
        expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
      })

      it('does not let an allowed first sender bypass a blocked batched sender', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '1234567890',
        })

        await handleInteractEvent(whatsappIntegrationId, {
          ...basePayload,
          messages: [
            ...basePayload.messages,
            {
              id: 'msg-2',
              from: '19999999999',
              type: 'text',
              text: { body: 'blocked' },
            },
          ],
        })

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.whatsapp.blocked',
            meta: expect.objectContaining({ from: '19999999999' }),
          })
        )
        expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
      })

      it('skips the allowFrom check when there is no sender phone in the payload', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          allowFrom: '447911123456', // restricted - but no from in payload
        })

        const payloadWithNoMessages = { contacts: [], messages: [] }

        await handleInteractEvent(whatsappIntegrationId, payloadWithNoMessages)

        // gate does not fire when senderPhone is falsy
        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.whatsapp.blocked' })
        )
      })
    })

    describe('session reset commands', () => {
      it('does not start a supersede watcher for a reset command', async () => {
        const { streamChannelEvents } = await import('@/lib/channel.session')

        await handleInteractEvent(whatsappIntegrationId, {
          ...basePayload,
          order: 1,
          messages: [
            {
              ...basePayload.messages[0],
              text: { body: '/reset' },
            },
          ],
        })

        expect(streamChannelEvents).not.toHaveBeenCalled()
      })

      it('resets session for /restart command', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'text',
              text: { body: '/restart' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `whatsapp-session-${whatsappIntegrationId}-1234567890`
        )
      })

      it('resets session for /reset command', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'text',
              text: { body: '/reset' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for /new command', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'text',
              text: { body: '/new' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles case insensitive reset commands', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'text',
              text: { body: '/RESTART' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles reset commands with whitespace', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'text',
              text: { body: '  /restart  ' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })
    })

    describe('conversation creation', () => {
      it('creates new conversation when no session exists', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            meta: expect.objectContaining({
              app: 'whatsapp',
              whatsapp: expect.objectContaining({
                integrationId: whatsappIntegrationId,
              }),
            }),
          })
        )
      })

      it('stores session in redis after creating conversation', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          `whatsapp-session-${whatsappIntegrationId}-1234567890`,
          'conv-1',
          expect.objectContaining({ ex: expect.any(Number) })
        )
      })

      it('reuses existing conversation from session', async () => {
        memcache.get.mockResolvedValue('existing-conv-1')

        const { hasConversation } = await import('@/lib/conversation.find')

        hasConversation.mockResolvedValue(true)

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).not.toHaveBeenCalled()

        // @note sliding window: the session TTL is refreshed on reuse
        expect(memcache.expire).toHaveBeenCalledWith(
          expect.stringContaining('-session-'),
          expect.any(Number)
        )
      })
    })

    describe('contact collection', () => {
      it('creates contact when contactCollection is enabled', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: true,
          attachments: false,
          allowFrom: '*',
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).toHaveBeenCalled()
      })

      it('creates a contact with no name when profile is missing', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: true,
          attachments: false,
          allowFrom: '*',
        })

        const payload = {
          ...basePayload,
          contacts: [{ wa_id: '1234567890' }],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ name: undefined }),
          expect.any(String)
        )
      })

      it('does not create contact when contactCollection is disabled', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: false,
          allowFrom: '*',
        })

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).not.toHaveBeenCalled()
      })

      it('does not create contact when wa_id cannot be normalized', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: true,
          attachments: false,
          allowFrom: '*',
        })

        const payload = {
          ...basePayload,
          contacts: [{ profile: { name: 'Broken Contact' }, wa_id: 'abc' }],
          messages: [
            {
              id: 'msg-1',
              from: 'abc',
              type: 'text',
              text: { body: 'hello' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).not.toHaveBeenCalled()
      })
    })

    describe('message type handling', () => {
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

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(mockEngine.send).toHaveBeenCalledWith('hello')
      })

      it('does not re-capture errors pushed to the sink (engine captures at source)', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const { TAG_ERROR } = await import('@/lib/conversation.tag')
        const { captureError } = await import('@/lib/error')

        getStatefulConversationEngine.mockImplementationOnce(
          async ({ options: { sink } }) => {
            // @note the engine normalizes errors to {code, message} before
            // pushing TAG_ERROR, having already reported the raw error (with
            // its cause chain) to Sentry at the throw site. The sink must NOT
            // re-capture - doing so produces a duplicate, stack-less,
            // cause-less event (the regression pattern).

            await sink.push(TAG_ERROR, {
              code: 'GENERIC_ERROR',
              message: 'boom',
            })

            return {
              send: jest.fn(),
              receive: jest
                .fn()
                .mockResolvedValue({ text: 'response', messages: [] }),
              addMessages: jest.fn(),
              dispose: jest.fn(async () => undefined),
            }
          }
        )

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(captureError).not.toHaveBeenCalled()
      })

      it('processes interactive button reply messages', async () => {
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
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: { id: 'btn-1', title: 'Option A' },
              },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(mockEngine.send).toHaveBeenCalledWith(
          '[selection button id=btn-1] Option A'
        )
      })

      it('processes interactive list reply messages', async () => {
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
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'interactive',
              interactive: {
                type: 'list_reply',
                list_reply: { id: 'list-1', title: 'Selected Item' },
              },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(mockEngine.send).toHaveBeenCalledWith(
          '[selection list id=list-1] Selected Item'
        )
      })

      it('processes location messages', async () => {
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
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'location',
              location: {
                latitude: 40.7128,
                longitude: -74.006,
                name: 'New York',
                address: '123 Main St',
              },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(mockEngine.send).toHaveBeenCalledWith(
          expect.stringContaining('[location lat=40.7128 lon=-74.006')
        )
      })

      it('skips unsupported message types without sending', async () => {
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
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'unsupported',
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(mockEngine.send).not.toHaveBeenCalled()
      })
    })

    describe('attachment handling', () => {
      it('generates a reply for an attachment-only message', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
          allowFrom: '*',
        })
        fetch
          .mockResolvedValueOnce({ ok: true, status: 200 })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ url: 'https://cdn.whatsapp.com/image.jpg' }),
            status: 200,
          })
          .mockResolvedValue({ ok: true, status: 200 })

        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn(async () => ({
            text: 'I can see it',
            messages: [],
          })),
          addMessages: jest.fn(),
          dispose: jest.fn(),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        await handleInteractEvent(whatsappIntegrationId, {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'image',
              image: { id: 'image-123' },
            },
          ],
        })

        expect(mockEngine.addMessages).toHaveBeenCalled()
        expect(mockEngine.receive).toHaveBeenCalled()
      })

      it('continues with a media caption when attachment upload fails', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
          allowFrom: '*',
        })
        fetch
          .mockResolvedValueOnce({ ok: true, status: 200 })
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValue({ ok: true, status: 200 })

        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
          addMessages: jest.fn(),
          dispose: jest.fn(),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        await expect(
          handleInteractEvent(whatsappIntegrationId, {
            ...basePayload,
            messages: [
              {
                id: 'msg-1',
                from: '1234567890',
                type: 'video',
                video: { id: 'video-123', caption: 'Watch this' },
              },
            ],
          })
        ).resolves.toBeUndefined()

        expect(mockEngine.send).toHaveBeenCalledWith('Watch this')
        expect(mockEngine.receive).toHaveBeenCalled()
      })

      it('processes image with attachments enabled', async () => {
        prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
          id: whatsappIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          phoneNumberId: 'phone-123',
          accessToken: 'access-token-xyz',
          sessionDuration: 86400000,
          contactCollection: false,
          attachments: true,
          allowFrom: '*',
        })

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg-1' }] }),
          status: 200,
        })

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://cdn.whatsapp.com/image.jpg' }),
          status: 200,
        })

        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg-response-1' }] }),
          status: 200,
        })

        const payload = {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'image',
              image: { id: 'image-123', caption: 'Check this out' },
            },
          ],
        }

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

        await handleInteractEvent(whatsappIntegrationId, payload)

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )
        const { getMaxFileSize } = await import('@/lib/user.limits')

        // @note the plan limit is resolved from the integration's user and
        // forwarded as `maxSize`; without it the upload throws "Attachment is
        // too large" (LIMITS_REACHED) and the media is dropped.
        expect(getMaxFileSize).toHaveBeenCalledWith({
          id: 'user-1',
          name: 'Test',
        })
        expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
          expect.any(String),
          'https://cdn.whatsapp.com/image.jpg',
          expect.objectContaining({ Authorization: 'Bearer access-token-xyz' }),
          { maxSize: 5 * 1024 * 1024 }
        )
        expect(mockEngine.send).toHaveBeenCalledWith('Check this out')
      })

      it('skips attachment upload when attachments disabled', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              id: 'msg-1',
              from: '1234567890',
              type: 'image',
              image: { id: 'image-123' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        const { uploadConversationAttachmentFromURL } = await import(
          '@/lib/conversation.attachment'
        )

        expect(uploadConversationAttachmentFromURL).not.toHaveBeenCalled()
      })
    })

    describe('response handling', () => {
      it('sends response message to WhatsApp API', async () => {
        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(fetch).toHaveBeenCalledWith(
          'https://graph.facebook.com/v21.0/phone-123/messages',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer access-token-xyz',
            }),
          })
        )
      })

      it('sends each merged text chunk as a separate WhatsApp message', async () => {
        const { markdownToMessages, mergeMessagesByType } = jest.requireMock(
          '@/lib/whatsapp.markdown'
        )

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'text',
            text: { body: 'first chunk', preview_url: true },
          },
          {
            type: 'text',
            text: { body: 'second chunk', preview_url: false },
          },
        ])

        mergeMessagesByType.mockImplementationOnce((messages) => messages)

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const textSendCalls = fetch.mock.calls.filter(([, options]) => {
          const body = JSON.parse(options.body)

          return body.type === 'text'
        })

        expect(textSendCalls).toHaveLength(2)
        expect(JSON.parse(textSendCalls[0][1].body)).toMatchObject({
          to: '1234567890',
          type: 'text',
          text: { body: 'first chunk', preview_url: true },
        })
        expect(JSON.parse(textSendCalls[1][1].body)).toMatchObject({
          to: '1234567890',
          type: 'text',
          text: { body: 'second chunk', preview_url: false },
        })
      })

      it('sends video messages produced by markdown conversion', async () => {
        const { markdownToMessages, mergeMessagesByType } = jest.requireMock(
          '@/lib/whatsapp.markdown'
        )

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'video',
            video: {
              link: 'https://example.com/demo.mp4',
              caption: 'demo video',
            },
          },
        ])

        mergeMessagesByType.mockImplementationOnce((messages) => messages)

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const videoSendCall = fetch.mock.calls.find(([, options]) => {
          const body = JSON.parse(options.body)

          return body.type === 'video'
        })

        expect(videoSendCall).toBeDefined()
        expect(JSON.parse(videoSendCall[1].body)).toMatchObject({
          to: '1234567890',
          type: 'video',
          video: {
            link: 'https://example.com/demo.mp4',
            caption: 'demo video',
          },
        })
      })

      it('sends audio messages produced by markdown conversion', async () => {
        const { markdownToMessages, mergeMessagesByType } = jest.requireMock(
          '@/lib/whatsapp.markdown'
        )

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'audio',
            audio: {
              link: 'https://example.com/episode.mp3',
            },
          },
        ])

        mergeMessagesByType.mockImplementationOnce((messages) => messages)

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const audioSendCall = fetch.mock.calls.find(([, options]) => {
          const body = JSON.parse(options.body)

          return body.type === 'audio'
        })

        expect(audioSendCall).toBeDefined()
        expect(JSON.parse(audioSendCall[1].body)).toMatchObject({
          to: '1234567890',
          type: 'audio',
          audio: {
            link: 'https://example.com/episode.mp3',
          },
        })
      })

      it('sends document messages produced by markdown conversion', async () => {
        const { markdownToMessages, mergeMessagesByType } = jest.requireMock(
          '@/lib/whatsapp.markdown'
        )

        markdownToMessages.mockResolvedValueOnce([
          {
            type: 'document',
            document: {
              link: 'https://example.com/pricing.pdf',
              caption: 'pricing sheet',
              filename: 'pricing sheet',
            },
          },
        ])

        mergeMessagesByType.mockImplementationOnce((messages) => messages)

        await handleInteractEvent(whatsappIntegrationId, basePayload)

        const documentSendCall = fetch.mock.calls.find(([, options]) => {
          const body = JSON.parse(options.body)

          return body.type === 'document'
        })

        expect(documentSendCall).toBeDefined()
        expect(JSON.parse(documentSendCall[1].body)).toMatchObject({
          to: '1234567890',
          type: 'document',
          document: {
            link: 'https://example.com/pricing.pdf',
            caption: 'pricing sheet',
            filename: 'pricing sheet',
          },
        })
      })

      it('logs error when WhatsApp API fails', async () => {
        const { logEvent } = await import('@/lib/log')
        const { getFetchError } = await import('@/lib/fetch')

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg-1' }] }),
          status: 200,
        })
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Invalid request' } }),
        })

        getFetchError.mockResolvedValue(new Error('WhatsApp API Error'))

        await expect(
          handleInteractEvent(whatsappIntegrationId, basePayload)
        ).rejects.toThrow()

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.whatsapp.api.error',
          })
        )
      })
    })

    describe('typing indicator', () => {
      it('sends typing indicator on message processing', async () => {
        await handleInteractEvent(whatsappIntegrationId, basePayload)

        expect(fetch).toHaveBeenCalledWith(
          'https://graph.facebook.com/v21.0/phone-123/messages',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('typing_indicator'),
          })
        )
      })
    })
  })

  describe('InteractPayloadSchema validation', () => {
    it('validates correct payload', () => {
      const validPayload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'text',
            text: { body: 'hi' },
          },
        ],
      }

      expect(() => InteractPayloadSchema.parse(validPayload)).not.toThrow()
    })

    it('validates payload with image message', () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'image',
            image: { id: 'img-123', caption: 'A photo' },
          },
        ],
      }

      expect(() => InteractPayloadSchema.parse(payload)).not.toThrow()
    })

    it('validates payload with audio message', () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'audio',
            audio: { id: 'audio-123' },
          },
        ],
      }

      expect(() => InteractPayloadSchema.parse(payload)).not.toThrow()
    })

    it('validates payload with interactive message', () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: 'btn-1', title: 'Yes' },
            },
          },
        ],
      }

      expect(() => InteractPayloadSchema.parse(payload)).not.toThrow()
    })

    it('validates payload with location message', () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'location',
            location: {
              latitude: 40.7128,
              longitude: -74.006,
              name: 'NYC',
              address: '123 Main St',
            },
          },
        ],
      }

      expect(() => InteractPayloadSchema.parse(payload)).not.toThrow()
    })

    it('validates payload with unsupported message type', () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'unsupported',
          },
        ],
      }

      expect(() => InteractPayloadSchema.parse(payload)).not.toThrow()
    })

    it('rejects invalid message type', () => {
      const payload = {
        contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
        messages: [
          {
            id: 'msg-1',
            from: '1234567890',
            type: 'invalid_type',
          },
        ],
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })

    it('rejects payload missing required fields', () => {
      const payload = {
        contacts: [],
        messages: [{ id: 'msg-1' }],
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })
  })

  describe('session management', () => {
    const basePayload = {
      contacts: [{ profile: { name: 'User' }, wa_id: '1234567890' }],
      messages: [
        {
          id: 'msg-1',
          from: '1234567890',
          timestamp: '1234567890',
          type: 'text',
          text: { body: 'hello' },
        },
      ],
    }

    beforeEach(() => {
      memcache.get.mockResolvedValue(null)

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-1' }] }),
        status: 200,
      })
    })

    it('builds session key using integration id and phone number', async () => {
      await handleInteractEvent(whatsappIntegrationId, basePayload)

      expect(memcache.get).toHaveBeenCalledWith(
        `whatsapp-session-${whatsappIntegrationId}-1234567890`
      )
    })

    it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: 'access-token',
        phoneNumberId: 'phone-123',
        sessionDuration: null,
        contactCollection: false,
        attachments: false,
        allowFrom: '*',
      })

      await handleInteractEvent(whatsappIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 86400 }) // 1 day in seconds
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: 'access-token',
        phoneNumberId: 'phone-123',
        sessionDuration: 0,
        contactCollection: false,
        attachments: false,
        allowFrom: '*',
      })

      await handleInteractEvent(whatsappIntegrationId, basePayload)

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('uses custom session duration from integration config', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accessToken: 'access-token',
        phoneNumberId: 'phone-123',
        sessionDuration: 14400000, // 4 hours in ms
        contactCollection: false,
        attachments: false,
        allowFrom: '*',
      })

      await handleInteractEvent(whatsappIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 14400 }) // 4 hours in seconds
      )
    })

    it('reuses existing valid conversation from redis session', async () => {
      memcache.get.mockResolvedValueOnce('existing-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(true)

      await handleInteractEvent(whatsappIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('creates new conversation when session exists but conversation is gone', async () => {
      memcache.get.mockResolvedValueOnce('stale-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)

      await handleInteractEvent(whatsappIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('creates new conversation when no session exists in redis', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(whatsappIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'whatsapp',
            whatsapp: expect.objectContaining({
              integrationId: whatsappIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      await handleInteractEvent(whatsappIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `whatsapp-session-${whatsappIntegrationId}-1234567890`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    describe('session reset commands', () => {
      it('resets session for /restart command', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              ...basePayload.messages[0],
              text: { body: '/restart' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `whatsapp-session-${whatsappIntegrationId}-1234567890`
        )
      })

      it('resets session for /reset command', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              ...basePayload.messages[0],
              text: { body: '/reset' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for /new command', async () => {
        const payload = {
          ...basePayload,
          messages: [
            {
              ...basePayload.messages[0],
              text: { body: '/new' },
            },
          ],
        }

        await handleInteractEvent(whatsappIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })
    })
  })

  describe('session key normalization', () => {
    it('keys the initiate `to` and inbound `from` identically regardless of + / formatting', () => {
      const initiateKey = getWhatsAppInitiateSessionKey(whatsappIntegrationId, {
        to: '+1 (650) 555-1234',
      })

      const interactKey = getWhatsAppInteractSessionKey(whatsappIntegrationId, {
        messages: [{ from: '16505551234' }],
      })

      expect(initiateKey).toBe(interactKey)
      expect(initiateKey).toBe(
        `whatsapp-session-${whatsappIntegrationId}-16505551234`
      )
    })
  })

  describe('handleInitiateEvent', () => {
    const baseInitiatePayload = {
      to: '14155238886',
      text: 'Hello from bot!',
    }

    it('throws when integration is not found', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('skips when integration has no access token', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        phoneNumberId: 'phone-123',
        accessToken: null,
        sessionDuration: 0,
      })

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)

      // @note should not create conversation when access token is missing
      expect(createConversation).not.toHaveBeenCalled()
    })

    it('skips when integration has no phone number ID', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        phoneNumberId: null,
        accessToken: 'access-token-xyz',
        sessionDuration: 0,
      })

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('throws when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/Limits exceeded/i)
    })

    it('sends message to WhatsApp API and creates conversation', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)

      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/phone-123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token-xyz',
          }),
        })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'whatsapp',
            whatsapp: expect.objectContaining({
              integrationId: whatsappIntegrationId,
              to: '14155238886',
              initiated: true,
            }),
          }),
        })
      )
    })

    it('stores session under phone-number-based key', async () => {
      await handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `whatsapp-session-${whatsappIntegrationId}-14155238886`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('does not create conversation when WhatsApp API returns error', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })

      await handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('includes context messages when context is provided', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(whatsappIntegrationId, {
        ...baseInitiatePayload,
        context: {
          linkedConversationId: 'conv-abc',
          text: 'Customer requesting order status',
        },
      })

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ type: 'bot', text: 'Hello from bot!' }),
          ]),
        })
      )
    })

    it('sends initiate event through sendEvent', async () => {
      await sendEvent(whatsappIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload: baseInitiatePayload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/whatsapp/${whatsappIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload: baseInitiatePayload },
        {}
      )
    })

    it('deduplicates and serializes an identified initiate event', async () => {
      const payload = {
        ...baseInitiatePayload,
        id: 'outreach-123',
      }

      await sendEvent(whatsappIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/whatsapp/${whatsappIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload },
        {
          deduplicationId: `whatsapp-${whatsappIntegrationId}-initiate-outreach-123`,
          flow: {
            key: `whatsapp-${whatsappIntegrationId}-initiate-14155238886`,
            parallel: 1,
          },
        }
      )
    })

    it('does not resend an initiate message after its provider send checkpoint', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      memcache.get.mockResolvedValueOnce('sent')

      await handleInitiateEvent(whatsappIntegrationId, {
        ...baseInitiatePayload,
        id: 'outreach-123',
      })

      expect(fetch).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
      expect(memcache.set).toHaveBeenCalledWith(
        `whatsapp-initiate-${whatsappIntegrationId}-outreach-123`,
        'complete',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('returns immediately when an initiate event is already complete', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      memcache.get.mockResolvedValueOnce('complete')

      await handleInitiateEvent(whatsappIntegrationId, {
        ...baseInitiatePayload,
        id: 'outreach-123',
      })

      expect(fetch).not.toHaveBeenCalled()
      expect(createConversation).not.toHaveBeenCalled()
    })

    it('returns early when integration has no bot configured', async () => {
      const { captureUnexpectedState } = await import('@/lib/error')
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.whatsappIntegration.findUnique.mockResolvedValueOnce({
        id: whatsappIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: null,
        phoneNumberId: 'phone-123',
        accessToken: 'access-token-xyz',
        verifyToken: 'verify-token',
        sessionDuration: 86400000,
        contactCollection: false,
        attachments: false,
      })

      await handleInitiateEvent(whatsappIntegrationId, baseInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('no bot configured'),
        expect.objectContaining({ whatsappIntegrationId })
      )
      expect(createConversation).not.toHaveBeenCalled()
    })
  })
})
