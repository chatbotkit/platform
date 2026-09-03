import * as deepseek from '@/lib/model.provider.deepseek'
import {
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.deepseek.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

jest.mock('@/lib/model.provider.deepseek', () => ({
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

describe('deepseek.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
  })

  describe('createChatCompletion', () => {
    it('should call the underlying createChatCompletion with options', async () => {
      const mockResponse = { id: 'test-123', choices: [] }

      deepseek.createChatCompletion.mockResolvedValue(mockResponse)

      const options = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello' }],
      }

      const result = await createChatCompletion(options)

      expect(deepseek.createChatCompletion).toHaveBeenCalledTimes(1)
      expect(deepseek.createChatCompletion).toHaveBeenCalledWith(options)
      expect(result).toBe(mockResponse)
    })

    it('should pass through all provided options', async () => {
      const mockResponse = { id: 'test-456', choices: [] }

      deepseek.createChatCompletion.mockResolvedValue(mockResponse)

      const options = {
        model: 'deepseek-coder',
        messages: [{ role: 'user', content: 'Write code' }],
        temperature: 0.7,
        max_tokens: 100,
        stream: false,
      }

      await createChatCompletion(options)

      expect(deepseek.createChatCompletion).toHaveBeenCalledWith(options)
    })

    it('should propagate errors from underlying function', async () => {
      const mockError = new Error('API Error')

      deepseek.createChatCompletion.mockRejectedValue(mockError)

      const options = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Test' }],
      }

      await expect(createChatCompletion(options)).rejects.toThrow('API Error')
    })
  })

  describe('createChatCompletionStream', () => {
    it('should yield values from the underlying stream', async () => {
      const mockStream = [
        { id: '1', choices: [{ delta: { content: 'Hello' } }] },
        { id: '2', choices: [{ delta: { content: ' World' } }] },
      ]

      deepseek.createChatCompletionStream.mockImplementation(
        async function* () {
          yield* mockStream
        }
      )

      const options = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }

      const result = []

      for await (const chunk of createChatCompletionStream(options)) {
        result.push(chunk)
      }

      expect(deepseek.createChatCompletionStream).toHaveBeenCalledTimes(1)
      expect(deepseek.createChatCompletionStream).toHaveBeenCalledWith(options)
      expect(result).toEqual(mockStream)
    })

    it('should pass through all streaming options', async () => {
      deepseek.createChatCompletionStream.mockImplementation(
        async function* () {
          yield { id: 'test', choices: [] }
        }
      )

      const options = {
        model: 'deepseek-coder',
        messages: [{ role: 'user', content: 'Code' }],
        temperature: 0.5,
        stream: true,
      }

      // eslint-disable-next-line no-unused-vars
      for await (const chunk of createChatCompletionStream(options)) {
        // Consume the stream
      }

      expect(deepseek.createChatCompletionStream).toHaveBeenCalledWith(options)
    })

    it('should handle empty stream', async () => {
      deepseek.createChatCompletionStream.mockImplementation(
        async function* () {
          // Empty stream
        }
      )

      const options = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Test' }],
      }

      const result = []

      for await (const chunk of createChatCompletionStream(options)) {
        result.push(chunk)
      }

      expect(result).toEqual([])
    })

    it('should propagate errors from streaming function', async () => {
      deepseek.createChatCompletionStream.mockImplementation(
        async function* () {
          throw new Error('Stream Error')
        }
      )

      const options = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Test' }],
      }

      await expect(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const chunk of createChatCompletionStream(options)) {
          // Should not reach here
        }
      }).rejects.toThrow('Stream Error')
    })

    it('should handle stream with multiple chunks', async () => {
      const mockStream = [
        { id: '1', choices: [{ delta: { content: 'A' } }] },
        { id: '2', choices: [{ delta: { content: 'B' } }] },
        { id: '3', choices: [{ delta: { content: 'C' } }] },
        { id: '4', choices: [{ delta: { content: 'D' } }] },
      ]

      deepseek.createChatCompletionStream.mockImplementation(
        async function* () {
          yield* mockStream
        }
      )

      const options = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Test' }],
      }

      const result = []

      for await (const chunk of createChatCompletionStream(options)) {
        result.push(chunk)
      }

      expect(result).toHaveLength(4)
      expect(result).toEqual(mockStream)
    })
  })

  describe('providerModel', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      deepseek.createChatCompletion.mockResolvedValue({ completion: '' })
      deepseek.createChatCompletionStream.mockImplementation(
        async function* () {}
      )
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('model not found')
      })
    })

    it('should use providerModel when set on the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-deepseek-model-name' },
      })

      await createChatCompletion({ model: 'my-alias', messages: [] })

      expect(deepseek.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-deepseek-model-name' })
      )
    })

    it('should use the original model name when providerModel is not set', async () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      await createChatCompletion({ model: 'deepseek-chat', messages: [] })

      expect(deepseek.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'deepseek-chat' })
      )
    })

    it('should fall back to original model name when lookup throws', async () => {
      // default mock already throws

      await createChatCompletion({ model: 'deepseek-chat', messages: [] })

      expect(deepseek.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'deepseek-chat' })
      )
    })

    it('should apply providerModel in streaming mode', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-deepseek-model-name' },
      })

      for await (const _ of createChatCompletionStream({
        model: 'my-alias',
        messages: [],
      })) {
        // drain
      }

      expect(deepseek.createChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-deepseek-model-name' })
      )
    })
  })
})
