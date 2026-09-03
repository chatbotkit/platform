import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

/**
 * Gets the Qwen API key from model store or environment.
 *
 * @note Qwen (Alibaba DashScope) is BYOK-only: there is no platform env key, so
 * `envKey` is left undefined. A request with no user credential cleanly throws a
 * UserConfigError rather than falling back to a platform key.
 *
 * @returns {string}
 * @throws {UserConfigError} if no BYOK key is available, or if a custom URL is
 * set without a custom key
 */
export function getQwenAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Qwen',
    storeKey: store.qwenKey,
    storeUrl: store.qwenUrl,
    envKey: undefined,
  })
}

export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    authorization: `Bearer ${getQwenAPIKey()}`,

    errorPrefix: 'QWEN_',
  })
}

export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    authorization: `Bearer ${getQwenAPIKey()}`,

    errorPrefix: 'QWEN_',
  })
}
