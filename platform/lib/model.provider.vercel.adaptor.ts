import { getChatMessages as getOpenAICompatibleChatMessages } from '@/lib/model.provider.openai.adaptor'
import { getChatMessages as getPerplexityCompatibleChatMessages } from '@/lib/model.provider.perplexity.adaptor'
import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
  createImage as createDirectImage,
  rerank as createDirectRerank,
  createVideo as createDirectVideo,
  editImage as editDirectImage,
  editVideo as editDirectVideo,
} from '@/lib/model.provider.vercel'
import { isRetriableError } from '@/lib/model.retry'
import {
  parseAndRevealImageModel,
  parseAndRevealLanguageModel,
  parseAndRevealRerankModel,
  parseAndRevealVideoModel,
} from '@/lib/model.utils'

// --- Language ---

type ChatCompletionOptions = Parameters<typeof createDirectChatCompletion>[0]
type ChatCompletionStreamOptions = Parameters<
  typeof createDirectChatCompletionStream
>[0]

/**
 * Resolves the provider-side model name for the Vercel API.
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
 * Builds the Vercel AI Gateway providerOptions from the model configuration.
 *
 * @see https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/advanced
 */
export function getLanguageProviderOptions(
  options: ChatCompletionOptions
): Record<string, unknown> | undefined {
  const model = options.model

  try {
    const { config } = parseAndRevealLanguageModel(model)

    if ('providerOptions' in config && config.providerOptions) {
      return config.providerOptions
    }
  } catch {
    // fall through
  }

  return undefined
}

/**
 * Builds the chat messages payload for the Vercel API.
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
 * Builds extra parameters for Vercel, including provider-specific options.
 */
function getCompletionExtra(
  options: ChatCompletionOptions
): Record<string, unknown> {
  return {
    ...options.extra,

    providerOptions: getLanguageProviderOptions(options),
  }
}

/**
 * Creates a chat completion via Vercel with automatic retry on transient
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
 * Creates a streaming chat completion via Vercel with automatic retry on
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
 * Resolves the provider-side model name for the Vercel API.
 */
export function getImageModel(
  options: CreateImageOptions | EditImageOptions
): string {
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
 * Builds the Vercel AI Gateway providerOptions from an image model configuration.
 *
 * @see https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/advanced
 */
function getImageProviderOptions(
  options: CreateImageOptions | EditImageOptions
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
 * Resolves which gateway surface serves an image model.
 *
 * @note defaults to the chat surface - that is what every image model on the
 * gateway used to be. Only a model whose config opts into 'image' is driven
 * through the image generation API (see ImageProviderAPI in
 * lib/model.provider.vercel).
 */
function getImageProviderAPI(
  options: CreateImageOptions | EditImageOptions
): 'chat' | 'image' {
  const model = options.model

  try {
    const { config } = parseAndRevealImageModel(model)

    if ('providerApi' in config && config.providerApi === 'image') {
      return 'image'
    }
  } catch {
    // fall through
  }

  return 'chat'
}

/**
 * Creates an image using Vercel API with automatic retry on transient errors.
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

        providerApi: getImageProviderAPI(options),
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
 * Edits an image using Vercel API with automatic retry on transient errors.
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

        providerApi: getImageProviderAPI(options),
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

// --- Rerank ---

type CreateRerankOptions = Parameters<typeof createDirectRerank>[0]

/**
 * Resolves the provider-side rerank model name for the Vercel API.
 */
export function getRerankModel(options: CreateRerankOptions): string {
  const model = options.model

  try {
    const { config } = parseAndRevealRerankModel(model)

    if ('providerModel' in config && config.providerModel) {
      return config.providerModel as string
    }
  } catch {
    // fall through
  }

  return model
}

/**
 * Builds the Vercel AI Gateway providerOptions from a rerank model configuration.
 */
function getRerankProviderOptions(
  options: CreateRerankOptions
): Record<string, unknown> | undefined {
  const model = options.model

  try {
    const { config } = parseAndRevealRerankModel(model)

    if ('providerOptions' in config && config.providerOptions) {
      return config.providerOptions as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  return undefined
}

/**
 * Reranks documents using the Vercel API with automatic retry on transient
 * errors.
 */
export async function rerank(
  options: CreateRerankOptions
): ReturnType<typeof createDirectRerank> {
  let lastError: unknown = null

  for (let i = 0; i < 3; i++) {
    try {
      return createDirectRerank({
        ...options,

        model: getRerankModel(options),

        modelOptions: getRerankProviderOptions(options),
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

// --- Video ---

type CreateVideoOptions = Parameters<typeof createDirectVideo>[0]
type EditVideoOptions = Parameters<typeof editDirectVideo>[0]

/**
 * Resolves the provider-side video model name for the Vercel API.
 */
export function getVideoModel(
  options: CreateVideoOptions | EditVideoOptions
): string {
  const model = options.model

  try {
    const { config } = parseAndRevealVideoModel(model)

    if ('providerModel' in config && config.providerModel) {
      return config.providerModel as string
    }
  } catch {
    // fall through
  }

  return model
}

/**
 * Builds the Vercel AI Gateway providerOptions from a video model configuration.
 */
function getVideoProviderOptions(
  options: CreateVideoOptions | EditVideoOptions
): Record<string, unknown> | undefined {
  const model = options.model

  try {
    const { config } = parseAndRevealVideoModel(model)

    if ('providerOptions' in config && config.providerOptions) {
      return config.providerOptions as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  return undefined
}

/**
 * Creates a video using Vercel API with automatic retry on transient errors.
 */
export async function createVideo(
  options: CreateVideoOptions
): ReturnType<typeof createDirectVideo> {
  let lastError: unknown = null

  for (let i = 0; i < 3; i++) {
    try {
      return createDirectVideo({
        ...options,

        model: getVideoModel(options),

        modelOptions: getVideoProviderOptions(options),
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
 * Edits a video using Vercel API with automatic retry on transient errors.
 */
export async function editVideo(
  options: EditVideoOptions
): ReturnType<typeof editDirectVideo> {
  let lastError: unknown = null

  for (let i = 0; i < 3; i++) {
    try {
      return editDirectVideo({
        ...options,

        model: getVideoModel(options),

        modelOptions: getVideoProviderOptions(options),
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
