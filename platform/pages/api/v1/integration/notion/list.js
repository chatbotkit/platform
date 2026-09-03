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
 * /integration/notion/list:
 *   get:
 *     operationId: listNotionIntegrations
 *     summary: List Notion integrations
 *     tags:
 *       - Notion Integration
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
 *         description: The list of Notion integrations was retrieved successfully
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
 *                       - type: object
 *                         properties:
 *                           datasetId:
 *                             description: The ID of the dataset to sync into
 *                             type: string
 *                           token:
 *                             description: The Notion API token (returned as '********' if configured, null otherwise)
 *                             type: string
 *                           syncStatus:
 *                             $ref: '#/components/schemas/SyncStatus'
 *                           syncSchedule:
 *                             description: The sync schedule
 *                             type: string
 *                           lastSyncedAt:
 *                             description: The timestamp of the last successful sync
 *                             type: string
 *                             format: date-time
 *                           expiresIn:
 *                             description: The time in milliseconds until records expire
 *                             type: number
 *                         required:
 *                           - datasetId
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
 *                       $ref: '#/paths/~1integration~1notion~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const notionIntegrations = await prisma.notionIntegration.findMany({
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

          datasetId: true,

          // resource specific

          token: true,

          syncStatus: true,
          syncSchedule: true,
          lastSyncedAt: true,

          expiresIn: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(
          notionIntegrations.map((integration) => {
            if (integration.token) {
              /** @type {any} */ integration.token = '********'
            }

            return integration
          })
        ),
      }
    })
  )
)

/**
 * @manual Notion Integration
 * @category Integrations
 *
 * ## Listing Notion Integrations
 *
 * Retrieve all Notion integrations configured in your account to manage sync
 * configurations, monitor status, and access integration details. This endpoint
 * provides a complete inventory of all Notion workspace connections and their
 * synchronization settings.
 *
 * ```http
 * GET /api/v1/integration/notion/list
 * ```
 *
 * The list includes all configuration details except for sensitive API tokens,
 * which are masked with "********" for security. Each integration entry shows
 * which dataset it syncs into, the sync schedule, and expiration settings.
 *
 * **Query Parameters:**
 *
 * - `cursor`: Pagination cursor for retrieving additional results
 * - `order`: Sort order ("asc" or "desc", default: "desc")
 * - `take`: Number of integrations to retrieve (default: 25)
 * - `meta`: Filter by metadata key-value pairs
 * - `blueprintId`: Filter integrations by blueprint association
 *
 * The response includes complete integration configurations, enabling you to
 * audit your Notion connections, verify sync schedules, and identify which
 * datasets receive content from each workspace.
 *
 * **Example Response:**
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "notion-integration-123",
 *       "name": "Company Wiki",
 *       "datasetId": "dataset-abc",
 *       "token": "********",
 *       "syncSchedule": "0 * * * *",
 *       "expiresIn": 2592000000,
 *       "createdAt": "2025-01-15T10:00:00Z",
 *       "updatedAt": "2025-01-20T15:30:00Z"
 *     }
 *   ]
 * }
 * ```
 */
