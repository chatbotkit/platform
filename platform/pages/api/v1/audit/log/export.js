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
 * -@swagger
 *
 * /audit/log/export:
 *   get:
 *     operationId: exportAuditLogs
 *     summary: Export audit logs
 *     tags:
 *       - Audit
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
 *         description: The list of audit logs was exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
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
 *                       $ref: '#/paths/~1audit~1log~1export/get/responses/200/content/application~1json/schema/properties/items/items'
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
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').AuditLog>} */ (
              getFieldQueryFilter
            )(req, [
              'action',
              'conversationId',
              'taskId',
              'contactId',
              'spaceId',
              'blueprintId',
              'botId',
              'datasetId',
              'recordId',
              'skillsetId',
              'abilityId',
              'fileId',
              'secretId',
              'portalId',
              'policyId',
              'webhookId',
              'sessionId',
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

          spaceId: true,

          blueprintId: true,

          botId: true,

          datasetId: true,

          recordId: true,

          skillsetId: true,

          abilityId: true,

          fileId: true,

          secretId: true,

          portalId: true,

          policyId: true,

          webhookId: true,

          sessionId: true,

          // resource specific

          action: true,

          oldValues: true,
          newValues: true,

          ipAddress: true,
          userAgent: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(auditLogs).map(
          ({ meta, oldValues, newValues, ...rest }) => {
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

              oldValues: new Proxy(oldValues || {}, {
                get: function (target, prop) {
                  if (prop === 'toString') {
                    return function () {
                      return target ? yaml.stringify(target) : ''
                    }
                  }

                  return target[prop]
                },
              }),

              newValues: new Proxy(newValues || {}, {
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
          }
        ),
      }
    })
  )
)

/**
 * @manual Audit Logs
 * @index 20
 *
 * ## Exporting Audit Logs
 *
 * The audit log export functionality provides flexible options for extracting
 * audit data in multiple formats, enabling integration with external analysis
 * tools, compliance reporting systems, and long-term archival solutions. This
 * endpoint supports exporting audit logs in JSON, JSONL (newline-delimited
 * JSON), and CSV formats, each optimized for different use cases and
 * downstream processing requirements.
 *
 * Unlike the standard list endpoint, the export endpoint is specifically
 * designed for bulk data extraction and includes special formatting that makes
 * the exported data more suitable for analysis and reporting. Complex nested
 * data structures like metadata, old values, and new values are automatically
 * converted to YAML format within CSV exports for improved readability, while
 * JSON and JSONL exports preserve the full nested structure for programmatic
 * processing.
 *
 * ### Export Formats
 *
 * The export endpoint supports three output formats, each serving different
 * analytical and integration needs:
 *
 * **JSON Format** - Ideal for programmatic processing and API integrations:
 *
 * ```http
 * GET /api/v1/audit/log/export?take=1000
 * Accept: application/json
 * ```
 *
 * Returns a standard JSON array wrapped in an object, suitable for direct
 * consumption by JavaScript applications and REST API clients.
 *
 * **JSONL Format** - Optimized for streaming and large dataset processing:
 *
 * ```http
 * GET /api/v1/audit/log/export?take=5000
 * Accept: application/jsonl
 * ```
 *
 * Returns newline-delimited JSON where each line represents a single audit
 * log entry. This format is ideal for streaming processing, large dataset
 * handling, and integration with log processing tools like Logstash, Fluentd,
 * or custom stream processors. Each line is a complete, parseable JSON object
 * that can be processed independently.
 *
 * **CSV Format** - Best for spreadsheet analysis and reporting:
 *
 * ```http
 * GET /api/v1/audit/log/export?take=500
 * Accept: text/csv
 * ```
 *
 * Returns a comma-separated values file that can be directly opened in Excel,
 * Google Sheets, or other spreadsheet applications. Complex nested fields
 * (meta, oldValues, newValues) are automatically converted to YAML format for
 * improved readability in spreadsheet cells.
 *
 * ### Filtering and Pagination
 *
 * The export endpoint supports the same powerful filtering options as the
 * list endpoint, allowing you to export only the specific audit logs you need:
 *
 * ```http
 * GET /api/v1/audit/log/export?action=update&botId={botId}&take=1000
 * Accept: application/json
 * ```
 *
 * Available filter parameters include:
 *
 * - **Action Filtering**: `action=create`, `action=update`, `action=delete`
 * - **Conversation/Task/Contact**: `conversationId`, `taskId`, `contactId`
 * - **Space**: `spaceId`
 * - **Resource Filtering**: `botId`, `datasetId`, `skillsetId`, `blueprintId`
 * - **Related Resources**: `recordId`, `abilityId`, `fileId`, `secretId`
 * - **Connection Data**: `portalId`, `policyId`, `webhookId`, `sessionId`
 * - **Pagination**: `cursor`, `order` (asc/desc), `take` (items per page)
 * - **Metadata**: `meta[key]=value` for custom metadata filtering
 *
 * ### Large Dataset Exports
 *
 * For exporting large volumes of audit logs, use cursor-based pagination with
 * the JSONL format for optimal performance:
 *
 * ```http
 * # First request
 * GET /api/v1/audit/log/export?take=5000&order=asc
 * Accept: application/jsonl
 *
 * # Subsequent requests using cursor from previous response
 * GET /api/v1/audit/log/export?take=5000&order=asc&cursor={cursorValue}
 * Accept: application/jsonl
 * ```
 *
 * The JSONL format allows you to process each exported chunk as a stream,
 * making it possible to export and process millions of audit log entries
 * without excessive memory consumption. Each response includes a cursor value
 * that you can use to fetch the next batch of results.
 *
 * ### Use Cases for Audit Log Exports
 *
 * **Compliance Reporting**: Export audit logs in CSV format for quarterly or
 * annual compliance reports. The human-readable YAML formatting of complex
 * fields makes it easy to review changes in spreadsheet applications.
 *
 * **Security Analysis**: Export logs in JSONL format and pipe them into
 * security information and event management (SIEM) tools for threat detection
 * and anomaly analysis.
 *
 * **Data Archival**: Periodically export audit logs in JSON format for
 * long-term archival in your organization's document management or backup
 * systems, ensuring compliance with data retention policies.
 *
 * **Change Tracking**: Export logs filtered by specific resources (like a
 * particular bot or dataset) to understand the complete change history and
 * evolution of that resource over time.
 *
 * **Analytics and Reporting**: Export logs in CSV format for analysis in
 * business intelligence tools, allowing you to create custom reports on
 * user activity, resource modifications, and system usage patterns.
 *
 * ### Special Formatting for CSV Exports
 *
 * When exporting to CSV format, the endpoint automatically applies special
 * formatting to enhance readability:
 *
 * - **Nested Objects**: The `meta`, `oldValues`, and `newValues` fields are
 *   converted to YAML format, making them readable in spreadsheet cells
 * - **Timestamps**: Date fields are formatted as ISO 8601 strings
 * - **Resource IDs**: All ID fields are preserved as-is for reference
 * - **IP and User Agent**: Network information is included in dedicated columns
 *
 * This formatting makes CSV exports immediately useful for manual review and
 * analysis in spreadsheet applications without requiring additional data
 * transformation.
 *
 * **Important:** Exported audit logs are snapshots of the data at the time
 * of export. They do not automatically update when new logs are created. For
 * continuous monitoring, consider building a scheduled export process that
 * regularly fetches new logs using cursor-based pagination and the
 * `createdAt` timestamp filters.
 *
 * **Performance Note:** For optimal performance when exporting large datasets,
 * use the JSONL format with reasonable `take` values (recommended: 1000-5000
 * items per request) and implement cursor-based pagination. This approach
 * ensures consistent performance and prevents timeouts when dealing with
 * extensive audit log histories.
 */
