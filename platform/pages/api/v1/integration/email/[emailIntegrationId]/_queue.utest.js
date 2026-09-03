/**
 * @jest-environment node
 */
import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

import { formatIntegrationInbox } from '@chatbotkit-dev/email'
import prisma from '@/prisma/client'

import { accountConversationalLimitsOk } from '@/lib/limit.core'
import queue from '@/lib/queue'
import memcache from '@/lib/memcache'
import { parseAsync } from '@/lib/zod.schema'

import {
  EMAIL_CONTACT_NAMESPACE,
  INITIATE_EVENT_TYPE,
  INTERACT_EVENT_TYPE,
  InteractPayloadSchema,
  SEND_EVENT_TYPE,
  SendPayloadSchema,
  SETUP_EVENT_TYPE,
  SetupPayloadSchema,
  getConversationSessionId,
  getEmailConversationEngineOptions,
  handleInitiateEvent,
  handleInteractEvent,
  handleSendEvent,
  handleSetupEvent,
  sendEvent,
} from '@/pages/api/v1/integration/email/[emailIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    emailIntegration: { findUnique: jest.fn() },
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
  // @note default: an empty stream (no newer email) so the yield watcher settles
  // immediately and the turn runs to completion.
  streamChannelEvents: jest.fn(() => (async function* () {})()),
}))

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return { ...actual, captureError: jest.fn(), captureInputError: jest.fn() }
})

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
}))

jest.mock('@/lib/integration.context', () => ({
  setupFrontendHostContext: jest.fn(),
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

jest.mock('@/lib/md.convert', () => ({
  toHtml: jest.fn(async (text) => `<p>${text}</p>`),
}))

jest.mock('@chatbotkit-dev/email', () => ({
  __esModule: true,
  sendEmailAction: jest.fn(async () => undefined),
  formatIntegrationInbox: (integrationId) =>
    `${integrationId}@integration.test`,
  formatIntegrationMessageId: (integrationId) =>
    `<test-${integrationId}@integration.test>`,
  default: {
    sendEmailAction: jest.fn(async () => undefined),
    formatIntegrationInbox: (integrationId) =>
      `${integrationId}@integration.test`,
    parseInboundEmail: jest.fn(async () => null),
  },
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn(async () => 10 * 1024 * 1024),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  uploadConversationAttachmentFromURL: jest.fn(async () => ({
    attachmentId: 'att-1',
    name: 'file.pdf',
    type: 'application/pdf',
  })),
  makeConversationAttachmentUploadActivityMessages: jest.fn(() => ({
    request: { type: 'activity', text: 'uploading' },
    response: { type: 'activity', text: 'uploaded' },
  })),
}))

jest.mock(
  '@/pages/api/v1/integration/email/[emailIntegrationId]/setup',
  () => ({
    doSetup: jest.fn(async () => undefined),
  })
)

describe('Email queue module', () => {
  const emailIntegrationId = 'int-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.emailIntegration.findUnique.mockResolvedValue({
      id: emailIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      name: 'Support Bot',
      emailAddress: 'support@example.com',
      sessionDuration: 86400000,
      contactCollection: false,
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)

    parseAsync.mockResolvedValue(undefined)
  })

  describe('constants and exports', () => {
    it('exports EMAIL_CONTACT_NAMESPACE as a valid UUID', () => {
      expect(EMAIL_CONTACT_NAMESPACE).toBe(
        '128c62b7-a418-41ca-a65d-d53549f8fc75'
      )
    })

    it('exports INTERACT_EVENT_TYPE constant', () => {
      expect(INTERACT_EVENT_TYPE).toBe('interact')
    })

    it('exports INITIATE_EVENT_TYPE constant', () => {
      expect(INITIATE_EVENT_TYPE).toBe('initiate')
    })

    it('exports SEND_EVENT_TYPE constant', () => {
      expect(SEND_EVENT_TYPE).toBe('send')
    })

    it('exports SETUP_EVENT_TYPE constant', () => {
      expect(SETUP_EVENT_TYPE).toBe('setup')
    })

    it('exports InteractPayloadSchema as a Zod schema', () => {
      expect(InteractPayloadSchema).toBeDefined()
      expect(InteractPayloadSchema.parse).toBeDefined()
    })

    it('exports SetupPayloadSchema as a Zod schema', () => {
      expect(SetupPayloadSchema).toBeDefined()
      expect(SetupPayloadSchema.parse).toBeDefined()
    })

    it('exports SendPayloadSchema as a Zod schema', () => {
      expect(SendPayloadSchema).toBeDefined()
      expect(SendPayloadSchema.parse).toBeDefined()
    })
  })

  describe('getEmailConversationEngineOptions', () => {
    it('adds shared email context to engine options', () => {
      const signal = new AbortController().signal

      expect(
        getEmailConversationEngineOptions({
          integration: {
            userId: 'user-1',
            attachments: false,
          },
          email: 'recipient@example.com',
          signal,
        })
      ).toEqual({
        signal,
        backstoryExtra:
          "NB: This conversation is happening over email. The user's email address is recipient@example.com.",
        features: [{ name: 'timeoutMarks' }, { name: 'auth' }, { name: 'time' }],
        userId: 'user-1',
      })
    })

    it('adds attachment feature when attachments are enabled', () => {
      expect(
        getEmailConversationEngineOptions({
          integration: {
            userId: 'user-1',
            attachments: true,
          },
          email: 'recipient@example.com',
        })
      ).toEqual(
        expect.objectContaining({
          features: [
            { name: 'timeoutMarks' },
            { name: 'auth' },
            { name: 'time' },
            { name: 'attachments' },
          ],
        })
      )
    })
  })

  describe('sendEvent', () => {
    it('enqueues interact event', async () => {
      const payload = {
        to: 'support@example.com',
        from: { name: 'John Doe', email: 'john@example.com' },
        subject: 'Help needed',
        message: 'Hello, I need help with my account.',
      }

      await sendEvent(emailIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/email/${emailIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.any(Object)
      )
    })

    it('allocates a per-sender order, nudges, and serializes interact dispatch', async () => {
      const { publishChannelMessage } = await import('@/lib/channel.session')

      const sessionKey = `email-supersede-${emailIntegrationId}-john@example.com`

      const payload = {
        to: 'support@example.com',
        from: { name: 'John Doe', email: 'john@example.com' },
        subject: 'Help needed',
        message: 'Hello',
      }

      await sendEvent(emailIntegrationId, { type: INTERACT_EVENT_TYPE, payload })

      // @note order allocated onto the payload (incr mock returns 1) + nudge
      expect(payload.order).toBe(1)
      expect(memcache.incr).toHaveBeenCalledWith(`${sessionKey}-latest`)
      expect(publishChannelMessage).toHaveBeenCalledWith(
        { id: sessionKey },
        'inbound',
        { order: 1 }
      )

      // @note dispatch serialized per sender so handlers run one at a time
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/email/${emailIntegrationId}/queue`,
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        { flow: { key: sessionKey, parallel: 1 } }
      )
    })

    it('enqueues setup event', async () => {
      await sendEvent(emailIntegrationId, {
        type: SETUP_EVENT_TYPE,
        payload: {},
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/email/${emailIntegrationId}/queue`,
        { type: SETUP_EVENT_TYPE, payload: {} },
        expect.any(Object)
      )
    })

    it('enqueues send event', async () => {
      const payload = {
        email: 'recipient@example.com',
        subject: 'Hello',
        text: 'Already authored text',
      }

      await sendEvent(emailIntegrationId, {
        type: SEND_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/email/${emailIntegrationId}/queue`,
        { type: SEND_EVENT_TYPE, payload },
        expect.any(Object)
      )
    })

    it('enqueues initiate event', async () => {
      const payload = {
        email: 'recipient@example.com',
        subject: 'Hello',
        text: 'Write a concise outreach email',
      }

      await sendEvent(emailIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/email/${emailIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload },
        expect.any(Object)
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(emailIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })
  })

  describe('getConversationSessionId', () => {
    const baseIntegration = {
      id: emailIntegrationId,
      userId: 'user-1',
      sessionDuration: 86400000,
      contactCollection: false,
      bot: { id: 'bot-1' },
    }

    beforeEach(() => {
      memcache.get.mockResolvedValue(null)
    })

    it('creates new conversation when no session exists', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await getConversationSessionId({
        integration: baseIntegration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      expect(result).toBe('conv-1')

      const { createConversation } = await import('@/lib/conversation.create')

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'email',
            email: expect.objectContaining({
              integrationId: emailIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      memcache.get.mockResolvedValue(null)

      await getConversationSessionId({
        integration: baseIntegration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        `email-session-${emailIntegrationId}-user@example.com-msg-123`,
        'conv-1',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('uses custom session duration from integration config', async () => {
      const integration = {
        ...baseIntegration,
        sessionDuration: 3600000, // 1 hour in ms
      }

      memcache.get.mockResolvedValue(null)

      await getConversationSessionId({
        integration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 3600 }) // 1 hour in seconds
      )
    })

    it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
      const integration = {
        ...baseIntegration,
        sessionDuration: null,
      }

      memcache.get.mockResolvedValue(null)

      await getConversationSessionId({
        integration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: ONE_DAY_IN_SECONDS })
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const integration = {
        ...baseIntegration,
        sessionDuration: 0,
      }

      const result = await getConversationSessionId({
        integration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      // no session: a fresh conversation is created and nothing is persisted
      expect(result).toBe('conv-1')
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
    })

    it('reuses existing conversation from session', async () => {
      memcache.get.mockResolvedValue('existing-conv-1')

      const { hasConversation } = await import('@/lib/conversation.find')

      hasConversation.mockResolvedValue(true)

      const result = await getConversationSessionId({
        integration: baseIntegration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      expect(result).toBe('existing-conv-1')

      const { createConversation } = await import('@/lib/conversation.create')

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('creates new conversation if session exists but conversation is gone', async () => {
      memcache.get.mockResolvedValue('old-conv-1')

      const { hasConversation } = await import('@/lib/conversation.find')

      hasConversation.mockResolvedValue(false)

      await getConversationSessionId({
        integration: baseIntegration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      const { createConversation } = await import('@/lib/conversation.create')

      expect(createConversation).toHaveBeenCalled()
    })

    it('uses inReplyTo to find existing conversation', async () => {
      memcache.get.mockResolvedValueOnce(null) // First call for messageId
      memcache.get.mockResolvedValueOnce('reply-conv-1') // Second call for inReplyTo

      const { hasConversation } = await import('@/lib/conversation.find')

      hasConversation.mockResolvedValue(true)

      const result = await getConversationSessionId({
        integration: baseIntegration,
        email: 'user@example.com',
        messageId: 'msg-456',
        inReplyTo: 'msg-123',
      })

      expect(result).toBe('reply-conv-1')
    })

    it('builds session key using integration id, email, and messageId', async () => {
      memcache.get.mockResolvedValue(null)

      await getConversationSessionId({
        integration: baseIntegration,
        email: 'user@example.com',
        messageId: 'msg-123',
      })

      expect(memcache.get).toHaveBeenCalledWith(
        `email-session-${emailIntegrationId}-user@example.com-msg-123`
      )
    })

    it('uses default messageId when not provided', async () => {
      memcache.get.mockResolvedValue(null)

      await getConversationSessionId({
        integration: baseIntegration,
        email: 'user@example.com',
      })

      expect(memcache.get).toHaveBeenCalledWith(
        `email-session-${emailIntegrationId}-user@example.com-default`
      )
    })

    describe('contact collection', () => {
      it('creates contact when contactCollection is enabled', async () => {
        const integration = {
          ...baseIntegration,
          contactCollection: true,
        }

        memcache.get.mockResolvedValue(null)

        await getConversationSessionId({
          integration,
          name: 'John Doe',
          email: 'john@example.com',
          messageId: 'msg-123',
        })

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).toHaveBeenCalledWith(
          { id: 'user-1' },
          expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
          }),
          expect.any(String)
        )
      })

      it('does not create contact when contactCollection is disabled', async () => {
        const integration = {
          ...baseIntegration,
          contactCollection: false,
        }

        memcache.get.mockResolvedValue(null)

        await getConversationSessionId({
          integration,
          name: 'John Doe',
          email: 'john@example.com',
          messageId: 'msg-123',
        })

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).not.toHaveBeenCalled()
      })
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      to: 'support@example.com',
      from: { name: 'John Doe', email: 'john@example.com' },
      subject: 'Help needed',
      message: 'Hello, I need help with my account.',
    }

    it('skips when integration is not found', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(emailIntegrationId, basePayload)
      ).resolves.toBeUndefined()
    })

    it('skips when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInteractEvent(emailIntegrationId, basePayload)
      ).resolves.toBeUndefined()
    })

    it('sends message through the conversation engine', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(),
        receive: jest
          .fn()
          .mockResolvedValue({ text: 'Here is your help!', messages: [] }),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      await handleInteractEvent(emailIntegrationId, basePayload)

      expect(mockEngine.send).toHaveBeenCalledWith(
        'Hello, I need help with my account.'
      )
      expect(mockEngine.receive).toHaveBeenCalled()
    })

    it('skips generation + reply when superseded before generation', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(),
        receive: jest.fn().mockResolvedValue({ text: 'reply', messages: [] }),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      const { sendEmailAction } = await import('@chatbotkit-dev/email')

      // @note the supersede marker (…-latest) reports a newer order (5) than
      // this turn's (3); conversation lookups return null → fresh conversation.
      memcache.get.mockImplementation(async (key) =>
        key.endsWith('-latest') ? '5' : null
      )

      await handleInteractEvent(emailIntegrationId, {
        ...basePayload,
        order: 3,
      })

      // @note message still appended (so the latest handler coalesces it), but
      // generation and the reply are skipped.
      expect(mockEngine.send).toHaveBeenCalled()
      expect(mockEngine.receive).not.toHaveBeenCalled()
      expect(sendEmailAction).not.toHaveBeenCalled()
    })

    it('sends reply email after receiving bot response', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(),
        receive: jest
          .fn()
          .mockResolvedValue({ text: 'Here is your help!', messages: [] }),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      const { sendEmailAction } = await import('@chatbotkit-dev/email')

      await handleInteractEvent(emailIntegrationId, basePayload)

      expect(sendEmailAction).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Help needed',
          to: 'john@example.com',
          from: 'support@example.com',
        })
      )
    })

    it('logs email sent event', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(),
        receive: jest
          .fn()
          .mockResolvedValue({ text: 'Here is your help!', messages: [] }),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      const { logEvent } = await import('@/lib/log')

      await handleInteractEvent(emailIntegrationId, basePayload)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.email.sent',
          relations: expect.objectContaining({
            emailIntegrationId: emailIntegrationId,
          }),
        })
      )
    })

    it('handles attachments', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        id: emailIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        name: 'Support Bot',
        emailAddress: 'support@example.com',
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
          .mockResolvedValue({ text: 'Got your attachment!', messages: [] }),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      const payloadWithAttachments = {
        ...basePayload,
        attachments: [
          {
            name: 'document.pdf',
            size: 1024,
            type: 'application/pdf',
            data: { url: 'https://example.com/document.pdf' },
          },
        ],
      }

      await handleInteractEvent(emailIntegrationId, payloadWithAttachments)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra:
              "NB: This conversation is happening over email. The user's email address is john@example.com.",
            features: [
              {
                name: 'userInfo',
                options: {
                  name: 'John Doe',
                  email: 'john@example.com',
                  externalId: 'john@example.com',
                  source: 'email',
                },
              },
              { name: 'timeoutMarks' },
              { name: 'auth' },
              { name: 'time' },
              { name: 'attachments' },
            ],
            userId: 'user-1',
          }),
        })
      )
      expect(mockEngine.addMessages).toHaveBeenCalled()
    })

    it('sets up frontend host context for the integration user', async () => {
      const { setupFrontendHostContext } = await import(
        '@/lib/integration.context'
      )

      await handleInteractEvent(emailIntegrationId, basePayload)

      expect(setupFrontendHostContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' })
      )
    })
  })

  describe('handleSendEvent', () => {
    const basePayload = {
      email: 'recipient@example.com',
      subject: 'Hello',
      text: 'Already authored text',
      context: 'Recipient prefers short emails',
    }

    it('records authored text as a bot message before sending', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(),
        receive: jest.fn(),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      await handleSendEvent(emailIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra:
              "NB: This conversation is happening over email. The user's email address is recipient@example.com.",
            features: [
              { name: 'timeoutMarks' },
              { name: 'auth' },
              { name: 'time' },
            ],
            userId: 'user-1',
          }),
        })
      )
      expect(mockEngine.addMessages).toHaveBeenCalledWith([
        expect.objectContaining({ type: 'activity' }),
        expect.objectContaining({ type: 'activity' }),
        {
          type: 'bot',
          text: 'Already authored text',
        },
      ])
      expect(mockEngine.send).not.toHaveBeenCalled()
      expect(mockEngine.receive).not.toHaveBeenCalled()
    })

    it('sends the authored text directly', async () => {
      const { sendEmailAction } = await import('@chatbotkit-dev/email')

      await handleSendEvent(emailIntegrationId, basePayload)

      expect(sendEmailAction).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello',
          to: 'recipient@example.com',
          content: {
            text: 'Already authored text',
            html: '<p>Already authored text</p>',
          },
        })
      )
    })

    it('logs the direct send as an email sent event', async () => {
      const { logEvent } = await import('@/lib/log')

      await handleSendEvent(emailIntegrationId, basePayload)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Email Sent',
          description: 'The email was sent to the recipient.',
          type: 'integration.email.sent',
          meta: expect.objectContaining({
            from: formatIntegrationInbox(emailIntegrationId),
            to: 'recipient@example.com',
            subject: 'Hello',
          }),
        })
      )
    })

    it('sets up frontend host context for the integration user', async () => {
      const { setupFrontendHostContext } = await import(
        '@/lib/integration.context'
      )

      await handleSendEvent(emailIntegrationId, basePayload)

      expect(setupFrontendHostContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' })
      )
    })
  })

  describe('handleInitiateEvent', () => {
    const basePayload = {
      email: 'recipient@example.com',
      subject: 'Hello',
      text: 'Write a friendly outreach email',
    }

    it('uses the text as an instruction and sends the agent response', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(),
        receive: jest.fn().mockResolvedValue({
          text: 'Agent-authored outreach',
          messages: [],
        }),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      const { sendEmailAction } = await import('@chatbotkit-dev/email')

      await handleInitiateEvent(emailIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra:
              "NB: This conversation is happening over email. The user's email address is recipient@example.com.",
            features: [
              { name: 'timeoutMarks' },
              { name: 'auth' },
              { name: 'time' },
            ],
            userId: 'user-1',
          }),
        })
      )
      expect(mockEngine.send).toHaveBeenCalledWith(
        'Write a friendly outreach email',
        { type: 'instruction' }
      )
      expect(mockEngine.receive).toHaveBeenCalled()
      expect(sendEmailAction).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello',
          to: 'recipient@example.com',
          content: {
            text: 'Agent-authored outreach',
            html: '<p>Agent-authored outreach</p>',
          },
        })
      )
    })

    it('sets up frontend host context for the integration user', async () => {
      const { setupFrontendHostContext } = await import(
        '@/lib/integration.context'
      )

      await handleInitiateEvent(emailIntegrationId, basePayload)

      expect(setupFrontendHostContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' })
      )
    })
  })

  describe('handleSetupEvent', () => {
    it('skips when integration is not found', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(handleSetupEvent(emailIntegrationId, {})).resolves.toBeUndefined()
    })

    it('calls doSetup with integration', async () => {
      const { doSetup } = await import(
        '@/pages/api/v1/integration/email/[emailIntegrationId]/setup'
      )

      await handleSetupEvent(emailIntegrationId, {})

      expect(doSetup).toHaveBeenCalled()
    })

    it('sets up frontend host context for the integration user', async () => {
      const { setupFrontendHostContext } = await import(
        '@/lib/integration.context'
      )

      await handleSetupEvent(emailIntegrationId, {})

      expect(setupFrontendHostContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' })
      )
    })
  })
})
