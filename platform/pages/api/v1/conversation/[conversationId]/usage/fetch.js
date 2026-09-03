// @ts-check
import { clampDate, maxDate, timePlusDays } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { getConversationUsageStats } from '@/prisma/sql'

import { withGet } from '@/lib/method'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /conversation/{conversationId}/usage/fetch:
 *   get:
 *     operationId: fetchConversationUsage
 *     summary: Fetch conversation usage statistics
 *     description: |
 *       Retrieve usage statistics for a specific conversation, including total tokens
 *       (BASE type only) and total messages. Optionally filter by date range.
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           description: Start date for the period (ISO 8601 format)
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           description: End date for the period (ISO 8601 format)
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Conversation usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   description: Total number of BASE tokens used
 *                   type: integer
 *                 messages:
 *                   description: Total number of messages
 *                   type: integer
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const conversationId = requiredUrlParam(req, 'conversationId')

    const conversation = await prisma.conversation.findUniqueByIdentifier(
      session.user,
      conversationId,
      {
        select: {
          // identifiers

          id: true,
          userId: true,
        },
      }
    )

    if (!conversation) {
      return notFound()
    }

    if (conversation.userId !== session.user.id) {
      return notAuthorized()
    }

    const from = queryParam(req, 'from')
    const to = queryParam(req, 'to')

    const maxAllowedDate = new Date()
    const minAllowedDate = timePlusDays(-90, maxAllowedDate)

    const fromDate = clampDate(
      from ? new Date(from) : minAllowedDate,
      minAllowedDate,
      maxAllowedDate
    )
    const toDate = clampDate(
      to ? new Date(to) : maxAllowedDate,
      minAllowedDate,
      maxAllowedDate
    )

    const validFromDate = fromDate
    const validToDate = maxDate(fromDate, toDate) || toDate

    const result = await prisma.$queryRawTyped(
      getConversationUsageStats(
        session.user.id,
        conversation.id,
        validFromDate,
        validToDate
      )
    )

    const stats = result[0] || {
      totalTokens: 0,
      totalMessages: 0,
    }

    return ok(
      makeJsonSafe({
        tokens: Number(stats.totalTokens || 0),
        messages: Number(stats.totalMessages || 0),
      })
    )
  })
)

/**
 * @manual Conversation Usage Statistics
 * @description Conversation usage statistics provide granular insights into token consumption and message activity at the individual conversation level, enabling detailed analysis of resource usage, cost attribution, and interaction patterns for specific user sessions.
 * @category Objects/Conversations
 * @tags conversation, usage, statistics, metrics, monitoring, tokens
 * @index 40
 *
 * While bot-level usage statistics provide an overview of aggregate resource
 * consumption across all conversations, conversation-level statistics enable
 * you to drill down into the details of individual user sessions. This
 * granular visibility is essential for understanding how different types of
 * conversations consume resources, attributing costs to specific customer
 * interactions, and identifying optimization opportunities at the
 * conversation level.
 *
 * Conversation usage statistics are particularly valuable when you need to
 * understand the economics of individual customer interactions, analyze why
 * certain conversations consume more resources than others, or provide
 * detailed usage reports to end customers in multi-tenant scenarios. By
 * tracking usage at the conversation level, you can implement more
 * sophisticated cost controls, identify unusually expensive conversations
 * that may indicate issues, and optimize conversation flows to reduce
 * resource consumption while maintaining quality.
 *
 * ## Fetching Conversation Usage Statistics
 *
 * To retrieve usage statistics for a specific conversation, query the
 * conversation usage endpoint with the conversation ID. Like bot usage
 * statistics, you can optionally filter by date range to focus on specific
 * time periods within the conversation's lifetime.
 *
 * This endpoint returns two primary metrics: total tokens consumed and total
 * messages exchanged within the conversation. These metrics help you
 * understand the conversation's resource footprint and interaction depth.
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/usage/fetch
 * ```
 *
 * To analyze usage during a specific period within a long-running
 * conversation, include date range parameters:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/usage/fetch?from=2024-01-15T00:00:00Z&to=2024-01-20T23:59:59Z
 * ```
 *
 * The response provides detailed usage metrics:
 *
 * - **tokens**: Total number of BASE-type tokens consumed specifically within
 *   this conversation during the specified period. This includes tokens from
 *   user messages, bot responses, and any context or memory retrieved during
 *   the conversation. Token consumption varies based on conversation length,
 *   complexity of responses, and amount of context maintained.
 *
 * - **messages**: Total number of messages exchanged in the conversation.
 *   This count includes both user messages and bot responses, providing a
 *   measure of conversation depth and engagement level. Higher message counts
 *   generally correlate with more complex or longer-lasting interactions.
 *
 * **Usage Patterns and Analysis:**
 *
 * Conversation usage statistics reveal important patterns about how users
 * interact with your bots. Short conversations with high token counts may
 * indicate complex queries requiring detailed responses, while long
 * conversations with moderate token usage suggest iterative problem-solving
 * or exploratory interactions. Understanding these patterns helps you
 * optimize bot configuration and manage costs effectively.
 *
 * **Important Considerations:**
 *
 * - The 90-day lookback limit applies to conversation usage statistics just
 *   as it does for bot usage. Only data from the most recent 90 days is
 *   available for querying.
 *
 * - Conversation usage reflects only the tokens and messages directly
 *   associated with that specific conversation ID. If a user has multiple
 *   conversations with the same bot, each conversation's usage is tracked
 *   separately.
 *
 * - Token counts are computed from usage logs and represent actual
 *   consumption by the underlying AI models. Different models have different
 *   tokenization strategies, so token counts may vary between conversations
 *   using different model configurations.
 *
 * - For conversations that span extended periods, date range filtering allows
 *   you to analyze usage patterns over time and identify trends in how
 *   conversation resource consumption evolves as the interaction progresses.
 */
