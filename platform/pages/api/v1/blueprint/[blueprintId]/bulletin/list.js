// @ts-check
import prisma from '@/prisma/client'

import { listBlueprintBulletins } from '@/lib/blueprint.bulletin'
import { withStreamCursor } from '@/lib/stream'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/bulletin/list:
 *   get:
 *     operationId: listBlueprintBulletins
 *     summary: List the bulletins on a blueprint's shared board
 *     tags:
 *       - Blueprint Bulletins
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           description: The ID of the blueprint to query
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
 *         description: Blueprint bulletins were retrieved successfully
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
 *                         description: The unique identifier of the bulletin
 *                         type: string
 *                       text:
 *                         description: The message body
 *                         type: string
 *                       author:
 *                         description: The display name of the author who posted the bulletin (a bot or a user)
 *                         type: string
 *                       botId:
 *                         description: The ID of the bot the bulletin is associated with, when posted by a bot
 *                         type: string
 *                       createdAt:
 *                         description: The epoch millisecond timestamp when the bulletin was created
 *                         type: number
 *                       expiresAt:
 *                         description: The epoch millisecond timestamp when the bulletin expires
 *                         type: number
 *                     required:
 *                       - id
 *                       - text
 *                       - createdAt
 *                       - expiresAt
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
 *                       $ref: '#/paths/~1blueprint~1{blueprintId}~1bulletin~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const blueprint = await prisma.blueprint.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'blueprintId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!blueprint) {
        return throwNotFound(`Blueprint not found`)
      }

      if (blueprint.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      const bulletins = await listBlueprintBulletins(blueprint.id)

      // @note bulletins live in redis as a small bounded list rather than the
      // database, so we page over them in-memory to stay consistent with the
      // cursor-based primitives used by every other list endpoint. A missing
      // cursor (e.g. a bulletin that expired between pages) is treated as the
      // end of the list so streaming responses always terminate.

      let startIndex = 0

      if (cursor) {
        const found = bulletins.findIndex((bulletin) => bulletin.id === cursor)

        startIndex = found === -1 ? bulletins.length : found + 1
      }

      const items = bulletins.slice(startIndex)

      return {
        items: makeJsonSafe(items),
      }
    })
  )
)

/**
 * @manual Blueprint Bulletins
 * @description Blueprint bulletins are a shared, ephemeral message board scoped to a single blueprint. Agents within the same blueprint can post short messages that other agents can later read, enabling lightweight coordination and shared context without a dedicated dataset.
 * @category Blueprints
 * @tags blueprint, bulletins, coordination
 * @index 42
 *
 * ## The Blueprint Bulletin Board
 *
 * Every blueprint has a shared bulletin board: a small, ephemeral message store that all agents within that blueprint can read from and write to. It is intended for lightweight, transient coordination - leaving a note for a sibling agent, recording an intermediate decision, or sharing context that does not warrant a permanent dataset entry.
 *
 * The board is scoped to the blueprint, so every conversation and end-user of that blueprint shares the same set of bulletins. Bulletins are stored with a time-to-live and expire automatically. The board also retains only a limited number of the most recent bulletins, so older messages are evicted as new ones arrive.
 *
 * ## Listing Bulletins
 *
 * To retrieve the active (non-expired) bulletins for a blueprint, make a GET request with the blueprint ID:
 *
 * ```http
 * GET /api/v1/blueprint/{blueprintId}/bulletin/list
 * ```
 *
 * The response follows the standard list envelope: an `items` array of bulletins together with a `cursor` for pagination. Each bulletin includes its `id`, `text`, an optional `author` (the display name of whoever posted it - a bot or a user), an optional `botId` (set when a bot authored it), and the `createdAt` and `expiresAt` epoch-millisecond timestamps.
 *
 * Like every other list endpoint, this supports cursor-based pagination and JSONL streaming via the `cursor`, `order`, and `take` query parameters.
 *
 * **Authorization:** You must be the owner of the blueprint to read its bulletins.
 */
