// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /portal/{portalId}/delete:
 *   post:
 *     operationId: deletePortal
 *     summary: Delete a portal
 *     tags:
 *       - Portal
 *     parameters:
 *       - in: path
 *         name: portalId
 *         required: true
 *         schema:
 *           description: The ID of the portal to delete
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
 *         description: The portal was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted portal
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const portal = await prisma.portal.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'portalId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!portal) {
      return notFound()
    }

    if (portal.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.portal.delete({
      where: {
        id: portal.id,
      },
    })

    return ok({ id: portal.id })
  })
)

/**
 * @manual Portals
 * @index 40
 *
 * ## Deleting Portals
 *
 * Deleting a portal permanently removes the access point and all its
 * configuration, making it no longer accessible to users. This operation
 * is irreversible and should be performed carefully, particularly if the
 * portal is actively being used or referenced in external systems.
 *
 * When you delete a portal, the deletion is immediate and complete. The
 * portal's slug becomes available for reuse, and any configuration or
 * metadata associated with the portal is permanently removed. However,
 * the underlying resources (bots, datasets, blueprints) that the portal
 * provided access to remain intact and are not affected by the deletion.
 *
 * ```http
 * POST /api/v1/portal/{portalId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{portalId}` with either the portal's unique identifier (ID) or
 * its slug. The request body must be an empty object, as portal deletion
 * requires no additional parameters beyond identification and authentication.
 *
 * **Important Considerations Before Deletion:**
 * - Verify that no users are currently accessing the portal
 * - Update any documentation or integrations that reference the portal URL
 * - Consider exporting portal configuration if you may need to recreate it
 * - Ensure any dependent systems are prepared for the portal's removal
 * - Check if the portal is referenced in any automation or workflow systems
 *
 * **What Gets Deleted:** The portal deletion removes:
 * - The portal record and all its metadata
 * - All configuration settings stored in the portal
 * - The portal's slug reservation
 *
 * **What Remains Unchanged:** Portal deletion does NOT affect:
 * - Associated blueprints (they remain fully functional)
 * - Bots, datasets, or other resources the portal accessed
 * - Other portals or their configurations
 * - User accounts or permissions
 *
 * **Recovery:** Once deleted, a portal cannot be recovered. If you need the
 * same functionality, you must create a new portal with the same
 * configuration. The slug will be available for reuse immediately after
 * deletion.
 */
