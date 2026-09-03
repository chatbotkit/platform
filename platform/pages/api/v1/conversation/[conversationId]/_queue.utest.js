/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'
import { PolicyType, Trigger } from '@/prisma/types'

import { runTasks, runTasksEach } from '@/lib/job'
import { notifyContentAbuseDetected } from '@/lib/notify'

import {
  CALLBACK_EVENT_TYPE,
  COMPLETE_EVENT_TYPE,
  IDLE_EVENT_TYPE,
  REALTIME_EVENT_TYPE,
  applyRetentionPolicies,
  handleCallbackEvent,
  handleCompleteEvent,
  handleIdleEvent,
  handleRealtimeEvent,
  sendEvent,
  triggerExtractIntegrations,
  triggerNotifications,
  triggerSupportIntegrations,
} from './queue'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const mockWebSocketInstances = []

jest.mock('ws', () => {
  const { EventEmitter } = require('events')

  class MockWebSocket extends EventEmitter {
    static OPEN = 1

    readyState = 0
    sent = []

    constructor(url) {
      super()

      this.url = url
      this.send = jest.fn((message) => {
        this.sent.push(JSON.parse(message))
      })
      this.close = jest.fn(() => {
        this.readyState = 3
        this.emit('close', 1000, Buffer.from(''))
      })
    }
  }

  const WebSocket = jest.fn((url) => {
    const socket = new MockWebSocket(url)

    mockWebSocketInstances.push(socket)

    return socket
  })

  WebSocket.OPEN = MockWebSocket.OPEN

  return {
    __esModule: true,
    default: WebSocket,
  }
})

jest.mock('@/prisma/client', () => {
  const mockPrisma = {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    policy: {
      findFirst: jest.fn(),
    },
    supportIntegration: {
      paginate: jest.fn(),
    },
    extractIntegration: {
      paginate: jest.fn(),
    },
  }

  return {
    __esModule: true,
    default: mockPrisma,
    ...mockPrisma,
  }
})

jest.mock('@/prisma/types', () => ({
  PolicyType: { retention: 'retention' },
  Trigger: { automatic: 'automatic' },
}))

jest.mock('@/lib/job', () => ({
  runTasks: jest.fn(),
  runTasksEach: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn().mockReturnValue(Promise.resolve()),
}))

jest.mock('@/lib/channel.core', () => ({
  publishChannelMessage: jest.fn(),
}))

jest.mock('@/lib/channel.session', () => ({
  makeSessionChannelId: jest.fn(
    (_session, channelId) => `session:${channelId}`
  ),
}))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
}))

jest.mock('@/lib/notify', () => ({
  notifyContentAbuseDetected: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn((key, handlers) => jest.fn()),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    log: jest.fn(() => ({ log: jest.fn() })),
  })),
}))

jest.mock('@/lib/error', () => ({
  SystemError: class SystemError extends Error {
    constructor(message, code) {
      super(message)

      this.code = code
    }
  },
  captureError: jest.fn().mockResolvedValue(undefined),
  captureInputError: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/integration.context', () => ({
  setupFrontendHostContext: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/session.context', () => ({
  updateSessionStore: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn().mockResolvedValue({ id: 'user-123' }),
}))

jest.mock('@/lib/activity', () => ({
  makeRequestActivityMessage: jest.fn((name, args) => ({
    role: 'user',
    text: `request:${name}`,
  })),
  makeResponseActivityMessage: jest.fn((name, args, result) => ({
    role: 'assistant',
    text: `response:${name}`,
  })),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(),
}))

jest.mock('@/pages/api/v1/conversation/[conversationId]/complete', () => ({
  complete: jest.fn(async function* () {
    yield { type: 'result', data: { text: 'ok' } }
  }),
}))

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock(
  '@/pages/api/v1/integration/extract/[extractIntegrationId]/queue',
  () => ({
    IDLE_EVENT_TYPE: 'idle',
    sendEvent: jest.fn().mockResolvedValue(undefined),
  })
)

jest.mock(
  '@/pages/api/v1/integration/support/[supportIntegrationId]/queue',
  () => ({
    IDLE_EVENT_TYPE: 'idle',
    sendEvent: jest.fn().mockResolvedValue(undefined),
  })
)

jest.mock('@chatbotkit-dev/time', () => ({
  timePlusDays: jest.fn((days) => new Date(`2025-01-${days + 1}`)),
}))

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeConversation(overrides = {}) {
  return {
    id: 'conv-123',
    userId: 'user-123',
    botId: 'bot-abc',
    expiresAt: null,
    meta: null,
    user: {
      id: 'user-123',
      parent: null,
    },
    ...overrides,
  }
}

async function waitForRealtimeSocket() {
  for (let index = 0; index < 10; index++) {
    await Promise.resolve()

    if (mockWebSocketInstances[0]) {
      return mockWebSocketInstances[0]
    }
  }

  throw new Error('Expected realtime websocket to be created')
}

async function waitForCondition(condition) {
  for (let index = 0; index < 10; index++) {
    await Promise.resolve()

    if (condition()) {
      return
    }
  }

  throw new Error('Expected condition to become true')
}

function makeRealtimePayload(overrides = {}) {
  return {
    session: {
      id: 'session-123',
      user: { id: 'user-123' },
      payload: {},
    },
    relay: {
      channelId: 'realtime-channel-123',
      clientUrl:
        'wss://relay.example.com/channel/realtime-channel-123?side=client',
      runnerUrl:
        'wss://relay.example.com/channel/realtime-channel-123?side=runner',
    },
    expiresAt: Date.now() + 60_000,
    ...overrides,
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockWebSocketInstances.length = 0
  prisma.conversation.findUnique.mockResolvedValue(makeConversation())
})

describe('handleRealtimeEvent', () => {
  const { getStatefulConversationEngine } = require('@/lib/conversation.engine')

  it('handles complete messages with the completion event shape', async () => {
    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({
        usage: { token: 2 },
        messages: [{ id: 'msg-user', text: 'hello' }],
        entities: [],
      }),
      receive: jest.fn().mockResolvedValue({
        usage: { token: 3 },
        messages: [{ id: 'msg-bot', text: 'hi' }],
        reason: 'stop',
      }),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'complete',
        data: { text: 'hello' },
      })
    )

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.send).toHaveBeenCalledWith('hello', {
      signal: expect.any(AbortSignal),
    })
    expect(mockEngine.receive).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      modality: 'text',
    })
    expect(socket.sent).toEqual([
      expect.objectContaining({
        type: 'sendResult',
        data: expect.objectContaining({
          id: 'msg-user',
          text: 'hello',
          usage: { token: 2 },
        }),
      }),
      expect.objectContaining({
        type: 'receiveResult',
        data: expect.objectContaining({
          id: 'msg-bot',
          text: 'hi',
          usage: { token: 5 },
          end: { reason: 'stop' },
        }),
      }),
      expect.objectContaining({
        type: 'result',
        data: expect.objectContaining({
          id: 'msg-bot',
          text: 'hi',
          usage: { token: 5 },
          end: { reason: 'stop' },
        }),
      }),
    ])
  })

  it('handles initiate messages as instruction send plus receive', async () => {
    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({
        usage: { token: 1 },
        messages: [{ id: 'msg-instruction', text: 'start' }],
        entities: [],
      }),
      receive: jest.fn().mockResolvedValue({
        usage: { token: 4 },
        messages: [{ id: 'msg-bot', text: 'started' }],
        reason: 'stop',
      }),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'initiate',
        data: { text: 'start' },
      })
    )

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.send).toHaveBeenCalledWith('start', {
      type: 'instruction',
      signal: expect.any(AbortSignal),
    })
    expect(mockEngine.receive).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      modality: 'text',
    })
  })

  it('passes realtime response modality to receive options', async () => {
    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({
        usage: { token: 2 },
        messages: [{ id: 'msg-user', text: 'hello' }],
        entities: [],
      }),
      receive: jest.fn().mockResolvedValue({
        usage: { token: 3 },
        messages: [{ id: 'msg-bot', text: 'hi' }],
        reason: 'stop',
      }),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'complete',
        data: { text: 'hello', modality: 'audio', voice: ' marin ' },
      })
    )

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.receive).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      modality: 'audio',
    })
  })

  it('handles steer messages through engine.steer', async () => {
    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      steer: jest.fn().mockResolvedValue(undefined),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'steer',
        data: { text: 'change direction' },
      })
    )

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.steer).toHaveBeenCalledWith('change direction', {
      signal: expect.any(AbortSignal),
      modality: 'text',
    })
  })

  it('handles audio messages through engine.audio', async () => {
    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      audio: jest.fn().mockResolvedValue({
        usage: { token: 0 },
        messages: [],
        reason: 'stop',
      }),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'audio',
        data: {
          data: 'base64-audio',
          format: {
            encoding: 'pcm16',
            sampleRate: 24000,
            channels: 1,
          },
        },
      })
    )

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.audio).toHaveBeenCalledWith(
      {
        data: 'base64-audio',
        format: {
          encoding: 'pcm16',
          sampleRate: 24000,
          channels: 1,
        },
      },
      {
        signal: expect.any(AbortSignal),
        modality: 'audio',
      }
    )
  })

  it('defaults microphone audio messages to audio modality', async () => {
    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      audio: jest.fn().mockResolvedValue({
        usage: { token: 0 },
        messages: [],
        reason: 'stop',
      }),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'audio',
        data: {
          data: 'base64-audio',
          format: {
            encoding: 'pcm16',
            sampleRate: 24000,
            channels: 1,
          },
        },
      })
    )

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.audio).toHaveBeenCalledWith(
      {
        data: 'base64-audio',
        format: {
          encoding: 'pcm16',
          sampleRate: 24000,
          channels: 1,
        },
      },
      {
        signal: expect.any(AbortSignal),
        modality: 'audio',
      }
    )
  })

  it('aborts only the active operation', async () => {
    let activeSignal

    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      steer: jest.fn((_text, options) => {
        activeSignal = options.signal

        return new Promise((resolve) => {
          options.signal.addEventListener('abort', resolve, { once: true })
        })
      }),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'steer',
        data: { text: 'hold' },
      })
    )

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('message', JSON.stringify({ type: 'abort' }))

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(activeSignal.aborted).toBe(true)
    expect(socket.close).not.toHaveBeenCalled()
  })

  it('rejects a second complete while an operation is active', async () => {
    let resolveReceive

    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({
        usage: { token: 1 },
        messages: [{ id: 'msg-user', text: 'hello' }],
        entities: [],
      }),
      receive: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveReceive = resolve
          })
      ),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'complete',
        data: { text: 'hello' },
      })
    )

    await waitForCondition(() => mockEngine.receive.mock.calls.length === 1)

    socket.emit(
      'message',
      JSON.stringify({
        type: 'complete',
        data: { text: 'again' },
      })
    )

    await waitForCondition(() =>
      socket.sent.some((event) => event.data?.code === 'realtime_busy')
    )

    resolveReceive({
      usage: { token: 1 },
      messages: [{ id: 'msg-bot', text: 'hi' }],
      reason: 'stop',
    })

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.send).toHaveBeenCalledTimes(1)
    expect(socket.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({
            code: 'realtime_busy',
            operation: 'complete',
          }),
        }),
      ])
    )
  })

  it('lets steer abort and replace an active complete operation', async () => {
    let completeSignal

    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({
        usage: { token: 1 },
        messages: [{ id: 'msg-user', text: 'hello' }],
        entities: [],
      }),
      receive: jest.fn((_options) => {
        completeSignal = _options.signal

        return new Promise((_resolve, reject) => {
          _options.signal.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted')

              error.name = 'AbortError'

              reject(error)
            },
            { once: true }
          )
        })
      }),
      steer: jest.fn().mockResolvedValue(undefined),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit(
      'message',
      JSON.stringify({
        type: 'complete',
        data: { text: 'hello' },
      })
    )

    await waitForCondition(() => mockEngine.receive.mock.calls.length === 1)

    socket.emit(
      'message',
      JSON.stringify({
        type: 'steer',
        data: { text: 'change direction' },
      })
    )

    await waitForCondition(() => mockEngine.steer.mock.calls.length === 1)

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(completeSignal.aborted).toBe(true)
    expect(mockEngine.steer).toHaveBeenCalledWith('change direction', {
      signal: expect.any(AbortSignal),
      modality: 'text',
    })
    expect(socket.sent).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ code: 'realtime_busy' }),
        }),
      ])
    )
  })

  it('debug logs relay and unknown messages without calling the engine', async () => {
    const mockEngine = {
      dispose: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
      receive: jest.fn(),
      steer: jest.fn(),
    }

    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const promise = handleRealtimeEvent('conv-123', makeRealtimePayload())
    const socket = await waitForRealtimeSocket()

    socket.readyState = 1
    socket.emit('open')

    await waitForCondition(
      () => getStatefulConversationEngine.mock.calls.length
    )

    socket.emit('message', JSON.stringify({ type: 'relay.peer.closed' }))
    socket.emit('message', JSON.stringify({ type: 'something.else' }))

    await Promise.resolve()
    await Promise.resolve()

    socket.emit('close', 1000, Buffer.from(''))

    await promise

    expect(mockEngine.send).not.toHaveBeenCalled()
    expect(mockEngine.receive).not.toHaveBeenCalled()
    expect(mockEngine.steer).not.toHaveBeenCalled()
    expect(socket.close).not.toHaveBeenCalled()
  })
})

describe('handleCompleteEvent', () => {
  it('passes queue abort signal to complete', async () => {
    const {
      complete,
    } = require('@/pages/api/v1/conversation/[conversationId]/complete')
    const abortController = new AbortController()

    await handleCompleteEvent(
      'conv-123',
      {
        session: {
          id: 'session-123',
          user: { id: 'queued-user' },
          payload: {},
        },
        channelId: 'channel-123',
        body: { text: 'hello' },
      },
      { signal: abortController.signal }
    )

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-123' }),
      'conv-123',
      expect.any(Object),
      { abortSignal: abortController.signal }
    )
  })

  it('passes queue mark signals to complete', async () => {
    const {
      complete,
    } = require('@/pages/api/v1/conversation/[conversationId]/complete')
    const markSignals = [new AbortController().signal]

    await handleCompleteEvent(
      'conv-123',
      {
        session: {
          id: 'session-123',
          user: { id: 'queued-user' },
          payload: {},
        },
        channelId: 'channel-123',
        body: { text: 'hello' },
      },
      { markSignals }
    )

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-123' }),
      'conv-123',
      expect.any(Object),
      expect.objectContaining({ markSignals })
    )
  })

  it('uses the conversation owner for queued complete session context', async () => {
    const {
      complete,
    } = require('@/pages/api/v1/conversation/[conversationId]/complete')

    prisma.conversation.findUnique.mockResolvedValueOnce(
      makeConversation({
        userId: 'owner-user',
        user: {
          id: 'owner-user',
          email: 'owner@example.com',
          parent: null,
        },
      })
    )

    await handleCompleteEvent('conv-123', {
      session: {
        id: 'session-123',
        user: { id: 'queued-user' },
        payload: {
          keep: true,
        },
      },
      channelId: 'channel-123',
      body: { text: 'hello' },
    })

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-123',
        payload: expect.objectContaining({
          keep: true,
        }),
        user: expect.objectContaining({
          id: 'owner-user',
          email: 'owner@example.com',
        }),
      }),
      'conv-123',
      expect.any(Object),
      expect.any(Object)
    )
  })
})

// =============================================================================
// applyRetentionPolicies
// =============================================================================

describe('applyRetentionPolicies', () => {
  it('should skip update when conversation already has expiresAt', async () => {
    const conversation = makeConversation({ expiresAt: new Date('2026-01-01') })

    await applyRetentionPolicies(conversation)

    expect(prisma.policy.findFirst).not.toHaveBeenCalled()
    expect(prisma.conversation.update).not.toHaveBeenCalled()
  })

  it('should skip update when no retention policy exists', async () => {
    const conversation = makeConversation()

    prisma.policy.findFirst.mockResolvedValue(null)

    await applyRetentionPolicies(conversation)

    expect(prisma.conversation.update).not.toHaveBeenCalled()
  })

  it('should skip update when policy config has no expiresInDays', async () => {
    const conversation = makeConversation()

    prisma.policy.findFirst.mockResolvedValue({
      id: 'policy-1',
      config: {},
    })

    await applyRetentionPolicies(conversation)

    expect(prisma.conversation.update).not.toHaveBeenCalled()
  })

  it('should throw when expiresInDays is zero (invalid config)', async () => {
    const conversation = makeConversation()

    prisma.policy.findFirst.mockResolvedValue({
      id: 'policy-1',
      config: { expiresInDays: 0 },
    })

    await expect(applyRetentionPolicies(conversation)).rejects.toThrow()
    expect(prisma.conversation.update).not.toHaveBeenCalled()
  })

  it('should throw when expiresInDays is negative (invalid config)', async () => {
    const conversation = makeConversation()

    prisma.policy.findFirst.mockResolvedValue({
      id: 'policy-1',
      config: { expiresInDays: -1 },
    })

    await expect(applyRetentionPolicies(conversation)).rejects.toThrow()
    expect(prisma.conversation.update).not.toHaveBeenCalled()
  })

  it('should update conversation expiresAt when valid retention policy exists', async () => {
    const { timePlusDays } = require('@chatbotkit-dev/time')

    const conversation = makeConversation()
    const expectedDate = new Date('2025-01-31')

    timePlusDays.mockReturnValue(expectedDate)
    prisma.policy.findFirst.mockResolvedValue({
      id: 'policy-1',
      config: { expiresInDays: 30 },
    })
    prisma.conversation.update.mockResolvedValue({})

    await applyRetentionPolicies(conversation)

    expect(timePlusDays).toHaveBeenCalledWith(30)
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-123' },
      data: { expiresAt: expectedDate },
    })
  })

  it('should query a bot-scoped policy then fall back to a global one', async () => {
    const conversation = makeConversation({
      userId: 'user-xyz',
      botId: 'bot-abc',
    })

    prisma.policy.findFirst.mockResolvedValue(null)

    await applyRetentionPolicies(conversation)

    expect(prisma.policy.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          userId: 'user-xyz',
          type: PolicyType.retention,
          botId: 'bot-abc',
        },
      })
    )
    expect(prisma.policy.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          userId: 'user-xyz',
          type: PolicyType.retention,
          botId: null,
        },
      })
    )
  })

  it('should prefer a bot-scoped policy over a global one', async () => {
    const conversation = makeConversation({ botId: 'bot-abc' })

    prisma.policy.findFirst.mockResolvedValueOnce({
      id: 'policy-bot',
      config: { expiresInDays: 30 },
    })
    prisma.conversation.update.mockResolvedValue({})

    await applyRetentionPolicies(conversation)

    // the bot-scoped lookup resolved, so the global fallback is never queried
    expect(prisma.policy.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.conversation.update).toHaveBeenCalled()
  })

  it('should only query a global policy when conversation has no bot', async () => {
    const conversation = makeConversation({ userId: 'user-xyz', botId: null })

    prisma.policy.findFirst.mockResolvedValue(null)

    await applyRetentionPolicies(conversation)

    expect(prisma.policy.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.policy.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-xyz',
          type: PolicyType.retention,
          botId: null,
        },
      })
    )
  })
})

// =============================================================================
// triggerSupportIntegrations
// =============================================================================

describe('triggerSupportIntegrations', () => {
  const {
    sendEvent: sendSupportEvent,
  } = require('@/pages/api/v1/integration/support/[supportIntegrationId]/queue')

  it('should match global and bot-scoped integrations when conversation has a botId', async () => {
    const conversation = makeConversation({ id: 'conv-123', botId: 'bot-abc' })
    const fakeIterator = (async function* () {})()

    prisma.supportIntegration.paginate.mockReturnValue(fakeIterator)
    runTasksEach.mockResolvedValue(undefined)

    await triggerSupportIntegrations(conversation)

    expect(prisma.supportIntegration.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trigger: Trigger.automatic,
          OR: [{ botId: null }, { botId: 'bot-abc' }],
        }),
      })
    )
  })

  it('should match only global integrations when conversation has no botId', async () => {
    const conversation = makeConversation({ botId: null })
    const fakeIterator = (async function* () {})()

    prisma.supportIntegration.paginate.mockReturnValue(fakeIterator)
    runTasksEach.mockResolvedValue(undefined)

    await triggerSupportIntegrations(conversation)

    expect(prisma.supportIntegration.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ botId: null }],
        }),
      })
    )
  })

  it('should send idle event for each matching integration', async () => {
    const conversation = makeConversation()
    const integration = { id: 'support-int-1' }
    const fakeIterator = (async function* () {
      yield integration
    })()

    prisma.supportIntegration.paginate.mockReturnValue(fakeIterator)

    // invoke the callback that runTasksEach would normally run
    runTasksEach.mockImplementation(async (workers, iter, handler) => {
      for await (const item of iter) {
        await handler(item)
      }
    })

    await triggerSupportIntegrations(conversation)

    expect(sendSupportEvent).toHaveBeenCalledWith(
      'support-int-1',
      expect.objectContaining({
        type: 'idle',
        payload: { conversationId: 'conv-123' },
      })
    )
  })
})

// =============================================================================
// triggerExtractIntegrations
// =============================================================================

describe('triggerExtractIntegrations', () => {
  const {
    sendEvent: sendExtractEvent,
  } = require('@/pages/api/v1/integration/extract/[extractIntegrationId]/queue')

  it('should match global and bot-scoped integrations when conversation has a botId', async () => {
    const conversation = makeConversation({ botId: 'bot-abc' })
    const fakeIterator = (async function* () {})()

    prisma.extractIntegration.paginate.mockReturnValue(fakeIterator)
    runTasksEach.mockResolvedValue(undefined)

    await triggerExtractIntegrations(conversation)

    expect(prisma.extractIntegration.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trigger: Trigger.automatic,
          OR: [{ botId: null }, { botId: 'bot-abc' }],
        }),
      })
    )
  })

  it('should match only global integrations when conversation has no botId', async () => {
    const conversation = makeConversation({ botId: null })
    const fakeIterator = (async function* () {})()

    prisma.extractIntegration.paginate.mockReturnValue(fakeIterator)
    runTasksEach.mockResolvedValue(undefined)

    await triggerExtractIntegrations(conversation)

    expect(prisma.extractIntegration.paginate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ botId: null }],
        }),
      })
    )
  })

  it('should send idle event for each matching extract integration', async () => {
    const conversation = makeConversation()
    const integration = { id: 'extract-int-1' }
    const fakeIterator = (async function* () {
      yield integration
    })()

    prisma.extractIntegration.paginate.mockReturnValue(fakeIterator)

    runTasksEach.mockImplementation(async (workers, iter, handler) => {
      for await (const item of iter) {
        await handler(item)
      }
    })

    await triggerExtractIntegrations(conversation)

    expect(sendExtractEvent).toHaveBeenCalledWith(
      'extract-int-1',
      expect.objectContaining({
        type: 'idle',
        payload: { conversationId: 'conv-123' },
      })
    )
  })
})

// =============================================================================
// triggerNotifications
// =============================================================================

describe('triggerNotifications', () => {
  it('should not notify when conversation has no abuse flag', async () => {
    const conversation = makeConversation({ meta: null })

    await triggerNotifications(conversation)

    expect(notifyContentAbuseDetected).not.toHaveBeenCalled()
  })

  it('should not notify when abuse.flagged is false', async () => {
    const conversation = makeConversation({
      meta: { abuse: { flagged: false } },
    })

    await triggerNotifications(conversation)

    expect(notifyContentAbuseDetected).not.toHaveBeenCalled()
  })

  it('should notify when conversation is flagged for abuse', async () => {
    const conversation = makeConversation({
      meta: { abuse: { flagged: true, categories: ['hate'] } },
      user: { id: 'user-123', parent: null },
    })

    await triggerNotifications(conversation)

    expect(notifyContentAbuseDetected).toHaveBeenCalledWith(
      conversation.user,
      'conv-123',
      ['hate']
    )
  })

  it('should use parent user when conversation user has a parent', async () => {
    const parentUser = { id: 'parent-user-1' }
    const conversation = makeConversation({
      meta: { abuse: { flagged: true, categories: ['spam'] } },
      user: { id: 'child-user-1', parent: parentUser },
    })

    await triggerNotifications(conversation)

    expect(notifyContentAbuseDetected).toHaveBeenCalledWith(
      parentUser,
      'conv-123',
      ['spam']
    )
  })
})

// =============================================================================
// handleIdleEvent
// =============================================================================

describe('handleIdleEvent', () => {
  it('should do nothing when conversation is not found', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null)

    await handleIdleEvent('conv-missing', {
      type: IDLE_EVENT_TYPE,
      payload: {},
    })

    expect(runTasks).not.toHaveBeenCalled()
  })

  it('should run all tasks when conversation is found', async () => {
    const conversation = makeConversation()

    prisma.conversation.findUnique.mockResolvedValue(conversation)
    runTasks.mockResolvedValue(undefined)

    await handleIdleEvent('conv-123', { type: IDLE_EVENT_TYPE, payload: {} })

    expect(runTasks).toHaveBeenCalledWith(expect.any(Array))

    const tasks = runTasks.mock.calls[0][0]

    // should include logEvent, applyRetentionPolicies (Promise), and trigger functions
    expect(tasks.length).toBeGreaterThanOrEqual(4)
  })

  it('should query conversation by provided conversationId', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null)

    await handleIdleEvent('conv-xyz', { type: IDLE_EVENT_TYPE, payload: {} })

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-xyz' },
      })
    )
  })
})

// =============================================================================
// sendEvent
// =============================================================================

describe('sendEvent', () => {
  const mockQueue = require('@/lib/queue').default

  it('should enqueue callback event', async () => {
    const conversationId = 'conv-123'
    const payload = { body: {} }

    await sendEvent(conversationId, {
      type: CALLBACK_EVENT_TYPE,
      payload,
    })

    expect(mockQueue).toHaveBeenCalledWith(
      `/api/v1/conversation/${conversationId}/queue`,
      expect.objectContaining({ type: CALLBACK_EVENT_TYPE }),
      { deduplicationId: undefined }
    )
  })

  it('should enqueue idle event', async () => {
    const conversationId = 'conv-123'

    await sendEvent(conversationId, {
      type: IDLE_EVENT_TYPE,
      payload: {},
    })

    expect(mockQueue).toHaveBeenCalledWith(
      `/api/v1/conversation/${conversationId}/queue`,
      expect.objectContaining({ type: IDLE_EVENT_TYPE }),
      { deduplicationId: undefined }
    )
  })

  it('should enqueue complete event with channel deduplication', async () => {
    const conversationId = 'conv-123'

    await sendEvent(conversationId, {
      type: COMPLETE_EVENT_TYPE,
      payload: {
        session: { id: 'session-123', user: { id: 'user-123' } },
        channelId: 'channel-123',
        body: {},
      },
    })

    expect(mockQueue).toHaveBeenCalledWith(
      `/api/v1/conversation/${conversationId}/queue`,
      expect.objectContaining({ type: COMPLETE_EVENT_TYPE }),
      { deduplicationId: 'stateful-conversation-complete-event-channel-123' }
    )
  })

  it('should enqueue realtime event', async () => {
    const conversationId = 'conv-123'

    await sendEvent(conversationId, {
      type: REALTIME_EVENT_TYPE,
      payload: {
        session: {
          id: 'session-123',
          user: { id: 'user-123' },
        },
        relay: {
          channelId: 'realtime-channel-123',
          clientUrl:
            'wss://relay.example.com/channel/realtime-channel-123?side=client',
          runnerUrl:
            'wss://relay.example.com/channel/realtime-channel-123?side=runner',
        },
        expiresAt: Date.now() + 60_000,
      },
    })

    expect(mockQueue).toHaveBeenCalledWith(
      `/api/v1/conversation/${conversationId}/queue`,
      expect.objectContaining({
        type: REALTIME_EVENT_TYPE,
      }),
      { deduplicationId: undefined }
    )
  })
})

describe('handleCallbackEvent', () => {
  const { getStatefulConversationEngine } = require('@/lib/conversation.engine')
  const {
    makeRequestActivityMessage,
    makeResponseActivityMessage,
  } = require('@/lib/activity')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return early if conversation not found', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null)

    await handleCallbackEvent('conv-missing', { body: {} })

    expect(getStatefulConversationEngine).not.toHaveBeenCalled()
  })

  it('should create the stateful engine with the conversation userId', async () => {
    const conversation = makeConversation({
      id: 'conv-123',
      user: { id: 'user-abc', parent: null },
    })

    const mockEngine = {
      addMessages: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    }

    prisma.conversation.findUnique.mockResolvedValue(conversation)
    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    await handleCallbackEvent('conv-123', { body: { event: 'ping' } })

    expect(getStatefulConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-123',
        options: expect.objectContaining({ userId: 'user-abc' }),
      })
    )
  })

  it('should add activity messages containing the payload body details', async () => {
    const conversation = makeConversation()

    const mockEngine = {
      addMessages: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    }

    prisma.conversation.findUnique.mockResolvedValue(conversation)
    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    const body = { event: 'webhook.received', source: 'external' }

    await handleCallbackEvent('conv-123', { body })

    expect(makeRequestActivityMessage).toHaveBeenCalledWith(
      'getIncomingEventDetails',
      {}
    )

    expect(makeResponseActivityMessage).toHaveBeenCalledWith(
      'getIncomingEventDetails',
      {},
      body
    )

    expect(mockEngine.addMessages).toHaveBeenCalledWith([
      expect.objectContaining({ text: 'request:getIncomingEventDetails' }),
      expect.objectContaining({ text: 'response:getIncomingEventDetails' }),
    ])
  })

  it('should not call engine.receive or engine.complete (event is recorded but not processed)', async () => {
    const conversation = makeConversation()

    const mockEngine = {
      addMessages: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      receive: jest.fn(),
      complete: jest.fn(),
    }

    prisma.conversation.findUnique.mockResolvedValue(conversation)
    getStatefulConversationEngine.mockResolvedValue(mockEngine)

    await handleCallbackEvent('conv-123', { body: { event: 'ping' } })

    // @note the implementation has a @todo comment noting this is intentionally
    // incomplete - the event is recorded as activity but not processed further
    expect(mockEngine.receive).not.toHaveBeenCalled()
    expect(mockEngine.complete).not.toHaveBeenCalled()
  })
})
