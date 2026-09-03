// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import { getTakeConstraints } from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /dataset/{datasetId}/record/list:
 *   get:
 *     operationId: listDatasetRecords
 *     summary: Retrieve a list of dataset records
 *     tags:
 *       - Dataset Record
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset
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
 *         description: The list of records was retrieved successfully
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
 *                       $ref: '#/paths/~1dataset~1{datasetId}~1record~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
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

      const { take } = getTakeConstraints(req)

      const store = await getStore()

      // @note cursor pagination with vector stores uses store-specific cursor
      // format which may differ from ID-based cursors used by withStreamCursor

      const result = await store.listRecords({
        datasetId: dataset.id,
        cursor,
        limit: take,
      })

      return {
        items: makeJsonSafe(
          result.records.map((record) => ({
            id: record.id,
            text: record.text,
            source: record.source,
            meta: record.meta,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          }))
        ),

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
 *
 * ## Listing Records
 *
 * Listing records within a dataset allows you to retrieve and browse all the
 * individual entries that make up your knowledge base. This operation is
 * essential for reviewing dataset content, performing audits, or implementing
 * custom search and filtering logic in your application.
 *
 * The list endpoint returns all records in the dataset with pagination
 * support, allowing you to efficiently retrieve large datasets in manageable
 * chunks. Each record includes its unique identifier, text content, source
 * reference, metadata, and timestamps for creation and last update.
 *
 * You can use query parameters to implement pagination using cursor-based
 * navigation, which is more efficient than offset-based pagination for large
 * datasets. The response includes a cursor that you can use to fetch the next
 * page of results.
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/record/list
 * ```
 *
 * The API returns an array of record objects, each containing the full record
 * data including text content, source information, and any associated
 * metadata. You can use this data to display records in your application's
 * interface, perform client-side filtering, or synchronize with external
 * systems.
 *
 * **Performance Note:** For datasets with thousands of records, consider
 * using pagination parameters to limit the number of records returned per
 * request. This improves response time and reduces memory usage in your
 * application.
 */
