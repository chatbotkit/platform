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
 * /integration/twilio/list:
 *   get:
 *     operationId: listTwilioIntegrations
 *     summary: List Twilio integrations
 *     tags:
 *       - Twilio Integration
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
 *         description: The list of Twilio integrations was retrieved successfully
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
 *                           accountSid:
 *                             description: The Twilio account SID
 *                             type: string
 *                           # authToken:
 *                           #   description: The Twilio auth token
 *                           #   type: string
 *                           voice:
 *                             description: The voice configuration structured string
 *                             type: string
 *                           contactCollection:
 *                             description: Weather to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The session duration (in milliseconds)
 *                             type: number
 *                           allowFrom:
 *                             description: Newline-or-comma-separated list of allowed senders
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
 *                       $ref: '#/paths/~1integration~1twilio~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const twilioIntegrations = await prisma.twilioIntegration.findMany({
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

          accountSid: true,

          // authToken: true, // disabled for security reasons

          voice: true,

          contactCollection: true,

          sessionDuration: true,

          allowFrom: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(twilioIntegrations),
      }
    })
  )
)

/**
 * @manual Twilio Integration
 *
 * ## Listing Twilio Integrations
 *
 * Retrieve a paginated list of all your Twilio integrations to manage and monitor
 * your SMS messaging channels. Listing integrations is essential for understanding
 * your current Twilio setup, managing multiple phone number integrations, and
 * accessing integration IDs needed for updates and configuration.
 *
 * Retrieve your Twilio integrations by sending a GET request:
 *
 * ```http
 * GET /api/v1/integration/twilio/list?take=20&order=desc
 * ```
 *
 * The API will return a list of your integrations with their configuration details:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "twilio_abc123",
 *       "name": "Customer Support SMS",
 *       "description": "SMS-based customer support",
 *       "botId": "bot_xyz789",
 *       "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 *       "contactCollection": true,
 *       "sessionDuration": 1800000,
 *       "allowFrom": "*",
 *       "createdAt": "2025-01-15T10:30:00Z",
 *       "updatedAt": "2025-01-20T14:45:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * ### Pagination
 *
 * The list endpoint supports cursor-based pagination for efficient handling of
 * large numbers of integrations:
 *
 * **take**: Number of integrations to return per page (default and maximum vary
 * by account). Start with smaller values and increase as needed.
 *
 * **order**: Sort order for results, either "asc" (oldest first) or "desc"
 * (newest first, default). Use "desc" to see your most recently created integrations
 * first.
 *
 * **cursor**: Pagination cursor returned from the previous request. Include this
 * to fetch the next page of results, maintaining consistent pagination state.
 *
 * ### Filtering by Blueprint
 *
 * When working with blueprints that organize related resources, you can filter
 * Twilio integrations by their associated blueprint:
 *
 * ```http
 * GET /api/v1/integration/twilio/list?blueprintId=blueprint_abc123
 * ```
 *
 * This returns only the integrations associated with the specified blueprint,
 * making it easy to manage integrations that belong to specific projects or
 * organizational units.
 *
 * ### Filtering by Metadata
 *
 * Filter integrations using custom metadata fields you've assigned:
 *
 * ```http
 * GET /api/v1/integration/twilio/list?meta[environment]=production&meta[region]=us-east
 * ```
 *
 * Metadata filtering enables organization-specific categorization schemes, allowing
 * you to query integrations based on custom attributes like environment, region,
 * customer, or any other organizational dimension you've defined.
 *
 * ### Response Format
 *
 * Each integration in the response includes:
 *
 * **id**: The unique integration identifier, used for update, delete, and fetch
 * operations.
 *
 * **name and description**: The human-readable identification you provided during
 * creation.
 *
 * **botId**: The ID of the bot handling SMS conversations through this integration.
 *
 * **accountSid**: The Twilio Account SID configured for outbound API replies.
 * The `authToken` is not included in list responses for security reasons.
 *
 * **voice**: Optional structured voice configuration used for call responses.
 * Empty values mean the integration uses Twilio's default speech settings.
 *
 * **contactCollection**: Whether the integration automatically creates contact
 * records for SMS interactions.
 *
 * **sessionDuration**: How long conversation context persists between messages
 * (in milliseconds).
 *
 * **allowFrom**: Which phone numbers can send messages or place calls to the
 * integration. `*` allows everyone; an empty value blocks all inbound senders.
 *
 * **blueprintId**: The blueprint this integration belongs to, if any.
 *
 * **meta**: Any custom metadata fields you've assigned to the integration.
 *
 * **createdAt and updatedAt**: Timestamps showing when the integration was created
 * and last modified.
 *
 * ### Streaming Response (JSONL)
 *
 * For applications processing large numbers of integrations, the list endpoint
 * supports streaming responses in JSONL format. Request with `Accept: application/jsonl`
 * header to receive integrations as a stream of newline-delimited JSON objects,
 * enabling memory-efficient processing of large result sets without loading
 * everything into memory at once.
 */
