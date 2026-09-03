import * as perplexity from '@/lib/model.provider.perplexity'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'

import {
  convertMessages,
  createChatCompletion,
  createChatCompletionStream,
} from './model.provider.perplexity.adaptor'

jest.mock('@/lib/model.provider.perplexity', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.utils', () => ({
  parseAndRevealLanguageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
}))

describe('convertMessages', () => {
  it('should consolidate contiguous messages of the same type', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'How are you?' },
      { role: 'assistant', content: 'I am fine, thanks!' },
      { role: 'assistant', content: 'How can I help you?' },
    ]

    const converted = await convertMessages(messages)

    expect(converted).toEqual([
      { role: 'user', content: 'Hello\n\nHow are you?' },
      {
        role: 'assistant',
        content: 'I am fine, thanks!\n\nHow can I help you?',
      },
    ])
  })

  it('should consolidate messages of the same type with different content', async () => {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Hello',
          },
          {
            type: 'text',
            text: 'How are you?',
          },
        ],
      },
      {
        role: 'user',
        content: 'Whats up?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I am fine, thanks!',
          },
          {
            type: 'text',
            text: 'How can I help you?',
          },
        ],
      },
      {
        role: 'assistant',
        content: 'I am here to assist you.',
      },
    ]

    const converted = await convertMessages(messages)

    expect(converted).toEqual([
      {
        role: 'user',
        content: 'Hello\n\nHow are you?\n\nWhats up?',
      },
      {
        role: 'assistant',
        content:
          'I am fine, thanks!\n\nHow can I help you?\n\nI am here to assist you.',
      },
    ])
  })

  it('should preserve tool output by folding it into assistant content', async () => {
    const messages = [
      {
        role: 'assistant',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'checkpoint', arguments: '{}' },
          },
        ],
      },
      {
        role: 'tool',
        content: 'Checkpoint summary',
        tool_call_id: 'call_1',
      },
    ]

    const converted = await convertMessages(messages)

    expect(converted).toEqual([
      {
        role: 'assistant',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'checkpoint', arguments: '{}' },
          },
        ],
        content: 'Checkpoint summary',
      },
    ])
  })
})

describe('createChatCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    perplexity.createChatCompletion.mockResolvedValue({
      completion: 'response',
    })
  })

  it('should consolidate contiguous same-role messages before calling underlying API', async () => {
    await createChatCompletion({
      model: 'sonar',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'user', content: 'How are you?' },
      ],
    })

    expect(perplexity.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hello\n\nHow are you?' }],
      })
    )
  })

  it('should pass other options through unchanged', async () => {
    await createChatCompletion({
      model: 'sonar',
      messages: [{ role: 'user', content: 'Test' }],
      temperature: 0.7,
    })

    expect(perplexity.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'sonar',
        temperature: 0.7,
      })
    )
  })

  it('should forward checkpoint tool output to the underlying API', async () => {
    await createChatCompletion({
      model: 'sonar',
      messages: [
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'checkpoint', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          content: 'Checkpoint summary',
          tool_call_id: 'call_1',
        },
      ],
    })

    expect(perplexity.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            role: 'assistant',
            content: 'Checkpoint summary',
          }),
        ],
      })
    )
  })

  it('should return the result from the underlying API', async () => {
    const mockResult = { completion: 'result', usage: {} }

    perplexity.createChatCompletion.mockResolvedValue(mockResult)

    const result = await createChatCompletion({
      model: 'sonar',
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(result).toBe(mockResult)
  })

  it('should propagate errors from the underlying API', async () => {
    perplexity.createChatCompletion.mockRejectedValue(new Error('API error'))

    await expect(
      createChatCompletion({ model: 'sonar', messages: [] })
    ).rejects.toThrow('API error')
  })
})

describe('createChatCompletionStream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    perplexity.createChatCompletionStream.mockImplementation(
      async function* () {
        yield { completion: 'chunk' }
      }
    )
  })

  it('should consolidate contiguous same-role messages before streaming', async () => {
    for await (const _ of createChatCompletionStream({
      model: 'sonar',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'user', content: 'World' },
      ],
    })) {
      // drain
    }

    expect(perplexity.createChatCompletionStream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hello\n\nWorld' }],
      })
    )
  })

  it('should yield chunks from the underlying stream', async () => {
    const mockChunks = [{ completion: 'Hello' }, { completion: ' world' }]

    perplexity.createChatCompletionStream.mockImplementation(
      async function* () {
        for (const chunk of mockChunks) {
          yield chunk
        }
      }
    )

    const chunks = []

    for await (const chunk of createChatCompletionStream({
      model: 'sonar',
      messages: [{ role: 'user', content: 'Test' }],
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(mockChunks)
  })

  it('should propagate stream errors', async () => {
    perplexity.createChatCompletionStream.mockImplementation(
      async function* () {
        throw new Error('stream error')
      }
    )

    const gen = createChatCompletionStream({ model: 'sonar', messages: [] })

    await expect(gen.next()).rejects.toThrow('stream error')
  })
})

describe('providerModel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    perplexity.createChatCompletion.mockResolvedValue({ completion: '' })
    perplexity.createChatCompletionStream.mockImplementation(
      async function* () {}
    )
    parseAndRevealLanguageModel.mockImplementation(() => {
      throw new Error('model not found')
    })
  })

  it('should use providerModel when set on the model config', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { providerModel: 'actual-sonar-model-name' },
    })

    await createChatCompletion({ model: 'my-alias', messages: [] })

    expect(perplexity.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'actual-sonar-model-name' })
    )
  })

  it('should fall back to the original model name when lookup throws', async () => {
    // default mock already throws

    await createChatCompletion({ model: 'sonar', messages: [] })

    expect(perplexity.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'sonar' })
    )
  })

  it('should apply providerModel in streaming mode', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { providerModel: 'actual-sonar-model-name' },
    })

    for await (const _ of createChatCompletionStream({
      model: 'my-alias',
      messages: [],
    })) {
      // drain
    }

    expect(perplexity.createChatCompletionStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'actual-sonar-model-name' })
    )
  })
})
