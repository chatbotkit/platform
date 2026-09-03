// @ts-check
import { withStreamCursor } from '@/lib/stream'
import { promptIdToAliasMap, prompts } from '@/lib/magic'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /magic/list:
 *   get:
 *     operationId: listMagicPrompts
 *     summary: Retrieve a list of magic prompts
 *     tags:
 *       - Magic
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
 *         description: The list of magic prompts was retrieved successfully
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
 *                           alias:
 *                             description: The alias of the item
 *                             type: string
 *                         required:
 *                           - alias
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
 *                       $ref: '#/paths/~1magic~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor) {
      if (cursor) {
        return {
          items: [],
        }
      }

      return {
        items: Object.entries(prompts)
          .filter(([id]) => !!promptIdToAliasMap[id])
          .map(([id, { description }]) => {
            return {
              id: id,
              name: promptIdToAliasMap[id].slice(1),
              description: description,
              alias: promptIdToAliasMap[id].slice(1),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          }),
      }
    })
  )
)

// @note do not document this file for now
