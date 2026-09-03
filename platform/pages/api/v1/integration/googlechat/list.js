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
 * /integration/googlechat/list:
 *   get:
 *     operationId: listGooglechatIntegrations
 *     summary: List Google Chat integrations
 *     tags:
 *       - Google Chat Integration
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
 *           description: Key-value pairs to filter by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of Google Chat integrations was retrieved successfully
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
 *                           serviceAccountKey:
 *                             description: The service account key (returned as '********' if configured, null otherwise)
 *                             type: string
 *                           projectNumber:
 *                             description: The Google Cloud project number for JWT verification
 *                             type: string
 *                           contactCollection:
 *                             description: Whether to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The session duration for the integration
 *                             type: number
 *                           attachments:
 *                             description: Whether file attachment processing is enabled
 *                             type: boolean
 *                           autoRespond:
 *                             description: The auto-respond configuration
 *                             type: string
 *                           allowFrom:
 *                             description: The allowed senders for this integration
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
 *                       $ref: '#/paths/~1integration~1googlechat~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const googlechatIntegrations =
        await prisma.googlechatIntegration.findMany({
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

            serviceAccountKey: true,

            projectNumber: true,

            contactCollection: true,

            sessionDuration: true,

            attachments: true,

            autoRespond: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        })

      return {
        items: makeJsonSafe(
          googlechatIntegrations.map((integration) => {
            if (integration.serviceAccountKey) {
              /** @type {any} */ integration.serviceAccountKey = '********'
            }

            return integration
          })
        ),
      }
    })
  )
)

/**
 * @manual Google Chat Integration
 * @index 30
 *
 * ## Listing Google Chat Integrations
 *
 * Retrieve a paginated list of all Google Chat integrations configured in your
 * ChatBotKit account. Use this endpoint to audit existing integrations, build
 * management dashboards, or synchronize integration state with external systems.
 *
 * The list endpoint returns results in descending order by default (newest
 * first). You can control the ordering using the `order` query parameter and
 * page through results using the `cursor` returned in each response.
 *
 * ```http
 * GET /api/v1/integration/googlechat/list
 * ```
 *
 * ### Pagination
 *
 * Use the `cursor` and `take` query parameters to page through large result
 * sets. Pass the `cursor` value from a previous response to fetch the next
 * page. Set `take` to control how many items are returned per page.
 *
 * ```http
 * GET /api/v1/integration/googlechat/list?take=10&order=asc
 * ```
 *
 * ### Filtering by Metadata
 *
 * You can filter integrations by metadata key-value pairs using the `meta`
 * query parameter with deep object notation:
 *
 * ```http
 * GET /api/v1/integration/googlechat/list?meta[environment]=production
 * ```
 *
 * ### Response Fields
 *
 * Each integration object in the response includes:
 *
 * - **id**: Unique identifier for the integration
 * - **name**: Human-readable label for the integration
 * - **description**: Optional description of the integration's purpose
 * - **blueprintId**: Associated blueprint ID (if linked)
 * - **botId**: The bot that handles incoming Google Chat messages
 * - **serviceAccountKey**: Returns `"********"` if configured, `null` if not set
 * - **projectNumber**: Google Cloud project number used for JWT token verification
 * - **contactCollection**: Whether contact records are collected for direct message conversations
 * - **sessionDuration**: Conversation session timeout in milliseconds
 * - **attachments**: Whether uploaded Google Chat files are processed as conversation attachments
 * - **autoRespond**: Auto-respond mode setting for the integration
 * - **allowFrom**: Restriction on which senders this bot will respond to
 * - **meta**: Custom metadata object attached to the integration
 * - **createdAt**: ISO timestamp of when the integration was created
 * - **updatedAt**: ISO timestamp of the last modification
 *
 * **Security Note:** The `serviceAccountKey` field is intentionally masked in
 * list responses to prevent credential exposure. To verify whether credentials
 * are configured, check whether the field returns `"********"` rather than
 * `null`.
 *
 * ### Example Response
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "googlechat_abc123",
 *       "name": "Support Space Bot",
 *       "description": "Handles support requests in Google Chat",
 *       "botId": "bot_xyz789",
 *       "projectNumber": "123456789012",
 *       "serviceAccountKey": "********",
 *       "contactCollection": true,
 *       "sessionDuration": 1800000,
 *       "attachments": true,
 *       "autoRespond": null,
 *       "allowFrom": null,
 *       "meta": {},
 *       "createdAt": "2025-01-15T10:30:00Z",
 *       "updatedAt": "2025-01-15T10:30:00Z"
 *     }
 *   ],
 *   "cursor": null
 * }
 * ```
 */
