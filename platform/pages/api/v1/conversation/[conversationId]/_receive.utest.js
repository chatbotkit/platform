/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { SafeError, SystemError } from '@/lib/error'

import handler from './receive'

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

jest.mock('@/lib/audience.helpers', () => ({
  isTrustedSession: jest.fn(() => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((_req, param) => _req.query?.[param]),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn()

  return { __esModule: true, default: debug }
})

describe('POST /api/v1/conversation/{conversationId}/receive', () => {
  const { isTrustedSession } = require('@/lib/audience.helpers')
  const { getStatefulConversationEngine } = require('@/lib/conversation.engine')
  const { captureError } = require('@/lib/error')

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
    push: jest.fn(),
    abortSignal: undefined,
  })

  const makeEngine = (receiveResult = {}) => ({
    receive: jest.fn().mockResolvedValue({
      usage: { token: 15 },
      messages: [{ id: 'msg-1', text: 'AI response text' }],
      ...receiveResult,
    }),
    dispose: jest.fn().mockResolvedValue(undefined),
  })

  beforeEach(() => {
    jest.clearAllMocks()
    isTrustedSession.mockReturnValue(false)
  })

  describe('successful receive', () => {
    it('should call stream.result with id, text and usage from last message', async () => {
      const stream = makeStream()

      const engine = makeEngine()

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, {})

      expect(engine.receive).toHaveBeenCalled()
      expect(stream.result).toHaveBeenCalledWith({
        id: 'msg-1',
        text: 'AI response text',
        usage: { token: 15 },
      })
      expect(stream.error).not.toHaveBeenCalled()
    })

    it('should push stamped final result event for streaming responses', async () => {
      const stream = makeStream()
      const engine = makeEngine()

      stream.acceptFormat = 'jsonl'
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, {})

      expect(stream.result).not.toHaveBeenCalled()
      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'result',
          createdAt: expect.any(Number),
          data: {
            id: 'msg-1',
            text: 'AI response text',
            usage: { token: 15 },
          },
        })
      )
    })

    it('should use the last message when multiple messages returned', async () => {
      const stream = makeStream()
      const engine = makeEngine({
        messages: [
          { id: 'msg-1', text: 'First message' },
          { id: 'msg-2', text: 'Last message' },
        ],
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, {})

      expect(stream.result).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-2',
          text: 'Last message',
        })
      )
    })

    it('should accumulate token usage from receive', async () => {
      const stream = makeStream()

      const engine = makeEngine({ usage: { token: 42 } })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, {})

      expect(stream.result).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: { token: 42 },
        })
      )
    })

    it('should pass conversationId from request params to engine', async () => {
      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(
        { query: { conversationId: 'specific-conv-id' } },
        stream,
        mockSession,
        {}
      )

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'specific-conv-id',
        })
      )
    })

    it('should pass sessionId and userId to engine options', async () => {
      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {})

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            sessionId: 'session-abc',
            userId: 'user-123',
          }),
        })
      )
    })

    it('should pass abortSignal from stream to engine options', async () => {
      const stream = makeStream()
      const abortController = new AbortController()

      stream.abortSignal = abortController.signal

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {})

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            signal: abortController.signal,
          }),
        })
      )
    })
  })

  describe('trusted session: extensions forwarded to engine', () => {
    it('should forward backstory extension when session is trusted', async () => {
      isTrustedSession.mockReturnValue(true)

      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {
        extensions: { backstory: 'Custom backstory for this session.' },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: 'Custom backstory for this session.',
          }),
        })
      )
    })

    it('should NOT forward backstory when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {
        extensions: { backstory: 'Injected backstory' },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: undefined,
          }),
        })
      )
    })

    it('should forward inline datasets when trusted and datasets provided', async () => {
      isTrustedSession.mockReturnValue(true)

      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      const datasets = [
        {
          name: 'KB',
          description: 'Knowledge base',
          records: [{ text: 'fact 1', meta: {} }],
        },
      ]

      await handler(mockReq, stream, mockSession, {
        extensions: { datasets },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineDatasets: datasets,
          }),
        })
      )
    })

    it('should NOT forward inline datasets when untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      const datasets = [
        {
          name: 'Injected',
          description: 'Injected',
          records: [{ text: 'injected', meta: {} }],
        },
      ]

      await handler(mockReq, stream, mockSession, {
        extensions: { datasets },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineDatasets: undefined,
          }),
        })
      )
    })

    it('should forward inline skillsets when trusted and skillsets provided', async () => {
      isTrustedSession.mockReturnValue(true)

      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      const skillsets = [
        {
          name: 'Tools',
          description: 'Custom tools',
          abilities: [
            { name: 'tool1', description: 'Tool 1', instruction: 'do thing' },
          ],
        },
      ]

      await handler(mockReq, stream, mockSession, {
        extensions: { skillsets },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineSkillsets: skillsets,
          }),
        })
      )
    })

    it('should merge extension features with session features when trusted', async () => {
      isTrustedSession.mockReturnValue(true)

      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      const sessionWithFeatures = {
        ...mockSession,
        options: { engine: { features: ['session-feature'] } },
      }

      await handler(mockReq, stream, sessionWithFeatures, {
        extensions: { features: ['extension-feature'] },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: expect.arrayContaining([
              'session-feature',
              'extension-feature',
            ]),
          }),
        })
      )
    })

    it('should NOT include extension features when untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {
        extensions: { features: ['injected-feature'] },
      })

      const callArgs = getStatefulConversationEngine.mock.calls[0][0]

      expect(callArgs.options.features).not.toContain('injected-feature')
    })
  })

  describe('error handling', () => {
    it('should call stream.error with generic error and captureError when engine.receive throws', async () => {
      const stream = makeStream()
      const receiveError = new Error('Engine receive failed')

      const brokenEngine = {
        receive: jest.fn().mockRejectedValue(receiveError),
        dispose: jest.fn().mockResolvedValue(undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(brokenEngine)

      await handler(mockReq, stream, mockSession, {})

      expect(captureError).toHaveBeenCalledWith(receiveError)
      expect(stream.error).toHaveBeenCalledWith(expect.any(SystemError))
      expect(stream.error.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          code: 'GENERIC_ERROR',
          message: 'Something went wrong',
        })
      )
      expect(stream.result).not.toHaveBeenCalled()
    })

    it('should call stream.error with safe details for SafeError', async () => {
      const stream = makeStream()
      const receiveError = new SafeError('Visible problem', 'VISIBLE_CODE')

      getStatefulConversationEngine.mockResolvedValue({
        receive: jest.fn().mockRejectedValue(receiveError),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      await handler(mockReq, stream, mockSession, {})

      expect(captureError).toHaveBeenCalledWith(receiveError)
      expect(stream.error).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VISIBLE_CODE',
          message: 'Visible problem',
        })
      )
    })

    it('should push stamped generic error event for streaming responses', async () => {
      const stream = makeStream()
      const receiveError = new Error('Engine receive failed')

      stream.acceptFormat = 'jsonl'
      getStatefulConversationEngine.mockResolvedValue({
        receive: jest.fn().mockRejectedValue(receiveError),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      await handler(mockReq, stream, mockSession, {})

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

    it('should let the error propagate when getStatefulConversationEngine throws (caught by edge middleware in production)', async () => {
      const stream = makeStream()
      const engineError = new Error('Cannot get engine')

      getStatefulConversationEngine.mockRejectedValue(engineError)

      // The engine setup is outside the try/catch, so errors propagate to the
      // withStream wrapper (which calls stream.error in production)
      await expect(handler(mockReq, stream, mockSession, {})).rejects.toThrow(
        'Cannot get engine'
      )
    })
  })
})
