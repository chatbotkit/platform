import * as groq from '@/lib/model.provider.groq'
import {
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.groq.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

jest.mock('@/lib/model.provider.groq', () => ({
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

describe('groq.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
  })

  describe('createChatCompletion', () => {
    it('should forward options to groq createChatCompletion', async () => {
      const mockOptions = {
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'test' }],
      }

      const mockResult = { id: 'test-id', choices: [] }

      groq.createChatCompletion.mockResolvedValue(mockResult)

      const result = await createChatCompletion(mockOptions)

      expect(groq.createChatCompletion).toHaveBeenCalledWith(mockOptions)
      expect(result).toEqual(mockResult)
    })

    it('should propagate errors from groq createChatCompletion', async () => {
      const mockError = new Error('API error')

      groq.createChatCompletion.mockRejectedValue(mockError)

      await expect(
        createChatCompletion({ model: 'test', messages: [] })
      ).rejects.toThrow('API error')
    })
  })

  describe('createChatCompletionStream', () => {
    it('should forward options to groq createChatCompletionStream', async () => {
      const mockOptions = {
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'test' }],
        stream: true,
      }

      const mockChunks = [
        { id: '1', choices: [{ delta: { content: 'Hello' } }] },
        { id: '2', choices: [{ delta: { content: ' world' } }] },
      ]

      groq.createChatCompletionStream.mockImplementation(async function* () {
        for (const chunk of mockChunks) {
          yield chunk
        }
      })

      const chunks = []

      for await (const chunk of createChatCompletionStream(mockOptions)) {
        chunks.push(chunk)
      }

      expect(groq.createChatCompletionStream).toHaveBeenCalledWith(mockOptions)
      expect(chunks).toEqual(mockChunks)
    })

    it('should handle empty stream', async () => {
      groq.createChatCompletionStream.mockImplementation(async function* () {
        // empty stream
      })

      const chunks = []

      for await (const chunk of createChatCompletionStream({})) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual([])
    })

    it('should propagate errors from groq createChatCompletionStream', async () => {
      const mockError = new Error('Stream error')

      groq.createChatCompletionStream.mockImplementation(async function* () {
        throw mockError
      })

      const generator = createChatCompletionStream({
        model: 'test',
        messages: [],
      })

      await expect(generator.next()).rejects.toThrow('Stream error')
    })

    it('should handle single chunk stream', async () => {
      const mockChunk = { id: '1', choices: [{ delta: { content: 'test' } }] }

      groq.createChatCompletionStream.mockImplementation(async function* () {
        yield mockChunk
      })

      const chunks = []

      for await (const chunk of createChatCompletionStream({})) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual([mockChunk])
    })
  })

  describe('providerModel', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      groq.createChatCompletion.mockResolvedValue({ completion: '' })
      groq.createChatCompletionStream.mockImplementation(async function* () {})
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('model not found')
      })
    })

    it('should use providerModel when set on the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-groq-model-name' },
      })

      await createChatCompletion({ model: 'my-alias', messages: [] })

      expect(groq.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-groq-model-name' })
      )
    })

    it('should use the original model name when providerModel is not set', async () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      await createChatCompletion({
        model: 'llama-3.1-8b-instant',
        messages: [],
      })

      expect(groq.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'llama-3.1-8b-instant' })
      )
    })

    it('should fall back to the original model name when lookup throws', async () => {
      // default mock already throws

      await createChatCompletion({
        model: 'llama-3.1-8b-instant',
        messages: [],
      })

      expect(groq.createChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'llama-3.1-8b-instant' })
      )
    })

    it('should apply providerModel in streaming mode', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'actual-groq-model-name' },
      })

      for await (const _ of createChatCompletionStream({
        model: 'my-alias',
        messages: [],
      })) {
        // drain
      }

      expect(groq.createChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'actual-groq-model-name' })
      )
    })
  })
})
