// @note this module previously depended on the Python service at
// deafening-scary-death.fly.dev which has been archived. All functionality
// is now provided by dsd2.js via the local auxiliary chunk API.
import * as dsd2 from '@/lib/dsd2'

/**
 * Options for chunking operations.
 */
export interface ChunkOptions {
  model?: string
  size?: number
  overlap?: number
  separators?: string[]
  defaults?: boolean
  callback?: string
  userId?: string
}

/**
 * A single chunk item with its text content and metadata.
 */
export interface ChunkItem {
  text: string
  meta: Record<string, unknown>
}

/**
 * Result of a chunking operation.
 */
export interface ChunkResult {
  items: ChunkItem[]
  request: ChunkOptions
}

/**
 * Options for chunking text content.
 */
export interface ChunkTextOptions extends ChunkOptions {
  text: string
  type: string
}

/**
 * Options for chunking URL content.
 */
export interface ChunkUrlOptions extends ChunkOptions {
  url: string
}

/**
 * Split a text into chunks.
 */
export async function chunkText(options: ChunkTextOptions): Promise<ChunkResult> {
  const { text, type, ...chunkOptions } = options
  const textObj = { text, type }

  return await dsd2.chunkText(textObj, chunkOptions)
}

/**
 * Split response of a URL to chunks.
 */
export async function chunkUrl(options: ChunkUrlOptions): Promise<ChunkResult> {
  const { url, ...chunkOptions } = options
  const urlObj = new URL(url)

  return await dsd2.chunkUrl(urlObj, chunkOptions)
}

/**
 * Split a text file into chunks.
 */
export async function chunkFile(blob: Blob, options: ChunkOptions): Promise<ChunkResult> {
  return await dsd2.chunkFile(blob, options)
}
