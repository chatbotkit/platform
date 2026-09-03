import {
  canChunkContentType as canChunkContentTypeLocal,
  chunk as chunkLocal,
} from '@chatbotkit-dev/file'

import debug, { assert } from '@/lib/debug'
import {
  chunkFile as chunkFileRemote,
  chunkText as chunkTextRemote,
  chunkUrl as chunkUrlRemote,
} from '@/lib/dsd'
import fetch from '@/lib/egress.fetch'
import { getUrlContentType } from '@/lib/url3'

export interface ChunkOptions {
  model?: string
  size?: number
  overlap?: number
  separators?: string[]
  defaults?: boolean
  callback?: string
  userId?: string
}

export interface ChunkResult {
  items: Array<{
    text: string
    meta: Record<string, unknown>
  }>
  request: ChunkOptions
}

/**
 * Split a text into chunks. We use json data to send the text.
 *
 * @deprecated use dsd2
 */
export async function chunkText(
  options: {
    text: string
    type: string
  } & ChunkOptions
): Promise<ChunkResult> {
  // @note the api will fail otherwise

  assert(options.text.length > 0, 'blob size must be greater than 0')
  assert(options.type, 'blob type must be set')

  const contentType = options.type

  if (canChunkContentTypeLocal(contentType)) {
    debug(`using local chunk/text`, {
      options,
    }).log('dsd.chunkText')

    const items: Array<{
      text: string
      meta: Record<string, unknown>
    }> = []

    for await (const chunk of chunkLocal(
      new Blob([options.text], {
        type: contentType,
      }),
      options
    )) {
      items.push({
        text: chunk.text,
        meta: chunk.meta,
      })
    }

    return { items, request: options }
  } else {
    return chunkTextRemote(options)
  }
}

/**
 * Split response of a URL to chunks. We use json data to send the URL.
 *
 * @deprecated use dsd2
 */
export async function chunkUrl(
  options: {
    url: string
  } & ChunkOptions
): Promise<ChunkResult> {
  debug(`chunkUrl`, {
    options,
  }).log('dsd.chunkUrl')

  const contentType = await getUrlContentType(options.url)

  if (contentType && canChunkContentTypeLocal(contentType)) {
    debug(`using local chunk/url`, {
      options,
    }).log('dsd.chunkUrl')

    const items: Array<{
      text: string
      meta: Record<string, unknown>
    }> = []

    const response = await fetch(options.url)

    if (response.ok) {
      for await (const chunk of chunkLocal(await response.blob(), options)) {
        items.push({
          text: chunk.text,
          meta: chunk.meta,
        })
      }
    }

    return { items, request: options }
  } else {
    return chunkUrlRemote(options)
  }
}

/**
 * Split a text file into chunks. We use data to upload the file.
 *
 * @deprecated use dsd2
 */
export async function chunkFile(
  blob: Blob,
  options: ChunkOptions
): Promise<ChunkResult> {
  // @note the api will fail otherwise

  assert(blob.size > 0, 'blob size must be greater than 0')
  assert(blob.type, 'blob type must be set')

  debug(`chunk file`, {
    type: blob.type,
    options,
  }).log('dsd.chunkFile')

  if (canChunkContentTypeLocal(blob.type)) {
    debug(`using local chunk/file`, {
      blob,
      options,
    }).log('dsd.chunkFile')

    const items: Array<{
      text: string
      meta: Record<string, unknown>
    }> = []

    for await (const chunk of chunkLocal(blob, options)) {
      items.push({
        text: chunk.text,
        meta: chunk.meta,
      })
    }

    return { items, request: options }
  } else {
    return chunkFileRemote(blob, options)
  }
}
