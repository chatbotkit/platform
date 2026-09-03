import { createChatCompletionStream } from '@/lib/model.provider.bedrock.adaptor'
import {
  completeChatConversation,
  completeConversation,
} from '@/lib/model.provider.bedrock.conv'
import * as openaiConv from '@/lib/model.provider.openai.conv'

jest.mock('@/lib/model.provider.bedrock.adaptor', () => ({
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai.conv', () => ({
  completeChatConversation: jest.fn(),
  completeConversation: jest.fn(),
}))

describe('bedrock.conv', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delegate completeChatConversation with bedrock stream adapter', async () => {
    const chunks = [
      { type: 'token', data: { token: 'Hi' } },
      { type: 'token', data: { token: ' there' } },
    ]

    openaiConv.completeChatConversation.mockImplementation(async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
    })

    const result = []

    for await (const chunk of completeChatConversation({
      model: 'claude-3-sonnet',
      messages: [{ type: 'user', text: 'hello' }],
    })) {
      result.push(chunk)
    }

    expect(result).toEqual(chunks)
    expect(openaiConv.completeChatConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-sonnet',
        createChatCompletionStream,
      })
    )
  })

  it('should delegate completeConversation with bedrock stream adapter', async () => {
    const chunks = [{ type: 'token', data: { token: 'Done' } }]

    openaiConv.completeConversation.mockImplementation(async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
    })

    const result = []

    for await (const chunk of completeConversation({
      model: 'claude-3-sonnet',
      messages: [{ type: 'user', text: 'hello' }],
    })) {
      result.push(chunk)
    }

    expect(result).toEqual(chunks)
    expect(openaiConv.completeConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-sonnet',
        createChatCompletionStream,
      })
    )
  })
})
