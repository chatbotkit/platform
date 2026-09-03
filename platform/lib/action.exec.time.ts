import { getTimezone } from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getContextTimezone } from '@/lib/context.store'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.time.ts for ability definitions related to
// these schemas

/**
 * Schema for getting the current date and time.
 */
export const timeNowSchema = z.object({
  timezone: z
    .string()
    .nullable()
    .optional()
    .describe('Optional IANA timezone such as UTC or America/New_York'),
  format: z
    .enum(['datetime', 'date', 'time', 'iso', 'unix'])
    .nullable()
    .optional()
    .describe('Optional output format: datetime, date, time, iso, or unix'),
})

/**
 * Inferred type for time now schema.
 */
export type TimeNowSchema = z.infer<typeof timeNowSchema>

function formatTimeValue(
  now: Date,
  timezone: string,
  format: NonNullable<TimeNowSchema['format']>
): string | number {
  switch (format) {
    case 'datetime': {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(now)
    }

    case 'date': {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'medium',
      }).format(now)
    }

    case 'time': {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeStyle: 'medium',
      }).format(now)
    }

    case 'iso': {
      return now.toISOString()
    }

    case 'unix': {
      return Math.floor(now.getTime() / 1000)
    }

    default: {
      assertUnreachable(format)
    }
  }
}

// @note operation name constants for compile-time validation in action.tags.ts
export const TIME_NOW_OPERATION_NAME = 'now'

interface TimeActionParams {
  input: ActionInput
  params: ActionParams
  options: ActionOptions
}

/**
 * Returns the current date and time using a selected output format.
 */
export async function doTimeNow({
  input,
  params,
  options,
}: TimeActionParams): Promise<ActionReturn> {
  debug(`do time now`, { input, params, options }).log(
    'action.exec.time.doTimeNow'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.time.now',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { timezone: rawTimezone, format: rawFormat } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: timeNowSchema,
    options,
  })

  const timezone = getTimezone(
    rawTimezone ||
      getContextTimezone() ||
      Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const format = rawFormat || 'datetime'

  const now = new Date()

  return {
    result: formatTimeValue(now, timezone, format),
    messages: [],
  }
}

/**
 * Executes a time action.
 */
export async function executeTimeAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute time action`, { input, params, options }).log(
    'action.exec.time.executeTimeAction'
  )

  type TimeOperation = typeof TIME_NOW_OPERATION_NAME

  let operation: TimeOperation

  {
    switch (true) {
      case 'now' in params: {
        operation = TIME_NOW_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case TIME_NOW_OPERATION_NAME: {
      response = await doTimeNow({ input, params, options })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}

/**
 * @doc Skillsets
 * @index 43
 *
 * ## Time Action - Current Date And Time
 *
 * The time action returns the current date and time in a single requested
 * format. Use it when an ability needs a reliable timestamp without calling an
 * external service.
 *
 * ### Properties
 *
 * - **timezone**: Optional IANA timezone for `time.now`, such as `UTC` or `America/New_York`. Defaults to the request context timezone when available
 * - **format**: Optional output format for `time.now`: `datetime`, `date`, `time`, `iso`, or `unix`
 *
 * ### Example
 *
 * `````markdown
 * ```time.now
 * timezone: ((timezone ys|optional IANA timezone such as UTC or Europe/London))
 * format: ((format ys|optional output format: datetime, date, time, iso, or unix))
 * ```
 * `````
 */
