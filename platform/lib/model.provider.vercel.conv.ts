import type { ConversationInput, ConversationOutput } from '@/lib/conv'
import {
  completeChatConversation as completeChatConversationCompatibleWithOpenAI,
  completeConversation as completeConversationCompatibleWithOpenAI,
} from '@/lib/model.provider.openai.conv'
import { createChatCompletionStream } from '@/lib/model.provider.vercel.adaptor'

interface VercelConversationOptions extends ConversationInput {
  createChatCompletionStream?: typeof createChatCompletionStream
}

/**
 * A function that completes a chat conversation. It supports tool calls.
 */
export async function* completeChatConversation(
  options: Omit<VercelConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* completeChatConversationCompatibleWithOpenAI({
    ...options,

    createChatCompletionStream,
  })
}

/**
 * A high level conversation function that can handle both text and chat
 * conversations based on the selected model.
 */
export async function* completeConversation(
  options: Omit<VercelConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* completeConversationCompatibleWithOpenAI({
    ...options,

    createChatCompletionStream,
  })
}
