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
 * /integration/email/list:
 *   get:
 *     operationId: listEmailIntegrations
 *     summary: List Email integrations
 *     tags:
 *       - Email Integration
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
 *         description: The list of Email integrations was retrieved successfully
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
 *                             description: Newline-separated list of email patterns allowed to send messages to this integration
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
 *                       $ref: '#/paths/~1integration~1email~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const emailIntegrations = await prisma.emailIntegration.findMany({
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
        items: makeJsonSafe(emailIntegrations),
      }
    })
  )
)

/**
 * @manual Email Integration
 *
 * ## Listing Email Integrations
 *
 * Retrieve all Email Integrations associated with your account by sending a GET
 * request to the list endpoint. This is useful for managing multiple email bots,
 * auditing your configurations, or building administrative dashboards that display
 * all active email integrations.
 *
 * The list endpoint supports pagination and filtering options to help you navigate
 * through large numbers of integrations efficiently. Results are returned with
 * comprehensive details about each integration, including their configuration
 * parameters and linked resources:
 *
 * ```http
 * GET /api/v1/integration/email/list
 * ```
 *
 * ### Pagination and Filtering
 *
 * When working with multiple Email Integrations, you can use cursor-based
 * pagination to retrieve results in manageable chunks. The `cursor` parameter
 * allows you to fetch subsequent pages of results:
 *
 * ```http
 * GET /api/v1/integration/email/list?cursor=CURSOR_VALUE&take=20
 * ```
 *
 * The `take` parameter controls how many items are returned per request, while
 * the `order` parameter (asc or desc) determines the sorting order based on
 * creation date.
 *
 * ### Response Structure
 *
 * Each integration in the response includes complete configuration details:
 * - **Basic Information**: ID, name, and description
 * - **Resource Links**: Associated bot ID and blueprint ID (if configured)
 * - **Configuration Options**: Contact collection, session duration, attachments, sender filtering
 * - **Metadata**: Custom metadata, creation date, and last update timestamp
 *
 * The `allowFrom` field contains a newline-separated list of email address patterns that are
 * permitted to send messages to this integration. When left empty, all incoming emails are
 * denied. To allow all senders, set this field to `*`. Specific patterns like
 * `user@example.com` (exact address) or `@example.com` (all addresses from a domain) restrict
 * inbound emails to specific senders. This is useful for preventing spam or limiting access
 * to internal users only.
 *
 * Use this information to identify which integrations need updates, monitor
 * active configurations, or programmatically manage your email bot infrastructure.
 *
 * ### Blueprint Filtering
 *
 * If you organize your integrations using blueprints, you can filter the list
 * to show only integrations associated with a specific blueprint. This is helpful
 * for managing different deployment environments or customer segments:
 *
 * ```http
 * GET /api/v1/integration/email/list?blueprintId=BLUEPRINT_ID
 * ```
 *
 * This query returns only the Email Integrations that are linked to the specified
 * blueprint, making it easier to manage grouped configurations.
 */
