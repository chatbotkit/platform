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
 * /integration/telegram/list:
 *   get:
 *     operationId: listTelegramIntegrations
 *     summary: List Telegram integrations
 *     tags:
 *       - Telegram Integration
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
 *         description: The list of Telegram integrations was retrieved successfully
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
 *                       - $ref: '#/components/schemas/BotRef'
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - type: object
 *                         properties:
 *                           # botToken:
 *                           #   description: The Telegram integration bot token
 *                           #   type: string
 *                           contactCollection:
 *                             description: Weather to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The session duration (in milliseconds)
 *                             type: number
 *                           attachments:
 *                             description: Weather the bot supports attachments
 *                             type: boolean
 *                           allowFrom:
 *                             description: Newline-or-comma-separated list of allowed senders. Use @username or @numericId for users, #chatId for groups. Leave empty to allow all.
 *                             type: string
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
 *                       $ref: '#/paths/~1integration~1telegram~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const telegramIntegrations = await prisma.telegramIntegration.findMany({
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

          // resource specific: options

          // botToken: true, // disabled for security reasons

          contactCollection: true,

          sessionDuration: true,

          attachments: true,

          allowFrom: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(telegramIntegrations),
      }
    })
  )
)

/**
 * @manual Telegram Integration
 *
 * ## Listing Telegram Integrations
 *
 * You can retrieve a list of all your Telegram integrations to manage multiple
 * bots or review existing configurations. The list endpoint supports pagination
 * and filtering to help you efficiently manage your integrations.
 *
 * To list your Telegram integrations, send a GET request:
 *
 * ```http
 * GET /api/v1/integration/telegram/list
 * ```
 *
 * The response includes all your Telegram integrations with their configuration
 * details, excluding sensitive information like bot tokens for security reasons.
 *
 * ### Pagination Parameters
 *
 * - **cursor**: For paginated results, use the cursor from the previous response
 * - **order**: Sort order - `asc` (ascending) or `desc` (descending, default)
 * - **take**: Number of items to retrieve per page
 *
 * ### Filtering Options
 *
 * You can filter the list using query parameters:
 *
 * - **blueprintId**: Filter integrations linked to a specific blueprint
 * - **meta**: Filter by custom metadata fields
 *
 * Example with filtering:
 *
 * ```http
 * GET /api/v1/integration/telegram/list?blueprintId=blueprint_xxxxx&order=asc&take=10
 * ```
 *
 * Each integration in the response includes basic information (name, description,
 * creation date), configuration options (contact collection, session duration,
 * attachments), and resource links (bot ID, blueprint ID). The bot token is
 * intentionally excluded from list responses for security purposes.
 *
 * This endpoint is useful for building management interfaces, monitoring active
 * integrations, or performing bulk operations across multiple Telegram bots.
 */
