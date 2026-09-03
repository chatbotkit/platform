import { getChatMessages as getOpenAICompatibleChatMessages } from '@/lib/model.provider.openai.adaptor'
import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
  createImage as createDirectImage,
  editImage as editDirectImage,
} from '@/lib/model.provider.openrouter'
import { getChatMessages as getPerplexityCompatibleChatMessages } from '@/lib/model.provider.perplexity.adaptor'
import { isRetriableError } from '@/lib/model.retry'
import {
  parseAndRevealImageModel,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'

// --- Language ---

type ChatCompletionOptions = Parameters<typeof createDirectChatCompletion>[0]
type ChatCompletionStreamOptions = Parameters<
  typeof createDirectChatCompletionStream
>[0]

/**
 * Resolves the provider-side model name for the OpenRouter API.
 */
export function getLanguageModel(
  options: ChatCompletionOptions | ChatCompletionStreamOptions
): string {
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
 * Builds the chat messages payload for the OpenRouter API.
 */
export async function getChatMessages<
  T extends ChatCompletionOptions | ChatCompletionStreamOptions
>(options: T): Promise<T['messages']> {
  if (/^perplexity\//.test(getLanguageModel(options))) {
    return getPerplexityCompatibleChatMessages(options)
  }

  return getOpenAICompatibleChatMessages(options)
}

/**
 * Builds extra parameters for OpenRouter, including reasoning effort
 * configuration.
 */
function getCompletionExtra(
  options: ChatCompletionOptions
): Record<string, unknown> {
  let extra: Record<string, unknown> = {
    ...options.extra,
  }

  if (options.reasoningEffort && options.reasoningEffort !== 'auto') {
    extra = {
      ...extra,

      reasoning_effort: null,

      reasoning: {
        effort: options.reasoningEffort,
        exclude: false,
      },
    }
  }

  return extra
}

/**
 * Creates a chat completion via OpenRouter with automatic retry on transient
 * errors.
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): ReturnType<typeof createDirectChatCompletion> {
  // @note we need to retry the request up to 3 times because the provider could
  // in some cases fail the requests for reasons that are not related to the
  // request itself, but rather to the provider's internal issues

  let lastError: unknown = null

  for (let i = 0; i < 3; i++) {
    try {
      return createDirectChatCompletion({
        ...options,

        model: getLanguageModel(options),

        messages: await getChatMessages(options),

        extra: getCompletionExtra(options),
      })
    } catch (e) {
      if (isRetriableError(e)) {
        lastError = e

        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** i))

        continue
      }

      throw e
    }
  }

  throw lastError
}

/**
 * Creates a streaming chat completion via OpenRouter with automatic retry on
 * transient errors.
 */
export async function* createChatCompletionStream(
  options: ChatCompletionStreamOptions
): ReturnType<typeof createDirectChatCompletionStream> {
  // @note we need to retry the request up to 3 times because the provider could
  // in some cases fail the requests for reasons that are not related to the
  // request itself, but rather to the provider's internal issues - keep in mind
  // that we cannot retry if we have already started yielding

  let lastError: unknown = null

  let hasYielded = false

  for (let i = 0; i < 3; i++) {
    try {
      for await (const item of createDirectChatCompletionStream({
        ...options,

        model: getLanguageModel(options),

        messages: await getChatMessages(options),

        extra: getCompletionExtra(options),
      })) {
        hasYielded = true

        yield item
      }

      return
    } catch (e) {
      if (hasYielded) {
        throw e
      }

      if (isRetriableError(e)) {
        lastError = e

        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** i))

        continue
      }

      throw e
    }
  }

  throw lastError
}

// --- Image ---

type CreateImageOptions = Parameters<typeof createDirectImage>[0]
type EditImageOptions = Parameters<typeof editDirectImage>[0]

/**
 * Resolves the provider-side model name for the OpenRouter API.
 */
export function getImageModel(options: CreateImageOptions): string {
  const model = options.model

  // @note use providerModel if configured, as it holds the exact provider-side
  // identifier

  try {
    const { config } = parseAndRevealImageModel(model)

    if ('providerModel' in config && config.providerModel) {
      return config.providerModel as string
    }
  } catch {
    // fall through
  }

  return model
}

/**
 * Builds the providerOptions from an image model configuration.
 */
function getImageProviderOptions(
  options: CreateImageOptions
): Record<string, unknown> | undefined {
  const model = options.model

  try {
    const { config } = parseAndRevealImageModel(model)

    if ('providerOptions' in config && config.providerOptions) {
      return config.providerOptions as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  return undefined
}

/**
 * Creates an image using OpenRouter API with automatic retry on transient
 * errors.
 */
export async function createImage(
  options: CreateImageOptions
): ReturnType<typeof createDirectImage> {
  let lastError: unknown = null

  for (let i = 0; i < 3; i++) {
    try {
      return createDirectImage({
        ...options,

        model: getImageModel(options),

        modelOptions: getImageProviderOptions(options),
      })
    } catch (e) {
      if (isRetriableError(e)) {
        lastError = e

        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** i))

        continue
      }

      throw e
    }
  }

  throw lastError
}

/**
 * Edits an image using OpenRouter API with automatic retry on transient
 * errors.
 */
export async function editImage(
  options: EditImageOptions
): ReturnType<typeof editDirectImage> {
  let lastError: unknown = null

  for (let i = 0; i < 3; i++) {
    try {
      return editDirectImage({
        ...options,

        model: getImageModel(options),

        modelOptions: getImageProviderOptions(options),
      })
    } catch (e) {
      if (isRetriableError(e)) {
        lastError = e

        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** i))

        continue
      }

      throw e
    }
  }

  throw lastError
}
