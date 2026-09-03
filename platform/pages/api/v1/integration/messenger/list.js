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
 * /integration/messenger/list:
 *   get:
 *     operationId: listMessengerIntegrations
 *     summary: List Messenger integrations
 *     tags:
 *       - Messenger Integration
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
 *         description: The list of Messenger integrations was retrieved successfully
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
 *                             description: The Messenger integration verify token
 *                             type: string
 *                           accessToken:
 *                             description: The Messenger integration access token (returned as '********' if configured, null otherwise)
 *                             type: string
 *                             nullable: true
 *                           appSecret:
 *                             description: The Meta app secret (returned as '********' if configured, null otherwise)
 *                             type: string
 *                             nullable: true
 *                           contactCollection:
 *                             description: Whether to collect contacts
 *                             type: boolean
 *                           sessionDuration:
 *                             description: The session duration (in milliseconds)
 *                             type: number
 *                             nullable: true
 *                           attachments:
 *                             description: Whether the bot supports attachments
 *                             type: boolean
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
 *                       $ref: '#/paths/~1integration~1messenger~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const messengerIntegrations = await prisma.messengerIntegration.findMany({
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

          accessToken: true,

          appSecret: true,

          contactCollection: true,

          sessionDuration: true,

          attachments: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(
          messengerIntegrations.map((integration) => {
            if (integration.accessToken) {
              /** @type {any} */ integration.accessToken = '********'
            }

            if (integration.appSecret) {
              /** @type {any} */ (integration).appSecret = '********'
            }

            return integration
          })
        ),
      }
    })
  )
)

/**
 * @manual Messenger Integration
 *
 * ## Listing Messenger Integrations
 *
 * Retrieving a list of your Messenger integrations allows you to view all
 * configured bots connected to Facebook Messenger, review their settings,
 * and manage multiple integrations from a centralized location. This is
 * particularly useful when managing multiple Facebook Pages or deploying
 * different bots for various use cases.
 *
 * The list endpoint supports pagination through cursor-based navigation,
 * enabling efficient retrieval of large numbers of integrations. You can
 * control the order of results (ascending or descending by creation date)
 * and limit the number of items returned per request to optimize performance
 * and reduce unnecessary data transfer.
 *
 * Each integration in the list includes essential information such as the
 * integration name, description, associated bot ID, webhook verify token,
 * session duration settings, and attachment support configuration.
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
 * ```http
 * GET /api/v1/integration/messenger/list?order=desc&take=10
 * ```
 *
 * The response includes an array of integration objects with their configuration
 * details. You can filter results by blueprint ID to find integrations associated
 * with specific blueprints, or use metadata filters to locate integrations based
 * on custom tags and properties.
 *
 * **Pagination:** Use the `cursor` parameter to navigate through pages of results.
 * The initial request returns the first page along with a cursor for the next
 * page. Include this cursor in subsequent requests to retrieve additional pages
 * until no more results are available.
 *
 * **Best Practice:** When managing multiple integrations, use descriptive names
 * and consistent metadata to make it easier to identify and organize your
 * Messenger bots. This becomes especially important as your deployment grows
 * to include multiple pages, languages, or customer segments.
 */
