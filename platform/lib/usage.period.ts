import memcache from '@/lib/memcache'
import { getUsageKey } from '@/lib/usage.record'

export const USAGE_PERIOD_IN_DAYS = 31

export const USAGE_PERIOD_IN_SECONDS = USAGE_PERIOD_IN_DAYS * 24 * 60 * 60
export const USAGE_PERIOD_IN_MILLISECONDS = USAGE_PERIOD_IN_SECONDS * 1000

export async function getUserUsagePeriod(userId: string): Promise<{
  start: Date
  end: Date
}> {
  const ttl = await memcache.ttl(getUsageKey(userId, 'token'))

  const end = new Date(Date.now() + Math.max(ttl, 0) * 1000)
  const start = new Date(end.getTime() - USAGE_PERIOD_IN_MILLISECONDS)

  return { start, end }
}

/**
 * Derives the usage period from the live usage counters, as returned by
 * getUsage, where each ttl is expressed in milliseconds. Returns null when no
 * counter exists, i.e. no usage has been recorded in the current period, in
 * which case there is no meaningful period to display.
 */
export function getUsagePeriodFromUsage(usage: {
  tokens: { ttl: number }
  conversations: { ttl: number }
  messages: { ttl: number }
}): { start: Date; end: Date } | null {
  const ttl = Math.max(
    usage.tokens.ttl,
    usage.conversations.ttl,
    usage.messages.ttl
  )

  if (ttl <= 0) {
    return null
  }

  const end = new Date(Date.now() + ttl)
  const start = new Date(end.getTime() - USAGE_PERIOD_IN_MILLISECONDS)

  return { start, end }
}

export async function getUserUsageElapsedDays(userId: string): Promise<number> {
  const { start, end } = await getUserUsagePeriod(userId)

  const now = new Date()

  if (now < start) {
    return 0
  }

  const elapsed = Math.min(now.getTime(), end.getTime()) - start.getTime()

  return Math.floor(elapsed / (1000 * 60 * 60 * 24))
}

export async function getUserUsageRemainingDays(
  userId: string
): Promise<number> {
  const { end } = await getUserUsagePeriod(userId)

  const now = new Date()

  if (now > end) {
    return 0
  }

  const remaining = end.getTime() - now.getTime()

  return Math.ceil(remaining / (1000 * 60 * 60 * 24))
}
