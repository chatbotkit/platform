import type { ConversationOutput, Item } from '@/lib/conv'
import { createChatCompletionStream } from '@/lib/model.provider.groq.adaptor'
import type { CompleteChatConversationOptions } from '@/lib/model.provider.openai.conv'
import {
  completeChatConversation as completeChatConversationCompatibleWithOpenAI,
  completeConversation as completeConversationCompatibleWithOpenAI,
} from '@/lib/model.provider.openai.conv'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'

/**
 * Wraps DeepSeek responses to handle thinking tags
 */
async function* wrapDeepSeek(
  it: AsyncGenerator<Item, void, unknown>
): AsyncGenerator<Item, void, unknown> {
  // @todo maybe move this into the adaptor

  let tokenPosition = 0

  let thinking = false

  let thinkingText = ''

  for await (const item of it) {
    if (item.type === 'token') {
      const thisTokenPosition = tokenPosition++

      if (item.data.token === '<think>' && thisTokenPosition === 0) {
        thinking = true
        thinkingText = ''

        // @note next item should be blank line so we should skip it
        {
          await it.next()
        }

        continue
      } else if (item.data.token === '</think>' && thinking === true) {
        thinking = false

        yield {
          type: 'message',
          data: {
            type: 'reasoning',
            text: thinkingText,
          },
        }

        // @note next item should be blank line so we should skip it
        {
          await it.next()
        }

        continue
      }

      if (thinking) {
        yield {
          type: 'reasoningToken',
          data: {
            token: item.data.token,
          },
        }

        thinkingText += item.data.token
      } else {
        yield item
      }
    } else if (item.type === 'message') {
      if (item.data.type === 'bot') {
        yield {
          type: 'message',
          data: {
            type: item.data.type,
            text: item.data.text.replace(/^<think>(.|\s)*?<\/think>\s*/m, ''),
          },
        }
      } else {
        yield item
      }
    } else {
      yield item
    }
  }
}

/**
 * Wraps conversation output with model-specific handling
 */
async function* wrap(
  options: CompleteChatConversationOptions,
  it: AsyncGenerator<Item, void, unknown>
): AsyncGenerator<Item, void, unknown> {
  const { name } = parseAndRevealLanguageModel(options.model)

  if (/deepseek/.test(name)) {
    yield* wrapDeepSeek(it)
  } else {
    yield* it
  }
}

/**
 * A function that completes a chat conversation. It supports tool calls.
 */
export async function* completeChatConversation(
  options: Omit<CompleteChatConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* wrap(
    options as CompleteChatConversationOptions,
    completeChatConversationCompatibleWithOpenAI({
      ...options,

      createChatCompletionStream,
    })
  )
}

/**
 * A high level conversation function that can handle both text and chat
 * conversations based on the selected model.
 */
export async function* completeConversation(
  options: Omit<CompleteChatConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* wrap(
    options as CompleteChatConversationOptions,
    completeConversationCompatibleWithOpenAI({
      ...options,

      createChatCompletionStream,
    })
  )
}
