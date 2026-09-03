/* eslint-disable @typescript-eslint/no-require-imports */
import { computePrompt, execPrompt } from './prompt'

jest.mock('@/lib/model.utils', () => ({
  isOpenAIModel: jest.fn(),
  isOpenrouterModel: jest.fn(),
  isVercelModel: jest.fn(),
  modelSupportsChat: jest.fn(),
  parseAndRevealLanguageModel: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai.adaptor', () => ({
  createChatCompletionStream: jest.fn(),
  createTextCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.provider.openrouter.adaptor', () => ({
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.provider.vercel.adaptor', () => ({
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  replaceWithMap: jest.fn((str, map) => {
    let result = str

    for (const [key, value] of Object.entries(map)) {
      result = result.replace(new RegExp(key, 'g'), value)
    }

    return result
  }),
}))

describe('computePrompt', () => {
  it('should replace single parameter', () => {
    const spec = { prompt: 'Hello {name}!' }
    const params = { name: 'World' }

    const result = computePrompt(spec, params)

    expect(result).toBe('Hello World!')
  })

  it('should replace multiple parameters', () => {
    const spec = { prompt: '{greeting} {name}, welcome to {place}!' }
    const params = { greeting: 'Hello', name: 'Alice', place: 'Wonderland' }

    const result = computePrompt(spec, params)

    expect(result).toBe('Hello Alice, welcome to Wonderland!')
  })

  it('should handle empty params', () => {
    const spec = { prompt: 'Static prompt' }
    const params = {}

    const result = computePrompt(spec, params)

    expect(result).toBe('Static prompt')
  })

  it('should handle missing parameters gracefully', () => {
    const spec = { prompt: 'Hello {name} from {city}' }
    const params = { name: 'Bob' }

    const result = computePrompt(spec, params)

    expect(result).toContain('Bob')
  })

  it('should handle special characters in parameter values', () => {
    const spec = { prompt: 'Say: {message}' }
    const params = { message: 'Hello! How are you?' }

    const result = computePrompt(spec, params)

    expect(result).toContain('Hello! How are you?')
  })

  it('should handle numeric parameters', () => {
    const spec = { prompt: 'Count to {number}' }
    const params = { number: 42 }

    const result = computePrompt(spec, params)

    expect(result).toContain('42')
  })
})

describe('execPrompt', () => {
  let mockModelFunctions
  let createChatCompletionStreamForOpenAI
  let createTextCompletionStreamForOpenAI
  let createChatCompletionStreamForOpenRouter

  beforeEach(() => {
    jest.clearAllMocks()

    mockModelFunctions = require('@/lib/model.utils')
    createChatCompletionStreamForOpenAI =
      require('@/lib/model.provider.openai.adaptor').createChatCompletionStream
    createTextCompletionStreamForOpenAI =
      require('@/lib/model.provider.openai.adaptor').createTextCompletionStream
    createChatCompletionStreamForOpenRouter =
      require('@/lib/model.provider.openrouter.adaptor').createChatCompletionStream

    mockModelFunctions.parseAndRevealLanguageModel.mockReturnValue({
      name: 'gpt-4',
      config: {
        temperature: 0.7,
        frequencyPenalty: 0,
        presencePenalty: 0,
      },
    })
  })

  describe('OpenAI chat models', () => {
    beforeEach(() => {
      mockModelFunctions.isOpenAIModel.mockReturnValue(true)
      mockModelFunctions.modelSupportsChat.mockReturnValue(true)
    })

    it('should execute prompt with OpenAI chat model', async () => {
      async function* mockStream() {
        yield { completion: 'Hello' }
        yield { completion: ' World' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Say hello',
        model: 'gpt-4',
        user: 'user-123',
      }

      const result = await execPrompt(spec, {})

      expect(result.completion).toBe('Hello World')
      expect(result.tokensUsed).toBe(2)
      expect(result.modelUsed).toBe('gpt-4')
    })

    it('should handle empty completion tokens', async () => {
      async function* mockStream() {
        yield { completion: null }
        yield { completion: 'Text' }
        yield { completion: undefined }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = { prompt: 'Test', model: 'gpt-4', user: 'user-123' }

      const result = await execPrompt(spec, {})

      expect(result.completion).toBe('Text')
    })

    it('should support text output format', async () => {
      async function* mockStream() {
        yield { completion: 'Plain text' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Generate text',
        model: 'gpt-4',
        output: 'text',
        user: 'user-123',
      }

      await execPrompt(spec, {})

      expect(createChatCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          responseFormat: { type: 'text' },
        })
      )
    })

    it('should support json output format', async () => {
      async function* mockStream() {
        yield { completion: '{"key":"value"}' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Generate JSON',
        model: 'gpt-4',
        output: 'json',
        user: 'user-123',
      }

      await execPrompt(spec, {})

      expect(createChatCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          responseFormat: { type: 'json_object' },
        })
      )
    })

    it('should support schema output format', async () => {
      async function* mockStream() {
        yield { completion: '{"name":"test"}' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      }
      const spec = {
        prompt: 'Generate structured data',
        model: 'gpt-4',
        output: 'schema',
        schema,
        user: 'user-123',
      }

      await execPrompt(spec, {})

      expect(createChatCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          responseFormat: {
            type: 'json_schema',
            json_schema: schema,
          },
        })
      )
    })

    it('should call sink push for each token', async () => {
      async function* mockStream() {
        yield { completion: 'First' }
        yield { completion: ' Second' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const sink = { push: jest.fn() }
      const spec = { prompt: 'Test', model: 'gpt-4', user: 'user-123' }

      await execPrompt(spec, {}, { sink })

      expect(sink.push).toHaveBeenCalledWith('token', { token: 'First' })
      expect(sink.push).toHaveBeenCalledWith('token', { token: ' Second' })
      expect(sink.push).toHaveBeenCalledWith('result', expect.any(Object))
    })

    it('should call sink push with result', async () => {
      async function* mockStream() {
        yield { completion: 'Done' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const sink = { push: jest.fn() }
      const spec = { prompt: 'Test', model: 'gpt-4', user: 'user-123' }

      await execPrompt(spec, {}, { sink })

      expect(sink.push).toHaveBeenCalledWith('result', {
        completion: 'Done',
        tokensUsed: 1,
        modelUsed: 'gpt-4',
      })
    })

    it('should pass timeout and retry parameters', async () => {
      async function* mockStream() {
        yield { completion: 'Done' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Test',
        model: 'gpt-4',
        user: 'user-123',
        timeout: 30000,
        retries: 3,
        retryDelay: 1000,
        retryTimeout: true,
      }

      await execPrompt(spec, {})

      expect(createChatCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
          retries: 3,
          retryDelay: 1000,
          retryTimeout: true,
        })
      )
    })

    it('should pass abort signal to provider stream', async () => {
      async function* mockStream() {
        yield { completion: 'Done' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const signal = new AbortController().signal
      const spec = { prompt: 'Test', model: 'gpt-4', user: 'user-123' }

      await execPrompt(spec, {}, { abortSignal: signal })

      expect(createChatCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ signal })
      )
    })
  })

  describe('OpenAI text models', () => {
    beforeEach(() => {
      mockModelFunctions.isOpenAIModel.mockReturnValue(true)
      mockModelFunctions.modelSupportsChat.mockReturnValue(false)
      mockModelFunctions.parseAndRevealLanguageModel.mockReturnValue({
        name: 'text-davinci-003',
        config: {
          temperature: 0.7,
          frequencyPenalty: 0,
          presencePenalty: 0,
        },
      })
    })

    it('should execute prompt with OpenAI text model', async () => {
      async function* mockStream() {
        yield { completion: 'Legacy' }
        yield { completion: ' completion' }
      }

      createTextCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Complete this',
        model: 'text-davinci-003',
        user: 'user-123',
      }

      const result = await execPrompt(spec, {})

      expect(result.completion).toBe('Legacy completion')
      expect(createTextCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Complete this',
          model: 'text-davinci-003',
          maxTokens: 2000,
        })
      )
    })

    it('should pass timeout and retry parameters to text model', async () => {
      async function* mockStream() {
        yield { completion: 'Done' }
      }

      createTextCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Test',
        model: 'text-davinci-003',
        user: 'user-123',
        timeout: 15000,
        retries: 2,
        retryDelay: 500,
      }

      await execPrompt(spec, {})

      expect(createTextCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 15000,
          retries: 2,
          retryDelay: 500,
        })
      )
    })
  })

  describe('OpenRouter models', () => {
    beforeEach(() => {
      mockModelFunctions.isOpenAIModel.mockReturnValue(false)
      mockModelFunctions.isOpenrouterModel.mockReturnValue(true)
      mockModelFunctions.modelSupportsChat.mockReturnValue(true)
      mockModelFunctions.parseAndRevealLanguageModel.mockReturnValue({
        name: 'anthropic/claude-2',
        config: {
          temperature: 0.7,
          frequencyPenalty: 0,
          presencePenalty: 0,
        },
      })
    })

    it('should execute prompt with OpenRouter model', async () => {
      async function* mockStream() {
        yield { completion: 'OpenRouter' }
        yield { completion: ' response' }
      }

      createChatCompletionStreamForOpenRouter.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Test prompt',
        model: 'anthropic/claude-2',
        user: 'user-123',
      }

      const result = await execPrompt(spec, {})

      expect(result.completion).toBe('OpenRouter response')
      expect(createChatCompletionStreamForOpenRouter).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'anthropic/claude-2',
        })
      )
    })

    it('should support json output for OpenRouter', async () => {
      async function* mockStream() {
        yield { completion: '{"result":"success"}' }
      }

      createChatCompletionStreamForOpenRouter.mockReturnValue(mockStream())

      const spec = {
        prompt: 'JSON response',
        model: 'anthropic/claude-2',
        output: 'json',
        user: 'user-123',
      }

      await execPrompt(spec, {})

      expect(createChatCompletionStreamForOpenRouter).toHaveBeenCalledWith(
        expect.objectContaining({
          responseFormat: { type: 'json_object' },
        })
      )
    })
  })

  describe('error handling', () => {
    it('should throw error for unsupported model provider', async () => {
      mockModelFunctions.isOpenAIModel.mockReturnValue(false)
      mockModelFunctions.isOpenrouterModel.mockReturnValue(false)

      const spec = {
        prompt: 'Test',
        model: 'unknown-provider/model',
        user: 'user-123',
      }

      await expect(execPrompt(spec, {})).rejects.toThrow(
        'Unsupported model provider'
      )
    })
  })

  describe('parameter replacement', () => {
    beforeEach(() => {
      mockModelFunctions.isOpenAIModel.mockReturnValue(true)
      mockModelFunctions.modelSupportsChat.mockReturnValue(true)
    })

    it('should replace parameters in prompt before execution', async () => {
      async function* mockStream() {
        yield { completion: 'Response' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = {
        prompt: 'Hello {name}, your age is {age}',
        model: 'gpt-4',
        user: 'user-123',
      }

      await execPrompt(spec, { name: 'Alice', age: 30 })

      expect(createChatCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('Alice'),
            },
          ],
        })
      )
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      mockModelFunctions.isOpenAIModel.mockReturnValue(true)
      mockModelFunctions.modelSupportsChat.mockReturnValue(true)
    })

    it('should handle empty completion stream', async () => {
      async function* mockStream() {}

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const spec = { prompt: 'Test', model: 'gpt-4', user: 'user-123' }

      const result = await execPrompt(spec, {})

      expect(result.completion).toBe('')
      expect(result.tokensUsed).toBe(0)
    })

    it('should handle schema without output type', async () => {
      async function* mockStream() {
        yield { completion: '{"data":"value"}' }
      }

      createChatCompletionStreamForOpenAI.mockReturnValue(mockStream())

      const schema = { type: 'object' }
      const spec = {
        prompt: 'Generate',
        model: 'gpt-4',
        schema,
        user: 'user-123',
      }

      await execPrompt(spec, {})

      expect(createChatCompletionStreamForOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          responseFormat: {
            type: 'json_schema',
            json_schema: schema,
          },
        })
      )
    })
  })
})
