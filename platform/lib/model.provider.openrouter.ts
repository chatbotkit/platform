import { siteHostname, siteUrl } from '@/config/site'

import debug from '@/lib/debug'
import _fetch, { withRetry, withTimeout } from '@/lib/fetch'
import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
  throwOpenAIError,
} from '@/lib/model.provider.openai'

/**
 * fetch instance dedicated for image creation (no timeout)
 *
 * @note timeout: 0 disables the timeout to allow for longer image generation
 * times. This is consistent with OpenAI's fetchForImage implementation.
 */
const fetchForImage = withRetry(withTimeout(_fetch, { timeout: 0 }), {
  retries: 5,
  retryDelay: 250,
  retryTimeout: true,
})

/**
 * Gets the OpenRouter API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getOpenRouterAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'OpenRouter',
    storeKey: store.openrouterKey,
    storeUrl: store.openrouterUrl,
    envKey: process.env.OPENROUTER_MODELS_API_KEY,
  })
}

// --- Language ---

/**
 * Creates a chat completion using OpenRouter's API
 */
export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://openrouter.ai/api/v1/chat/completions',
    authorization: `Bearer ${getOpenRouterAPIKey()}`,

    // @todo might be good for marketing but it is unclear if we this is a good
    // idea for privacy-conscious users

    headers: {
      ...options.headers,

      'HTTP-Referer': siteUrl,
      'X-Title': siteHostname,
    },

    extra: {
      ...options.extra,

      zdr: true, // @note the request will be routed to endpoints with zero-data-retention policies
    },

    errorPrefix: 'OR_',
  })
}

/**
 * Creates a chat completion stream using OpenRouter's API
 */
export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://openrouter.ai/api/v1/chat/completions',
    authorization: `Bearer ${getOpenRouterAPIKey()}`,

    // @todo might be good for marketing but it is unclear if we this is a good
    // idea for privacy-conscious users

    headers: {
      ...options.headers,

      'HTTP-Referer': siteUrl,
      'X-Title': siteHostname,
    },

    extra: {
      ...options.extra,

      zdr: true, // @note the request will be routed to endpoints with zero-data-retention policies
    },

    errorPrefix: 'OR_',
  })
}

// --- Image ---

export interface CreateImageOptions {
  prompt: string

  model: string
  modelOptions?: Record<string, unknown>

  size?: string

  user?: string

  signal?: AbortSignal
}

export interface EditImageOptions {
  prompt: string

  images: Blob[]
  mask?: Blob

  model: string
  modelOptions?: Record<string, unknown>

  size?: string

  user?: string

  signal?: AbortSignal
}

export interface CreateImageResult {
  urls: string[]
  usage: {
    model: string
    inputTokens: number
    outputTokens: number
  }
}

export type EditImageResult = CreateImageResult

/**
 * Creates an image using OpenRouter's multimodal models.
 *
 * @note OpenRouter image generation works through the chat completions API with
 * modalities: ["image", "text"] parameter. The image is returned as base64.
 */
export async function createImage(
  options: CreateImageOptions
): Promise<CreateImageResult> {
  const { prompt, model, modelOptions, user, signal } = options

  debug(`createImage using`, { prompt, model, modelOptions, user }).log(
    'openrouter.createImage'
  )

  const body = {
    model: model,

    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],

    modalities: ['image', 'text'],

    provider: modelOptions,

    stream: false,
  }

  const response = await fetchForImage(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getOpenRouterAPIKey()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': siteHostname,
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'OR_' })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('openrouter.createImage.received')

  // @note OpenRouter returns images in the message content as an array
  // Each image part has type "image_url" with the base64 data URL
  const urls = new Set<string>()

  const message = data.choices?.[0]?.message

  if (message?.content) {
    // Handle both string content and array content
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          urls.add(part.image_url.url)
        }
      }
    }
  }

  // Also check for images array in the response (alternative format)
  if (message?.images) {
    for (const image of message.images) {
      // @note handle both snake_case (image_url) and camelCase (imageUrl) formats
      const imageUrl = image.image_url?.url || image.imageUrl?.url

      if (imageUrl) {
        urls.add(imageUrl)
      }
    }
  }

  const usage = data.usage || {}

  debug(`extracted urls`, { urls, usage }).log(
    'openrouter.createImage.extracted'
  )

  return {
    urls: [...urls],
    usage: {
      model: model,
      inputTokens: 0,
      outputTokens: urls.size || 1,
    },
  }
}

/**
 * Edits an image using OpenRouter's multimodal models.
 *
 * @note OpenRouter image editing works through the chat completions API by
 * passing the existing image(s) as image_url parts in the message content
 * alongside the text instruction, with modalities: ["image", "text"].
 */
export async function editImage(
  options: EditImageOptions
): Promise<EditImageResult> {
  const { prompt, images, model, modelOptions, user, signal } = options

  debug(`editImage using`, {
    prompt,
    model,
    modelOptions,
    imageCount: images.length,
    user,
  }).log('openrouter.editImage')

  // @note convert Blob images to base64 data URLs for the API
  const imageDataUrls = await Promise.all(
    images.map(async (blob) => {
      const buffer = await blob.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = blob.type || 'image/png'

      return `data:${mimeType};base64,${base64}`
    })
  )

  const imageContentParts = imageDataUrls.map((url) => ({
    type: 'image_url',
    image_url: { url },
  }))

  const body = {
    model: model,

    messages: [
      {
        role: 'user',
        content: [
          ...imageContentParts,
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],

    modalities: ['image', 'text'],

    provider: modelOptions,

    stream: false,
  }

  const response = await fetchForImage(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getOpenRouterAPIKey()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': siteHostname,
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'OR_' })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('openrouter.editImage.received')

  const urls = new Set<string>()

  const message = data.choices?.[0]?.message

  if (message?.content) {
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          urls.add(part.image_url.url)
        }
      }
    }
  }

  if (message?.images) {
    for (const image of message.images) {
      // @note handle both snake_case (image_url) and camelCase (imageUrl) formats
      const imageUrl = image.image_url?.url || image.imageUrl?.url

      if (imageUrl) {
        urls.add(imageUrl)
      }
    }
  }

  const usage = data.usage || {}

  debug(`extracted urls`, { urls, usage }).log('openrouter.editImage.extracted')

  return {
    urls: [...urls],
    usage: {
      model: model,
      inputTokens: images.length,
      outputTokens: urls.size || 1,
    },
  }
}
