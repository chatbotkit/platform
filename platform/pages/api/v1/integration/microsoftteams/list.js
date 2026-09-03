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
 * /integration/microsoftteams/list:
 *   get:
 *     operationId: listMicrosoftteamsIntegrations
 *     summary: List Microsoft Teams integrations
 *     tags:
 *       - Microsoft Teams Integration
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
 *         description: The list of Microsoft Teams integrations was retrieved successfully
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
 *                           botFrameworkAppId:
 *                             description: The Microsoft Bot Framework Application ID
 *                             type: string
 *                           contactCollection:
 *                             description: Weather to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The chat session duration
 *                             type: number
 *                           allowFrom:
 *                             description: The allowed senders for this integration
 *                             type: string
 *                           # attachments:
 *                           #   description: Weather the bot supports attachments
 *                           #   type: boolean
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
 *                       $ref: '#/paths/~1integration~1microsoftteams~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const microsoftteamsIntegrations =
        await prisma.microsoftteamsIntegration.findMany({
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

            botFrameworkAppId: true,
            // botFrameworkAppSecret: true, // disabled for security reasons
            // tenantId: true, // disabled for security reasons

            contactCollection: true,

            sessionDuration: true,

            allowFrom: true,

            // attachments: true, // disabled because not supported

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        })

      return {
        items: makeJsonSafe(microsoftteamsIntegrations),
      }
    })
  )
)

/**
 * @manual Microsoft Teams Integration
 * @index 30
 *
 * ## Listing Microsoft Teams Integrations
 *
 * Retrieve a paginated list of all Microsoft Teams integrations associated with
 * your ChatBotKit account. Use this endpoint to audit existing integrations,
 * build management dashboards, or discover integration IDs for use with
 * other operations.
 *
 * ```http
 * GET /api/v1/integration/microsoftteams/list
 * ```
 *
 * ### Pagination
 *
 * Results are returned in descending order by default (newest first). Use the
 * `cursor` value from a previous response to fetch the next page of results,
 * and `take` to control how many items appear per page:
 *
 * ```http
 * GET /api/v1/integration/microsoftteams/list?take=20&order=asc
 * ```
 *
 * ### Filtering
 *
 * Filter integrations by metadata using deep object notation:
 *
 * ```http
 * GET /api/v1/integration/microsoftteams/list?meta[region]=us-east
 * ```
 *
 * ### Response Fields
 *
 * Each integration object includes:
 *
 * - **id**: Unique identifier for the integration
 * - **name**: Human-readable label for the integration
 * - **description**: Optional description of the integration's purpose
 * - **blueprintId**: Associated blueprint ID (if linked)
 * - **botId**: The bot that handles incoming Teams messages
 * - **botFrameworkAppId**: The Microsoft Bot Framework Application ID registered
 *   in Azure. The `botFrameworkAppSecret` and `tenantId` fields are omitted from
 *   list responses for security reasons.
 * - **contactCollection**: Whether visitor contact data is collected
 * - **sessionDuration**: Conversation session timeout in milliseconds
 * - **allowFrom**: Restriction pattern for which sender types receive responses
 * - **meta**: Custom metadata key-value pairs
 * - **createdAt**: ISO timestamp of integration creation
 * - **updatedAt**: ISO timestamp of last modification
 *
 * **Security Note:** The `botFrameworkAppSecret` and `tenantId` fields are
 * intentionally excluded from list responses to prevent credential exposure.
 * Use the fetch endpoint to retrieve individual integration details, where
 * these fields are also masked for security.
 *
 * ### Example Response
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "teams_abc123",
 *       "name": "Internal Helpdesk Bot",
 *       "description": "Handles IT support requests in Microsoft Teams",
 *       "botId": "bot_xyz789",
 *       "botFrameworkAppId": "12345678-aaaa-bbbb-cccc-dddddddddddd",
 *       "contactCollection": false,
 *       "sessionDuration": null,
 *       "allowFrom": null,
 *       "meta": { "team": "it-support" },
 *       "createdAt": "2025-02-01T09:00:00Z",
 *       "updatedAt": "2025-02-01T09:00:00Z"
 *     }
 *   ],
 *   "cursor": null
 * }
 * ```
 *
 * For managing individual integrations, use the fetch, update, and delete
 * endpoints described in the following sections.
 */
