import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { defaultImageModel } from '@/config/models'

import { parseDataURL } from '@/lib/dataurl.parse'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { getExternalHostURL } from '@/lib/host'
import {
  createImage as createCloudflareImage,
  editImage as editCloudflareImage,
} from '@/lib/model.provider.cloudflare.adaptor'
import {
  createImage as createOpenAIImage,
  editImage as editOpenAIImage,
} from '@/lib/model.provider.openai'
import {
  createImage as createOpenRouterImage,
  editImage as editOpenRouterImage,
} from '@/lib/model.provider.openrouter.adaptor'
import {
  createImage as createVercelImage,
  editImage as editVercelImage,
} from '@/lib/model.provider.vercel.adaptor'
import { parseAndRevealImageModel } from '@/lib/model.utils'
import { getObject, putObject } from '@/lib/storage'

import { v1 as uuidv1 } from 'uuid'
interface ImageUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

interface CreateImageOptions {
  model?: string
  user?: string
  signal?: AbortSignal
}

interface EditImageOptions {
  model?: string
  user?: string
  mask?: Blob
  signal?: AbortSignal
}

interface ImageResult {
  urls: string[]
  usage: ImageUsage
}

interface StoredImage {
  data: Uint8Array
  type: string
}

function getImageObjectKey(imageId: string): string {
  return `${imageId}/original`
}

async function downloadImageURL(url: string): Promise<StoredImage> {
  if (url.startsWith('data:')) {
    const { data, type } = parseDataURL(url)

    return { data, type }
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}`)
  }

  const data = new Uint8Array(await response.arrayBuffer())
  const type =
    response.headers.get('content-type')?.split(';')[0]?.trim() ||
    'application/octet-stream'

  return { data, type }
}

export async function storeImageURL(url: string): Promise<string> {
  const imageId = uuidv1()

  const { data, type } = await downloadImageURL(url)

  await putObject('image', getImageObjectKey(imageId), data, {
    contentType: type,
  })

  return imageId
}

export async function retrieveImage(
  imageId: string
): Promise<StoredImage | null> {
  try {
    const response = await getObject(
      'image',
      getImageObjectKey(imageId)
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

export async function proxyImageURL(url: string): Promise<string> {
  const imageId = await storeImageURL(url)

  const proxyURL = new URL(
    `/api/v1/image/${imageId}/download`,
    getExternalHostURL()
  )

  return proxyURL.toString()
}

export async function createImage(
  prompt: string,
  options?: CreateImageOptions
): Promise<ImageResult> {
  debug(`creating image`, { prompt, options })

  const { model = defaultImageModel, user, signal } = options || {}

  const { name, config } = parseAndRevealImageModel(model)

  // @note use providerModel if set on the model config - this holds the exact
  // identifier the provider API expects, same as language model adaptors do
  const resolvedModel = config.providerModel || name

  const provider = config.provider

  const urls: string[] = []

  let usage: ImageUsage

  // @todo maybe move this elsewhere

  prompt = prompt.slice(0, 1000) // @see https://platform.openai.com/docs/api-reference/images/create

  switch (provider) {
    case 'openai': {
      const result = await createOpenAIImage({
        ...config,

        model: resolvedModel,

        prompt,
        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    case 'openrouter': {
      const result = await createOpenRouterImage({
        ...config,

        // @note we need the original model name to resolve providerOptions from
        // the config
        model: name,

        prompt,
        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    case 'vercel': {
      const result = await createVercelImage({
        ...config,

        // @note we need the original model name to resolve providerOptions from
        // the config
        model: name,

        prompt,
        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    case 'cloudflare': {
      const result = await createCloudflareImage({
        ...config,

        model: name,

        prompt,
        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    default: {
      assertUnreachable(provider)
    }
  }

  return {
    urls: await Promise.all(urls.map((url) => proxyImageURL(url))),

    // @note override usage.model with the platform name - providers echo back
    // the providerModel (e.g. 'google/gemini-3.1-flash-image-preview') but
    // callers like recordImageTokenUsage need the platform key to resolve UseType
    usage: { ...usage, model: name },
  }
}

export async function editImage(
  prompt: string,
  images: Blob[],
  options?: EditImageOptions
): Promise<ImageResult> {
  debug(`edit image`, { prompt, images, options })

  const { model = 'gpt-image-1', user, mask, signal } = options || {}

  const { name, config } = parseAndRevealImageModel(model)

  // @note use providerModel if set on the model config - this holds the exact
  // identifier the provider API expects, same as language model adaptors do
  const resolvedModel = config.providerModel || name

  const provider = config.provider

  const urls: string[] = []

  let usage: ImageUsage

  // @todo maybe move this elsewhere

  prompt = prompt.slice(0, 1000) // @see https://platform.openai.com/docs/api-reference/images/create

  switch (provider) {
    case 'openai': {
      const result = await editOpenAIImage({
        ...config,

        model: resolvedModel,

        prompt,

        images,

        mask,

        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    case 'openrouter': {
      const result = await editOpenRouterImage({
        ...config,

        // @note we need the original model name to resolve providerOptions from
        // the config
        model: name,

        prompt,

        images,

        mask,

        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    case 'vercel': {
      const result = await editVercelImage({
        ...config,

        // @note we need the original model name to resolve providerOptions from
        // the config
        model: name,

        prompt,

        images,

        mask,

        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    case 'cloudflare': {
      const result = await editCloudflareImage({
        ...config,

        model: name,

        prompt,
        images,
        mask,
        user,
        signal,
      })

      urls.push(...result.urls)

      usage = {
        ...result.usage,
      }

      break
    }

    default: {
      assertUnreachable(provider)
    }
  }

  return {
    urls: await Promise.all(urls.map((url) => proxyImageURL(url))),

    // @note override usage.model with the platform name - providers echo back
    // the providerModel (e.g. 'google/gemini-3.1-flash-image-preview') but
    // callers like recordImageTokenUsage need the platform key to resolve UseType
    usage: { ...usage, model: name },
  }
}
