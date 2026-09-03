import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
} from '@/lib/model.provider.moonshot'
import { getChatMessages as getOpenAICompatibleChatMessages } from '@/lib/model.provider.openai.adaptor'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'

type ChatCompletionOptions = Parameters<typeof createDirectChatCompletion>[0]
type ChatCompletionStreamOptions = Parameters<
  typeof createDirectChatCompletionStream
>[0]

/**
 * Resolves the provider-side model name for the Moonshot API.
 */
export function getModel(options: ChatCompletionOptions): string {
  const model = options.model

  // @note use providerModel if configured, as it holds the exact provider-side
  // identifier

  try {
    const { config } = parseAndRevealLanguageModel(model)

    if ('providerModel' in config && config.providerModel) {
      return config.providerModel as string
    }
  } catch {
    // fall through
  }

  return model
}

/**
 * Builds the chat messages payload for the Moonshot API.
 */
export async function getChatMessages<
  T extends ChatCompletionOptions | ChatCompletionStreamOptions,
>(options: T): Promise<T['messages']> {
  return getOpenAICompatibleChatMessages(options)
}

/**
 * Creates a chat completion using Moonshot API
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): ReturnType<typeof createDirectChatCompletion> {
  return createDirectChatCompletion({
    ...options,

    messages: await getChatMessages(options),

    model: getModel(options),
  })
}

/**
 * Creates a streaming chat completion using Moonshot API
 */
export async function* createChatCompletionStream(
  options: ChatCompletionStreamOptions
): ReturnType<typeof createDirectChatCompletionStream> {
  yield* createDirectChatCompletionStream({
    ...options,

    messages: await getChatMessages(options),

    model: getModel(options),
  })
}
