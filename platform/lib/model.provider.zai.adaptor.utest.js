import * as zai from '@/lib/model.provider.zai'
import {
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.zai.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

jest.mock('@/lib/model.provider.zai', () => ({
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

describe('zai.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
  })

  describe('createChatCompletion', () => {
    it('should call the underlying createChatCompletion with options', async () => {
      const mockResponse = { id: 'test-123', choices: [] }

      zai.createChatCompletion.mockResolvedValue(mockResponse)

      const options = {
        model: 'glm-4.6',
        messages: [{ role: 'user', content: 'Hello' }],
      }

      const result = await createChatCompletion(options)

      expect(zai.createChatCompletion).toHaveBeenCalledTimes(1)
      expect(zai.createChatCompletion).toHaveBeenCalledWith(options)
      expect(result).toBe(mockResponse)
    })

    it('should propagate errors from underlying function', async () => {
      const mockError = new Error('API Error')

      zai.createChatCompletion.mockRejectedValue(mockError)

      const options = {
        model: 'glm-4.6',
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

      zai.createChatCompletionStream.mockImplementation(async function* () {
        yield* mockStream
      })

      const options = {
        model: 'glm-4.6',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }

      const result = []

      for await (const chunk of createChatCompletionStream(options)) {
        result.push(chunk)
      }

      expect(zai.createChatCompletionStream).toHaveBeenCalledTimes(1)
      expect(zai.createChatCompletionStream).toHaveBeenCalledWith(options)
      expect(result).toEqual(mockStream)
    })

    it('should propagate errors from streaming function', async () => {
      zai.createChatCompletionStream.mockImplementation(async function* () {
        throw new Error('Stream Error')
      })

      const options = {
        model: 'glm-4.6',
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
      zai.createChatCompletion.mockResolvedValue({ completion: '' })
      zai.createChatCompletionStream.mockImplementation(async function* () {})
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('model not found')
      })
    })

    it('should use providerModel when set on the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-zai-model-name' },
      })

      await createChatCompletion({ model: 'my-alias', messages: [] })

      expect(zai.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-zai-model-name' })
      )
    })

    it('should use the original model name when providerModel is not set', async () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      await createChatCompletion({ model: 'glm-4.6', messages: [] })

      expect(zai.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'glm-4.6' })
      )
    })

    it('should fall back to original model name when lookup throws', async () => {
      // default mock already throws

      await createChatCompletion({ model: 'glm-4.6', messages: [] })

      expect(zai.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'glm-4.6' })
      )
    })

    it('should apply providerModel in streaming mode', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-zai-model-name' },
      })

      for await (const _ of createChatCompletionStream({
        model: 'my-alias',
        messages: [],
      })) {
        // drain
      }

      expect(zai.createChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-zai-model-name' })
      )
    })
  })
})
