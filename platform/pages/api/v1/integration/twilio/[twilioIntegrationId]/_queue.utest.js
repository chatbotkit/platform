/**
 * @jest-environment node
 */
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { TAG_COMPLETE_END, TAG_TOKEN } from '@/lib/conversation.tag'
import fetch from '@/lib/fetch'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import queue from '@/lib/queue'
import memcache from '@/lib/memcache'
import { createTwilioConversationRelayXml } from '@/lib/twilio.twiml'
import { parseAsync } from '@/lib/zod.schema'

import {
  INITIATE_EVENT_TYPE,
  INTERACT_EVENT_TYPE,
  InitiatePayloadSchema,
  InteractPayloadSchema,
  TWILIO_CONTACT_NAMESPACE,
  VOICE_RELAY_CALL_SESSION_ACTIVITY,
  createRelayChannelUrl,
  handleInitiateEvent,
  handleInteractEvent,
  sendEvent,
  sendTwilioSmsFallbackMessages,
} from '@/pages/api/v1/integration/twilio/[twilioIntegrationId]/queue'

import WebSocket from 'ws'

const relayBaseUrl = 'https://relay.example.com'

jest.mock('@chatbotkit-dev/relay', () => ({
  __esModule: true,
  default: {
    channelUrl: (channelId, side, options = {}) => {
      const url = new URL(
        `/channel/${encodeURIComponent(channelId)}`,
        process.env.CFWSRELAY_BASE_URL
      )

      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      url.searchParams.set('side', side)

      if (options.events) {
        url.searchParams.set('events', '1')
      }

      return url.toString()
    },
  },
}))

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    twilioIntegration: { findUnique: jest.fn() },
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

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return { ...actual, captureError: jest.fn(), captureInputError: jest.fn() }
})

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

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

jest.mock('@/lib/fetch', () => jest.fn(async () => ({ ok: true })))

jest.mock('ws', () => {
  class MockWebSocket {
    static OPEN = 1
    static instances = []
    static messages = []

    constructor(url) {
      this.url = url
      this.readyState = 0
      this.handlers = new Map()
      this.send = jest.fn()
      MockWebSocket.instances.push(this)

      setImmediate(() => {
        this.readyState = MockWebSocket.OPEN
        this.emit('open')

        setImmediate(() => {
          for (const message of MockWebSocket.messages) {
            this.emit('message', JSON.stringify(message))
          }

          setImmediate(() => {
            this.readyState = 3
            this.emit('close', 1000, Buffer.from('test complete'))
          })
        })
      })
    }

    on(event, handler) {
      const handlers = this.handlers.get(event) || []

      handlers.push(handler)
      this.handlers.set(event, handlers)

      return this
    }

    off(event, handler) {
      const handlers = this.handlers.get(event) || []

      this.handlers.set(
        event,
        handlers.filter((candidate) => candidate !== handler)
      )

      return this
    }

    emit(event, ...args) {
      for (const handler of this.handlers.get(event) || []) {
        handler(...args)
      }
    }

    close() {
      this.readyState = 3
      this.emit('close', 1000, Buffer.from('closed'))
    }
  }

  return {
    __esModule: true,
    default: MockWebSocket,
  }
})

jest.mock('@/lib/promise', () => ({
  sleep: jest.fn(async () => null),
}))

jest.mock('@/lib/conversation.find', () => ({
  hasConversation: jest.fn(async () => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(async () => ({
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
    steer: jest.fn(async () => ({ text: 'reply', messages: [] })),
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

jest.mock('@/lib/twilio.markdown', () => ({
  markdownToMessages: jest.fn(async (text) => [{ type: 'text', text }]),
}))

jest.mock('@/lib/channel.core', () => ({
  publishChannelMessage: jest.fn(async () => undefined),
}))

describe('Twilio queue module', () => {
  const twilioIntegrationId = 'int-xyz'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CFWSRELAY_BASE_URL = relayBaseUrl
    WebSocket.instances = []
    WebSocket.messages = []

    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: twilioIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      accountSid: 'AC123',
      authToken: 'auth-token',
      sessionDuration: 86400000,
      contactCollection: false,
      allowFrom: '*',
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)

    parseAsync.mockResolvedValue(undefined)
  })

  describe('constants and exports', () => {
    it('exports TWILIO_CONTACT_NAMESPACE as a valid UUID', () => {
      expect(TWILIO_CONTACT_NAMESPACE).toBe(
        '5bd7fb78-73be-48aa-8a1e-e4e1984fed22'
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

    it('exports InitiatePayloadSchema as a Zod schema', () => {
      expect(InitiatePayloadSchema).toBeDefined()
      expect(InitiatePayloadSchema.parse).toBeDefined()
    })
  })

  describe('sendEvent', () => {
    it('enqueues interact event', async () => {
      const payload = {
        channelId: 'twilio-abc123',
        from: '+1234567890',
        body: 'Hello',
        messageSid: 'SM123',
      }

      await sendEvent(twilioIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/twilio/${twilioIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        {
          deduplicationId: `twilio-${twilioIntegrationId}-interact-SM123`,
        }
      )
    })

    it('enqueues interact event with messageSid deduplication id', async () => {
      const payload = {
        channelId: 'twilio-abc123',
        from: '+1234567890',
        body: 'Hello',
        messageSid: 'SM123',
      }

      await sendEvent(twilioIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/twilio/${twilioIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        {
          deduplicationId: `twilio-${twilioIntegrationId}-interact-SM123`,
        }
      )
    })

    it('enqueues initiate event', async () => {
      const payload = {
        from: '+10987654321',
        to: '+1234567890',
        text: 'Start the conversation',
      }

      await sendEvent(twilioIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalledWith(
        InitiatePayloadSchema,
        payload,
        expect.any(Function)
      )
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/twilio/${twilioIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload },
        {}
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(twilioIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      channelId: 'twilio-abc123',
      from: '+1234567890',
      body: 'hello',
      messageSid: 'SM123',
    }

    it('throws when integration is not found', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(twilioIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('sends the pre-canned limits-reached reply instead of throwing when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInteractEvent(twilioIntegrationId, {
          ...basePayload,
          from: '+447911123456',
          to: '+16513956925',
        })
      ).resolves.toBeUndefined()

      expect(fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.any(URLSearchParams),
        })
      )

      const requestBody = fetch.mock.calls[0][1].body

      // @note reply goes back to the inbound sender, from the integration number
      expect(requestBody.get('From')).toBe('+16513956925')
      expect(requestBody.get('To')).toBe('+447911123456')
      expect(requestBody.get('Body')).toBe(messages.limitsReachedReply)
    })

    describe('allowFrom restrictions', () => {
      it('allows message when allowFrom is wildcard (*)', async () => {
        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(accountConversationalLimitsOk).toHaveBeenCalled()
      })

      it('allows message when sender matches allowFrom entry', async () => {
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          accountSid: 'AC123',
          authToken: 'auth-token',
          sessionDuration: 86400000,
          contactCollection: false,
          allowFrom: '1234567890',
        })

        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(accountConversationalLimitsOk).toHaveBeenCalled()
      })

      it('blocks message and logs event when sender is not allowed', async () => {
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          accountSid: 'AC123',
          authToken: 'auth-token',
          sessionDuration: 86400000,
          contactCollection: false,
          allowFrom: '+447911123456',
        })

        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Sender Blocked',
            type: 'integration.twilio.blocked',
            relations: {
              twilioIntegrationId,
            },
            meta: {
              from: '+1234567890',
            },
          })
        )
      })

      it('blocks all senders when allowFrom is empty', async () => {
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          accountSid: 'AC123',
          authToken: 'auth-token',
          sessionDuration: 86400000,
          contactCollection: false,
          allowFrom: '',
        })

        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
      })
    })

    describe('session reset commands', () => {
      it('resets session for ///restart command', async () => {
        const payload = {
          ...basePayload,
          body: '///restart',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `twilio-session-${twilioIntegrationId}-+1234567890`
        )
      })

      it('resets session for ///reset command', async () => {
        const payload = {
          ...basePayload,
          body: '///reset',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles case insensitive reset commands', async () => {
        const payload = {
          ...basePayload,
          body: '///RESTART',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('handles reset commands with whitespace', async () => {
        const payload = {
          ...basePayload,
          body: '  ///restart  ',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })
    })

    describe('conversation creation', () => {
      it('creates new conversation when no session exists', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(twilioIntegrationId, basePayload)

        const { createConversation } = await import('@/lib/conversation.create')

        expect(createConversation).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            meta: expect.objectContaining({
              app: 'twilio',
              twilio: expect.objectContaining({
                integrationId: twilioIntegrationId,
              }),
            }),
          })
        )
      })

      it('stores session in redis after creating conversation', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          `twilio-session-${twilioIntegrationId}-+1234567890`,
          'conv-1',
          expect.objectContaining({ ex: expect.any(Number) })
        )
      })

      it('normalizes the inbound `from` so it keys the same session as a normalized initiate `to`', async () => {
        memcache.get.mockResolvedValue(null)

        await handleInteractEvent(twilioIntegrationId, {
          ...basePayload,
          from: '+1 (415) 523-8886',
        })

        // @note keyed on canonical E.164, not the raw formatted number, so a
        // bot-initiated `to` and this reply resolve to the same conversation
        expect(memcache.set).toHaveBeenCalledWith(
          `twilio-session-${twilioIntegrationId}-+14155238886`,
          'conv-1',
          expect.objectContaining({ ex: expect.any(Number) })
        )
      })

      it('reuses existing conversation from session', async () => {
        memcache.get.mockResolvedValue('existing-conv-1')

        const { hasConversation } = await import('@/lib/conversation.find')

        hasConversation.mockResolvedValue(true)

        await handleInteractEvent(twilioIntegrationId, basePayload)

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
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          sessionDuration: 86400000,
          contactCollection: true,
          allowFrom: '*',
        })

        await handleInteractEvent(twilioIntegrationId, basePayload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

        expect(ensureTrustedContact).toHaveBeenCalled()
      })

      it('does not create contact when contactCollection is disabled', async () => {
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          sessionDuration: 86400000,
          contactCollection: false,
          allowFrom: '*',
        })

        await handleInteractEvent(twilioIntegrationId, basePayload)

        const { ensureTrustedContact } = await import('@/lib/contact.create')

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

        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(mockEngine.send).toHaveBeenCalledWith('hello')
      })

      it('skips sending when body is empty', async () => {
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
          body: '',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(mockEngine.send).not.toHaveBeenCalled()
      })
    })

    describe('response to channel message publishing', () => {
      it('publishes response to channel', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn().mockResolvedValue({ text: 'Hello back!' }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        await handleInteractEvent(twilioIntegrationId, basePayload)

        const { publishChannelMessage } = await import('@/lib/channel.core')

        expect(publishChannelMessage).toHaveBeenCalledWith(
          'twilio-abc123',
          expect.objectContaining({
            xml: expect.stringContaining('Response'),
          })
        )
      })

      it('publishes SMS response as Message TwiML', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn().mockResolvedValue({ text: 'Hello back!' }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        await handleInteractEvent(twilioIntegrationId, basePayload)

        const { publishChannelMessage } = await import('@/lib/channel.core')
        const xml = publishChannelMessage.mock.calls[0][1].xml

        expect(xml).toContain('<Message>Hello back!</Message>')
        expect(xml).not.toContain('<Gather')
        expect(xml).not.toContain('<Say')
      })

      it('publishes voice response as ConversationRelay TwiML', async () => {
        await handleInteractEvent(twilioIntegrationId, {
          channelId: 'twilio-voice-abc123',
          from: '+1234567890',
          body: 'hello',
          callSid: 'CA123',
        })

        const { publishChannelMessage } = await import('@/lib/channel.core')
        const relayUrl =
          'wss://relay.example.com/channel/twilio-voice-abc123?side=twilio'

        expect(publishChannelMessage).toHaveBeenCalledWith(
          'twilio-voice-abc123',
          expect.objectContaining({
            xml: createTwilioConversationRelayXml(relayUrl, {
              reportInputDuringAgentSpeech: 'speech',
            }),
          })
        )

        const xml = publishChannelMessage.mock.calls[0][1].xml

        expect(xml).toContain('<ConversationRelay')
        expect(xml).toContain(`url="${relayUrl}"`)
        expect(xml).toContain('reportInputDuringAgentSpeech="speech"')
        expect(xml).not.toContain('interruptible="speech"')
        expect(xml).not.toContain('welcomeGreeting=')
        expect(xml).not.toContain('<Gather')
        expect(xml).not.toContain('<Say')
        expect(xml).not.toContain('<Message')
        expect(fetch).not.toHaveBeenCalled()
      })

      it('sends a greeting instruction after Twilio setup on inbound voice relay', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn().mockResolvedValue({ text: 'Hello caller!' }),
          steer: jest.fn().mockResolvedValue({ text: 'Hello caller!' }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)
        WebSocket.messages = [{ type: 'setup', callSid: 'CA123' }]

        await handleInteractEvent(twilioIntegrationId, {
          channelId: 'twilio-voice-abc123',
          from: '+1234567890',
          body: 'hello',
          callSid: 'CA123',
        })

        expect(mockEngine.send).not.toHaveBeenCalled()
        expect(mockEngine.receive).not.toHaveBeenCalled()
        expect(mockEngine.steer).toHaveBeenCalledWith('Great the user.', {
          type: 'instruction',
        })
      })

      it('adds setup call SID activity when initiated voice learns the SID from relay setup', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn().mockResolvedValue({ text: 'Hello caller!' }),
          steer: jest.fn().mockResolvedValue({ text: 'Hello caller!' }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)
        WebSocket.messages = [{ type: 'setup', callSid: 'CA456' }]

        await handleInitiateEvent(twilioIntegrationId, {
          channel: 'call',
          from: '+15005550006',
          to: '+447911123456',
          text: 'Call the customer',
        })

        expect(mockEngine.addMessages).toHaveBeenCalledWith([
          expect.objectContaining({
            type: 'activity',
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'request',
                function: expect.objectContaining({
                  name: VOICE_RELAY_CALL_SESSION_ACTIVITY,
                  arguments: {
                    callSid: 'CA456',
                  },
                }),
              }),
            }),
          }),
          expect.objectContaining({
            type: 'activity',
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'response',
                function: expect.objectContaining({
                  name: VOICE_RELAY_CALL_SESSION_ACTIVITY,
                  arguments: {
                    callSid: 'CA456',
                  },
                  result: {
                    event: 'setup',
                  },
                }),
              }),
            }),
          }),
        ])
      })

      it('marks the final streamed text token as last for ConversationRelay', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        let mockEngine

        getStatefulConversationEngine.mockImplementationOnce(
          async ({ options: engineOptions }) => {
            mockEngine = {
              send: jest.fn(),
              receive: jest.fn(),
              steer: jest.fn(async (_text, steerOptions = {}) => {
                if (steerOptions.type === 'instruction') {
                  return { text: 'Greeting' }
                }

                await engineOptions.sink.push(TAG_TOKEN, { token: 'Hello' })
                await engineOptions.sink.push(TAG_TOKEN, { token: ' there' })
                await engineOptions.sink.push(TAG_COMPLETE_END, {})

                return { text: 'Hello there' }
              }),
              addMessages: jest.fn(),
              dispose: jest.fn(async () => undefined),
            }

            return mockEngine
          }
        )
        WebSocket.messages = [
          { type: 'setup', callSid: 'CA123' },
          { type: 'prompt', voicePrompt: 'Hi there', last: true },
        ]

        await handleInteractEvent(twilioIntegrationId, {
          channelId: 'twilio-voice-abc123',
          from: '+1234567890',
          body: 'hello',
          callSid: 'CA123',
        })

        const [socket] = WebSocket.instances
        const sentMessages = socket.send.mock.calls.map(([data]) =>
          JSON.parse(data)
        )

        expect(sentMessages).toEqual([
          expect.objectContaining({
            type: 'text',
            token: 'Hello',
            last: false,
          }),
          expect.objectContaining({
            type: 'text',
            token: ' there',
            last: true,
          }),
        ])
        expect(sentMessages).not.toContainEqual(
          expect.objectContaining({
            type: 'text',
            token: '',
            last: true,
          })
        )
        expect(mockEngine.steer).toHaveBeenCalledWith('Hi there')
        expect(mockEngine.receive).not.toHaveBeenCalled()
      })

      it('does not use stale-turn polling in relay voice mode', async () => {
        await handleInteractEvent(twilioIntegrationId, {
          channelId: 'twilio-old-turn',
          from: '+1234567890',
          body: 'what time is it',
          callSid: 'CA123',
        })

        const { publishChannelMessage } = await import('@/lib/channel.core')
        const xml = publishChannelMessage.mock.calls[0][1].xml

        expect(xml).toContain('<ConversationRelay')
        expect(xml).toContain('/channel/twilio-old-turn?side=twilio')
        expect(xml).not.toContain('<Gather')
        expect(xml).not.toContain('<Say>Old answer</Say>')
        expect(fetch).not.toHaveBeenCalled()
      })

      it('adds a call session activity marker when voice reuses an existing conversation', async () => {
        const { hasConversation } = await import('@/lib/conversation.find')
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn().mockResolvedValue({ text: 'Hello back!' }),
          steer: jest.fn().mockResolvedValue({ text: 'Hello back!' }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        memcache.get.mockResolvedValueOnce('conv-existing')
        hasConversation.mockResolvedValueOnce(true)
        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        await handleInteractEvent(twilioIntegrationId, {
          channelId: 'twilio-voice-abc123',
          from: '+1234567890',
          body: 'hello',
          callSid: 'CA123',
        })

        expect(mockEngine.addMessages).toHaveBeenCalledWith([
          expect.objectContaining({
            type: 'activity',
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'request',
                function: expect.objectContaining({
                  name: VOICE_RELAY_CALL_SESSION_ACTIVITY,
                  arguments: {
                    callSid: 'CA123',
                    channelId: 'twilio-voice-abc123',
                  },
                }),
              }),
            }),
          }),
          expect.objectContaining({
            type: 'activity',
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'response',
                function: expect.objectContaining({
                  name: VOICE_RELAY_CALL_SESSION_ACTIVITY,
                  arguments: {
                    callSid: 'CA123',
                    channelId: 'twilio-voice-abc123',
                  },
                  result: {
                    event: 'started',
                  },
                }),
              }),
            }),
          }),
        ])
      })

      it('uses integration voice language for ConversationRelay TwiML', async () => {
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          accountSid: 'AC123',
          authToken: 'auth-token',
          voice: 'twilio/language=en-GB/voice=Polly.Emma',
          sessionDuration: 86400000,
          contactCollection: false,
          allowFrom: '*',
        })

        await handleInteractEvent(twilioIntegrationId, {
          channelId: 'twilio-voice-abc123',
          from: '+1234567890',
          body: 'hello',
          callSid: 'CA123',
        })

        const { publishChannelMessage } = await import('@/lib/channel.core')
        const xml = publishChannelMessage.mock.calls[0][1].xml

        expect(xml).toContain('<ConversationRelay')
        expect(xml).toContain('ttsLanguage="en-GB"')
        expect(xml).toContain('reportInputDuringAgentSpeech="speech"')
        expect(xml).not.toContain('welcomeGreeting=')
        expect(xml).toContain('voice="Polly.Emma"')
      })

      it('creates websocket relay URLs from the configured HTTP base URL', () => {
        const baseUrl = new URL(process.env.CFWSRELAY_BASE_URL)

        if (baseUrl.protocol === 'https:') {
          baseUrl.protocol = 'wss:'
        } else if (baseUrl.protocol === 'http:') {
          baseUrl.protocol = 'ws:'
        }

        expect(createRelayChannelUrl('twilio-voice-abc123', 'twilio')).toBe(
          `${baseUrl.origin}/channel/twilio-voice-abc123?side=twilio`
        )

        expect(
          createRelayChannelUrl('twilio-voice-abc123', 'app', { events: true })
        ).toBe(
          `${baseUrl.origin}/channel/twilio-voice-abc123?side=app&events=1`
        )
      })

      it('sends fallback SMS through Twilio API when webhook delivery is not confirmed', async () => {
        const { getStatefulConversationEngine } = await import(
          '@/lib/conversation.engine'
        )
        const mockEngine = {
          send: jest.fn(),
          receive: jest.fn().mockResolvedValue({ text: 'Hello back!' }),
          steer: jest.fn().mockResolvedValue({ text: 'Hello back!' }),
          addMessages: jest.fn(),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValue(mockEngine)

        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          accountSid: 'AC123',
          authToken: 'auth-token',
          sessionDuration: 86400000,
          contactCollection: false,
          allowFrom: '*',
        })

        await handleInteractEvent(twilioIntegrationId, {
          ...basePayload,
          from: '+447911123456',
          to: '+16513956925',
          deliveredKey: 'twilio-webhook-delivered-twilio-abc123',
          deliveryCheckAt: 0,
        })

        expect(fetch).toHaveBeenCalledWith(
          'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: expect.stringMatching(/^Basic /),
              'Content-Type': 'application/x-www-form-urlencoded',
            }),
            body: expect.any(URLSearchParams),
          })
        )

        const requestBody = fetch.mock.calls[0][1].body

        expect(requestBody.get('From')).toBe('+16513956925')
        expect(requestBody.get('To')).toBe('+447911123456')
        expect(requestBody.get('Body')).toBe('Hello back!')
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Twilio Message Sent',
            type: 'integration.twilio.sent',
            relations: {
              twilioIntegrationId,
            },
            meta: expect.objectContaining({
              from: '+16513956925',
              to: '+447911123456',
              messageType: 'text',
            }),
          })
        )
      })

      it('does not send fallback SMS when webhook delivery is confirmed', async () => {
        memcache.get.mockResolvedValueOnce(null).mockResolvedValueOnce('1')

        await handleInteractEvent(twilioIntegrationId, {
          ...basePayload,
          to: '+10987654321',
          deliveredKey: 'twilio-webhook-delivered-twilio-abc123',
          deliveryCheckAt: 0,
        })

        expect(fetch).not.toHaveBeenCalled()
      })

      it('skips fallback SMS when delivery coordination is not configured', async () => {
        await sendTwilioSmsFallbackMessages({
          integration: {
            accountSid: 'AC123',
            authToken: 'auth-token',
          },
          payload: {
            from: '+1234567890',
            to: '+10987654321',
            body: 'hello',
            channelId: 'twilio-abc123',
            messageSid: 'SM123',
          },
          messages: [{ type: 'text', text: 'reply' }],
        })

        expect(fetch).not.toHaveBeenCalled()
      })
    })

    describe('session duration', () => {
      it('uses default session duration when not specified', async () => {
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          sessionDuration: null,
          contactCollection: false,
          allowFrom: '*',
        })

        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          expect.any(String),
          'conv-1',
          expect.objectContaining({ ex: 86400 }) // ONE_DAY_IN_SECONDS
        )
      })

      it('uses custom session duration when specified', async () => {
        prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
          id: twilioIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          sessionDuration: 3600000, // 1 hour in ms
          contactCollection: false,
          allowFrom: '*',
        })

        await handleInteractEvent(twilioIntegrationId, basePayload)

        expect(memcache.set).toHaveBeenCalledWith(
          expect.any(String),
          'conv-1',
          expect.objectContaining({ ex: 3600 }) // 1 hour in seconds
        )
      })
    })
  })

  describe('handleInitiateEvent', () => {
    const basePayload = {
      from: '+16513956925',
      to: '+447911123456',
      text: 'Start the conversation',
    }

    it('throws when integration is not found', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInitiateEvent(twilioIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('sends model-authored SMS through Twilio API', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const mockEngine = {
        send: jest.fn(),
        receive: jest.fn().mockResolvedValue({ text: 'Hello by SMS!' }),
        addMessages: jest.fn(),
        dispose: jest.fn(async () => undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(mockEngine)

      await handleInitiateEvent(twilioIntegrationId, basePayload)

      expect(mockEngine.send).toHaveBeenCalledWith('Start the conversation', {
        type: 'instruction',
      })
      expect(fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.any(URLSearchParams),
        })
      )

      const requestBody = fetch.mock.calls[0][1].body

      expect(requestBody.get('From')).toBe('+16513956925')
      expect(requestBody.get('To')).toBe('+447911123456')
      expect(requestBody.get('Body')).toBe('Hello by SMS!')
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Twilio Message Sent',
          type: 'integration.twilio.sent',
          relations: {
            twilioIntegrationId,
          },
          meta: expect.objectContaining({
            from: '+16513956925',
            to: '+447911123456',
            messageType: 'text',
          }),
        })
      )
    })

    it('logs Twilio API failures with Twilio error details', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn(async () =>
          JSON.stringify({
            code: 21606,
            message: 'The From phone number is not a valid Twilio number',
            more_info: 'https://www.twilio.com/docs/errors/21606',
          })
        ),
      })

      await expect(
        handleInitiateEvent(twilioIntegrationId, basePayload)
      ).rejects.toThrow(/21606.*From phone number/)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Twilio Message Failed',
          type: 'integration.twilio.failed',
          relations: {
            twilioIntegrationId,
          },
          meta: expect.objectContaining({
            from: '+16513956925',
            to: '+447911123456',
            messageType: 'text',
            status: 400,
            code: 21606,
            moreInfo: 'https://www.twilio.com/docs/errors/21606',
          }),
        })
      )
    })

    it('starts calls through Twilio API with ConversationRelay TwiML', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInitiateEvent(twilioIntegrationId, {
        ...basePayload,
        channel: 'call',
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          options: expect.objectContaining({
            backstoryExtra: expect.stringContaining('voice call'),
          }),
        })
      )
      expect(fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC123/Calls.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.any(URLSearchParams),
        })
      )

      const requestBody = fetch.mock.calls[0][1].body

      expect(requestBody.get('From')).toBe('+16513956925')
      expect(requestBody.get('To')).toBe('+447911123456')
      expect(requestBody.get('Twiml')).toContain('<ConversationRelay')
      expect(requestBody.get('Twiml')).toContain('/channel/twilio-voice-')
      expect(requestBody.get('Twiml')).toContain('side=twilio')
      expect(requestBody.get('Twiml')).toContain(
        'reportInputDuringAgentSpeech="speech"'
      )
      expect(requestBody.get('Twiml')).not.toContain('<Gather')
      expect(requestBody.get('Twiml')).not.toContain('<Say')
    })

    it('uses integration voice language for initiated call ConversationRelay TwiML', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
        id: twilioIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accountSid: 'AC123',
        authToken: 'auth-token',
        voice: 'twilio/language=en-US/voice=Polly.Joanna',
        sessionDuration: 86400000,
        contactCollection: false,
      })

      await handleInitiateEvent(twilioIntegrationId, {
        ...basePayload,
        channel: 'call',
      })

      const requestBody = fetch.mock.calls[0][1].body

      expect(requestBody.get('Twiml')).toContain('<ConversationRelay')
      expect(requestBody.get('Twiml')).toContain('ttsLanguage="en-US"')
      expect(requestBody.get('Twiml')).toContain(
        'reportInputDuringAgentSpeech="speech"'
      )
      expect(requestBody.get('Twiml')).toContain('voice="Polly.Joanna"')
    })

    it('stores initiated SMS session under the recipient phone number', async () => {
      await handleInitiateEvent(twilioIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `twilio-session-${twilioIntegrationId}-+447911123456`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('normalizes formatted initiate phone numbers before sending', async () => {
      await handleInitiateEvent(twilioIntegrationId, {
        from: '+1 (651) 395-6925',
        to: '+44 7911 123456',
        text: 'Start the conversation',
      })

      const requestBody = fetch.mock.calls[0][1].body

      expect(requestBody.get('From')).toBe('+16513956925')
      expect(requestBody.get('To')).toBe('+447911123456')
      expect(memcache.set).toHaveBeenCalledWith(
        `twilio-session-${twilioIntegrationId}-+447911123456`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })
  })

  describe('InteractPayloadSchema validation', () => {
    it('validates correct payload', () => {
      const validPayload = {
        channelId: 'twilio-abc123',
        from: '+1234567890',
        body: 'Hello',
        messageSid: 'SM123',
      }

      expect(() => InteractPayloadSchema.parse(validPayload)).not.toThrow()
    })

    it('validates voice payload', () => {
      const validPayload = {
        channelId: 'twilio-abc123',
        from: '+1234567890',
        body: 'Hello',
        callSid: 'CA123',
      }

      expect(() => InteractPayloadSchema.parse(validPayload)).not.toThrow()
    })

    it('rejects payload missing both messageSid and callSid', () => {
      const payload = {
        channelId: 'twilio-abc123',
        from: '+1234567890',
        body: 'Hello',
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })

    it('rejects payload with both messageSid and callSid', () => {
      const payload = {
        channelId: 'twilio-abc123',
        from: '+1234567890',
        body: 'Hello',
        messageSid: 'SM123',
        callSid: 'CA123',
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })

    it('rejects payload missing channelId', () => {
      const payload = {
        from: '+1234567890',
        body: 'Hello',
        messageSid: 'SM123',
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })

    it('rejects payload missing from', () => {
      const payload = {
        channelId: 'twilio-abc123',
        body: 'Hello',
        messageSid: 'SM123',
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })

    it('rejects payload missing body', () => {
      const payload = {
        channelId: 'twilio-abc123',
        from: '+1234567890',
        messageSid: 'SM123',
      }

      expect(() => InteractPayloadSchema.parse(payload)).toThrow()
    })
  })

  describe('InitiatePayloadSchema validation', () => {
    it('validates correct payload', () => {
      const validPayload = {
        from: '+16513956925',
        to: '+447911123456',
        text: 'Start the conversation',
      }

      expect(() => InitiatePayloadSchema.parse(validPayload)).not.toThrow()
    })

    it('rejects payload missing from', () => {
      const payload = {
        to: '+447911123456',
        text: 'Start the conversation',
      }

      expect(() => InitiatePayloadSchema.parse(payload)).toThrow()
    })

    it('rejects payload missing to', () => {
      const payload = {
        from: '+16513956925',
        text: 'Start the conversation',
      }

      expect(() => InitiatePayloadSchema.parse(payload)).toThrow()
    })
  })

  describe('session management', () => {
    const basePayload = {
      channelId: 'twilio-abc123',
      from: '+1234567890',
      body: 'hello',
      messageSid: 'SM123',
    }

    beforeEach(() => {
      memcache.get.mockResolvedValue(null)
    })

    it('builds session key using integration id and phone number', async () => {
      await handleInteractEvent(twilioIntegrationId, basePayload)

      expect(memcache.get).toHaveBeenCalledWith(
        `twilio-session-${twilioIntegrationId}-+1234567890`
      )
    })

    it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
        id: twilioIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accountSid: 'AC123',
        authToken: 'auth-token',
        serviceSid: 'IS123',
        from: '+0987654321',
        sessionDuration: null,
        contactCollection: false,
        voiceEnabled: false,
        allowFrom: '*',
      })

      await handleInteractEvent(twilioIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 86400 }) // 1 day in seconds
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
        id: twilioIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accountSid: 'AC123',
        authToken: 'auth-token',
        serviceSid: 'IS123',
        from: '+0987654321',
        sessionDuration: 0,
        contactCollection: false,
        voiceEnabled: false,
        allowFrom: '*',
      })

      await handleInteractEvent(twilioIntegrationId, basePayload)

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('uses custom session duration from integration config', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValueOnce({
        id: twilioIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        accountSid: 'AC123',
        authToken: 'auth-token',
        serviceSid: 'IS123',
        from: '+0987654321',
        sessionDuration: 1800000, // 30 minutes in ms
        contactCollection: false,
        voiceEnabled: false,
        allowFrom: '*',
      })

      await handleInteractEvent(twilioIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 1800 }) // 30 minutes in seconds
      )
    })

    it('reuses existing valid conversation from redis session', async () => {
      memcache.get.mockResolvedValueOnce('existing-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(true)

      await handleInteractEvent(twilioIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('creates new conversation when session exists but conversation is gone', async () => {
      memcache.get.mockResolvedValueOnce('stale-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)

      await handleInteractEvent(twilioIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('creates new conversation when no session exists in redis', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(twilioIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'twilio',
            twilio: expect.objectContaining({
              integrationId: twilioIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      await handleInteractEvent(twilioIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `twilio-session-${twilioIntegrationId}-+1234567890`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    describe('session reset commands', () => {
      it('resets session for ///restart command', async () => {
        const payload = {
          ...basePayload,
          body: '///restart',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `twilio-session-${twilioIntegrationId}-+1234567890`
        )
      })

      it('resets session for ///reset command', async () => {
        const payload = {
          ...basePayload,
          body: '///reset',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalled()
      })

      it('resets session for ///new command', async () => {
        const payload = {
          ...basePayload,
          body: '///new',
        }

        await handleInteractEvent(twilioIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `twilio-session-${twilioIntegrationId}-+1234567890`
        )
      })
    })
  })
})
