import { blobToDataUrl } from '@/lib/dataurl.blob'
import debug from '@/lib/debug'
import { SystemError, UserInputError } from '@/lib/error'
import _fetch, { withRetry, withTimeout } from '@/lib/fetch'
import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import {
  createChatCompletion as createOpenAICompatibleChatCompletion,
  createChatCompletionStream as createOpenAICompatibleChatCompletionStream,
  throwOpenAIError,
} from '@/lib/model.provider.openai'

import { createParser } from 'eventsource-parser'

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
 * fetch instance dedicated for reranking.
 *
 * @note reranking is a fast request/response call on the conversation hot path.
 * The 15s timeout is deliberately kept below the edge response budget
 * (MAX_RESPONSE_WAIT_TIME, ~25s) so a slow gateway fails fast and the
 * caller (searchDataset) can degrade to un-reranked results while there is still
 * time to answer. retryTimeout stays false so a hanging gateway cannot stack
 * multiple 15s timeouts and blow past that budget (a single 6×15s retry storm
 * would run ~90s). Non-timeout transient errors
 * (5xx) are still retried.
 */
const fetchForRerank = withRetry(withTimeout(_fetch, { timeout: 15_000 }), {
  retries: 5,
  retryDelay: 250,
  retryTimeout: false,
})

/**
 * Gets the Vercel API key from model store or environment.
 *
 * @returns {string}
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getVercelAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Vercel',
    storeKey: store.vercelKey,
    storeUrl: store.vercelUrl,
    envKey: process.env.VERCEL_MODELS_API_KEY,
  })
}

// --- Language ---

/**
 * Creates a chat completion using Vercel AI Gateway's API
 */
export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  return createOpenAICompatibleChatCompletion({
    ...options,

    url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
    authorization: `Bearer ${getVercelAPIKey()}`,

    extra: {
      ...options.extra,

      providerOptions: {
        ...options.extra?.providerOptions,

        gateway: {
          ...options.extra?.providerOptions?.gateway,

          zeroDataRetention:
            options.extra?.providerOptions?.gateway?.zeroDataRetention ?? true,
        },
      },
    },

    errorPrefix: 'VR_',
  })
}

/**
 * Creates a chat completion stream using Vercel AI Gateway's API
 */
export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
    authorization: `Bearer ${getVercelAPIKey()}`,

    extra: {
      ...options.extra,

      providerOptions: {
        ...options.extra?.providerOptions,

        gateway: {
          ...options.extra?.providerOptions?.gateway,

          zeroDataRetention:
            options.extra?.providerOptions?.gateway?.zeroDataRetention ?? true,
        },
      },
    },

    errorPrefix: 'VR_',
  })
}

// --- Image ---

export interface ImageUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

/**
 * Which gateway surface serves an image model.
 *
 * @note most Vercel image models are language models that happen to emit images
 * (`google/gemini-*-image`), so they are driven through chat completions with an
 * `image` modality. Models the gateway itself types as `image` - the xAI Imagine
 * family - have no chat surface at all and reject a chat completion with a
 * `ModelTypeMismatchError`; they are only reachable through the dedicated image
 * generation API. The model config declares which one applies.
 */
export type ImageProviderAPI = 'chat' | 'image'

export interface CreateImageOptions {
  prompt: string

  model: string
  modelOptions?: Record<string, unknown>
  providerApi?: ImageProviderAPI

  size?: string

  user?: string

  signal?: AbortSignal
}

export interface CreateImageResult {
  urls: string[]
  usage: ImageUsage
}

export interface EditImageOptions {
  prompt: string

  images: Blob[]
  mask?: Blob

  model: string
  modelOptions?: Record<string, unknown>
  providerApi?: ImageProviderAPI

  size?: string

  user?: string

  signal?: AbortSignal
}

export interface EditImageResult {
  urls: string[]
  usage: ImageUsage
}

/**
 * Derives the media type of a base64 payload from its leading bytes.
 *
 * @note the image generation API answers with a bare `b64_json` string and no
 * media type of its own, so the type has to come off the payload itself for the
 * data URL to survive the round trip through storage.
 */
function getBase64ImageMediaType(data: string): string {
  const signatures: [string, string][] = [
    ['/9j/', 'image/jpeg'],
    ['iVBOR', 'image/png'],
    ['UklGR', 'image/webp'],
    ['R0lGOD', 'image/gif'],
  ]

  for (const [prefix, mediaType] of signatures) {
    if (data.startsWith(prefix)) {
      return mediaType
    }
  }

  return 'application/octet-stream'
}

/**
 * Creates an image through Vercel AI Gateway's image generation API.
 *
 * @note this is the surface for models the gateway types as `image` (see
 * ImageProviderAPI). Unlike the chat path the response carries no message - just
 * a `data` array of base64 payloads - and the `url` response format is accepted
 * but ignored, so a data URL is always synthesised here.
 */
async function createImageThroughImageAPI(
  options: CreateImageOptions
): Promise<CreateImageResult> {
  const { prompt, model, modelOptions, size, user, signal } = options

  debug(`createImage using image api`, {
    prompt,
    model,
    modelOptions,
    size,
    user,
  }).log('vercel.createImage.image')

  const body = {
    model: model,

    prompt: prompt,

    n: 1,

    size: size,

    providerOptions: modelOptions,
  }

  const response = await fetchForImage(
    'https://ai-gateway.vercel.sh/v1/images/generations',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getVercelAPIKey()}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'VR_' })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('vercel.createImage.image.received')

  const urls = new Set<string>()

  for (const item of data.data || []) {
    if (item?.url) {
      urls.add(item.url)

      continue
    }

    if (item?.b64_json) {
      urls.add(
        `data:${getBase64ImageMediaType(item.b64_json)};base64,${item.b64_json}`
      )
    }
  }

  if (!urls.size) {
    throw new SystemError(
      'Vercel image response did not include an image',
      'VR_NO_IMAGE'
    )
  }

  return {
    urls: [...urls],
    usage: {
      model: model,
      inputTokens: 0,
      outputTokens: urls.size,
    },
  }
}

/**
 * Creates an image using Vercel AI Gateway's multimodal models.
 *
 * @note Vercel image generation works through the chat completions API with
 * modalities: ["image", "text"] parameter. The image is returned as base64.
 */
export async function createImage(
  options: CreateImageOptions
): Promise<CreateImageResult> {
  const { prompt, model, modelOptions, user, signal } = options

  if (options.providerApi === 'image') {
    return createImageThroughImageAPI(options)
  }

  debug(`createImage using`, { prompt, model, modelOptions, user }).log(
    'vercel.createImage'
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

    providerOptions: modelOptions,

    stream: false,
  }

  const response = await fetchForImage(
    'https://ai-gateway.vercel.sh/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getVercelAPIKey()}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'VR_' })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('vercel.createImage.received')

  // @note Vercel returns images in the message content as an array
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

  const usage = data.usage || {} // @todo ensure token usage accounting is correct

  let filteredUrls = [...urls]

  // @note vercel ai gateway appears to return each generated image twice with
  // different metadata
  // @todo review this vercel ai gateway duplicate pair behavior and remove this
  // workaround once the upstream response is understood
  if (filteredUrls.length > 1 && filteredUrls.length % 2 === 0) {
    filteredUrls = filteredUrls.filter((_, index) => index % 2 === 0)
  }

  debug(`extracted urls`, { urls, filteredUrls, usage }).log(
    'vercel.createImage.extracted'
  )

  if (!filteredUrls.length) {
    throw new SystemError(
      'Vercel image response did not include an image',
      'VR_NO_IMAGE'
    )
  }

  return {
    urls: filteredUrls,
    usage: {
      model: model,
      inputTokens: 0,
      outputTokens: filteredUrls.length,
    },
  }
}

/**
 * Edits an image using Vercel AI Gateway's multimodal models.
 *
 * @note Vercel image editing works through the chat completions API by
 * passing the existing image(s) as image_url parts in the message content
 * alongside the text instruction, with modalities: ["image", "text"].
 */
export async function editImage(
  options: EditImageOptions
): Promise<EditImageResult> {
  const { prompt, images, model, modelOptions, user, signal } = options

  // @note the image generation API has no edit surface, and the models routed
  // through it take text input only - so there is nothing to fall back to here.
  if (options.providerApi === 'image') {
    throw new UserInputError(
      `The ${model} model can generate images but cannot edit them`
    )
  }

  debug(`editImage using`, {
    prompt,
    model,
    modelOptions,
    imageCount: images.length,
    user,
  }).log('vercel.editImage')

  // @note convert Blob images to base64 data URLs for the API
  const imageDataUrls = await Promise.all(images.map(blobToDataUrl))

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

    providerOptions: modelOptions,

    stream: false,
  }

  const response = await fetchForImage(
    'https://ai-gateway.vercel.sh/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getVercelAPIKey()}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'VR_' })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('vercel.editImage.received')

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

  let filteredUrls = [...urls]

  // @note vercel ai gateway appears to return each generated image twice with different metadata
  // @todo review this vercel ai gateway duplicate pair behavior and remove this workaround once the upstream response is understood
  if (filteredUrls.length > 1 && filteredUrls.length % 2 === 0) {
    filteredUrls = filteredUrls.filter((_, index) => index % 2 === 0)
  }

  debug(`extracted urls`, { urls, filteredUrls, usage }).log(
    'vercel.editImage.extracted'
  )

  if (!filteredUrls.length) {
    throw new SystemError(
      'Vercel image response did not include an image',
      'VR_NO_IMAGE'
    )
  }

  return {
    urls: filteredUrls,
    usage: {
      model: model,
      inputTokens: images.length,
      outputTokens: filteredUrls.length,
    },
  }
}

// --- Video ---

export interface VideoUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

export interface CreateVideoOptions {
  prompt: string

  model: string
  modelOptions?: Record<string, unknown>

  duration: number
  n?: number
  aspectRatio?: string
  resolution?: string
  fps?: number
  seed?: number

  user?: string

  signal?: AbortSignal
}

export interface CreateVideoResult {
  urls: string[]
  usage: VideoUsage
}

export interface EditVideoOptions {
  prompt: string

  model: string
  modelOptions?: Record<string, unknown>

  videos: string[]
  frames?: string[]
  audios?: string[]

  duration: number
  n?: number
  aspectRatio?: string
  resolution?: string
  fps?: number
  seed?: number

  user?: string

  signal?: AbortSignal
}

export interface EditVideoResult {
  urls: string[]
  usage: VideoUsage
}

type SubmitVideoOptions = CreateVideoOptions &
  Partial<Pick<EditVideoOptions, 'videos' | 'frames' | 'audios'>>

async function submitVideo(
  options: SubmitVideoOptions
): Promise<CreateVideoResult> {
  const {
    prompt,
    model,
    modelOptions,
    videos = [],
    frames = [],
    audios = [],
    n = 1,
    aspectRatio,
    resolution,
    duration,
    fps,
    seed,
    user,
    signal,
  } = options

  type GatewayVideoData = {
    type: 'url' | 'base64'
    url?: string
    data?: string
    mediaType: string
  }

  type GatewayMediaInput =
    | {
        type: 'url'
        url: string
      }
    | {
        type: 'file'
        data: string
        mediaType: string
      }

  type GatewayVideoEvent = {
    type: 'result' | 'error'
    videos?: GatewayVideoData[]
    warnings?: unknown[]
    providerMetadata?: Record<string, unknown>
    message?: string
    errorType?: string
    statusCode?: number
    param?: unknown
  }

  async function readFirstJsonSSEEvent(
    response: Response
  ): Promise<GatewayVideoEvent> {
    if (!response.body) {
      throw new Error('SSE response body is empty')
    }

    const decoder = new TextDecoder()

    let event: GatewayVideoEvent | null = null

    const parser = createParser({
      onEvent: (message) => {
        if (!event) {
          event = JSON.parse(message.data)
        }
      },
    })

    // @ts-ignore
    for await (const chunk of response.body) {
      parser.feed(decoder.decode(chunk))

      if (event) {
        return event
      }
    }

    throw new Error('SSE stream ended without a data event')
  }

  function resolveVideoURL(video: GatewayVideoData): string {
    if (video.type === 'base64') {
      return `data:${video.mediaType || 'video/mp4'};base64,${video.data || ''}`
    }

    if (video.type === 'url' && video.url) {
      return video.url
    }

    throw new Error('Unsupported video response')
  }

  function resolveMediaInputURL(url: string): GatewayMediaInput {
    if (!url.startsWith('data:')) {
      return {
        type: 'url',
        url,
      }
    }

    const separatorIndex = url.indexOf(',')

    if (separatorIndex === -1) {
      throw new Error('Invalid data URL')
    }

    const metadata = url.slice('data:'.length, separatorIndex)
    const data = url.slice(separatorIndex + 1)
    const metadataParts = metadata.split(';')
    const mediaType = metadataParts[0] || 'application/octet-stream'

    if (metadataParts.includes('base64')) {
      return {
        type: 'file',
        data,
        mediaType,
      }
    }

    return {
      type: 'file',
      data: Buffer.from(decodeURIComponent(data)).toString('base64'),
      mediaType,
    }
  }

  function throwVideoEventError(event: GatewayVideoEvent): never {
    const message = event.message || 'Vercel video generation failed'

    if (
      typeof event.statusCode === 'number' &&
      event.statusCode >= 400 &&
      event.statusCode < 500
    ) {
      throw new SystemError(message, event.statusCode.toString())
    }

    if (/may contain real person/i.test(message)) {
      throw new UserInputError(message)
    }

    throw new Error(message)
  }

  debug(`createVideo using`, {
    prompt,
    model,
    modelOptions,
    n,
    aspectRatio,
    resolution,
    duration,
    fps,
    seed,
    user,
  }).log('vercel.createVideo')

  const [video] = videos
  const [startFrame, endFrame] = frames
  const [audio] = audios
  const inputImage = startFrame
  const xaiOptions = modelOptions?.xai
  const bytedanceOptions = modelOptions?.bytedance

  const providerOptions = {
    ...modelOptions,
    ...(video || audio
      ? {
          xai: {
            ...(xaiOptions &&
            typeof xaiOptions === 'object' &&
            !Array.isArray(xaiOptions)
              ? xaiOptions
              : {}),
            ...(video && { videoUrl: video }),
            ...(audio && { audioUrl: audio }),
          },
        }
      : {}),
    ...(endFrame || audio
      ? {
          bytedance: {
            ...(bytedanceOptions &&
            typeof bytedanceOptions === 'object' &&
            !Array.isArray(bytedanceOptions)
              ? bytedanceOptions
              : {}),
            ...(endFrame && { lastFrameImage: endFrame }),
            ...(audio && { audioUrl: audio }),
          },
        }
      : {}),
  }

  const body = {
    prompt,
    n,
    ...(inputImage && { image: resolveMediaInputURL(inputImage) }),
    ...(aspectRatio && { aspectRatio }),
    ...(resolution && { resolution }),
    ...(duration && { duration }),
    ...(fps && { fps }),
    ...(seed && { seed }),
    ...(Object.keys(providerOptions).length && { providerOptions }),
  }

  const response = await fetchForImage(
    'https://ai-gateway.vercel.sh/v4/ai/video-model',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getVercelAPIKey()}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'ai-gateway-protocol-version': '0.0.1',
        'ai-gateway-auth-method': 'api-key',
        'ai-video-model-specification-version': '4',
        'ai-model-id': model,
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'VR_' })
  }

  const event = await readFirstJsonSSEEvent(response)

  debug(`received data`, { event }).log('vercel.createVideo.received')

  if (event.type === 'error') {
    throwVideoEventError(event)
  }

  const urls = (event.videos || []).map((video) => resolveVideoURL(video))

  if (!urls.length) {
    throw new SystemError(
      'Vercel video response did not include a video',
      'VR_NO_VIDEO'
    )
  }

  const receivedCount = videos.length || 0
  const receivedSeconds = duration * receivedCount

  const generatedCount = urls.length
  const generatedSeconds = duration * generatedCount

  debug(`extracted urls`, { urls }).log('vercel.createVideo.extracted')

  return {
    urls,
    usage: {
      model,
      inputTokens: receivedSeconds,
      outputTokens: generatedSeconds,
    },
  }
}

/**
 * Creates a video using Vercel AI Gateway's experimental video model API.
 *
 * @note This mirrors the AI SDK GatewayVideoModel HTTP contract directly:
 * POST /v4/ai/video-model, text/event-stream response, and ai-model-id header.
 */
export async function createVideo(
  options: CreateVideoOptions
): Promise<CreateVideoResult> {
  return submitVideo(options)
}

/**
 * Edits a video using Vercel AI Gateway's experimental video model API.
 *
 * @note Vercel exposes source media through provider options for current video
 * editing models.
 */
export async function editVideo(
  options: EditVideoOptions
): Promise<EditVideoResult> {
  return submitVideo(options)
}

// --- Rerank ---

export interface RerankUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

export interface RerankDocument {
  id: string
  text: string
}

export interface RerankedDocument {
  id: string
  index: number
  score: number
}

export interface CreateRerankOptions {
  query: string

  documents: RerankDocument[]

  model: string
  modelOptions?: Record<string, unknown>

  topN?: number

  signal?: AbortSignal
}

export interface CreateRerankResult {
  documents: RerankedDocument[]
  usage: RerankUsage
}

/**
 * Reranks documents by relevance to a query using Vercel AI Gateway's reranking
 * models (e.g. cohere/rerank-v4-fast, voyage/rerank-2.5).
 *
 * @note Reranking is not exposed through the OpenAI-compatible endpoint, so this
 * targets the gateway model protocol directly (POST /v4/ai/reranking-model with
 * the ai-model-id header), mirroring the video model contract above.
 */
export async function rerank(
  options: CreateRerankOptions
): Promise<CreateRerankResult> {
  const { query, documents, model, modelOptions, topN, signal } = options

  debug(`rerank using`, {
    query,
    model,
    modelOptions,
    documentCount: documents.length,
    topN,
  }).log('vercel.rerank')

  // @note short-circuit empty input to avoid a pointless billed API call

  if (!documents.length) {
    return {
      documents: [],
      usage: {
        model,
        inputTokens: 0,
        outputTokens: 0,
      },
    }
  }

  const body = {
    query,

    // @note the gateway reranking-model protocol (spec version 4) takes the
    // candidates as a tagged object - { type: 'text', values: string[] } - not a
    // bare string array. This mirrors how the AI SDK's rerank() serialises plain
    // string documents before it hits the same endpoint (the OpenAI-compatible
    // path does not support reranking). ids are mapped back from the returned
    // positional index below.

    documents: { type: 'text', values: documents.map(({ text }) => text) },

    ...(topN !== undefined && { topN }),
    ...(modelOptions && { providerOptions: modelOptions }),
  }

  const response = await fetchForRerank(
    'https://ai-gateway.vercel.sh/v4/ai/reranking-model',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getVercelAPIKey()}`,
        'Content-Type': 'application/json',
        'ai-gateway-protocol-version': '0.0.1',
        'ai-gateway-auth-method': 'api-key',
        'ai-reranking-model-specification-version': '4',
        'ai-model-id': model,
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'VR_' })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('vercel.rerank.received')

  type GatewayRerankResult = {
    index: number
    relevanceScore: number
  }

  const ranking: GatewayRerankResult[] = data.ranking || []

  const reranked = ranking
    // @note guard against out-of-range indices before mapping back to ids
    .filter(({ index }) => index >= 0 && index < documents.length)
    .map(({ index, relevanceScore }) => ({
      id: documents[index].id,
      index,
      score: relevanceScore,
    }))

  debug(`reranked documents`, { reranked }).log('vercel.rerank.reranked')

  return {
    documents: reranked,
    usage: {
      model,
      // @note usage is reported as one synthetic unit per call (one "search"),
      // leaving the actual cost to per-model pricing config. This is exact for
      // search-billed models (e.g. cohere/rerank-*, which bill per request, with
      // one search covering up to 100 documents - our reranker cap keeps every
      // call well under that). It is a flat-per-call approximation for
      // token-billed models (e.g. voyage/rerank-*, billed per input token); the
      // gateway response returns no token counts, so revisit this with a
      // query+document token estimate if exact token billing is required.
      inputTokens: 0,
      outputTokens: 1,
    },
  }
}
