import * as qwen from '@/lib/model.provider.qwen'
import {
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.qwen.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

jest.mock('@/lib/model.provider.qwen', () => ({
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

describe('qwen.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
  })

  describe('createChatCompletion', () => {
    it('should call the underlying createChatCompletion with options', async () => {
      const mockResponse = { id: 'test-123', choices: [] }

      qwen.createChatCompletion.mockResolvedValue(mockResponse)

      const options = {
        model: 'qwen-max',
        messages: [{ role: 'user', content: 'Hello' }],
      }

      const result = await createChatCompletion(options)

      expect(qwen.createChatCompletion).toHaveBeenCalledTimes(1)
      expect(qwen.createChatCompletion).toHaveBeenCalledWith(options)
      expect(result).toBe(mockResponse)
    })

    it('should propagate errors from underlying function', async () => {
      const mockError = new Error('API Error')

      qwen.createChatCompletion.mockRejectedValue(mockError)

      const options = {
        model: 'qwen-max',
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

      qwen.createChatCompletionStream.mockImplementation(async function* () {
        yield* mockStream
      })

      const options = {
        model: 'qwen-max',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }

      const result = []

      for await (const chunk of createChatCompletionStream(options)) {
        result.push(chunk)
      }

      expect(qwen.createChatCompletionStream).toHaveBeenCalledTimes(1)
      expect(qwen.createChatCompletionStream).toHaveBeenCalledWith(options)
      expect(result).toEqual(mockStream)
    })

    it('should propagate errors from streaming function', async () => {
      qwen.createChatCompletionStream.mockImplementation(async function* () {
        throw new Error('Stream Error')
      })

      const options = {
        model: 'qwen-max',
        messages: [{ role: 'user', content: 'Test' }],
      }

      await expect(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const chunk of createChatCompletionStream(options)) {
          // Should not reach here
        }
      }).rejects.toThrow('Stream Error')
    })
  })

  describe('providerModel', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      qwen.createChatCompletion.mockResolvedValue({ completion: '' })
      qwen.createChatCompletionStream.mockImplementation(async function* () {})
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('model not found')
      })
    })

    it('should use providerModel when set on the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-qwen-model-name' },
      })

      await createChatCompletion({ model: 'my-alias', messages: [] })

      expect(qwen.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-qwen-model-name' })
      )
    })

    it('should use the original model name when providerModel is not set', async () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      await createChatCompletion({ model: 'qwen-max', messages: [] })

      expect(qwen.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'qwen-max' })
      )
    })

    it('should fall back to original model name when lookup throws', async () => {
      // default mock already throws

      await createChatCompletion({ model: 'qwen-max', messages: [] })

      expect(qwen.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'qwen-max' })
      )
    })

    it('should apply providerModel in streaming mode', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-qwen-model-name' },
      })

      for await (const _ of createChatCompletionStream({
        model: 'my-alias',
        messages: [],
      })) {
        // drain
      }

      expect(qwen.createChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-qwen-model-name' })
      )
    })
  })
})
