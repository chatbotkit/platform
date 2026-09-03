/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import handler, { bodySchema } from './initiate'

import { SafeError, SystemError } from '@/lib/error'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(),
}))

/*
jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))
*/

jest.mock('@/lib/usage.model', () => {
  const mockUsage = {
    token: 0,
    addTokens: jest.fn(function (tokens) {
      this.token += tokens
    }),
    recordBaseTokens: jest.fn(),
  }

  return {
    Usage: jest.fn(() => ({
      ...mockUsage,
      token: 0,
      addTokens: jest.fn(function (tokens) {
        this.token += tokens
      }),
      recordBaseTokens: jest.fn(),
    })),
  }
})

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureException: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((_req, param) => _req.query?.[param]),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn(() => ({ log: jest.fn() }))

  return { __esModule: true, default: debug }
})

jest.mock('@/lib/scope.server', () => ({}), { virtual: true })

describe('bodySchema', () => {
  it('must accept a text field', () => {
    const { error } = bodySchema.validate({ text: 'Hello world' })

    expect(error).toBeUndefined()
  })

  it('must accept an empty body (text is not required)', () => {
    const { error } = bodySchema.validate({})

    expect(error).toBeUndefined()
  })

  it('must default entities to empty array when not provided', () => {
    const { value } = bodySchema.validate({ text: 'Hello' })

    expect(value.entities).toEqual([])
  })

  it('must accept entities with begin and end positions', () => {
    const { error } = bodySchema.validate({
      text: 'Hello',
      entities: [{ begin: 0, end: 5 }],
    })

    expect(error).toBeUndefined()
  })

  it('must reject entities with negative begin', () => {
    const { error } = bodySchema.validate({
      text: 'Hello',
      entities: [{ begin: -1, end: 5 }],
    })

    expect(error).toBeDefined()
  })

  it('must reject entities with end less than 1', () => {
    const { error } = bodySchema.validate({
      text: 'Hello',
      entities: [{ begin: 0, end: 0 }],
    })

    expect(error).toBeDefined()
  })
})

describe('POST /api/v1/conversation/{conversationId}/initiate', () => {
  const { getStatefulConversationEngine } = require('@/lib/conversation.engine')
  // const { execPrompt } = require('@/lib/prompt')
  const { captureException } = require('@/lib/error')

  const mockReq = { query: { conversationId: 'conv-123' } }

  const mockSession = {
    id: 'session-abc',
    user: { id: 'user-123' },
    options: {},
  }

  const makeStream = () => ({
    acceptFormat: 'json',
    result: jest.fn(),
    error: jest.fn(),
    push: jest.fn().mockResolvedValue(undefined),
    abortSignal: undefined,
  })

  const makeEngine = (overrides = {}) => ({
    send: jest.fn().mockResolvedValue({
      usage: { token: 5 },
      messages: [{ id: 'msg-send-1', text: 'initiation text' }],
      entities: [],
    }),
    receive: jest.fn().mockResolvedValue({
      usage: { token: 8 },
      messages: [{ id: 'msg-receive-1', text: 'bot response' }],
    }),
    dispose: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()

    /*
    execPrompt.mockResolvedValue({
      completion: 'The bot should respond to this',
      tokensUsed: 3,
      modelUsed: 'gpt-4o-mini',
    })
    */
  })

  describe('successful initiation', () => {
    it('should stream sendResult and receiveResult and then call stream.result', async () => {
      const stream = makeStream()
      const engine = makeEngine()

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        entities: [],
      })

      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sendResult',
          createdAt: expect.any(Number),
        })
      )
      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'receiveResult',
          createdAt: expect.any(Number),
        })
      )
      expect(stream.result).toHaveBeenCalled()
      expect(stream.error).not.toHaveBeenCalled()
    })

    it('should push stamped final result event for streaming responses', async () => {
      const stream = makeStream()
      const engine = makeEngine()

      stream.acceptFormat = 'jsonl'
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        entities: [],
      })

      expect(stream.result).not.toHaveBeenCalled()
      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'result',
          createdAt: expect.any(Number),
          data: expect.objectContaining({
            id: 'msg-receive-1',
            text: 'bot response',
          }),
        })
      )
    })

    it('should pass the provided text to engine.send', async () => {
      const stream = makeStream()
      const engine = makeEngine()

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, {
        text: 'user input',
        entities: [],
      })

      expect(engine.send).toHaveBeenCalledWith('user input', {
        type: 'instruction',
      })
    })

    it.skip(
      'should pass the execPrompt completion text to engine.send',
      async () => {
        // @note kept as a skipped test because the execPrompt-based initiation
        // path is still present in the handler source, but currently disabled.
      }
    )

    it('should pass conversationId from request to engine', async () => {
      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-123' })
      )
    })

    it('should pass userId and abortSignal to engine options', async () => {
      const stream = makeStream()

      stream.abortSignal = 'mock-abort-signal'
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            userId: 'user-123',
            signal: 'mock-abort-signal',
          }),
        })
      )
    })

    it('should use the last message from engine.send in sendResult', async () => {
      const stream = makeStream()
      const engine = makeEngine({
        send: jest.fn().mockResolvedValue({
          usage: { token: 5 },
          messages: [
            { id: 'msg-send-1', text: 'first' },
            { id: 'msg-send-2', text: 'last send' },
          ],
          entities: [],
        }),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sendResult',
          data: expect.objectContaining({
            id: 'msg-send-2',
            text: 'last send',
          }),
        })
      )
    })

    it('should use the last message from engine.receive in receiveResult and stream.result', async () => {
      const stream = makeStream()
      const engine = makeEngine({
        receive: jest.fn().mockResolvedValue({
          usage: { token: 8 },
          messages: [
            { id: 'msg-recv-1', text: 'first receive' },
            { id: 'msg-recv-2', text: 'final bot response' },
          ],
        }),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'receiveResult',
          data: expect.objectContaining({
            id: 'msg-recv-2',
            text: 'final bot response',
          }),
        })
      )
      expect(stream.result).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-recv-2',
          text: 'final bot response',
        })
      )
    })

    it('should accumulate token usage from engine.send and engine.receive', async () => {
      const stream = makeStream()
      const engine = makeEngine({
        send: jest.fn().mockResolvedValue({
          usage: { token: 10 },
          messages: [{ id: 'msg-1', text: 'send' }],
          entities: [],
        }),
        receive: jest.fn().mockResolvedValue({
          usage: { token: 20 },
          messages: [{ id: 'msg-2', text: 'receive' }],
        }),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      // The result should include all accumulated tokens
      expect(stream.result).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: expect.objectContaining({ token: expect.any(Number) }),
        })
      )

      const resultCall = stream.result.mock.calls[0][0]

      expect(resultCall.usage.token).toBe(30)
    })

    it.skip(
      'should accumulate token usage from execPrompt, engine.send, and engine.receive',
      async () => {
        // @note kept as a skipped test because the execPrompt-based initiation
        // path is still present in the handler source, but currently disabled.
      }
    )

    it('should pass entities from body to engine options', async () => {
      const stream = makeStream()
      const entities = [{ begin: 0, end: 5 }]

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, { text: 'Hello', entities })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ entities }),
        })
      )
    })

    it('should use session features in engine options', async () => {
      const stream = makeStream()
      const sessionWithFeatures = {
        ...mockSession,
        options: { engine: { features: [{ name: 'some-feature' }] } },
      }

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, sessionWithFeatures, {
        text: 'Hi',
        entities: [],
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: expect.arrayContaining([{ name: 'some-feature' }]),
          }),
        })
      )
    })

    it('should generate fallback id when send returns empty messages', async () => {
      const stream = makeStream()
      const engine = makeEngine({
        send: jest.fn().mockResolvedValue({
          usage: { token: 5 },
          messages: [],
          entities: [],
        }),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      // Should still push a sendResult with some id (not crash)
      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sendResult',
          data: expect.objectContaining({ id: expect.any(String) }),
        })
      )
    })

    it('should generate fallback id when receive returns empty messages', async () => {
      const stream = makeStream()
      const engine = makeEngine({
        receive: jest.fn().mockResolvedValue({
          usage: { token: 5 },
          messages: [],
        }),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(stream.result).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) })
      )
    })
  })

  describe('error handling', () => {
    it.skip(
      'should call stream.error with generic error and captureException when execPrompt throws',
      async () => {
        // @note kept as a skipped test because the execPrompt-based initiation
        // path is still present in the handler source, but currently disabled.
      }
    )

    it('should call stream.error with safe details for SafeError', async () => {
      const stream = makeStream()
      const error = new SafeError('Visible problem', 'VISIBLE_CODE')
      const engine = makeEngine({
        send: jest.fn().mockRejectedValue(error),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(captureException).toHaveBeenCalledWith(error)
      expect(stream.error).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VISIBLE_CODE',
          message: 'Visible problem',
        })
      )
    })

    it('should call stream.error with generic error and captureException when engine.send throws', async () => {
      const stream = makeStream()
      const error = new Error('Engine send failed')
      const engine = makeEngine({
        send: jest.fn().mockRejectedValue(error),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(captureException).toHaveBeenCalledWith(error)
      expect(stream.error).toHaveBeenCalledWith(expect.any(SystemError))
      expect(stream.error.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          code: 'GENERIC_ERROR',
          message: 'Something went wrong',
        })
      )
      expect(stream.result).not.toHaveBeenCalled()
    })

    it('should push stamped generic error event for streaming responses', async () => {
      const stream = makeStream()
      const error = new Error('Engine send failed')
      const engine = makeEngine({
        send: jest.fn().mockRejectedValue(error),
      })

      stream.acceptFormat = 'jsonl'
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(stream.error).not.toHaveBeenCalled()
      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          createdAt: expect.any(Number),
          data: {
            code: 'GENERIC_ERROR',
            message: 'Something went wrong',
          },
        })
      )
    })

    it('should call stream.error with generic error and captureException when engine.receive throws', async () => {
      const stream = makeStream()
      const error = new Error('Engine receive failed')
      const engine = makeEngine({
        receive: jest.fn().mockRejectedValue(error),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(captureException).toHaveBeenCalledWith(error)
      expect(stream.error).toHaveBeenCalledWith(expect.any(SystemError))
      expect(stream.result).not.toHaveBeenCalled()
    })

    it('should propagate error when getStatefulConversationEngine throws', async () => {
      const stream = makeStream()
      const error = new Error('Engine setup failed')

      getStatefulConversationEngine.mockRejectedValue(error)

      await expect(
        handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })
      ).rejects.toThrow('Engine setup failed')
    })

    it('should not call stream.result when error is encountered after send', async () => {
      const stream = makeStream()
      const error = new Error('Receive error')
      const engine = makeEngine({
        receive: jest.fn().mockRejectedValue(error),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(stream.result).not.toHaveBeenCalled()
    })
  })

  describe('stream event ordering', () => {
    it('should push sendResult before receiveResult before calling result', async () => {
      const stream = makeStream()
      const callOrder = []

      stream.push.mockImplementation(async (event) => {
        callOrder.push(`push:${event.type}`)
      })
      stream.result.mockImplementation(async () => {
        callOrder.push('result')
      })

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      expect(callOrder).toEqual([
        'push:sendResult',
        'push:receiveResult',
        'result',
      ])
    })
  })

  describe('TAG_ERROR handling', () => {
    it('should not push TAG_ERROR events to stream.push - they go to stream.error', async () => {
      // The sink implementation routes TAG_ERROR to stream.error, not stream.push
      // This verifies the TAG_ERROR routing logic in the inline sink class
      const stream = makeStream()
      const engine = makeEngine({
        send: jest.fn().mockRejectedValue(new Error('test error')),
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hi', entities: [] })

      // stream.push should not have been called with type: 'error'
      const pushCallsWithError = stream.push.mock.calls.filter(
        (call) => call[0]?.type === 'error'
      )

      expect(pushCallsWithError).toHaveLength(0)
      // The error should go through stream.error
      expect(stream.error).toHaveBeenCalled()
    })
  })
})
