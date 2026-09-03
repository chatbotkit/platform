// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * -@swagger
 *
 * /event/metric/list:
 *   get:
 *     operationId: listEventMetrics
 *     summary: List event metrics
 *     tags:
 *       - Event
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *       - in: query
 *         name: type
 *         schema:
 *           description: Filter by metric type
 *           type: string
 *     responses:
 *       200:
 *         description: The list of metrics was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties: {}
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1event~1metric~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const metrics = await prisma.eventMetric.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').EventMetric>} */ (
              getFieldQueryFilter
            )(req, [
              'type',
              'conversationId',
              'taskId',
              'contactId',
              'blueprintId',
              'botId',
              'datasetId',
              'recordId',
              'skillsetId',
              'abilityId',
              'fileId',
              'secretId',
              'portalId',
              'widgetIntegrationId',
              'slackIntegrationId',
              'githubIntegrationId',
              'discordIntegrationId',
              'microsoftteamsIntegrationId',
              'googlechatIntegrationId',
              'whatsappIntegrationId',
              'messengerIntegrationId',
              'instagramIntegrationId',
              'telegramIntegrationId',
              'twilioIntegrationId',
              'emailIntegrationId',
              'sitemapIntegrationId',
              'notionIntegrationId',
              'triggerIntegrationId',
              'supportIntegrationId',
              'extractIntegrationId',
              'mcpserverIntegrationId',
              'skillserverIntegrationId',
              // @todo enable when anam/avatar/recall emit events (add the
              // EventLog/EventMetric column + a logEvent relation first)
              // 'anamIntegrationId',
              // 'avatarIntegrationId',
              // 'recallIntegrationId',
              'webhookId',
            ]),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          conversationId: true,

          taskId: true,

          contactId: true,

          blueprintId: true,

          botId: true,

          datasetId: true,

          recordId: true,

          skillsetId: true,

          abilityId: true,

          fileId: true,

          secretId: true,

          portalId: true,

          widgetIntegrationId: true,

          slackIntegrationId: true,
          githubIntegrationId: true,

          discordIntegrationId: true,

          microsoftteamsIntegrationId: true,

          googlechatIntegrationId: true,

          whatsappIntegrationId: true,

          messengerIntegrationId: true,
          instagramIntegrationId: true,

          telegramIntegrationId: true,

          twilioIntegrationId: true,

          emailIntegrationId: true,

          sitemapIntegrationId: true,

          notionIntegrationId: true,

          triggerIntegrationId: true,

          supportIntegrationId: true,

          extractIntegrationId: true,

          mcpserverIntegrationId: true,
          skillserverIntegrationId: true,
          // @todo enable alongside the whitelist entries above
          // anamIntegrationId: true,
          // avatarIntegrationId: true,
          // recallIntegrationId: true,

          webhookId: true,

          // resource specific

          type: true,

          value: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(metrics),
      }
    })
  )
)

/**
 * @manual Event Metrics
 *
 * ## Listing Event Metrics
 *
 * The event metrics listing endpoint provides comprehensive access to
 * individual metric records with powerful filtering, pagination, and
 * querying capabilities. Unlike the time-series endpoint which aggregates
 * metrics into daily summaries, the list endpoint returns detailed metric
 * records that include all associated metadata, resource relationships, and
 * specific metric values, enabling granular analysis and detailed auditing
 * of platform activity.
 *
 * This endpoint is particularly useful when you need to investigate specific
 * metric records, understand the detailed composition of aggregated values,
 * or perform complex filtering based on resource associations, metric types,
 * or custom metadata fields. The flexible filtering system allows you to
 * narrow results to specific conversations, integrations, bots, datasets, or
 * any combination of platform resources.
 *
 * ```http
 * GET /api/v1/event/metric/list?order=desc&take=50&type=token_usage
 * Accept: application/json
 * ```
 *
 * The listing endpoint supports extensive filtering by resource associations,
 * allowing you to retrieve metrics for specific platform components:
 *
 * ```http
 * GET /api/v1/event/metric/list?botId=bot_abc123&conversationId=conv_xyz789&order=desc&take=100
 * ```
 *
 * Each metric record in the response includes comprehensive information:
 *
 * - **Identifiers**: Unique metric ID, name, and description
 * - **Metric Type**: Category of metric (message_count, token_usage,
 *   conversation_count, etc.)
 * - **Metric Value**: Numerical value representing the measured quantity
 * - **Resource Associations**: References to related conversations, bots,
 *   datasets, integrations, and other platform resources
 * - **Timestamps**: Creation and update timestamps for temporal analysis
 * - **Custom Metadata**: Additional context and attributes captured with the
 *   metric
 *
 * The endpoint uses cursor-based pagination for efficient traversal of large
 * result sets, with configurable page sizes and ordering (ascending or
 * descending by creation date). This pagination approach ensures consistent
 * results even when new metrics are being created concurrently, preventing
 * duplicate or missing records in paginated queries.
 *
 * **Filtering Capabilities:**
 *
 * The list endpoint supports filtering by multiple dimensions simultaneously,
 * enabling precise queries for specific analysis scenarios:
 *
 * - **By Resource Type**: Filter metrics associated with specific bots,
 *   conversations, datasets, integrations, or other platform resources
 * - **By Metric Type**: Focus on specific metric categories like token
 *   usage, message counts, or custom metric types
 * - **By Time Range**: Use cursor-based pagination with ordering to retrieve
 *   metrics within specific time windows
 * - **By Metadata**: Filter using custom metadata fields to query metrics
 *   with specific attributes or characteristics
 *
 * **Common Use Cases:**
 *
 * - **Detailed Usage Analysis**: Investigate specific usage patterns or
 *   anomalies by examining individual metric records with full context
 * - **Resource Attribution**: Track metrics associated with specific bots,
 *   conversations, or integrations to understand component-level performance
 * - **Cost Reconciliation**: Verify billing calculations by auditing
 *   detailed token usage and API call metrics
 * - **Debugging**: Investigate unexpected behavior by examining metric
 *   records related to specific resources or time periods
 * - **Compliance Auditing**: Generate detailed reports showing exactly which
 *   resources consumed which resources when
 *
 * The list endpoint complements the time-series endpoint by providing
 * drill-down capabilities. While time-series data reveals high-level trends
 * and patterns, the list endpoint enables investigation of the underlying
 * detail, helping you understand what drives those trends and validate
 * aggregate calculations against source data.
 */
