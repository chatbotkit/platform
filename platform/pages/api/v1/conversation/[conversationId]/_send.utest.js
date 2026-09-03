/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { SafeError, SystemError } from '@/lib/error'

import handler, { bodySchema } from './send'

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

describe('bodySchema', () => {
  it('must have a text field', () => {
    const result = bodySchema.validate({
      text: 'Hello, world!',
    })

    expect(result.error).toBeUndefined()
  })

  it('must not allow empty text', () => {
    const result = bodySchema.validate({
      text: '',
    })

    expect(result.error).toBeDefined()
  })

  it('must not allow whitespace-only text', () => {
    const result = bodySchema.validate({
      text: '   ',
    })

    expect(result.error).toBeDefined()
  })
})

describe('POST /api/v1/conversation/{conversationId}/send', () => {
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

  const makeEngine = (sendResult = {}) => ({
    send: jest.fn().mockResolvedValue({
      usage: { token: 10 },
      messages: [{ id: 'msg-1', text: 'user text' }],
      entities: [],
      ...sendResult,
    }),
    dispose: jest.fn().mockResolvedValue(undefined),
  })

  beforeEach(() => {
    jest.clearAllMocks()
    isTrustedSession.mockReturnValue(false)
  })

  describe('successful send', () => {
    it('should call stream.result with message id, text, entities and usage', async () => {
      const stream = makeStream()
      const engine = makeEngine()

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

      expect(engine.send).toHaveBeenCalledWith('Hello')
      expect(stream.result).toHaveBeenCalledWith({
        id: 'msg-1',
        text: 'user text',
        entities: [],
        usage: { token: 10 },
      })
      expect(stream.error).not.toHaveBeenCalled()
    })

    it('should push stamped final result event for streaming responses', async () => {
      const stream = makeStream()
      const engine = makeEngine()

      stream.acceptFormat = 'jsonl'
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

      expect(stream.result).not.toHaveBeenCalled()
      expect(stream.push).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'result',
          createdAt: expect.any(Number),
          data: {
            id: 'msg-1',
            text: 'user text',
            entities: [],
            usage: { token: 10 },
          },
        })
      )
    })

    it('should use the last message when multiple messages returned', async () => {
      const stream = makeStream()
      const engine = makeEngine({
        messages: [
          { id: 'msg-1', text: 'First' },
          { id: 'msg-2', text: 'Last' },
        ],
      })

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

      expect(stream.result).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'msg-2', text: 'Last' })
      )
    })

    it('should pass conversationId from request params to engine', async () => {
      const stream = makeStream()

      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-123' })
      )
    })

    it('should pass userId and abortSignal to engine options', async () => {
      const stream = makeStream()

      stream.abortSignal = 'mock-signal'
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            userId: 'user-123',
            signal: 'mock-signal',
          }),
        })
      )
    })
  })

  describe('trusted session: extensions forwarded to engine', () => {
    it('should forward backstory extension when session is trusted', async () => {
      const stream = makeStream()

      isTrustedSession.mockReturnValue(true)
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        extensions: { backstory: 'Custom backstory' },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: 'Custom backstory',
          }),
        })
      )
    })

    it('should NOT forward backstory extension when session is untrusted', async () => {
      const stream = makeStream()

      isTrustedSession.mockReturnValue(false)
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        extensions: { backstory: 'Custom backstory' },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ backstoryExtra: undefined }),
        })
      )
    })

    it('should forward inline datasets when trusted and datasets provided', async () => {
      const stream = makeStream()

      isTrustedSession.mockReturnValue(true)
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      const datasets = [{ name: 'Test', description: 'Desc', records: [] }]

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        extensions: { datasets },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ inlineDatasets: datasets }),
        })
      )
    })

    it('should NOT forward inline datasets when session is untrusted', async () => {
      const stream = makeStream()

      isTrustedSession.mockReturnValue(false)
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        extensions: {
          datasets: [{ name: 'Test', description: 'Desc', records: [] }],
        },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ inlineDatasets: undefined }),
        })
      )
    })

    it('should forward inline skillsets when trusted and skillsets provided', async () => {
      const stream = makeStream()

      isTrustedSession.mockReturnValue(true)
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      const skillsets = [{ name: 'Test', description: 'Desc', abilities: [] }]

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        extensions: { skillsets },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ inlineSkillsets: skillsets }),
        })
      )
    })

    it('should merge extension features with session features when trusted', async () => {
      const stream = makeStream()

      isTrustedSession.mockReturnValue(true)
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      const sessionWithFeatures = {
        ...mockSession,
        options: { engine: { features: [{ name: 'session-feature' }] } },
      }

      await handler(mockReq, stream, sessionWithFeatures, {
        text: 'Hello',
        extensions: { features: [{ name: 'ext-feature' }] },
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: expect.arrayContaining([
              { name: 'session-feature' },
              { name: 'ext-feature' },
            ]),
          }),
        })
      )
    })

    it('should NOT include extension features when session is untrusted', async () => {
      const stream = makeStream()

      isTrustedSession.mockReturnValue(false)
      getStatefulConversationEngine.mockResolvedValue(makeEngine())

      await handler(mockReq, stream, mockSession, {
        text: 'Hello',
        extensions: { features: [{ name: 'ext-feature' }] },
      })

      const options = getStatefulConversationEngine.mock.calls[0][0].options

      expect(options.features).not.toContainEqual({ name: 'ext-feature' })
    })
  })

  describe('error handling', () => {
    it('should call stream.error with generic error and captureError when engine.send throws', async () => {
      const stream = makeStream()
      const error = new Error('Engine failure')
      const engine = {
        send: jest.fn().mockRejectedValue(error),
        dispose: jest.fn().mockResolvedValue(undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

      expect(captureError).toHaveBeenCalledWith(error)
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
      const error = new SafeError('Visible problem', 'VISIBLE_CODE')
      const engine = {
        send: jest.fn().mockRejectedValue(error),
        dispose: jest.fn().mockResolvedValue(undefined),
      }

      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

      expect(captureError).toHaveBeenCalledWith(error)
      expect(stream.error).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VISIBLE_CODE',
          message: 'Visible problem',
        })
      )
      expect(stream.result).not.toHaveBeenCalled()
    })

    it('should push stamped generic error event for streaming responses', async () => {
      const stream = makeStream()
      const error = new Error('Engine failure')
      const engine = {
        send: jest.fn().mockRejectedValue(error),
        dispose: jest.fn().mockResolvedValue(undefined),
      }

      stream.acceptFormat = 'jsonl'
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(mockReq, stream, mockSession, { text: 'Hello' })

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
      expect(stream.result).not.toHaveBeenCalled()
    })

    it('should let the error propagate when getStatefulConversationEngine throws', async () => {
      const stream = makeStream()
      const error = new Error('Engine setup failed')

      getStatefulConversationEngine.mockRejectedValue(error)

      await expect(
        handler(mockReq, stream, mockSession, { text: 'Hello' })
      ).rejects.toThrow('Engine setup failed')
    })
  })
})
