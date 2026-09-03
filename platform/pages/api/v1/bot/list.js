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
 * /bot/list:
 *   get:
 *     operationId: listBots
 *     summary: Retrieve a list of bots
 *     tags:
 *       - Bot
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
 *         description: The list of bots was retrieved successfully
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
 *                       - $ref: '#/components/schemas/BotConfig'
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - type: object
 *                         properties:
 *                           visibility:
 *                             $ref: '#/components/schemas/BotVisibility'
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
 *                       $ref: '#/paths/~1bot~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const bots = await prisma.bot.findMany({
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

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          datasetId: true,

          skillsetId: true,

          // resource specific

          backstory: true,

          model: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(bots),
      }
    })
  )
)

/**
 * @manual Bots
 * @index 10
 *
 * ## Listing Bots
 *
 * Retrieving a list of all bots in your account allows you to manage,
 * organize, and access your conversational AI agents programmatically. The
 * list endpoint supports pagination and filtering to help you efficiently
 * work with large collections of bots.
 *
 * The listing operation returns comprehensive information about each bot,
 * including its configuration, connected resources, and metadata. This is
 * particularly useful for building administrative interfaces, monitoring bot
 * deployments, or implementing bot selection features in your applications.
 *
 * ```http
 * GET /api/v1/bot/list
 * ```
 *
 * The response includes all bots associated with your account, returned as an
 * array of bot objects. Each bot object contains its identifier, name,
 * description, backstory, model configuration, connected dataset and skillset
 * IDs, and visibility settings. You can use the returned data to display bot
 * information in user interfaces or to make programmatic decisions about which
 * bot to use for specific tasks.
 *
 * Advanced filtering is supported through query parameters. You can filter
 * bots by blueprint association to retrieve only bots that belong to a
 * specific project or workflow. The `meta` parameter allows filtering based on
 * custom metadata fields you've attached to your bots, enabling sophisticated
 * organizational schemes.
 *
 * Pagination parameters (`cursor`, `order`, and `take`) help you efficiently
 * retrieve large bot collections. Use the cursor-based pagination to iterate
 * through results, and the `take` parameter to control the number of items
 * returned per request. The `order` parameter allows sorting bots by creation
 * date in ascending or descending order.
 *
 * **Tip:** Use metadata filtering to organize bots by environment (production,
 * staging), purpose (support, sales), or any custom categorization scheme that
 * matches your workflow.
 */
