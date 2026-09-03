// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/sitemap/{sitemapIntegrationId}/fetch:
 *   get:
 *     operationId: fetchSitemapIntegration
 *     summary: Fetch a sitemapIntegration
 *     tags:
 *       - Sitemap Integration
 *     parameters:
 *       - in: path
 *         name: sitemapIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Sitemap integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Sitemap integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     datasetId:
 *                       description: The ID of the dataset used in the Sitemap integration
 *                       type: string
 *                     url:
 *                       description: The URL to use for this Sitemap integration
 *                       type: string
 *                     glob:
 *                       description: The glob rules to use for this Sitemap integration
 *                       type: string
 *                     selectors:
 *                       description: The selector rules to use for this Sitemap integration
 *                       type: string
 *                     javascript:
 *                       description: Indicates if the Sitemap integration should use JavaScript during the spidering process
 *                       type: boolean
 *                     syncStatus:
 *                       $ref: '#/components/schemas/SyncStatus'
 *                     syncSchedule:
 *                       description: The sync schedule to use for this Sitemap integration
 *                       type: string
 *                     lastSyncedAt:
 *                       description: The timestamp of the last successful sync
 *                       type: string
 *                       format: date-time
 *                     expiresIn:
 *                       description: Record expiry in milliseconds
 *                       type: number
 *                   required:
 *                     - datasetId
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const sitemapIntegration =
      await prisma.sitemapIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'sitemapIntegrationId'),
        {
          select: {
            // identifiers

            id: true,

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            userId: true,

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
        }
      )

    if (!sitemapIntegration) {
      return notFound()
    }

    if (sitemapIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (sitemapIntegration).userId)

    return ok(makeJsonSafe(sitemapIntegration))
  })
)

/**
 * @manual Sitemap Integration
 * @index 20
 *
 * ## Fetching Sitemap Integration Details
 *
 * To retrieve comprehensive information about a specific sitemap integration,
 * including its URL configuration, crawling rules, and synchronization settings,
 * use the fetch endpoint. This operation provides a complete view of how the
 * integration is configured to crawl and extract content from websites, making
 * it essential for verifying configurations, troubleshooting crawl issues, and
 * understanding the current state of your web content synchronization.
 *
 * The fetch operation returns all configuration details including the target URL,
 * glob patterns for URL filtering, CSS selectors for content extraction, JavaScript
 * rendering settings, sync schedule, and record expiration policies. This comprehensive
 * view enables you to audit integration behavior, plan configuration updates, and
 * ensure that your web content is being properly captured and synchronized into
 * your datasets.
 *
 * ```http
 * GET /api/v1/integration/sitemap/{sitemapIntegrationId}/fetch
 * Content-Type: application/json
 * ```
 *
 * The response includes detailed configuration information:
 *
 * ```json
 * {
 *   "id": "sitemap_abc123",
 *   "name": "Documentation Site Crawler",
 *   "description": "Crawls product documentation for knowledge base",
 *   "datasetId": "dataset_xyz789",
 *   "url": "https://docs.example.com/sitemap.xml",
 *   "glob": "https://docs.example.com/**",
 *   "selectors": "article.content, main.documentation",
 *   "javascript": true,
 *   "syncSchedule": "@daily",
 *   "expiresIn": 604800000,
 *   "blueprintId": "blueprint_def456",
 *   "meta": {},
 *   "createdAt": "2025-11-20T10:00:00Z",
 *   "updatedAt": "2025-11-22T15:30:00Z"
 * }
 * ```
 *
 * **Configuration Fields Explained:**
 *
 * - **url**: The sitemap XML URL or starting page URL for the crawler
 * - **glob**: Pattern matching rules to include/exclude URLs during crawling
 * - **selectors**: CSS selectors that identify the content to extract from each page
 * - **javascript**: Whether to execute JavaScript before extracting content (required for single-page applications)
 * - **syncSchedule**: Automatic sync frequency (`@daily`, `@hourly`, `@weekly`, or cron expressions)
 * - **expiresIn**: Time in milliseconds before records are considered stale (e.g., 604800000 = 7 days)
 *
 * **Use Cases:**
 * - Verifying that crawl rules are correctly configured before initiating a sync
 * - Troubleshooting why certain pages are not being crawled or extracted properly
 * - Auditing integration configurations across multiple website sources
 * - Preparing to update glob patterns or selectors based on website structure changes
 *
 * **Important:** The `javascript` setting significantly impacts crawl speed and resource usage.
 * Enable it only when necessary (e.g., for React, Vue, or Angular applications). For static
 * HTML sites, leave it disabled for faster, more efficient crawling.
 */
