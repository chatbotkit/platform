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
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /event/log/export:
 *   get:
 *     operationId: exportEventLogs
 *     summary: Export event logs
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
 *         description: The list of events was exported successfully
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
 *                       $ref: '#/paths/~1event~1log~1export/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *           text/csv:
 *             schema:
 *               type: string
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
        items: makeJsonSafe(events).map(({ meta, ...rest }) => {
          return {
            ...rest,

            meta: new Proxy(meta || {}, {
              get: function (target, prop) {
                if (prop === 'toString') {
                  return function () {
                    return target ? yaml.stringify(target) : ''
                  }
                }

                return target[prop]
              },
            }),
          }
        }),
      }
    })
  )
)

/**
 * @manual Event Logs
 * @index 20
 *
 * ## Exporting Event Logs
 *
 * The event log export endpoint provides bulk data extraction capabilities for downloading large volumes of historical event data in multiple formats including JSON, JSONL (JSON Lines), and CSV. This endpoint is specifically optimized for batch processing, data warehousing integration, compliance archival, and detailed analytics workflows that require processing comprehensive event datasets outside the platform.
 *
 * Unlike the list endpoint which is designed for interactive queries with pagination, the export endpoint streams complete result sets efficiently, making it ideal for periodic data exports, backup operations, integration with external analytics platforms, and generating comprehensive audit reports that span extended time periods or encompass thousands of events.
 *
 * The export functionality supports the same powerful filtering capabilities as the list endpoint, allowing you to narrow exports to specific event types, resources, time ranges, or metadata attributes. This granular control ensures you can extract precisely the data you need without transferring unnecessary information, optimizing bandwidth usage and downstream processing efficiency.
 *
 * ```http
 * GET /api/v1/event/log/export?order=desc&take=1000
 * Accept: application/json
 * ```
 *
 * For large-scale data exports, JSONL format offers significant advantages over standard JSON by streaming events as newline-delimited records, enabling incremental processing without loading the entire dataset into memory:
 *
 * ```http
 * GET /api/v1/event/log/export?order=desc
 * Accept: application/jsonl
 * ```
 *
 * CSV format provides maximum compatibility with spreadsheet applications, business intelligence tools, and traditional data processing pipelines:
 *
 * ```http
 * GET /api/v1/event/log/export?order=desc&type=conversation.message.create
 * Accept: text/csv
 * ```
 *
 * ### Filtering Exported Data
 *
 * Apply the same filtering parameters available in the list endpoint to focus your export on specific subsets of event data.
 * Both direct field filters and metadata filters are supported:
 *
 * ```http
 * GET /api/v1/event/log/export?type=conversation.message.create&botId=bot_abc123&order=desc
 * Accept: application/jsonl
 * ```
 *
 * **Direct field filters** for resource-scoped exports:
 *
 * - `type`: Event type (e.g., `conversation.message.create`, `bot.update`)
 * - `conversationId`, `taskId`, `contactId`: Filter by conversation, task, or contact
 * - `blueprintId`, `botId`, `datasetId`, `recordId`: Filter by core resources
 * - `skillsetId`, `abilityId`, `fileId`, `secretId`, `portalId`: Filter by feature resources
 * - `widgetIntegrationId`, `slackIntegrationId`, `discordIntegrationId`: Filter by integration
 * - `microsoftteamsIntegrationId`, `googlechatIntegrationId`: Filter by Microsoft Teams or Google Chat integration
 * - `whatsappIntegrationId`, `messengerIntegrationId`, `telegramIntegrationId`: Filter by messaging
 * - `twilioIntegrationId`, `emailIntegrationId`, `sitemapIntegrationId`: Filter by channel integration
 * - `notionIntegrationId`, `triggerIntegrationId`, `supportIntegrationId`: Filter by workflow integration
 * - `extractIntegrationId`, `mcpserverIntegrationId`: Filter by data and MCP integrations
 * - `webhookId`: Filter by webhook
 *
 * **Metadata filters** (`meta[key]=value`) for custom attribute selection:
 *
 * ```http
 * GET /api/v1/event/log/export?botId=bot_abc123&meta[status]=completed&order=desc
 * Accept: application/jsonl
 * ```
 *
 * Common filtering scenarios include:
 *
 * - **Resource-specific exports**: Extract all events for a particular bot, conversation, integration, or dataset
 * - **Event type filtering**: Export only specific event categories like completions, errors, or status changes
 * - **Time-bounded extracts**: Retrieve events within defined time windows for periodic reporting
 * - **Metadata-based selection**: Filter by custom attributes to extract events matching specific business criteria
 *
 * ### Format Selection and Use Cases
 *
 * **JSON Format** (`Accept: application/json`):
 * - Best for: Direct API consumption, single-shot data transfers, small to medium datasets
 * - Characteristics: Complete array response, easy to parse, widely supported
 * - Limitations: Entire dataset loaded into memory, not suitable for very large exports
 *
 * **JSONL Format** (`Accept: application/jsonl`):
 * - Best for: Large-scale exports, streaming processing, data pipeline integration
 * - Characteristics: One JSON object per line, streamable, memory-efficient
 * - Use cases: ETL processes, log aggregation systems, big data platforms
 *
 * **CSV Format** (`Accept: text/csv`):
 * - Best for: Business analytics, spreadsheet analysis, reporting tools
 * - Characteristics: Tabular structure, universal compatibility, human-readable
 * - Use cases: Business reports, Excel analysis, BI tool imports
 *
 * ### Export Best Practices
 *
 * **Performance Optimization**:
 * - Use JSONL for exports exceeding 10,000 events
 * - Apply filtering to reduce dataset size when possible
 * - Consider incremental exports using time-based filtering
 * - Schedule large exports during off-peak hours
 *
 * **Data Management**:
 * - Implement checkpointing for resumable exports
 * - Validate data integrity after export completion
 * - Compress exported files for storage and transfer
 * - Establish retention policies aligned with compliance requirements
 *
 * **Integration Patterns**:
 * - Stream JSONL exports directly to data lakes or warehouses
 * - Use CSV exports for business intelligence and reporting tools
 * - Implement automated periodic exports for backup and archival
 * - Coordinate exports with event log retention policies
 *
 * ### Metadata Handling in Exports
 *
 * Event metadata is preserved in JSON and JSONL formats as structured objects, enabling rich downstream analysis. In CSV format, complex metadata fields are serialized as YAML strings within CSV cells, allowing representation of hierarchical data while maintaining CSV compatibility. This approach ensures no data loss during format conversion while supporting tools that expect flat tabular structures.
 *
 * **Important Considerations**:
 *
 * - Export operations count against API rate limits proportional to data volume
 * - Very large exports may experience timeouts; use filtering and incremental approaches
 * - Exported data reflects event logs at export time; concurrent modifications may not be included
 * - Sensitive data handling: ensure appropriate security for exported files containing event details
 * - Export file sizes should be monitored to prevent storage issues
 * - Exported event logs are immutable snapshots; they don't update if source events change
 */
