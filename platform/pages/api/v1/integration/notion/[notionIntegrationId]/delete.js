// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/notion/{notionIntegrationId}/delete:
 *   post:
 *     operationId: deleteNotionIntegration
 *     summary: Delete Notion integration
 *     tags:
 *       - Notion Integration
 *     parameters:
 *       - in: path
 *         name: notionIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Notion integration
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
 *         description: The Notion integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Notion integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const notionIntegration =
      await prisma.notionIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'notionIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!notionIntegration) {
      return notFound()
    }

    if (notionIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.notionIntegration.delete({
      where: {
        id: notionIntegration.id,
      },
    })

    return ok({ id: notionIntegration.id })
  })
)

/**
 * @manual Notion Integration
 * @index 40
 *
 * ## Deleting a Notion Integration
 *
 * To permanently remove a Notion integration and stop all content synchronization
 * from the associated Notion workspace, use the delete endpoint. This operation
 * irreversibly removes the integration configuration, cancels any scheduled sync
 * operations, and disconnects the integration from its associated dataset. This
 * is typically used when you no longer need to sync content from a particular
 * Notion workspace, when migrating to a different integration approach, or when
 * cleaning up unused integrations from your account.
 *
 * Deleting a Notion integration does not automatically remove the content that was
 * previously synchronized into the associated dataset. Records that were imported
 * from Notion remain in the dataset unless explicitly deleted. This design ensures
 * that valuable content is preserved even after the integration is removed, giving
 * you the option to manually manage or migrate existing data before deletion.
 *
 * ```http
 * POST /api/v1/integration/notion/{notionIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response confirms successful deletion:
 *
 * ```json
 * {
 *   "id": "notion_abc123"
 * }
 * ```
 *
 * **What Gets Deleted:**
 * - The Notion integration configuration and all associated settings
 * - The stored Notion API token and authentication credentials
 * - All scheduled synchronization tasks for this integration
 * - Metadata and configuration history for the integration
 *
 * **What Is NOT Deleted:**
 * - Records previously synchronized from Notion that now exist in the dataset
 * - The associated dataset itself (remains intact and operational)
 * - Any blueprints or other resources that referenced this integration
 * - Audit logs and event logs documenting past integration operations
 *
 * **Important Considerations:**
 *
 * **Before Deleting:**
 * - Verify that you no longer need content updates from this Notion workspace
 * - Consider whether you want to preserve synchronized records in the dataset
 * - Check if any bots or applications depend on content from this integration
 * - Export integration configuration if you might want to recreate it later
 *
 * **After Deletion:**
 * - All scheduled syncs will immediately stop, and no new content will be imported
 * - The integration cannot be recovered; you must recreate it from scratch if needed
 * - Existing dataset records remain available but will not receive updates from Notion
 * - You can safely delete records from the dataset separately if you no longer need them
 *
 * **Alternative to Deletion:** If you want to temporarily pause synchronization without
 * losing the integration configuration, consider updating the `syncSchedule` to a less
 * frequent interval or disabling automatic syncing entirely, rather than deleting the
 * integration. This preserves your configuration for future use.
 */
