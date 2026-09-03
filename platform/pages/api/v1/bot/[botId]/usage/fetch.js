// @ts-check
import { clampDate, maxDate, timePlusDays } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { getBotUsageStats } from '@/prisma/sql'

import { withGet } from '@/lib/method'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * Check if the request accepts Prometheus metrics format.
 *
 * @param {Request | import('next').NextApiRequest} req
 * @returns {boolean}
 */
function acceptsPrometheusFormat(req) {
  /** @type {string} */
  let accept = ''
  /** @type {string} */
  let userAgent = ''

  // @note handle both Web API Request (Headers object) and NextApiRequest
  // (plain object) header formats
  if (req.headers instanceof Headers) {
    accept = req.headers.get('accept') || ''
    userAgent = req.headers.get('user-agent') || ''
  } else {
    const headers = /** @type {import('http').IncomingHttpHeaders} */ (
      req.headers
    )

    accept = /** @type {string} */ (headers.accept) || ''
    userAgent = /** @type {string} */ (headers['user-agent']) || ''
  }

  return (
    accept.includes('application/openmetrics-text') ||
    accept.includes('text/plain; version=0.0.4') ||
    userAgent.includes('Prometheus')
  )
}

/**
 * Format usage stats as Prometheus metrics text.
 *
 * @param {string} botId
 * @param {{ tokens: number, conversations: number, messages: number }} stats
 * @returns {string}
 */
function formatPrometheusMetrics(botId, stats) {
  const lines = [
    '# HELP cbk_bot_tokens_total Total tokens consumed by the bot',
    '# TYPE cbk_bot_tokens_total counter',
    `cbk_bot_tokens_total{bot_id="${botId}"} ${stats.tokens}`,
    '',
    '# HELP cbk_bot_conversations_total Total conversations initiated with the bot',
    '# TYPE cbk_bot_conversations_total counter',
    `cbk_bot_conversations_total{bot_id="${botId}"} ${stats.conversations}`,
    '',
    '# HELP cbk_bot_messages_total Total messages exchanged with the bot',
    '# TYPE cbk_bot_messages_total counter',
    `cbk_bot_messages_total{bot_id="${botId}"} ${stats.messages}`,
    '',
  ]

  return lines.join('\n')
}

/**
 * @swagger
 *
 * /bot/{botId}/usage/fetch:
 *   get:
 *     operationId: fetchBotUsage
 *     summary: Fetch bot usage statistics
 *     description: |
 *       Retrieve usage statistics for a specific bot, including total tokens
 *       (BASE type only), total conversations, and total messages. Optionally
 *       filter by date range.
 *     tags:
 *       - Bot
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           description: The ID of the bot
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
 *         description: Bot usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   description: Total number of BASE tokens used
 *                   type: integer
 *                 conversations:
 *                   description: Total number of conversations
 *                   type: integer
 *                 messages:
 *                   description: Total number of messages
 *                   type: integer
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const botId = requiredUrlParam(req, 'botId')

    const bot = await prisma.bot.findUniqueByIdentifier(session.user, botId, {
      select: {
        // identifiers

        id: true,
        userId: true,
      },
    })

    if (!bot) {
      return notFound()
    }

    if (bot.userId !== session.user.id) {
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
      getBotUsageStats(session.user.id, bot.id, validFromDate, validToDate)
    )

    const stats = result[0] || {
      totalTokens: 0,
      totalConversations: 0,
      totalMessages: 0,
    }

    const usageStats = {
      tokens: Number(stats.totalTokens || 0),
      conversations: Number(stats.totalConversations || 0),
      messages: Number(stats.totalMessages || 0),
    }

    // @note return Prometheus format if client accepts it
    if (acceptsPrometheusFormat(req)) {
      return new Response(formatPrometheusMetrics(botId, usageStats), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      })
    }

    return ok(makeJsonSafe(usageStats))
  })
)

/**
 * @manual Bot Usage Statistics
 * @description Bot usage statistics provide detailed insights into resource consumption, conversation volumes, and message activity for individual bots, enabling you to monitor performance, track costs, and optimize bot operations over time.
 * @category Resources/Bots
 * @tags bot, usage, statistics, metrics, monitoring
 * @index 30
 *
 * Understanding how your bots consume resources is essential for managing
 * costs, optimizing performance, and making informed decisions about scaling
 * and resource allocation. Bot usage statistics provide comprehensive metrics
 * that track token consumption, conversation counts, and message volumes,
 * giving you visibility into how each bot is being used and what resources
 * it's consuming.
 *
 * These statistics are particularly valuable for production environments where
 * multiple bots may be serving different use cases with varying levels of
 * activity. By monitoring usage patterns, you can identify high-traffic bots
 * that may need optimization, detect unusual activity patterns that could
 * indicate issues, and forecast future resource needs based on historical
 * trends.
 *
 * ## Fetching Bot Usage Statistics
 *
 * To retrieve usage statistics for a specific bot, you can query the usage
 * endpoint with optional date range filters. The endpoint returns aggregated
 * metrics including total tokens consumed (BASE type only), total number of
 * conversations initiated, and total messages exchanged during the specified
 * period.
 *
 * By default, the statistics cover up to the last 90 days of activity. You
 * can narrow this range by specifying start and end dates to focus on
 * specific time periods, which is useful for generating reports, analyzing
 * trends over specific intervals, or investigating usage patterns during
 * particular events or campaigns.
 *
 * ```http
 * GET /api/v1/bot/{botId}/usage/fetch
 * ```
 *
 * To filter statistics by date range, include `from` and `to` query
 * parameters with ISO 8601 formatted dates:
 *
 * ```http
 * GET /api/v1/bot/{botId}/usage/fetch?from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z
 * ```
 *
 * The response includes three key metrics:
 *
 * - **tokens**: Total number of BASE-type tokens consumed by the bot during
 *   the period. This includes both input tokens (from user messages and
 *   context) and output tokens (from bot responses). Token counts are the
 *   primary basis for usage-based billing.
 *
 * - **conversations**: Total number of unique conversations initiated with
 *   the bot. This metric helps you understand engagement levels and how many
 *   distinct users or sessions are interacting with your bot.
 *
 * - **messages**: Total number of messages exchanged in conversations with
 *   the bot. This includes both user messages and bot responses, providing
 *   insight into conversation depth and interaction patterns.
 *
 * **Important Considerations:**
 *
 * - Date ranges are automatically clamped to a maximum of 90 days in the past
 *   to ensure query performance. Requests for older data will be adjusted to
 *   start from the 90-day threshold.
 *
 * - The `from` date must be earlier than or equal to the `to` date. If the
 *   dates are reversed, the system will automatically use the later date as
 *   both the start and end, effectively returning statistics for a single
 *   point in time.
 *
 * - Usage statistics are aggregated from transaction logs and may take a few
 *   minutes to reflect the most recent activity. For real-time monitoring of
 *   active conversations, use the conversation list endpoints instead.
 *
 * - Token counts represent BASE token types only. Different AI models may
 *   have different token counting methods and pricing tiers, so always refer
 *   to your billing dashboard for accurate cost calculations.
 *
 * ## Prometheus Metrics Format
 *
 * This endpoint supports Prometheus metrics format for integration with
 * monitoring and observability systems. When a client sends a request with
 * an appropriate `Accept` header, the endpoint returns metrics in Prometheus
 * text exposition format instead of JSON.
 *
 * To request Prometheus format, include one of these Accept headers:
 *
 * ```http
 * Accept: application/openmetrics-text
 * Accept: text/plain; version=0.0.4
 * ```
 *
 * Alternatively, the endpoint automatically detects Prometheus clients by
 * their User-Agent header (containing "Prometheus").
 *
 * The Prometheus response includes the following metrics:
 *
 * ```text
 * # HELP cbk_bot_tokens_total Total tokens consumed by the bot
 * # TYPE cbk_bot_tokens_total counter
 * cbk_bot_tokens_total{bot_id="bot_abc123"} 45230
 *
 * # HELP cbk_bot_conversations_total Total conversations initiated with the bot
 * # TYPE cbk_bot_conversations_total counter
 * cbk_bot_conversations_total{bot_id="bot_abc123"} 892
 *
 * # HELP cbk_bot_messages_total Total messages exchanged with the bot
 * # TYPE cbk_bot_messages_total counter
 * cbk_bot_messages_total{bot_id="bot_abc123"} 4521
 * ```
 *
 * To configure Prometheus to scrape bot metrics, add a job to your
 * `prometheus.yml`:
 *
 * ```yaml
 * scrape_configs:
 *   - job_name: 'chatbotkit-bot'
 *     scheme: https
 *     authorization:
 *       type: Bearer
 *       credentials: '<your-api-token>'
 *     static_configs:
 *       - targets: ['api.chatbotkit.com']
 *     metrics_path: '/api/v1/bot/<botId>/usage/fetch'
 * ```
 *
 * This enables real-time monitoring dashboards in Grafana and alerting based
 * on bot activity thresholds.
 *
 * **Security Note:** For secure access in monitoring systems, you can issue a
 * scoped token that only grants access to a specific bot. This limits the
 * token's permissions to the bot resource, reducing risk if the token is
 * compromised. See the Token API documentation for details on creating
 * bot-scoped tokens.
 */
