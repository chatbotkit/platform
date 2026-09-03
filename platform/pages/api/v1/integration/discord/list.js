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
 * /integration/discord/list:
 *   get:
 *     operationId: listDiscordIntegrations
 *     summary: List Discord integrations
 *     tags:
 *       - Discord Integration
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
 *         description: The list of Discord integrations was retrieved successfully
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
 *                           appId:
 *                             description: The Discord application ID
 *                             type: string
 *                           # botToken:
 *                           #   description: The Discord bot token
 *                           #   type: string
 *                           # publicKey:
 *                           #   description: The Discord public key
 *                           #   type: string
 *                           handle:
 *                             description: The Discord command handle
 *                             type: string
 *                           # ephemeral:
 *                           #   description: Indicate if the conversation is only visible to the user who invoked it.
 *                           #   type: boolean
 *                           contactCollection:
 *                             description: Weather to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The chat session duration
 *                             type: number
 *                           # attachments:
 *                           #   description: Weather the bot supports attachments
 *                           #   type: boolean
 *                           allowFrom:
 *                             description: Restrict which Discord users can interact with this integration. Accepts Discord user IDs (17-18 digit snowflakes) or @username, one per line. Use * to allow all senders. Leave empty to deny all.
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
 *                       $ref: '#/paths/~1integration~1discord~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const discordIntegrations = await prisma.discordIntegration.findMany({
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

          appId: true,
          // botToken: true, // disabled for security reasons
          // publicKey: true, // disabled for security reasons

          handle: true,

          // ephemeral: true, // disabled because the name is confusing

          contactCollection: true,

          sessionDuration: true,

          // attachments: true, // disabled because not supported

          allowFrom: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(discordIntegrations),
      }
    })
  )
)

/**
 * @manual Discord Integration
 * @index 30
 *
 * ## Listing Discord Integrations
 *
 * Listing Discord integrations retrieves all configured Discord bot integrations
 * for your account, providing a comprehensive view of your Discord bot deployments
 * across different servers and use cases. This endpoint supports pagination and
 * filtering to help you manage multiple integrations efficiently, especially when
 * working with large-scale deployments or testing environments.
 *
 * The list endpoint returns essential information about each integration including
 * identification, configuration settings, and timestamps. For security reasons,
 * sensitive credentials like Bot Token and Public Key are never included in list
 * responses, ensuring credential safety even when retrieving multiple integrations
 * simultaneously.
 *
 * ```http
 * GET /api/v1/integration/discord/list
 * ```
 *
 * This endpoint supports standard pagination parameters including `cursor` for
 * navigating through large result sets, `order` to specify ascending or descending
 * sort order (defaults to descending by creation date), and `take` to control the
 * number of items returned per request. Pagination ensures efficient retrieval even
 * when managing dozens of Discord integrations.
 *
 * ```http
 * GET /api/v1/integration/discord/list?take=10&order=desc
 * ```
 *
 * ## Filtering Discord Integrations
 *
 * The list endpoint supports filtering by metadata and blueprint associations. You
 * can filter integrations by blueprint ID to see all Discord bots associated with
 * a specific blueprint, which is useful for managing bot deployments organized by
 * project or use case. Metadata filtering allows you to query integrations based
 * on custom tags or properties you've added.
 *
 * ```http
 * GET /api/v1/integration/discord/list?blueprintId=bp_abc123
 * ```
 *
 * The response includes key configuration details for each integration: the unique
 * identifier for programmatic operations, name and description for human reference,
 * blueprint and bot associations for understanding deployment structure, Application
 * ID and slash command handle for Discord-specific configuration, session management
 * settings, and creation/update timestamps for tracking integration lifecycle.
 *
 * **Note:** The list response excludes the `botToken` and `publicKey` fields for
 * security purposes. These sensitive credentials are only available when fetching
 * a specific integration by ID using the fetch endpoint. This prevents accidental
 * exposure of credentials when retrieving multiple integrations for management
 * dashboards or monitoring tools.
 */
