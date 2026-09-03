import { getSupportedContentTypes } from '@chatbotkit-dev/file/support'
import {
  FIVE_MINUTE_IN_MILLISECONDS,
  ONE_MINUTE_IN_SECONDS,
} from '@chatbotkit-dev/time'

import { getContextUser } from '@/lib/context.store'
import { blobToDataUrl } from '@/lib/dataurl.blob'
import debug, { assert } from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import _fetch, { withRetry, withTimeout } from '@/lib/fetch'
import { getLocalAPIHostURL } from '@/lib/host'
import { getTemporaryUserToken } from '@/lib/session.temp'
import { uploadTempBlob } from '@/lib/temp.file'

export const DEFAULT_CHUNK_SIZE = 512 // @todo use defaults from library
export const DEFAULT_CHUNK_OVERLAP = 16 // @todo use defaults from library

const fetch = withRetry(
  // @note this is pretty exotic configuration but some of these tasks can tak
  // a long time to complete so we want to give them enough time to finish

  withTimeout(_fetch, { timeout: FIVE_MINUTE_IN_MILLISECONDS }),
  {
    retries: 2,
    retryDelay: 250,
    retryTimeout: true,
  }
)

/**
 * API error. Represents an unexpected failure from the chunking service.
 */
class APIError extends Error {
  constructor(message: string) {
    super(message)

    this.name = 'APIError'
  }
}

/**
 * Convert a non-ok response into the most appropriate error.
 *
 * The chunking endpoint reports errors as { message, code }. An unsupported
 * content type is an expected user error (the user pointed us at a file or url
 * we cannot chunk) so we surface it as a UserInputError, which the ability layer
 * relays back to the model gracefully instead of capturing it to Sentry as a
 * system fault. Anything else remains an APIError.
 */
async function errorFromResponse(response: Response): Promise<Error> {
  const text = await response.text()

  let message = text

  try {
    const json: unknown = JSON.parse(text)

    if (
      json &&
      typeof json === 'object' &&
      typeof (json as { message?: unknown }).message === 'string'
    ) {
      message = (json as { message: string }).message
    }
  } catch {
    // @note non-json body - fall back to the raw text
  }

  if (message.startsWith('Unsupported content type')) {
    return new UserInputError(message)
  }

  return new APIError(message)
}

export interface ChunkOptions {
  model?: string
  size?: number
  overlap?: number
  separators?: string[]
  defaults?: boolean
  callback?: string

  // @note the user on whose behalf the chunker is invoked; falls back to the
  // request context user when not provided explicitly
  userId?: string
}

/**
 * Builds the headers for a call to the auxiliary chunk API.
 *
 * The chunk route requires an authenticated platform session like every other
 * auxiliary route, so server-side callers authenticate with a short-lived
 * temporary user token minted for the acting user.
 *
 * @throws {Error} When no acting user can be determined
 */
async function getChunkRequestHeaders(
  options?: ChunkOptions
): Promise<Record<string, string>> {
  const userId = options?.userId || getContextUser()?.id

  if (!userId) {
    throw new Error('Unable to determine the acting user for chunking')
  }

  return {
    Authorization: `Bearer ${await getTemporaryUserToken(userId, {
      durationInSeconds: ONE_MINUTE_IN_SECONDS,
    })}`,
    'Content-Type': 'application/json',
  }
}

export interface ChunkResultItem {
  text: string
  meta: Record<string, unknown>
}

export interface ChunkResult {
  items: ChunkResultItem[]
  request: ChunkOptions
}

export interface TextInput {
  text: string
  type: string
}

/**
 * Split a text into chunks. We use json data to send the text.
 */
export async function chunkText(
  text: TextInput,
  options?: ChunkOptions
): Promise<ChunkResult> {
  // @note the api will fail otherwise
  {
    assert(text.text.length > 0, 'blob size must be greater than 0')
    assert(text.type, 'blob type must be set')
  }

  debug(`chunkText`, {
    type: text.type,
    options: options,
  }).log('dsd.chunkText')

  if (
    !getSupportedContentTypes({ experimental: true }).includes(
      text.type as ReturnType<typeof getSupportedContentTypes>[number]
    )
  ) {
    throw new UserInputError(`Unsupported content type ${text.type}`)
  }

  const url = new URL(getLocalAPIHostURL('/api/auxiliary/dataset/chunk'))

  debug(`calling remote chunk/text`, {
    url,
    options,
  }).log('dsd.chunkText')

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: await getChunkRequestHeaders(options),
    body: JSON.stringify({
      file: await blobToDataUrl(new Blob([text.text], { type: text.type })),
      size: Math.min(
        options?.size || DEFAULT_CHUNK_SIZE,
        Number.MAX_SAFE_INTEGER
      ),
      overlap: Math.min(
        options?.overlap || DEFAULT_CHUNK_OVERLAP,
        Number.MAX_SAFE_INTEGER
      ),
      separators: options?.separators,
      model: options?.model,
    }),
  })

  if (!response.ok) {
    throw await errorFromResponse(response)
  }

  const result = await response.json()

  return result
}

/**
 * Split response of a URL to chunks. We use json data to send the URL.
 */
export async function chunkUrl(
  url: URL,
  options?: ChunkOptions
): Promise<ChunkResult> {
  debug(`chunkUrl`, {
    url: url.href,
    options: options,
  }).log('dsd.chunkUrl')

  const auxUrl = new URL(getLocalAPIHostURL('/api/auxiliary/dataset/chunk'))

  debug(`calling chunk/url`, {
    auxUrl,
    options,
  }).log('dsd.chunkUrl')

  const response = await fetch(auxUrl.toString(), {
    method: 'POST',
    headers: await getChunkRequestHeaders(options),
    body: JSON.stringify({
      file: url.href,
      size: Math.min(
        options?.size || DEFAULT_CHUNK_SIZE,
        Number.MAX_SAFE_INTEGER
      ),
      overlap: Math.min(
        options?.overlap || DEFAULT_CHUNK_OVERLAP,
        Number.MAX_SAFE_INTEGER
      ),
      separators: options?.separators,
      model: options?.model,
    }),
  })

  if (!response.ok) {
    throw await errorFromResponse(response)
  }

  const result = await response.json()

  return result
}

/**
 * Split a text file into chunks. We use data to upload the file.
 */
export async function chunkFile(
  blob: Blob,
  options?: ChunkOptions
): Promise<ChunkResult> {
  // @note the api will fail otherwise
  {
    assert(blob.size > 0, 'blob size must be greater than 0')
    assert(blob.type, 'blob type must be set')
  }

  debug(`chunk file`, {
    type: blob.type,
    options: options,
  }).log('dsd.chunkFile')

  if (
    !getSupportedContentTypes({ experimental: true }).includes(
      blob.type as ReturnType<typeof getSupportedContentTypes>[number]
    )
  ) {
    throw new UserInputError(`Unsupported content type ${blob.type}`)
  }

  debug(`uploading blob to temp`).log('dsd.chunkFile')

  const downloadUrl = await uploadTempBlob(blob, {
    maxSize: Infinity, // @todo use the real limit
  })

  debug(`uploaded blob to temp`, {
    downloadUrl,
  }).log('dsd.chunkFile')

  const auxUrl = new URL(getLocalAPIHostURL('/api/auxiliary/dataset/chunk'))

  debug(`calling chunk/file`, {
    auxUrl,
    blob,
    options,
  }).log('dsd.chunkFile')

  const response = await fetch(auxUrl.toString(), {
    method: 'POST',
    headers: await getChunkRequestHeaders(options),
    body: JSON.stringify({
      file: downloadUrl.href,
      size: Math.min(
        options?.size || DEFAULT_CHUNK_SIZE,
        Number.MAX_SAFE_INTEGER
      ),
      overlap: Math.min(
        options?.overlap || DEFAULT_CHUNK_OVERLAP,
        Number.MAX_SAFE_INTEGER
      ),
      separators: options?.separators,
      model: options?.model,
    }),
  })

  if (!response.ok) {
    throw await errorFromResponse(response)
  }

  const result = await response.json()

  return result
}

/**
 * Check if a content type is supported.
 */
export function isSupportedContentType(type: string): boolean {
  return getSupportedContentTypes({ experimental: true }).includes(
    type as ReturnType<typeof getSupportedContentTypes>[number]
  )
}
