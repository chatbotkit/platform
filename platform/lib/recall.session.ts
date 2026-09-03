import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import cuid from '@/lib/cuid'
import memcache from '@/lib/memcache'

// --- Constants ---

const RECALL_SESSION_PREFIX = 'recall:session:'
const RECALL_SESSION_TTL = ONE_HOUR_IN_SECONDS

// --- Types ---

export interface RecallMeetingSession {
  id: string
  recallIntegrationId: string
  userId: string
  recallBotId?: string
  // Set once `session/create` provisions the conversation - used by the bot
  // status webhook to append a final activity message when the call ends.
  conversationId?: string
  pageRelayUrl?: string
  text?: string
  botName?: string | null
  createdAt: number
  updatedAt: number
}

// --- Helpers ---

function getRecallMeetingSessionKey(sessionId: string) {
  return `${RECALL_SESSION_PREFIX}${sessionId}`
}

// --- API ---

export async function createRecallMeetingSession({
  recallIntegrationId,
  userId,
  pageRelayUrl,
  text,
  botName,
}: {
  recallIntegrationId: string
  userId: string
  pageRelayUrl?: string
  text?: string
  botName?: string | null
}) {
  const sessionId = cuid()
  const now = Date.now()

  const session: RecallMeetingSession = {
    id: sessionId,
    recallIntegrationId,
    userId,
    ...(pageRelayUrl ? { pageRelayUrl } : null),
    ...(text ? { text } : null),
    ...(botName ? { botName } : null),
    createdAt: now,
    updatedAt: now,
  }

  await memcache.setex(
    getRecallMeetingSessionKey(sessionId),
    RECALL_SESSION_TTL,
    session
  )

  return session
}

export async function getRecallMeetingSession(sessionId: string) {
  const session = await memcache.get<RecallMeetingSession>(
    getRecallMeetingSessionKey(sessionId)
  )

  if (!session) {
    return null
  }

  const refreshed = await memcache.expire(
    getRecallMeetingSessionKey(sessionId),
    RECALL_SESSION_TTL
  )

  if (!refreshed) {
    return null
  }

  return session
}

export async function updateRecallMeetingSession(
  sessionId: string,
  patch: Partial<Pick<RecallMeetingSession, 'recallBotId' | 'conversationId'>>
) {
  const session = await getRecallMeetingSession(sessionId)

  if (!session) {
    return null
  }

  const updatedSession = {
    ...session,
    ...patch,
    updatedAt: Date.now(),
  }

  await memcache.setex(
    getRecallMeetingSessionKey(sessionId),
    RECALL_SESSION_TTL,
    updatedSession
  )

  return updatedSession
}

export async function deleteRecallMeetingSession(sessionId: string) {
  await memcache.del(getRecallMeetingSessionKey(sessionId))
}
