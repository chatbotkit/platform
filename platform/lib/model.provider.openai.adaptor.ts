import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
  createRealtimeSocket as createDirectRealtimeSocket,
  createResponseCompletionStream as createDirectResponseCompletionStream,
  createTextCompletion as createDirectTextCompletion,
  createTextCompletionStream as createDirectTextCompletionStream,
} from '@/lib/model.provider.openai'
import {
  isModel,
  modelRequiresUserTurnAsLastMessage,
  modelRequiresUserTurnBeforeToolCall,
} from '@/lib/model.utils'

import type { OpenAI } from 'openai'

type OpenAIMessage = OpenAI.Chat.ChatCompletionMessageParam

/**
 * There are some caveats for models that need to be handled in the most
 * appropriate way and this function helps us to do that.
 */
export function convertTemperature(
  temperature: number | undefined,
  model: string
): number | undefined {
  // @note some models do not support various temperature values
  // @todo remove this code after 2025/08/01
  {
    switch (true) {
      case isModel(model, [/^o1/]): {
        temperature = undefined // @note parameter is not supported

        break
      }

      case isModel(model, [/^gpt-5/, /^o4-mini/, /^o3/]): {
        temperature = 1 // @note parameter must be set to 1

        break
      }

      case isModel(model, [/^gpt-realtime/]): {
        return undefined
      }
    }
  }

  return temperature
}

/**
 * There are some caveats for models that need to be handled in the most
 * appropriate way and this function helps us to do that.
 */
export async function convertParallelToolCalls(
  parallelToolCalls: boolean | undefined,
  model: string
): Promise<boolean | undefined> {
  // @note some models do not support various temperature values
  // @todo remove this code after 2025/08/01
  {
    switch (true) {
      case isModel(model, [/^o3/]): {
        parallelToolCalls = undefined // @note parameter is not supported

        break
      }
    }
  }

  return parallelToolCalls
}

/**
 * There are some caveats for models that need to be handled in the most
 * appropriate way and this function helps us to do that.
 */
export async function convertMessages(
  messages: OpenAIMessage[],
  model: string
): Promise<OpenAIMessage[]> {
  const convertedMessages = messages.slice(0)

  // @note some providers reject histories where the first tool call appears
  // before any user turn.
  {
    if (modelRequiresUserTurnBeforeToolCall(model)) {
      const firstToolCallMessageIndex = convertedMessages.findIndex(
        (message) =>
          message.role === 'assistant' &&
          'tool_calls' in message &&
          message.tool_calls &&
          message.tool_calls.length > 0
      )

      if (firstToolCallMessageIndex >= 0) {
        const firstUserMessageIndex = convertedMessages.findIndex(
          (message) => message.role === 'user'
        )

        if (
          firstUserMessageIndex < 0 ||
          firstUserMessageIndex > firstToolCallMessageIndex
        ) {
          convertedMessages.splice(firstToolCallMessageIndex, 0, {
            role: 'user',
            content: '...',
          })
        }
      }
    }
  }

  // @note some providers (all Anthropic models) reject requests where the last
  // message has role 'assistant' - they do not support assistant prefill.
  {
    if (modelRequiresUserTurnAsLastMessage(model)) {
      const lastMessage = convertedMessages[convertedMessages.length - 1]

      if (lastMessage && lastMessage.role === 'assistant') {
        convertedMessages.push({
          role: 'user',
          content: '...',
        })
      }
    }
  }

  return convertedMessages
}

/**
 * Builds the chat messages payload for the OpenAI-compatible API.
 */
export async function getChatMessages<
  T extends {
    messages?: OpenAIMessage[]
    model: string
  },
>(options: T): Promise<T['messages']> {
  if (!options.messages) {
    return options.messages
  }

  return (await convertMessages(
    options.messages,
    options.model
  )) as T['messages']
}

export async function createTextCompletion(
  options: Parameters<typeof createDirectTextCompletion>[0]
): ReturnType<typeof createDirectTextCompletion> {
  return createDirectTextCompletion({
    ...options,
  })
}

export async function* createTextCompletionStream(
  options: Parameters<typeof createDirectTextCompletionStream>[0]
): ReturnType<typeof createDirectTextCompletionStream> {
  yield* createDirectTextCompletionStream({
    ...options,
  })
}

export async function createChatCompletion(
  options: Parameters<typeof createDirectChatCompletion>[0]
): ReturnType<typeof createDirectChatCompletion> {
  const convertedOptions = {
    ...options,

    temperature: await convertTemperature(options.temperature, options.model),

    messages: await getChatMessages(options),

    parallelToolCalls: await convertParallelToolCalls(
      options.parallelToolCalls,
      options.model
    ),
  }

  return createDirectChatCompletion({
    ...convertedOptions,
  })
}

export async function* createChatCompletionStream(
  options: Parameters<typeof createDirectChatCompletionStream>[0]
): ReturnType<typeof createDirectChatCompletionStream> {
  const convertedOptions = {
    ...options,

    temperature: await convertTemperature(options.temperature, options.model),

    messages: await getChatMessages(options),

    parallelToolCalls: await convertParallelToolCalls(
      options.parallelToolCalls,
      options.model
    ),
  }

  yield* createDirectChatCompletionStream({
    ...convertedOptions,
  })
}

export async function* createResponseCompletionStream(
  options: Parameters<typeof createDirectResponseCompletionStream>[0]
): ReturnType<typeof createDirectResponseCompletionStream> {
  const convertedOptions = {
    ...options,

    temperature: await convertTemperature(options.temperature, options.model),

    parallelToolCalls: await convertParallelToolCalls(
      options.parallelToolCalls,
      options.model
    ),
  }

  // @todo the Responses `input` is passed through without the provider-specific
  // fixups getChatMessages applies for chat (e.g. user-turn-before-tool-call).
  // Revisit if the Responses API turns out to need equivalent normalization.

  yield* createDirectResponseCompletionStream({
    ...convertedOptions,
  })
}

export function createRealtimeSocket(
  options: Parameters<typeof createDirectRealtimeSocket>[0]
): ReturnType<typeof createDirectRealtimeSocket> {
  return createDirectRealtimeSocket({
    ...options,

    temperature: convertTemperature(options.temperature, options.model),
  })
}
