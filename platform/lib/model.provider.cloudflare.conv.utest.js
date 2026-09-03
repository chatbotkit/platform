import { createChatCompletionStream } from '@/lib/model.provider.cloudflare.adaptor'
import {
  completeChatConversation,
  completeConversation,
} from '@/lib/model.provider.cloudflare.conv'
import {
  completeChatConversation as completeChatConversationCompatibleWithOpenAI,
  completeConversation as completeConversationCompatibleWithOpenAI,
} from '@/lib/model.provider.openai.conv'

jest.mock('@/lib/model.provider.cloudflare.adaptor', () => ({
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai.conv', () => ({
  completeChatConversation: jest.fn(async function* (options) {
    yield { type: 'options', options }
  }),
  completeConversation: jest.fn(async function* (options) {
    yield { type: 'options', options }
  }),
}))

describe('cloudflare.conv', () => {
  it('delegates completeChatConversation with cloudflare stream adapter', async () => {
    const chunks = []

    for await (const chunk of completeChatConversation({
      model: 'cloudflare-gpt-4.1',
      messages: [],
    })) {
      chunks.push(chunk)
    }

    expect(completeChatConversationCompatibleWithOpenAI).toHaveBeenCalledWith({
      model: 'cloudflare-gpt-4.1',
      messages: [],
      createChatCompletionStream,
    })
    expect(chunks).toHaveLength(1)
  })

  it('delegates completeConversation with cloudflare stream adapter', async () => {
    const chunks = []

    for await (const chunk of completeConversation({
      model: 'cloudflare-gpt-4.1',
      messages: [],
    })) {
      chunks.push(chunk)
    }

    expect(completeConversationCompatibleWithOpenAI).toHaveBeenCalledWith({
      model: 'cloudflare-gpt-4.1',
      messages: [],
      createChatCompletionStream,
    })
    expect(chunks).toHaveLength(1)
  })
})
