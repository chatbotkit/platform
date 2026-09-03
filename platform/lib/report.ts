import { getYYYYMMDD, timePlusDays } from '@chatbotkit-dev/time'

import limits from '@/config/limits'

import prisma from '@/prisma/client'
import {
  breakdownTotalContactsWithConversationsOverPeriod,
  breakdownTotalConversationsOverPeriod,
  breakdownTotalMessagesOfTypeOverPeriod,
  breakdownTotalMessagesOverPeriod,
  breakdownTotalRatingsOverPeriod,
  breakdownTotalUsageTokensOverPeriod,
  getAverageMessagesOfTypeOverPeriod,
  getBotConversationCountByDay,
  getBotConversationsWithUserMessageCount,
  getBotMessageCountByDay,
  getBotSingleTurnConversationCount,
  getBotUsageStats,
  getDailyNegativeRatingCount,
  getTotalContacts,
  getTotalContactsWithConversationsOverPeriod,
  getTotalConversationsOverPeriod,
  getTotalMessagesOfTypeOverPeriod,
  getTotalMessagesOverPeriod,
  getTotalRatingsOverPeriod,
  getTotalThumbsDownOverPeriod,
  getTotalThumbsUpOverPeriod,
  getTotalUsageTokensOverPeriod,
  listContacts,
  listContactsWithConversationsOverPeriod,
  listContactsWithMessagesOverPeriod,
  listContactsWithRatingsOverPeriod,
  listEventLogsOfTypeActionsGroupedByTypeOverPeriod,
  listTopBotsByTokenUsageOverPeriod,
  listTopContactsByTokenUsageOverPeriod,
  listTopDownvotersOverPeriod,
  listTopUpvotersOverPeriod,
} from '@/prisma/sql'
import { MessageType } from '@/prisma/types'

import {
  getApproximateTotalAbilities,
  getApproximateTotalDatasets,
  getApproximateTotalFiles,
  getApproximateTotalRecords,
  getApproximateTotalSkillsets,
} from '@/lib/limit.estimate'
import { shortFormat, toNumber } from '@/lib/number'
import { throwNotFound } from '@/lib/response'
import { getUsageSeriesNow } from '@/lib/usage.get'
import { UseType } from '@/lib/usage.types'
import { revealUserPlan } from '@/lib/user.plan'
import type { ZodSchema } from '@/lib/zod.schema'
import { z } from '@/lib/zod.schema'

const DEFAULT_PERIOD = 30

export interface Session {
  user: {
    id: string
  }
}

export interface Report<T, U> {
  name: string
  description: string

  input: ZodSchema<T>
  output: ZodSchema<U>

  createdAt: Date
  updatedAt: Date

  handler: (session: Session, data: T) => Promise<U>
}

function createReport<T, U>(report: Report<T, U>): Report<T, U> {
  return report
}

const PeriodInputSchema = z.object({
  periodDays: z.number().int().positive().default(DEFAULT_PERIOD),
})

const MetricOutputSchema = z.object({
  value: z.number(),
  change: z.number().optional(),
  period: z.string(),
  breakdown: z
    .array(
      z.object({
        date: z.string(),
        total: z.number(),
      })
    )
    .optional(),
})

const DatasetRecordsInputSchema = z.object({
  datasetIds: z.array(z.string()),
})

const DatasetRecordsOutputSchema = z.object({
  totalRecords: z.number(),
  breakdown: z.array(
    z.object({
      datasetId: z.string(),
      records: z.number(),
    })
  ),
})

const ConversationUsageInputSchema = z.object({
  conversationIds: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe('IDs of conversations to include in the usage report'),
  periodDays: z
    .number()
    .int()
    .positive()
    .max(90)
    .default(90)
    .describe('Number of days to analyse, up to the 90-day usage lookback'),
})

const ConversationUsageOutputSchema = z.object({
  totalTokens: z.number(),
  totalConversations: z.number(),
  totalMessages: z.number(),
  period: z.string(),
  items: z.array(
    z.object({
      conversationId: z.string(),
      tokens: z.number(),
      conversations: z.number(),
      messages: z.number(),
    })
  ),
})

/**
 * @manual Reports
 * @category Analytics
 * @index 1
 * @tags reports analytics metrics conversational-ai
 * @date Mon, Mar 3, 2026, 12:00 AM
 * @description Reference for all built-in report types: their stable IDs, input parameters, and output schemas covering ratings, contacts, conversations, messages, tokens, bot performance, and alerting.
 *
 * Reports are structured analytics queries that process your platform activity
 * data and return structured metrics with period comparisons, breakdowns, and
 * ranked lists. Each report is identified by a stable ID and accepts typed
 * input parameters described below.
 *
 * ## Generating Reports
 *
 * Use the batch generate endpoint to run one or more reports in a single call.
 * The request body is a map of report ID → input object. All reports in a
 * single request execute in parallel.
 *
 * ```http
 * POST /api/v1/platform/report/generate
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "clr3m5n8k000008jq7h9e5b1a": { "periodDays": 30 },
 *   "clr3m5n8k000308jq1h7i8j4d": {}
 * }
 * ```
 *
 * Responses use the same map structure. Each key resolves either to the report
 * data or to an error object if that specific report failed.
 *
 * ## Common Input Parameters
 *
 * Most reports accept a single `periodDays` field that sets the look-back
 * window. The previous equivalent window is computed automatically and used
 * to calculate the `change` field in the output.
 *
 * | Parameter | Type | Default | Description |
 * |-----------|------|---------|-------------|
 * | `periodDays` | `integer` | `30` | Number of days to analyse |
 *
 * Bot-specific reports additionally require a `botId` string.
 *
 * ## Common Output Fields
 *
 * | Field | Type | Description |
 * |-------|------|-------------|
 * | `value` | `number` | Metric total for the current period |
 * | `change` | `number` | Difference versus the previous equivalent period |
 * | `period` | `string` | Human-readable label, e.g. `"last 30 days"` |
 * | `breakdown` | `array` | Optional day-by-day `{ date, total }` entries |
 */
export const registry = {
  // Dataset Reports

  cm7k3m5n8k000008jq7h9e5b1a: createReport({
    name: 'Dataset Records Report',
    description: 'Report on total number of records for a list of datasets',

    input: DatasetRecordsInputSchema,
    output: DatasetRecordsOutputSchema,

    handler: async (session, data) => {
      const { getStore } = await import('@/lib/store.types')

      const datasets = await prisma.dataset.findMany({
        where: {
          id: { in: data.datasetIds },
          user: {
            OR: [{ id: session.user.id }, { parentId: session.user.id }],
          },
        },
        select: {
          id: true,
        },
      })

      const breakdown = await Promise.all(
        datasets.map(async (dataset) => {
          const store = await getStore()
          const records = await store.countRecords({ datasetId: dataset.id })

          return {
            datasetId: dataset.id,
            records,
          }
        })
      )

      const totalRecords = breakdown.reduce(
        (acc, curr) => acc + curr.records,
        0
      )

      return {
        totalRecords,
        breakdown,
      }
    },

    createdAt: new Date('2026-02-25T00:00:00Z'),
    updatedAt: new Date('2026-02-25T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Dataset Records Report
   *
   * **ID:** `cm7k3m5n8k000008jq7h9e5b1a`
   *
   * Returns the total number of records stored across one or more datasets,
   * with a per-dataset breakdown. Useful for monitoring knowledge-base size
   * and validating import pipelines.
   *
   * **Input**
   *
   * | Parameter | Type | Description |
   * |-----------|------|-------------|
   * | `datasetIds` | `string[]` | IDs of datasets to include in the count |
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `totalRecords` | `number` | Aggregate record count |
   * | `breakdown` | `array` | Per-dataset `{ datasetId, records }` entries |
   */

  // ---

  // Conversation Usage Reports

  cru3m5n8k001008jq7h9e5b2c: createReport({
    name: 'Conversation Usage Report',
    description:
      'Token, conversation, and message usage totals for one or more conversations',

    input: ConversationUsageInputSchema,
    output: ConversationUsageOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 90
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const requestedConversationIds = [...new Set(data.conversationIds)]

      const conversations = await prisma.conversation.findMany({
        where: {
          id: { in: requestedConversationIds },
          userId: session.user.id,
        },
        select: {
          id: true,
        },
      })

      const conversationIdSet = new Set(conversations.map(({ id }) => id))
      const conversationIds = requestedConversationIds.filter((id) =>
        conversationIdSet.has(id)
      )

      const usageByConversation = new Map<
        string,
        { tokens: number; messages: number }
      >()

      for (const conversationId of conversationIds) {
        usageByConversation.set(conversationId, { tokens: 0, messages: 0 })
      }

      if (conversationIds.length) {
        const usageRows = await prisma.usage.groupBy({
          by: ['conversationId', 'type'],
          where: {
            userId: session.user.id,
            conversationId: { in: conversationIds },
            type: {
              in: [UseType.CHATBOTKIT_BASE_TOKEN, UseType.CHATBOTKIT_MESSAGE],
            },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          _sum: {
            count: true,
          },
        })

        for (const row of usageRows) {
          if (!row.conversationId) {
            continue
          }

          const item = usageByConversation.get(row.conversationId)

          if (!item) {
            continue
          }

          const count = row._sum.count ?? 0

          if (row.type === UseType.CHATBOTKIT_BASE_TOKEN) {
            item.tokens += count
          } else if (row.type === UseType.CHATBOTKIT_MESSAGE) {
            item.messages += count
          }
        }
      }

      const items = conversationIds.map((conversationId) => {
        const usage = usageByConversation.get(conversationId) ?? {
          tokens: 0,
          messages: 0,
        }

        return {
          conversationId,
          tokens: usage.tokens,
          conversations: 1,
          messages: usage.messages,
        }
      })

      return {
        totalTokens: items.reduce((total, item) => total + item.tokens, 0),
        totalConversations: items.reduce(
          (total, item) => total + item.conversations,
          0
        ),
        totalMessages: items.reduce((total, item) => total + item.messages, 0),
        period: `last ${periodDays} days`,
        items,
      }
    },

    createdAt: new Date('2026-05-20T00:00:00Z'),
    updatedAt: new Date('2026-05-20T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Conversation Usage Report
   *
   * **ID:** `cru3m5n8k001008jq7h9e5b2c`
   *
   * Returns token, conversation, and message usage for one or more
   * conversations. Conversation usage is counted as `1` for each valid
   * conversation ID owned by the authenticated user, and top-level
   * `totalConversations` is the sum of those item counts.
   *
   * **Input**
   *
   * | Parameter | Type | Default | Description |
   * |-----------|------|---------|-------------|
   * | `conversationIds` | `string[]` | - | IDs of conversations to include |
   * | `periodDays` | `integer` | `90` | Number of days to analyse, up to 90 |
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `totalTokens` | `number` | Aggregate base token usage |
   * | `totalConversations` | `number` | Number of valid conversations included |
   * | `totalMessages` | `number` | Aggregate message usage |
   * | `items` | `array` | Per-conversation `{ conversationId, tokens, conversations, messages }` entries |
   */

  // ---

  // Rating Reports

  clr3m5n8k000008jq7h9e5b1a: createReport({
    name: 'Total Ratings Report',
    description: 'Comprehensive report on total number of ratings received',

    input: PeriodInputSchema,
    output: MetricOutputSchema.extend({
      thumbsUp: z.number().optional(),
      thumbsDown: z.number().optional(),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData, breakdown] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalRatingsOverPeriod(session.user.id, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalRatingsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalRatingsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),
      ])

      const currentValue = Number(currentData[0].total)
      const previousValue = Number(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
        breakdown: breakdown.map(({ date, total }) => ({
          date: date == null ? '' : getYYYYMMDD(date),
          total: toNumber(total),
        })),
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Total Ratings Report
   *
   * **ID:** `clr3m5n8k000008jq7h9e5b1a`
   *
   * Counts all ratings (thumbs up + thumbs down) received within the period,
   * with a signed change versus the previous period and a daily breakdown.
   *
   * **Input:** `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `value` | `number` | Total ratings |
   * | `change` | `number` | Change vs previous period |
   * | `thumbsUp` | `number` | Count of positive ratings |
   * | `thumbsDown` | `number` | Count of negative ratings |
   * | `breakdown` | `array` | Daily `{ date, total }` entries |
   */

  clr3m5n8k000108jq3c4d7f2b: createReport({
    name: 'Thumbs Up Report',
    description: 'Report on positive ratings received',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalThumbsUpOverPeriod(session.user.id, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalThumbsUpOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
      ])

      const currentValue = Number(currentData[0].total)
      const previousValue = Number(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Thumbs Up Report
   *
   * **ID:** `clr3m5n8k000108jq3c4d7f2b`
   *
   * Counts only positive ratings with period-over-period change.
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields (`value`, `change`, `period`).
   */

  clr3m5n8k000208jq8e5f6g3c: createReport({
    name: 'Thumbs Down Report',
    description: 'Report on negative ratings received',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalThumbsDownOverPeriod(session.user.id, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalThumbsDownOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
      ])

      const currentValue = Number(currentData[0].total)
      const previousValue = Number(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Thumbs Down Report
   *
   * **ID:** `clr3m5n8k000208jq8e5f6g3c`
   *
   * Counts only negative ratings with period-over-period change.
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields (`value`, `change`, `period`).
   */

  // ---

  // Contact Reports

  clr3m5n8k000308jq1h7i8j4d: createReport({
    name: 'Total Contacts Report',
    description: 'Report on total number of unique contacts/users',

    input: z.object({
      userId: z.string(),
    }),
    output: z.object({
      value: z.number(),
      period: z.string(),
    }),

    handler: async (session, _data) => {
      const currentData = await prisma.$queryRawTyped(
        getTotalContacts(session.user.id)
      )

      return {
        value: toNumber(currentData[0].total),
        period: 'all time',
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Total Contacts Report
   *
   * **ID:** `clr3m5n8k000308jq1h7i8j4d`
   *
   * Returns the all-time count of unique contacts on the account. Does not
   * accept a time window because the metric is cumulative.
   *
   * **Input:** _(none required)_
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `value` | `number` | Total unique contacts |
   * | `period` | `string` | Always `"all time"` |
   */

  clr3m5n8k000408jq9i8j9k5e: createReport({
    name: 'Active Contacts Report',
    description: 'Report on number of active contacts with conversations',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData, breakdown] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),
        prisma.$queryRawTyped(
          getTotalContactsWithConversationsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),
      ])

      const currentValue = toNumber(currentData[0].total)
      const previousValue = toNumber(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
        breakdown: breakdown.map(({ date, total }) => ({
          date: date == null ? '' : getYYYYMMDD(date),
          total: toNumber(total),
        })),
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Active Contacts Report
   *
   * **ID:** `clr3m5n8k000408jq9i8j9k5e`
   *
   * Counts contacts that initiated at least one conversation within the period,
   * with a daily breakdown and period-over-period change.
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields with `breakdown`.
   */

  // ---

  // Conversation Reports

  clr3m5n8k000508jq2j9k0l6f: createReport({
    name: 'Total Conversations Report',
    description: 'Report on total number of conversations handled',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData, breakdown] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),
        prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),
      ])

      const currentValue = toNumber(currentData[0].total)
      const previousValue = toNumber(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
        breakdown: breakdown.map(({ date, total }) => ({
          date: date == null ? '' : getYYYYMMDD(date),
          total: toNumber(total),
        })),
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Total Conversations Report
   *
   * **ID:** `clr3m5n8k000508jq2j9k0l6f`
   *
   * Counts conversations started within the period with daily granularity and
   * period-over-period change.
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields with `breakdown`.
   */

  // ---

  // Message Reports

  clr3m5n8k000608jq3k0l1m7g: createReport({
    name: 'Total Messages Report',
    description: 'Report on total number of messages exchanged',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData, breakdown] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(session.user.id, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalMessagesOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),
      ])

      const currentValue = toNumber(currentData[0].total)
      const previousValue = toNumber(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
        breakdown: breakdown.map(({ date, total }) => ({
          date: date == null ? '' : getYYYYMMDD(date),
          total: toNumber(total),
        })),
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Total Messages Report
   *
   * **ID:** `clr3m5n8k000608jq3k0l1m7g`
   *
   * Counts all messages (user + bot + activity) within the period.
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields with `breakdown`.
   */

  clr3m5n8k000708jq4l1m2n8h: createReport({
    name: 'User Messages Report',
    description: 'Report on number of user messages/requests processed',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData, breakdown] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),
        prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),
      ])

      const currentValue = toNumber(currentData[0].total)
      const previousValue = toNumber(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
        breakdown: breakdown.map(({ date, total }) => ({
          date: date == null ? '' : getYYYYMMDD(date),
          total: toNumber(total),
        })),
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## User Messages Report
   *
   * **ID:** `clr3m5n8k000708jq4l1m2n8h`
   *
   * Counts only user-originated messages (type `user`).
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields with `breakdown`.
   */

  clr3m5n8k000808jq5m2n3o9i: createReport({
    name: 'Bot Messages Report',
    description: 'Report on number of bot/agent responses delivered',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData, breakdown] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),
        prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),
      ])

      const currentValue = toNumber(currentData[0].total)
      const previousValue = toNumber(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
        breakdown: breakdown.map(({ date, total }) => ({
          date: date == null ? '' : getYYYYMMDD(date),
          total: toNumber(total),
        })),
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Bot Messages Report
   *
   * **ID:** `clr3m5n8k000808jq5m2n3o9i`
   *
   * Counts only agent/bot responses (type `bot`).
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields with `breakdown`.
   */

  clr3m5n8k000908jq6n3o4p0j: createReport({
    name: 'Activity Messages Report',
    description: 'Report on number of agent actions taken',

    input: PeriodInputSchema,
    output: MetricOutputSchema,

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [currentData, previousData, breakdown] = await Promise.all([
        prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),
        prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),
      ])

      const currentValue = toNumber(currentData[0].total)
      const previousValue = toNumber(previousData[0].total)

      return {
        value: toNumber(currentValue),
        change: toNumber(currentValue) - toNumber(previousValue),
        period: `last ${periodDays} days`,
        breakdown: breakdown.map(({ date, total }) => ({
          date: date == null ? '' : getYYYYMMDD(date),
          total: toNumber(total),
        })),
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Activity Messages Report
   *
   * **ID:** `clr3m5n8k000908jq6n3o4p0j`
   *
   * Counts agent actions and tool-call events (type `activity`).
   *
   * **Input:** `periodDays`
   *
   * **Output:** Standard metric fields with `breakdown`.
   */

  // ---

  // Average Reports

  clr3m5n8k000a08jq7o4p5q1k: createReport({
    name: 'Average User Messages per Conversation Report',
    description: 'Report on average number of user messages per conversation',

    input: PeriodInputSchema,
    output: z.object({
      value: z.number(),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const result = await prisma.$queryRawTyped(
        getAverageMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.user,
          periodStart,
          periodEnd
        )
      )

      return {
        value: toNumber(result[0].average),
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Average User Messages per Conversation Report
   *
   * **ID:** `clr3m5n8k000a08jq7o4p5q1k`
   *
   * Mean number of user messages across all conversations in the period.
   * Useful as a proxy for conversation depth and engagement quality.
   *
   * **Input:** `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `value` | `number` | Average user messages per conversation |
   * | `period` | `string` | Analysed time window |
   */

  clr3m5n8k000b08jq8p5q6r2l: createReport({
    name: 'Average Bot Messages per Conversation Report',
    description: 'Report on average number of bot responses per conversation',

    input: PeriodInputSchema,
    output: z.object({
      value: z.number(),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const result = await prisma.$queryRawTyped(
        getAverageMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.bot,
          periodStart,
          periodEnd
        )
      )

      return {
        value: toNumber(result[0].average),
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Average Bot Messages per Conversation Report
   *
   * **ID:** `clr3m5n8k000b08jq8p5q6r2l`
   *
   * Mean number of bot responses per conversation in the period.
   *
   * **Input:** `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `value` | `number` | Average bot messages per conversation |
   * | `period` | `string` | Analysed time window |
   */

  clr3m5n8k000c08jq9q6r7s3m: createReport({
    name: 'Average Actions per Conversation Report',
    description: 'Report on average number of actions per conversation',

    input: PeriodInputSchema,
    output: z.object({
      value: z.number(),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 30
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const result = await prisma.$queryRawTyped(
        getAverageMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.activity,
          periodStart,
          periodEnd
        )
      )

      return {
        value: toNumber(result[0].average),
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2025-11-17T00:00:00Z'),
    updatedAt: new Date('2025-11-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Average Actions per Conversation Report
   *
   * **ID:** `clr3m5n8k000c08jq9q6r7s3m`
   *
   * Mean number of agent actions (tool calls, ability invocations) per
   * conversation in the period.
   *
   * **Input:** `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `value` | `number` | Average actions per conversation |
   * | `period` | `string` | Analysed time window |
   */

  // ---

  // Comprehensive Report

  clr3m5n8k000d08jqar7s8t4n: createReport({
    name: 'Comprehensive Overview Report',
    description:
      'Complete analytics overview with ratings, contacts, conversations, and messages including detailed breakdowns and lists',

    input: PeriodInputSchema,
    output: z.object({
      data: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          value: z.number(),
          change: z.number().optional(),
          period: z.string(),
          details: z
            .object({
              metric: z
                .object({
                  title: z.string(),
                  description: z.string(),
                  value: z.number(),
                  change: z.number().optional(),
                  period: z.string(),
                })
                .optional(),
              chart: z
                .object({
                  type: z.literal('line'),
                  data: z.array(
                    z.object({
                      date: z.string(),
                      total: z.number(),
                      thumbsUp: z.number().optional(),
                      thumbsDown: z.number().optional(),
                    })
                  ),
                })
                .optional(),
              list: z
                .array(
                  z.object({
                    id: z.string(),
                    icon: z.string().optional(),
                    name: z.string(),
                    description: z.string(),
                    createdAt: z.date().optional(),
                    tags: z.array(z.any()).optional(),
                  })
                )
                .optional(),
            })
            .optional(),
        })
      ),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? DEFAULT_PERIOD
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const queryResults = await prisma.$queryMap({
        // contact

        totalContacts: prisma.$queryRawTyped(getTotalContacts(session.user.id)),

        listOfContacts: prisma.$queryRawTyped(
          listContacts(session.user.id, 100)
        ),

        totalActiveContacts: prisma.$queryRawTyped(
          getTotalContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        totalActiveContactsPreviousPeriod: prisma.$queryRawTyped(
          getTotalContactsWithConversationsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        listOfActiveContactsWithConversations: prisma.$queryRawTyped(
          listContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        listOfActiveContactsWithMessages: prisma.$queryRawTyped(
          listContactsWithMessagesOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        breakdownOfActiveContacts: prisma.$queryRawTyped(
          breakdownTotalContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        // conversation

        totalConversations: prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        totalConversationsPreviousPeriod: prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfConversations: prisma.$queryRawTyped(
          breakdownTotalConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        // message

        totalMessages: prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        totalUserMessages: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),

        totalUserMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfUserMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),

        totalBotMessages: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),

        totalBotMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfBotMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),

        totalActivityMessages: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),

        totalActivityMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfActivityMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),

        listOfActions: prisma.$queryRawTyped(
          listEventLogsOfTypeActionsGroupedByTypeOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        averageUserMessagesPerConversation: prisma.$queryRawTyped(
          getAverageMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),

        averageBotMessagesPerConversation: prisma.$queryRawTyped(
          getAverageMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),

        averageActivityMessagesPerConversation: prisma.$queryRawTyped(
          getAverageMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),

        // ratings

        totalRatings: prisma.$queryRawTyped(
          getTotalRatingsOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalRatingsPreviousPeriod: prisma.$queryRawTyped(
          getTotalRatingsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        totalThumbsUp: prisma.$queryRawTyped(
          getTotalThumbsUpOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalThumbsUpPreviousPeriod: prisma.$queryRawTyped(
          getTotalThumbsUpOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        totalThumbsDown: prisma.$queryRawTyped(
          getTotalThumbsDownOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalThumbsDownPreviousPeriod: prisma.$queryRawTyped(
          getTotalThumbsDownOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfRatings: prisma.$queryRawTyped(
          breakdownTotalRatingsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        listOfContactsWithRatings: prisma.$queryRawTyped(
          listContactsWithRatingsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        listOfTopUpvoters: prisma.$queryRawTyped(
          listTopUpvotersOverPeriod(session.user.id, periodStart, periodEnd, 20)
        ),

        listOfTopDownvoters: prisma.$queryRawTyped(
          listTopDownvotersOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            20
          )
        ),
      })

      return {
        data: [
          // ratings
          {
            title: 'Total Ratings',
            description: 'Number of ratings received',
            value: toNumber(queryResults.totalRatings[0].total),
            change:
              toNumber(queryResults.totalRatings[0].total) -
              toNumber(queryResults.totalRatingsPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Ratings',
                description: 'Number of ratings received',
                value: toNumber(queryResults.totalRatings[0].total),
                change:
                  toNumber(queryResults.totalRatings[0].total) -
                  toNumber(queryResults.totalRatingsPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfRatings.map(
                  ({ date, total, thumbsUp, thumbsDown }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                    thumbsUp: toNumber(thumbsUp),
                    thumbsDown: toNumber(thumbsDown),
                  })
                ),
              },

              list: queryResults.listOfContactsWithRatings.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _upvoteCount,
                  _downvoteCount,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'rating', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                    { name: 'upvote', value: _upvoteCount },
                    { name: 'downvote', value: _downvoteCount },
                  ],
                })
              ),
            },
          },
          {
            title: 'Thumbs Up',
            description: 'Number of positive ratings received',
            value: toNumber(queryResults.totalThumbsUp[0].total),
            change:
              toNumber(queryResults.totalThumbsUp[0].total) -
              toNumber(queryResults.totalThumbsUpPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Thumbs Up',
                description: 'Number of positive ratings received',
                value: toNumber(queryResults.totalThumbsUp[0].total),
                change:
                  toNumber(queryResults.totalThumbsUp[0].total) -
                  toNumber(queryResults.totalThumbsUpPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              list: queryResults.listOfTopUpvoters.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'upvote', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },
          {
            title: 'Thumbs Down',
            description: 'Number of negative ratings received',
            value: toNumber(queryResults.totalThumbsDown[0].total),
            change:
              toNumber(queryResults.totalThumbsDown[0].total) -
              toNumber(queryResults.totalThumbsDownPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Thumbs Down',
                description: 'Number of negative ratings received',
                value: toNumber(queryResults.totalThumbsDown[0].total),
                change:
                  toNumber(queryResults.totalThumbsDown[0].total) -
                  toNumber(queryResults.totalThumbsDownPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              list: queryResults.listOfTopDownvoters.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'downvote', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // contact
          {
            title: 'Total Users',
            description: 'Number of unique users',
            value: toNumber(queryResults.totalContacts[0].total),
            period: 'all time',

            details: {
              metric: {
                title: 'Total Users',
                description: 'Number of unique users',
                value: toNumber(queryResults.totalContacts[0].total),
                period: 'all time',
              },

              list: queryResults.listOfContacts.map(
                ({ id, name, description, email, nick, meta, createdAt }) => ({
                  id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags:
                    typeof meta === 'object' && meta !== null && 'app' in meta
                      ? [meta.app]
                      : [],
                })
              ),
            },
          },
          {
            title: 'Active Users',
            description: 'Number of active users',
            value: toNumber(queryResults.totalActiveContacts[0].total),
            change:
              toNumber(queryResults.totalActiveContacts[0].total) -
              toNumber(queryResults.totalActiveContactsPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Active Users',
                description: 'Number of active users',
                value: toNumber(queryResults.totalActiveContacts[0].total),
                change:
                  toNumber(queryResults.totalActiveContacts[0].total) -
                  toNumber(
                    queryResults.totalActiveContactsPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfActiveContacts.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActiveContactsWithConversations.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  _countValue,
                  _countType,
                }) => ({
                  id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  tags: [
                    { name: _countType, value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // conversation
          {
            title: 'Total Conversations',
            description: 'Number of conversations handled',
            value: toNumber(queryResults.totalConversations[0].total),
            change:
              toNumber(queryResults.totalConversations[0].total) -
              toNumber(queryResults.totalConversationsPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Conversations',
                description: 'Number of conversations handled',
                value: toNumber(queryResults.totalConversations[0].total),
                change:
                  toNumber(queryResults.totalConversations[0].total) -
                  toNumber(
                    queryResults.totalConversationsPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfConversations.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActiveContactsWithConversations.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  _countValue,
                }) => ({
                  id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  tags: [
                    { name: 'conversation', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // message
          {
            title: 'Total Messages',
            description: 'Number of messages exchanged',
            value: toNumber(queryResults.totalMessages[0].total),
            change:
              toNumber(queryResults.totalMessages[0].total) -
              toNumber(queryResults.totalMessagesPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Messages',
                description: 'Number of messages exchanged',
                value: toNumber(queryResults.totalMessages[0].total),
                change:
                  toNumber(queryResults.totalMessages[0].total) -
                  toNumber(queryResults.totalMessagesPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActiveContactsWithMessages.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'message', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },
          {
            title: 'Total User Requests',
            description: 'Number of user requests processed',
            value: toNumber(queryResults.totalUserMessages[0].total),
            change:
              toNumber(queryResults.totalUserMessages[0].total) -
              toNumber(queryResults.totalUserMessagesPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total User Requests',
                description: 'Number of user requests processed',
                value: toNumber(queryResults.totalUserMessages[0].total),
                change:
                  toNumber(queryResults.totalUserMessages[0].total) -
                  toNumber(
                    queryResults.totalUserMessagesPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfUserMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },
            },
          },
          {
            title: 'Total Agent Responses',
            description: 'Number of agent responses delivered',
            value: toNumber(queryResults.totalBotMessages[0].total),
            change:
              toNumber(queryResults.totalBotMessages[0].total) -
              toNumber(queryResults.totalBotMessagesPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Agent Responses',
                description: 'Number of agent responses delivered',
                value: toNumber(queryResults.totalBotMessages[0].total),
                change:
                  toNumber(queryResults.totalBotMessages[0].total) -
                  toNumber(
                    queryResults.totalBotMessagesPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfBotMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },
            },
          },
          {
            title: 'Total Agent Actions',
            description: 'Number of agent actions taken',
            value: toNumber(queryResults.totalActivityMessages[0].total),
            change:
              toNumber(queryResults.totalActivityMessages[0].total) -
              toNumber(
                queryResults.totalActivityMessagesPreviousPeriod[0].total
              ),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Agent Actions',
                description: 'Number of agent actions taken',
                value: toNumber(queryResults.totalActivityMessages[0].total),
                change:
                  toNumber(queryResults.totalActivityMessages[0].total) -
                  toNumber(
                    queryResults.totalActivityMessagesPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfActivityMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActions.map(
                ({ type, name, description, _countValue }) => ({
                  id: type,
                  name: name || type,
                  description: description || `Action type: ${type}`,
                  tags: [{ name: 'action', value: _countValue }],
                })
              ),
            },
          },
          {
            title: 'Average Number of User Requests per Conversation',
            description:
              'Average number of user messages taken in conversations',
            value: toNumber(
              queryResults.averageUserMessagesPerConversation[0].average
            ),
            period: `last ${periodDays} days`,
          },
          {
            title: 'Average Number of Agent Responses per Conversation',
            description:
              'Average number of agent messages taken in conversations',
            value: toNumber(
              queryResults.averageBotMessagesPerConversation[0].average
            ),
            period: `last ${periodDays} days`,
          },
          {
            title: 'Average Number of Actions per Conversation',
            description: 'Average number of actions taken in conversations',
            value: toNumber(
              queryResults.averageActivityMessagesPerConversation[0].average
            ),
            period: `last ${periodDays} days`,
          },
        ],
      }
    },

    createdAt: new Date('2025-11-19T00:00:00Z'),
    updatedAt: new Date('2025-11-19T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Comprehensive Overview Report
   *
   * **ID:** `clr3m5n8k000d08jqar7s8t4n`
   *
   * Combines ratings, contacts, conversations, and messages into a single
   * response. Each entry in the `data` array includes an optional `details`
   * object with a `metric` summary, a `chart` (line series), and a ranked
   * `list` of related contacts or actions.
   *
   * **Input:** `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `data` | `array` | Array of `{ title, description, value, change, period, details }` items |
   *
   * Metrics included: Total Ratings, Thumbs Up, Thumbs Down, Total Users,
   * Active Users, Total Conversations, Total Messages, Total User Requests,
   * Total Agent Responses, Total Agent Actions, and the three averages.
   */

  // ---

  // Bot Stats Report

  clr3m5n8k000e08jqbs0t1u5o: createReport({
    name: 'Bot Stats Report',
    description:
      'Statistics for a specific bot including conversations, messages, token consumption, ratings, and sentiment signal',

    input: z.object({
      botId: z.string().describe('The ID of the bot to get stats for'),
      periodDays: z.number().int().positive().default(DEFAULT_PERIOD),
    }),
    output: z.object({
      totalConversations: z.number(),
      totalMessages: z.number(),
      totalTokens: z.number(),
      totalRatings: z.number(),
      thumbsUp: z.number(),
      thumbsDown: z.number(),
      sentimentSignal: z
        .enum(['positive', 'negative', 'neutral', 'unknown'])
        .describe(
          'Overall sentiment based on ratings: positive if more thumbs up, negative if more thumbs down, neutral if equal, unknown if no ratings'
        ),
      period: z.string(),
    }),

    handler: async (session, data) => {
      // @note verify bot ownership to prevent cross-account data leakage
      const bot = await prisma.bot.findFirst({
        where: {
          id: data.botId,
          userId: session.user.id,
        },
        select: { id: true },
      })

      if (!bot) {
        return throwNotFound('Bot not found')
      }

      const periodEnd = new Date()
      const periodDays = data.periodDays ?? DEFAULT_PERIOD
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const [conversationsResult, messagesResult, ratingsResult, usageResult] =
        await Promise.all([
          prisma.conversation.count({
            where: {
              userId: session.user.id,
              botId: data.botId,
              createdAt: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
          }),
          prisma.message.count({
            where: {
              conversation: {
                userId: session.user.id,
                botId: data.botId,
              },
              createdAt: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
          }),
          prisma.rating.groupBy({
            by: ['value'],
            where: {
              userId: session.user.id,
              botId: data.botId,
              createdAt: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
            _count: {
              value: true,
            },
          }),
          prisma.$queryRawTyped(
            getBotUsageStats(
              session.user.id,
              data.botId,
              periodStart,
              periodEnd
            )
          ),
        ])

      // @note get token count from usage stats query
      const totalTokens = toNumber(usageResult[0]?.totalTokens || 0)

      // @note calculate thumbs up/down from ratings grouped by value
      let thumbsUp = 0
      let thumbsDown = 0
      let totalRatings = 0

      for (const rating of ratingsResult) {
        const count = rating._count.value

        totalRatings += count

        if (rating.value > 0) {
          thumbsUp += count
        } else if (rating.value < 0) {
          thumbsDown += count
        }
      }

      // @note determine sentiment signal based on thumbs up vs thumbs down
      let sentimentSignal: 'positive' | 'negative' | 'neutral' | 'unknown' =
        'unknown'

      if (totalRatings > 0) {
        if (thumbsUp > thumbsDown) {
          sentimentSignal = 'positive'
        } else if (thumbsDown > thumbsUp) {
          sentimentSignal = 'negative'
        } else {
          sentimentSignal = 'neutral'
        }
      }

      return {
        totalConversations: conversationsResult,
        totalMessages: messagesResult,
        totalTokens,
        totalRatings,
        thumbsUp,
        thumbsDown,
        sentimentSignal,
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2025-01-17T00:00:00Z'),
    updatedAt: new Date('2025-01-17T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Bot Stats Report
   *
   * **ID:** `clr3m5n8k000e08jqbs0t1u5o`
   *
   * Core performance snapshot for a single bot covering conversations,
   * messages, token consumption, ratings, and overall sentiment signal.
   *
   * **Input**
   *
   * | Parameter | Type | Default | Description |
   * |-----------|------|---------|-------------|
   * | `botId` | `string` | - | ID of the bot to analyse |
   * | `periodDays` | `integer` | `30` | Look-back window |
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `totalConversations` | `number` | Conversations in period |
   * | `totalMessages` | `number` | Messages in period |
   * | `totalTokens` | `number` | Tokens consumed in period |
   * | `totalRatings` | `number` | Ratings received |
   * | `thumbsUp` | `number` | Positive rating count |
   * | `thumbsDown` | `number` | Negative rating count |
   * | `sentimentSignal` | `string` | `positive`, `negative`, `neutral`, or `unknown` |
   * | `period` | `string` | Analysed time window |
   */

  // ---

  // Alerts Report

  clr3m5n8k000f08jqcs1u2v6p: createReport({
    name: 'Alerts Report',
    description:
      'Compiles a list of alerts for the current user including usage warnings, limit warnings, and sentiment alerts',

    input: PeriodInputSchema,
    output: z.object({
      alerts: z.array(
        z.object({
          type: z
            .enum([
              'usageSpike',
              'limit',
              'sentiment',
              'activity',
              'negativeFeedback',
            ])
            .describe('The type of alert'),
          severity: z
            .enum(['info', 'warning', 'critical'])
            .describe(
              'Alert severity: info for 20%+ spike, warning for 50%+ spike, critical for 100%+ spike'
            ),
          title: z.string().describe('Short title for the alert'),
          message: z.string().describe('Detailed alert message'),
          metric: z
            .object({
              current: z.number().describe('Current value of the metric'),
              baseline: z
                .number()
                .optional()
                .describe(
                  'Reference value for comparison: average for spikes, limit for database alerts, or total for ratios'
                ),
              percentage: z
                .number()
                .optional()
                .describe('Percentage change or ratio from the baseline'),
            })
            .optional(),
        })
      ),
      summary: z.object({
        totalAlerts: z.number(),
        criticalCount: z.number(),
        warningCount: z.number(),
        infoCount: z.number(),
      }),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? DEFAULT_PERIOD
      const periodStart = timePlusDays(-periodDays, periodEnd)

      // @note get user with plan info for limit checking

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          billingSubscriptionId: true,
          billingSubscriptionStatus: true,
          parentId: true,
        },
      })

      if (!user) {
        return {
          alerts: [],
          summary: {
            totalAlerts: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
          },
          period: `last ${periodDays} days`,
        }
      }

      const alerts: Array<{
        type:
          | 'usageSpike'
          | 'limit'
          | 'sentiment'
          | 'activity'
          | 'negativeFeedback'
        severity: 'info' | 'warning' | 'critical'
        title: string
        message: string
        metric?: {
          current: number
          baseline?: number
          percentage?: number
        }
      }> = []

      // @note get plan and limits for the user

      const { plan } = await revealUserPlan(user)

      const planLimits = limits[plan]

      // @note gather usage and metrics data in parallel

      const [
        usageSeries,
        conversationsResult,
        thumbsUpResult,
        thumbsDownResult,
        datasetsCount,
        recordsCount,
        skillsetsCount,
        abilitiesCount,
        filesCount,
        previousConversationsResult,
      ] = await Promise.all([
        getUsageSeriesNow(session.user.id, periodDays),
        prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),
        prisma.$queryRawTyped(
          getTotalThumbsUpOverPeriod(session.user.id, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalThumbsDownOverPeriod(session.user.id, periodStart, periodEnd)
        ),
        getApproximateTotalDatasets(user),
        getApproximateTotalRecords(user),
        getApproximateTotalSkillsets(user),
        getApproximateTotalAbilities(user),
        getApproximateTotalFiles(user),
        prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),
      ])

      // @note helper to detect usage spikes and generate alerts

      function detectUsageSpike(
        series: { total: number }[],
        metricName: string,
        unit: string = ''
      ) {
        if (series.length < 3) {
          return
        }

        const mostRecent = series[series.length - 1]?.total || 0
        const previous = series.slice(0, -1)
        const average =
          previous.reduce((sum, d) => sum + d.total, 0) / previous.length

        if (average <= 0) {
          return
        }

        const spikePercentage = ((mostRecent - average) / average) * 100

        if (spikePercentage < 20) {
          return
        }

        const unitSuffix = unit ? ` ${unit}` : ''
        const severity: 'info' | 'warning' | 'critical' =
          spikePercentage >= 100
            ? 'critical'
            : spikePercentage >= 50
              ? 'warning'
              : 'info'

        const title =
          severity === 'critical'
            ? `Critical ${metricName} Spike`
            : severity === 'warning'
              ? `${metricName} Spike Detected`
              : `Elevated ${metricName}`

        const verb = severity === 'critical' ? 'spiked' : 'is'

        alerts.push({
          type: 'usageSpike',
          severity,
          title,
          message: `${metricName} ${verb} ${spikePercentage.toFixed(0)}% above average (${mostRecent.toLocaleString()} vs ${Number(average.toFixed(0)).toLocaleString()} average${unitSuffix}).`,
          metric: {
            current: mostRecent,
            baseline: average,
            percentage: spikePercentage,
          },
        })
      }

      // @note detect usage spikes for tokens, conversations, and messages

      detectUsageSpike(usageSeries.tokens, 'Token usage', 'tokens')
      detectUsageSpike(usageSeries.conversations, 'Conversation volume')
      detectUsageSpike(usageSeries.messages, 'Message volume')

      // @note check database limit alerts

      const databaseLimits = planLimits.database

      // @note datasets limit check

      if (databaseLimits.datasets !== Infinity && databaseLimits.datasets > 0) {
        const datasetsPercentage =
          (datasetsCount / databaseLimits.datasets) * 100

        if (datasetsPercentage >= 100) {
          alerts.push({
            type: 'limit',
            severity: 'warning',
            title: 'Dataset Limit Reached',
            message: `You have reached your dataset limit (${datasetsCount} of ${databaseLimits.datasets} datasets).`,
            metric: {
              current: datasetsCount,
              baseline: databaseLimits.datasets,
              percentage: datasetsPercentage,
            },
          })
        } else if (datasetsPercentage >= 80) {
          alerts.push({
            type: 'limit',
            severity: 'info',
            title: 'Approaching Dataset Limit',
            message: `You have used ${datasetsPercentage.toFixed(1)}% of your dataset limit.`,
            metric: {
              current: datasetsCount,
              baseline: databaseLimits.datasets,
              percentage: datasetsPercentage,
            },
          })
        }
      }

      // @note records limit check

      if (databaseLimits.records !== Infinity && databaseLimits.records > 0) {
        const recordsPercentage = (recordsCount / databaseLimits.records) * 100

        if (recordsPercentage >= 100) {
          alerts.push({
            type: 'limit',
            severity: 'warning',
            title: 'Records Limit Reached',
            message: `You have reached your records limit (${recordsCount.toLocaleString()} of ${databaseLimits.records.toLocaleString()} records).`,
            metric: {
              current: recordsCount,
              baseline: databaseLimits.records,
              percentage: recordsPercentage,
            },
          })
        } else if (recordsPercentage >= 80) {
          alerts.push({
            type: 'limit',
            severity: 'info',
            title: 'Approaching Records Limit',
            message: `You have used ${recordsPercentage.toFixed(1)}% of your records limit.`,
            metric: {
              current: recordsCount,
              baseline: databaseLimits.records,
              percentage: recordsPercentage,
            },
          })
        }
      }

      // @note abilities limit check

      if (
        databaseLimits.abilities !== Infinity &&
        databaseLimits.abilities > 0
      ) {
        const abilitiesPercentage =
          (abilitiesCount / databaseLimits.abilities) * 100

        if (abilitiesPercentage >= 100) {
          alerts.push({
            type: 'limit',
            severity: 'warning',
            title: 'Abilities Limit Reached',
            message: `You have reached your abilities limit (${abilitiesCount} of ${databaseLimits.abilities} abilities).`,
            metric: {
              current: abilitiesCount,
              baseline: databaseLimits.abilities,
              percentage: abilitiesPercentage,
            },
          })
        } else if (abilitiesPercentage >= 80) {
          alerts.push({
            type: 'limit',
            severity: 'info',
            title: 'Approaching Abilities Limit',
            message: `You have used ${abilitiesPercentage.toFixed(1)}% of your abilities limit.`,
            metric: {
              current: abilitiesCount,
              baseline: databaseLimits.abilities,
              percentage: abilitiesPercentage,
            },
          })
        }
      }

      // @note skillsets limit check

      if (
        databaseLimits.skillsets !== Infinity &&
        databaseLimits.skillsets > 0
      ) {
        const skillsetsPercentage =
          (skillsetsCount / databaseLimits.skillsets) * 100

        if (skillsetsPercentage >= 100) {
          alerts.push({
            type: 'limit',
            severity: 'warning',
            title: 'Skillsets Limit Reached',
            message: `You have reached your skillsets limit (${skillsetsCount} of ${databaseLimits.skillsets} skillsets).`,
            metric: {
              current: skillsetsCount,
              baseline: databaseLimits.skillsets,
              percentage: skillsetsPercentage,
            },
          })
        } else if (skillsetsPercentage >= 80) {
          alerts.push({
            type: 'limit',
            severity: 'info',
            title: 'Approaching Skillsets Limit',
            message: `You have used ${skillsetsPercentage.toFixed(1)}% of your skillsets limit.`,
            metric: {
              current: skillsetsCount,
              baseline: databaseLimits.skillsets,
              percentage: skillsetsPercentage,
            },
          })
        }
      }

      // @note files limit check

      if (databaseLimits.files !== Infinity && databaseLimits.files > 0) {
        const filesPercentage = (filesCount / databaseLimits.files) * 100

        if (filesPercentage >= 100) {
          alerts.push({
            type: 'limit',
            severity: 'warning',
            title: 'Files Limit Reached',
            message: `You have reached your files limit (${filesCount} of ${databaseLimits.files} files).`,
            metric: {
              current: filesCount,
              baseline: databaseLimits.files,
              percentage: filesPercentage,
            },
          })
        } else if (filesPercentage >= 80) {
          alerts.push({
            type: 'limit',
            severity: 'info',
            title: 'Approaching Files Limit',
            message: `You have used ${filesPercentage.toFixed(1)}% of your files limit.`,
            metric: {
              current: filesCount,
              baseline: databaseLimits.files,
              percentage: filesPercentage,
            },
          })
        }
      }

      // @note check sentiment/feedback alerts

      const thumbsUp = toNumber(thumbsUpResult[0].total)
      const thumbsDown = toNumber(thumbsDownResult[0].total)
      const totalRatings = thumbsUp + thumbsDown

      if (totalRatings >= 10) {
        const negativeRatio = thumbsDown / totalRatings

        if (negativeRatio >= 0.5) {
          alerts.push({
            type: 'negativeFeedback',
            severity: 'critical',
            title: 'High Negative Feedback',
            message: `${(negativeRatio * 100).toFixed(1)}% of your ratings are negative (${thumbsDown} thumbs down out of ${totalRatings} total ratings). Consider reviewing your bot responses.`,
            metric: {
              current: thumbsDown,
              baseline: totalRatings,
              percentage: negativeRatio * 100,
            },
          })
        } else if (negativeRatio >= 0.3) {
          alerts.push({
            type: 'negativeFeedback',
            severity: 'warning',
            title: 'Elevated Negative Feedback',
            message: `${(negativeRatio * 100).toFixed(1)}% of your ratings are negative. Monitor your bot performance.`,
            metric: {
              current: thumbsDown,
              baseline: totalRatings,
              percentage: negativeRatio * 100,
            },
          })
        }
      }

      // @note check for activity spikes

      const currentConversations = toNumber(conversationsResult[0].total)
      const previousConversations = toNumber(
        previousConversationsResult[0].total
      )

      if (previousConversations > 0) {
        const conversationChange =
          ((currentConversations - previousConversations) /
            previousConversations) *
          100

        // @note alert on significant increase (more than 200% increase)

        if (conversationChange >= 200) {
          alerts.push({
            type: 'activity',
            severity: 'info',
            title: 'Significant Activity Increase',
            message: `Conversation volume increased by ${conversationChange.toFixed(0)}% compared to the previous period (${currentConversations.toLocaleString()} vs ${previousConversations.toLocaleString()} conversations).`,
            metric: {
              current: currentConversations,
              baseline: previousConversations,
              percentage: conversationChange,
            },
          })
        }
      }

      // @note calculate summary

      const criticalCount = alerts.filter(
        (a) => a.severity === 'critical'
      ).length
      const warningCount = alerts.filter((a) => a.severity === 'warning').length
      const infoCount = alerts.filter((a) => a.severity === 'info').length

      return {
        alerts,
        summary: {
          totalAlerts: alerts.length,
          criticalCount,
          warningCount,
          infoCount,
        },
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2026-01-28T00:00:00Z'),
    updatedAt: new Date('2026-01-28T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Alerts Report
   *
   * **ID:** `clr3m5n8k000f08jqcs1u2v6p`
   *
   * Account-level alert system that monitors usage spikes (tokens,
   * conversations, messages), database resource limits (datasets, records,
   * skillsets, abilities, files), overall sentiment degradation, and
   * significant activity increases.
   *
   * **Input:** `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `alerts` | `array` | `{ type, severity, title, message, metric }` entries |
   * | `summary` | `object` | `{ totalAlerts, criticalCount, warningCount, infoCount }` |
   * | `period` | `string` | Analysed time window |
   *
   * Alert types: `usageSpike`, `limit`, `sentiment`, `activity`,
   * `negativeFeedback`. Severity levels: `info` (20%+ spike), `warning`
   * (50%+ spike or 80%+ limit), `critical` (100%+ spike or limit reached).
   */

  // ---

  // Bot Performance Report

  clr3m5n8k000g08jqdt1u2v7q: createReport({
    name: 'Bot Performance Report',
    description:
      'Per-bot performance metrics with period-over-period trends and daily breakdowns for conversations, messages, tokens, and ratings',

    input: z.object({
      botId: z.string().describe('The ID of the bot to get performance for'),
      periodDays: z.number().int().positive().default(DEFAULT_PERIOD),
    }),
    output: z.object({
      conversations: z.object({
        current: z.number(),
        previous: z.number(),
        change: z.number(),
        breakdown: z.array(z.object({ date: z.string(), total: z.number() })),
      }),
      messages: z.object({
        current: z.number(),
        previous: z.number(),
        change: z.number(),
        breakdown: z.array(z.object({ date: z.string(), total: z.number() })),
      }),
      tokens: z.object({
        current: z.number(),
        previous: z.number(),
        change: z.number(),
        breakdown: z.array(z.object({ date: z.string(), total: z.number() })),
      }),
      ratings: z.object({
        thumbsUp: z.number(),
        thumbsDown: z.number(),
        total: z.number(),
        change: z.number(),
        sentimentSignal: z.enum(['positive', 'negative', 'neutral', 'unknown']),
        breakdown: z.array(
          z.object({
            date: z.string(),
            total: z.number(),
            thumbsUp: z.number(),
            thumbsDown: z.number(),
          })
        ),
      }),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const bot = await prisma.bot.findFirst({
        where: { id: data.botId, userId: session.user.id },
        select: { id: true },
      })

      if (!bot) {
        return throwNotFound('Bot not found')
      }

      const periodEnd = new Date()
      const periodDays = data.periodDays ?? DEFAULT_PERIOD
      const periodStart = timePlusDays(-periodDays, periodEnd)
      const previousPeriodStart = timePlusDays(-periodDays, periodStart)

      // @note run all queries in parallel for performance

      const [
        currentConversations,
        previousConversations,
        conversationBreakdown,
        currentMessages,
        previousMessages,
        messageBreakdown,
        currentUsage,
        previousUsage,
        tokenBreakdown,
        currentRatings,
        previousRatings,
        ratingBreakdown,
      ] = await Promise.all([
        // conversations
        prisma.conversation.count({
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),
        prisma.conversation.count({
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),
        prisma.$queryRawTyped(
          getBotConversationCountByDay(
            session.user.id,
            data.botId,
            periodStart,
            periodEnd
          )
        ),

        // messages
        prisma.message.count({
          where: {
            conversation: { userId: session.user.id, botId: data.botId },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),
        prisma.message.count({
          where: {
            conversation: { userId: session.user.id, botId: data.botId },
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),
        prisma.$queryRawTyped(
          getBotMessageCountByDay(
            session.user.id,
            data.botId,
            periodStart,
            periodEnd
          )
        ),

        // tokens
        prisma.$queryRawTyped(
          getBotUsageStats(session.user.id, data.botId, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getBotUsageStats(
            session.user.id,
            data.botId,
            previousPeriodStart,
            periodStart
          )
        ),
        // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- @todo migrate to TypedSQL (prisma/sql)
        prisma.$queryRaw<{ date: Date; total: bigint }[]>`
          SELECT DATE(createdAt) AS date,
            COALESCE(SUM(CASE WHEN type = 'CHATBOTKIT_BASE_TOKEN' THEN count ELSE 0 END), 0) AS total
          FROM Usage
          WHERE userId = ${session.user.id}
            AND botId = ${data.botId}
            AND createdAt >= ${periodStart}
            AND createdAt <= ${periodEnd}
          GROUP BY DATE(createdAt)
          ORDER BY date ASC
        `,

        // ratings
        prisma.rating.groupBy({
          by: ['value'],
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          _count: { value: true },
        }),
        prisma.rating.groupBy({
          by: ['value'],
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
          _count: { value: true },
        }),
        // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- @todo migrate to TypedSQL (prisma/sql)
        prisma.$queryRaw<
          { date: Date; total: bigint; thumbsUp: bigint; thumbsDown: bigint }[]
        >`
          SELECT DATE(createdAt) AS date,
            COUNT(*) AS total,
            COUNT(CASE WHEN value > 0 THEN 1 END) AS thumbsUp,
            COUNT(CASE WHEN value < 0 THEN 1 END) AS thumbsDown
          FROM Rating
          WHERE userId = ${session.user.id}
            AND botId = ${data.botId}
            AND createdAt >= ${periodStart}
            AND createdAt <= ${periodEnd}
          GROUP BY DATE(createdAt)
          ORDER BY date ASC
        `,
      ])

      // @note compute thumbs up/down from grouped ratings

      let thumbsUp = 0
      let thumbsDown = 0
      let totalRatings = 0

      for (const r of currentRatings) {
        const count = r._count.value

        totalRatings += count

        if (r.value > 0) {
          thumbsUp += count
        } else if (r.value < 0) {
          thumbsDown += count
        }
      }

      let previousTotalRatings = 0

      for (const r of previousRatings) {
        previousTotalRatings += r._count.value
      }

      // @note derive sentiment signal from thumbs ratio

      let sentimentSignal: 'positive' | 'negative' | 'neutral' | 'unknown' =
        'unknown'

      if (totalRatings > 0) {
        if (thumbsUp > thumbsDown) {
          sentimentSignal = 'positive'
        } else if (thumbsDown > thumbsUp) {
          sentimentSignal = 'negative'
        } else {
          sentimentSignal = 'neutral'
        }
      }

      const currentTokens = toNumber(currentUsage[0]?.totalTokens || 0)
      const previousTokens = toNumber(previousUsage[0]?.totalTokens || 0)

      return {
        conversations: {
          current: currentConversations,
          previous: previousConversations,
          change: currentConversations - previousConversations,
          breakdown: conversationBreakdown.map(({ date, total }) => ({
            date: date == null ? '' : getYYYYMMDD(date),
            total: toNumber(total),
          })),
        },
        messages: {
          current: currentMessages,
          previous: previousMessages,
          change: currentMessages - previousMessages,
          breakdown: messageBreakdown.map(({ date, total }) => ({
            date: date == null ? '' : getYYYYMMDD(date),
            total: toNumber(total),
          })),
        },
        tokens: {
          current: currentTokens,
          previous: previousTokens,
          change: currentTokens - previousTokens,
          breakdown: tokenBreakdown.map(({ date, total }) => ({
            date: date == null ? '' : getYYYYMMDD(date),
            total: toNumber(total),
          })),
        },
        ratings: {
          thumbsUp,
          thumbsDown,
          total: totalRatings,
          change: totalRatings - previousTotalRatings,
          sentimentSignal,
          breakdown: ratingBreakdown.map(
            ({ date, total, thumbsUp, thumbsDown }) => ({
              date: date == null ? '' : getYYYYMMDD(date),
              total: toNumber(total),
              thumbsUp: toNumber(thumbsUp),
              thumbsDown: toNumber(thumbsDown),
            })
          ),
        },
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2026-02-20T00:00:00Z'),
    updatedAt: new Date('2026-02-20T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Bot Performance Report
   *
   * **ID:** `clr3m5n8k000g08jqdt1u2v7q`
   *
   * Period-over-period comparison for a bot across conversations, messages,
   * tokens, and ratings, each with daily breakdown charts.
   *
   * **Input:** `botId`, `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `conversations` | `object` | `{ current, previous, change, breakdown }` |
   * | `messages` | `object` | `{ current, previous, change, breakdown }` |
   * | `tokens` | `object` | `{ current, previous, change, breakdown }` |
   * | `ratings` | `object` | `{ thumbsUp, thumbsDown, total, change, sentimentSignal, breakdown }` |
   * | `period` | `string` | Analysed time window |
   */

  // ---

  // Bot Conversation Quality Report

  clr3m5n8k000h08jqeu2v3w8r: createReport({
    name: 'Bot Conversation Quality Report',
    description:
      'Per-bot conversation quality metrics including depth distribution, abandonment rate, token efficiency, and top actions used',

    input: z.object({
      botId: z
        .string()
        .describe('The ID of the bot to get quality metrics for'),
      periodDays: z.number().int().positive().default(DEFAULT_PERIOD),
    }),
    output: z.object({
      avgMessagesPerConversation: z.object({
        user: z.number(),
        bot: z.number(),
        activity: z.number(),
      }),
      conversationDepth: z.object({
        singleTurn: z
          .number()
          .describe('Conversations with exactly 1 user message'),
        short: z.number().describe('Conversations with 2-3 user messages'),
        medium: z.number().describe('Conversations with 4-10 user messages'),
        long: z
          .number()
          .describe('Conversations with more than 10 user messages'),
      }),
      totalConversations: z.number(),
      abandonmentRate: z
        .number()
        .describe('Percentage of single-turn conversations (0-100)'),
      avgTokensPerConversation: z.number(),
      avgTokensPerMessage: z.number(),
      topActions: z.array(
        z.object({
          type: z.string(),
          name: z.string(),
          count: z.number(),
        })
      ),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const bot = await prisma.bot.findFirst({
        where: { id: data.botId, userId: session.user.id },
        select: { id: true },
      })

      if (!bot) {
        return throwNotFound('Bot not found')
      }

      const periodEnd = new Date()
      const periodDays = data.periodDays ?? DEFAULT_PERIOD
      const periodStart = timePlusDays(-periodDays, periodEnd)

      // @note run all queries in parallel

      const [
        depthBuckets,
        avgUserMessages,
        avgBotMessages,
        avgActivityMessages,
        usageStats,
        totalMessages,
        topActions,
      ] = await Promise.all([
        // @note conversation depth distribution by counting user messages per conversation
        // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- @todo migrate to TypedSQL (prisma/sql)
        prisma.$queryRaw<{ bucket: string; total: bigint }[]>`
          SELECT
            CASE
              WHEN userMsgCount = 1 THEN 'singleTurn'
              WHEN userMsgCount BETWEEN 2 AND 3 THEN 'short'
              WHEN userMsgCount BETWEEN 4 AND 10 THEN 'medium'
              ELSE 'long'
            END AS bucket,
            COUNT(*) AS total
          FROM (
            SELECT c.id,
              COUNT(CASE WHEN m.type = ${MessageType.user} THEN 1 END) AS userMsgCount
            FROM Conversation c
            LEFT JOIN Message m ON m.conversationId = c.id
            WHERE c.userId = ${session.user.id}
              AND c.botId = ${data.botId}
              AND c.createdAt >= ${periodStart}
              AND c.createdAt <= ${periodEnd}
            GROUP BY c.id
          ) AS convCounts
          GROUP BY bucket
        `,

        // @note average user messages per conversation
        // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- @todo migrate to TypedSQL (prisma/sql)
        prisma.$queryRaw<{ average: number | null }[]>`
          SELECT AVG(msgCount) AS average
          FROM (
            SELECT COUNT(*) AS msgCount
            FROM Message m
            JOIN Conversation c ON c.id = m.conversationId
            WHERE c.userId = ${session.user.id}
              AND c.botId = ${data.botId}
              AND m.type = ${MessageType.user}
              AND m.createdAt >= ${periodStart}
              AND m.createdAt <= ${periodEnd}
            GROUP BY m.conversationId
          ) AS counts
        `,

        // @note average bot messages per conversation
        // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- @todo migrate to TypedSQL (prisma/sql)
        prisma.$queryRaw<{ average: number | null }[]>`
          SELECT AVG(msgCount) AS average
          FROM (
            SELECT COUNT(*) AS msgCount
            FROM Message m
            JOIN Conversation c ON c.id = m.conversationId
            WHERE c.userId = ${session.user.id}
              AND c.botId = ${data.botId}
              AND m.type = ${MessageType.bot}
              AND m.createdAt >= ${periodStart}
              AND m.createdAt <= ${periodEnd}
            GROUP BY m.conversationId
          ) AS counts
        `,

        // @note average activity messages per conversation
        // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- @todo migrate to TypedSQL (prisma/sql)
        prisma.$queryRaw<{ average: number | null }[]>`
          SELECT AVG(msgCount) AS average
          FROM (
            SELECT COUNT(*) AS msgCount
            FROM Message m
            JOIN Conversation c ON c.id = m.conversationId
            WHERE c.userId = ${session.user.id}
              AND c.botId = ${data.botId}
              AND m.type = ${MessageType.activity}
              AND m.createdAt >= ${periodStart}
              AND m.createdAt <= ${periodEnd}
            GROUP BY m.conversationId
          ) AS counts
        `,

        // @note token usage stats for this bot
        prisma.$queryRawTyped(
          getBotUsageStats(session.user.id, data.botId, periodStart, periodEnd)
        ),

        // @note total messages for token-per-message calculation
        prisma.message.count({
          where: {
            conversation: { userId: session.user.id, botId: data.botId },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),

        // @note top actions for this bot from event logs
        // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- @todo migrate to TypedSQL (prisma/sql)
        prisma.$queryRaw<{ type: string; name: string; total: bigint }[]>`
          SELECT el.type, COALESCE(el.name, el.type) AS name, COUNT(*) AS total
          FROM EventLog el
          WHERE el.userId = ${session.user.id}
            AND el.botId = ${data.botId}
            AND el.type LIKE 'action.%'
            AND el.createdAt >= ${periodStart}
            AND el.createdAt <= ${periodEnd}
          GROUP BY el.type, el.name
          ORDER BY total DESC
          LIMIT 10
        `,
      ])

      // @note map depth buckets to structured output

      const depthMap: Record<string, number> = {}

      for (const row of depthBuckets) {
        depthMap[row.bucket] = toNumber(row.total)
      }

      const singleTurn = depthMap['singleTurn'] || 0
      const short = depthMap['short'] || 0
      const medium = depthMap['medium'] || 0
      const long = depthMap['long'] || 0
      const totalConversations = singleTurn + short + medium + long

      const totalTokens = toNumber(usageStats[0]?.totalTokens || 0)

      return {
        avgMessagesPerConversation: {
          user: toNumber(avgUserMessages[0]?.average || 0),
          bot: toNumber(avgBotMessages[0]?.average || 0),
          activity: toNumber(avgActivityMessages[0]?.average || 0),
        },
        conversationDepth: {
          singleTurn,
          short,
          medium,
          long,
        },
        totalConversations,
        abandonmentRate:
          totalConversations > 0
            ? toNumber(
                Number(((singleTurn / totalConversations) * 100).toFixed(1))
              )
            : 0,
        avgTokensPerConversation:
          totalConversations > 0
            ? toNumber(Number((totalTokens / totalConversations).toFixed(1)))
            : 0,
        avgTokensPerMessage:
          totalMessages > 0
            ? toNumber(Number((totalTokens / totalMessages).toFixed(1)))
            : 0,
        topActions: topActions.map(({ type, name, total }) => ({
          type,
          name: name || type,
          count: toNumber(total),
        })),
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2026-02-20T00:00:00Z'),
    updatedAt: new Date('2026-02-20T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Bot Conversation Quality Report
   *
   * **ID:** `clr3m5n8k000h08jqeu2v3w8r`
   *
   * Analyses conversation depth distribution, abandonment rate (single-turn
   * conversations), token efficiency, and the most-used action types.
   *
   * **Input:** `botId`, `periodDays`
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `avgMessagesPerConversation` | `object` | `{ user, bot, activity }` averages |
   * | `conversationDepth` | `object` | Buckets: `singleTurn`, `short` (2-3), `medium` (4-10), `long` (10+) |
   * | `totalConversations` | `number` | Total conversations analysed |
   * | `abandonmentRate` | `number` | Percentage of single-turn conversations |
   * | `avgTokensPerConversation` | `number` | Mean tokens per conversation |
   * | `avgTokensPerMessage` | `number` | Mean tokens per message |
   * | `topActions` | `array` | Top `{ type, name, count }` action entries |
   * | `period` | `string` | Analysed time window |
   */

  // ---

  // Bot Alerts Report

  clr3m5n8k000i08jqfv3w4x9s: createReport({
    name: 'Bot Alerts Report',
    description:
      'Per-bot alerts detecting negative feedback surges, token spikes, conversation drops, and abandonment increases',

    input: z.object({
      botId: z.string().describe('The ID of the bot to check alerts for'),
      periodDays: z.number().int().positive().default(7),
    }),
    output: z.object({
      alerts: z.array(
        z.object({
          type: z
            .enum([
              'negativeFeedback',
              'tokenSpike',
              'conversationDrop',
              'abandonmentSpike',
            ])
            .describe('The type of bot-specific alert'),
          severity: z.enum(['info', 'warning', 'critical']),
          title: z.string(),
          message: z.string(),
          metric: z
            .object({
              current: z.number(),
              baseline: z.number().optional(),
              percentage: z.number().optional(),
            })
            .optional(),
        })
      ),
      summary: z.object({
        totalAlerts: z.number(),
        criticalCount: z.number(),
        warningCount: z.number(),
        infoCount: z.number(),
      }),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const bot = await prisma.bot.findFirst({
        where: { id: data.botId, userId: session.user.id },
        select: { id: true, name: true },
      })

      if (!bot) {
        return throwNotFound('Bot not found')
      }

      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 7
      const periodStart = timePlusDays(-periodDays, periodEnd)
      const previousPeriodStart = timePlusDays(-periodDays, periodStart)

      const alerts: Array<{
        type:
          | 'negativeFeedback'
          | 'tokenSpike'
          | 'conversationDrop'
          | 'abandonmentSpike'
        severity: 'info' | 'warning' | 'critical'
        title: string
        message: string
        metric?: {
          current: number
          baseline?: number
          percentage?: number
        }
      }> = []

      // @note gather all data in parallel

      const [
        currentUsage,
        previousUsage,
        currentConversations,
        previousConversations,
        currentRatings,
        currentSingleTurn,
        currentTotalConvs,
        previousSingleTurn,
        previousTotalConvs,
      ] = await Promise.all([
        prisma.$queryRawTyped(
          getBotUsageStats(session.user.id, data.botId, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getBotUsageStats(
            session.user.id,
            data.botId,
            previousPeriodStart,
            periodStart
          )
        ),
        prisma.conversation.count({
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),
        prisma.conversation.count({
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),
        prisma.rating.groupBy({
          by: ['value'],
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          _count: { value: true },
        }),

        // @note single-turn conversations (current period)
        prisma.$queryRawTyped(
          getBotSingleTurnConversationCount(
            MessageType.user,
            session.user.id,
            data.botId,
            periodStart,
            periodEnd
          )
        ),
        prisma.$queryRawTyped(
          getBotConversationsWithUserMessageCount(
            MessageType.user,
            session.user.id,
            data.botId,
            periodStart,
            periodEnd
          )
        ),

        // @note single-turn conversations (previous period)
        prisma.$queryRawTyped(
          getBotSingleTurnConversationCount(
            MessageType.user,
            session.user.id,
            data.botId,
            previousPeriodStart,
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          getBotConversationsWithUserMessageCount(
            MessageType.user,
            session.user.id,
            data.botId,
            previousPeriodStart,
            periodStart
          )
        ),
      ])

      // @note check negative feedback

      let thumbsUp = 0
      let thumbsDown = 0
      let totalRatings = 0

      for (const r of currentRatings) {
        const count = r._count.value

        totalRatings += count

        if (r.value > 0) {
          thumbsUp += count
        } else if (r.value < 0) {
          thumbsDown += count
        }
      }

      if (totalRatings >= 3) {
        const negativeRatio = thumbsDown / totalRatings

        if (negativeRatio >= 0.5) {
          alerts.push({
            type: 'negativeFeedback',
            severity: 'critical',
            title: 'High Negative Feedback',
            message: `${(negativeRatio * 100).toFixed(0)}% of ratings are negative (${thumbsDown} of ${totalRatings}). Review recent conversations for issues.`,
            metric: {
              current: thumbsDown,
              baseline: totalRatings,
              percentage: negativeRatio * 100,
            },
          })
        } else if (negativeRatio >= 0.3) {
          alerts.push({
            type: 'negativeFeedback',
            severity: 'warning',
            title: 'Elevated Negative Feedback',
            message: `${(negativeRatio * 100).toFixed(0)}% of ratings are negative. Monitor bot responses.`,
            metric: {
              current: thumbsDown,
              baseline: totalRatings,
              percentage: negativeRatio * 100,
            },
          })
        }
      }

      // @note check token spike

      const currentTokens = toNumber(currentUsage[0]?.totalTokens || 0)
      const previousTokens = toNumber(previousUsage[0]?.totalTokens || 0)

      if (previousTokens > 0) {
        const tokenChange =
          ((currentTokens - previousTokens) / previousTokens) * 100

        if (tokenChange >= 100) {
          alerts.push({
            type: 'tokenSpike',
            severity: 'critical',
            title: 'Token Usage Spike',
            message: `Token usage increased ${tokenChange.toFixed(0)}% vs previous period (${currentTokens.toLocaleString()} vs ${previousTokens.toLocaleString()}).`,
            metric: {
              current: currentTokens,
              baseline: previousTokens,
              percentage: tokenChange,
            },
          })
        } else if (tokenChange >= 50) {
          alerts.push({
            type: 'tokenSpike',
            severity: 'warning',
            title: 'Elevated Token Usage',
            message: `Token usage is ${tokenChange.toFixed(0)}% above previous period.`,
            metric: {
              current: currentTokens,
              baseline: previousTokens,
              percentage: tokenChange,
            },
          })
        }
      }

      // @note check conversation drop

      if (previousConversations >= 5) {
        const convChange =
          ((currentConversations - previousConversations) /
            previousConversations) *
          100

        if (convChange <= -50) {
          alerts.push({
            type: 'conversationDrop',
            severity: convChange <= -75 ? 'critical' : 'warning',
            title:
              convChange <= -75
                ? 'Severe Conversation Drop'
                : 'Conversation Volume Declining',
            message: `Conversations dropped ${Math.abs(convChange).toFixed(0)}% vs previous period (${currentConversations} vs ${previousConversations}).`,
            metric: {
              current: currentConversations,
              baseline: previousConversations,
              percentage: convChange,
            },
          })
        }
      }

      // @note check abandonment spike

      const currentSingleTurnCount = toNumber(currentSingleTurn[0]?.total || 0)
      const currentTotalConversationsWithUserMessages = toNumber(
        currentTotalConvs[0]?.total || 0
      )
      const currentAbandonmentRate =
        currentTotalConversationsWithUserMessages > 0
          ? (currentSingleTurnCount /
              currentTotalConversationsWithUserMessages) *
            100
          : null

      const previousSingleTurnCount = toNumber(
        previousSingleTurn[0]?.total || 0
      )
      const previousTotalConversationsWithUserMessages = toNumber(
        previousTotalConvs[0]?.total || 0
      )
      const previousAbandonmentRate =
        previousTotalConversationsWithUserMessages > 0
          ? (previousSingleTurnCount /
              previousTotalConversationsWithUserMessages) *
            100
          : null

      if (
        currentTotalConversationsWithUserMessages >= 5 &&
        previousTotalConversationsWithUserMessages >= 5 &&
        currentAbandonmentRate !== null &&
        previousAbandonmentRate !== null &&
        currentAbandonmentRate > previousAbandonmentRate
      ) {
        const abandonmentIncrease =
          currentAbandonmentRate - previousAbandonmentRate

        if (abandonmentIncrease >= 20) {
          alerts.push({
            type: 'abandonmentSpike',
            severity: abandonmentIncrease >= 30 ? 'critical' : 'warning',
            title: 'Abandonment Rate Increasing',
            message: `Single-turn conversation rate rose from ${previousAbandonmentRate.toFixed(0)}% to ${currentAbandonmentRate.toFixed(0)}%. Users may not be finding responses helpful.`,
            metric: {
              current: currentAbandonmentRate,
              baseline: previousAbandonmentRate,
              percentage: abandonmentIncrease,
            },
          })
        }
      }

      const criticalCount = alerts.filter(
        (a) => a.severity === 'critical'
      ).length
      const warningCount = alerts.filter((a) => a.severity === 'warning').length
      const infoCount = alerts.filter((a) => a.severity === 'info').length

      return {
        alerts,
        summary: {
          totalAlerts: alerts.length,
          criticalCount,
          warningCount,
          infoCount,
        },
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2026-02-20T00:00:00Z'),
    updatedAt: new Date('2026-02-20T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Bot Alerts Report
   *
   * **ID:** `clr3m5n8k000i08jqfv3w4x9s`
   *
   * Detects four categories of bot-specific anomalies: high negative feedback,
   * token usage spikes, conversation volume drops, and abandonment rate
   * increases. Default window is 7 days for more responsive alerting.
   *
   * **Input**
   *
   * | Parameter | Type | Default | Description |
   * |-----------|------|---------|-------------|
   * | `botId` | `string` | - | ID of the bot to check |
   * | `periodDays` | `integer` | `7` | Look-back window |
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `alerts` | `array` | `{ type, severity, title, message, metric }` entries |
   * | `summary` | `object` | `{ totalAlerts, criticalCount, warningCount, infoCount }` |
   * | `period` | `string` | Analysed time window |
   *
   * Alert types: `negativeFeedback`, `tokenSpike`, `conversationDrop`,
   * `abandonmentSpike`. Severity levels: `info`, `warning`, `critical`.
   */

  // ---

  // Bot Negative Feedback Report

  clr3m5n8k000j08jqgw4x5y0t: createReport({
    name: 'Bot Negative Feedback Report',
    description:
      'Recent negative ratings for a specific bot with user reasons and linked conversations for drill-down',

    input: z.object({
      botId: z.string().describe('The ID of the bot to get feedback for'),
      periodDays: z.number().int().positive().default(DEFAULT_PERIOD),
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .default(10)
        .describe('Maximum number of negative ratings to return'),
    }),
    output: z.object({
      items: z.array(
        z.object({
          id: z.string(),
          value: z.number(),
          reason: z.string().nullable(),
          conversationId: z.string().nullable(),
          messageId: z.string().nullable(),
          contactId: z.string().nullable(),
          contactName: z.string().nullable(),
          createdAt: z.date(),
        })
      ),
      total: z.number(),
      thumbsDown: z.number(),
      thumbsUp: z.number(),
      period: z.string(),
    }),

    handler: async (session, data) => {
      const bot = await prisma.bot.findFirst({
        where: { id: data.botId, userId: session.user.id },
        select: { id: true },
      })

      if (!bot) {
        return throwNotFound('Bot not found')
      }

      const periodEnd = new Date()
      const periodDays = data.periodDays ?? DEFAULT_PERIOD
      const periodStart = timePlusDays(-periodDays, periodEnd)
      const take = data.limit ?? 10

      // @note fetch negative ratings and totals in parallel

      const [negativeRatings, ratingGroups] = await Promise.all([
        prisma.rating.findMany({
          where: {
            userId: session.user.id,
            botId: data.botId,
            value: { lt: 0 },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          select: {
            id: true,
            value: true,
            reason: true,
            conversationId: true,
            messageId: true,
            contactId: true,
            contact: {
              select: {
                name: true,
                email: true,
                nick: true,
              },
            },
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take,
        }),
        prisma.rating.groupBy({
          by: ['value'],
          where: {
            userId: session.user.id,
            botId: data.botId,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          _count: { value: true },
        }),
      ])

      let thumbsUp = 0
      let thumbsDown = 0
      let total = 0

      for (const r of ratingGroups) {
        const count = r._count.value

        total += count

        if (r.value > 0) {
          thumbsUp += count
        } else if (r.value < 0) {
          thumbsDown += count
        }
      }

      return {
        items: negativeRatings.map((r) => ({
          id: r.id,
          value: r.value,
          reason: r.reason,
          conversationId: r.conversationId,
          messageId: r.messageId,
          contactId: r.contactId,
          contactName:
            r.contact?.name || r.contact?.email || r.contact?.nick || null,
          createdAt: r.createdAt,
        })),
        total,
        thumbsDown,
        thumbsUp,
        period: `last ${periodDays} days`,
      }
    },

    createdAt: new Date('2026-02-20T00:00:00Z'),
    updatedAt: new Date('2026-02-20T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Bot Negative Feedback Report
   *
   * **ID:** `clr3m5n8k000j08jqgw4x5y0t`
   *
   * Lists individual negative ratings for a bot including user-provided
   * reasons, linked conversation and message IDs, and contact information
   * for direct follow-up.
   *
   * **Input**
   *
   * | Parameter | Type | Default | Description |
   * |-----------|------|---------|-------------|
   * | `botId` | `string` | - | ID of the bot |
   * | `periodDays` | `integer` | `30` | Look-back window |
   * | `limit` | `integer` | `10` | Maximum negative ratings to return (max 50) |
   *
   * **Output**
   *
   * | Field | Type | Description |
   * |-------|------|-------------|
   * | `items` | `array` | Negative rating entries with `id`, `value`, `reason`, `conversationId`, `messageId`, `contactId`, `contactName`, `createdAt` |
   * | `total` | `number` | Total ratings in period |
   * | `thumbsDown` | `number` | Negative rating count |
   * | `thumbsUp` | `number` | Positive rating count |
   * | `period` | `string` | Analysed time window |
   */

  // ---

  // Comprehensive Analytics Report with Token Usage

  gpv2an25fuhe2k6v6ckv85v8: createReport({
    name: 'Comprehensive Analytics Report',
    description:
      'Complete analytics overview with ratings, contacts, conversations, messages, and token usage including detailed breakdowns and lists',

    input: PeriodInputSchema,
    output: z.object({
      data: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          value: z.number(),
          change: z.number().optional(),
          period: z.string(),
          details: z
            .object({
              metric: z
                .object({
                  title: z.string(),
                  description: z.string(),
                  value: z.number(),
                  change: z.number().optional(),
                  period: z.string(),
                })
                .optional(),
              chart: z
                .object({
                  type: z.literal('line'),
                  data: z.array(
                    z.object({
                      date: z.string(),
                      total: z.number(),
                      thumbsUp: z.number().optional(),
                      thumbsDown: z.number().optional(),
                    })
                  ),
                })
                .optional(),
              list: z
                .array(
                  z.object({
                    id: z.string(),
                    icon: z.string().optional(),
                    name: z.string(),
                    description: z.string(),
                    createdAt: z.date().optional(),
                    tags: z.array(z.any()).optional(),
                  })
                )
                .optional(),
            })
            .optional(),
        })
      ),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? DEFAULT_PERIOD
      const periodStart = timePlusDays(-periodDays, periodEnd)

      const queryResults = await prisma.$queryMap({
        // contact

        totalContacts: prisma.$queryRawTyped(getTotalContacts(session.user.id)),

        listOfContacts: prisma.$queryRawTyped(
          listContacts(session.user.id, 100)
        ),

        totalActiveContacts: prisma.$queryRawTyped(
          getTotalContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        totalActiveContactsPreviousPeriod: prisma.$queryRawTyped(
          getTotalContactsWithConversationsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        listOfActiveContactsWithConversations: prisma.$queryRawTyped(
          listContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        listOfActiveContactsWithMessages: prisma.$queryRawTyped(
          listContactsWithMessagesOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        breakdownOfActiveContacts: prisma.$queryRawTyped(
          breakdownTotalContactsWithConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        // conversation

        totalConversations: prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        totalConversationsPreviousPeriod: prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfConversations: prisma.$queryRawTyped(
          breakdownTotalConversationsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        // message

        totalMessages: prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        totalUserMessages: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),

        totalUserMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfUserMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),

        totalBotMessages: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),

        totalBotMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfBotMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),

        totalActivityMessages: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),

        totalActivityMessagesPreviousPeriod: prisma.$queryRawTyped(
          getTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfActivityMessages: prisma.$queryRawTyped(
          breakdownTotalMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),

        listOfActions: prisma.$queryRawTyped(
          listEventLogsOfTypeActionsGroupedByTypeOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        averageUserMessagesPerConversation: prisma.$queryRawTyped(
          getAverageMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.user,
            periodStart,
            periodEnd
          )
        ),

        averageBotMessagesPerConversation: prisma.$queryRawTyped(
          getAverageMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.bot,
            periodStart,
            periodEnd
          )
        ),

        averageActivityMessagesPerConversation: prisma.$queryRawTyped(
          getAverageMessagesOfTypeOverPeriod(
            session.user.id,
            MessageType.activity,
            periodStart,
            periodEnd
          )
        ),

        // ratings

        totalRatings: prisma.$queryRawTyped(
          getTotalRatingsOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalRatingsPreviousPeriod: prisma.$queryRawTyped(
          getTotalRatingsOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        totalThumbsUp: prisma.$queryRawTyped(
          getTotalThumbsUpOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalThumbsUpPreviousPeriod: prisma.$queryRawTyped(
          getTotalThumbsUpOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        totalThumbsDown: prisma.$queryRawTyped(
          getTotalThumbsDownOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalThumbsDownPreviousPeriod: prisma.$queryRawTyped(
          getTotalThumbsDownOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfRatings: prisma.$queryRawTyped(
          breakdownTotalRatingsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        listOfContactsWithRatings: prisma.$queryRawTyped(
          listContactsWithRatingsOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        listOfTopUpvoters: prisma.$queryRawTyped(
          listTopUpvotersOverPeriod(session.user.id, periodStart, periodEnd, 20)
        ),

        listOfTopDownvoters: prisma.$queryRawTyped(
          listTopDownvotersOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            20
          )
        ),

        // token usage

        totalTokens: prisma.$queryRawTyped(
          getTotalUsageTokensOverPeriod(session.user.id, periodStart, periodEnd)
        ),

        totalTokensPreviousPeriod: prisma.$queryRawTyped(
          getTotalUsageTokensOverPeriod(
            session.user.id,
            timePlusDays(-periodDays, periodStart),
            periodStart
          )
        ),

        breakdownOfTokens: prisma.$queryRawTyped(
          breakdownTotalUsageTokensOverPeriod(
            session.user.id,
            periodStart,
            periodEnd
          )
        ),

        listOfTopBotsByTokenUsage: prisma.$queryRawTyped(
          listTopBotsByTokenUsageOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),

        listOfTopContactsByTokenUsage: prisma.$queryRawTyped(
          listTopContactsByTokenUsageOverPeriod(
            session.user.id,
            periodStart,
            periodEnd,
            100
          )
        ),
      })

      return {
        data: [
          // ratings
          {
            title: 'Total Ratings',
            description: 'Number of ratings received',
            value: toNumber(queryResults.totalRatings[0].total),
            change:
              toNumber(queryResults.totalRatings[0].total) -
              toNumber(queryResults.totalRatingsPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Ratings',
                description: 'Number of ratings received',
                value: toNumber(queryResults.totalRatings[0].total),
                change:
                  toNumber(queryResults.totalRatings[0].total) -
                  toNumber(queryResults.totalRatingsPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfRatings.map(
                  ({ date, total, thumbsUp, thumbsDown }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                    thumbsUp: toNumber(thumbsUp),
                    thumbsDown: toNumber(thumbsDown),
                  })
                ),
              },

              list: queryResults.listOfContactsWithRatings.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _upvoteCount,
                  _downvoteCount,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'rating', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                    { name: 'upvote', value: _upvoteCount },
                    { name: 'downvote', value: _downvoteCount },
                  ],
                })
              ),
            },
          },
          {
            title: 'Thumbs Up',
            description: 'Number of positive ratings received',
            value: toNumber(queryResults.totalThumbsUp[0].total),
            change:
              toNumber(queryResults.totalThumbsUp[0].total) -
              toNumber(queryResults.totalThumbsUpPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Thumbs Up',
                description: 'Number of positive ratings received',
                value: toNumber(queryResults.totalThumbsUp[0].total),
                change:
                  toNumber(queryResults.totalThumbsUp[0].total) -
                  toNumber(queryResults.totalThumbsUpPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              list: queryResults.listOfTopUpvoters.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'upvote', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },
          {
            title: 'Thumbs Down',
            description: 'Number of negative ratings received',
            value: toNumber(queryResults.totalThumbsDown[0].total),
            change:
              toNumber(queryResults.totalThumbsDown[0].total) -
              toNumber(queryResults.totalThumbsDownPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Thumbs Down',
                description: 'Number of negative ratings received',
                value: toNumber(queryResults.totalThumbsDown[0].total),
                change:
                  toNumber(queryResults.totalThumbsDown[0].total) -
                  toNumber(queryResults.totalThumbsDownPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              list: queryResults.listOfTopDownvoters.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'downvote', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // contact
          {
            title: 'Total Users',
            description: 'Number of unique users',
            value: toNumber(queryResults.totalContacts[0].total),
            period: 'all time',

            details: {
              metric: {
                title: 'Total Users',
                description: 'Number of unique users',
                value: toNumber(queryResults.totalContacts[0].total),
                period: 'all time',
              },

              list: queryResults.listOfContacts.map(
                ({ id, name, description, email, nick, meta, createdAt }) => ({
                  id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags:
                    typeof meta === 'object' && meta !== null && 'app' in meta
                      ? [meta.app]
                      : [],
                })
              ),
            },
          },
          {
            title: 'Active Users',
            description: 'Number of active users',
            value: toNumber(queryResults.totalActiveContacts[0].total),
            change:
              toNumber(queryResults.totalActiveContacts[0].total) -
              toNumber(queryResults.totalActiveContactsPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Active Users',
                description: 'Number of active users',
                value: toNumber(queryResults.totalActiveContacts[0].total),
                change:
                  toNumber(queryResults.totalActiveContacts[0].total) -
                  toNumber(
                    queryResults.totalActiveContactsPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfActiveContacts.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActiveContactsWithConversations.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  _countValue,
                  _countType,
                }) => ({
                  id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  tags: [
                    { name: _countType, value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // conversation
          {
            title: 'Total Conversations',
            description: 'Number of conversations handled',
            value: toNumber(queryResults.totalConversations[0].total),
            change:
              toNumber(queryResults.totalConversations[0].total) -
              toNumber(queryResults.totalConversationsPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Conversations',
                description: 'Number of conversations handled',
                value: toNumber(queryResults.totalConversations[0].total),
                change:
                  toNumber(queryResults.totalConversations[0].total) -
                  toNumber(
                    queryResults.totalConversationsPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfConversations.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActiveContactsWithConversations.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  _countValue,
                }) => ({
                  id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  tags: [
                    { name: 'conversation', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // message
          {
            title: 'Total Messages',
            description: 'Number of messages exchanged',
            value: toNumber(queryResults.totalMessages[0].total),
            change:
              toNumber(queryResults.totalMessages[0].total) -
              toNumber(queryResults.totalMessagesPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Messages',
                description: 'Number of messages exchanged',
                value: toNumber(queryResults.totalMessages[0].total),
                change:
                  toNumber(queryResults.totalMessages[0].total) -
                  toNumber(queryResults.totalMessagesPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActiveContactsWithMessages.map(
                ({
                  id,
                  name,
                  description,
                  email,
                  nick,
                  meta,
                  createdAt,
                  _countValue,
                }) => ({
                  id: id,
                  icon: `@gravatar/${email}`,
                  name: name || email || nick || id,
                  description: description || `id: ${id}`,
                  createdAt,
                  tags: [
                    { name: 'message', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },
          {
            title: 'Total User Requests',
            description: 'Number of user requests processed',
            value: toNumber(queryResults.totalUserMessages[0].total),
            change:
              toNumber(queryResults.totalUserMessages[0].total) -
              toNumber(queryResults.totalUserMessagesPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total User Requests',
                description: 'Number of user requests processed',
                value: toNumber(queryResults.totalUserMessages[0].total),
                change:
                  toNumber(queryResults.totalUserMessages[0].total) -
                  toNumber(
                    queryResults.totalUserMessagesPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfUserMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },
            },
          },
          {
            title: 'Total Agent Responses',
            description: 'Number of agent responses delivered',
            value: toNumber(queryResults.totalBotMessages[0].total),
            change:
              toNumber(queryResults.totalBotMessages[0].total) -
              toNumber(queryResults.totalBotMessagesPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Agent Responses',
                description: 'Number of agent responses delivered',
                value: toNumber(queryResults.totalBotMessages[0].total),
                change:
                  toNumber(queryResults.totalBotMessages[0].total) -
                  toNumber(
                    queryResults.totalBotMessagesPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfBotMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },
            },
          },
          {
            title: 'Total Agent Actions',
            description: 'Number of agent actions taken',
            value: toNumber(queryResults.totalActivityMessages[0].total),
            change:
              toNumber(queryResults.totalActivityMessages[0].total) -
              toNumber(
                queryResults.totalActivityMessagesPreviousPeriod[0].total
              ),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Agent Actions',
                description: 'Number of agent actions taken',
                value: toNumber(queryResults.totalActivityMessages[0].total),
                change:
                  toNumber(queryResults.totalActivityMessages[0].total) -
                  toNumber(
                    queryResults.totalActivityMessagesPreviousPeriod[0].total
                  ),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfActivityMessages.map(
                  ({ date, total }) => ({
                    date: date == null ? '' : getYYYYMMDD(date),
                    total: toNumber(total),
                  })
                ),
              },

              list: queryResults.listOfActions.map(
                ({ type, name, description, _countValue }) => ({
                  id: type,
                  name: name || type,
                  description: description || `Action type: ${type}`,
                  tags: [{ name: 'action', value: _countValue }],
                })
              ),
            },
          },
          {
            title: 'Average Number of User Requests per Conversation',
            description:
              'Average number of user messages taken in conversations',
            value: toNumber(
              queryResults.averageUserMessagesPerConversation[0].average
            ),
            period: `last ${periodDays} days`,
          },
          {
            title: 'Average Number of Agent Responses per Conversation',
            description:
              'Average number of agent messages taken in conversations',
            value: toNumber(
              queryResults.averageBotMessagesPerConversation[0].average
            ),
            period: `last ${periodDays} days`,
          },
          {
            title: 'Average Number of Actions per Conversation',
            description: 'Average number of actions taken in conversations',
            value: toNumber(
              queryResults.averageActivityMessagesPerConversation[0].average
            ),
            period: `last ${periodDays} days`,
          },

          // token usage
          {
            title: 'Total Tokens',
            description: 'Total tokens consumed across all bots and contacts',
            value: toNumber(queryResults.totalTokens[0].total),
            change:
              toNumber(queryResults.totalTokens[0].total) -
              toNumber(queryResults.totalTokensPreviousPeriod[0].total),
            period: `last ${periodDays} days`,

            details: {
              metric: {
                title: 'Total Tokens',
                description:
                  'Total tokens consumed across all bots and contacts',
                value: toNumber(queryResults.totalTokens[0].total),
                change:
                  toNumber(queryResults.totalTokens[0].total) -
                  toNumber(queryResults.totalTokensPreviousPeriod[0].total),
                period: `last ${periodDays} days`,
              },

              chart: {
                type: 'line' as const,
                data: queryResults.breakdownOfTokens.map(({ date, total }) => ({
                  date: date == null ? '' : getYYYYMMDD(date),
                  total: toNumber(total),
                })),
              },

              list: [
                ...queryResults.listOfTopBotsByTokenUsage.map(
                  ({ id, name, description, total }) => ({
                    id: id || 'unknown',
                    name: name || `Bot ${id || 'unknown'}`,
                    description: description || `Bot ID: ${id || 'unknown'}`,
                    tags: [
                      {
                        name: 'bot-token',
                        value: shortFormat(toNumber(total)),
                      },
                    ],
                  })
                ),
                ...queryResults.listOfTopContactsByTokenUsage.map(
                  ({ id, name, description, total }) => ({
                    id: id || 'unknown',
                    name: name || `Contact ${id || 'unknown'}`,
                    description:
                      description || `Contact ID: ${id || 'unknown'}`,
                    tags: [
                      {
                        name: 'contact-token',
                        value: shortFormat(toNumber(total)),
                      },
                    ],
                  })
                ),
              ],
            },
          },
        ],
      }
    },

    createdAt: new Date('2026-02-21T00:00:00Z'),
    updatedAt: new Date('2026-02-21T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Comprehensive Analytics Report
   *
   * **ID:** `gpv2an25fuhe2k6v6ckv85v8`
   *
   * Extends the Overview Report with token consumption metrics including total
   * tokens consumed, daily token breakdown, and ranked lists of top bots and
   * contacts by token usage.
   *
   * **Input:** `periodDays`
   *
   * **Output:** Same structure as the Overview Report, with an additional
   * `Total Tokens` entry in `data` that contains bot and contact token
   * consumption lists.
   */

  // ---

  // Platform Overview Report

  pov1s2k3l4m5n6o7p8q9r0sov: createReport({
    name: 'Platform Overview Report',
    description:
      'Single-call dashboard payload for the platform overview screen with resource counts, usage time series, top bots, and recent work',

    input: z.object({
      periodDays: z.number().int().positive().default(7),
      topBotsLimit: z.number().int().positive().max(20).default(5),
      recentWorkLimit: z.number().int().positive().max(20).default(4),
    }),
    output: z.object({
      period: z.string(),
      rangeLabel: z.string(),

      resources: z.object({
        blueprints: z.object({ value: z.number(), change: z.number() }),
        portals: z.object({ value: z.number(), change: z.number() }),
        bots: z.object({ value: z.number(), change: z.number() }),
      }),

      tokens: z.object({
        value: z.number(),
        change: z.number(),
        breakdown: z.array(z.object({ date: z.string(), total: z.number() })),
      }),

      conversations: z.object({
        value: z.number(),
        change: z.number(),
        breakdown: z.array(z.object({ date: z.string(), total: z.number() })),
      }),

      messages: z.object({
        value: z.number(),
        change: z.number(),
        breakdown: z.array(z.object({ date: z.string(), total: z.number() })),
      }),

      negativeRatings: z.object({
        value: z.number(),
        change: z.number(),
        breakdown: z.array(z.object({ date: z.string(), total: z.number() })),
      }),

      positiveRatings: z.object({
        value: z.number(),
        change: z.number(),
      }),

      topBots: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          tokens: z.number(),
          conversations: z.number(),
          thumbsUp: z.number(),
          thumbsDown: z.number(),
          thumbsUpRate: z.number().nullable(),
          sparkline: z.array(z.number()),
        })
      ),

      recentWork: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(['Blueprint', 'Portal', 'Bot', 'Widget']),
          name: z.string().nullable(),
          link: z.string(),
          createdAt: z.string(),
        })
      ),
    }),

    handler: async (session, data) => {
      const periodEnd = new Date()
      const periodDays = data.periodDays ?? 7
      const periodStart = timePlusDays(-periodDays, periodEnd)
      const previousPeriodStart = timePlusDays(-periodDays, periodStart)

      const fmt = (d: Date) =>
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      const rangeLabel = `${fmt(previousPeriodStart)} - ${fmt(periodStart)}`

      const userId = session.user.id

      const [
        blueprintsCurrent,
        blueprintsPrevious,
        portalsCurrent,
        portalsPrevious,
        botsCurrent,
        botsPrevious,

        tokensCurrent,
        tokensPrevious,
        tokenBreakdown,

        conversationsCurrent,
        conversationsPrevious,
        conversationBreakdown,

        messagesCurrent,
        messagesPrevious,
        messageBreakdown,

        negativeCurrent,
        negativePrevious,
        negativeBreakdown,

        positiveCurrent,
        positivePrevious,

        topBotsRows,

        recentBlueprints,
        recentPortals,
        recentBots,
        recentWidgets,
      ] = await Promise.all([
        prisma.blueprint.count({
          where: { userId, createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.blueprint.count({
          where: {
            userId,
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),
        prisma.portal.count({
          where: { userId, createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.portal.count({
          where: {
            userId,
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),
        prisma.bot.count({
          where: { userId, createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.bot.count({
          where: {
            userId,
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),

        prisma.$queryRawTyped(
          getTotalUsageTokensOverPeriod(userId, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalUsageTokensOverPeriod(
            userId,
            previousPeriodStart,
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalUsageTokensOverPeriod(userId, periodStart, periodEnd)
        ),

        prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(userId, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalConversationsOverPeriod(
            userId,
            previousPeriodStart,
            periodStart
          )
        ),
        prisma.$queryRawTyped(
          breakdownTotalConversationsOverPeriod(userId, periodStart, periodEnd)
        ),

        prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(userId, periodStart, periodEnd)
        ),
        prisma.$queryRawTyped(
          getTotalMessagesOverPeriod(userId, previousPeriodStart, periodStart)
        ),
        prisma.$queryRawTyped(
          breakdownTotalMessagesOverPeriod(userId, periodStart, periodEnd)
        ),

        prisma.rating.count({
          where: {
            userId,
            value: { lt: 0 },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),
        prisma.rating.count({
          where: {
            userId,
            value: { lt: 0 },
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),
        prisma.$queryRawTyped(
          getDailyNegativeRatingCount(userId, periodStart, periodEnd)
        ),

        prisma.rating.count({
          where: {
            userId,
            value: { gt: 0 },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        }),
        prisma.rating.count({
          where: {
            userId,
            value: { gt: 0 },
            createdAt: { gte: previousPeriodStart, lte: periodStart },
          },
        }),

        prisma.$queryRawTyped(
          listTopBotsByTokenUsageOverPeriod(
            userId,
            periodStart,
            periodEnd,
            data.topBotsLimit ?? 5
          )
        ),

        prisma.blueprint.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: data.recentWorkLimit ?? 4,
          select: { id: true, name: true, createdAt: true },
        }),
        prisma.portal.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: data.recentWorkLimit ?? 4,
          select: { id: true, name: true, createdAt: true },
        }),
        prisma.bot.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: data.recentWorkLimit ?? 4,
          select: { id: true, name: true, createdAt: true },
        }),
        prisma.widgetIntegration.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: data.recentWorkLimit ?? 4,
          select: { id: true, name: true, createdAt: true },
        }),
      ])

      const fillBreakdown = (
        rows: { date: Date | string | null; total: unknown }[]
      ) => {
        const map = new Map<string, number>()

        for (const row of rows) {
          if (!row.date) {
            continue
          }

          map.set(
            // @note raw DATE() yields a Date on MySQL but a string on SQLite
            getYYYYMMDD(row.date),
            toNumber(row.total as bigint | number | { toNumber?: () => number })
          )
        }

        const out: { date: string; total: number }[] = []

        for (let i = 0; i < periodDays; i++) {
          const d = timePlusDays(i + 1 - periodDays, periodEnd)
          const key = d.toISOString().split('T')[0]

          out.push({ date: key, total: map.get(key) ?? 0 })
        }

        return out
      }

      const topBotIds = topBotsRows
        .map((r) => r.id)
        .filter((id): id is string => !!id)

      const [topBotRatings, topBotConversations] = await Promise.all([
        topBotIds.length > 0
          ? prisma.rating.groupBy({
              by: ['botId', 'value'],
              where: {
                userId,
                botId: { in: topBotIds },
                createdAt: { gte: periodStart, lte: periodEnd },
              },
              _count: { value: true },
            })
          : Promise.resolve(
              [] as {
                botId: string | null
                value: number
                _count: { value: number }
              }[]
            ),

        topBotIds.length > 0
          ? prisma.conversation.groupBy({
              by: ['botId'],
              where: {
                userId,
                botId: { in: topBotIds },
                createdAt: { gte: periodStart, lte: periodEnd },
              },
              _count: { _all: true },
            })
          : Promise.resolve(
              [] as { botId: string | null; _count: { _all: number } }[]
            ),
      ])

      const ratingsByBot = new Map<string, { up: number; down: number }>()

      for (const r of topBotRatings) {
        if (!r.botId) {
          continue
        }

        const entry = ratingsByBot.get(r.botId) ?? { up: 0, down: 0 }

        if (r.value > 0) {
          entry.up += r._count.value
        } else if (r.value < 0) {
          entry.down += r._count.value
        }

        ratingsByBot.set(r.botId, entry)
      }

      const conversationsByBot = new Map<string, number>()

      for (const c of topBotConversations) {
        if (!c.botId) {
          continue
        }

        conversationsByBot.set(c.botId, c._count._all)
      }

      const topBots = topBotsRows.map((row) => {
        const id = row.id ?? ''
        const ratings = ratingsByBot.get(id) ?? { up: 0, down: 0 }
        const totalRatings = ratings.up + ratings.down

        return {
          id,
          name: row.name ?? 'Untitled bot',
          tokens: toNumber(row.total),
          conversations: conversationsByBot.get(id) ?? 0,
          thumbsUp: ratings.up,
          thumbsDown: ratings.down,
          thumbsUpRate: totalRatings > 0 ? ratings.up / totalRatings : null,
          sparkline: [] as number[],
        }
      })

      const recentWork = [
        ...recentBlueprints.map((b) => ({
          id: b.id,
          kind: 'Blueprint' as const,
          name: b.name,
          link: `/blueprints/${b.id}/designer`,
          createdAt: b.createdAt.toISOString(),
        })),
        ...recentPortals.map((p) => ({
          id: p.id,
          kind: 'Portal' as const,
          name: p.name,
          link: `/portals/${p.id}`,
          createdAt: p.createdAt.toISOString(),
        })),
        ...recentBots.map((b) => ({
          id: b.id,
          kind: 'Bot' as const,
          name: b.name,
          link: `/bots/${b.id}`,
          createdAt: b.createdAt.toISOString(),
        })),
        ...recentWidgets.map((w) => ({
          id: w.id,
          kind: 'Widget' as const,
          name: w.name,
          link: `/integrations/widget/${w.id}`,
          createdAt: w.createdAt.toISOString(),
        })),
      ]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, data.recentWorkLimit ?? 4)

      const tokensCurrentValue = toNumber(tokensCurrent[0]?.total ?? 0)
      const tokensPreviousValue = toNumber(tokensPrevious[0]?.total ?? 0)
      const conversationsCurrentValue = toNumber(
        conversationsCurrent[0]?.total ?? 0
      )
      const conversationsPreviousValue = toNumber(
        conversationsPrevious[0]?.total ?? 0
      )
      const messagesCurrentValue = toNumber(messagesCurrent[0]?.total ?? 0)
      const messagesPreviousValue = toNumber(messagesPrevious[0]?.total ?? 0)

      return {
        period: `last ${periodDays} days`,
        rangeLabel,

        resources: {
          blueprints: {
            value: blueprintsCurrent,
            change: blueprintsCurrent - blueprintsPrevious,
          },
          portals: {
            value: portalsCurrent,
            change: portalsCurrent - portalsPrevious,
          },
          bots: {
            value: botsCurrent,
            change: botsCurrent - botsPrevious,
          },
        },

        tokens: {
          value: tokensCurrentValue,
          change: tokensCurrentValue - tokensPreviousValue,
          breakdown: fillBreakdown(
            tokenBreakdown.map((r) => ({ date: r.date, total: r.total }))
          ),
        },

        conversations: {
          value: conversationsCurrentValue,
          change: conversationsCurrentValue - conversationsPreviousValue,
          breakdown: fillBreakdown(
            conversationBreakdown.map((r) => ({
              date: r.date,
              total: r.total,
            }))
          ),
        },

        messages: {
          value: messagesCurrentValue,
          change: messagesCurrentValue - messagesPreviousValue,
          breakdown: fillBreakdown(
            messageBreakdown.map((r) => ({ date: r.date, total: r.total }))
          ),
        },

        negativeRatings: {
          value: negativeCurrent,
          change: negativeCurrent - negativePrevious,
          breakdown: fillBreakdown(negativeBreakdown),
        },

        positiveRatings: {
          value: positiveCurrent,
          change: positiveCurrent - positivePrevious,
        },

        topBots,

        recentWork,
      }
    },

    createdAt: new Date('2026-04-28T00:00:00Z'),
    updatedAt: new Date('2026-04-28T00:00:00Z'),
  }),

  /**
   * @manual Reports
   *
   * ## Platform Overview Report
   *
   * **ID:** `pov1s2k3l4m5n6o7p8q9r0sov`
   *
   * Single-call payload tailored for the platform overview dashboard. Returns
   * resource creation counts and period-over-period change for blueprints,
   * portals, and bots; daily breakdowns and totals for tokens, conversations,
   * messages, and negative ratings; a ranked list of top bots by token usage
   * with thumbs-up rate and per-day token sparklines; and the most recently
   * created resources across blueprints, portals, bots, and widgets.
   *
   * **Input**
   *
   * | Parameter | Type | Default | Description |
   * |-----------|------|---------|-------------|
   * | `periodDays` | `integer` | `7` | Look-back window for time series and changes |
   * | `topBotsLimit` | `integer` | `5` | Number of bots to include in `topBots` |
   * | `recentWorkLimit` | `integer` | `4` | Number of items in `recentWork` |
   */
} satisfies Record<string, Report<unknown, unknown>>
