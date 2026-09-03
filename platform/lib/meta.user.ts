import { fetchPlusPlus } from '@/lib/fetch'

export const META_GRAPH_API_VERSION = 'v21.0'

// @note process-wide cache of Meta Graph user lookups, mirroring the cache in
// lib/slack.user.ts. Keyed by `${userId}:${fields}` so the same user resolved
// for different field sets (e.g. instagram name/username vs messenger
// first_name/last_name) does not collide. Meta PSIDs are scoped to the app, so
// keying by user id alone is safe across integrations. Only successful lookups
// are cached so a transient failure can be retried on a later turn.
const userInfoCache = new Map<string, Record<string, string>>()

/**
 * Resolve a Meta Graph user profile (Instagram / Messenger PSID). Returns the
 * raw parsed Graph response, or null on failure. Successful lookups are cached
 * for the lifetime of the process so resolving the sender on every turn costs a
 * single API call per user.
 */
export async function getMetaUserInfo(
  userId: string,
  {
    accessToken,
    fields,
    version = META_GRAPH_API_VERSION,
  }: { accessToken: string; fields: string; version?: string }
): Promise<Record<string, string> | null> {
  const cacheKey = `${userId}:${fields}`

  if (!userInfoCache.has(cacheKey)) {
    const url = new URL(`https://graph.facebook.com/${version}/${userId}`)

    url.searchParams.set('fields', fields)
    url.searchParams.set('access_token', accessToken)

    const request = await fetchPlusPlus(url.href)

    if (!request.ok) {
      // @note do not cache failures so a later turn can retry
      return null
    }

    userInfoCache.set(cacheKey, await request.json())
  }

  return userInfoCache.get(cacheKey) ?? null
}
