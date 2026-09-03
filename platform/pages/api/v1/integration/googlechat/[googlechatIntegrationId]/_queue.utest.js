/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { accountConversationalLimitsOk } from '@/lib/limit.core'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'

import {
  INITIATE_EVENT_TYPE,
  INTERACT_EVENT_TYPE,
  InitiatePayloadSchema,
  InteractPayloadSchema,
  SETUP_EVENT_TYPE,
  getGoogleChatInitiateDmSessionKey,
  getGoogleChatInitiateSessionKey,
  getGoogleChatInteractDeduplicationId,
  handleInitiateEvent,
  handleInteractEvent,
  handleSetupEvent,
  isGoogleChatPrivateInteraction,
  isGoogleChatUnthreadedSpace,
  sendEvent,
} from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    googlechatIntegration: { findUnique: jest.fn() },
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

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return {
    ...actual,
    captureError: jest.fn(),
    captureInputError: jest.fn(),
    captureException: jest.fn(),
    captureUnexpectedState: jest.fn(),
  }
})

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

jest.mock('@/lib/job', () => ({ runTasks: jest.fn(async () => undefined) }))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
  setContextFrontendHost: jest.fn(),
}))

jest.mock('@/lib/session.context', () => ({
  updateSessionStore: jest.fn(),
}))

jest.mock('@/lib/zod.schema', () => {
  const actual = jest.requireActual('@/lib/zod.schema')

  return {
    ...actual,
    parseAsync: jest.fn(async (schema, data) => {
      return schema.parseAsync(data)
    }),
  }
})

jest.mock('@/lib/googlechat.api', () => ({
  getGoogleChatAccessToken: jest.fn(async () => 'google-access-token'),
  getGoogleChatAttachmentMediaDownloadUrl: jest.fn(
    (resourceName) =>
      `https://chat.googleapis.com/v1/media/${resourceName}?alt=media`
  ),
  resolveGoogleChatSpace: jest.fn(async (_integration, space) =>
    space.startsWith('spaces/') ? space : 'spaces/dm1'
  ),
  sendGoogleChatMessage: jest.fn(async () => ({})),
  sendGoogleChatImageMessage: jest.fn(async () => ({})),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  uploadConversationAttachmentFromURL: jest.fn(async () => ({
    attachmentId: 'attachment-123',
    name: 'attachment.pdf',
    type: 'application/pdf',
  })),
  makeConversationAttachmentUploadActivityMessages: jest.fn(() => ({
    request: { type: 'activity', text: 'upload request' },
    response: { type: 'activity', text: 'upload response' },
  })),
}))

jest.mock('@/lib/googlechat.markdown', () => ({
  markdownToMessages: jest.fn(async (text) => [{ type: 'text', text }]),
}))

jest.mock('@/lib/googlechat.validation', () => ({
  parseGoogleChatAllowFrom: jest.fn(() => [{ type: 'wildcard' }]),
  googleChatSenderIsAllowed: jest.fn(() => true),
}))

jest.mock('@/lib/integration.context', () => ({
  setupFrontendHostContext: jest.fn(async () => undefined),
}))

jest.mock('@/lib/user.session', () => ({
  userToSessionUser: jest.fn((u) => u),
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn(async () => 1024 * 1024),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({ name: 'AI' })),
}))

jest.mock('@/lib/contact.create', () => ({
  createContactFingerprint: jest.fn(() => 'googlechat-contact-fingerprint'),
  ensureTrustedContact: jest.fn(async () => ({ id: 'contact-123' })),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(async () => ({ id: 'conv-abc' })),
}))

jest.mock('@/lib/conversation.find', () => ({
  hasConversation: jest.fn(async () => true),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(async () => ({
    addMessages: jest.fn(async () => undefined),
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({ text: 'AI response here' })),
    dispose: jest.fn(async () => undefined),
  })),
}))

jest.mock('@/lib/conversation.tag', () => ({
  TAG_TOKEN: 'token',
  TAG_ERROR: 'error',
  TAG_OPERATION_BEGIN: 'operation_begin',
  TAG_REASONING_TOKEN: 'reasoning_token',
  createSinkEvent: jest.fn((item) => item),
}))

jest.mock('@/lib/debug', () => {
  const fn = jest.fn(() => ({ log: jest.fn() }))

  fn.warn = jest.fn(() => ({ log: jest.fn() }))

  return { __esModule: true, default: fn, warn: fn.warn }
})

jest.mock(
  '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/setup',
  () => ({
    doSetup: jest.fn(async () => undefined),
  })
)

describe('Google Chat queue', () => {
  const mockUser = { id: 'user-123', email: 'user@example.com' }

  const mockIntegration = {
    id: 'gc-int-123',
    userId: 'user-123',
    user: mockUser,
    bot: {
      id: 'bot-456',
      name: 'TestBot',
      backstory: 'You are a helpful assistant.',
    },
    serviceAccountKey:
      '{"type":"service_account","client_email":"sa@project.iam.gserviceaccount.com","private_key":"PRIVATE_KEY"}',
    projectNumber: '123456789',
    contactCollection: false,
    attachments: false,
    sessionDuration: null,
    autoRespond: null,
    allowFrom: '*',
  }

  const validInteractPayload = {
    senderName: 'users/u1',
    senderDisplayName: 'Alice',
    spaceName: 'spaces/space1',
    spaceDisplayName: 'My Space',
    spaceType: 'ROOM',
    messageName: 'spaces/space1/messages/msg1',
    threadName: 'spaces/space1/threads/t1',
    text: 'Hello there',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendEvent', () => {
    it('queues an interact event with deduplication id', async () => {
      await sendEvent('gc-int-123', {
        type: INTERACT_EVENT_TYPE,
        payload: validInteractPayload,
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/googlechat/gc-int-123/queue',
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        expect.objectContaining({
          deduplicationId: expect.stringContaining('googlechat-gc-int-123'),
        })
      )
    })

    it('allocates a per-session order, nudges, and serializes interact dispatch', async () => {
      const { publishChannelMessage } = await import('@/lib/channel.session')

      const payload = { ...validInteractPayload }

      await sendEvent('gc-int-123', {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      // @note order allocated onto the payload (incr mock returns 1) + nudge
      expect(payload.order).toBe(1)
      expect(memcache.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^googlechat-session-.*-latest$/)
      )
      expect(publishChannelMessage).toHaveBeenCalledWith(
        { id: expect.stringMatching(/^googlechat-session-/) },
        'inbound',
        { order: 1 }
      )

      // @note dispatch now serialized per session (was dedup-only before)
      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/googlechat/gc-int-123/queue',
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        expect.objectContaining({
          flow: {
            key: expect.stringMatching(/^googlechat-session-/),
            parallel: 1,
          },
        })
      )
    })

    it('uses event time for deduplication when message name is missing', async () => {
      await sendEvent('gc-int-123', {
        type: INTERACT_EVENT_TYPE,
        payload: {
          ...validInteractPayload,
          messageName: '',
          eventTime: '2026-05-18T07:04:02.454207Z',
          slashCommand: {
            commandId: 444,
            commandName: '/daily-brief',
            type: 'QUICK_COMMAND',
          },
          text: '/daily-brief',
        },
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/googlechat/gc-int-123/queue',
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        expect.objectContaining({
          deduplicationId: expect.stringContaining(
            '2026-05-18T07:04:02.454207Z'
          ),
        })
      )
    })

    it('does not deduplicate interact events without a message name or event time', async () => {
      await sendEvent('gc-int-123', {
        type: INTERACT_EVENT_TYPE,
        payload: {
          ...validInteractPayload,
          messageName: '',
        },
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/googlechat/gc-int-123/queue',
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        expect.not.objectContaining({ deduplicationId: expect.anything() })
      )
    })

    it('does not include message text in the deduplication id', () => {
      expect(
        getGoogleChatInteractDeduplicationId('gc-int-123', {
          messageName: 'spaces/space1/messages/msg1',
          eventTime: '2026-05-18T07:04:02.454207Z',
        })
      ).toBe('googlechat-gc-int-123-interact-spaces/space1/messages/msg1')
    })

    it('keeps repeated text messages distinct by message id', () => {
      const first = getGoogleChatInteractDeduplicationId('gc-int-123', {
        messageName: 'spaces/space1/messages/msg1',
        eventTime: '2026-05-18T07:04:02.454207Z',
      })
      const second = getGoogleChatInteractDeduplicationId('gc-int-123', {
        messageName: 'spaces/space1/messages/msg2',
        eventTime: '2026-05-18T07:04:03.454207Z',
      })

      expect(first).not.toBe(second)
    })

    it('queues a setup event without deduplication id', async () => {
      await sendEvent('gc-int-123', {
        type: SETUP_EVENT_TYPE,
        payload: {},
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/googlechat/gc-int-123/queue',
        expect.objectContaining({ type: SETUP_EVENT_TYPE }),
        expect.not.objectContaining({ deduplicationId: expect.anything() })
      )
    })

    it('queues an initiate event without deduplication id', async () => {
      await sendEvent('gc-int-123', {
        type: INITIATE_EVENT_TYPE,
        payload: {
          space: 'spaces/space1',
          text: 'Hello there',
        },
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/googlechat/gc-int-123/queue',
        expect.objectContaining({ type: INITIATE_EVENT_TYPE }),
        expect.not.objectContaining({ deduplicationId: expect.anything() })
      )
    })

    it('throws on invalid interact payload', async () => {
      await expect(
        sendEvent('gc-int-123', {
          type: INTERACT_EVENT_TYPE,
          payload: { text: 'missing required fields' }, // missing senderName etc.
        })
      ).rejects.toThrow()
    })

    it('throws on invalid initiate payload', async () => {
      await expect(
        sendEvent('gc-int-123', {
          type: INITIATE_EVENT_TYPE,
          payload: {
            text: 'missing space',
          },
        })
      ).rejects.toThrow()
    })
  })

  describe('handleInteractEvent', () => {
    it('returns early when integration not found', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(null)

      await expect(
        handleInteractEvent('nonexistent', validInteractPayload)
      ).rejects.toThrow()
    })

    it('returns early when no bot configured', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        bot: null,
      })

      accountConversationalLimitsOk.mockResolvedValue(true)

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(sendGoogleChatMessage).not.toHaveBeenCalled()
    })

    it('blocks sender when not in allowFrom list', async () => {
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(false)

      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { logEvent } = await import('@/lib/log')

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(sendGoogleChatMessage).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.googlechat.blocked',
        })
      )
    })

    it('sends AI response after successful conversation', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(sendGoogleChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' }),
        'spaces/space1',
        'AI response here',
        'spaces/space1/threads/t1'
      )
    })

    it('logs Google Chat API errors when reply delivery fails', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )
      const { logEvent } = await import('@/lib/log')

      googleChatSenderIsAllowed.mockReturnValue(true)

      const error = new Error(
        `Failed to send Google Chat message: 403: {"error":{"status":"PERMISSION_DENIED","message":"This organization's administrator must allow users to install this Chat app"}}`
      )

      error.code = 'CONFLICT'

      sendGoogleChatMessage.mockRejectedValueOnce(error)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.googlechat.api.error',
          name: 'Google Chat Reply Error',
          relations: expect.objectContaining({
            googlechatIntegrationId: 'gc-int-123',
            botId: 'bot-456',
            conversationId: 'conv-abc',
          }),
          meta: expect.objectContaining({
            operation: 'spaces.messages.create',
            error: expect.objectContaining({
              code: 'CONFLICT',
              message: expect.stringContaining('PERMISSION_DENIED'),
            }),
            payload: expect.objectContaining({
              spaceName: 'spaces/space1',
              threadName: 'spaces/space1/threads/t1',
            }),
          }),
        })
      )
    })

    it('replies inline (no thread) when the space is a DM', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        spaceType: 'DM',
      })

      expect(sendGoogleChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' }),
        'spaces/space1',
        'AI response here',
        undefined
      )
    })

    it('replies at the space level when Google Chat marks the space as unthreaded', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        spaceThreadingState: 'UNTHREADED_MESSAGES',
      })

      expect(sendGoogleChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' }),
        'spaces/space1',
        'AI response here',
        undefined
      )
    })

    it('sends private replies for slash command interactions', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 7,
          commandName: '/ask',
          type: 'INVOKE',
        },
      })

      expect(sendGoogleChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' }),
        'spaces/space1',
        'AI response here',
        'spaces/space1/threads/t1',
        { privateMessageViewerName: 'users/u1' }
      )
    })

    it('skips the reply when superseded before generation', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        sessionDuration: 3600000,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      // @note conversation lookups return an existing conversation; the supersede
      // marker (…-latest) reports a newer order (5) than this turn's (3).
      memcache.get.mockImplementation(async (key) =>
        typeof key === 'string' && key.endsWith('-latest') ? '5' : 'conv-abc'
      )

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        order: 3,
      })

      expect(sendGoogleChatMessage).not.toHaveBeenCalled()
    })

    it('validates slash command metadata in interact payloads', () => {
      const result = InteractPayloadSchema.safeParse({
        ...validInteractPayload,
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 7,
          type: 'INVOKE',
        },
      })

      expect(result.success).toBe(true)
    })

    it('treats DM conversations as trusted for context-backed auth', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        spaceType: 'DM',
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: false,
        })
      )
    })

    it('treats private command interactions as trusted for context-backed auth', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 444,
          commandName: '/googlechat-quick-command-444',
          type: 'QUICK_COMMAND',
        },
        text: '/googlechat-quick-command-444',
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: false,
        })
      )
    })

    it('treats ROOM conversations as untrusted for context-backed auth', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: true,
        })
      )
    })

    it('treats missing space type as untrusted by default', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      const { spaceType, ...payloadWithoutSpaceType } = validInteractPayload

      await handleInteractEvent('gc-int-123', payloadWithoutSpaceType)

      expect(spaceType).toBe('ROOM')
      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: true,
        })
      )
    })

    it('passes Google Chat runtime context to the conversation engine', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: expect.stringContaining(
              'This conversation is happening inside Google Chat.'
            ),
          }),
        })
      )
      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: expect.stringContaining(
              'Space Display Name: My Space'
            ),
          }),
        })
      )
    })

    it('does not re-capture errors pushed to the sink (engine captures at source)', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )
      const { TAG_ERROR } = await import('@/lib/conversation.tag')
      const { captureError } = await import('@/lib/error')

      googleChatSenderIsAllowed.mockReturnValue(true)

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          // @note the engine normalizes errors to {code, message} before
          // pushing TAG_ERROR, having already reported the raw error (with its
          // cause chain) to Sentry at the throw site. The sink must NOT
          // re-capture - doing so produces a duplicate, stack-less, cause-less
          // event (the regression pattern).

          await sink.push(TAG_ERROR, { code: 'GENERIC_ERROR', message: 'boom' })

          return {
            send: jest.fn(async () => undefined),
            receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
            dispose: jest.fn(async () => undefined),
          }
        }
      )

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(captureError).not.toHaveBeenCalled()
    })

    it('creates new conversation when no existing session', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { createConversation } = await import('@/lib/conversation.create')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'googlechat',
            googlechat: expect.objectContaining({
              integrationId: 'gc-int-123',
            }),
          }),
        })
      )
    })

    it('creates and associates a trusted contact for DM conversations when contact collection is enabled', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        contactCollection: true,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { createConversation } = await import('@/lib/conversation.create')
      const { createContactFingerprint, ensureTrustedContact } = await import(
        '@/lib/contact.create'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        spaceType: 'DM',
      })

      expect(createContactFingerprint).toHaveBeenCalledWith(
        expect.any(String),
        ['123456789', 'users/u1']
      )
      expect(ensureTrustedContact).toHaveBeenCalledWith(
        { id: 'user-123' },
        expect.objectContaining({
          name: 'Alice',
          nick: 'users/u1',
          meta: expect.objectContaining({
            app: 'googlechat',
            googlechat: expect.objectContaining({
              integrationId: 'gc-int-123',
              projectNumber: '123456789',
              senderName: 'users/u1',
              senderDisplayName: 'Alice',
              spaceName: 'spaces/space1',
            }),
          }),
        }),
        'googlechat-contact-fingerprint'
      )
      expect(createConversation).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          contactId: 'contact-123',
        })
      )
    })

    it('does not create or associate a contact for shared spaces', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        contactCollection: true,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { createConversation } = await import('@/lib/conversation.create')
      const { ensureTrustedContact } = await import('@/lib/contact.create')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(ensureTrustedContact).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          contactId: undefined,
        })
      )
    })

    it('creates and associates a trusted contact for private command interactions', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        contactCollection: true,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { createConversation } = await import('@/lib/conversation.create')
      const { ensureTrustedContact } = await import('@/lib/contact.create')
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 444,
          commandName: '/googlechat-quick-command-444',
          type: 'QUICK_COMMAND',
        },
        text: '/googlechat-quick-command-444',
      })

      expect(ensureTrustedContact).toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          contactId: 'contact-123',
        })
      )
    })

    it('uploads Google Chat attachments into the conversation when attachments are enabled', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        attachments: true,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const {
        getGoogleChatAccessToken,
        getGoogleChatAttachmentMediaDownloadUrl,
      } = await import('@/lib/googlechat.api')
      const {
        makeConversationAttachmentUploadActivityMessages,
        uploadConversationAttachmentFromURL,
      } = await import('@/lib/conversation.attachment')
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        attachments: [
          {
            name: 'spaces/space1/messages/msg1/attachments/a1',
            contentName: 'brief.pdf',
            contentType: 'application/pdf',
            source: 'UPLOADED_CONTENT',
            attachmentDataRef: {
              resourceName: 'spaces/space1/messages/msg1/attachments/a1',
            },
          },
        ],
      })

      const engine = await getStatefulConversationEngine.mock.results[0].value

      expect(getGoogleChatAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' })
      )
      expect(getGoogleChatAttachmentMediaDownloadUrl).toHaveBeenCalledWith(
        'spaces/space1/messages/msg1/attachments/a1'
      )
      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: [
              {
                name: 'userInfo',
                options: {
                  name: 'Alice',
                  externalId: 'users/u1',
                  source: 'googlechat',
                },
              },
              { name: 'timeoutMarks' },
              { name: 'auth' },
              { name: 'time' },
              { name: 'attachments' },
            ],
          }),
        })
      )
      expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
        'conv-abc',
        'https://chat.googleapis.com/v1/media/spaces/space1/messages/msg1/attachments/a1?alt=media',
        {
          Authorization: 'Bearer google-access-token',
        },
        {
          maxSize: 1024 * 1024,
          name: 'brief.pdf',
          type: 'application/pdf',
        }
      )
      expect(
        makeConversationAttachmentUploadActivityMessages
      ).toHaveBeenCalledWith({
        id: 'attachment-123',
        name: 'attachment.pdf',
        type: 'application/pdf',
      })
      expect(engine.addMessages).toHaveBeenCalledWith([
        { type: 'activity', text: 'upload request' },
        { type: 'activity', text: 'upload response' },
      ])
    })

    it('skips Google Chat attachments when attachments are disabled', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        attachments: false,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { uploadConversationAttachmentFromURL } = await import(
        '@/lib/conversation.attachment'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        attachments: [
          {
            attachmentDataRef: {
              resourceName: 'spaces/space1/messages/msg1/attachments/a1',
            },
          },
        ],
      })

      expect(uploadConversationAttachmentFromURL).not.toHaveBeenCalled()
    })

    it('processes media-only messages without sending an unsolicited reply', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        attachments: true,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { uploadConversationAttachmentFromURL } = await import(
        '@/lib/conversation.attachment'
      )
      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        text: '',
        attachments: [
          {
            attachmentDataRef: {
              resourceName: 'spaces/space1/messages/msg1/attachments/a1',
            },
          },
        ],
      })

      expect(uploadConversationAttachmentFromURL).toHaveBeenCalled()
      expect(sendGoogleChatMessage).not.toHaveBeenCalled()
    })

    it('stores session under the thread-scoped key for ROOM spaces', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat-session-room-gc-int-123-spaces/space1/threads/t1',
        'conv-abc',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        sessionDuration: 0,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent('gc-int-123', validInteractPayload)

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('stores session under the space-scoped key for unthreaded ROOM spaces', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        spaceThreadingState: 'UNTHREADED_MESSAGES',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat-session-room-gc-int-123-spaces/space1',
        'conv-abc',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('stores session under the sender-scoped key for DM spaces', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        spaceType: 'DM',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat-session-dm-gc-int-123-users/u1',
        'conv-abc',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('stores session under the sender-scoped key for private command interactions', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        privateMessageViewerName: 'users/u1',
        slashCommand: {
          commandId: 444,
          commandName: '/googlechat-quick-command-444',
          type: 'QUICK_COMMAND',
        },
        text: '/googlechat-quick-command-444',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat-session-dm-gc-int-123-users/u1',
        'conv-abc',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('stores session with custom duration when configured', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        sessionDuration: 3600000,
      })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-abc',
        expect.objectContaining({ ex: 3600 })
      )
    })

    it('resets session on ///restart command', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      googleChatSenderIsAllowed.mockReturnValue(true)

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')

      await handleInteractEvent('gc-int-123', {
        ...validInteractPayload,
        text: '///restart',
      })

      expect(memcache.del).toHaveBeenCalledWith(
        expect.stringContaining('googlechat-session-room-gc-int-123')
      )
      expect(sendGoogleChatMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'spaces/space1',
        expect.stringContaining('reset'),
        'spaces/space1/threads/t1'
      )
    })
  })

  describe('handleInitiateEvent', () => {
    const validInitiatePayload = {
      space: 'spaces/space1',
      text: 'Hello from the bot',
    }

    it('sends a message and creates a session-backed conversation', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent('gc-int-123', validInitiatePayload)

      expect(sendGoogleChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' }),
        'spaces/space1',
        'Hello from the bot'
      )
      expect(createConversation).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              type: 'bot',
              text: 'Hello from the bot',
            }),
          ]),
          meta: expect.objectContaining({
            app: 'googlechat',
            googlechat: expect.objectContaining({
              integrationId: 'gc-int-123',
              spaceName: 'spaces/space1',
              initiated: true,
            }),
          }),
        })
      )
      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat-session-room-gc-int-123-spaces/space1',
        'conv-abc',
        expect.objectContaining({ ex: 86400 })
      )
      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat-session-dm-gc-int-123-spaces/space1',
        'conv-abc',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('resolves a direct message space from user notation', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)

      const { resolveGoogleChatSpace, sendGoogleChatMessage } = await import(
        '@/lib/googlechat.api'
      )

      await handleInitiateEvent('gc-int-123', {
        space: 'person@example.com',
        text: 'Hello from the bot',
      })

      expect(resolveGoogleChatSpace).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' }),
        'person@example.com'
      )
      expect(sendGoogleChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gc-int-123' }),
        'spaces/dm1',
        'Hello from the bot'
      )
      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat-session-dm-gc-int-123-spaces/dm1',
        'conv-abc',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('captures unexpected state when bot is missing', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        bot: null,
      })

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { captureUnexpectedState } = await import('@/lib/error')

      await handleInitiateEvent('gc-int-123', validInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('no bot configured'),
        expect.objectContaining({ googlechatIntegrationId: 'gc-int-123' })
      )
      expect(sendGoogleChatMessage).not.toHaveBeenCalled()
    })

    it('captures unexpected state when service account key is missing', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        serviceAccountKey: null,
      })

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { captureUnexpectedState } = await import('@/lib/error')

      await handleInitiateEvent('gc-int-123', validInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('no service account key'),
        expect.objectContaining({ googlechatIntegrationId: 'gc-int-123' })
      )
      expect(sendGoogleChatMessage).not.toHaveBeenCalled()
    })

    it('captures send failures without creating a conversation', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)

      const { sendGoogleChatMessage } = await import('@/lib/googlechat.api')
      const { createConversation } = await import('@/lib/conversation.create')
      const { captureUnexpectedState } = await import('@/lib/error')

      sendGoogleChatMessage.mockRejectedValueOnce(new Error('Chat API failed'))

      await handleInitiateEvent('gc-int-123', validInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('initiate message failed'),
        expect.objectContaining({
          googlechatIntegrationId: 'gc-int-123',
          spaceName: 'spaces/space1',
        })
      )
      expect(createConversation).not.toHaveBeenCalled()
    })
  })

  describe('isGoogleChatPrivateInteraction', () => {
    it('treats DMs and private command replies as private interactions', () => {
      expect(
        isGoogleChatPrivateInteraction({
          spaceType: 'DM',
        })
      ).toBe(true)

      expect(
        isGoogleChatPrivateInteraction({
          spaceType: 'ROOM',
          privateMessageViewerName: 'users/u1',
        })
      ).toBe(true)

      expect(
        isGoogleChatPrivateInteraction({
          spaceType: 'ROOM',
        })
      ).toBe(false)
    })
  })

  describe('isGoogleChatUnthreadedSpace', () => {
    it('detects Google Chat unthreaded spaces', () => {
      expect(
        isGoogleChatUnthreadedSpace({
          spaceThreadingState: 'UNTHREADED_MESSAGES',
        })
      ).toBe(true)

      expect(
        isGoogleChatUnthreadedSpace({
          spaceThreadingState: 'THREADED_MESSAGES',
        })
      ).toBe(false)
    })
  })

  describe('signal propagation', () => {
    it('passes signal from context to the conversation engine', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')
      googleChatSenderIsAllowed.mockReturnValue(true)

      const abortController = new AbortController()

      await handleInteractEvent('gc-int-123', validInteractPayload, {
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

      const { googleChatSenderIsAllowed } = await import(
        '@/lib/googlechat.validation'
      )

      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-abc')
      googleChatSenderIsAllowed.mockReturnValue(true)

      await handleInteractEvent('gc-int-123', validInteractPayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            signal: undefined,
          }),
        })
      )
    })
  })

  describe('handleSetupEvent', () => {
    it('returns early when integration not found', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(null)

      await expect(handleSetupEvent('nonexistent', {})).rejects.toThrow()
    })

    it('calls doSetup with the integration', async () => {
      prisma.googlechatIntegration.findUnique.mockResolvedValue(mockIntegration)

      const { doSetup } = await import(
        '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/setup'
      )

      await handleSetupEvent('gc-int-123', {})

      expect(doSetup).toHaveBeenCalledWith(mockIntegration)
    })
  })

  describe('InteractPayloadSchema', () => {
    it('validates a complete interact payload', () => {
      const result = InteractPayloadSchema.safeParse(validInteractPayload)

      expect(result.success).toBe(true)
    })

    it('validates a minimal payload without optional fields', () => {
      const minimal = {
        senderName: 'users/u1',
        senderDisplayName: 'Alice',
        spaceName: 'spaces/abc',
        text: 'Hello',
      }
      const result = InteractPayloadSchema.safeParse(minimal)

      expect(result.success).toBe(true)
    })

    it('fails when required fields are missing', () => {
      const result = InteractPayloadSchema.safeParse({
        text: 'missing senderName and spaceName',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('InitiatePayloadSchema', () => {
    it('validates a complete initiate payload', () => {
      const result = InitiatePayloadSchema.safeParse({
        space: 'spaces/space1',
        text: 'Hello there',
      })

      expect(result.success).toBe(true)
    })

    it('validates user notation in the space field', () => {
      const result = InitiatePayloadSchema.safeParse({
        space: 'person@example.com',
        text: 'Hello there',
      })

      expect(result.success).toBe(true)
    })

    it('fails when required fields are missing', () => {
      const result = InitiatePayloadSchema.safeParse({
        text: 'missing space',
      })

      expect(result.success).toBe(false)
    })

    it('fails when a thread name is provided', () => {
      const result = InitiatePayloadSchema.safeParse({
        space: 'spaces/space1',
        threadName: 'spaces/space1/threads/t1',
        text: 'Hello there',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('getGoogleChatInitiateSessionKey', () => {
    it('uses a space key for initiated conversations', () => {
      expect(
        getGoogleChatInitiateSessionKey('gc-int-123', {
          space: 'spaces/dm1',
        })
      ).toBe('googlechat-session-room-gc-int-123-spaces/dm1')
    })

    it('uses a DM fallback key for initiated conversations', () => {
      expect(
        getGoogleChatInitiateDmSessionKey('gc-int-123', {
          space: 'spaces/space1',
        })
      ).toBe('googlechat-session-dm-gc-int-123-spaces/space1')
    })
  })
})
