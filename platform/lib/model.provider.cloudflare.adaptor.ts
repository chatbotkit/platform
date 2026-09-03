import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
  createImage as createDirectImage,
  createVideo as createDirectVideo,
  editImage as editDirectImage,
  editVideo as editDirectVideo,
} from '@/lib/model.provider.cloudflare'
import { getChatMessages as getOpenAICompatibleChatMessages } from '@/lib/model.provider.openai.adaptor'
import { isRetriableError } from '@/lib/model.retry'
import {
  parseAndRevealImageModel,
  parseAndRevealLanguageModel,
  parseAndRevealVideoModel,
} from '@/lib/model.utils'

type ChatCompletionOptions = Parameters<typeof createDirectChatCompletion>[0]
type ChatCompletionStreamOptions = Parameters<
  typeof createDirectChatCompletionStream
>[0]

function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown = null

  return (async () => {
    for (let i = 0; i < 3; i++) {
      try {
        return await fn()
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
  })()
}

export function getLanguageModel(
  options: ChatCompletionOptions | ChatCompletionStreamOptions
): string {
  const model = options.model

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

function getLanguageProviderOptions(
  options: ChatCompletionOptions
): Record<string, unknown> | undefined {
  try {
    const { config } = parseAndRevealLanguageModel(options.model)

    if ('providerOptions' in config && config.providerOptions) {
      return config.providerOptions
    }
  } catch {
    // fall through
  }

  return undefined
}

export async function getChatMessages<
  T extends ChatCompletionOptions | ChatCompletionStreamOptions
>(options: T): Promise<T['messages']> {
  return getOpenAICompatibleChatMessages(options)
}

export async function createChatCompletion(
  options: ChatCompletionOptions
): ReturnType<typeof createDirectChatCompletion> {
  return withRetry(async () =>
    createDirectChatCompletion({
      ...options,
      model: getLanguageModel(options),
      messages: await getChatMessages(options),
      extra: {
        ...options.extra,
        providerOptions: getLanguageProviderOptions(options),
      },
    })
  )
}

export async function* createChatCompletionStream(
  options: ChatCompletionStreamOptions
): ReturnType<typeof createDirectChatCompletionStream> {
  let lastError: unknown = null
  let hasYielded = false

  for (let i = 0; i < 3; i++) {
    try {
      for await (const item of createDirectChatCompletionStream({
        ...options,
        model: getLanguageModel(options),
        messages: await getChatMessages(options),
        extra: {
          ...options.extra,
          providerOptions: getLanguageProviderOptions(options),
        },
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

type CreateImageOptions = Parameters<typeof createDirectImage>[0]
type EditImageOptions = Parameters<typeof editDirectImage>[0]

export function getImageModel(
  options: CreateImageOptions | EditImageOptions
): string {
  try {
    const { config } = parseAndRevealImageModel(options.model)

    if ('providerModel' in config && config.providerModel) {
      return config.providerModel as string
    }
  } catch {
    // fall through
  }

  return options.model
}

function getImageProviderOptions(
  options: CreateImageOptions | EditImageOptions
): Record<string, unknown> | undefined {
  try {
    const { config } = parseAndRevealImageModel(options.model)

    if ('providerOptions' in config && config.providerOptions) {
      return config.providerOptions as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  return undefined
}

export async function createImage(
  options: CreateImageOptions
): ReturnType<typeof createDirectImage> {
  return withRetry(() =>
    createDirectImage({
      ...options,
      model: getImageModel(options),
      modelOptions: getImageProviderOptions(options),
    })
  )
}

export async function editImage(
  options: EditImageOptions
): ReturnType<typeof editDirectImage> {
  return withRetry(() =>
    editDirectImage({
      ...options,
      model: getImageModel(options),
      modelOptions: getImageProviderOptions(options),
    })
  )
}

type CreateVideoOptions = Parameters<typeof createDirectVideo>[0]
type EditVideoOptions = Parameters<typeof editDirectVideo>[0]

export function getVideoModel(
  options: CreateVideoOptions | EditVideoOptions
): string {
  try {
    const { config } = parseAndRevealVideoModel(options.model)

    if ('providerModel' in config && config.providerModel) {
      return config.providerModel as string
    }
  } catch {
    // fall through
  }

  return options.model
}

function getVideoProviderOptions(
  options: CreateVideoOptions | EditVideoOptions
): Record<string, unknown> | undefined {
  try {
    const { config } = parseAndRevealVideoModel(options.model)

    if ('providerOptions' in config && config.providerOptions) {
      return config.providerOptions as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  return undefined
}

export async function createVideo(
  options: CreateVideoOptions
): ReturnType<typeof createDirectVideo> {
  return withRetry(() =>
    createDirectVideo({
      ...options,
      model: getVideoModel(options),
      modelOptions: getVideoProviderOptions(options),
    })
  )
}

export async function editVideo(
  options: EditVideoOptions
): ReturnType<typeof editDirectVideo> {
  return withRetry(() =>
    editDirectVideo({
      ...options,
      model: getVideoModel(options),
      modelOptions: getVideoProviderOptions(options),
    })
  )
}
