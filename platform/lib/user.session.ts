import { DISTANT_FUTURE } from '@chatbotkit-dev/time'

import { API_AUDIENCE } from '@/lib/audience.consts'
import cuid from '@/lib/cuid'
import type { Session } from '@/lib/session.get'
import { type User, fastGetUserById } from '@/lib/user.get'

type UserLike = Pick<User, 'id' | 'email'> & {
  parentId?: string | null
}

/**
 * Converts a User or Prisma User object to a session user object.
 *
 * @note billing columns deliberately do not ride in sessions - anything
 * resolving a plan or a subscription reads the account row itself.
 */
export function userToSessionUser(user: UserLike): Session['user'] {
  return {
    id: user.id,
    email: user.email,
    parentId: user.parentId ?? null,
  }
}

/**
 * Builds a synthetic session for a given userId, bypassing request context.
 * Useful for server-side operations (e.g. bot execution) that need a session
 * scoped to a specific user rather than the current request context.
 *
 * @throws if the user is not found
 */
export async function getSessionForUserId(userId: string): Promise<Session> {
  const user = await fastGetUserById(userId)

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  return {
    id: cuid(),
    user: userToSessionUser(user),
    options: {},
    payload: { aud: API_AUDIENCE },
    expires: DISTANT_FUTURE.toISOString(),
  } as Session
}
