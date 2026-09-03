import debug from '@/lib/debug'
import memcache from '@/lib/memcache'

export const CONVERSATIONS_IDLE_KEY =
  process.env.NODE_ENV === 'test'
    ? 'conversations:idle:test'
    : 'conversations:idle' // @note do not change

export async function getIdleConversations(
  timeOffset: number = 0
): Promise<string[]> {
  const now = Date.now()

  const idlesAt = now + timeOffset

  debug(`getting idle conversations`, {
    CONVERSATIONS_IDLE_KEY,
    now,
    timeOffset,
    idlesAt,
  })

  const result = await memcache.zrange(CONVERSATIONS_IDLE_KEY, 0, idlesAt, {
    byScore: true,
  })

  return result as string[]
}

export async function trackIdlingConversation(
  conversationId: string,
  timeOffset: number = 0
): Promise<void> {
  const now = Date.now()

  const idlesAt = now + timeOffset

  debug(`track idling conversation`, {
    CONVERSATIONS_IDLE_KEY,
    conversationId,
    now,
    timeOffset,
    idlesAt,
  })

  await memcache.zadd(CONVERSATIONS_IDLE_KEY, {
    score: idlesAt,
    member: conversationId,
  })
}

export async function untrackIdlingConversations(
  conversationIds: string[]
): Promise<void> {
  debug(`untrack idling conversations`, {
    CONVERSATIONS_IDLE_KEY,
    conversationIds,
  })

  await memcache.zrem(CONVERSATIONS_IDLE_KEY, ...conversationIds)
}
