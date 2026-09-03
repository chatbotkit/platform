import { ephemeralUrlPattern } from '@/lib/storage'

/**
 * This function performs several markup normalization operations such as
 * removing URLs to temporary resources like S3, removing empty anchors, etc.
 *
 * @note which URLs expire is the storage module's knowledge, not this file's.
 * The pattern used to be hardcoded here as `amazonaws.com` plus `X-Amz-Expires`,
 * which would have silently stopped matching the first time a deployment
 * changed storage backend - the dead links would still have been written into
 * conversations, just no longer recognised as dead.
 */
export function normalizeMarkup(input: string): string {
  const pattern = ephemeralUrlPattern.source

  // remove temp anchors

  input = input.replace(new RegExp(`!?\\[\\S*?\\]\\(${pattern}\\)`, 'g'), '')

  // remove temp urls

  input = input.replace(new RegExp(pattern, 'g'), '')

  // remove empty anchors

  input = input.replace(/!\[\s*?\]\(\s*?\)/g, '')

  // return what is left

  return input
}
