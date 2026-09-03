// @ts-check
import prisma from '@/prisma/client'

import {
  BULLETIN_MAX_TEXT_LENGTH,
  BULLETIN_MAX_TTL_SECONDS,
  BULLETIN_MIN_TTL_SECONDS,
  createBlueprintBulletin,
} from '@/lib/blueprint.bulletin'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

const bodySchema = schema.object({
  text: schema.string().min(1).max(BULLETIN_MAX_TEXT_LENGTH).required(),
  ttl: schema
    .number()
    .integer()
    .min(BULLETIN_MIN_TTL_SECONDS)
    .max(BULLETIN_MAX_TTL_SECONDS)
    .optional(),
})

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/bulletin/create:
 *   post:
 *     operationId: createBlueprintBulletin
 *     summary: Post a bulletin to a blueprint's shared board
 *     tags:
 *       - Blueprint Bulletins
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           description: The ID of the blueprint to post to
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 description: The message to post to the shared board
 *                 type: string
 *               ttl:
 *                 description: Optional time-to-live in seconds before the bulletin expires
 *                 type: number
 *             required:
 *               - text
 *     responses:
 *       200:
 *         description: The bulletin was posted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the blueprint
 *                   type: string
 *                 bulletin:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     text:
 *                       type: string
 *                     author:
 *                       description: The display name of the author who posted the bulletin (a bot or a user)
 *                       type: string
 *                     botId:
 *                       description: The ID of the bot the bulletin is associated with, when posted by a bot
 *                       type: string
 *                     createdAt:
 *                       type: number
 *                     expiresAt:
 *                       type: number
 *                   required:
 *                     - id
 *                     - text
 *                     - createdAt
 *                     - expiresAt
 *               required:
 *                 - id
 *                 - bulletin
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { text, ttl } = body

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
        return notFound()
      }

      if (blueprint.userId !== session.user.id) {
        return notAuthorized()
      }

      const bulletin = await createBlueprintBulletin(blueprint.id, {
        text,
        ttl,
      })

      return ok({
        id: blueprint.id,
        bulletin,
      })
    })
  )
)

/**
 * @manual Blueprint Bulletins
 * @index 43
 *
 * ## Posting a Bulletin
 *
 * To leave a message on a blueprint's shared bulletin board, make a POST request with the blueprint ID and a `text` body. The bulletin becomes immediately visible to every agent in the blueprint:
 *
 * ```http
 * POST /api/v1/blueprint/{blueprintId}/bulletin/create
 * ```
 *
 * ```json
 * {
 *   "text": "Finished indexing the support docs - safe to answer FAQ questions now.",
 *   "ttl": 3600
 * }
 * ```
 *
 * The optional `ttl` field sets how many seconds the bulletin remains before it expires. When omitted a default is applied, and any value is clamped to the allowed maximum. The board keeps only a limited number of the most recent bulletins, so posting beyond that limit evicts the oldest entries.
 *
 * The response returns the blueprint ID and the created bulletin, including its generated `id`, the resolved `author` (the poster's display name) and `botId` (set when a bot authored it), and its `createdAt` and `expiresAt` epoch-millisecond timestamps.
 *
 * **Authorization:** You must be the owner of the blueprint to post a bulletin.
 */
