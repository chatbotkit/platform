import { ONE_MONTH_IN_SECONDS } from '@chatbotkit-dev/time'

import { getExternalFrontendHostURL, getExternalHostURL } from '@/lib/host'
import memcache from '@/lib/memcache'

import { v5 as uuidv5 } from 'uuid'

export const DEFAULT_EXPIRES_IN_SECONDS = ONE_MONTH_IN_SECONDS

/**
 * Generates a short ID for a URL using UUID v5
 */
export async function getShortId(url: string): Promise<string> {
  // @todo make a shorter hash function for URLs

  const shortId = uuidv5(url, '5036d8c0-a039-4201-8934-c164eab05983')

  return shortId
}

/**
 * Stores a URL in Redis and returns its short ID
 */
export async function storeShortURL(url: string): Promise<string> {
  const shortId = await getShortId(url)

  const key = `short:${shortId}`

  await memcache.set(key, url)

  return shortId
}

/**
 * Stores a URL temporarily in Redis (1 hour expiration) and returns its short ID
 */
export async function storeTempShortURL(
  url: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS
): Promise<string> {
  const shortId = await getShortId(url)

  const key = `short:${shortId}`

  await memcache.set(key, url, { ex: expiresInSeconds })

  return shortId
}

/**
 * Retrieves the original URL from a short ID
 */
export async function retrieveShortURL(
  shortId: string
): Promise<string | null> {
  const key = `short:${shortId}`

  const url = await memcache.get(key)

  return url as string | null
}

/**
 * Gets or creates a short URL for the given URL
 */
export async function getShortURL(url: string): Promise<string> {
  if (url.startsWith(getExternalHostURL('/s/'))) {
    return url
  }

  if (url.startsWith(getExternalFrontendHostURL('/s/'))) {
    return url
  }

  const shortId = await storeShortURL(url)

  const proxyURL = new URL(`/s/${shortId}`, getExternalFrontendHostURL())

  return proxyURL.toString()
}

/**
 * Gets or creates a temporary short URL (1 hour expiration) for the given URL
 */
export async function getTempShortURL(
  url: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS
): Promise<string> {
  if (url.startsWith(getExternalHostURL('/s/'))) {
    return url
  }

  if (url.startsWith(getExternalFrontendHostURL('/s/'))) {
    return url
  }

  const shortId = await storeTempShortURL(url, expiresInSeconds)

  const proxyURL = new URL(`/s/${shortId}`, getExternalFrontendHostURL())

  return proxyURL.toString()
}
