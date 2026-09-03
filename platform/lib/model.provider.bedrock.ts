import debug from '@/lib/debug'
import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

// ---
// ---
// ---

/**
 * Gets the Bedrock API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getBedrockAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Bedrock',
    storeKey: store.bedrockKey,
    storeUrl: store.bedrockUrl,
    envKey: process.env.BEDROCK_MODELS_API_KEY,
  })
}

/**
 * Gets the Bedrock API URL from model store or environment
 */
export function getBedrockAPIUrl(): string {
  const envUrl = process.env.BEDROCK_API_URL

  const url =
    getSafeModelStore().bedrockUrl ||
    envUrl ||
    'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1/chat/completions'

  if (envUrl && url !== envUrl) {
    debug(`using custom bedrock url`)
  }

  return url
}

// ---
// ---
// ---

/**
 * Creates a chat completion using Bedrock OpenAI-compatible API
 */
export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: getBedrockAPIUrl(),
    authorization: `Bearer ${getBedrockAPIKey()}`,

    errorPrefix: 'BR_',
  })
}

/**
 * Creates a streaming chat completion using Bedrock OpenAI-compatible API
 */
export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: getBedrockAPIUrl(),
    authorization: `Bearer ${getBedrockAPIKey()}`,

    errorPrefix: 'BR_',
  })
}
