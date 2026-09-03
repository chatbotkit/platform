import type { ConversationInput, ConversationOutput } from '@/lib/conv'
import {
  completeChatConversation as completeChatConversationCompatibleWithOpenAI,
  completeConversation as completeConversationCompatibleWithOpenAI,
} from '@/lib/model.provider.openai.conv'
import { createChatCompletionStream } from '@/lib/model.provider.cloudflare.adaptor'

interface CloudflareConversationOptions extends ConversationInput {
  createChatCompletionStream?: typeof createChatCompletionStream
}

export async function* completeChatConversation(
  options: Omit<CloudflareConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* completeChatConversationCompatibleWithOpenAI({
    ...options,

    createChatCompletionStream,
  })
}

export async function* completeConversation(
  options: Omit<CloudflareConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* completeConversationCompatibleWithOpenAI({
    ...options,

    createChatCompletionStream,
  })
}
