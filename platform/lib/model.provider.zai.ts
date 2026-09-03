import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

/**
 * Gets the Z.AI API key from model store or environment.
 *
 * @note Z.AI is BYOK-only: there is no platform env key, so `envKey` is left
 * undefined. A request with no user credential cleanly throws a UserConfigError
 * rather than falling back to a platform key.
 *
 * @returns {string}
 * @throws {UserConfigError} if no BYOK key is available, or if a custom URL is
 * set without a custom key
 */
export function getZaiAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Z.AI',
    storeKey: store.zaiKey,
    storeUrl: store.zaiUrl,
    envKey: undefined,
  })
}

export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://api.z.ai/api/paas/v4/chat/completions',
    authorization: `Bearer ${getZaiAPIKey()}`,

    errorPrefix: 'ZAI_',
  })
}

export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://api.z.ai/api/paas/v4/chat/completions',
    authorization: `Bearer ${getZaiAPIKey()}`,

    errorPrefix: 'ZAI_',
  })
}
