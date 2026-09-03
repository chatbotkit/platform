/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { bodySchema, default as handler } from './generate'

jest.mock('@/lib/magic', () => ({
  prompts: {
    'prompt-uuid-1': { system: 'You are a helper', temperature: 0.7 },
    'prompt-uuid-2': { system: 'You are a coder', temperature: 0.5 },
  },
  aliasToPromptIdMap: {
    '@helper': 'prompt-uuid-1',
    '@coder': 'prompt-uuid-2',
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const joiMock = {
    object: jest.fn((schema) => schema),
    string: jest.fn(() => ({ required: jest.fn(() => 'string') })),
    withSchema: jest.fn((_schema, fn) => fn),
  }

  return {
    ...joiMock,
    default: joiMock,
    withSchema: jest.fn((_schema, fn) => fn),
  }
})

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn(() => {
    throw new Error('Not Found')
  }),
}))

jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn(),
  },
}))

jest.mock('@/lib/model.utils', () => ({
  getBaseLanguageModelTokenCount: jest.fn((model, tokens) => tokens),
}))

jest.mock('@/schemas/languageModel', () => 'languageModel')

const { requiredUrlParam } = require('@/lib/query.get')
const { throwNotFound } = require('@/lib/response')
const { execPrompt } = require('@/lib/prompt')
const { Usage } = require('@/lib/usage.model')
const { getBaseLanguageModelTokenCount } = require('@/lib/model.utils')

describe('POST /api/v1/magic/[promptId]/generate', () => {
  const mockSession = {
    user: {
      id: 'user_abc',
    },
  }

  const mockStream = {
    push: jest.fn(),
    result: jest.fn(),
    error: jest.fn(),
    abortSignal: null,
  }

  const mockReq = {
    query: { promptId: 'prompt-uuid-1' },
  }

  const mockBody = {
    text: 'Write a backstory for my bot',
    model: 'gpt-4o',
    props: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
    requiredUrlParam.mockReturnValue('prompt-uuid-1')
    execPrompt.mockResolvedValue({
      completion: 'Generated text result',
      tokensUsed: 150,
      modelUsed: 'gpt-4o',
    })
    mockStream.push.mockResolvedValue(undefined)
    mockStream.result.mockResolvedValue(undefined)
    getBaseLanguageModelTokenCount.mockImplementation(
      (_model, tokens) => tokens
    )
    Usage.createAndRecord.mockResolvedValue(undefined)
  })

  describe('bodySchema', () => {
    it('should export a bodySchema object', () => {
      expect(bodySchema).toBeDefined()
    })
  })

  describe('prompt lookup by id', () => {
    it('should call execPrompt with the matching prompt when promptId is a known UUID', async () => {
      requiredUrlParam.mockReturnValue('prompt-uuid-1')

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helper',
          temperature: 0.7,
          user: 'user_abc',
        }),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should call execPrompt with a second prompt when promptId is the second UUID', async () => {
      requiredUrlParam.mockReturnValue('prompt-uuid-2')

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a coder',
          temperature: 0.5,
        }),
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  describe('prompt lookup by alias', () => {
    it('should resolve @helper alias to prompt-uuid-1 and call execPrompt', async () => {
      requiredUrlParam.mockReturnValue('@helper')

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ system: 'You are a helper' }),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should resolve @coder alias to prompt-uuid-2 and call execPrompt', async () => {
      requiredUrlParam.mockReturnValue('@coder')

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ system: 'You are a coder' }),
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  describe('unknown promptId', () => {
    it('should throw not found when promptId is not in prompts or aliasMap', async () => {
      requiredUrlParam.mockReturnValue('unknown-prompt-id')

      await expect(
        handler(mockReq, mockStream, mockSession, mockBody)
      ).rejects.toThrow('Not Found')

      expect(throwNotFound).toHaveBeenCalledTimes(1)
      expect(execPrompt).not.toHaveBeenCalled()
    })

    it('should throw not found for an unknown alias', async () => {
      requiredUrlParam.mockReturnValue('@nonexistent')

      await expect(
        handler(mockReq, mockStream, mockSession, mockBody)
      ).rejects.toThrow('Not Found')

      expect(throwNotFound).toHaveBeenCalledTimes(1)
    })
  })

  describe('execPrompt invocation', () => {
    it('should pass the user id from the session to execPrompt', async () => {
      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ user: 'user_abc' }),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should pass the model from the request body to execPrompt', async () => {
      await handler(mockReq, mockStream, mockSession, {
        ...mockBody,
        model: 'gpt-3.5-turbo',
      })

      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-3.5-turbo' }),
        expect.any(Object),
        expect.any(Object)
      )
    })

    it('should pass the text as input in the data object to execPrompt', async () => {
      await handler(mockReq, mockStream, mockSession, {
        ...mockBody,
        text: 'My bot is friendly',
      })

      expect(execPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ input: 'My bot is friendly' }),
        expect.any(Object)
      )
    })

    it('should spread additional props into the data object', async () => {
      const props = { language: 'French', tone: 'formal' }

      await handler(mockReq, mockStream, mockSession, { ...mockBody, props })

      expect(execPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          language: 'French',
          tone: 'formal',
          input: mockBody.text,
        }),
        expect.any(Object)
      )
    })

    it('should forward the abortSignal from the stream to execPrompt', async () => {
      const abortController = new AbortController()
      const streamWithSignal = {
        ...mockStream,
        abortSignal: abortController.signal,
      }

      await handler(mockReq, streamWithSignal, mockSession, mockBody)

      expect(execPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({ abortSignal: abortController.signal })
      )
    })
  })

  describe('token streaming', () => {
    it('should push token events to the stream for each token received from execPrompt', async () => {
      let capturedSink

      execPrompt.mockImplementation(async (_promptArgs, _data, options) => {
        capturedSink = options.sink

        await capturedSink.push('token', { token: 'Hello' })
        await capturedSink.push('token', { token: ' world' })

        return {
          completion: 'Hello world',
          tokensUsed: 10,
          modelUsed: 'gpt-4o',
        }
      })

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(mockStream.push).toHaveBeenCalledWith({
        type: 'token',
        data: { token: 'Hello' },
      })
      expect(mockStream.push).toHaveBeenCalledWith({
        type: 'token',
        data: { token: ' world' },
      })
      expect(mockStream.push).toHaveBeenCalledTimes(2)
    })

    it('should silently ignore non-token event types from execPrompt sink', async () => {
      execPrompt.mockImplementation(async (_promptArgs, _data, options) => {
        await options.sink.push('metadata', { someKey: 'value' })
        await options.sink.push('status', { status: 'processing' })

        return { completion: 'Result', tokensUsed: 5, modelUsed: 'gpt-4o' }
      })

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(mockStream.push).not.toHaveBeenCalled()
    })
  })

  describe('usage recording', () => {
    it('should record token usage after completion', async () => {
      execPrompt.mockResolvedValue({
        completion: 'Done',
        tokensUsed: 200,
        modelUsed: 'gpt-4o',
      })

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(Usage.createAndRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockSession.user,
          token: 200,
          model: 'gpt-4o',
          meta: { reason: 'magic/generate' },
        })
      )
    })

    it('should not record usage when throwNotFound is called', async () => {
      requiredUrlParam.mockReturnValue('nonexistent')

      await expect(
        handler(mockReq, mockStream, mockSession, mockBody)
      ).rejects.toThrow()

      expect(Usage.createAndRecord).not.toHaveBeenCalled()
    })
  })

  describe('stream result', () => {
    it('should call stream.result with the completion text and token usage', async () => {
      getBaseLanguageModelTokenCount.mockReturnValue(75)

      execPrompt.mockResolvedValue({
        completion: 'Final answer',
        tokensUsed: 150,
        modelUsed: 'gpt-4o',
      })

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(mockStream.result).toHaveBeenCalledWith({
        text: 'Final answer',
        usage: {
          token: 75,
        },
      })
    })

    it('should pass modelUsed and tokensUsed to getBaseLanguageModelTokenCount', async () => {
      execPrompt.mockResolvedValue({
        completion: 'Result',
        tokensUsed: 300,
        modelUsed: 'claude-3-opus',
      })

      await handler(mockReq, mockStream, mockSession, mockBody)

      expect(getBaseLanguageModelTokenCount).toHaveBeenCalledWith(
        'claude-3-opus',
        300
      )
    })
  })
})
