/* eslint-disable @typescript-eslint/no-require-imports */
import { SafeError, SystemError } from '@/lib/error'

import {
  bodySchema,
  complete,
} from '@/pages/api/v1/conversation/[conversationId]/complete'

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

  it('should allow text to be omitted for receive-only continuation', () => {
    const result = bodySchema.validate({
      functions: [],
    })

    expect(result.error).toBeUndefined()
  })
})

describe('complete', () => {
  const { getStatefulConversationEngine } = require('@/lib/conversation.engine')
  const { captureError } = require('@/lib/error')

  const mockSession = {
    id: 'session-123',
    user: { id: 'user-123' },
    options: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('OpenAI error handling', () => {
    it('should stream a generic TAG_ERROR when OpenAI returns 403', async () => {
      const openai403Error = new SystemError(
        'Not authorized (403)',
        'OI_NOT_AUTHORIZED',
        {
          body: {
            model: 'gpt-4.1-mini',
            messages: [],
          },
        }
      )

      getStatefulConversationEngine.mockResolvedValue({
        send: jest.fn().mockRejectedValue(openai403Error),
        complete: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = []
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const event of iterator) {
        events.push(event)
      }

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('error')
      expect(events[0]).toEqual(
        expect.objectContaining({
          createdAt: expect.any(Number),
          data: {
            code: 'GENERIC_ERROR',
            message: 'Something went wrong',
          },
        })
      )
      expect(captureError).toHaveBeenCalledWith(openai403Error)
    })

    it('should stream a generic TAG_ERROR when OpenAI returns 500', async () => {
      const openai500Error = new SystemError(
        'Internal server error (500)',
        'OI_GENERIC_ERROR',
        {
          body: {
            model: 'gpt-4.1-mini',
          },
        }
      )

      getStatefulConversationEngine.mockResolvedValue({
        send: jest.fn().mockRejectedValue(openai500Error),
        complete: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = []
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const event of iterator) {
        events.push(event)
      }

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('error')
      expect(events[0].data).toEqual({
        code: 'GENERIC_ERROR',
        message: 'Something went wrong',
      })
    })

    it('should stream a generic TAG_ERROR when OpenAI returns 429', async () => {
      const openai429Error = new SystemError(
        'Rate limit exceeded (429)',
        'OI_RATE_LIMIT',
        {}
      )

      getStatefulConversationEngine.mockResolvedValue({
        send: jest.fn().mockRejectedValue(openai429Error),
        complete: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = []
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const event of iterator) {
        events.push(event)
      }

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('error')
      expect(events[0].data.code).toBe('GENERIC_ERROR')
    })

    it('should stream safe TAG_ERROR details for SafeError instances', async () => {
      const safeError = new SafeError('Please check your input', 'BAD_REQUEST')

      getStatefulConversationEngine.mockResolvedValue({
        send: jest.fn().mockRejectedValue(safeError),
        complete: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = []
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const event of iterator) {
        events.push(event)
      }

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual(
        expect.objectContaining({
          type: 'error',
          createdAt: expect.any(Number),
          data: {
            code: 'BAD_REQUEST',
            message: 'Please check your input',
          },
        })
      )
      expect(captureError).toHaveBeenCalledWith(safeError)
    })

    it('should stream TAG_ERROR when complete throws after successful send', async () => {
      const receiveError = new SystemError(
        'Not authorized (403)',
        'OI_NOT_AUTHORIZED',
        {}
      )

      getStatefulConversationEngine.mockResolvedValue({
        send: jest.fn().mockResolvedValue({
          usage: { token: 10 },
          messages: [{ id: 'msg-1', text: 'sent' }],
          entities: [],
        }),
        complete: jest.fn().mockRejectedValue(receiveError),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = []
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const event of iterator) {
        events.push(event)
      }

      // Should have send_result and then error
      const errorEvent = events.find((e) => e.type === 'error')

      expect(errorEvent).toBeDefined()
      expect(errorEvent.data.code).toBe('GENERIC_ERROR')
    })
  })

  describe('successful completion', () => {
    it('should stream sendResult, receiveResult, and result events on success', async () => {
      getStatefulConversationEngine.mockResolvedValue({
        send: jest.fn().mockResolvedValue({
          usage: { token: 10 },
          messages: [{ id: 'msg-1', text: 'user message processed' }],
          entities: [],
        }),
        complete: jest.fn().mockResolvedValue({
          usage: { token: 20 },
          messages: [{ id: 'msg-2', text: 'AI response' }],
        }),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = []
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const event of iterator) {
        events.push(event)
      }

      const eventTypes = events.map((e) => e.type)

      expect(eventTypes).toContain('sendResult')
      expect(eventTypes).toContain('receiveResult')
      expect(eventTypes).toContain('result')
      expect(eventTypes).not.toContain('error')
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'sendResult',
            createdAt: expect.any(Number),
          }),
          expect.objectContaining({
            type: 'receiveResult',
            createdAt: expect.any(Number),
          }),
          expect.objectContaining({
            type: 'result',
            createdAt: expect.any(Number),
          }),
        ])
      )
    })

    it('should pass abort signal to stateful engine options', async () => {
      const abortController = new AbortController()

      getStatefulConversationEngine.mockResolvedValue({
        send: jest.fn().mockResolvedValue({
          usage: { token: 10 },
          messages: [{ id: 'msg-1', text: 'user message processed' }],
          entities: [],
        }),
        complete: jest.fn().mockResolvedValue({
          usage: { token: 20 },
          messages: [{ id: 'msg-2', text: 'AI response' }],
        }),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const iterator = complete(
        mockSession,
        'conv-123',
        { text: 'hello' },
        { abortSignal: abortController.signal }
      )

      for await (const _event of iterator) {
        // drain iterator
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            signal: abortController.signal,
          }),
        })
      )
    })

    it('should skip send and continue with complete when text is omitted', async () => {
      const send = jest.fn()
      const engineComplete = jest.fn().mockResolvedValue({
        usage: { token: 20 },
        messages: [{ id: 'msg-2', text: 'AI continued response' }],
        reason: 'iteration',
      })

      getStatefulConversationEngine.mockResolvedValue({
        send,
        complete: engineComplete,
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = []
      const iterator = complete(mockSession, 'conv-123', {
        functions: [],
      })

      for await (const event of iterator) {
        events.push(event)
      }

      expect(send).not.toHaveBeenCalled()
      expect(engineComplete).toHaveBeenCalled()
      expect(events.map((event) => event.type)).toEqual([
        'receiveResult',
        'result',
      ])
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'receiveResult',
            createdAt: expect.any(Number),
          }),
          expect.objectContaining({
            type: 'result',
            createdAt: expect.any(Number),
          }),
        ])
      )
      expect(events[0].data).toEqual(
        expect.objectContaining({
          id: 'msg-2',
          text: 'AI continued response',
          usage: { token: 20 },
          end: { reason: 'iteration' },
        })
      )
    })
  })

  describe('trusted session: extensions forwarded to engine', () => {
    const { isTrustedSession } = require('@/lib/audience.helpers')

    const mockEngineSuccess = () => ({
      send: jest.fn().mockResolvedValue({
        usage: { token: 10 },
        messages: [{ id: 'msg-1', text: 'sent' }],
        entities: [],
      }),
      complete: jest.fn().mockResolvedValue({
        usage: { token: 20 },
        messages: [{ id: 'msg-2', text: 'response' }],
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    })

    beforeEach(() => {
      getStatefulConversationEngine.mockResolvedValue(mockEngineSuccess())
    })

    it('should forward backstory extension when session is trusted', async () => {
      isTrustedSession.mockReturnValue(true)

      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        extensions: { backstory: 'You are a helpful assistant.' },
      })

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: 'You are a helpful assistant.',
          }),
        })
      )
    })

    it('should NOT forward backstory extension when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        extensions: { backstory: 'Injected backstory' },
      })

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: undefined,
          }),
        })
      )
    })

    it('should forward inline datasets when session is trusted and datasets provided', async () => {
      isTrustedSession.mockReturnValue(true)

      const datasets = [
        {
          name: 'FAQ',
          description: 'Frequently asked questions',
          records: [{ text: 'Answer 1', meta: {} }],
        },
      ]

      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        extensions: { datasets },
      })

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineDatasets: datasets,
          }),
        })
      )
    })

    it('should NOT forward inline datasets when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      const datasets = [
        {
          name: 'Injected',
          description: 'Injected dataset',
          records: [{ text: 'Injected content', meta: {} }],
        },
      ]

      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        extensions: { datasets },
      })

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineDatasets: undefined,
          }),
        })
      )
    })

    it('should forward inline skillsets when session is trusted and skillsets provided', async () => {
      isTrustedSession.mockReturnValue(true)

      const skillsets = [
        {
          name: 'CustomTools',
          description: 'Custom tool definitions',
          abilities: [
            {
              name: 'lookup',
              description: 'Look up data',
              instruction: 'Use this to look up data',
              linkedSecretId: 'secret-1',
            },
          ],
        },
      ]

      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        extensions: { skillsets },
      })

      for await (const _event of iterator) {
        // drain
      }

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

      const sessionWithFeatures = {
        ...mockSession,
        options: { engine: { features: ['session-feature'] } },
      }

      const iterator = complete(sessionWithFeatures, 'conv-123', {
        text: 'hello',
        extensions: { features: ['extension-feature'] },
      })

      for await (const _event of iterator) {
        // drain
      }

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

    it('should NOT include extension features when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        extensions: { features: ['injected-feature'] },
      })

      for await (const _event of iterator) {
        // drain
      }

      const callArgs = getStatefulConversationEngine.mock.calls[0][0]

      expect(callArgs.options.features).not.toContain('injected-feature')
    })
  })

  describe('limits forwarded to engine', () => {
    const { isTrustedSession } = require('@/lib/audience.helpers')

    const mockEngineSuccess = () => ({
      send: jest.fn().mockResolvedValue({
        usage: { token: 5 },
        messages: [{ id: 'msg-1', text: 'sent' }],
        entities: [],
      }),
      complete: jest.fn().mockResolvedValue({
        usage: { token: 10 },
        messages: [{ id: 'msg-2', text: 'response' }],
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    })

    beforeEach(() => {
      isTrustedSession.mockReturnValue(false)
      getStatefulConversationEngine.mockResolvedValue(mockEngineSuccess())
    })

    it('should pass maxIterations, maxContinuations, maxCalls when limits provided', async () => {
      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        limits: { iterations: 5, continuations: 3, calls: 10 },
      })

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxIterations: 5,
            maxContinuations: 3,
            maxCalls: 10,
          }),
        })
      )
    })

    it('should pass undefined for limits when not provided', async () => {
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxIterations: undefined,
            maxContinuations: undefined,
            maxCalls: undefined,
          }),
        })
      )
    })

    it('should pass partial limits when only some are provided', async () => {
      const iterator = complete(mockSession, 'conv-123', {
        text: 'hello',
        limits: { iterations: 2 },
      })

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxIterations: 2,
            maxContinuations: undefined,
            maxCalls: undefined,
          }),
        })
      )
    })
  })

  describe('timeout marks forwarded to engine', () => {
    const mockEngineSuccess = () => ({
      send: jest.fn().mockResolvedValue({
        usage: { token: 5 },
        messages: [{ id: 'msg-1', text: 'sent' }],
        entities: [],
      }),
      complete: jest.fn().mockResolvedValue({
        usage: { token: 10 },
        messages: [{ id: 'msg-2', text: 'response' }],
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    })

    beforeEach(() => {
      getStatefulConversationEngine.mockResolvedValue(mockEngineSuccess())
    })

    it('should always enable the timeoutMarks feature', async () => {
      const iterator = complete(mockSession, 'conv-123', { text: 'hello' })

      for await (const _event of iterator) {
        // drain
      }

      const callArg = getStatefulConversationEngine.mock.calls[0][0]

      expect(callArg.options.features).toContainEqual({ name: 'timeoutMarks' })
    })

    it('should forward mark signals from options to the engine', async () => {
      const markSignals = [new AbortController().signal]

      const iterator = complete(
        mockSession,
        'conv-123',
        { text: 'hello' },
        { markSignals }
      )

      for await (const _event of iterator) {
        // drain
      }

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ markSignals }),
        })
      )
    })
  })
})
