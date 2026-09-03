import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { defaultVideoModel } from '@/config/models'

import { parseDataURL } from '@/lib/dataurl.parse'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import fetch from '@/lib/egress.fetch'
import { getExternalHostURL } from '@/lib/host'
import {
  createVideo as createCloudflareVideo,
  editVideo as editCloudflareVideo,
} from '@/lib/model.provider.cloudflare.adaptor'
import {
  createVideo as createVercelVideo,
  editVideo as editVercelVideo,
} from '@/lib/model.provider.vercel.adaptor'
import { parseAndRevealVideoModel } from '@/lib/model.utils'
import { getObject, putObject } from '@/lib/storage'

import { v1 as uuidv1 } from 'uuid'
interface VideoUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

interface CreateVideoOptions {
  model?: string
  n?: number
  aspectRatio?: string
  resolution?: string
  duration?: number
  fps?: number
  seed?: number
  user?: string
  signal?: AbortSignal
}

interface EditVideoOptions {
  model?: string
  frames?: string[]
  audios?: string[]
  n?: number
  aspectRatio?: string
  resolution?: string
  duration?: number
  fps?: number
  seed?: number
  user?: string
  signal?: AbortSignal
}

interface VideoResult {
  urls: string[]
  usage: VideoUsage
}

interface StoredVideo {
  data: Uint8Array
  type: string
}

function getVideoObjectKey(videoId: string): string {
  return `${videoId}/original`
}

async function downloadVideoURL(url: string): Promise<StoredVideo> {
  if (url.startsWith('data:')) {
    const { data, type } = parseDataURL(url)

    return { data, type }
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch video from ${url}`)
  }

  const data = new Uint8Array(await response.arrayBuffer())
  const type =
    response.headers.get('content-type')?.split(';')[0]?.trim() ||
    'application/octet-stream'

  return { data, type }
}

async function storeVideo(video: StoredVideo): Promise<string> {
  const videoId = uuidv1()

  await putObject(
    'video',
    getVideoObjectKey(videoId),
    video.data,
    {
      contentType: video.type,
    }
  )

  return videoId
}

export async function storeVideoURL(url: string): Promise<string> {
  return storeVideo(await downloadVideoURL(url))
}

export async function retrieveVideo(
  videoId: string
): Promise<StoredVideo | null> {
  try {
    const response = await getObject(
      'video',
      getVideoObjectKey(videoId)
    )

    const { body } = response

    if (!body) {
      return null
    }

    return {
      data: new Uint8Array(await body.arrayBuffer()),
      type: response.contentType || 'application/octet-stream',
    }
  } catch {
    return null
  }
}

export async function proxyVideoURL(url: string): Promise<string> {
  const videoId = await storeVideoURL(url)

  const proxyURL = new URL(
    `/api/v1/video/${videoId}/download`,
    getExternalHostURL()
  )

  return proxyURL.toString()
}

function getVideoOptions(
  config: Record<string, unknown>,
  options: CreateVideoOptions
): {
  duration: number
  n?: number
  aspectRatio?: string
  resolution?: string
  fps?: number
  seed?: number
} {
  const videoOptions = {
    n: options.n ?? (config.n as number | undefined),
    aspectRatio:
      options.aspectRatio ?? (config.aspectRatio as string | undefined),
    resolution: options.resolution ?? (config.resolution as string | undefined),
    duration: options.duration ?? (config.duration as number | undefined),
    fps: options.fps ?? (config.fps as number | undefined),
    seed: options.seed ?? (config.seed as number | undefined),
  }

  const availableAspectRatios = config.availableAspectRatios as
    | string[]
    | undefined
  const availableResolutions = config.availableResolutions as
    | string[]
    | undefined
  const availableDurations = config.availableDurations as number[] | undefined

  if (typeof videoOptions.duration !== 'number') {
    throw new UserInputError('Video duration is required')
  }

  if (
    videoOptions.aspectRatio &&
    availableAspectRatios &&
    !availableAspectRatios.includes(videoOptions.aspectRatio)
  ) {
    throw new UserInputError(
      `Unsupported aspect ratio '${videoOptions.aspectRatio}'. Supported aspect ratios are: ${availableAspectRatios.join(', ')}`
    )
  }

  if (
    videoOptions.resolution &&
    availableResolutions &&
    !availableResolutions.includes(videoOptions.resolution)
  ) {
    throw new UserInputError(
      `Unsupported resolution '${videoOptions.resolution}'. Supported resolutions are: ${availableResolutions.join(', ')}`
    )
  }

  if (
    videoOptions.duration &&
    availableDurations &&
    !availableDurations.includes(videoOptions.duration)
  ) {
    throw new UserInputError(
      `Unsupported duration '${videoOptions.duration}'. Supported durations are: ${availableDurations.join(', ')}`
    )
  }

  if (
    videoOptions.fps &&
    typeof config.fps === 'number' &&
    videoOptions.fps !== config.fps
  ) {
    throw new UserInputError(`Unsupported fps '${videoOptions.fps}'`)
  }

  return {
    ...videoOptions,

    duration: videoOptions.duration,
  }
}

export async function createVideo(
  prompt: string,
  options?: CreateVideoOptions
): Promise<VideoResult> {
  debug(`creating video`, { prompt, options })

  const { model = defaultVideoModel, user, signal } = options || {}

  const { name, config } = parseAndRevealVideoModel(model)

  const provider = config.provider

  let usage: VideoUsage
  let urls: string[]

  prompt = prompt.slice(0, 1000)

  switch (provider) {
    case 'vercel': {
      const result = await createVercelVideo({
        ...config,

        model: name,

        prompt,

        ...getVideoOptions(config, options || {}),

        user,
        signal,
      })

      urls = result.urls
      usage = result.usage

      break
    }

    case 'cloudflare': {
      const result = await createCloudflareVideo({
        ...config,

        model: name,

        prompt,

        ...getVideoOptions(config, options || {}),

        user,
        signal,
      })

      urls = result.urls
      usage = result.usage

      break
    }

    default: {
      assertUnreachable(provider)
    }
  }

  return {
    urls: await Promise.all(urls.map((url) => proxyVideoURL(url))),
    usage: { ...usage, model: name },
  }
}

export async function editVideo(
  prompt: string,
  videos: string[],
  options?: EditVideoOptions
): Promise<VideoResult> {
  debug(`editing video`, { prompt, videos, options })

  if (videos.length > 1) {
    throw new Error('At most one video is supported for video editing')
  }

  if ((options?.frames?.length || 0) > 2) {
    throw new Error('At most two frames are supported for video editing')
  }

  if ((options?.audios?.length || 0) > 1) {
    throw new Error('At most one audio is supported for video editing')
  }

  if (
    videos.length === 0 &&
    (options?.frames?.length || 0) === 0 &&
    (options?.audios?.length || 0) === 0
  ) {
    throw new Error('At least one video, frame, or audio is required')
  }

  const { model = 'grok-imagine-video', user, signal } = options || {}

  const { name, config } = parseAndRevealVideoModel(model)

  const provider = config.provider

  let usage: VideoUsage
  let urls: string[]

  prompt = prompt.slice(0, 1000)

  switch (provider) {
    case 'vercel': {
      const result = await editVercelVideo({
        ...config,

        model: name,

        prompt,
        videos,

        frames: options?.frames,
        audios: options?.audios,

        ...getVideoOptions(config, options || {}),

        user,
        signal,
      })

      urls = result.urls
      usage = result.usage

      break
    }

    case 'cloudflare': {
      const result = await editCloudflareVideo({
        ...config,

        model: name,

        prompt,
        videos,

        frames: options?.frames,
        audios: options?.audios,

        ...getVideoOptions(config, options || {}),

        user,
        signal,
      })

      urls = result.urls
      usage = result.usage

      break
    }

    default: {
      assertUnreachable(provider)
    }
  }

  return {
    urls: await Promise.all(urls.map((url) => proxyVideoURL(url))),
    usage: { ...usage, model: name },
  }
}
