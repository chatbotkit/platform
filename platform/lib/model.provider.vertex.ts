import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

/**
 * Gets the Vertex API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getVertexModelsAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Vertex',
    storeKey: store.vertexKey,
    storeUrl: store.vertexUrl,
    envKey: process.env.VERTEX_MODELS_API_KEY,
  })
}

/**
 * Creates a chat completion request using Vertex's OpenAI-compatible API
 */
export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    authorization: `Bearer ${getVertexModelsAPIKey()}`,

    errorPrefix: 'VX_',

    exclude: [
      // @note the following fields are not supported
      // @todo revise this decision later
      'store',
    ],
  })
}

/**
 * Creates a streaming chat completion request using Vertex's OpenAI-compatible API
 */
export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    authorization: `Bearer ${getVertexModelsAPIKey()}`,

    errorPrefix: 'VX_',

    exclude: [
      // @note the following fields are not supported
      // @todo revise this decision later
      'store',
    ],
  })
}
