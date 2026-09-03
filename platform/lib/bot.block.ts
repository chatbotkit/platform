import { ONE_MONTH_IN_SECONDS } from '@chatbotkit-dev/time'

import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import memcache from '@/lib/memcache'

/**
 * A temporary, per-bot "soft lock". When a block is present the engine refuses
 * to run completions for that bot until the block's TTL expires (or it is
 * cleared). It is the enforcement half of usage policies, but the primitive is
 * deliberately policy-agnostic so it can also back a manual admin disable.
 *
 * The block lives only in Redis (it is ephemeral by design) and auto-expires
 * via TTL, so a time-limited block needs no separate unblock step.
 */

const BLOCK_KEY_PREFIX = 'block-bot-'

const POLICY_INDEX_KEY_PREFIX = 'block-policy-'

export function getBotBlockKey(botId: string): string {
  return `${BLOCK_KEY_PREFIX}${botId}`
}

/**
 * Per-policy reverse index: a Redis SET of the bots a policy currently blocks.
 *
 * Blocks are keyed by bot, so "which bots did this policy block" would
 * otherwise require a full keyspace scan. Maintaining this set at block time
 * turns that read into a single SMEMBERS. Members can outlive their block
 * (blocks auto-expire via TTL), so readers prune stale entries lazily.
 */
export function getBotBlockPolicyIndexKey(policyId: string): string {
  return `${POLICY_INDEX_KEY_PREFIX}${policyId}`
}

export interface BotBlock {
  // human-readable reason, surfaced to the caller
  reason: string
  // the policy that tripped the block, when it was policy-driven
  policyId?: string
  // seconds remaining until the block expires
  ttl: number
}

interface BlockBotOptions {
  reason: string
  durationInSeconds: number
  policyId?: string
}

/**
 * Block a bot for `durationInSeconds`. The block auto-expires via TTL, so a
 * time-limited block requires no separate unblock step.
 */
export async function blockBot(
  botId: string,
  { reason, durationInSeconds, policyId }: BlockBotOptions
): Promise<void> {
  debug(`blocking bot`, { botId, reason, durationInSeconds, policyId }).log(
    'bot.block.blockBot'
  )

  await memcache.set(
    getBotBlockKey(botId),
    { reason, policyId },
    { ex: durationInSeconds }
  )

  // record the bot in the policy's reverse index so `getBotsBlockedByPolicy`
  // can answer without scanning the keyspace. The block itself expires via TTL;
  // stale index members are pruned lazily on read.

  if (policyId) {
    const indexKey = getBotBlockPolicyIndexKey(policyId)

    await memcache.sadd(indexKey, botId)

    // give the index a self-expiring TTL so a set for a policy that is never
    // read again does not linger forever. Refreshed on every block and never
    // shorter than this block's own life, so an active block is always covered.

    await memcache.expire(
      indexKey,
      Math.max(ONE_MONTH_IN_SECONDS, durationInSeconds)
    )
  }
}

/**
 * Clear a bot block (manual re-enable). Time-limited blocks expire on their own;
 * this is for lifting a block early.
 */
export async function unblockBot(botId: string): Promise<void> {
  debug(`unblocking bot`, { botId }).log('bot.block.unblockBot')

  await memcache.del(getBotBlockKey(botId))
}

/**
 * Return the active block for a bot, or `null` when it is not blocked.
 *
 * Fails open (returns `null`) on a Redis error so an infrastructure blip does
 * not itself become a bot-wide outage. Mirrors the fail-open behaviour of the
 * rate limiter and platform budget check.
 */
export async function getBotBlock(botId: string): Promise<BotBlock | null> {
  if (!botId) {
    return null
  }

  const key = getBotBlockKey(botId)

  try {
    const value = await memcache.get<{ reason?: string; policyId?: string }>(key)

    if (!value) {
      return null
    }

    const ttl = await memcache.ttl(key)

    return {
      reason: value.reason ?? 'This bot is temporarily disabled.',
      policyId: value.policyId,
      ttl: ttl > 0 ? ttl : 0,
    }
  } catch (e) {
    await captureException(e)

    return null
  }
}

/**
 * Find every bot currently blocked by a specific policy.
 *
 * Reads the policy's reverse index (a SET maintained at block time) rather than
 * scanning the keyspace, so cost is O(bots this policy has blocked). Index members
 * can be stale - a block may have expired via TTL, or the bot may have since been
 * re-blocked by a different policy - so we confirm each against the live block and
 * prune the misses. Fails open (returns `[]`) on a Redis error.
 */
export async function getBotsBlockedByPolicy(
  policyId: string
): Promise<string[]> {
  if (!policyId) {
    return []
  }

  const indexKey = getBotBlockPolicyIndexKey(policyId)

  try {
    const members = await memcache.smembers(indexKey)

    if (!members.length) {
      return []
    }

    const values = await Promise.all(
      members.map((botId) =>
        memcache.get<{ policyId?: string }>(getBotBlockKey(botId))
      )
    )

    const active: string[] = []
    const stale: string[] = []

    members.forEach((botId, index) => {
      if (values[index]?.policyId === policyId) {
        active.push(botId)
      } else {
        stale.push(botId)
      }
    })

    if (stale.length) {
      await memcache.srem(indexKey, ...stale)
    }

    return active
  } catch (e) {
    await captureException(e)

    return []
  }
}

/**
 * Whether a bot is allowed to run, i.e. it is not currently blocked. This is the
 * cheap hot-path check (a single Redis GET) for the engine.
 *
 * Fails open (returns `true`) on a Redis error.
 */
export async function botBlockOk(botId: string): Promise<boolean> {
  if (!botId) {
    return true
  }

  try {
    const value = await memcache.get(getBotBlockKey(botId))

    return value === null || value === undefined
  } catch (e) {
    await captureException(e)

    return true
  }
}
