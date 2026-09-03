import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

/**
 * Gets the Deepseek API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getDeepseekAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Deepseek',
    storeKey: store.deepseekKey,
    storeUrl: store.deepseekUrl,
    envKey: process.env.DEEPSEEK_MODELS_API_KEY,
  })
}

export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://api.deepseek.com/chat/completions',
    authorization: `Bearer ${getDeepseekAPIKey()}`,

    errorPrefix: 'DS_',
  })
}

export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://api.deepseek.com/chat/completions',
    authorization: `Bearer ${getDeepseekAPIKey()}`,

    errorPrefix: 'DS_',
  })
}
