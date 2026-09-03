import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

/**
 * Gets the Perplexity API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getPerplexityAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Perplexity',
    storeKey: store.perplexityKey,
    storeUrl: store.perplexityUrl,
    envKey: process.env.PERPLEXITY_MODELS_API_KEY,
  })
}

export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://api.perplexity.ai/chat/completions',
    authorization: `Bearer ${getPerplexityAPIKey()}`,

    errorPrefix: 'PY_',
  })
}

export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://api.perplexity.ai/chat/completions',
    authorization: `Bearer ${getPerplexityAPIKey()}`,

    errorPrefix: 'PY_',
  })
}
