import prisma from '@/prisma/client'
import { PolicyType, ResourceState } from '@/prisma/types'
import type { UsagePolicyConfigType } from '@/prisma/zod'

import { blockBot, getBotBlock } from '@/lib/bot.block'
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import memcache from '@/lib/memcache'
import { notifyUsagePolicyTriggered } from '@/lib/notify'
import { parsePolicyConfig } from '@/lib/policy.config'

type PolicyMetric = UsagePolicyConfigType['metric']

type UsagePolicyEmailAction = NonNullable<
  UsagePolicyConfigType['actions']['email']
>

/**
 * Maps a usage base type (see usage.record) to the usage-policy metric it counts
 * toward. Base types absent here are not policy-relevant and are ignored.
 */
export const USAGE_TYPE_TO_POLICY_METRIC: Record<string, PolicyMetric> = {
  token: 'tokens',
  message: 'messages',
  conversation: 'conversations',
}

export function getUsagePolicyCounterKey(policyId: string): string {
  return `usage-policy-${policyId}`
}

export function getUsagePolicyNotifiedKey(policyId: string): string {
  return `usage-policy-notified-${policyId}`
}

/**
 * Reset a usage policy's rolling window: clears the fixed-window counter and
 * the notify-dedupe key so the next recorded event starts a fresh window.
 *
 * Used when a block is lifted early - without this a still-elevated counter
 * would immediately re-trip the policy on the next usage event.
 */
export async function resetUsagePolicyCounter(policyId: string): Promise<void> {
  await memcache.del(
    getUsagePolicyCounterKey(policyId),
    getUsagePolicyNotifiedKey(policyId)
  )
}

/**
 * Increment a fixed-window counter and return the value after incrementing. The
 * TTL is set on the first write of each window, so the counter resets
 * `windowInSeconds` after the window's first increment.
 */
async function incrementWindowCounter(
  key: string,
  amount: number,
  windowInSeconds: number
): Promise<number> {
  return await memcache.incrementInWindow(key, amount, windowInSeconds)
}

interface EvaluateUsagePoliciesOptions {
  userId: string
  botId: string
  baseType: string
  amount: number
}

/**
 * Evaluate the usage policies that apply to a bot for a just-recorded usage
 * event and run their actions (block / notify) when a threshold is crossed.
 *
 * Scoping precedence:
 *
 * - a policy with a botId applies only to that bot;
 * - a policy with no botId but a blueprintId applies only to bots linked to
 *   that same blueprint;
 * - a policy with neither is global and applies to all of the owner's bots.
 *
 * The bot's blueprint is resolved here (rather than threaded in) because botId
 * may originate from references, the conversation or the context bot, none of
 * which reliably carry the bot's current blueprint. Runs at the usage-recording
 * layer (captureUsage), where the bot, metric and amount are already resolved.
 * Must never throw into the recording path - failures are captured and
 * swallowed.
 */
export async function evaluateUsagePolicies({
  userId,
  botId,
  baseType,
  amount,
}: EvaluateUsagePoliciesOptions): Promise<void> {
  const metric = USAGE_TYPE_TO_POLICY_METRIC[baseType]

  if (!botId || !metric || !amount) {
    return
  }

  try {
    // Resolve the bot's blueprint so blueprint-scoped policies only match bots
    // that are actually linked to that blueprint.
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { blueprintId: true },
    })

    const blueprintId = bot?.blueprintId ?? null

    const policies = await prisma.policy.findMany({
      where: {
        userId,
        type: PolicyType.usage,
        // honour the lifecycle state - a disabled policy stays configured but is
        // not enforced at runtime. Blacklist on `disabled` (not whitelist on
        // `enabled`) to stay forgiving of rows that predate the column.
        state: { not: ResourceState.disabled },
        OR: [
          { botId },
          { botId: null, blueprintId: null },
          ...(blueprintId ? [{ botId: null, blueprintId }] : []),
        ],
      },
      select: {
        id: true,
        config: true,
      },
    })

    // Policies cascade: every matching policy stays in force. Collect the ones
    // that cross their own threshold on this event, then apply a single merged
    // outcome rather than firing each policy's actions independently.
    const tripped: TrippedPolicy[] = []

    for (const policy of policies) {
      let config: UsagePolicyConfigType | null

      try {
        config = parsePolicyConfig(
          PolicyType.usage,
          policy.config
        ) as UsagePolicyConfigType | null
      } catch (e) {
        // a stored config that does not match must not break recording
        await captureException(e)

        continue
      }

      if (!config || config.metric !== metric) {
        continue
      }

      const count = await incrementWindowCounter(
        getUsagePolicyCounterKey(policy.id),
        amount,
        config.windowInSeconds
      )

      if (count < config.threshold) {
        continue
      }

      debug(`usage policy threshold crossed`, {
        policyId: policy.id,
        botId,
        metric,
        count,
        threshold: config.threshold,
      }).log('usage.policy.evaluateUsagePolicies')

      tripped.push({ policyId: policy.id, config })
    }

    if (tripped.length) {
      await applyMergedUsagePolicyActions({ userId, botId, metric, tripped })
    }
  } catch (e) {
    // evaluation must never break usage recording
    await captureException(e)
  }
}

interface TrippedPolicy {
  policyId: string
  config: UsagePolicyConfigType
}

/**
 * Apply the merged outcome of every usage policy that tripped on a single
 * recorded event. Policies cascade - all matching ones stay in force and the
 * strictest effect wins - but firing each one independently would block and
 * email N times for one event, so the tripped policies are merged:
 *
 * - block: the bot is blocked once, for the longest duration any tripped policy
 *   asks for. The block is attributed to that longest-duration policy so the
 *   per-policy block-clear route can still lift it.
 * - notify: a single email is sent to the union of recipients of the tripped
 *   policies that are first in their own window. Per-policy window dedupe is
 *   preserved (so a sustained breach does not email on every event); only the
 *   freshly-tripped policies contribute recipients, so each policy's own window
 *   still governs its recipients' cadence.
 */
async function applyMergedUsagePolicyActions({
  userId,
  botId,
  metric,
  tripped,
}: {
  userId: string
  botId: string
  metric: PolicyMetric
  tripped: TrippedPolicy[]
}): Promise<void> {
  // block first - it is the enforcement that actually matters

  const blocking = tripped.filter((t) => t.config.actions.block)

  let blockMinutes: number | undefined

  if (blocking.length) {
    // Resolve each blocking policy's effective block duration. A usage policy
    // caps usage over a rolling window, so the block must last until that window
    // resets - a block shorter than the window would lift while the counter is
    // still over threshold, and the next recorded event would re-block at once.
    // That flap never lets the bot recover (and, via the task workflow's
    // pause/resume, becomes an unbounded wake-block-requeue loop). The counter's
    // remaining TTL is the seconds left in the window; the block runs for at
    // least that long - and never shorter than its configured minimum - so when
    // it lifts the counter has reset and the bot resumes with a fresh budget.
    const withDuration = await Promise.all(
      blocking.map(async (t) => {
        const configured = t.config.actions.block!.durationInSeconds

        const windowTtl = await memcache.ttl(getUsagePolicyCounterKey(t.policyId))

        const durationInSeconds =
          windowTtl > 0 ? Math.max(configured, windowTtl) : configured

        return { policy: t, durationInSeconds }
      })
    )

    // longest effective duration wins so the strictest block governs; attribute
    // the block to that policy so its clear route can lift it
    const primary = withDuration.reduce((a, b) =>
      b.durationInSeconds > a.durationInSeconds ? b : a
    )

    const durationInSeconds = primary.durationInSeconds

    // Suppress self-re-block: if the bot is already blocked, do not re-arm. The
    // active block already runs until the window resets; re-blocking on every
    // subsequent over-threshold event would keep pushing the lift time out and
    // could strand the bot indefinitely. Once the block lifts the counter has
    // reset, so a fresh window is needed to trip the policy again.
    const activeBlock = await getBotBlock(botId)

    if (!activeBlock) {
      await blockBot(botId, {
        reason: 'This bot has been temporarily disabled by a usage policy.',
        durationInSeconds,
        policyId: primary.policy.policyId,
      })
    }

    blockMinutes = Math.round(durationInSeconds / 60)
  }

  // notify, deduped per policy window so a sustained breach does not email on
  // every event. Policies that are first in their window this event are merged
  // into a single email to the union of their recipients.

  const fresh: TrippedPolicy[] = []

  // union the recipients across the freshly-tripped policies, deduped by email
  const recipientsByEmail = new Map<string, { id: string; email: string }>()

  for (const t of tripped) {
    if (!t.config.actions.email) {
      continue
    }

    const firstInWindow = await memcache.set(
      getUsagePolicyNotifiedKey(t.policyId),
      '1',
      { nx: true, ex: t.config.windowInSeconds }
    )

    if (!firstInWindow) {
      continue
    }

    const recipients = await getNotificationRecipients(
      userId,
      t.config.actions.email
    )

    if (!recipients.length) {
      // @note nothing to send for this policy this window - release the dedupe
      // key so a recipient that only becomes resolvable later (e.g. the owner
      // adds an email) is not suppressed for the rest of the window
      await memcache.del(getUsagePolicyNotifiedKey(t.policyId))

      continue
    }

    fresh.push(t)

    for (const recipient of recipients) {
      recipientsByEmail.set(recipient.email, recipient)
    }
  }

  if (fresh.length) {
    const recipients = [...recipientsByEmail.values()]

    // the strictest (lowest) threshold among the freshly-tripped policies is
    // the binding one to report
    const threshold = Math.min(...fresh.map((t) => t.config.threshold))

    await notifyUsagePolicyTriggered(recipients, {
      botId,
      metric,
      threshold,
      blocked: blockMinutes !== undefined,
      blockMinutes,
    })
  }
}

/**
 * Resolve the notification recipients from the email action shorthand:
 * a string, string array, or object `to` value targets explicit recipients;
 * an empty object targets the policy owner. Entries reuse the owner id so
 * audit/logging stays attributed to the account.
 */
async function getNotificationRecipients(
  userId: string,
  emailAction?: UsagePolicyEmailAction
): Promise<{ id: string; email: string }[]> {
  const to = getUsagePolicyEmailRecipients(emailAction)

  if (to && to.length) {
    return to.map((email) => ({ id: userId, email }))
  }

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })

  if (!owner?.email) {
    return []
  }

  return [{ id: owner.id, email: owner.email }]
}

function getUsagePolicyEmailRecipients(
  emailAction?: UsagePolicyEmailAction
): string[] | undefined {
  if (!emailAction) {
    return undefined
  }

  if (typeof emailAction === 'string') {
    return [emailAction]
  }

  if (Array.isArray(emailAction)) {
    return emailAction
  }

  if (typeof emailAction.to === 'string') {
    return [emailAction.to]
  }

  return emailAction.to
}
