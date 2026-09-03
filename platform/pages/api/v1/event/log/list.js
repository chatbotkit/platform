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
 * @swagger
 *
 * /event/log/list:
 *   get:
 *     operationId: listEventLogs
 *     summary: List event logs
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
 *     responses:
 *       200:
 *         description: The list of events was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             description: The type of event (e.g., 'conversation.create')
 *                             type: string
 *                           conversationId:
 *                             description: Related conversation ID if applicable
 *                             type: string
 *                           taskId:
 *                             description: Related task ID if applicable
 *                             type: string
 *                           contactId:
 *                             description: Related contact ID if applicable
 *                             type: string
 *                           blueprintId:
 *                             description: Related blueprint ID if applicable
 *                             type: string
 *                           botId:
 *                             description: Related bot ID if applicable
 *                             type: string
 *                           datasetId:
 *                             description: Related dataset ID if applicable
 *                             type: string
 *                           recordId:
 *                             description: Related record ID if applicable
 *                             type: string
 *                           skillsetId:
 *                             description: Related skillset ID if applicable
 *                             type: string
 *                           abilityId:
 *                             description: Related ability ID if applicable
 *                             type: string
 *                           fileId:
 *                             description: Related file ID if applicable
 *                             type: string
 *                           secretId:
 *                             description: Related secret ID if applicable
 *                             type: string
 *                           portalId:
 *                             description: Related portal ID if applicable
 *                             type: string
 *                           widgetIntegrationId:
 *                             description: Related widget integration ID if applicable
 *                             type: string
 *                           slackIntegrationId:
 *                             description: Related Slack integration ID if applicable
 *                             type: string
 *                           discordIntegrationId:
 *                             description: Related Discord integration ID if applicable
 *                             type: string
 *                           microsoftteamsIntegrationId:
 *                             description: Related Microsoft Teams integration ID if applicable
 *                             type: string
 *                           googlechatIntegrationId:
 *                             description: Related Google Chat integration ID if applicable
 *                             type: string
 *                           whatsappIntegrationId:
 *                             description: Related WhatsApp integration ID if applicable
 *                             type: string
 *                           messengerIntegrationId:
 *                             description: Related Messenger integration ID if applicable
 *                             type: string
 *                           telegramIntegrationId:
 *                             description: Related Telegram integration ID if applicable
 *                             type: string
 *                           twilioIntegrationId:
 *                             description: Related Twilio integration ID if applicable
 *                             type: string
 *                           emailIntegrationId:
 *                             description: Related email integration ID if applicable
 *                             type: string
 *                           sitemapIntegrationId:
 *                             description: Related sitemap integration ID if applicable
 *                             type: string
 *                           notionIntegrationId:
 *                             description: Related Notion integration ID if applicable
 *                             type: string
 *                           triggerIntegrationId:
 *                             description: Related trigger integration ID if applicable
 *                             type: string
 *                           supportIntegrationId:
 *                             description: Related support integration ID if applicable
 *                             type: string
 *                           extractIntegrationId:
 *                             description: Related extract integration ID if applicable
 *                             type: string
 *                           mcpserverIntegrationId:
 *                             description: Related MCP server integration ID if applicable
 *                             type: string
 *                           webhookId:
 *                             description: Related webhook ID if applicable
 *                             type: string
 *                         required:
 *                           - type
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
 *                       $ref: '#/paths/~1event~1log~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const events = await prisma.eventLog.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').EventLog>} */ (
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

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(events),
      }
    })
  )
)

/**
 * @manual Event Logs
 * @description Event logs provide comprehensive tracking and auditing of system activities, resource interactions, and integration events, enabling monitoring, debugging, compliance, and analytics capabilities across the ChatBotKit platform.
 * @category Observability/Events
 * @tags events, logging, monitoring, audit, analytics
 * @index 1
 *
 * Event logs are the foundation of observability and operational intelligence
 * in ChatBotKit, automatically capturing detailed information about every
 * significant action, interaction, and state change across the platform. These
 * logs provide a time-series record of system behavior that supports multiple
 * critical use cases including real-time monitoring, historical analysis,
 * debugging complex issues, compliance reporting, usage analytics, and billing
 * reconciliation.
 *
 * The event logging system operates transparently in the background, recording
 * events from all major platform components including conversations, message
 * exchanges, integration activities, bot interactions, dataset operations,
 * skillset executions, and file processing. Each event captures relevant
 * context including resource identifiers, event type, timestamp, metadata, and
 * relationships to other platform objects, creating a comprehensive audit trail
 * that can be queried, analyzed, and exported for various purposes.
 *
 * Event logs are particularly valuable for understanding system behavior at
 * scale, identifying performance bottlenecks, troubleshooting integration
 * issues, generating usage reports, detecting anomalies, and ensuring platform
 * reliability. The logs provide visibility into both successful operations and
 * errors, making them essential for maintaining production systems and
 * optimizing conversational AI deployments.
 *
 * ## Listing Event Logs
 *
 * The event log listing endpoint provides flexible querying capabilities for
 * retrieving historical event data with comprehensive filtering, pagination,
 * and ordering options. You can query events by various dimensions including
 * time range, event type, associated resources, and custom metadata, enabling
 * both broad operational monitoring and targeted investigation of specific
 * scenarios or issues.
 *
 * Event log queries support cursor-based pagination for efficient traversal
 * of large result sets, with configurable page sizes and ordering (ascending
 * or descending by timestamp). The endpoint can return data in both JSON and
 * JSONL (JSON Lines) formats, with JSONL being particularly efficient for
 * processing large volumes of events through streaming pipelines or batch
 * analysis tools.
 *
 * ```http
 * GET /api/v1/event/log/list?order=desc&take=50
 * Accept: application/json
 * ```
 *
 * The response includes an array of event log entries, each containing:
 *
 * - **Event metadata**: Unique identifier, event type, creation timestamp
 * - **Resource associations**: References to related bots, conversations, integrations, datasets
 * - **Context information**: User ID, organization context, platform identifiers
 * - **Custom metadata**: Event-specific data captured at the time of occurrence
 * - **Pagination data**: Cursor tokens for retrieving subsequent pages
 *
 * ### Filtering Event Logs
 *
 * Event logs support two complementary filtering mechanisms: direct field
 * filters for querying by specific resource identifiers and event types, and
 * metadata filters for querying custom attributes captured during event
 * creation.
 *
 * **Direct Field Filters** allow you to scope event logs to specific resources
 * or event categories using query parameters:
 *
 * ```http
 * GET /api/v1/event/log/list?type=conversation.message.create&botId={botId}&take=50
 * Accept: application/json
 * ```
 *
 * Available direct filter parameters include:
 *
 * - `type`: Filter by event type (e.g., `conversation.message.create`, `bot.update`)
 * - `conversationId`: Events associated with a specific conversation
 * - `taskId`: Events associated with a specific task
 * - `contactId`: Events associated with a specific contact
 * - `blueprintId`, `botId`, `datasetId`: Filter by core resource IDs
 * - `recordId`, `skillsetId`, `abilityId`: Filter by related resource IDs
 * - `fileId`, `secretId`, `portalId`: Filter by storage and security resources
 * - `widgetIntegrationId`, `slackIntegrationId`, `discordIntegrationId`: Filter by integration
 * - `microsoftteamsIntegrationId`, `googlechatIntegrationId`: Filter by Microsoft Teams or Google Chat integration
 * - `whatsappIntegrationId`, `messengerIntegrationId`, `telegramIntegrationId`: Filter by messaging integration
 * - `twilioIntegrationId`, `emailIntegrationId`, `sitemapIntegrationId`: Filter by channel integration
 * - `notionIntegrationId`, `triggerIntegrationId`, `supportIntegrationId`: Filter by workflow integration
 * - `extractIntegrationId`, `mcpserverIntegrationId`: Filter by data and MCP integrations
 * - `webhookId`: Filter by webhook
 *
 * **Metadata Filters** enable querying by custom attributes stored in event
 * metadata using deep object notation:
 *
 * ```http
 * GET /api/v1/event/log/list?meta[eventCategory]=conversation&meta[status]=success&take=100
 * ```
 *
 * This filtering capability enables targeted queries for:
 *
 * - **Resource-specific events**: All events related to a particular bot, conversation, or integration
 * - **Event type filtering**: Focus on specific categories like errors, completions, or status changes
 * - **Time-based analysis**: Retrieve events within specific time windows for trend analysis
 * - **Custom attribute queries**: Filter by any metadata field captured during event creation
 *
 * ### Pagination and Performance
 *
 * For optimal performance when working with large event log datasets, the
 * endpoint implements cursor-based pagination. Use the cursor parameter with
 * values returned from previous queries to traverse the result set efficiently:
 *
 * ```http
 * GET /api/v1/event/log/list?cursor=eyJpZCI6ImV2dF8xMjM0NSJ9&take=100
 * ```
 *
 * **Best Practices**:
 *
 * - Use reasonable page sizes (50-500 events) to balance latency and data transfer
 * - Implement cursor-based pagination for processing large event volumes
 * - Filter events to reduce result set size when possible
 * - Consider using JSONL format for bulk processing and analysis
 * - Cache event log data when performing repeated queries
 * - Use descending order (newest first) for monitoring recent activity
 *
 * **Use Cases**:
 *
 * - Real-time operational monitoring and alerting
 * - Troubleshooting conversation or integration issues
 * - Generating usage and billing reports
 * - Compliance and audit trail documentation
 * - Performance analysis and optimization
 * - Customer support investigation and debugging
 * - Product analytics and feature usage tracking
 * - Security monitoring and anomaly detection
 *
 * **Important Notes**:
 *
 * - Event logs are retained according to your plan's data retention policy
 * - High-volume applications should implement appropriate filtering and pagination
 * - Event log queries count against API rate limits
 * - Bulk exports may be more efficient for large historical analysis
 * - Events are immutable once created and cannot be modified or deleted
 * - Sensitive data may be redacted in event logs based on privacy settings
 */
