// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import { getCursorConstraints, getTakeConstraints } from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/extract/{extractIntegrationId}/item/list:
 *   get:
 *     operationId: listExtractIntegrationItems
 *     summary: List extract integration items
 *     tags:
 *       - Extract Integration
 *     parameters:
 *       - in: path
 *         name: extractIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the extract integration
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
 *         description: The list of extract integration items was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         description: The unique identifier of the item
 *                         type: string
 *                       extractIntegrationId:
 *                         description: The ID of the extract integration
 *                         type: string
 *                       conversationId:
 *                         description: The ID of the conversation from which data was extracted
 *                         type: string
 *                       data:
 *                         description: The extracted data matching the integration schema
 *                         type: object
 *                         additionalProperties: true
 *                       createdAt:
 *                         description: The timestamp when the item was created
 *                         type: string
 *                       updatedAt:
 *                         description: The timestamp when the item was last updated
 *                         type: string
 *                     required:
 *                       - id
 *                       - extractIntegrationId
 *                       - data
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const extractIntegration =
        await prisma.extractIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'extractIntegrationId'),
          {
            select: {
              id: true,
              userId: true,
            },
          }
        )

      if (!extractIntegration) {
        return throwNotFound()
      }

      if (extractIntegration.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      const extractIntegrationItems =
        await prisma.extractIntegrationItem.findMany({
          where: {
            extractIntegrationId: extractIntegration.id,
          },

          ...getCursorConstraints(req, cursor),

          ...getTakeConstraints(req),

          select: {
            // identifiers

            id: true,

            // resource linking

            extractIntegrationId: true,
            conversationId: true,

            // resource specific

            data: true,

            // meta and others

            createdAt: true,
            updatedAt: true,
          },
        })

      return {
        items: makeJsonSafe(extractIntegrationItems),
      }
    })
  )
)

/**
 * @manual Extract Integration
 * @index 50
 *
 * ## Listing Extracted Items
 *
 * After your extract integration has processed conversations, you can retrieve
 * the structured data items that were extracted using the item list endpoint.
 * Each item represents the data extracted from a single conversation, organized
 * according to the JSON schema you defined when creating the integration.
 *
 * Extracted items are the primary output of the extract integration system.
 * They contain the structured information your AI bot pulled from conversations,
 * such as customer details, issue classifications, satisfaction scores, or any
 * other fields you defined in your schema. Accessing these items programmatically
 * enables you to build data pipelines, populate CRM systems, generate reports,
 * and drive downstream business processes.
 *
 * Each item in the response includes the extracted `data` object containing your
 * schema fields, the `conversationId` linking back to the source conversation,
 * and standard timestamps for auditing and synchronization purposes. The `data`
 * field structure mirrors your integration schema, making it straightforward to
 * map into your target data systems.
 *
 * ```http
 * GET /api/v1/integration/extract/{extractIntegrationId}/item/list
 * ```
 *
 * To paginate through large result sets, use the cursor-based pagination:
 *
 * ```http
 * GET /api/v1/integration/extract/{extractIntegrationId}/item/list?take=50&cursor=<cursor>
 * ```
 *
 * The response includes an `items` array with the extracted records and a
 * `cursor` value that can be used to fetch the next page of results. Continue
 * requesting pages until no cursor is returned, indicating you have reached
 * the end of the result set.
 *
 * **Use Cases:** Common workflows include polling this endpoint periodically
 * to sync extracted data into a database, building dashboards that display
 * extraction results in real time, and auditing what data was captured from
 * specific conversations. You can cross-reference the `conversationId` with
 * the conversation API to retrieve the full conversation context alongside
 * the extracted data.
 *
 * **Authorization:** Only the account that owns the extract integration can
 * list its items. Requests from other accounts will be rejected with a not
 * authorized error.
 */
