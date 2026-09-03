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
 * /integration/sitemap/list:
 *   get:
 *     operationId: listSitemapIntegrations
 *     summary: List Sitemap integrations
 *     tags:
 *       - Sitemap Integration
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
 *         description: The list of Sitemap integrations was retrieved successfully
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
 *                             description: The ID of the dataset used in the Sitemap integration
 *                             type: string
 *                           url:
 *                             description: The URL to use for this Sitemap integration
 *                             type: string
 *                           glob:
 *                             description: The glob rules to use for this Sitemap integration
 *                             type: string
 *                           selectors:
 *                             description: The selector rules to use for this Sitemap integration
 *                             type: string
 *                           javascript:
 *                             description: Indicates if the Sitemap integration should use JavaScript during the spidering process
 *                             type: boolean
 *                           syncStatus:
 *                             $ref: '#/components/schemas/SyncStatus'
 *                           syncSchedule:
 *                             description: The sync schedule to use for this Sitemap integration
 *                             type: string
 *                           lastSyncedAt:
 *                             description: The timestamp of the last successful sync
 *                             type: string
 *                             format: date-time
 *                           expiresIn:
 *                             description: Record expiry in milliseconds
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
 *                       $ref: '#/paths/~1integration~1sitemap~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const sitemapIntegrations = await prisma.sitemapIntegration.findMany({
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

          url: true,

          glob: true,

          selectors: true,

          javascript: true,

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
        items: makeJsonSafe(sitemapIntegrations),
      }
    })
  )
)

/**
 * @manual Sitemap Integration
 * @category Integrations
 *
 * ## Listing Sitemap Integrations
 *
 * Retrieve all sitemap integrations configured in your account to manage web
 * crawlers, monitor crawl configurations, and review which websites are being
 * synced into your datasets. This endpoint provides complete visibility into
 * all active website crawling operations.
 *
 * ```http
 * GET /api/v1/integration/sitemap/list
 * ```
 *
 * Each integration entry includes the full crawl configuration including URL
 * patterns, content selectors, JavaScript rendering settings, and sync schedules,
 * allowing you to audit and manage your web content synchronization.
 *
 * **Query Parameters:**
 *
 * - `cursor`: Pagination cursor for retrieving additional results
 * - `order`: Sort order ("asc" or "desc", default: "desc")
 * - `take`: Number of integrations to retrieve (default: 25)
 * - `meta`: Filter by metadata key-value pairs
 * - `blueprintId`: Filter integrations by blueprint association
 *
 * The response includes complete crawl configurations, enabling you to verify
 * which websites are being monitored, understand their extraction rules, and
 * identify which datasets receive the crawled content for each integration.
 *
 * **Example Response:**
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "sitemap-integration-123",
 *       "name": "Documentation Site",
 *       "url": "https://docs.example.com/sitemap.xml",
 *       "glob": "**\/docs/**",
 *       "selectors": "article.content",
 *       "javascript": false,
 *       "syncSchedule": "0 0 * * *",
 *       "expiresIn": 7776000000,
 *       "datasetId": "dataset-xyz",
 *       "createdAt": "2025-01-10T09:00:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * Use this endpoint to maintain an inventory of your web crawling operations
 * and ensure your documentation sites, blogs, and knowledge bases are being
 * properly synchronized for AI agent access.
 */
