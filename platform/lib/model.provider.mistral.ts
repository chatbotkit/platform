import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

/**
 * Gets the Mistral API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getMistralAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Mistral',
    storeKey: store.mistralKey,
    storeUrl: store.mistralUrl,
    envKey: process.env.MISTRAL_MODELS_API_KEY,
  })
}

/**
 * Creates a chat completion using Mistral API
 */
export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://api.mistral.ai/v1/chat/completions',
    authorization: `Bearer ${getMistralAPIKey()}`,

    errorPrefix: 'MX_',

    exclude: [
      // @note the following fields are not supported
      // @todo revise this decision later
      'user',
      'stream_options',
      'store',
    ],
  })
}

/**
 * Creates a streaming chat completion using Mistral API
 */
export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://api.mistral.ai/v1/chat/completions',
    authorization: `Bearer ${getMistralAPIKey()}`,

    errorPrefix: 'MX_',

    exclude: [
      // @note the following fields are not supported
      // @todo revise this decision later
      'user',
      'stream_options',
      'store',
    ],
  })
}
