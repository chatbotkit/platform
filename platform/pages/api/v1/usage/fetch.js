// @ts-check
import prisma from '@/prisma/client'

import {
  getApproximateTotalAbilities,
  getApproximateTotalRecords,
} from '@/lib/limit.estimate'
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'
import { getUsage } from '@/lib/usage.get'

/**
 * @swagger
 *
 * /usage/fetch:
 *   get:
 *     operationId: fetchUsage
 *     summary: Fetch usage
 *     description:
 *       Fetches the usage data for the user in the current billing period.
 *     tags:
 *       - Usage
 *     responses:
 *       200:
 *         description: The usage information was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   description: The number of tokens the user has used
 *                   type: number
 *                 conversations:
 *                   description: The number of conversations the user has created
 *                   type: number
 *                 messages:
 *                   description: The number of messages the user has sent
 *                   type: number
 *                 database:
 *                   description: Database usage information
 *                   type: object
 *                   properties:
 *                     datasets:
 *                       description: The number of datasets the user has created
 *                       type: number
 *                     records:
 *                       description: The number of records the user has created
 *                       type: number
 *                     skillsets:
 *                       description: The number of skillsets the user has created
 *                       type: number
 *                     abilities:
 *                       description: The number of abilities the user has created
 *                       type: number
 *                     files:
 *                       description: The number of files the user has created
 *                       type: number
 *                     users:
 *                       description: The number of users the user has created
 *                       type: number
 *                   required:
 *                     - datasets
 *                     - records
 *                     - skillsets
 *                     - abilities
 *                     - files
 *                     - users
 *               required:
 *                 - tokens
 *                 - conversations
 *                 - messages
 *                 - database
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (_req, session) {
    const { tokens, conversations, messages } = await getUsage(session.user.id)

    const [td, tr, ts, ta, fa, us] = await Promise.all([
      prisma.dataset.count({
        where: {
          userId: session.user.id,
        },

        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      }),

      getApproximateTotalRecords(session.user),

      prisma.skillset.count({
        where: {
          userId: session.user.id,
        },

        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      }),

      getApproximateTotalAbilities(session.user),

      prisma.file.count({
        where: {
          userId: session.user.id,
        },

        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      }),

      prisma.user.count({
        where: {
          parentId: session.user.id,
        },

        cacheStrategy: {
          ttl: 60,
          swr: 60,
        },
      }),
    ])

    return ok(
      makeJsonSafe({
        tokens: tokens.value,
        conversations: conversations.value,
        messages: messages.value,
        database: {
          datasets: td,
          records: tr,
          skillsets: ts,
          abilities: ta,
          files: fa,
          users: us,
        },
      })
    )
  })
)

/**
 * @manual Usage
 * @description Usage statistics provide comprehensive visibility into your platform consumption, including token usage, conversation counts, message volumes, and database resource allocation for the current billing period.
 * @category Analytics
 * @tags usage, statistics, billing, monitoring
 * @index 1
 *
 * Understanding your usage patterns is essential for managing costs,
 * optimizing resource allocation, and ensuring you stay within your plan
 * limits. Usage statistics provide real-time insights into how you're using
 * the platform, helping you make informed decisions about scaling, budgeting,
 * and resource management.
 *
 * The platform tracks multiple usage dimensions including token consumption
 * from AI model interactions, conversation and message volumes, and counts of
 * database resources like datasets, records, skillsets, and files. All
 * metrics reset at the beginning of each billing period, providing a clear
 * view of current-period consumption.
 *
 * ## Fetching Current Usage
 *
 * Retrieve comprehensive usage statistics for the current billing period to
 * monitor consumption across all platform features and resources. The
 * endpoint provides a complete snapshot of your usage in a single request.
 *
 * ```http
 * GET /api/v1/usage/fetch
 * ```
 *
 * ### Response Breakdown
 *
 * The usage response includes several key metrics:
 *
 * **Token Usage**: Total number of tokens consumed by AI model interactions
 * during the current billing period. Tokens represent the computational
 * currency for language model operations including chat completions, content
 * generation, and other AI-powered features. Higher token counts indicate
 * more extensive AI usage.
 *
 * **Conversations**: Number of conversation instances created. Each
 * conversation represents a distinct interaction session with bots or agents.
 * This metric helps track user engagement and conversation volumes across
 * your applications.
 *
 * **Messages**: Total message count across all conversations. This includes
 * both user inputs and bot responses, providing insight into interaction
 * depth and engagement levels. High message counts relative to conversation
 * counts indicate longer, more detailed interactions.
 *
 * **Database Resources**: Counts of various database entities:
 *
 * - **Datasets**: Number of knowledge base collections created
 * - **Records**: Total number of records across all datasets
 * - **Skillsets**: Number of ability collections defined
 * - **Abilities**: Total number of custom abilities created
 * - **Files**: Number of files uploaded and stored
 * - **Users**: Number of child Users created
 *
 * ### Usage Monitoring Best Practices
 *
 * Regular usage monitoring helps you:
 *
 * - **Track Consumption Trends**: Identify usage patterns and growth over time
 * - **Optimize Costs**: Understand which features drive costs and optimize accordingly
 * - **Prevent Overages**: Monitor approaching limits before hitting billing thresholds
 * - **Capacity Planning**: Make informed decisions about plan upgrades or scaling
 * - **Resource Optimization**: Identify unused or underutilized resources
 *
 * Consider integrating usage statistics into your application dashboards or
 * monitoring systems to maintain continuous visibility into platform
 * consumption. Automated alerts based on usage thresholds can help prevent
 * unexpected overages.
 *
 * **Note**: Usage metrics are calculated in real-time but may include slight
 * delays due to caching optimizations. For high-precision billing
 * calculations, refer to your detailed billing statements which provide
 * complete accuracy.
 */
