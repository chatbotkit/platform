import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { sign, tryVerify } from '@/lib/jwt'

export type AnamSession = {
  anamIntegrationId: string
  conversationId: string
  token: string
  anamSessionToken: string
  [key: string]: unknown
}

function isAnamSession(value: unknown): value is AnamSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const session = value as Record<string, unknown>

  return (
    typeof session.anamIntegrationId === 'string' &&
    typeof session.conversationId === 'string' &&
    typeof session.token === 'string' &&
    typeof session.anamSessionToken === 'string'
  )
}

export async function signAnamSession(
  session: AnamSession,
  durationInSeconds: number = ONE_HOUR_IN_SECONDS
): Promise<string> {
  return sign(session, durationInSeconds)
}

export async function validateAnamSession(
  token: string
): Promise<AnamSession | null> {
  const session = await tryVerify<AnamSession>(token)

  if (!isAnamSession(session)) {
    return null
  }

  return session
}
