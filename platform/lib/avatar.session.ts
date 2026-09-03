import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { sign, tryVerify } from '@/lib/jwt'

export type AvatarSession = {
  avatarIntegrationId: string

  websocket: string

  [key: string]: unknown
}

function isAvatarSession(value: unknown): value is AvatarSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const session = value as Record<string, unknown>

  return (
    typeof session.avatarIntegrationId === 'string' &&
    typeof session.websocket === 'string'
  )
}

export async function signAvatarSession(
  session: AvatarSession,
  durationInSeconds: number = ONE_HOUR_IN_SECONDS
): Promise<string> {
  return sign(session, durationInSeconds)
}

export async function validateAvatarSession(
  token: string
): Promise<AvatarSession | null> {
  const session = await tryVerify<AvatarSession>(token)

  if (!isAvatarSession(session)) {
    return null
  }

  return session
}
