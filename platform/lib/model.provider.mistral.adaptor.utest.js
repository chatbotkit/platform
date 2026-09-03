/* eslint-disable @typescript-eslint/no-require-imports */
import {
  modelRequiresUserTurnAsLastMessage,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

import {
  createChatCompletion,
  createChatCompletionStream,
} from './model.provider.mistral.adaptor'

jest.mock('@/lib/model.provider.mistral', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.utils', () => ({
  isModel: jest.fn(() => false),
  modelRequiresUserTurnAsLastMessage: jest.fn(() => false),
  modelRequiresUserTurnBeforeToolCall: jest.fn(() => false),
  parseAndRevealLanguageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
}))

describe('mistral.adaptor', () => {
  const mistral = require('@/lib/model.provider.mistral')

  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
  })

  describe('createChatCompletion', () => {
    it('should call mistral createChatCompletion with options', async () => {
      const options = {
        model: 'mistral-small',
        messages: [{ role: 'user', content: 'Hello' }],
      }

      mistral.createChatCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: 'Hi there!' } }],
      })

      const result = await createChatCompletion(options)

      expect(mistral.createChatCompletion).toHaveBeenCalledWith(options)
      expect(result).toEqual({
        choices: [{ message: { content: 'Hi there!' } }],
      })
    })

    it('should pass through all options unchanged', async () => {
      const options = {
        model: 'mistral-large',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Test' },
        ],
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        stream: false,
      }

      mistral.createChatCompletion.mockResolvedValueOnce({ result: 'success' })

      await createChatCompletion(options)

      expect(mistral.createChatCompletion).toHaveBeenCalledWith(options)
    })

    it('should propagate errors from mistral', async () => {
      const error = new Error('API error')

      mistral.createChatCompletion.mockRejectedValueOnce(error)

      await expect(createChatCompletion({ model: 'test' })).rejects.toThrow(
        'API error'
      )
    })

    it('should return whatever mistral returns', async () => {
      const mockResponse = {
        id: 'chat-123',
        model: 'mistral-small',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finishReason: 'stop',
          },
        ],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }

      mistral.createChatCompletion.mockResolvedValueOnce(mockResponse)

      const result = await createChatCompletion({ model: 'test' })

      expect(result).toEqual(mockResponse)
    })
  })

  describe('createChatCompletionStream', () => {
    it('should yield all values from mistral stream', async () => {
      const mockStream = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' world' } }] },
        { choices: [{ delta: { content: '!' } }] },
      ]

      mistral.createChatCompletionStream.mockImplementation(async function* () {
        yield* mockStream
      })

      const options = {
        model: 'mistral-small',
        messages: [{ role: 'user', content: 'Test' }],
      }

      const results = []

      for await (const chunk of createChatCompletionStream(options)) {
        results.push(chunk)
      }

      expect(mistral.createChatCompletionStream).toHaveBeenCalledWith(options)
      expect(results).toEqual(mockStream)
    })

    it('should pass through all stream options', async () => {
      mistral.createChatCompletionStream.mockImplementation(async function* () {
        yield { done: true }
      })

      const options = {
        model: 'mistral-large',
        messages: [{ role: 'user', content: 'Stream test' }],
        temperature: 0.5,
        maxTokens: 200,
        stream: true,
      }

      const results = []

      for await (const chunk of createChatCompletionStream(options)) {
        results.push(chunk)
      }

      expect(mistral.createChatCompletionStream).toHaveBeenCalledWith(options)
    })

    it('should handle empty stream', async () => {
      mistral.createChatCompletionStream.mockImplementation(async function* () {
        // yield nothing
      })

      const results = []

      for await (const chunk of createChatCompletionStream({ model: 'test' })) {
        results.push(chunk)
      }

      expect(results).toEqual([])
    })

    it('should propagate stream errors', async () => {
      const error = new Error('Stream error')

      mistral.createChatCompletionStream.mockImplementation(async function* () {
        throw error
      })

      const iterator = createChatCompletionStream({ model: 'test' })

      await expect(iterator.next()).rejects.toThrow('Stream error')
    })

    it('should yield stream data in order', async () => {
      const mockStream = [
        { index: 0, delta: { content: 'A' } },
        { index: 1, delta: { content: 'B' } },
        { index: 2, delta: { content: 'C' } },
      ]

      mistral.createChatCompletionStream.mockImplementation(async function* () {
        for (const item of mockStream) {
          yield item
        }
      })

      const results = []

      for await (const chunk of createChatCompletionStream({ model: 'test' })) {
        results.push(chunk)
      }

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual(mockStream[0])
      expect(results[1]).toEqual(mockStream[1])
      expect(results[2]).toEqual(mockStream[2])
    })
  })

  describe('providerModel', () => {
    const mistral = require('@/lib/model.provider.mistral')

    beforeEach(() => {
      jest.clearAllMocks()
      mistral.createChatCompletion.mockResolvedValue({ completion: '' })
      mistral.createChatCompletionStream.mockImplementation(
        async function* () {}
      )
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('model not found')
      })
    })

    it('should use providerModel when set on the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-mistral-model-name' },
      })

      await createChatCompletion({ model: 'my-alias', messages: [] })

      expect(mistral.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-mistral-model-name' })
      )
    })

    it('should use the original model name when providerModel is not set', async () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      await createChatCompletion({ model: 'mistral-small', messages: [] })

      expect(mistral.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'mistral-small' })
      )
    })

    it('should fall back to original model name when lookup throws', async () => {
      // default mock already throws

      await createChatCompletion({ model: 'mistral-large', messages: [] })

      expect(mistral.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'mistral-large' })
      )
    })

    it('should apply providerModel in streaming mode', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-mistral-model-name' },
      })

      for await (const _ of createChatCompletionStream({
        model: 'my-alias',
        messages: [],
      })) {
        // drain
      }

      expect(mistral.createChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-mistral-model-name' })
      )
    })
  })
})
