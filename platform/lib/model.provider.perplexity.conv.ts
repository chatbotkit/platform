import type { ConversationOutput } from '@/lib/conv'
import {
  completeChatConversation as completeChatConversationCompatibleWithOpenAI,
  completeConversation as completeConversationCompatibleWithOpenAI,
} from '@/lib/model.provider.openai.conv'
import type { CompleteChatConversationOptions } from '@/lib/model.provider.openai.conv'
import { createChatCompletionStream } from '@/lib/model.provider.perplexity.adaptor'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'

/**
 * Wraps model output to handle reasoning tokens for Perplexity models
 */
async function* wrapModel(it: ConversationOutput): ConversationOutput {
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
 * Wraps conversation output based on model type
 */
async function* wrap(
  options: Omit<CompleteChatConversationOptions, 'createChatCompletionStream'>,
  it: ConversationOutput
): ConversationOutput {
  const { name } = parseAndRevealLanguageModel(options.model)

  if (/reasoning|deep-research/.test(name)) {
    yield* wrapModel(it)
  } else {
    yield* it
  }
}

/**
 * Completes a chat conversation with support for tool calls
 */
export async function* completeChatConversation(
  options: Omit<CompleteChatConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* wrap(
    options,
    completeChatConversationCompatibleWithOpenAI({
      ...options,

      createChatCompletionStream,
    })
  )
}

/**
 * High level conversation function that handles both text and chat conversations
 */
export async function* completeConversation(
  options: Omit<CompleteChatConversationOptions, 'createChatCompletionStream'>
): ConversationOutput {
  yield* wrap(
    options,
    completeConversationCompatibleWithOpenAI({
      ...options,

      createChatCompletionStream,
    })
  )
}
