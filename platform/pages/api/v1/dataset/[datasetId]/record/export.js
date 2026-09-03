// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import { getTakeConstraints } from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /dataset/{datasetId}/record/export:
 *   get:
 *     operationId: exportDatasetRecords
 *     summary: Export dataset records
 *     tags:
 *       - Dataset Record
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset to export
 *           type: string
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
 *     responses:
 *       200:
 *         description: The export of dataset records was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceMetaProps'
 *                       - type: object
 *                         properties:
 *                           text:
 *                             type: string
 *                           source:
 *                             type: string
 *                         required:
 *                           - text
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
 *                       $ref: '#/paths/~1dataset~1{datasetId}~1record~1export/get/responses/200/content/application~1json/schema/properties/items/items'
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
      const dataset = await prisma.dataset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'datasetId')
      )

      if (!dataset) {
        return throwNotFound(`Dataset not found`)
      }

      if (dataset.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      const store = await getStore()

      const { take } = getTakeConstraints(req)

      const result = await store.listRecords({
        datasetId: dataset.id,
        cursor,
        limit: take,
      })

      return {
        items: result.records.map((record) => ({
          id: record.id,
          text: record.text,
          source: record.source,
          meta: record.meta
            ? new Proxy(record.meta, {
                get: function (target, prop) {
                  if (prop === 'toString') {
                    return function () {
                      return target ? yaml.stringify(target) : ''
                    }
                  }

                  return target[/** @type {keyof typeof target} */ (prop)]
                },
              })
            : undefined,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),

        // @note Pass through the store's cursor for proper pagination with
        // vector stores. Use null (not undefined) when there are no more pages
        // so withStreamCursor knows to stop iterating and doesn't fall back to
        // using the last item's CUID as a cursor (which Qdrant rejects).
        cursor: result.nextCursor ?? null,
      }
    })
  )
)

/**
 * @manual Dataset Records
 * @index 50
 *
 * ## Exporting Dataset Records
 *
 * Exporting dataset records allows you to extract all the knowledge base content from a dataset in structured formats suitable for backup, migration, analysis, or integration with external systems. The export functionality provides multiple format options to accommodate different use cases and downstream processing requirements.
 *
 * Dataset exports are particularly valuable for several scenarios: creating backups of your knowledge bases before making significant changes, migrating content between different ChatBotKit accounts or environments, analyzing record distributions and content patterns for quality assurance, sharing knowledge base content with team members or external collaborators, and integrating with data processing pipelines or analytics tools.
 *
 * The export operation streams records progressively, making it efficient even for large datasets containing thousands of records. Rather than loading all records into memory at once, the API delivers them incrementally, reducing memory overhead and allowing you to process records as they arrive.
 *
 * ### JSON Format Export
 *
 * JSON format provides a structured, human-readable export that's ideal for backup purposes and easy to import into other systems. The export includes all record fields including IDs, text content, source information, metadata, and timestamps:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/record/export
 * Accept: application/json
 * ```
 *
 * The response contains an array of record objects with complete field information. This format is best when you need to inspect the data manually, store it in document databases, or process it with JavaScript-based tools.
 *
 * ### JSON Lines (JSONL) Format Export
 *
 * JSONL format provides each record as a separate JSON object on its own line, making it ideal for streaming processing and large-scale data operations. This format is particularly useful when working with big data tools, streaming processors, or when you need to process records one at a time without loading the entire dataset:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/record/export
 * Accept: application/jsonl
 * ```
 *
 * Each line in the response is a complete, valid JSON object representing one record. This format is preferred for batch processing, data pipeline integration, and scenarios where memory efficiency is important. Many data processing tools like Apache Spark, BigQuery, and command-line utilities work well with JSONL.
 *
 * ### CSV Format Export
 *
 * CSV format produces a spreadsheet-compatible export that can be opened in Excel, Google Sheets, or any spreadsheet application. This format is ideal for data analysis, reporting, and scenarios where non-technical stakeholders need to review or work with the dataset content:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/record/export
 * Accept: text/csv
 * ```
 *
 * The CSV export includes columns for all standard record fields. Metadata fields are serialized to YAML format within their column for readability and compatibility. This makes it easy to review record content, generate reports, or perform analyses using spreadsheet tools.
 *
 * ### Pagination and Filtering
 *
 * Exports support pagination parameters allowing you to retrieve records in batches if needed for incremental processing. You can use cursor-based pagination to fetch records in chunks, control the number of records per page, and apply metadata filters to export only specific subsets of your dataset.
 *
 * This is particularly useful when you want to export only certain categories of records, records from specific sources, or records matching particular metadata criteria. Combining export with filtering gives you precise control over what content gets extracted.
 *
 * **Important**: You must own the dataset to export its records. Export operations are not available for shared or public datasets unless you're the owner. The export includes only the record data stored in the dataset, not the underlying file contents or embeddings.
 */
