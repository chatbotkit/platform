import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
  createTextCompletion as createDirectTextCompletion,
  createTextCompletionStream as createDirectTextCompletionStream,
} from '@/lib/model.provider.openai'
import {
  isModel,
  modelRequiresUserTurnAsLastMessage,
  modelRequiresUserTurnBeforeToolCall,
} from '@/lib/model.utils'

import {
  convertMessages,
  convertParallelToolCalls,
  convertTemperature,
  createChatCompletion,
  createChatCompletionStream,
  createTextCompletion,
  createTextCompletionStream,
} from './model.provider.openai.adaptor'

jest.mock('@/lib/model.utils', () => ({
  isModel: jest.fn(),
  modelRequiresUserTurnAsLastMessage: jest.fn(),
  modelRequiresUserTurnBeforeToolCall: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
  createTextCompletion: jest.fn(),
  createTextCompletionStream: jest.fn(),
}))

describe('openai.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    modelRequiresUserTurnAsLastMessage.mockReturnValue(false)
    modelRequiresUserTurnBeforeToolCall.mockReturnValue(false)
  })

  describe('convertTemperature', () => {
    it('should return undefined for o1 models', async () => {
      isModel.mockReturnValue(true)

      const result = await convertTemperature(0.7, 'o1-preview')

      expect(isModel).toHaveBeenCalledWith('o1-preview', [/^o1/])
      expect(result).toBeUndefined()
    })

    it('should return 1 for gpt-5 models', async () => {
      isModel.mockImplementation((model, patterns) => {
        return patterns.some((p) => p.test(model))
      })

      const result = await convertTemperature(0.7, 'gpt-5-turbo')

      expect(result).toBe(1)
    })

    it('should return 1 for o4-mini models', async () => {
      isModel.mockImplementation((model, patterns) => {
        return patterns.some((p) => p.test(model))
      })

      const result = await convertTemperature(0.5, 'o4-mini')

      expect(result).toBe(1)
    })

    it('should return 1 for o3 models', async () => {
      isModel.mockImplementation((model, patterns) => {
        return patterns.some((p) => p.test(model))
      })

      const result = await convertTemperature(0.5, 'o3')

      expect(result).toBe(1)
    })

    it('should return original temperature for non-special models', async () => {
      isModel.mockReturnValue(false)

      const result = await convertTemperature(0.7, 'gpt-4')

      expect(result).toBe(0.7)
    })

    it('should handle undefined temperature', async () => {
      isModel.mockReturnValue(false)

      const result = await convertTemperature(undefined, 'gpt-4')

      expect(result).toBeUndefined()
    })

    it('should handle zero temperature', async () => {
      isModel.mockReturnValue(false)

      const result = await convertTemperature(0, 'gpt-4')

      expect(result).toBe(0)
    })

    it('should handle max temperature', async () => {
      isModel.mockReturnValue(false)

      const result = await convertTemperature(2, 'gpt-4')

      expect(result).toBe(2)
    })
  })

  describe('convertParallelToolCalls', () => {
    it('should return undefined for o3 models', async () => {
      isModel.mockImplementation((model, patterns) => {
        return patterns.some((p) => p.test(model))
      })

      const result = await convertParallelToolCalls(true, 'o3')

      expect(result).toBeUndefined()
    })

    it('should return original value for non-o3 models', async () => {
      isModel.mockReturnValue(false)

      const result = await convertParallelToolCalls(true, 'gpt-4')

      expect(result).toBe(true)
    })

    it('should handle false value', async () => {
      isModel.mockReturnValue(false)

      const result = await convertParallelToolCalls(false, 'gpt-4')

      expect(result).toBe(false)
    })

    it('should handle undefined value', async () => {
      isModel.mockReturnValue(false)

      const result = await convertParallelToolCalls(undefined, 'gpt-4')

      expect(result).toBeUndefined()
    })
  })

  describe('convertMessages', () => {
    it('should return copy of messages array', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]

      const result = await convertMessages(messages, 'gpt-4')

      expect(result).toEqual(messages)
      expect(result).not.toBe(messages) // @note should be a copy
    })

    it('should handle empty messages array', async () => {
      const messages = []

      const result = await convertMessages(messages, 'gpt-4')

      expect(result).toEqual([])
    })

    it('should not mutate original messages', async () => {
      const messages = [{ role: 'user', content: 'Test' }]
      const original = JSON.parse(JSON.stringify(messages))

      await convertMessages(messages, 'gpt-4')

      expect(messages).toEqual(original)
    })

    it('should insert a user turn before the first tool call when required', async () => {
      modelRequiresUserTurnBeforeToolCall.mockReturnValue(true)

      const messages = [
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
      ]

      const result = await convertMessages(messages, 'gemini-3.1-flash-lite')

      expect(result).toEqual([
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
      ])
    })

    it('should append a user turn when last message is assistant and model requires it', async () => {
      modelRequiresUserTurnAsLastMessage.mockReturnValue(true)

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]

      const result = await convertMessages(messages, 'claude-4.6-sonnet')

      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: '...' },
      ])
    })

    it('should not append a user turn when last message is already a user message', async () => {
      modelRequiresUserTurnAsLastMessage.mockReturnValue(true)

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'Follow up' },
      ]

      const result = await convertMessages(messages, 'claude-4.6-sonnet')

      expect(result).toEqual(messages)
    })

    it('should not append a user turn when last message is a tool message', async () => {
      modelRequiresUserTurnAsLastMessage.mockReturnValue(true)

      const messages = [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{}' } },
          ],
        },
        { role: 'tool', content: 'result', tool_call_id: 'call_1' },
      ]

      const result = await convertMessages(messages, 'claude-4.6-sonnet')

      expect(result).toEqual(messages)
    })

    it('should not append a user turn when model does not require it', async () => {
      modelRequiresUserTurnAsLastMessage.mockReturnValue(false)

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]

      const result = await convertMessages(messages, 'gpt-4o')

      expect(result).toEqual(messages)
    })
  })

  describe('createTextCompletion', () => {
    it('should call createDirectTextCompletion with options', async () => {
      const options = { prompt: 'Test', model: 'gpt-3.5-turbo-instruct' }
      const mockResult = { text: 'Response' }

      createDirectTextCompletion.mockResolvedValue(mockResult)

      const result = await createTextCompletion(options)

      expect(createDirectTextCompletion).toHaveBeenCalledWith(options)
      expect(result).toBe(mockResult)
    })
  })

  describe('createTextCompletionStream', () => {
    it('should yield from createDirectTextCompletionStream', async () => {
      const options = { prompt: 'Test', model: 'gpt-3.5-turbo-instruct' }
      const mockChunks = [{ text: 'Hello' }, { text: ' world' }]

      createDirectTextCompletionStream.mockImplementation(async function* () {
        for (const chunk of mockChunks) {
          yield chunk
        }
      })

      const generator = createTextCompletionStream(options)
      const results = []

      for await (const chunk of generator) {
        results.push(chunk)
      }

      expect(results).toEqual(mockChunks)
      expect(createDirectTextCompletionStream).toHaveBeenCalledWith(options)
    })
  })

  describe('createChatCompletion', () => {
    beforeEach(() => {
      isModel.mockReturnValue(false)
      createDirectChatCompletion.mockResolvedValue({ message: 'Response' })
    })

    it('should call createDirectChatCompletion with converted options', async () => {
      const options = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
        temperature: 0.7,
        parallelToolCalls: true,
      }

      await createChatCompletion(options)

      expect(createDirectChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.any(Array),
          model: 'gpt-4',
          temperature: 0.7,
          parallelToolCalls: true,
        })
      )
    })

    it('should apply temperature conversion', async () => {
      isModel.mockImplementation((model, patterns) => {
        return patterns.some((p) => p.test(model))
      })

      const options = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-preview',
        temperature: 0.7,
      }

      await createChatCompletion(options)

      expect(createDirectChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: undefined,
        })
      )
    })

    it('should apply parallelToolCalls conversion', async () => {
      isModel.mockImplementation((model, patterns) => {
        return patterns.some((p) => p.test(model))
      })

      const options = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o3',
        parallelToolCalls: true,
      }

      await createChatCompletion(options)

      expect(createDirectChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          parallelToolCalls: undefined,
        })
      )
    })
  })

  describe('createChatCompletionStream', () => {
    beforeEach(() => {
      isModel.mockReturnValue(false)
      createDirectChatCompletionStream.mockImplementation(async function* () {
        yield { delta: { content: 'Test' } }
      })
    })

    it('should yield from createDirectChatCompletionStream', async () => {
      const options = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
        temperature: 0.7,
      }

      const generator = createChatCompletionStream(options)
      const results = []

      for await (const chunk of generator) {
        results.push(chunk)
      }

      expect(results).toEqual([{ delta: { content: 'Test' } }])
    })

    it('should apply temperature conversion before streaming', async () => {
      isModel.mockImplementation((model, patterns) => {
        return patterns.some((p) => p.test(model))
      })

      const options = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-5',
        temperature: 0.7,
      }

      const generator = createChatCompletionStream(options)

      for await (const _ of generator) {
        // consume generator
      }

      expect(createDirectChatCompletionStream).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 1,
        })
      )
    })
  })
})
