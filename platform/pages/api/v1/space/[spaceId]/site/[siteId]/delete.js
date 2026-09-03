// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /space/{spaceId}/site/{siteId}/delete:
 *   post:
 *     operationId: deleteSpaceSite
 *     summary: Delete a space site
 *     tags:
 *       - Space Site
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: siteId
 *         required: true
 *         schema:
 *           description: The ID of the site to delete
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
 *         description: The site was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted site
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const space = await prisma.space.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'spaceId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!space) {
      return notFound()
    }

    if (space.userId !== session.user.id) {
      return notAuthorized()
    }

    const site = await prisma.spaceSite.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'siteId'),
      {
        select: {
          id: true,
          userId: true,
          spaceId: true,
        },
      }
    )

    if (!site || site.spaceId !== space.id) {
      return notFound()
    }

    if (site.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.spaceSite.delete({
      where: {
        id: site.id,
      },
    })

    return ok({ id: site.id })
  })
)

/**
 * @manual Space Sites
 * @index 40
 *
 * ## Deleting a Site
 *
 * Permanently remove a site from your space. Deletion immediately stops serving content at the site's apex subdomain.
 *
 * ```http
 * POST /api/v1/space/{spaceId}/site/{siteId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "site_abc123def456"
 * }
 * ```
 *
 * **URL Parameters:**
 *
 * - **spaceId**: The space containing the site
 * - **siteId**: The ID of the site to delete
 *
 * **Important Warnings:**
 *
 * ⚠️ **This action is permanent and cannot be undone.**
 *
 * - Deleting a site immediately stops serving content at its apex subdomain
 * - Any bookmarks or links to the deleted site will return 404 errors
 * - Consider creating a redirect or announcement before deletion
 *
 * **Best Practices Before Deletion:**
 *
 * 1. Export or backup any important configuration
 * 2. Add a temporary redirect or maintenance page
 * 3. Notify users of the change
 * 4. Monitor for broken links after deletion
 *
 * **Recovery Options:**
 *
 * - If accidentally deleted, you can recreate the site with the same slug if it remains available
 * - Configuration cannot be recovered if you didn't maintain backups
 * - Contact support if you need assistance with recovery
 */
