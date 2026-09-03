'use server'

import { getYYYYMMDD, timePlusDays } from '@chatbotkit-dev/time'
import type { UnwrapPromise } from '@chatbotkit-dev/typescript-utils/promise'

import prisma from '@/prisma/client'
import {
  breakdownTotalUsageTokensOverPeriod,
  getTotalConversationsOverPeriod,
  getTotalMessagesOverPeriod,
  getTotalUsageTokensOverPeriod,
} from '@/prisma/sql'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { errorToErrorResponse } from '@/lib/error'
import { makeJsonSafe } from '@/lib/struct'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

const DEFAULT_PERIOD = 30

interface Usage {
  date: string
  total: number
}

/**
 * @action
 */
export const getMetrics = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, session, {}) => {
    const periodEnd = new Date()
    const periodStart = timePlusDays(-DEFAULT_PERIOD, periodEnd)

    const data = await prisma.$queryMap({
      totalTokens: prisma.$queryRawTyped(
        getTotalUsageTokensOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalTokensPreviousPeriod: prisma.$queryRawTyped(
        getTotalUsageTokensOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
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

      totalConversations: prisma.$queryRawTyped(
        getTotalConversationsOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalMessages: prisma.$queryRawTyped(
        getTotalMessagesOverPeriod(session.user.id, periodStart, periodEnd)
      ),
    })

    return makeJsonSafe({
      tokenMetrics: {
        totalTokens: {
          title: 'Total Tokens',
          description: 'Number of tokens consumed',
          value: Number(data.totalTokens[0].total),
          change:
            Number(data.totalTokens[0].total) -
            Number(data.totalTokensPreviousPeriod[0].total),
          period: 'last 30 days',
          details: {
            metric: {
              title: 'Total Tokens',
              description: 'Number of tokens consumed',
              value: Number(data.totalTokens[0].total),
              change:
                Number(data.totalTokens[0].total) -
                Number(data.totalTokensPreviousPeriod[0].total),
              period: 'last 30 days',
            },
            lineChart: data.breakdownOfTokens.map(({ date, total }) => ({
              date: date == null ? undefined : getYYYYMMDD(date),
              total: Number(total),
            })),
          },
        },
        averageTokensPerConversation: {
          title: 'Average Tokens per Conversation',
          description: 'Average number of tokens consumed per conversation',
          value:
            data.totalConversations[0].total > 0
              ? Number(data.totalTokens[0].total) /
                Number(data.totalConversations[0].total)
              : 0,
          period: 'last 30 days',
        },
        averageTokensPerMessage: {
          title: 'Average Tokens per Message',
          description: 'Average number of tokens consumed per message',
          value:
            data.totalMessages[0].total > 0
              ? Number(data.totalTokens[0].total) /
                Number(data.totalMessages[0].total)
              : 0,
          period: 'last 30 days',
        },
      },
    })
  }
)

/**
 * @action
 */
export const getUsage = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (
    _config,
    session,
    {}
  ): Promise<{
    tokens: Usage[]
    conversations: Usage[]
    messages: Usage[]
  }> => {
    const userClient = await getSessionClient(session)

    const usage = await userClient.usage.series.fetch()

    return {
      tokens: usage.tokens.map((item) => ({
        date: new Date(item.date).toISOString(),
        total: item.total,
      })),
      conversations: usage.conversations.map((item) => ({
        date: new Date(item.date).toISOString(),
        total: item.total,
      })),
      messages: usage.messages.map((item) => ({
        date: new Date(item.date).toISOString(),
        total: item.total,
      })),
    }
  }
)

/**
 * Retrieves all.
 *
 * @action
 */
export const getAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (
    _config,
    _session,
    {}
  ): Promise<{
    metrics: UnwrapPromise<ReturnType<typeof getMetrics>>
    usage: UnwrapPromise<ReturnType<typeof getUsage>>
  }> => {
    const [/* metrics,*/ usage] = await Promise.all([
      // getMetrics({}),
      getUsage({}),
    ])

    // if (metrics && 'error' in metrics) {
    //   throw errorToErrorResponse(metrics.error)
    // }

    if (usage && 'error' in usage) {
      throw errorToErrorResponse(usage.error)
    }

    return { metrics: null, usage }
  }
)
