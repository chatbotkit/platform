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
 * /integration/trigger/list:
 *   get:
 *     operationId: listTriggerIntegrations
 *     summary: List Trigger integrations
 *     tags:
 *       - Trigger Integration
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
 *         description: The list of Trigger integrations was retrieved successfully
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
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - $ref: '#/components/schemas/BotRef'
 *                       - type: object
 *                         properties:
 *                           secret:
 *                             description: The Trigger integration secret (returned in clear to the owner - it is the value the calling system must present)
 *                             type: string
 *                           authenticate:
 *                             description: When enabled the integration requires authentication
 *                             type: boolean
 *                           schedule:
 *                             description: The schedule for the trigger integration (interval, cron expression, ISO date, or null)
 *                             type: string
 *                             nullable: true
 *                           timezone:
 *                             description: The IANA timezone identifier used to evaluate the trigger schedule.
 *                             type: string
 *                             nullable: true
 *                           sessionDuration:
 *                             description: The session duration (in milliseconds)
 *                             type: number
 *                           lastTriggerAt:
 *                             description: The timestamp (ms) of the last trigger execution
 *                             type: number
 *                             nullable: true
 *                           nextTriggerAt:
 *                             description: The timestamp (ms) of the next scheduled trigger execution
 *                             type: number
 *                             nullable: true
 *                         required:
 *                           - secret
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
 *                       $ref: '#/paths/~1integration~1trigger~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const triggerIntegrations = await prisma.triggerIntegration.findMany({
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

          secret: true,

          authenticate: true,

          schedule: true,
          timezone: true,

          sessionDuration: true,

          lastTriggerAt: true,
          nextTriggerAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(triggerIntegrations),
      }
    })
  )
)

/**
 * @manual Trigger Integration
 *
 * ## Listing Trigger Integrations
 *
 * Retrieving your trigger integrations allows you to view all configured
 * triggers, their settings, and associated secrets. This is useful for
 * managing multiple triggers, auditing configurations, and retrieving
 * endpoint URLs and authentication credentials.
 *
 * To list all trigger integrations, send a GET request:
 *
 * ```http
 * GET /api/v1/integration/trigger/list
 * ```
 *
 * The response includes comprehensive information about each trigger:
 *
 * - **`id`**: Unique identifier for the trigger integration
 * - **`secret`**: Authentication secret (if authentication is enabled)
 * - **`botId`**: The bot assigned to process trigger events
 * - **`authenticate`**: Whether authentication is required
 * - **`schedule`**: Cron schedule for recurring execution (if configured)
 * - **`timezone`**: IANA timezone used when evaluating scheduled executions
 * - **`sessionDuration`**: How long conversation sessions persist in milliseconds
 * - **`blueprintId`**: Associated blueprint (if any)
 * - **`lastTriggerAt`**: Timestamp (in milliseconds) of the most recent execution,
 *   or `null` if the trigger has never run
 * - **`nextTriggerAt`**: Timestamp (in milliseconds) of the next scheduled
 *   execution when a `schedule` is configured, or `null` otherwise
 *
 * **Pagination Support:**
 *
 * The list endpoint supports pagination using cursor-based navigation:
 *
 * ```http
 * GET /api/v1/integration/trigger/list?cursor=abc123&take=20&order=desc
 * ```
 *
 * - **`cursor`**: Pagination cursor for retrieving the next page
 * - **`take`**: Number of items to retrieve (default varies)
 * - **`order`**: Sort order - `asc` or `desc` (default: `desc`)
 *
 * You can also filter results using blueprint association:
 *
 * ```http
 * GET /api/v1/integration/trigger/list?blueprintId=blueprint_xyz
 * ```
 */
