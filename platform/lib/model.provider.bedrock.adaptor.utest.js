import * as bedrock from '@/lib/model.provider.bedrock'
import {
  createChatCompletion,
  createChatCompletionStream,
  getModel,
} from '@/lib/model.provider.bedrock.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

jest.mock('@/lib/model.provider.bedrock', () => ({
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

describe('bedrock.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
  })

  describe('getModel', () => {
    it('should use providerModel when present', () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'anthropic.claude-3-sonnet' },
      })

      const result = getModel({ model: 'claude-3-sonnet' })

      expect(result).toBe('anthropic.claude-3-sonnet')
    })

    it('should use original model when providerModel is missing', () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      const result = getModel({ model: 'claude-3-sonnet' })

      expect(result).toBe('claude-3-sonnet')
    })

    it('should use original model when model lookup throws', () => {
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('bad model')
      })

      const result = getModel({ model: 'claude-3-sonnet' })

      expect(result).toBe('claude-3-sonnet')
    })
  })

  describe('createChatCompletion', () => {
    it('should forward options with mapped model', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'anthropic.claude-3-sonnet' },
      })
      bedrock.createChatCompletion.mockResolvedValue({ completion: 'ok' })

      const result = await createChatCompletion({
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'Hi' }],
      })

      expect(bedrock.createChatCompletion).toHaveBeenCalledWith({
        model: 'anthropic.claude-3-sonnet',
        messages: [{ role: 'user', content: 'Hi' }],
      })
      expect(result).toEqual({ completion: 'ok' })
    })
  })

  describe('createChatCompletionStream', () => {
    it('should yield chunks from direct stream with mapped model', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'anthropic.claude-3-sonnet' },
      })

      const chunks = [{ token: 'Hello' }, { token: ' world' }]

      bedrock.createChatCompletionStream.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk
        }
      })

      const result = []

      for await (const chunk of createChatCompletionStream({
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        result.push(chunk)
      }

      expect(result).toEqual(chunks)
      expect(bedrock.createChatCompletionStream).toHaveBeenCalledWith({
        model: 'anthropic.claude-3-sonnet',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    })

    it('should handle empty stream', async () => {
      bedrock.createChatCompletionStream.mockImplementation(
        async function* () {}
      )

      const result = []

      for await (const chunk of createChatCompletionStream({
        model: 'claude-3-sonnet',
        messages: [],
      })) {
        result.push(chunk)
      }

      expect(result).toEqual([])
    })
  })
})
