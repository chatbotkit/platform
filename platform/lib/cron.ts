import { CronExpressionParser } from 'cron-parser'
import type { CronExpression } from 'cron-parser'

export function isCron(input: string): boolean {
  input = input.trim()

  if (!input) {
    return false
  }

  try {
    CronExpressionParser.parse(input)

    return true
  } catch {
    return false
  }
}

interface GetNextOptions {
  retries?: number
  minMs?: number
  timezone?: string | null
}

export function getNext(input: string, options?: GetNextOptions): Date {
  input = input.trim()

  const { retries = 10, minMs = 0, timezone } = options || {}

  // @note capture current time once to avoid timing inconsistencies

  const now = new Date()
  const minTime = new Date(now.getTime() + minMs)

  const cron = CronExpressionParser.parse(input, {
    ...(timezone ? { tz: timezone } : {}),
  })

  let next = cron.next().toDate()

  for (let i = 0; i < retries; i++) {
    if (next > now) {
      break
    }

    next = cron.next().toDate()
  }

  if (next <= minTime) {
    // @note ensure result is always greater than minTime by adding 1ms

    next = new Date(minTime.getTime() + 1)
  }

  return next
}

export function parse(input: string): CronExpression {
  input = input.trim()

  return CronExpressionParser.parse(input)
}
