/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { SafeError, SystemError } from '@/lib/error'

import { complete } from '@/pages/api/v1/conversation/complete'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/audience.helpers', () => ({
  isTrustedSession: jest.fn(() => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatelessConversationEngine: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/namespace.safe', () => ({
  getSafeNamespace: jest.fn((user, ns) => ns),
}))

jest.mock('@/lib/namespace.attachment', () => ({
  uploadNamespaceAttachmentFromURL: jest.fn(),
  makeNamespaceAttachmentUploadActivityMessages: jest.fn(() => []),
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn(() => 10 * 1024 * 1024),
}))

jest.mock('@/lib/stream', () => ({
  withStreamContinuity: (fn) => fn,
}))

// @note contactId and messages schemas import prisma/client which is not available in this env
jest.mock('@/schemas/contactId', () => () => {
  const schema = jest.requireActual('@/lib/joi.schema').default

  return schema
    .alternatives()
    .try(schema.string().allow(null, ''), schema.object())
})

jest.mock('@/schemas/messages', () => {
  const schema = jest.requireActual('@/lib/joi.schema').default

  return { __esModule: true, default: schema.array() }
})

/** Helper to collect all events from the complete() generator. */
async function collectEvents(session, body, options = {}) {
  const result = []

  for await (const event of complete(session, body, options)) {
    result.push(event)
  }

  return result
}

/** Builds a minimal mock engine with successful process/complete. */
function makeTestEngine({
  processText = 'user message processed',
  completeText = 'AI response',
  processUsageToken = 10,
  completeUsageToken = 20,
  reason = 'stop',
  entities = [],
} = {}) {
  return {
    process: jest.fn().mockResolvedValue({
      usage: { token: processUsageToken },
      messages: [{ id: 'msg-1', text: processText }],
      entities,
    }),
    complete: jest.fn().mockResolvedValue({
      usage: { token: completeUsageToken },
      messages: [{ id: 'msg-2', text: completeText }],
      reason,
    }),
    dispose: jest.fn().mockResolvedValue(undefined),
  }
}

describe('complete', () => {
  const {
    getStatelessConversationEngine,
  } = require('@/lib/conversation.engine')
  const { captureError } = require('@/lib/error')
  const { setContextNamespace } = require('@/lib/context.store')
  const { getSafeNamespace } = require('@/lib/namespace.safe')
  const {
    uploadNamespaceAttachmentFromURL,
    makeNamespaceAttachmentUploadActivityMessages,
  } = require('@/lib/namespace.attachment')
  const { getMaxFileSize } = require('@/lib/user.limits')
  const { isTrustedSession } = require('@/lib/audience.helpers')

  const mockSession = {
    id: 'session-123',
    user: { id: 'user-123' },
    options: {},
  }

  const baseBody = {
    messages: [{ type: 'user', text: 'hello' }],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    isTrustedSession.mockReturnValue(false)
  })

  describe('successful completion', () => {
    it('should stream sendResult, receiveResult, and result events in order', async () => {
      getStatelessConversationEngine.mockResolvedValue(
        makeTestEngine({
          processText: 'processed',
          completeText: 'AI reply',
          reason: 'stop',
        })
      )

      const events = await collectEvents(mockSession, baseBody)

      const types = events.map((e) => e.type)

      expect(types).toContain('sendResult')
      expect(types).toContain('receiveResult')
      expect(types).toContain('result')

      expect(types.indexOf('sendResult')).toBeLessThan(
        types.indexOf('receiveResult')
      )
      expect(types.indexOf('receiveResult')).toBeLessThan(
        types.indexOf('result')
      )
    })

    it('should include createdAt on emitted events', async () => {
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      const events = await collectEvents(mockSession, baseBody)

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

    it('should include the last process message text in sendResult', async () => {
      getStatelessConversationEngine.mockResolvedValue(
        makeTestEngine({ processText: 'function call issued' })
      )

      const events = await collectEvents(mockSession, baseBody)

      const sendResult = events.find((e) => e.type === 'sendResult')

      expect(sendResult.data.text).toBe('function call issued')
    })

    it('should include the last complete message text in receiveResult and result', async () => {
      getStatelessConversationEngine.mockResolvedValue(
        makeTestEngine({ completeText: 'the final answer' })
      )

      const events = await collectEvents(mockSession, baseBody)

      const receiveResult = events.find((e) => e.type === 'receiveResult')
      const result = events.find((e) => e.type === 'result')

      expect(receiveResult.data.text).toBe('the final answer')
      expect(result.data.text).toBe('the final answer')
    })

    it('should accumulate token usage across process and complete phases', async () => {
      getStatelessConversationEngine.mockResolvedValue(
        makeTestEngine({ processUsageToken: 10, completeUsageToken: 25 })
      )

      const events = await collectEvents(mockSession, baseBody)

      const receiveResult = events.find((e) => e.type === 'receiveResult')
      const result = events.find((e) => e.type === 'result')

      // @note usage object is shared by reference, so all events see the final total
      expect(receiveResult.data.usage.token).toBe(35)
      expect(result.data.usage.token).toBe(35)
    })

    it('should include the completion reason in receiveResult and result', async () => {
      getStatelessConversationEngine.mockResolvedValue(
        makeTestEngine({ reason: 'length' })
      )

      const events = await collectEvents(mockSession, baseBody)

      const receiveResult = events.find((e) => e.type === 'receiveResult')
      const result = events.find((e) => e.type === 'result')

      expect(receiveResult.data.end.reason).toBe('length')
      expect(result.data.end.reason).toBe('length')
    })

    it('should include entities from process in sendResult', async () => {
      const entities = [{ type: 'function', name: 'search', arguments: {} }]

      getStatelessConversationEngine.mockResolvedValue(
        makeTestEngine({ entities })
      )

      const events = await collectEvents(mockSession, baseBody)

      const sendResult = events.find((e) => e.type === 'sendResult')

      expect(sendResult.data.entities).toEqual(entities)
    })
  })

  describe('error handling', () => {
    it('should emit a generic error for unsafe errors after successful process', async () => {
      const openai429Error = new SystemError(
        'Too many requests (429)',
        'OI_TOO_MANY_REQUESTS',
        {
          body: {
            model: 'gpt-4.1-mini',
            functions: [{ name: 'lookup_weather' }],
          },
        }
      )

      getStatelessConversationEngine.mockResolvedValue({
        process: jest.fn().mockResolvedValue({
          usage: { token: 10 },
          messages: [{ id: 'msg-1', text: 'calling function' }],
          entities: [
            {
              type: 'function',
              name: 'lookup_weather',
              arguments: { location: 'Tokyo' },
            },
          ],
        }),
        complete: jest.fn().mockRejectedValue(openai429Error),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = await collectEvents(mockSession, {
        messages: [{ type: 'user', text: 'What is the weather in Tokyo?' }],
        functions: [
          {
            name: 'lookup_weather',
            description: 'Look up current weather for a location',
            parameters: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
            },
          },
        ],
      })

      const sendResultEvent = events.find((e) => e.type === 'sendResult')
      const errorEvent = events.find((e) => e.type === 'error')

      expect(sendResultEvent).toBeDefined()
      expect(sendResultEvent.data.text).toBe('calling function')
      expect(sendResultEvent.data.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'lookup_weather' }),
        ])
      )

      expect(errorEvent).toBeDefined()
      expect(errorEvent).toEqual(
        expect.objectContaining({
          createdAt: expect.any(Number),
          data: {
            code: 'GENERIC_ERROR',
            message: 'Something went wrong',
          },
        })
      )

      expect(events.findIndex((e) => e.type === 'sendResult')).toBeLessThan(
        events.findIndex((e) => e.type === 'error')
      )

      expect(captureError).toHaveBeenCalledWith(openai429Error)
    })

    it('should emit safe error details for SafeError instances', async () => {
      const safeError = new SafeError('Please check your input', 'BAD_REQUEST')

      getStatelessConversationEngine.mockResolvedValue({
        process: jest.fn().mockRejectedValue(safeError),
        complete: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = await collectEvents(mockSession, baseBody)
      const errorEvent = events.find((e) => e.type === 'error')

      expect(errorEvent).toEqual(
        expect.objectContaining({
          createdAt: expect.any(Number),
          data: {
            code: 'BAD_REQUEST',
            message: 'Please check your input',
          },
        })
      )
      expect(captureError).toHaveBeenCalledWith(safeError)
    })

    it('should emit TAG_ERROR and no sendResult when process() throws', async () => {
      const processError = new SystemError('Process failed', 'AI_GENERIC_ERROR')

      getStatelessConversationEngine.mockResolvedValue({
        process: jest.fn().mockRejectedValue(processError),
        complete: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = await collectEvents(mockSession, baseBody)

      expect(events.find((e) => e.type === 'sendResult')).toBeUndefined()
      expect(events.find((e) => e.type === 'error')).toBeDefined()
      expect(events.find((e) => e.type === 'error').data.code).toBe(
        'GENERIC_ERROR'
      )
      expect(captureError).toHaveBeenCalledWith(processError)
    })

    it('should not yield TAG_RESULT when process() throws before complete()', async () => {
      getStatelessConversationEngine.mockResolvedValue({
        process: jest.fn().mockRejectedValue(new Error('process failed')),
        complete: jest.fn(),
        dispose: jest.fn().mockResolvedValue(undefined),
      })

      const events = await collectEvents(mockSession, baseBody)

      expect(events.find((e) => e.type === 'result')).toBeUndefined()
    })
  })

  describe('trusted session: extension forwarding', () => {
    it('should NOT forward backstory when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        extensions: { backstory: 'secret backstory' },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: undefined,
          }),
        })
      )
    })

    it('should forward backstory when session is trusted', async () => {
      isTrustedSession.mockReturnValue(true)

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        extensions: { backstory: 'trusted backstory' },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            backstoryExtra: 'trusted backstory',
          }),
        })
      )
    })

    it('should NOT forward inlineDatasets when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        extensions: { datasets: ['ds-1', 'ds-2'] },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineDatasets: undefined,
          }),
        })
      )
    })

    it('should forward inlineDatasets when session is trusted and datasets provided', async () => {
      isTrustedSession.mockReturnValue(true)

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        extensions: { datasets: ['ds-1', 'ds-2'] },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineDatasets: ['ds-1', 'ds-2'],
          }),
        })
      )
    })

    it('should NOT forward inlineSkillsets when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        extensions: { skillsets: ['sk-1'] },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineSkillsets: undefined,
          }),
        })
      )
    })

    it('should forward inlineSkillsets when session is trusted and skillsets provided', async () => {
      isTrustedSession.mockReturnValue(true)

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        extensions: { skillsets: ['sk-1'] },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineSkillsets: ['sk-1'],
          }),
        })
      )
    })

    it('should accept and forward an inline ability with linkedSpaceId', async () => {
      // @note the engine is mocked here, so the schema is exercised directly
      // and the route is asserted to forward the validated object untouched
      const extensionsSchema = require('@/schemas/inlineExtensions').default

      const skillset = {
        name: 'shell',
        description: 'Shell tools',
        abilities: [
          {
            name: 'run',
            description: 'Run a command',
            instruction: 'shell: run',
            linkedSecretId: 'secret-1',
            linkedSpaceId: 'space-1',
          },
        ],
      }

      const { error, value } = extensionsSchema.validate({
        skillsets: [skillset],
      })

      expect(error).toBeUndefined()
      expect(value.skillsets[0].abilities[0].linkedSpaceId).toBe('space-1')

      isTrustedSession.mockReturnValue(true)

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        extensions: { skillsets: value.skillsets },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            inlineSkillsets: [
              expect.objectContaining({
                abilities: [expect.objectContaining({ linkedSpaceId: 'space-1' })],
              }),
            ],
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

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(sessionWithFeatures, {
        ...baseBody,
        extensions: { features: ['ext-feature'] },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: expect.arrayContaining([
              'session-feature',
              'ext-feature',
            ]),
          }),
        })
      )
    })

    it('should NOT include extension features when session is untrusted', async () => {
      isTrustedSession.mockReturnValue(false)

      const sessionWithFeatures = {
        ...mockSession,
        options: { engine: { features: ['session-feature'] } },
      }

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(sessionWithFeatures, {
        ...baseBody,
        extensions: { features: ['ext-feature'] },
      })

      const callArg = getStatelessConversationEngine.mock.calls[0][0]

      expect(callArg.options.features).not.toContain('ext-feature')
      expect(callArg.options.features).toContain('session-feature')
    })
  })

  describe('limits forwarded to engine', () => {
    it('should pass maxIterations, maxContinuations, maxCalls when limits provided', async () => {
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        limits: { iterations: 5, continuations: 3, calls: 10 },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
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
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, baseBody)

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
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
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        limits: { iterations: 7 },
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxIterations: 7,
            maxContinuations: undefined,
            maxCalls: undefined,
          }),
        })
      )
    })
  })

  describe('timeout marks forwarded to engine', () => {
    it('should always enable the timeoutMarks feature', async () => {
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, baseBody)

      const callArg = getStatelessConversationEngine.mock.calls[0][0]

      expect(callArg.options.features).toContainEqual({ name: 'timeoutMarks' })
    })

    it('should forward mark signals from options to the engine', async () => {
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      const markSignals = [new AbortController().signal]

      await collectEvents(mockSession, baseBody, { markSignals })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ markSignals }),
        })
      )
    })
  })

  describe('namespace handling', () => {
    it('should set context namespace when namespace is provided', async () => {
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        namespace: 'ns-abc',
      })

      expect(getSafeNamespace).toHaveBeenCalledWith(mockSession.user, 'ns-abc')
      expect(setContextNamespace).toHaveBeenCalledWith('ns-abc')
    })

    it('should NOT set context namespace when no namespace is provided', async () => {
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, baseBody)

      expect(setContextNamespace).not.toHaveBeenCalled()
    })
  })

  describe('attachment handling', () => {
    it('should throw bad request when attachments are provided without a namespace', async () => {
      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      // @note throwBadRequest() is called before the try/catch in complete(), so
      // the error propagates through events() and is re-thrown from the generator
      await expect(
        collectEvents(mockSession, {
          ...baseBody,
          attachments: [{ url: 'https://example.com/file.pdf' }],
        })
      ).rejects.toThrow('Attachments require a namespace')
    })

    it('should upload attachments and prepend activity messages when namespace is provided', async () => {
      const uploadedRef = {
        attachmentId: 'att-1',
        name: 'doc.pdf',
        type: 'application/pdf',
      }
      const requestActivity = { type: 'activity', text: 'uploading...' }
      const responseActivity = { type: 'activity', text: 'uploaded doc.pdf' }

      uploadNamespaceAttachmentFromURL.mockResolvedValue(uploadedRef)
      makeNamespaceAttachmentUploadActivityMessages.mockReturnValue({
        request: requestActivity,
        response: responseActivity,
      })

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        namespace: 'ns-uploads',
        attachments: [{ url: 'https://example.com/doc.pdf' }],
      })

      expect(uploadNamespaceAttachmentFromURL).toHaveBeenCalledWith(
        'ns-uploads',
        'https://example.com/doc.pdf',
        undefined,
        expect.objectContaining({ maxSize: expect.any(Number) })
      )

      expect(
        makeNamespaceAttachmentUploadActivityMessages
      ).toHaveBeenCalledWith({
        id: uploadedRef.attachmentId,
        name: uploadedRef.name,
        type: uploadedRef.type,
      })

      // activity messages are pushed as TAG_MESSAGE events before the engine is called
      const messageEvents = await collectEvents(mockSession, {
        ...baseBody,
        namespace: 'ns-uploads',
        attachments: [{ url: 'https://example.com/doc.pdf' }],
      })
      const tagMessageEvents = messageEvents.filter((e) => e.type === 'message')

      expect(tagMessageEvents.length).toBeGreaterThan(0)
    })

    it('should use getMaxFileSize for attachment upload size limit', async () => {
      getMaxFileSize.mockResolvedValue(5 * 1024 * 1024)
      uploadNamespaceAttachmentFromURL.mockResolvedValue({})
      makeNamespaceAttachmentUploadActivityMessages.mockReturnValue([])

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, {
        ...baseBody,
        namespace: 'ns-uploads',
        attachments: [{ url: 'https://example.com/img.png' }],
      })

      expect(uploadNamespaceAttachmentFromURL).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        undefined,
        expect.objectContaining({ maxSize: 5 * 1024 * 1024 })
      )
    })
  })

  describe('abort signal forwarding', () => {
    it('should pass abort signal to stateless engine options', async () => {
      const abortController = new AbortController()

      getStatelessConversationEngine.mockResolvedValue(makeTestEngine())

      await collectEvents(mockSession, baseBody, {
        abortSignal: abortController.signal,
      })

      expect(getStatelessConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            signal: abortController.signal,
          }),
        })
      )
    })
  })
})
