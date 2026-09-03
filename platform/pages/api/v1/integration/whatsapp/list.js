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
 * /integration/whatsapp/list:
 *   get:
 *     operationId: listWhatsAppIntegrations
 *     summary: List WhatsApp integrations
 *     tags:
 *       - WhatsApp Integration
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
 *         description: The list of WhatsApp integrations was retrieved successfully
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
 *                           verifyToken:
 *                             description: The WhatsApp integration verify token
 *                             type: string
 *                           phoneNumberId:
 *                             description: The WhatsApp integration phone number ID
 *                             type: string
 *                             nullable: true
 *                           accessToken:
 *                             description: The WhatsApp integration access token (returned as '********' if configured, null otherwise)
 *                             type: string
 *                             nullable: true
 *                           appSecret:
 *                             description: The Meta app secret (returned as '********' if configured, null otherwise)
 *                             type: string
 *                             nullable: true
 *                           contactCollection:
 *                             description: Weather to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The session duration (in milliseconds)
 *                             type: number
 *                             nullable: true
 *                           attachments:
 *                             description: Weather the bot supports attachments
 *                             type: boolean
 *                           allowFrom:
 *                             description: Newline-or-comma-separated list of allowed senders. Use phone numbers in E.164 format (digits only). Leave empty to block all. Use * to allow everyone.
 *                             type: string
 *                             nullable: true
 *                         required:
 *                           - verifyToken
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
 *                       $ref: '#/paths/~1integration~1whatsapp~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const whatsappIntegrations = await prisma.whatsappIntegration.findMany({
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

          verifyToken: true,

          phoneNumberId: true,

          accessToken: true,
          appSecret: true,

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
        items: makeJsonSafe(
          whatsappIntegrations.map((integration) => {
            if (integration.accessToken) {
              /** @type {any} */ integration.accessToken = '********'
            }

            if (integration.appSecret) {
              /** @type {any} */ integration.appSecret = '********'
            }

            return integration
          })
        ),
      }
    })
  )
)

/**
 * @manual WhatsApp Integration
 *
 * ## Listing WhatsApp Integrations
 *
 * Retrieve a paginated list of all WhatsApp integrations associated with
 * your account. This endpoint is essential for managing multiple WhatsApp
 * connections, monitoring integration status, and implementing integration
 * selection interfaces in your applications.
 *
 * The list endpoint supports pagination through cursor-based navigation,
 * allowing you to efficiently retrieve large numbers of integrations. You
 * can also filter integrations by blueprint association and customize the
 * ordering and number of results returned:
 *
 * ```http
 * GET /api/v1/integration/whatsapp/list?take=10&order=desc
 * Content-Type: application/json
 * ```
 *
 * The response includes comprehensive details about each integration,
 * including configuration options, linked resources, and metadata.
 *
 * ### Security Considerations
 *
 * For security reasons, the `accessToken` field is returned as a sentinel value:
 *
 * - Returns `"********"` if an access token is configured
 * - Returns `null` if no access token has been set
 *
 * This allows you to verify which integrations have credentials configured
 * without exposing the actual secret values.
 *
 * ### Response Information
 *
 * Each integration in the response includes:
 *
 * - **Basic Details**: Integration ID, name, and description
 * - **Verify Token**: The webhook verification token (needed for Meta setup)
 * - **Phone Number ID**: The WhatsApp Business phone number identifier
 * - **Feature Flags**: Contact collection, attachments, and session settings
 * - **Resource Links**: Associated bot ID and blueprint ID
 * - **Timestamps**: Creation and last update times
 * - **Metadata**: Custom metadata for application-specific tracking
 *
 * ### Filtering and Pagination
 *
 * **Cursor-Based Pagination**: Use the `cursor` parameter with a previously
 * returned cursor value to fetch the next page of results. This ensures
 * consistent pagination even when integrations are added or removed.
 *
 * **Result Ordering**: Control the sort order with the `order` parameter
 * (`asc` for oldest first, `desc` for newest first).
 *
 * **Blueprint Filtering**: Add `blueprintId` query parameter to retrieve
 * only integrations associated with a specific blueprint.
 *
 * **Result Limits**: Use the `take` parameter to control the number of
 * integrations returned per request (useful for implementing custom
 * pagination UI).
 *
 * ### Use Cases
 *
 * - **Dashboard Views**: Display all WhatsApp integrations with their
 * configuration status in administrative interfaces
 *
 * - **Integration Selection**: Allow users to choose which WhatsApp
 * integration to use for specific bots or workflows
 *
 * - **Status Monitoring**: Periodically fetch integration lists to monitor
 * configuration completeness and identify integrations requiring attention
 *
 * - **Bulk Operations**: Retrieve all integrations for batch updates or
 * configuration synchronization across multiple WhatsApp connections
 *
 * **Note**: The access token field is intentionally excluded from list
 * responses for security reasons. Use the fetch endpoint to retrieve
 * individual integration details when needed.
 */
