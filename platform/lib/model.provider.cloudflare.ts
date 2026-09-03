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
import { z } from '@/lib/zod.schema'

const fetchForGeneration = withRetry(withTimeout(_fetch, { timeout: 0 }), {
  retries: 5,
  retryDelay: 250,
  retryTimeout: true,
})

const envSchema = z.object({
  CLOUDFLARE_MODELS_ACCOUNT_ID: z.string(),
  CLOUDFLARE_MODELS_API_KEY: z.string(),
})

function getEnv() {
  return envSchema.parse(process.env)
}

/**
 * Gets the Cloudflare API token from model store or environment.
 *
 * @throws {UserConfigError} if the API token is missing or a custom endpoint
 * uses platform credentials
 */
export function getCloudflareAPIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'Cloudflare',
    storeKey: store.cloudflareKey,
    storeUrl: store.cloudflareUrl,
    envKey: process.env.CLOUDFLARE_MODELS_API_KEY,
  })
}

export function getCloudflareAPIBaseURL(): string {
  const url = getSafeModelStore().cloudflareUrl

  if (url) {
    debug(`using custom cloudflare url`, { url }).log(
      'cloudflare.getCloudflareAPIBaseURL'
    )

    return url.replace(/\/$/, '')
  }

  return `https://api.cloudflare.com/client/v4/accounts/${getEnv().CLOUDFLARE_MODELS_ACCOUNT_ID}/ai`
}

function getCloudflareChatCompletionURL(): string {
  return `${getCloudflareAPIBaseURL()}/v1/chat/completions`
}

function getCloudflareRunURL(): string {
  return `${getCloudflareAPIBaseURL()}/run`
}

function getCloudflareHeaders(
  providerOptions?: Record<string, unknown>
): Record<string, string> {
  const gatewayId = getGatewayId(providerOptions)
  const headers = getNestedRecord(providerOptions, 'headers')

  return {
    ...(headers as Record<string, string> | undefined),
    ...(gatewayId && { 'cf-aig-gateway-id': gatewayId }),
  }
}

function getOpenAICompatibleExtra(
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const { providerOptions: _providerOptions, ...rest } = extra || {}

  return rest
}

// --- Language ---

export function createChatCompletion(
  options: Parameters<typeof createOpenAICompatibleChatCompletion>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletion> {
  const providerOptions = options.extra?.providerOptions as
    | Record<string, unknown>
    | undefined

  return createOpenAICompatibleChatCompletion({
    ...options,

    url: getCloudflareChatCompletionURL(),
    authorization: `Bearer ${getCloudflareAPIKey()}`,
    headers: {
      ...getCloudflareHeaders(providerOptions),
      ...options.headers,
    },
    extra: getOpenAICompatibleExtra(options.extra),

    errorPrefix: 'CF_',
  })
}

export function createChatCompletionStream(
  options: Parameters<typeof createOpenAICompatibleChatCompletionStream>[0]
): ReturnType<typeof createOpenAICompatibleChatCompletionStream> {
  const providerOptions = options.extra?.providerOptions as
    | Record<string, unknown>
    | undefined

  return createOpenAICompatibleChatCompletionStream({
    ...options,

    url: getCloudflareChatCompletionURL(),
    authorization: `Bearer ${getCloudflareAPIKey()}`,
    headers: {
      ...getCloudflareHeaders(providerOptions),
      ...options.headers,
    },
    extra: getOpenAICompatibleExtra(options.extra),

    errorPrefix: 'CF_',
  })
}

// --- Shared generation helpers ---

export interface GenerationUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

interface RunModelOptions {
  model: string
  modelOptions?: Record<string, unknown>
  input: Record<string, unknown>
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function getNestedRecord(
  value: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined {
  const item = value?.[key]

  return isRecord(item) ? item : undefined
}

function getGatewayId(modelOptions?: Record<string, unknown>): string | null {
  const gateway = getNestedRecord(modelOptions, 'gateway')

  if (typeof gateway?.id === 'string') {
    return gateway.id
  }

  if (typeof modelOptions?.gatewayId === 'string') {
    return modelOptions.gatewayId
  }

  return null
}

function getProvider(modelOptions?: Record<string, unknown>): string | null {
  if (typeof modelOptions?.provider === 'string') {
    return modelOptions.provider
  }

  return null
}

function getInputOptions(
  modelOptions?: Record<string, unknown>
): Record<string, unknown> {
  const input = getNestedRecord(modelOptions, 'input')

  if (input) {
    return input
  }

  const {
    gateway: _gateway,
    gatewayId: _gatewayId,
    provider: _provider,
    headers: _headers,
    input: _input,
    ...rest
  } = modelOptions || {}

  return rest
}

async function runModel(options: RunModelOptions): Promise<unknown> {
  const { model, modelOptions, input, signal } = options
  const gatewayId = getGatewayId(modelOptions)
  const provider = getProvider(modelOptions)

  const response = await fetchForGeneration(getCloudflareRunURL(), {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${getCloudflareAPIKey()}`,
      'Content-Type': 'application/json',
      ...(gatewayId && { 'cf-aig-gateway-id': gatewayId }),
    },

    body: JSON.stringify({
      model,
      ...(provider && { provider }),
      input: {
        ...getInputOptions(modelOptions),
        ...input,
      },
    }),

    signal,
  })

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix: 'CF_' })
  }

  const data = await response.json()

  if (data?.success === false) {
    const message =
      data.errors?.[0]?.message ||
      data.messages?.[0]?.message ||
      'Cloudflare AI request failed'

    throw new SystemError(message, 'CF_BAD_RESPONSE', { body: data })
  }

  return data
}

function collectGeneratedUrls(value: unknown, keys: string[]): string[] {
  const urls = new Set<string>()

  function visit(item: unknown, parentKey?: string) {
    if (!item) {
      return
    }

    if (typeof item === 'string') {
      if (
        parentKey &&
        keys.includes(parentKey) &&
        (/^https?:\/\//.test(item) || /^data:/.test(item))
      ) {
        urls.add(item)
      }

      return
    }

    if (Array.isArray(item)) {
      for (const entry of item) {
        visit(entry, parentKey)
      }

      return
    }

    if (!isRecord(item)) {
      return
    }

    if (isRecord(item.result)) {
      visit(item.result)
    }

    for (const [key, entry] of Object.entries(item)) {
      if (keys.includes(key) && typeof entry === 'string') {
        urls.add(entry)
      } else if (keys.includes(key) && Array.isArray(entry)) {
        visit(entry, key)
      } else if (key === 'url' && typeof entry === 'string') {
        urls.add(entry)
      } else {
        visit(entry, key)
      }
    }
  }

  visit(value)

  return [...urls]
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

export interface CreateImageResult {
  urls: string[]
  usage: GenerationUsage
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

export interface EditImageResult {
  urls: string[]
  usage: GenerationUsage
}

export async function createImage(
  options: CreateImageOptions
): Promise<CreateImageResult> {
  const { prompt, model, modelOptions, size, signal } = options

  debug(`createImage using`, { prompt, model, modelOptions }).log(
    'cloudflare.createImage'
  )

  const data = await runModel({
    model,
    modelOptions,
    input: {
      prompt,
      ...(size && { size }),
    },
    signal,
  })

  const urls = collectGeneratedUrls(data, ['image', 'images'])

  if (!urls.length) {
    throw new SystemError(
      'Cloudflare image response did not include an image',
      'CF_NO_IMAGE'
    )
  }

  return {
    urls,
    usage: {
      model,
      inputTokens: 0,
      outputTokens: urls.length,
    },
  }
}

export async function editImage(
  options: EditImageOptions
): Promise<EditImageResult> {
  const { prompt, images, model, modelOptions, size, signal } = options
  const imageDataUrls = await Promise.all(images.map(blobToDataUrl))

  const data = await runModel({
    model,
    modelOptions,
    input: {
      prompt,
      images: imageDataUrls,
      ...(size && { size }),
    },
    signal,
  })

  const urls = collectGeneratedUrls(data, ['image', 'images'])

  if (!urls.length) {
    throw new SystemError(
      'Cloudflare image response did not include an image',
      'CF_NO_IMAGE'
    )
  }

  return {
    urls,
    usage: {
      model,
      inputTokens: images.length,
      outputTokens: urls.length,
    },
  }
}

// --- Video ---

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
  usage: GenerationUsage
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
  usage: GenerationUsage
}

const createSeedanceVideoInputSchema = (
  resolutions: [string, string, ...string[]]
) =>
  z
    .object({
      prompt: z.string().max(2000),
      duration: z.number().int().min(4).max(12),
      resolution: z.enum(resolutions).optional(),
      aspect_ratio: z
        .enum(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', '9:21'])
        .optional(),
      fps: z.literal(24).optional(),
      camera_fixed: z.boolean().optional(),
      generate_audio: z.boolean().optional(),
      watermark: z.boolean().optional(),
      seed: z.number().int().optional(),
      image: z.string().optional(),
      last_frame_image: z.string().optional(),
      reference_images: z.array(z.string()).max(4).optional(),
      reference_video: z.string().optional(),
      use_virtual_avatar: z.boolean().optional(),
    })
    .strict()

const seedanceVideoInputSchema = createSeedanceVideoInputSchema([
  '480p',
  '720p',
  '1080p',
  '4k',
])

const seedanceFastVideoInputSchema = createSeedanceVideoInputSchema([
  '480p',
  '720p',
])

const seedanceVideoOutputSchema = z
  .object({
    video: z.string().url(),
  })
  .strict()

export const cloudflareRunInputSchemas = {
  'bytedance/seedance-2.0': seedanceVideoInputSchema,
  'bytedance/seedance-2.0-fast': seedanceFastVideoInputSchema,
} as const satisfies Record<string, z.ZodTypeAny>

export const cloudflareRunOutputSchemas = {
  'bytedance/seedance-2.0': seedanceVideoOutputSchema,
  'bytedance/seedance-2.0-fast': seedanceVideoOutputSchema,
} as const satisfies Record<string, z.ZodTypeAny>

type CloudflareVideoModelInput = z.input<typeof seedanceVideoInputSchema>

function getVideoInput(
  options: CreateVideoOptions | EditVideoOptions
): CloudflareVideoModelInput {
  const frames = 'frames' in options ? options.frames : undefined

  const startFrame = frames?.[0]
  const lastFrame = frames?.[1]

  // Resolution/aspect ratio originate from validated model config, so narrow
  // the plain strings to the schema's enums at the boundary.
  type Resolution = NonNullable<CloudflareVideoModelInput['resolution']>
  type AspectRatio = NonNullable<CloudflareVideoModelInput['aspect_ratio']>

  const input: CloudflareVideoModelInput = {
    prompt: options.prompt,
    duration: options.duration,
  }

  if (options.aspectRatio) {
    input.aspect_ratio = options.aspectRatio as AspectRatio
  }

  if (options.resolution) {
    input.resolution = options.resolution as Resolution
  }

  if (typeof options.seed === 'number') {
    input.seed = options.seed
  }

  // Pass frames through as-is: the schema accepts a URL or a base64 data URI.
  if (startFrame) {
    input.image = startFrame
  }

  // last_frame_image only takes effect alongside a start frame.
  if (startFrame && lastFrame) {
    input.last_frame_image = lastFrame
  }

  return input
}

async function submitVideo(
  options: CreateVideoOptions | EditVideoOptions
): Promise<CreateVideoResult> {
  const { model, modelOptions, duration, signal } = options

  if ('videos' in options && options.videos.length) {
    throw new UserInputError(
      'Cloudflare video editing currently supports image frames only'
    )
  }

  const data = await runModel({
    model,
    modelOptions,
    input: getVideoInput(options),
    signal,
  })

  const urls = collectGeneratedUrls(data, ['video', 'videos'])

  if (!urls.length) {
    throw new SystemError(
      'Cloudflare video response did not include a video',
      'CF_NO_VIDEO'
    )
  }

  return {
    urls,
    usage: {
      model,
      inputTokens: 0,
      outputTokens: duration * urls.length,
    },
  }
}

export async function createVideo(
  options: CreateVideoOptions
): Promise<CreateVideoResult> {
  return submitVideo(options)
}

export async function editVideo(
  options: EditVideoOptions
): Promise<EditVideoResult> {
  return submitVideo(options)
}
