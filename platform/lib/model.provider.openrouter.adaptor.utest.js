import { openrouterLanguageModels } from '@/config/models'

import {
  createChatCompletion as directChatCompletion,
  createChatCompletionStream as directChatCompletionStream,
} from '@/lib/model.provider.openrouter'
import {
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.openrouter.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  modelRequiresUserTurnBeforeToolCall,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

// @note keep the real stream so existing integration tests are unaffected;
// mock createChatCompletion so getModel tests never hit the network
jest.mock('@/lib/model.provider.openrouter', () => ({
  ...jest.requireActual('@/lib/model.provider.openrouter'),
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
}))

// @note mock parseAndRevealLanguageModel - default throws, individual tests
// override when they need providerModel behaviour
jest.mock('@/lib/model.utils', () => ({
  isModel: jest.fn(() => false),
  modelRequiresUserTurnAsLastMessage: jest.fn(() => false),
  modelRequiresUserTurnBeforeToolCall: jest.fn(() => false),
  parseAndRevealLanguageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
}))

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openrouter')
  ? describe
  : describe.skip

function getCheapestModel() {
  const [name] = Object.entries(openrouterLanguageModels)
    .filter(
      ([name, config]) =>
        !/mimo/.test(name) &&
        !config.deprecated &&
        config.visible &&
        config.features.includes('functions')
    )
    .sort((a, b) => a[1].pricing.tokenRatio - b[1].pricing.tokenRatio)[0]

  return name
}

// @note the retry classifier is shared across every gateway-backed provider and
// is covered by model.retry.utest.js - it is no longer this adaptor's to test.

describeIfConfigured('createChatCompletion', () => {
  beforeAll(() => {
    directChatCompletion.mockImplementation(
      jest.requireActual('@/lib/model.provider.openrouter').createChatCompletion
    )
  })

  it('must correctly complete chat', async () => {
    const { completion, usage } = await createChatCompletion({
      model: getCheapestModel(),
      messages: [
        {
          role: 'user',
          content:
            'Finish the following sequence by guessing the next number 1,2,3,',
        },
      ],
    })

    expect(completion).toBeTruthy()
    expect(usage.totalTokens).toBeGreaterThan(0)
  })

  it('must correctly interpret chat and tool calls', async () => {
    const { toolCalls } = await createChatCompletion({
      model: getCheapestModel(),
      messages: [{ role: 'user', content: 'Please book a meeting tonight!' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: {
                when: {
                  type: 'string',
                  enum: ['tonight', 'tomorrow', 'next week', 'next month'],
                },
              },
            },
          },
        },
      ],
    })

    expect(toolCalls?.length).toEqual(1)
    expect(toolCalls?.[0]?.function).toEqual({
      name: 'book_meeting',
      arguments: {
        when: 'tonight',
      },
    })
  })
})

describeIfConfigured('createChatCompletionStream', () => {
  beforeAll(() => {
    directChatCompletionStream.mockImplementation(
      jest.requireActual('@/lib/model.provider.openrouter')
        .createChatCompletionStream
    )
  })

  it('must correctly complete chat with stream', async () => {
    const chunks = []

    for await (const { completion } of createChatCompletionStream({
      model: getCheapestModel(),
      messages: [
        {
          role: 'user',
          content:
            'Finish the following sequence by guessing the next number 1,2,3,',
        },
      ],
    })) {
      chunks.push(completion)
    }

    expect(chunks.join('')).toBeTruthy()
  })

  it('must correctly interpret chat with stream and tool calls', async () => {
    const calls = []

    for await (const { toolCalls } of createChatCompletionStream({
      model: getCheapestModel(),
      messages: [{ role: 'user', content: 'Book a meeting tonight!' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: {
                when: {
                  type: 'string',
                  enum: ['tonight', 'tomorrow', 'next week', 'next month'],
                },
              },
            },
          },
        },
      ],
    })) {
      if (toolCalls) {
        calls.push(...toolCalls)
      }
    }

    expect(calls.length).toEqual(1)
    expect(calls[0].function.name.toLowerCase()).toEqual('book_meeting')
    expect(calls[0].function.arguments.when.toLowerCase()).toEqual('tonight')
  })
})

describe('getModel', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    directChatCompletion.mockResolvedValue({ completion: '' })

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
    modelRequiresUserTurnBeforeToolCall.mockReturnValue(false)

    parseAndRevealLanguageModel.mockImplementation(() => {
      throw new Error('model not found')
    })
  })

  function capturedModel() {
    return directChatCompletion.mock.calls[0][0].model
  }

  describe('providerModel config', () => {
    it('should use providerModel when set on the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'arcee-ai/trinity-large-preview:free' },
      })

      await createChatCompletion({
        model: 'arcee-ai-trinity-large',
        messages: [],
      })

      expect(capturedModel()).toBe('arcee-ai/trinity-large-preview:free')
    })

    it('should use the original model when providerModel is not set', async () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      await createChatCompletion({ model: 'gemini-2.0-flash', messages: [] })

      expect(capturedModel()).toBe('gemini-2.0-flash')
    })

    it('should use the original model when parseAndRevealLanguageModel throws', async () => {
      // default mock already throws

      await createChatCompletion({ model: 'gemini-2.0-pro', messages: [] })

      expect(capturedModel()).toBe('gemini-2.0-pro')
    })
  })

  describe('passthrough fallback', () => {
    it('should pass through unknown model names unchanged', async () => {
      await createChatCompletion({ model: 'some-unknown-model', messages: [] })

      expect(capturedModel()).toBe('some-unknown-model')
    })

    it('should pass through provider-prefixed model names unchanged', async () => {
      await createChatCompletion({
        model: 'anthropic/claude-sonnet-4',
        messages: [],
      })

      expect(capturedModel()).toBe('anthropic/claude-sonnet-4')
    })
  })

  describe('Perplexity gateway message conversion', () => {
    beforeEach(() => {
      directChatCompletionStream.mockImplementation(async function* () {
        yield { completion: 'ok' }
      })
    })

    it('should apply Perplexity message conversion for Perplexity gateway models', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: {
          providerModel: 'perplexity/sonar-pro',
        },
      })

      await createChatCompletion({
        model: 'sonar-pro',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'user', content: 'How are you?' },
          { role: 'assistant', content: 'I am fine.' },
          {
            role: 'tool',
            content: 'Tool result',
            tool_call_id: 'call_1',
          },
        ],
      })

      expect(directChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'perplexity/sonar-pro',
          messages: [
            { role: 'user', content: 'Hello\n\nHow are you?' },
            { role: 'assistant', content: 'I am fine.\n\nTool result' },
          ],
        })
      )
    })

    it('should apply Perplexity message conversion for Perplexity gateway streams', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: {
          providerModel: 'perplexity/sonar',
        },
      })

      const items = []

      for await (const item of createChatCompletionStream({
        model: 'sonar',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'user', content: 'World' },
        ],
      })) {
        items.push(item)
      }

      expect(items).toEqual([{ completion: 'ok' }])
      expect(directChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'perplexity/sonar',
          messages: [{ role: 'user', content: 'Hello\n\nWorld' }],
        })
      )
    })
  })
})
