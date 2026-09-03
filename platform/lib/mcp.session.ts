import cuid from '@/lib/cuid'
import memcache from '@/lib/memcache'

const SESSION_PREFIX = 'mcp:session:'
const SESSION_TTL = 60 * 60 * 24 // 24 hours

interface Session {
  id: string
  userId: string
  createdAt: number
}

/**
 * Create a new MCP session and store it in Redis.
 */
export async function createSession(user: { id: string }): Promise<string> {
  const sessionId = cuid()

  const session: Session = {
    id: sessionId,
    userId: user.id,
    createdAt: Date.now(),
  }

  await memcache.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, session)

  return sessionId
}

/**
 * Get an existing session from Redis.
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  // @note upstash redis returns parsed json directly, not a string

  const data = await memcache.get<Session>(`${SESSION_PREFIX}${sessionId}`)

  return data || null
}

/**
 * Validate a session belongs to the given user.
 */
export async function validateSession(
  user: { id: string },
  sessionId: string
): Promise<Session | null> {
  const session = await getSession(sessionId)

  if (!session || session.userId !== user.id) {
    return null
  }

  // @note refresh ttl on access to keep active sessions alive
  // check if expire succeeded to detect race condition with expiration

  const refreshed = await memcache.expire(
    `${SESSION_PREFIX}${sessionId}`,
    SESSION_TTL
  )

  if (!refreshed) {
    // @note session expired between get and expire - treat as invalid
    return null
  }

  return session
}

/**
 * Get or create a session for a user.
 */
export async function getOrCreateSession(
  user: { id: string },
  sessionId?: string | null
): Promise<string> {
  if (sessionId) {
    const valid = await validateSession(user, sessionId)

    if (valid) {
      return sessionId
    }
  }

  return createSession(user)
}

/**
 * Delete a session from Redis.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await memcache.del(`${SESSION_PREFIX}${sessionId}`)
}
