// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/support/list:
 *   get:
 *     operationId: listSupportIntegrations
 *     summary: List Support integrations
 *     tags:
 *       - Support Integration
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
 *         description: The list of Support integrations was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceRefProperties'
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - $ref: '#/components/schemas/BotRef'
 *                       - type: object
 *                         properties:
 *                           email:
 *                             description: The email to use
 *                             type: string
 *                         required:
 *                           - botId
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
 *                       $ref: '#/paths/~1integration~1support~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const supportIntegrations = await prisma.supportIntegration.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          botId: true,

          // resource specific

          email: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(supportIntegrations),
      }
    })
  )
)

/**
 * @manual Support Integration
 * @category Integrations
 * @index 20
 *
 * ## Listing Support Integrations
 *
 * You can retrieve a list of all support integrations configured in your
 * account using the list endpoint. This is useful for managing multiple
 * support workflows or discovering which bots are connected to support systems.
 *
 * ```http
 * GET /api/v1/integration/support/list
 * ```
 *
 * The endpoint supports pagination through cursor-based navigation, allowing
 * you to efficiently retrieve large numbers of integrations. You can control
 * the number of items returned per request using the `take` parameter, and
 * navigate through results using the `cursor` parameter for subsequent requests.
 *
 * ### Filtering Results
 *
 * The list endpoint supports filtering by blueprint ID, which is particularly
 * useful when working with blueprint-based workflows where multiple integrations
 * may be grouped together. Use the `blueprintId` query parameter to retrieve
 * only integrations associated with a specific blueprint:
 *
 * ```http
 * GET /api/v1/integration/support/list?blueprintId=blueprint_xyz789&take=10
 * ```
 *
 * ### Response Format
 *
 * Each integration in the returned list includes core identification fields
 * (id, name, description), resource linking information (blueprintId, botId),
 * the configured email address, and metadata including creation and update
 * timestamps. This comprehensive information allows you to audit and manage
 * your support integration configurations effectively.
 *
 * The response also includes cursor information for pagination, enabling you
 * to fetch additional pages of results when dealing with large numbers of
 * integrations. Use the returned cursor value in subsequent requests to
 * continue retrieving items from where the previous request ended.
 */
