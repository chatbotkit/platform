// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { deleteSkillset } from '@/lib/skillset.delete'

/**
 * @swagger
 *
 * /skillset/{skillsetId}/delete:
 *   post:
 *     operationId: deleteSkillset
 *     summary: Delete a skillset
 *     tags:
 *       - Skillset
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           description: The ID of the skillset to delete
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
 *         description: The skillset was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted skillset
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const skillset = await prisma.skillset.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'skillsetId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!skillset) {
      return notFound()
    }

    if (skillset.userId !== session.user.id) {
      return notAuthorized()
    }

    await deleteSkillset(skillset)

    return ok({ id: skillset.id })
  })
)

/**
 * @manual Skillsets
 *
 * ## Deleting Skillsets
 *
 * When a skillset is no longer needed, you can permanently delete it from your
 * account. This operation removes the skillset and all of its associated
 * abilities in a single action. Deleting skillsets is useful for cleaning up
 * test configurations, removing deprecated functionality, or simplifying your
 * skillset library.
 *
 * Before deleting a skillset, it's important to understand the implications.
 * When you delete a skillset, all abilities contained within it are also
 * removed. Any conversations or agents that reference the deleted skillset will
 * no longer have access to those capabilities. This is an irreversible operation,
 * so ensure you have backups or exports of any abilities you might need later.
 *
 * ```http
 * POST /api/v1/skillset/{skillsetId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The deletion process handles all cleanup automatically, including removing
 * ability records and any associated metadata. If the skillset is part of a
 * blueprint, the blueprint structure is updated to reflect the removal. However,
 * the deletion does not affect historical conversation data - past conversations
 * that used the skillset remain intact, but they cannot access the deleted
 * abilities for new interactions.
 *
 * **Warning:**
 *
 * - Deletion is permanent and cannot be undone
 * - All abilities within the skillset are deleted along with the skillset
 * - Active conversations using this skillset will lose access to its capabilities
 * - Consider exporting ability configurations before deletion if you might need them later
 * - Verify the skillset is not in use by critical agents before deleting
 */
