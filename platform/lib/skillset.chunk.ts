import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import memcache from '@/lib/memcache'

/**
 * Default token threshold for large responses.
 * Responses exceeding this threshold will be chunked.
 */
export const LARGE_RESPONSE_TOKEN_THRESHOLD = 10_000

/**
 * Default TTL for stored chunks (15 minutes).
 */
export const CHUNK_TTL_SECONDS = QUARTER_HOUR_IN_SECONDS

/**
 * Default chunk size in characters.
 * This is a reasonable size that balances context efficiency with granularity.
 */
export const DEFAULT_CHUNK_SIZE = 8_000

/**
 * Maximum number of characters for the preview.
 */
export const PREVIEW_MAX_LENGTH = 500

/**
 * Represents a stored chunk of data.
 */
export interface StoredChunk {
  id: string
  index: number
  total: number
  content: string
  createdAt: string
}

/**
 * Represents the metadata returned to the LLM when a response is chunked.
 */
export interface ChunkedResponseMetadata {
  isChunked: true
  totalChunks: number
  totalLength: number
  preview: string
  chunks: Array<{
    id: string
    index: number
    length: number
  }>
}

/**
 * Redis key prefix for skillset chunks.
 */
const CHUNK_KEY_PREFIX = 'skillset:chunk:'

/**
 * Generates a Redis key for a chunk.
 */
function getChunkKey(chunkId: string): string {
  return `${CHUNK_KEY_PREFIX}${chunkId}`
}

/**
 * Splits content into chunks of the specified size.
 *
 * @param content - The content to split
 * @param chunkSize - Maximum size of each chunk in characters
 * @returns Array of content strings
 */
export function splitIntoChunks(
  content: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): string[] {
  debug('splitting content into chunks', {
    contentLength: content.length,
    chunkSize,
  }).log('skillset.chunk.splitIntoChunks')

  const chunks: string[] = []
  let offset = 0

  while (offset < content.length) {
    chunks.push(content.slice(offset, offset + chunkSize))
    offset += chunkSize
  }

  debug('split complete', { numChunks: chunks.length }).log(
    'skillset.chunk.splitIntoChunks'
  )

  return chunks
}

/**
 * Stores chunks of content in Redis and returns metadata for the LLM.
 *
 * @param content - The large content to store
 * @param options - Optional configuration
 * @returns Metadata about the stored chunks
 */
export async function storeChunkedResponse(
  content: string,
  options?: {
    chunkSize?: number
    ttl?: number
  }
): Promise<ChunkedResponseMetadata> {
  debug('storing chunked response', {
    contentLength: content.length,
    options,
  }).log('skillset.chunk.storeChunkedResponse')

  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE
  const ttl = options?.ttl ?? CHUNK_TTL_SECONDS

  const contentChunks = splitIntoChunks(content, chunkSize)
  const totalChunks = contentChunks.length

  const storedChunks: Array<{ id: string; index: number; length: number }> = []

  for (let i = 0; i < contentChunks.length; i++) {
    const chunkId = cuid()
    const chunkContent = contentChunks[i]

    const storedChunk: StoredChunk = {
      id: chunkId,
      index: i,
      total: totalChunks,
      content: chunkContent,
      createdAt: new Date().toISOString(),
    }

    await memcache.set(getChunkKey(chunkId), storedChunk, { ex: ttl })

    storedChunks.push({
      id: chunkId,
      index: i,
      length: chunkContent.length,
    })

    debug('stored chunk', {
      chunkId,
      index: i,
      length: chunkContent.length,
    }).log('skillset.chunk.storeChunkedResponse')
  }

  // @note generate preview from the first PREVIEW_MAX_LENGTH characters,
  // adding ellipsis if the content is truncated
  const preview =
    content.slice(0, PREVIEW_MAX_LENGTH) +
    (content.length > PREVIEW_MAX_LENGTH ? '...' : '')

  const metadata: ChunkedResponseMetadata = {
    isChunked: true,
    totalChunks,
    totalLength: content.length,
    preview,
    chunks: storedChunks,
  }

  debug('chunked response metadata', { metadata }).log(
    'skillset.chunk.storeChunkedResponse'
  )

  return metadata
}

/**
 * Retrieves a chunk from Redis by its ID.
 *
 * @param chunkId - The ID of the chunk to retrieve
 * @returns The chunk content, or null if not found or expired
 */
export async function getChunk(chunkId: string): Promise<StoredChunk | null> {
  debug('getting chunk', { chunkId }).log('skillset.chunk.getChunk')

  const chunk = await memcache.get<StoredChunk>(getChunkKey(chunkId))

  if (!chunk) {
    debug('chunk not found or expired', { chunkId }).log(
      'skillset.chunk.getChunk'
    )

    return null
  }

  debug('chunk retrieved', {
    chunkId,
    index: chunk.index,
    total: chunk.total,
  }).log('skillset.chunk.getChunk')

  return chunk
}

/**
 * Retrieves the content of a chunk by its ID.
 *
 * @param chunkId - The ID of the chunk to retrieve
 * @returns The chunk content string, or null if not found
 */
export async function getChunkContent(chunkId: string): Promise<string | null> {
  const chunk = await getChunk(chunkId)

  return chunk?.content ?? null
}

/**
 * Deletes a chunk from Redis.
 *
 * @param chunkId - The ID of the chunk to delete
 */
export async function deleteChunk(chunkId: string): Promise<void> {
  debug('deleting chunk', { chunkId }).log('skillset.chunk.deleteChunk')
  await memcache.del(getChunkKey(chunkId))
}
