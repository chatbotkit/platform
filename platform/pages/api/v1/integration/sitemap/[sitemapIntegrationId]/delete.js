// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/sitemap/{sitemapIntegrationId}/delete:
 *   post:
 *     operationId: deleteSitemapIntegration
 *     summary: Delete Sitemap integration
 *     tags:
 *       - Sitemap Integration
 *     parameters:
 *       - in: path
 *         name: sitemapIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Sitemap integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The Sitemap integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Sitemap integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const sitemapIntegration =
      await prisma.sitemapIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'sitemapIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!sitemapIntegration) {
      return notFound()
    }

    if (sitemapIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.sitemapIntegration.delete({
      where: {
        id: sitemapIntegration.id,
      },
    })

    return ok({ id: sitemapIntegration.id })
  })
)

/**
 * @manual Sitemap Integration
 * @index 40
 *
 * ## Deleting a Sitemap Integration
 *
 * To permanently remove a sitemap integration and stop all web content crawling
 * from the associated URL or domain, use the delete endpoint. This operation
 * irreversibly removes the integration configuration, cancels any scheduled crawl
 * operations, and disconnects the integration from its associated dataset. This
 * is typically used when you no longer need to crawl content from a particular
 * website, when migrating to a different content source, or when cleaning up
 * unused integrations from your account.
 *
 * Deleting a sitemap integration does not automatically remove the content that was
 * previously crawled and stored in the associated dataset. Records that were extracted
 * from web pages remain in the dataset unless explicitly deleted. This design ensures
 * that valuable content is preserved even after the integration is removed, giving you
 * the option to manually manage or migrate existing data before deletion.
 *
 * ```http
 * POST /api/v1/integration/sitemap/{sitemapIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response confirms successful deletion:
 *
 * ```json
 * {
 *   "id": "sitemap_abc123"
 * }
 * ```
 *
 * **What Gets Deleted:**
 * - The sitemap integration configuration and all crawling settings
 * - URL patterns, glob rules, and CSS selector configurations
 * - JavaScript rendering settings and crawl schedules
 * - All scheduled crawl tasks for this integration
 * - Metadata and configuration history for the integration
 *
 * **What Is NOT Deleted:**
 * - Records previously crawled from websites that now exist in the dataset
 * - The associated dataset itself (remains intact and operational)
 * - Any blueprints or other resources that referenced this integration
 * - Audit logs and event logs documenting past crawl operations
 *
 * **Important Considerations:**
 *
 * **Before Deleting:**
 * - Verify that you no longer need content updates from this website or domain
 * - Consider whether you want to preserve crawled records in the dataset
 * - Check if any bots or applications depend on content from this integration
 * - Export integration configuration (URL, selectors, glob patterns) if you might want to recreate it later
 * - Review crawl logs to ensure all desired content has been successfully captured
 *
 * **After Deletion:**
 * - All scheduled crawls will immediately stop, and no new content will be imported
 * - The integration cannot be recovered; you must recreate it from scratch if needed
 * - Existing dataset records remain available but will not receive updates from the website
 * - You can safely delete records from the dataset separately if you no longer need them
 * - Any custom glob patterns or selectors configured for this integration will be lost
 *
 * **Impact on Content Freshness:** Once a sitemap integration is deleted, the crawled
 * content in your dataset will gradually become outdated as the source website changes.
 * If you need to maintain current content, ensure you have an alternative integration
 * or manual update process in place before deleting the integration.
 *
 * **Alternative to Deletion:** If you want to temporarily pause crawling without
 * losing the integration configuration, consider updating the `syncSchedule` to a
 * less frequent interval or setting it to a far-future cron expression, rather than
 * deleting the integration. This preserves your carefully configured selectors, glob
 * patterns, and crawling rules for future use.
 *
 * **Data Retention:** If you plan to delete both the integration and the crawled
 * content, delete the integration first, then separately delete or archive the
 * records from the dataset. This two-step process gives you the opportunity to
 * verify that you have backups or exports of any valuable content before permanent
 * removal.
 */
