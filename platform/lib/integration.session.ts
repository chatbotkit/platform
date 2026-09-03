import debug from '@/lib/debug'
import { captureUnexpectedState } from '@/lib/error'
import memcache from '@/lib/memcache'

/**
 * Resolved session result containing the key and value.
 */
interface ResolvedSession {
  key: string
  value: string
}

/**
 * Options for setting session keys.
 */
interface SetSessionOptions {
  /** Expiration time in seconds */
  ex: number
}

/**
 * Resolves a conversation session ID by trying multiple Redis keys in order.
 * Returns the first non-null value found, along with the key it was found under.
 *
 * This enables session resolution from different entry points (e.g.,
 * bot-initiated vs user-initiated conversations) where the session key may
 * have been stored under a different format than the one being looked up.
 */
export async function resolveSession(
  keys: string[]
): Promise<ResolvedSession | null> {
  if (!keys.length) {
    await captureUnexpectedState(
      'resolveSession called with empty keys array',
      { keys }
    )

    return null
  }

  for (const key of keys) {
    const value = await memcache.get<string>(key)

    if (value) {
      debug(`resolved session`, { key, value }).log(
        'lib.integration.session.resolveSession'
      )

      return { key, value }
    }
  }

  return null
}

/**
 * Stores a session ID under multiple Redis keys.
 *
 * This enables session resolution from different entry points. For example,
 * when a bot initiates a conversation, the session should be findable both
 * by the channel-based key (used at initiate time) and by the user-based key
 * (used when the user replies).
 */
export async function setSessionKeys(
  keys: string[],
  value: string,
  options: SetSessionOptions
): Promise<void> {
  if (!keys.length) {
    await captureUnexpectedState(
      'setSessionKeys called with empty keys array',
      { keys, value }
    )

    return
  }

  debug(`setting session keys`, { keys, value }).log(
    'lib.integration.session.setSessionKeys'
  )

  await Promise.all(keys.map((key) => memcache.set(key, value, options)))
}

/**
 * Deletes a session from multiple Redis keys.
 *
 * Use this when resetting or clearing a session to ensure all possible key
 * formats are cleaned up.
 */
export async function deleteSessionKeys(keys: string[]): Promise<void> {
  if (!keys.length) {
    await captureUnexpectedState(
      'deleteSessionKeys called with empty keys array',
      { keys }
    )

    return
  }

  debug(`deleting session keys`, { keys }).log(
    'lib.integration.session.deleteSessionKeys'
  )

  await Promise.all(keys.map((key) => memcache.del(key)))
}
