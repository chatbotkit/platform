import { vercelLanguageModels } from '@/config/models'

import { SystemError } from '@/lib/error'
import {
  createChatCompletion as directChatCompletion,
  createChatCompletionStream as directChatCompletionStream,
  createImage as directCreateImage,
  editImage as directEditImage,
} from '@/lib/model.provider.vercel'
import {
  createChatCompletion,
  createChatCompletionStream,
  createImage,
  editImage,
  getLanguageModel,
} from '@/lib/model.provider.vercel.adaptor'
import {
  modelRequiresUserTurnAsLastMessage,
  modelRequiresUserTurnBeforeToolCall,
  parseAndRevealImageModel,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

// @note keep the real stream so existing integration tests are unaffected;
// mock createChatCompletion so getModel tests never hit the network
jest.mock('@/lib/model.provider.vercel', () => ({
  ...jest.requireActual('@/lib/model.provider.vercel'),
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

// @note mock parseAndRevealLanguageModel - default throws (falls through),
// individual tests override when they need providerModel behaviour
jest.mock('@/lib/model.utils', () => ({
  isModel: jest.fn(() => false),
  modelRequiresUserTurnAsLastMessage: jest.fn(() => false),
  modelRequiresUserTurnBeforeToolCall: jest.fn(() => false),
  parseAndRevealLanguageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
  parseAndRevealImageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
}))

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('vercel')
  ? describe
  : describe.skip

function getCheapestModel() {
  const [name] = Object.entries(vercelLanguageModels)
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

describe('vercel.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
    modelRequiresUserTurnBeforeToolCall.mockReturnValue(false)

    parseAndRevealLanguageModel.mockImplementation(() => {
      throw new Error('model not found')
    })

    parseAndRevealImageModel.mockImplementation(() => {
      throw new Error('model not found')
    })
  })

  describe('getModel', () => {
    it('should use providerModel when present', () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'gpt-4o-mini' },
      })

      const result = getLanguageModel({ model: 'vercel-gpt-4o-mini' })

      expect(result).toBe('gpt-4o-mini')
    })

    it('should use original model when providerModel is missing', () => {
      parseAndRevealLanguageModel.mockReturnValue({ config: {} })

      const result = getLanguageModel({ model: 'gpt-4o' })

      expect(result).toBe('gpt-4o')
    })

    it('should use original model when model lookup throws', () => {
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('bad model')
      })

      const result = getLanguageModel({ model: 'gpt-4o' })

      expect(result).toBe('gpt-4o')
    })
  })

  describe('createChatCompletion', () => {
    it('should forward options with mapped model', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'gpt-4o-mini' },
      })
      directChatCompletion.mockResolvedValue({ completion: 'ok' })

      const result = await createChatCompletion({
        model: 'vercel-gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
      })

      expect(directChatCompletion).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        extra: {
          providerOptions: undefined,
        },
      })
      expect(result).toEqual({ completion: 'ok' })
    })

    it('should pass through all provided options', async () => {
      parseAndRevealLanguageModel.mockImplementation(() => {
        throw new Error('model not found')
      })

      const mockResponse = { id: 'test-456', choices: [] }

      directChatCompletion.mockResolvedValue(mockResponse)

      const options = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Write code' }],
        temperature: 0.7,
        max_tokens: 100,
        stream: false,
      }

      await createChatCompletion(options)

      expect(directChatCompletion).toHaveBeenCalledWith({
        ...options,
        extra: {
          providerOptions: undefined,
        },
      })
    })

    it('should propagate errors from underlying function', async () => {
      const mockError = new Error('API Error')

      directChatCompletion.mockRejectedValue(mockError)

      const options = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
      }

      await expect(createChatCompletion(options)).rejects.toThrow('API Error')
    })

    it('should forward providerOptions from the model config', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: {
          providerModel: 'google/gemini-3.1-flash-lite-preview',
          providerOptions: {
            order: ['vertex'],
          },
        },
      })

      directChatCompletion.mockResolvedValue({ completion: 'ok' })

      await createChatCompletion({
        model: 'gemini-3.1-flash-lite',
        messages: [{ role: 'user', content: 'Hi' }],
      })

      expect(directChatCompletion).toHaveBeenCalledWith({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [{ role: 'user', content: 'Hi' }],
        extra: {
          providerOptions: {
            order: ['vertex'],
          },
        },
      })
    })

    it('should apply Perplexity message conversion for Perplexity gateway models', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: {
          providerModel: 'perplexity/sonar-pro',
          providerOptions: {
            gateway: {
              zeroDataRetention: false,
            },
          },
        },
      })

      directChatCompletion.mockResolvedValue({ completion: 'ok' })

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

      expect(directChatCompletion).toHaveBeenCalledWith({
        model: 'perplexity/sonar-pro',
        messages: [
          { role: 'user', content: 'Hello\n\nHow are you?' },
          { role: 'assistant', content: 'I am fine.\n\nTool result' },
        ],
        extra: {
          providerOptions: {
            gateway: {
              zeroDataRetention: false,
            },
          },
        },
      })
    })

    it('should insert a user turn before the first tool call when the model requires it', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: {
          providerModel: 'google/gemini-3.1-flash-lite-preview',
          providerOptions: {
            order: ['vertex'],
          },
        },
      })
      jest
        .requireMock('@/lib/model.utils')
        .modelRequiresUserTurnBeforeToolCall.mockReturnValue(true)

      directChatCompletion.mockResolvedValue({ completion: 'ok' })

      await createChatCompletion({
        model: 'gemini-3.1-flash-lite',
        messages: [
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'lookup',
                  arguments: '{}',
                },
              },
            ],
          },
        ],
      })

      expect(directChatCompletion).toHaveBeenCalledWith({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [
          { role: 'user', content: '...' },
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'lookup',
                  arguments: '{}',
                },
              },
            ],
          },
        ],
        extra: {
          providerOptions: {
            order: ['vertex'],
          },
        },
      })
    })
  })

  describe('createChatCompletionStream', () => {
    it('should yield chunks from direct stream with mapped model', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: { providerModel: 'gpt-4o-mini' },
      })

      const chunks = [{ token: 'Hello' }, { token: ' world' }]

      directChatCompletionStream.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk
        }
      })

      const result = []

      for await (const chunk of createChatCompletionStream({
        model: 'vercel-gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        result.push(chunk)
      }

      expect(result).toEqual(chunks)
      expect(directChatCompletionStream).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        extra: {
          providerOptions: undefined,
        },
      })
    })

    it('should handle empty stream', async () => {
      directChatCompletionStream.mockImplementation(async function* () {})

      const result = []

      for await (const chunk of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [],
      })) {
        result.push(chunk)
      }

      expect(result).toEqual([])
    })

    it('should propagate errors from streaming function', async () => {
      directChatCompletionStream.mockImplementation(async function* () {
        throw new Error('Stream Error')
      })

      const options = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
      }

      await expect(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _chunk of createChatCompletionStream(options)) {
          // Should not reach here
        }
      }).rejects.toThrow('Stream Error')
    })

    // @note regression: the AI Gateway phrases a 503 as "Service temporarily
    // unavailable", which the old `/service unavailable/i` prose match missed -
    // so a transient blip was thrown as terminal and hard-failed the whole task
    // run instead of being retried here.
    it('should retry a gateway 503 rather than failing the turn', async () => {
      let attempts = 0

      directChatCompletionStream.mockImplementation(async function* () {
        attempts++

        if (attempts < 3) {
          throw new SystemError(
            'Service temporarily unavailable. Please try again shortly. (503)',
            'VR_SERVICE_UNAVAILABLE'
          )
        }

        yield { content: 'recovered' }
      })

      const result = []

      for await (const chunk of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        result.push(chunk)
      }

      expect(attempts).toBe(3)
      expect(result).toEqual([{ content: 'recovered' }])
    })

    // @note the flip side: a terminal 4xx must NOT burn the retry budget
    it('should not retry a 404 for a model the provider does not have', async () => {
      let attempts = 0

      directChatCompletionStream.mockImplementation(async function* () {
        attempts++

        throw new SystemError(
          'Publisher model gemini-3.1-flash-lite-preview was not found or your project does not have access to it. (404)',
          'VR_NOT_FOUND'
        )

        // eslint-disable-next-line no-unreachable
        yield
      })

      await expect(async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _chunk of createChatCompletionStream({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Test' }],
        })) {
          // Should not reach here
        }
      }).rejects.toThrow('was not found')

      expect(attempts).toBe(1)
    })

    it('should handle stream with multiple chunks', async () => {
      const mockStream = [
        { id: '1', choices: [{ delta: { content: 'A' } }] },
        { id: '2', choices: [{ delta: { content: 'B' } }] },
        { id: '3', choices: [{ delta: { content: 'C' } }] },
        { id: '4', choices: [{ delta: { content: 'D' } }] },
      ]

      directChatCompletionStream.mockImplementation(async function* () {
        yield* mockStream
      })

      const options = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      }

      const result = []

      for await (const chunk of createChatCompletionStream(options)) {
        result.push(chunk)
      }

      expect(result).toEqual(mockStream)
    })

    it('should forward providerOptions from the model config for streams', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: {
          providerModel: 'google/gemini-3.1-flash-lite-preview',
          providerOptions: {
            order: ['vertex'],
          },
        },
      })

      directChatCompletionStream.mockImplementation(async function* () {
        yield { completion: 'ok' }
      })

      const items = []

      for await (const item of createChatCompletionStream({
        model: 'gemini-3.1-flash-lite',
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        items.push(item)
      }

      expect(items).toEqual([{ completion: 'ok' }])
      expect(directChatCompletionStream).toHaveBeenCalledWith({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [{ role: 'user', content: 'Hi' }],
        extra: {
          providerOptions: {
            order: ['vertex'],
          },
        },
      })
    })

    it('should apply Perplexity message conversion for Perplexity gateway streams', async () => {
      parseAndRevealLanguageModel.mockReturnValue({
        config: {
          providerModel: 'perplexity/sonar',
        },
      })

      directChatCompletionStream.mockImplementation(async function* () {
        yield { completion: 'ok' }
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
      expect(directChatCompletionStream).toHaveBeenCalledWith({
        model: 'perplexity/sonar',
        messages: [{ role: 'user', content: 'Hello\n\nWorld' }],
        extra: {
          providerOptions: undefined,
        },
      })
    })
  })

  describe('image routes', () => {
    it('should forward providerOptions from the image model config on create', async () => {
      parseAndRevealImageModel.mockReturnValue({
        config: {
          providerModel: 'google/gemini-3.1-flash-image-preview',
          providerOptions: {
            gateway: {
              order: ['vertex'],
            },
          },
        },
      })

      directCreateImage.mockResolvedValue({
        urls: ['data:image/png;base64,image'],
        usage: {
          model: 'google/gemini-3.1-flash-image-preview',
          inputTokens: 0,
          outputTokens: 1,
        },
      })

      await createImage({
        prompt: 'draw a house',
        model: 'gemini-3.1-flash-image',
      })

      expect(directCreateImage).toHaveBeenCalledWith({
        prompt: 'draw a house',
        model: 'google/gemini-3.1-flash-image-preview',
        modelOptions: {
          gateway: {
            order: ['vertex'],
          },
        },
        providerApi: 'chat',
      })
    })

    it('should forward providerOptions from the image model config on edit', async () => {
      parseAndRevealImageModel.mockReturnValue({
        config: {
          providerModel: 'google/gemini-3.1-flash-image-preview',
          providerOptions: {
            gateway: {
              order: ['vertex'],
            },
          },
        },
      })

      directEditImage.mockResolvedValue({
        urls: ['data:image/png;base64,image'],
        usage: {
          model: 'google/gemini-3.1-flash-image-preview',
          inputTokens: 0,
          outputTokens: 1,
        },
      })

      await editImage({
        prompt: 'edit a house',
        images: [new Blob(['image'], { type: 'image/png' })],
        model: 'gemini-3.1-flash-image',
      })

      expect(directEditImage).toHaveBeenCalledWith({
        prompt: 'edit a house',
        images: [expect.any(Blob)],
        model: 'google/gemini-3.1-flash-image-preview',
        modelOptions: {
          gateway: {
            order: ['vertex'],
          },
        },
        providerApi: 'chat',
      })
    })

    // @note a model the gateway types as `image` has no chat surface, so the
    // config opts it into the image generation API and the adaptor has to carry
    // that choice down to the provider call.
    it('should forward the image generation api from the image model config', async () => {
      parseAndRevealImageModel.mockReturnValue({
        config: {
          providerModel: 'spacexai/grok-imagine-image-2.0',
          providerApi: 'image',
        },
      })

      directCreateImage.mockResolvedValue({
        urls: ['data:image/jpeg;base64,image'],
        usage: {
          model: 'spacexai/grok-imagine-image-2.0',
          inputTokens: 0,
          outputTokens: 1,
        },
      })

      await createImage({
        prompt: 'draw a house',
        model: 'grok-imagine-image-2.0',
      })

      expect(directCreateImage).toHaveBeenCalledWith({
        prompt: 'draw a house',
        model: 'spacexai/grok-imagine-image-2.0',
        modelOptions: undefined,
        providerApi: 'image',
      })
    })
  })
})

// --- Integration tests ---

describeIfConfigured('createChatCompletion', () => {
  beforeAll(() => {
    directChatCompletion.mockImplementation(
      jest.requireActual('@/lib/model.provider.vercel').createChatCompletion
    )
    parseAndRevealLanguageModel.mockImplementation(
      jest.requireActual('@/lib/model.utils').parseAndRevealLanguageModel
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
      jest.requireActual('@/lib/model.provider.vercel')
        .createChatCompletionStream
    )
    parseAndRevealLanguageModel.mockImplementation(
      jest.requireActual('@/lib/model.utils').parseAndRevealLanguageModel
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
