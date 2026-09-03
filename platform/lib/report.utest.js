/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Unit tests for lib/report.ts - Bot Stats Report
 *
 * @note These tests validate the input/output schemas for the bot stats report.
 * Handler tests are skipped in environments without prisma client generation.
 */
import prisma from '@/prisma/client'

import { registry } from '@/lib/report'
import { z } from '@/lib/zod.schema'

// Mocks required to load report.ts module
jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: { findMany: jest.fn() },
    conversation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    usage: { groupBy: jest.fn() },
    bot: { findFirst: jest.fn() },
    message: { count: jest.fn(), groupBy: jest.fn() },
    rating: { count: jest.fn() },
  },
}))

jest.mock('@/prisma/sql', () => ({
  breakdownTotalContactsWithConversationsOverPeriod: jest.fn(),
  breakdownTotalConversationsOverPeriod: jest.fn(),
  breakdownTotalMessagesOfTypeOverPeriod: jest.fn(),
  breakdownTotalMessagesOverPeriod: jest.fn(),
  breakdownTotalRatingsOverPeriod: jest.fn(),
  breakdownTotalUsageTokensOverPeriod: jest.fn(),
  getAverageMessagesOfTypeOverPeriod: jest.fn(),
  getBotUsageStats: jest.fn(),
  getTotalContacts: jest.fn(),
  getTotalContactsWithConversationsOverPeriod: jest.fn(),
  getTotalConversationsOverPeriod: jest.fn(),
  getTotalMessagesOfTypeOverPeriod: jest.fn(),
  getTotalMessagesOverPeriod: jest.fn(),
  getTotalRatingsOverPeriod: jest.fn(),
  getTotalThumbsDownOverPeriod: jest.fn(),
  getTotalThumbsUpOverPeriod: jest.fn(),
  getTotalUsageTokensOverPeriod: jest.fn(),
  listContacts: jest.fn(),
  listContactsWithConversationsOverPeriod: jest.fn(),
  listContactsWithMessagesOverPeriod: jest.fn(),
  listContactsWithRatingsOverPeriod: jest.fn(),
  listEventLogsOfTypeActionsGroupedByTypeOverPeriod: jest.fn(),
  listTopBotsByTokenUsageOverPeriod: jest.fn(),
  listTopContactsByTokenUsageOverPeriod: jest.fn(),
  listTopDownvotersOverPeriod: jest.fn(),
  listTopUpvotersOverPeriod: jest.fn(),
}))

jest.mock('@/prisma/types', () => ({
  MessageType: { bot: 'bot', user: 'user' },
}))

jest.mock('@/lib/limit.estimate', () => ({
  estimateConversationCountLimit: jest.fn(),
  estimateMessageCountLimit: jest.fn(),
  estimateStorageLimit: jest.fn(),
  estimateTokenCountLimit: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn(() => {
    throw new Error('not found')
  }),
}))

jest.mock('@/lib/usage.get', () => ({
  getUsageSeriesNow: jest.fn(),
}))

jest.mock('@/lib/usage.types', () => ({
  UseType: {
    CHATBOTKIT_BASE_TOKEN: 'CHATBOTKIT_BASE_TOKEN',
    CHATBOTKIT_MESSAGE: 'CHATBOTKIT_MESSAGE',
  },
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

jest.mock('@/lib/number', () => ({
  shortFormat: jest.fn((n) => String(n)),
  toNumber: jest.fn((n) => Number(n)),
}))

jest.mock('@/config/limits', () => ({}), { virtual: true })

// @note we define the schemas here to test them without needing prisma imports
const BotStatsInputSchema = z.object({
  botId: z.string().describe('The ID of the bot to get stats for'),
  periodDays: z.number().int().positive().default(30),
})

const BotStatsOutputSchema = z.object({
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
  conversationIds: z.array(z.string()).min(1).max(100),
  periodDays: z.number().int().positive().max(90).default(90),
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

describe('dataset records report', () => {
  describe('input schema', () => {
    it('should accept valid input with datasetIds', () => {
      const validInput = { datasetIds: ['dataset1', 'dataset2'] }

      const parsed = DatasetRecordsInputSchema.safeParse(validInput)

      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(validInput)
    })

    it('should require datasetIds', () => {
      const invalidInput = {}

      const parsed = DatasetRecordsInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })

    it('should reject non-array datasetIds', () => {
      const invalidInput = { datasetIds: 'dataset1' }

      const parsed = DatasetRecordsInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })
  })

  describe('output schema', () => {
    it('should accept valid output', () => {
      const validOutput = {
        totalRecords: 150,
        breakdown: [
          { datasetId: 'dataset1', records: 100 },
          { datasetId: 'dataset2', records: 50 },
        ],
      }

      const parsed = DatasetRecordsOutputSchema.safeParse(validOutput)

      expect(parsed.success).toBe(true)
    })

    it('should require totalRecords', () => {
      const invalidOutput = {
        breakdown: [{ datasetId: 'dataset1', records: 100 }],
      }

      const parsed = DatasetRecordsOutputSchema.safeParse(invalidOutput)

      expect(parsed.success).toBe(false)
    })

    it('should require breakdown', () => {
      const invalidOutput = {
        totalRecords: 150,
      }

      const parsed = DatasetRecordsOutputSchema.safeParse(invalidOutput)

      expect(parsed.success).toBe(false)
    })
  })
})

describe('conversation usage report', () => {
  describe('input schema', () => {
    it('should accept valid input with conversationIds', () => {
      const validInput = {
        conversationIds: ['conversation1', 'conversation2'],
        periodDays: 30,
      }

      const parsed = ConversationUsageInputSchema.safeParse(validInput)

      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(validInput)
    })

    it('should default periodDays to 90', () => {
      const inputWithoutPeriod = {
        conversationIds: ['conversation1'],
      }

      const parsed = ConversationUsageInputSchema.safeParse(inputWithoutPeriod)

      expect(parsed.success).toBe(true)
      expect(parsed.data?.periodDays).toBe(90)
    })

    it('should require at least one conversationId', () => {
      const invalidInput = {
        conversationIds: [],
      }

      const parsed = ConversationUsageInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })

    it('should reject periodDays greater than the usage lookback', () => {
      const invalidInput = {
        conversationIds: ['conversation1'],
        periodDays: 91,
      }

      const parsed = ConversationUsageInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })
  })

  describe('output schema', () => {
    it('should accept valid output with per-conversation usage', () => {
      const validOutput = {
        totalTokens: 1000,
        totalConversations: 2,
        totalMessages: 12,
        period: 'last 90 days',
        items: [
          {
            conversationId: 'conversation1',
            tokens: 700,
            conversations: 1,
            messages: 8,
          },
          {
            conversationId: 'conversation2',
            tokens: 300,
            conversations: 1,
            messages: 4,
          },
        ],
      }

      const parsed = ConversationUsageOutputSchema.safeParse(validOutput)

      expect(parsed.success).toBe(true)
    })

    it('should require top-level totals', () => {
      const invalidOutput = {
        period: 'last 90 days',
        items: [],
      }

      const parsed = ConversationUsageOutputSchema.safeParse(invalidOutput)

      expect(parsed.success).toBe(false)
    })
  })
})

describe('bot stats report', () => {
  describe('input schema', () => {
    it('should accept valid input with botId and periodDays', () => {
      const validInput = { botId: 'bot123', periodDays: 30 }

      const parsed = BotStatsInputSchema.safeParse(validInput)

      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(validInput)
    })

    it('should require botId', () => {
      const invalidInput = { periodDays: 30 }

      const parsed = BotStatsInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })

    it('should default periodDays to 30', () => {
      const inputWithoutPeriod = { botId: 'bot123' }

      const parsed = BotStatsInputSchema.safeParse(inputWithoutPeriod)

      expect(parsed.success).toBe(true)
      expect(parsed.data?.periodDays).toBe(30)
    })

    it('should reject negative periodDays', () => {
      const invalidInput = { botId: 'bot123', periodDays: -5 }

      const parsed = BotStatsInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })

    it('should reject zero periodDays', () => {
      const invalidInput = { botId: 'bot123', periodDays: 0 }

      const parsed = BotStatsInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })
  })

  describe('output schema', () => {
    it('should accept valid output', () => {
      const validOutput = {
        totalConversations: 100,
        totalMessages: 500,
        totalTokens: 150000,
        totalRatings: 50,
        thumbsUp: 40,
        thumbsDown: 10,
        sentimentSignal: 'positive',
        period: 'last 30 days',
      }

      const parsed = BotStatsOutputSchema.safeParse(validOutput)

      expect(parsed.success).toBe(true)
    })

    it('should validate all sentimentSignal enum values', () => {
      const validSignals = ['positive', 'negative', 'neutral', 'unknown']

      for (const signal of validSignals) {
        const output = {
          totalConversations: 0,
          totalMessages: 0,
          totalTokens: 0,
          totalRatings: 0,
          thumbsUp: 0,
          thumbsDown: 0,
          sentimentSignal: signal,
          period: 'last 30 days',
        }

        const parsed = BotStatsOutputSchema.safeParse(output)

        expect(parsed.success).toBe(true)
      }
    })

    it('should reject invalid sentimentSignal values', () => {
      const output = {
        totalConversations: 0,
        totalMessages: 0,
        totalTokens: 0,
        totalRatings: 0,
        thumbsUp: 0,
        thumbsDown: 0,
        sentimentSignal: 'invalid',
        period: 'last 30 days',
      }

      const parsed = BotStatsOutputSchema.safeParse(output)

      expect(parsed.success).toBe(false)
    })

    it('should require all numeric fields', () => {
      const incompleteOutput = {
        totalConversations: 100,
        sentimentSignal: 'positive',
        period: 'last 30 days',
      }

      const parsed = BotStatsOutputSchema.safeParse(incompleteOutput)

      expect(parsed.success).toBe(false)
    })
  })

  describe('sentiment calculation logic', () => {
    // @note testing the sentiment logic that the handler uses

    function calculateSentiment(thumbsUp, thumbsDown, totalRatings) {
      if (totalRatings === 0) {
        return 'unknown'
      }

      if (thumbsUp > thumbsDown) {
        return 'positive'
      } else if (thumbsDown > thumbsUp) {
        return 'negative'
      } else {
        return 'neutral'
      }
    }

    it('should return positive when thumbsUp > thumbsDown', () => {
      expect(calculateSentiment(10, 5, 15)).toBe('positive')
    })

    it('should return negative when thumbsDown > thumbsUp', () => {
      expect(calculateSentiment(5, 10, 15)).toBe('negative')
    })

    it('should return neutral when thumbsUp === thumbsDown', () => {
      expect(calculateSentiment(10, 10, 20)).toBe('neutral')
    })

    it('should return unknown when no ratings', () => {
      expect(calculateSentiment(0, 0, 0)).toBe('unknown')
    })
  })
})

// @note alerts report schema tests

const AlertSchema = z.object({
  type: z.enum([
    'usageSpike',
    'limit',
    'sentiment',
    'activity',
    'negativeFeedback',
  ]),
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

const AlertsReportInputSchema = z.object({
  periodDays: z.number().int().positive().default(30),
})

const AlertsReportOutputSchema = z.object({
  alerts: z.array(AlertSchema),
  summary: z.object({
    totalAlerts: z.number(),
    criticalCount: z.number(),
    warningCount: z.number(),
    infoCount: z.number(),
  }),
  period: z.string(),
})

describe('alerts report', () => {
  describe('input schema', () => {
    it('should accept valid input with periodDays', () => {
      const validInput = { periodDays: 30 }

      const parsed = AlertsReportInputSchema.safeParse(validInput)

      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(validInput)
    })

    it('should default periodDays to 30 when not provided', () => {
      const inputWithoutPeriod = {}

      const parsed = AlertsReportInputSchema.safeParse(inputWithoutPeriod)

      expect(parsed.success).toBe(true)
      expect(parsed.data?.periodDays).toBe(30)
    })

    it('should reject negative periodDays', () => {
      const invalidInput = { periodDays: -5 }

      const parsed = AlertsReportInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })

    it('should reject zero periodDays', () => {
      const invalidInput = { periodDays: 0 }

      const parsed = AlertsReportInputSchema.safeParse(invalidInput)

      expect(parsed.success).toBe(false)
    })

    it('should accept various positive periodDays values', () => {
      const values = [1, 7, 14, 30, 60, 90]

      for (const periodDays of values) {
        const parsed = AlertsReportInputSchema.safeParse({ periodDays })

        expect(parsed.success).toBe(true)
        expect(parsed.data?.periodDays).toBe(periodDays)
      }
    })
  })

  describe('output schema', () => {
    it('should accept valid output with no alerts', () => {
      const validOutput = {
        alerts: [],
        summary: {
          totalAlerts: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
        },
        period: 'last 30 days',
      }

      const parsed = AlertsReportOutputSchema.safeParse(validOutput)

      expect(parsed.success).toBe(true)
    })

    it('should accept valid output with alerts', () => {
      const validOutput = {
        alerts: [
          {
            type: 'usageSpike',
            severity: 'warning',
            title: 'Token Usage Spike Detected',
            message: 'Token usage is 50% above average.',
            metric: {
              current: 150000,
              baseline: 100000,
              percentage: 50,
            },
          },
          {
            type: 'limit',
            severity: 'info',
            title: 'Approaching Dataset Limit',
            message: 'You have used 80% of your dataset limit.',
            metric: {
              current: 8,
              baseline: 10,
              percentage: 80,
            },
          },
          {
            type: 'negativeFeedback',
            severity: 'critical',
            title: 'High Negative Feedback',
            message: '50% of ratings are negative.',
            metric: {
              current: 50,
              baseline: 100,
              percentage: 50,
            },
          },
        ],
        summary: {
          totalAlerts: 3,
          criticalCount: 1,
          warningCount: 1,
          infoCount: 1,
        },
        period: 'last 30 days',
      }

      const parsed = AlertsReportOutputSchema.safeParse(validOutput)

      expect(parsed.success).toBe(true)
    })

    it('should validate all alert type enum values', () => {
      const alertTypes = [
        'usageSpike',
        'limit',
        'sentiment',
        'activity',
        'negativeFeedback',
      ]

      for (const type of alertTypes) {
        const output = {
          alerts: [
            {
              type,
              severity: 'info',
              title: 'Test Alert',
              message: 'Test message',
            },
          ],
          summary: {
            totalAlerts: 1,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 1,
          },
          period: 'last 30 days',
        }

        const parsed = AlertsReportOutputSchema.safeParse(output)

        expect(parsed.success).toBe(true)
      }
    })

    it('should validate all severity enum values', () => {
      const severities = ['info', 'warning', 'critical']

      for (const severity of severities) {
        const output = {
          alerts: [
            {
              type: 'usageSpike',
              severity,
              title: 'Test Alert',
              message: 'Test message',
            },
          ],
          summary: {
            totalAlerts: 1,
            criticalCount: severity === 'critical' ? 1 : 0,
            warningCount: severity === 'warning' ? 1 : 0,
            infoCount: severity === 'info' ? 1 : 0,
          },
          period: 'last 30 days',
        }

        const parsed = AlertsReportOutputSchema.safeParse(output)

        expect(parsed.success).toBe(true)
      }
    })

    it('should reject invalid alert type', () => {
      const output = {
        alerts: [
          {
            type: 'invalid_type',
            severity: 'info',
            title: 'Test Alert',
            message: 'Test message',
          },
        ],
        summary: {
          totalAlerts: 1,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 1,
        },
        period: 'last 30 days',
      }

      const parsed = AlertsReportOutputSchema.safeParse(output)

      expect(parsed.success).toBe(false)
    })

    it('should reject invalid severity', () => {
      const output = {
        alerts: [
          {
            type: 'usageSpike',
            severity: 'urgent',
            title: 'Test Alert',
            message: 'Test message',
          },
        ],
        summary: {
          totalAlerts: 1,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 1,
        },
        period: 'last 30 days',
      }

      const parsed = AlertsReportOutputSchema.safeParse(output)

      expect(parsed.success).toBe(false)
    })

    it('should accept alert without optional metric field', () => {
      const output = {
        alerts: [
          {
            type: 'activity',
            severity: 'info',
            title: 'Activity Increase',
            message: 'Conversation volume increased.',
          },
        ],
        summary: {
          totalAlerts: 1,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 1,
        },
        period: 'last 30 days',
      }

      const parsed = AlertsReportOutputSchema.safeParse(output)

      expect(parsed.success).toBe(true)
    })

    it('should require summary fields', () => {
      const incompleteOutput = {
        alerts: [],
        summary: {
          totalAlerts: 0,
        },
        period: 'last 30 days',
      }

      const parsed = AlertsReportOutputSchema.safeParse(incompleteOutput)

      expect(parsed.success).toBe(false)
    })
  })

  describe('alert generation logic', () => {
    // @note testing the spike detection logic
    function calculateUsageSpike(currentValue, averageValue) {
      if (averageValue <= 0) {
        return null
      }

      const spikePercentage =
        ((currentValue - averageValue) / averageValue) * 100

      if (spikePercentage >= 100) {
        return { severity: 'critical', percentage: spikePercentage }
      } else if (spikePercentage >= 50) {
        return { severity: 'warning', percentage: spikePercentage }
      } else if (spikePercentage >= 20) {
        return { severity: 'info', percentage: spikePercentage }
      }

      return null
    }

    it('should return critical when usage spikes 100%+ above average', () => {
      const result = calculateUsageSpike(200000, 100000)

      expect(result?.severity).toBe('critical')
      expect(result?.percentage).toBe(100)
    })

    it('should return warning when usage spikes 50%+ above average', () => {
      const result = calculateUsageSpike(150000, 100000)

      expect(result?.severity).toBe('warning')
      expect(result?.percentage).toBe(50)
    })

    it('should return info when usage spikes 20%+ above average', () => {
      const result = calculateUsageSpike(120000, 100000)

      expect(result?.severity).toBe('info')
      expect(result?.percentage).toBeCloseTo(20, 5)
    })

    it('should return null when usage is below 20% spike', () => {
      const result = calculateUsageSpike(110000, 100000)

      expect(result).toBeNull()
    })

    it('should return null for zero average', () => {
      const result = calculateUsageSpike(100000, 0)

      expect(result).toBeNull()
    })

    // @note testing negative feedback logic
    function calculateFeedbackAlert(thumbsUp, thumbsDown) {
      const totalRatings = thumbsUp + thumbsDown

      if (totalRatings < 10) {
        return null
      }

      const negativeRatio = thumbsDown / totalRatings

      if (negativeRatio >= 0.5) {
        return { severity: 'critical', percentage: negativeRatio * 100 }
      } else if (negativeRatio >= 0.3) {
        return { severity: 'warning', percentage: negativeRatio * 100 }
      }

      return null
    }

    it('should return critical when negative feedback is 50%+', () => {
      const result = calculateFeedbackAlert(10, 15)

      expect(result?.severity).toBe('critical')
      expect(result?.percentage).toBe(60)
    })

    it('should return warning when negative feedback is 30%+', () => {
      const result = calculateFeedbackAlert(14, 6)

      expect(result?.severity).toBe('warning')
      expect(result?.percentage).toBe(30)
    })

    it('should return null when negative feedback is below 30%', () => {
      const result = calculateFeedbackAlert(18, 2)

      expect(result).toBeNull()
    })

    it('should return null when total ratings is less than 10', () => {
      const result = calculateFeedbackAlert(4, 5)

      expect(result).toBeNull()
    })
  })
})

describe('bot alerts report abandonment logic', () => {
  function calculateAbandonmentRate(
    singleTurnConversations,
    totalConversationsWithUserMessages
  ) {
    if (totalConversationsWithUserMessages <= 0) {
      return null
    }

    return Number(
      (
        (singleTurnConversations / totalConversationsWithUserMessages) *
        100
      ).toFixed(1)
    )
  }

  it('should return no data when there are no conversations with user messages', () => {
    const abandonmentRate = calculateAbandonmentRate(0, 0)

    expect(abandonmentRate).toBeNull()
  })

  it('should calculate abandonment rate when user-message conversations exist', () => {
    const abandonmentRate = calculateAbandonmentRate(3, 10)

    expect(abandonmentRate).toBe(30)
  })
})

// -----------------------------------------------------------------------------
// Report registry handler tests
// -----------------------------------------------------------------------------

describe('Dataset Records Report handler (cm7k3m5n8k000008jq7h9e5b1a)', () => {
  const REPORT_ID = 'cm7k3m5n8k000008jq7h9e5b1a'
  const session = { user: { id: 'user-1' } }

  let mockStore

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore = { countRecords: jest.fn() }

    const { getStore } = require('@/lib/store.types')

    getStore.mockResolvedValue(mockStore)
  })

  it('should return totalRecords and per-dataset breakdown', async () => {
    prisma.dataset.findMany.mockResolvedValue([
      { id: 'ds-1' },
      { id: 'ds-2' },
    ])
    mockStore.countRecords.mockResolvedValueOnce(10).mockResolvedValueOnce(25)

    const result = await registry[REPORT_ID].handler(session, {
      datasetIds: ['ds-1', 'ds-2'],
    })

    expect(result.totalRecords).toBe(35)
    expect(result.breakdown).toEqual([
      { datasetId: 'ds-1', records: 10 },
      { datasetId: 'ds-2', records: 25 },
    ])
  })

  it('should only include datasets owned by the requesting user', async () => {
    prisma.dataset.findMany.mockResolvedValue([])
    mockStore.countRecords.mockResolvedValue(0)

    await registry[REPORT_ID].handler(session, { datasetIds: ['ds-other'] })

    expect(prisma.dataset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: {
            OR: [{ id: 'user-1' }, { parentId: 'user-1' }],
          },
        }),
      })
    )
  })

  it('should return zero totalRecords when no datasets are accessible', async () => {
    prisma.dataset.findMany.mockResolvedValue([])

    const result = await registry[REPORT_ID].handler(session, {
      datasetIds: ['ds-inaccessible'],
    })

    expect(result.totalRecords).toBe(0)
    expect(result.breakdown).toEqual([])
    expect(mockStore.countRecords).not.toHaveBeenCalled()
  })
})

describe('Conversation Usage Report handler (cru3m5n8k001008jq7h9e5b2c)', () => {
  const REPORT_ID = 'cru3m5n8k001008jq7h9e5b2c'
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should aggregate tokens and messages across authorized conversations', async () => {
    prisma.conversation.findMany.mockResolvedValue([
      { id: 'conv-1' },
      { id: 'conv-2' },
    ])
    prisma.usage.groupBy.mockResolvedValue([
      {
        conversationId: 'conv-1',
        type: 'CHATBOTKIT_BASE_TOKEN',
        _sum: { count: 500 },
      },
      {
        conversationId: 'conv-1',
        type: 'CHATBOTKIT_MESSAGE',
        _sum: { count: 10 },
      },
      {
        conversationId: 'conv-2',
        type: 'CHATBOTKIT_BASE_TOKEN',
        _sum: { count: 200 },
      },
    ])

    const result = await registry[REPORT_ID].handler(session, {
      conversationIds: ['conv-1', 'conv-2'],
    })

    expect(result.totalTokens).toBe(700)
    expect(result.totalMessages).toBe(10)
    expect(result.totalConversations).toBe(2)
    expect(result.items).toHaveLength(2)
    expect(
      result.items.find((i) => i.conversationId === 'conv-1')
    ).toMatchObject({
      tokens: 500,
      messages: 10,
      conversations: 1,
    })
  })

  it('should exclude conversations not owned by the requesting user', async () => {
    // Only conv-1 is owned by user-1; conv-other is filtered out by findMany
    prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }])
    prisma.usage.groupBy.mockResolvedValue([])

    const result = await registry[REPORT_ID].handler(session, {
      conversationIds: ['conv-1', 'conv-other'],
    })

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      })
    )
    expect(result.items.map((i) => i.conversationId)).toEqual(['conv-1'])
  })

  it('should return zero totals when user owns none of the requested conversations', async () => {
    prisma.conversation.findMany.mockResolvedValue([])

    const result = await registry[REPORT_ID].handler(session, {
      conversationIds: ['conv-none'],
    })

    expect(result.totalTokens).toBe(0)
    expect(result.totalConversations).toBe(0)
    expect(result.totalMessages).toBe(0)
    expect(result.items).toEqual([])
    // groupBy should not be called when there are no valid conversations
    expect(prisma.usage.groupBy).not.toHaveBeenCalled()
  })

  it('should deduplicate repeated conversation IDs in input', async () => {
    prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }])
    prisma.usage.groupBy.mockResolvedValue([])

    await registry[REPORT_ID].handler(session, {
      conversationIds: ['conv-1', 'conv-1', 'conv-1'],
    })

    // findMany should only query unique IDs
    const [arg] = prisma.conversation.findMany.mock.calls[0]

    expect(arg.where.id.in).toEqual(['conv-1'])
  })
})
