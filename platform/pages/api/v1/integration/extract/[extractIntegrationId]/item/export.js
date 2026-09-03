// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import { getCursorConstraints, getTakeConstraints } from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /integration/extract/{extractIntegrationId}/item/export:
 *   get:
 *     operationId: exportExtractIntegrationItems
 *     summary: Export extract integration items
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
 *         description: The extract integration items were exported successfully
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
 *                         description: The extracted data in YAML-serializable format
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
        items: makeJsonSafe(extractIntegrationItems).map(
          ({ data, ...rest }) => {
            return {
              ...rest,

              data: new Proxy(data || {}, {
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
 * @manual Extract Integration
 * @index 55
 *
 * ## Exporting Extracted Items
 *
 * The export endpoint retrieves extracted integration items with their data
 * formatted for export workflows. This endpoint is similar to the list endpoint
 * but returns data in a YAML-serializable format, making it particularly useful
 * for integrations with tools that consume YAML, for bulk data exports, and for
 * building data pipelines that process extracted information in structured text
 * formats.
 *
 * The export endpoint is designed for scenarios where you need to move extracted
 * data out of the platform into external systems. Each item's `data` field
 * supports YAML serialization via a `toString()` method, enabling seamless
 * integration with YAML-based configuration management tools, data warehouses,
 * and export pipelines that process text-based formats.
 *
 * ```http
 * GET /api/v1/integration/extract/{extractIntegrationId}/item/export
 * ```
 *
 * The response follows the same structure as the list endpoint, with items
 * containing the extracted data alongside conversation references and timestamps.
 * The key difference is that the `data` field on each item can be serialized to
 * YAML format when converted to a string, enabling workflows that process
 * extracted data as human-readable structured text.
 *
 * Use pagination parameters to batch through large result sets:
 *
 * ```http
 * GET /api/v1/integration/extract/{extractIntegrationId}/item/export?take=100&cursor=<cursor>
 * ```
 *
 * **Use Cases:** This endpoint is ideal for scheduled data export jobs that
 * periodically transfer extracted data to external storage, for generating
 * YAML-formatted reports from extraction results, and for feeding extracted
 * data into configuration management systems that use YAML as their primary
 * data format. It is also useful for debugging extraction schemas by reviewing
 * the human-readable YAML representation of your extracted data.
 *
 * **Authorization:** Only the account that owns the extract integration can
 * export its items. Unauthorized access attempts are rejected with a not
 * authorized error.
 */
