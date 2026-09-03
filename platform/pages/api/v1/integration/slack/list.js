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
 * /integration/slack/list:
 *   get:
 *     operationId: listSlackIntegrations
 *     summary: List Slack integrations
 *     tags:
 *       - Slack Integration
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
 *         description: The list of Slack integrations was retrieved successfully
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
 *                           signingSecret:
 *                             description: The signing secret (returned as '********' if configured, null otherwise)
 *                             type: string
 *                           botToken:
 *                             description: The bot token (returned as '********' if configured, null otherwise)
 *                             type: string
 *                           userToken:
 *                             description: The user token (returned as '********' if configured, null otherwise)
 *                             type: string
 *                           contactCollection:
 *                             description: Weather to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The session duration for the Slack integration
 *                             type: number
 *                           # attachments:
 *                           #   description: Weather the bot supports attachments
 *                           #   type: boolean
 *                           references:
 *                             description: Whether to enable references feature
 *                             type: boolean
 *                           ratings:
 *                             description: Whether to enable ratings buttons feature
 *                             type: boolean
 *                           visibleMessages:
 *                             description: The number of visible messages outside of the new thread
 *                             type: number
 *                           autoRespond:
 *                             description: Configure automatic response behavior. Use '@all' to respond to all messages, '@agent <instructions>' for agent-powered decisions, or custom instructions for lightweight LLM filtering. Null/empty defaults to current behavior (DMs, mentions, threads only).
 *                             type: string
 *                           allowFrom:
 *                             description: Restrict which Slack users or channels can interact with this integration. Accepts Slack user IDs (U…/W…), channel IDs (C…/G…/D…), @username, or #channel-name, one per line. Use * to allow all senders. Leave empty to deny all.
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
 *                       $ref: '#/paths/~1integration~1slack~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const slackIntegrations = await prisma.slackIntegration.findMany({
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

          signingSecret: true,

          botToken: true,

          userToken: true,

          contactCollection: true,

          sessionDuration: true,

          // attachments: true, // disabled because not supported

          references: true,

          ratings: true,

          visibleMessages: true,

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
          slackIntegrations.map((integration) => {
            if (integration.signingSecret) {
              /** @type {any} */ integration.signingSecret = '********'
            }

            if (integration.botToken) {
              /** @type {any} */ integration.botToken = '********'
            }

            if (integration.userToken) {
              /** @type {any} */ integration.userToken = '********'
            }

            return integration
          })
        ),
      }
    })
  )
)

/**
 * @manual Slack Integration
 *
 * ## Listing Slack Integrations
 *
 * Retrieve a list of all Slack integrations configured in your ChatBotKit account. This endpoint supports pagination and filtering to help you manage multiple Slack workspace integrations efficiently.
 *
 * The list endpoint returns all integration configurations with sensitive credentials displayed as `"********"` if configured or `null` if not set. This allows you to verify which integrations have credentials configured without exposing the actual secret values.
 *
 * ```http
 * GET /api/v1/integration/slack/list
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * ### Pagination Parameters
 *
 * **cursor** (string, optional): Pagination cursor for retrieving the next page of results. Use the cursor value returned in the previous response to fetch subsequent pages.
 *
 * **order** (string, optional): Sort order for results. Valid values are `asc` (ascending) or `desc` (descending). Default is `desc`, which returns the most recently created integrations first.
 *
 * **take** (number, optional): Number of items to retrieve per page. Controls the page size for pagination.
 *
 * ### Filtering Options
 *
 * You can filter results using query parameters:
 *
 * **blueprintId** (string, optional): Filter integrations associated with a specific blueprint ID. Useful when managing integrations organized within blueprint resources.
 *
 * **meta** (object, optional): Filter by metadata properties. Allows custom filtering based on metadata tags or properties you've assigned to integrations.
 *
 * ### Response Structure
 *
 * The response includes an array of integration objects, each containing:
 *
 * - **id**: Unique identifier for the integration
 * - **name**: Human-readable name for the integration
 * - **description**: Descriptive text explaining the integration's purpose
 * - **blueprintId**: Associated blueprint ID (if linked)
 * - **botId**: Associated bot ID (if configured)
 * - **visibleMessages**: Number of context messages included in conversations
 * - **attachments**: Whether file attachments are enabled
 * - **references**: Whether reference citations are enabled
 * - **ratings**: Whether user feedback ratings are enabled
 * - **contactCollection**: Whether contact information collection is enabled
 * - **sessionDuration**: Session timeout duration in milliseconds
 * - **allowFrom**: Newline-separated list of Slack user or channel patterns permitted to
 *   interact with this integration. An empty value denies all senders; use `*` to allow
 *   everyone. Use this to restrict bot access to specific team members, channels, or user
 *   groups.
 * - **meta**: Custom metadata object
 * - **createdAt**: Timestamp when integration was created
 * - **updatedAt**: Timestamp of last update
 *
 * **Security Note:** The `signingSecret`, `botToken`, and `userToken` fields are intentionally excluded from list responses to prevent credential exposure. These values are write-only and should be stored securely in your own systems if needed for reference.
 *
 * ### Example Response
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "slack_xyz789",
 *       "name": "Customer Support Bot",
 *       "description": "Handles customer inquiries",
 *       "botId": "bot_abc123",
 *       "visibleMessages": 10,
 *       "attachments": true,
 *       "references": true,
 *       "ratings": true,
 *       "allowFrom": "",
 *       "createdAt": "2025-01-15T10:30:00Z",
 *       "updatedAt": "2025-01-15T10:30:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * For managing individual integrations, use the fetch, update, and delete endpoints described in the following sections.
 */
