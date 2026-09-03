import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

/**
 * Gets the Groq API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getGroqAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Groq',
    storeKey: store.groqKey,
    storeUrl: store.groqUrl,
    envKey: process.env.GROQ_MODELS_API_KEY,
  })
}

/**
 * Creates a chat completion using Groq API
 */
export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://api.groq.com/openai/v1/chat/completions',
    authorization: `Bearer ${getGroqAPIKey()}`,

    errorPrefix: 'GQ_',

    exclude: [
      // @note the following fields are not supported
      // @todo revise this decision later
      'store',
    ],
  })
}

/**
 * Creates a streaming chat completion using Groq API
 */
export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://api.groq.com/openai/v1/chat/completions',
    authorization: `Bearer ${getGroqAPIKey()}`,

    errorPrefix: 'GQ_',

    exclude: [
      // @note the following fields are not supported
      // @todo revise this decision later
      'store',
    ],
  })
}
