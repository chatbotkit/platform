import * as moonshot from '@/lib/model.provider.moonshot'
import {
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.moonshot.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

jest.mock('@/lib/model.provider.moonshot', () => ({
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

describe('moonshot.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
  })

  describe('createChatCompletion', () => {
    it('should call the underlying createChatCompletion with options', async () => {
      const mockResponse = { id: 'test-123', choices: [] }

      moonshot.createChatCompletion.mockResolvedValue(mockResponse)

      const options = {
        model: 'kimi-k2',
        messages: [{ role: 'user', content: 'Hello' }],
      }

      const result = await createChatCompletion(options)

      expect(moonshot.createChatCompletion).toHaveBeenCalledTimes(1)
      expect(moonshot.createChatCompletion).toHaveBeenCalledWith(options)
      expect(result).toBe(mockResponse)
    })

    it('should propagate errors from underlying function', async () => {
      const mockError = new Error('API Error')

      moonshot.createChatCompletion.mockRejectedValue(mockError)

      const options = {
        model: 'kimi-k2',
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

      moonshot.createChatCompletionStream.mockImplementation(
        async function* () {
          yield* mockStream
        }
      )

      const options = {
        model: 'kimi-k2',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }

      const result = []

      for await (const chunk of createChatCompletionStream(options)) {
        result.push(chunk)
      }

      expect(moonshot.createChatCompletionStream).toHaveBeenCalledTimes(1)
      expect(moonshot.createChatCompletionStream).toHaveBeenCalledWith(options)
      expect(result).toEqual(mockStream)
    })

    it('should propagate errors from streaming function', async () => {
      moonshot.createChatCompletionStream.mockImplementation(
        async function* () {
          throw new Error('Stream Error')
        }
      )

      const options = {
        model: 'kimi-k2',
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
      moonshot.createChatCompletion.mockResolvedValue({ completion: '' })
      moonshot.createChatCompletionStream.mockImplementation(
        async function* () {}
      )
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('model not found')
      })
    })

    it('should use providerModel when set on the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-moonshot-model-name' },
      })

      await createChatCompletion({ model: 'my-alias', messages: [] })

      expect(moonshot.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-moonshot-model-name' })
      )
    })

    it('should use the original model name when providerModel is not set', async () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      await createChatCompletion({ model: 'kimi-k2', messages: [] })

      expect(moonshot.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'kimi-k2' })
      )
    })

    it('should fall back to original model name when lookup throws', async () => {
      // default mock already throws

      await createChatCompletion({ model: 'kimi-k2', messages: [] })

      expect(moonshot.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'kimi-k2' })
      )
    })

    it('should apply providerModel in streaming mode', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-moonshot-model-name' },
      })

      for await (const _ of createChatCompletionStream({
        model: 'my-alias',
        messages: [],
      })) {
        // drain
      }

      expect(moonshot.createChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-moonshot-model-name' })
      )
    })
  })
})
