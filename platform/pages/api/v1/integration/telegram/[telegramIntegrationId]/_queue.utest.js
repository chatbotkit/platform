/**
 * @jest-environment node
 */
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { accountConversationalLimitsOk } from '@/lib/limit.core'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'
import { markdownToMessages } from '@/lib/telegram.markdown'
import { parseAsync } from '@/lib/zod.schema'

import {
  INITIATE_EVENT_TYPE,
  INTERACT_EVENT_TYPE,
  TELEGRAM_CONTACT_NAMESPACE,
  handleInitiateEvent,
  handleInteractEvent,
  sendEvent,
} from '@/pages/api/v1/integration/telegram/[telegramIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    telegramIntegration: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
}))

jest.mock('@/lib/fetch', () => {
  const fetch = jest.fn()

  return {
    __esModule: true,
    default: fetch,
    fetchPlusPlus: fetch,
    getFetchError: jest.fn(async (res) => new Error(`status ${res.status}`)),
  }
})

jest.mock('@/lib/job', () => ({ runTasks: jest.fn(async () => undefined) }))

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

jest.mock('@/lib/telegram.markdown', () => ({
  markdownToMessages: jest.fn(async (t) => [{ type: 'text', text: t }]),
}))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/session.context', () => ({ updateSessionStore: jest.fn() }))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/channel.session', () => ({
  publishChannelMessage: jest.fn(async () => undefined),
  // @note default: an empty stream (no newer message) so the yield watcher
  // settles immediately and the turn runs to completion. Override per-test to
  // simulate a supersede.
  streamChannelEvents: jest.fn(() => (async function* () {})()),
}))

jest.mock('@/lib/zod.schema', () => {
  const actual = jest.requireActual('@/lib/zod.schema')

  return {
    ...actual,

    parseAsync: jest.fn(async () => undefined),
  }
})

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

jest.mock('@/lib/conversation.attachment', () => ({
  uploadConversationAttachmentFromURL: jest.fn(async () => ({
    attachmentId: 'att-1',
    name: 'photo.jpg',
    type: 'image/jpeg',
  })),
  makeConversationAttachmentUploadActivityMessages: jest.fn(() => ({
    request: { type: 'request' },
    response: { type: 'response' },
  })),
}))

jest.mock('@/lib/user.limits', () => ({
  // @note 5MB - the account plan's attachment cap. The queue must forward this
  // as `maxSize` to the upload, otherwise the shared guard defaults to 0 and
  // rejects every file (the bug this suite regression-tests).
  getMaxFileSize: jest.fn(async () => 5 * 1024 * 1024),
}))

describe('Telegram queue module', () => {
  const telegramIntegrationId = 'int-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.telegramIntegration.findUnique.mockResolvedValue({
      id: telegramIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      botToken: 'bot123:token',
      sessionDuration: 86400000,
      contactCollection: false,
      attachments: false,
      allowFrom: '*',
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)

    const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

    fetchPlusPlus.mockReset()

    fetchPlusPlus.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      status: 200,
    })

    markdownToMessages.mockResolvedValue([{ type: 'text', text: 'reply' }])

    parseAsync.mockResolvedValue(undefined)
  })

  describe('constants', () => {
    it('exports TELEGRAM_CONTACT_NAMESPACE', () => {
      expect(TELEGRAM_CONTACT_NAMESPACE).toBe(
        'a12e2ec7-80e4-4e08-9480-59da798d4d79'
      )
    })

    it('exports INTERACT_EVENT_TYPE', () => {
      expect(INTERACT_EVENT_TYPE).toBe('interact')
    })
  })

  describe('sendEvent', () => {
    it('enqueues interact event with deduplication id', async () => {
      const payload = {
        update_id: 12345,
        message: {
          chat: { id: 999, type: 'private' },
          from: { id: 111, first_name: 'John' },
          text: 'hello',
        },
      }

      await sendEvent(telegramIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/telegram/${telegramIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          deduplicationId: `telegram-${telegramIntegrationId}-interact-12345-999`,
        })
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(telegramIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      update_id: 12345,
      message: {
        chat: { id: 999, type: 'private' },
        from: { id: 111, first_name: 'John', last_name: 'Doe' },
        text: 'hello',
      },
    }

    it('throws when integration is not found', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(telegramIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('throws when integration is not configured (missing botToken)', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: null,
      })

      await expect(
        handleInteractEvent(telegramIntegrationId, basePayload)
      ).rejects.toThrow(/not configured/i)
    })

    it('posts the limits-reached reply and does not throw when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      // @note over-limit + a directly-addressed message (basePayload is a
      // private chat with a bot token) now posts a pre-canned reply instead of
      // throwing, so the user gets a visible signal instead of silence.
      await expect(
        handleInteractEvent(telegramIntegrationId, basePayload)
      ).resolves.toBeUndefined()

      const sendMessageCalls = fetchPlusPlus.mock.calls.filter(
        ([url]) =>
          url === 'https://api.telegram.org/botbot123:token/sendMessage'
      )

      expect(sendMessageCalls).toHaveLength(1)
      expect(JSON.parse(sendMessageCalls[0][1].body)).toMatchObject({
        chat_id: 999,
        text: messages.limitsReachedReply,
      })
    })

    describe('allowFrom restrictions', () => {
      it('blocks all when allowFrom is null (deny by default)', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: null,
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

        await handleInteractEvent(telegramIntegrationId, basePayload)

        expect(fetchPlusPlus).not.toHaveBeenCalled()
      })

      it('silently drops message when userId does not match allowFrom list', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: '@999888777', // different user id
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')
        const { logEvent } = jest.requireMock('@/lib/log')

        await handleInteractEvent(telegramIntegrationId, basePayload) // from.id = 111

        expect(fetchPlusPlus).not.toHaveBeenCalled()
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.telegram.blocked',
            relations: { telegramIntegrationId },
          })
        )
      })

      it('allows message when userId matches allowFrom list', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: '@111', // matches basePayload from.id = 111
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

        await handleInteractEvent(telegramIntegrationId, basePayload)

        expect(fetchPlusPlus).toHaveBeenCalled()
      })

      it('silently drops message when chatId does not match allowFrom list', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: '#-1001234567', // different chat id
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')
        const { logEvent } = jest.requireMock('@/lib/log')

        await handleInteractEvent(telegramIntegrationId, basePayload) // chat.id = 999

        expect(fetchPlusPlus).not.toHaveBeenCalled()
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.telegram.blocked',
            relations: { telegramIntegrationId },
          })
        )
      })

      it('allows message when chatId matches allowFrom list', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: '#999', // matches basePayload chat.id = 999
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

        await handleInteractEvent(telegramIntegrationId, basePayload)

        expect(fetchPlusPlus).toHaveBeenCalled()
      })

      it('allows all when allowFrom contains wildcard', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: '*',
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

        await handleInteractEvent(telegramIntegrationId, basePayload)

        expect(fetchPlusPlus).toHaveBeenCalled()
      })

      it('allows message when from.username matches allowFrom list', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: '@johndoe',
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

        const payload = {
          ...basePayload,
          message: {
            ...basePayload.message,
            from: { ...basePayload.message.from, username: 'johndoe' },
          },
        }

        await handleInteractEvent(telegramIntegrationId, payload)

        expect(fetchPlusPlus).toHaveBeenCalled()
      })

      it('silently drops message when from.username does not match allowFrom list', async () => {
        prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
          id: telegramIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'bot123:token',
          allowFrom: '@alice', // different username
        })

        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')
        const { logEvent } = jest.requireMock('@/lib/log')

        const payload = {
          ...basePayload,
          message: {
            ...basePayload.message,
            from: { ...basePayload.message.from, username: 'bob' },
          },
        }

        await handleInteractEvent(telegramIntegrationId, payload)

        expect(fetchPlusPlus).not.toHaveBeenCalled()
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.telegram.blocked',
            relations: { telegramIntegrationId },
          })
        )
      })
    })

    it('deletes session and returns for ///restart command', async () => {
      const payload = {
        ...basePayload,
        message: { ...basePayload.message, text: '///restart' },
      }

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(memcache.del).toHaveBeenCalledWith(
        `telegram-session-${telegramIntegrationId}-999`
      )

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      expect(fetchPlusPlus).not.toHaveBeenCalled()
    })

    it('deletes session and returns for ///reset command', async () => {
      const payload = {
        ...basePayload,
        message: { ...basePayload.message, text: '///reset' },
      }

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(memcache.del).toHaveBeenCalledWith(
        `telegram-session-${telegramIntegrationId}-999`
      )
    })

    it('deletes session and returns for ///new command', async () => {
      const payload = {
        ...basePayload,
        message: { ...basePayload.message, text: '///new' },
      }

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(memcache.del).toHaveBeenCalledWith(
        `telegram-session-${telegramIntegrationId}-999`
      )
    })

    it('creates a new conversation when no session exists', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'telegram',
            telegram: expect.objectContaining({
              integrationId: telegramIntegrationId,
            }),
          }),
        })
      )
      expect(memcache.set).toHaveBeenCalled()
    })

    it('uses existing conversation from session', async () => {
      memcache.get.mockResolvedValueOnce('existing-conv-1')

      const { hasConversation } = await import('@/lib/conversation.find')

      hasConversation.mockResolvedValueOnce(true)

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('creates new conversation if session exists but conversation is gone', async () => {
      memcache.get.mockResolvedValueOnce('old-conv-1')

      const { hasConversation } = await import('@/lib/conversation.find')

      hasConversation.mockResolvedValueOnce(false)

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('sends text message and receives reply', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const mockEngine = {
        send: jest.fn(async () => undefined),
        receive: jest.fn(async () => ({ text: 'bot reply', messages: [] })),
        addMessages: jest.fn(async () => undefined),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(mockEngine.send).toHaveBeenCalledWith('hello')
      expect(mockEngine.receive).toHaveBeenCalled()
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
          // pushing TAG_ERROR, having already reported the raw error (with its
          // cause chain) to Sentry at the throw site. The sink must NOT
          // re-capture - doing so produces a duplicate, stack-less, cause-less
          // event (the regression pattern).

          await sink.push(TAG_ERROR, { code: 'GENERIC_ERROR', message: 'boom' })

          return {
            send: jest.fn(async () => undefined),
            receive: jest.fn(async () => ({ text: 'bot reply', messages: [] })),
            addMessages: jest.fn(async () => undefined),
            dispose: jest.fn(async () => undefined),
          }
        }
      )

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(captureError).not.toHaveBeenCalled()
    })

    it('sends Telegram text message via API', async () => {
      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('sends each text chunk as a separate Telegram message', async () => {
      markdownToMessages.mockResolvedValueOnce([
        { type: 'text', text: 'first chunk' },
        { type: 'text', text: 'second chunk' },
      ])

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      const sendMessageCalls = fetchPlusPlus.mock.calls.filter(
        ([url]) =>
          url === 'https://api.telegram.org/botbot123:token/sendMessage'
      )

      expect(sendMessageCalls).toHaveLength(2)
      expect(JSON.parse(sendMessageCalls[0][1].body)).toMatchObject({
        chat_id: 999,
        text: 'first chunk',
      })
      expect(JSON.parse(sendMessageCalls[1][1].body)).toMatchObject({
        chat_id: 999,
        text: 'second chunk',
      })
    })

    it('sends Telegram typing indicator before bot reply', async () => {
      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/sendChatAction',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"action":"typing"'),
        })
      )
    })

    it('keeps sending Telegram typing indicators while reply is pending', async () => {
      jest.useFakeTimers()

      try {
        const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )

        /** @type {(value: {text: string, messages: Array<any>}) => void} */
        let resolveReceive

        const receivePromise = new Promise((resolve) => {
          resolveReceive = resolve
        })

        getStatefulConversationEngine.mockResolvedValueOnce({
          send: jest.fn(async () => undefined),
          receive: jest.fn(() => receivePromise),
          addMessages: jest.fn(async () => undefined),
          dispose: jest.fn(async () => undefined),
        })

        const handlerPromise = handleInteractEvent(
          telegramIntegrationId,
          basePayload
        )

        await jest.advanceTimersByTimeAsync(0)

        let sendChatActionCalls = fetchPlusPlus.mock.calls.filter(
          ([url]) =>
            url === 'https://api.telegram.org/botbot123:token/sendChatAction'
        )

        expect(sendChatActionCalls).toHaveLength(1)

        await jest.advanceTimersByTimeAsync(4000)

        sendChatActionCalls = fetchPlusPlus.mock.calls.filter(
          ([url]) =>
            url === 'https://api.telegram.org/botbot123:token/sendChatAction'
        )

        expect(sendChatActionCalls).toHaveLength(2)

        resolveReceive({ text: 'reply', messages: [] })

        await handlerPromise

        await jest.advanceTimersByTimeAsync(4000)

        sendChatActionCalls = fetchPlusPlus.mock.calls.filter(
          ([url]) =>
            url === 'https://api.telegram.org/botbot123:token/sendChatAction'
        )

        expect(sendChatActionCalls).toHaveLength(2)
      } finally {
        jest.useRealTimers()
      }
    })

    it('handles image responses from conversation engine', async () => {
      markdownToMessages.mockResolvedValueOnce([
        { type: 'image', image: 'https://example.com/image.jpg' },
      ])

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/sendPhoto',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('handles video responses from conversation engine', async () => {
      markdownToMessages.mockResolvedValueOnce([
        { type: 'video', video: 'https://example.com/video.mp4' },
      ])

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/sendVideo',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('handles audio responses from conversation engine', async () => {
      markdownToMessages.mockResolvedValueOnce([
        { type: 'audio', audio: 'https://example.com/audio.mp3' },
      ])

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/sendAudio',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('handles voice responses from conversation engine', async () => {
      markdownToMessages.mockResolvedValueOnce([
        { type: 'voice', voice: 'https://example.com/reply.ogg' },
      ])

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/sendVoice',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('handles file responses from conversation engine', async () => {
      markdownToMessages.mockResolvedValueOnce([
        { type: 'file', file: 'https://example.com/report.pdf' },
      ])

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/sendDocument',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('handles non-private chats by setting context namespace to blank', async () => {
      const { setContextNamespace } = await import('@/lib/context.store')

      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          chat: { id: 999, type: 'group' },
        },
      }

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(setContextNamespace).toHaveBeenCalledWith('')
    })

    it('creates contact when contactCollection is enabled', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 0,
        contactCollection: true,
        attachments: false,
        allowFrom: '*',
      })

      const { ensureTrustedContact, createContactFingerprint } = await import(
        '@/lib/contact.create'
      )

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(ensureTrustedContact).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          name: 'John Doe',
          meta: expect.objectContaining({
            app: 'telegram',
            telegramUserId: 111,
          }),
        }),
        expect.any(String)
      )
      expect(createContactFingerprint).toHaveBeenCalledWith(
        TELEGRAM_CONTACT_NAMESPACE,
        [111]
      )
    })

    it('does not associate contact in non-private chat', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 0,
        contactCollection: true,
        attachments: false,
        allowFrom: '*',
      })

      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          chat: { id: 999, type: 'supergroup' },
        },
      }

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          contactId: undefined,
        })
      )
    })

    it('handles photo attachments when integration.attachments is true', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 0,
        contactCollection: false,
        attachments: true,
        allowFrom: '*',
      })

      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          text: undefined,
          photo: [{ file_id: 'file-abc' }],
        },
      }

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      fetchPlusPlus
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { file_path: 'photos/file.jpg' } }),
          status: 200,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true }),
          status: 200,
        })

      const { uploadConversationAttachmentFromURL } = await import(
        '@/lib/conversation.attachment'
      )
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: [
              {
                name: 'userInfo',
                options: {
                  name: 'John Doe',
                  externalId: '111',
                  source: 'telegram',
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
      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/getFile',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ file_id: 'file-abc' }),
        })
      )
      expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
        'conv-1',
        'https://api.telegram.org/file/botbot123:token/photos/file.jpg',
        undefined,
        { maxSize: 5 * 1024 * 1024 }
      )
    })

    it('handles document and voice attachments when integration.attachments is true', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 0,
        contactCollection: false,
        attachments: true,
        allowFrom: '*',
      })

      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          text: undefined,
          document: { file_id: 'file-doc' },
          voice: { file_id: 'file-voice' },
        },
      }

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      fetchPlusPlus
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { file_path: 'docs/file.pdf' } }),
          status: 200,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { file_path: 'voice/file.ogg' } }),
          status: 200,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true }),
          status: 200,
        })

      const { uploadConversationAttachmentFromURL } = await import(
        '@/lib/conversation.attachment'
      )

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/getFile',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ file_id: 'file-doc' }),
        })
      )
      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot123:token/getFile',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ file_id: 'file-voice' }),
        })
      )
      expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
        'conv-1',
        'https://api.telegram.org/file/botbot123:token/docs/file.pdf',
        undefined,
        { maxSize: 5 * 1024 * 1024 }
      )
      expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
        'conv-1',
        'https://api.telegram.org/file/botbot123:token/voice/file.ogg',
        undefined,
        { maxSize: 5 * 1024 * 1024 }
      )
    })

    it('does not upload attachments when integration.attachments is false', async () => {
      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          text: 'hello',
          photo: [{ file_id: 'file-abc' }],
        },
      }

      const { uploadConversationAttachmentFromURL } = await import(
        '@/lib/conversation.attachment'
      )

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(uploadConversationAttachmentFromURL).not.toHaveBeenCalled()
    })

    it('forwards the account max file size for a voice-only message (regression: 0-byte default limit silently dropped voice notes)', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 0,
        contactCollection: false,
        attachments: true,
        allowFrom: '*',
      })

      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          text: undefined,
          voice: { file_id: 'file-voice' },
        },
      }

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      fetchPlusPlus
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { file_path: 'voice/file.ogg' } }),
          status: 200,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true }),
          status: 200,
        })

      const { uploadConversationAttachmentFromURL } = await import(
        '@/lib/conversation.attachment'
      )
      const { getMaxFileSize } = await import('@/lib/user.limits')

      await handleInteractEvent(telegramIntegrationId, payload)

      // @note the plan limit is resolved from the integration's user and passed
      // through as `maxSize`; without it the upload throws "Attachment is too
      // large" (LIMITS_REACHED) and the voice note is dropped with no reply.
      expect(getMaxFileSize).toHaveBeenCalledWith({
        id: 'user-1',
        name: 'Test',
      })
      expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
        'conv-1',
        'https://api.telegram.org/file/botbot123:token/voice/file.ogg',
        undefined,
        { maxSize: 5 * 1024 * 1024 }
      )
    })

    it('handles media caption text when message.text is missing', async () => {
      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          text: undefined,
          caption: 'caption from photo',
          photo: [{ file_id: 'file-abc' }],
        },
      }

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const mockEngine = {
        send: jest.fn(async () => undefined),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        addMessages: jest.fn(async () => undefined),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(mockEngine.send).toHaveBeenCalledWith('caption from photo')
    })

    it('returns early when no messages are sent (no text, no attachments)', async () => {
      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          text: undefined,
          photo: undefined,
        },
      }

      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const mockEngine = {
        send: jest.fn(async () => undefined),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        addMessages: jest.fn(async () => undefined),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(mockEngine.receive).not.toHaveBeenCalled()
    })

    it('handles business_connection_id in messages', async () => {
      const payload = {
        ...basePayload,
        message: {
          ...basePayload.message,
          business_connection_id: 'biz-123',
        },
      }

      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      await handleInteractEvent(telegramIntegrationId, payload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('biz-123'),
        })
      )
    })

    it('sets session with custom duration when specified', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 7200000, // 2 hours in milliseconds
        contactCollection: false,
        attachments: false,
        allowFrom: '*',
      })

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { ex: 7200 }
      )
    })

    it('handles Telegram API errors gracefully without throwing', async () => {
      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')

      fetchPlusPlus.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal error' }),
      })

      // @note the implementation catches and logs Telegram API send errors without rethrowing them

      await expect(
        handleInteractEvent(telegramIntegrationId, basePayload)
      ).resolves.toBeUndefined()
    })

    it('updates session context with user info', async () => {
      const { updateSessionStore } = await import('@/lib/session.context')
      const { setContextUser } = await import('@/lib/context.store')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(updateSessionStore).toHaveBeenCalled()
      expect(setContextUser).toHaveBeenCalled()
    })
  })

  describe('session management', () => {
    const basePayload = {
      update_id: 12345,
      message: {
        message_id: 1,
        chat: { id: 222, type: 'private' },
        from: { id: 111, first_name: 'John', last_name: 'Doe' },
        text: 'hello',
      },
    }

    it('builds session key using integration id and chat id', async () => {
      await handleInteractEvent(telegramIntegrationId, basePayload)

      // basePayload chat.id === 222 (a DM, where chat.id is the user id)
      expect(memcache.get).toHaveBeenCalledWith(
        `telegram-session-${telegramIntegrationId}-222`
      )
    })

    it('uses different session keys for different chats', async () => {
      const groupPayload = {
        update_id: 12346,
        message: {
          message_id: 1,
          chat: { id: 999, type: 'group' },
          from: { id: 111, first_name: 'John', last_name: 'Doe' },
          text: 'hello',
        },
      }

      await handleInteractEvent(telegramIntegrationId, groupPayload)

      // keyed on the group's chat.id, not the sender
      expect(memcache.get).toHaveBeenCalledWith(
        `telegram-session-${telegramIntegrationId}-999`
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 0,
        contactCollection: false,
        attachments: false,
        allowFrom: '*',
      })

      await handleInteractEvent(telegramIntegrationId, basePayload)

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: null,
        contactCollection: false,
        attachments: false,
        allowFrom: '*',
      })

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 86400 }) // 1 day in seconds
      )
    })

    it('uses custom session duration from integration config', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'bot123:token',
        sessionDuration: 3600000, // 1 hour in ms
        contactCollection: false,
        attachments: false,
        allowFrom: '*',
      })

      await handleInteractEvent(telegramIntegrationId, basePayload)

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

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()

      // @note sliding window: the session TTL is refreshed on reuse
      expect(memcache.expire).toHaveBeenCalledWith(
        expect.stringContaining('-session-'),
        expect.any(Number)
      )
    })

    it('creates new conversation when session exists but conversation is gone', async () => {
      memcache.get.mockResolvedValueOnce('stale-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('creates new conversation when no session exists in redis', async () => {
      memcache.get.mockResolvedValueOnce(null)

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'telegram',
            telegram: expect.objectContaining({
              integrationId: telegramIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      memcache.get.mockResolvedValueOnce(null)

      await handleInteractEvent(telegramIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `telegram-session-${telegramIntegrationId}-222`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    describe('session reset commands', () => {
      it('resets session for ///restart command', async () => {
        const payload = {
          update_id: 12347,
          message: {
            ...basePayload.message,
            text: '///restart',
          },
        }

        await handleInteractEvent(telegramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `telegram-session-${telegramIntegrationId}-222`
        )
      })

      it('resets session for ///reset command', async () => {
        const payload = {
          update_id: 12348,
          message: {
            ...basePayload.message,
            text: '///reset',
          },
        }

        await handleInteractEvent(telegramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for ///new command', async () => {
        const payload = {
          update_id: 12349,
          message: {
            ...basePayload.message,
            text: '///new',
          },
        }

        await handleInteractEvent(telegramIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })
    })
  })

  describe('handleInitiateEvent', () => {
    const baseInitiatePayload = {
      chatId: '9876543210',
      text: 'Hello from bot!',
    }

    it('throws when integration is not found', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInitiateEvent(telegramIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('throws when integration has no bot token', async () => {
      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: null,
        sessionDuration: 0,
      })

      await expect(
        handleInitiateEvent(telegramIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/not configured/i)
    })

    it('throws when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInitiateEvent(telegramIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/Limits exceeded/i)
    })

    it('sends message to Telegram API and creates conversation', async () => {
      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(telegramIntegrationId, baseInitiatePayload)

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        expect.stringContaining('api.telegram.org/botbot123:token/sendMessage'),
        expect.objectContaining({
          method: 'POST',
        })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'telegram',
            telegram: expect.objectContaining({
              integrationId: telegramIntegrationId,
              chatId: '9876543210',
              initiated: true,
            }),
          }),
        })
      )
    })

    it('stores session under chat-based key', async () => {
      await handleInitiateEvent(telegramIntegrationId, baseInitiatePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `telegram-session-${telegramIntegrationId}-9876543210`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('does not create conversation when Telegram API returns error', async () => {
      const { fetchPlusPlus } = jest.requireMock('@/lib/fetch')
      const { logEvent } = jest.requireMock('@/lib/log')
      const { createConversation } = await import('@/lib/conversation.create')

      fetchPlusPlus.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })

      await handleInitiateEvent(telegramIntegrationId, baseInitiatePayload)

      expect(createConversation).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.telegram.api.error',
          name: 'Telegram Initiate Message Error',
          meta: expect.objectContaining({
            operation: 'sendMessage',
            chatId: '9876543210',
            error: expect.objectContaining({
              message: expect.stringContaining('status 400'),
            }),
          }),
        })
      )
    })

    it('includes context messages when context is provided', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(telegramIntegrationId, {
        ...baseInitiatePayload,
        context: {
          linkedConversationId: 'conv-abc',
          text: 'Background info',
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
      await sendEvent(telegramIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload: baseInitiatePayload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/telegram/${telegramIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload: baseInitiatePayload },
        {}
      )
    })

    it('returns early when integration has no bot configured', async () => {
      const { captureUnexpectedState } = await import('@/lib/error')
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.telegramIntegration.findUnique.mockResolvedValueOnce({
        id: telegramIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: null,
        botToken: 'bot123:token',
        sessionDuration: 0,
        contactCollection: false,
        attachments: false,
      })

      await handleInitiateEvent(telegramIntegrationId, baseInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('no bot configured'),
        expect.objectContaining({ telegramIntegrationId })
      )
      expect(createConversation).not.toHaveBeenCalled()
    })
  })
})
