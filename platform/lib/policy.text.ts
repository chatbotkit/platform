import { formatDuration } from '@chatbotkit-dev/time'

import { PolicyType } from '@/prisma/types'
import type {
  RetentionPolicyConfigType,
  UsagePolicyConfigType,
} from '@/prisma/zod'

import pluralize from 'pluralize'

/**
 * Human-readable descriptions of a policy `config`, selected by policy `type`.
 *
 * The Policy row's `type` column is the authoritative discriminator (the config
 * carries no `type`), so the right shape is selected here by `type` rather than
 * from inside the JSON - same contract as `parsePolicyConfig`.
 *
 * These are best-effort summaries meant for tooltips/labels: a config that does
 * not match its type (or an unknown type) yields an empty string rather than
 * throwing, so callers can render the result unconditionally.
 */

// @note join a list of phrases as readable prose: "a", "a and b", "a, b and c".
function formatList(items: string[]): string {
  if (items.length <= 1) {
    return items.join('')
  }

  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function describeRetention(config: RetentionPolicyConfigType): string {
  const { expiresInDays } = config

  if (!expiresInDays) {
    return 'Conversations are kept indefinitely.'
  }

  return `Conversations expire ${pluralize(
    'day',
    expiresInDays,
    true
  )} after they are created.`
}

// @note the email action accepts a bare address, an array of addresses, or an
// object with an optional `to`; an absent `to` means notify the policy owner.
function describeRecipients(
  email: NonNullable<UsagePolicyConfigType['actions']['email']>
): string {
  if (typeof email === 'string') {
    return email
  }

  if (Array.isArray(email)) {
    return formatList(email)
  }

  const { to } = email

  if (to === undefined) {
    return 'the policy owner'
  }

  return typeof to === 'string' ? to : formatList(to)
}

function describeUsage(config: UsagePolicyConfigType): string {
  const { metric, threshold, windowInSeconds, actions } = config

  const amount = `${threshold.toLocaleString('en-US')} ${metric}`
  const window = formatDuration(windowInSeconds * 1000)

  const consequences: string[] = []

  if (actions?.block) {
    consequences.push(
      `block the bot for ${formatDuration(
        actions.block.durationInSeconds * 1000
      )}`
    )
  }

  if (actions?.email !== undefined) {
    consequences.push(`email ${describeRecipients(actions.email)}`)
  }

  const consequence = consequences.length
    ? formatList(consequences)
    : 'take no action'

  return `When a bot uses more than ${amount} within ${window}, ${consequence}.`
}

export function describePolicyConfig(type: string, config: unknown): string {
  if (config === null || config === undefined) {
    return ''
  }

  try {
    switch (type) {
      case PolicyType.retention:
        return describeRetention(config as RetentionPolicyConfigType)
      case PolicyType.usage:
        return describeUsage(config as UsagePolicyConfigType)
      default:
        return ''
    }
  } catch {
    return ''
  }
}
