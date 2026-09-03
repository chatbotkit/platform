// @ts-check
import prisma from '@/prisma/client'

import { deleteBlueprint } from '@/lib/blueprint.delete'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  deleteResources: schema.boolean().optional().default(false),
})

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/delete:
 *   post:
 *     operationId: deleteBlueprint
 *     summary: Delete a blueprint
 *     tags:
 *       - Blueprint
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           description: The ID of the blueprint to delete
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteResources:
 *                 description: If true, deletes all resources associated with the blueprint. If false or omitted, only the blueprint is deleted.
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: The blueprint was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted blueprint
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { deleteResources } = body

      const blueprint = await prisma.blueprint.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'blueprintId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!blueprint) {
        return notFound()
      }

      if (blueprint.userId !== session.user.id) {
        return notAuthorized()
      }

      await deleteBlueprint(blueprint, { deleteResources })

      return ok({ id: blueprint.id })
    })
  )
)

/**
 * @manual Blueprints
 * @index 25
 *
 * ## Deleting a Blueprint
 *
 * Removing a blueprint permanently deletes the blueprint container and its organizational structure. This operation is useful when cleaning up unused templates or retiring deprecated configurations.
 *
 * ### Basic Blueprint Deletion
 *
 * To delete only the blueprint container, send a POST request with an empty request body or with `deleteResources` set to `false`:
 *
 * ```http
 * POST /api/v1/blueprint/{blueprintId}/delete
 * Content-Type: application/json
 *
 * {
 *   "deleteResources": false
 * }
 * ```
 *
 * This will remove the blueprint container while preserving all associated resources (bots, datasets, skillsets, integrations, etc.). These resources will become unassociated from the blueprint but will remain in your account as standalone items.
 *
 * ### Deleting Blueprint and All Resources
 *
 * To delete both the blueprint and all its associated resources, set the `deleteResources` parameter to `true`:
 *
 * ```http
 * POST /api/v1/blueprint/{blueprintId}/delete
 * Content-Type: application/json
 *
 * {
 *   "deleteResources": true
 * }
 * ```
 *
 * When `deleteResources` is `true`, the following resources will be permanently deleted:
 *
 * - **Basic Resources**: All bots, datasets, skillsets, abilities, secrets, files, and portals associated with the blueprint
 * - **Objects & Compliance**: All spaces, tasks, and policies associated with the blueprint
 * - **OAuth Connections**: All OAuth connections associated with the blueprint
 * - **Integration Resources**: All integrations of any type (widget, Slack, Discord, Microsoft Teams, Google Chat, Telegram, WhatsApp, Messenger, Instagram, Twilio, GitHub, Avatar, Anam, Recall, email, trigger, sitemap, Notion, support, extract, MCP server, skill server) associated with the blueprint
 * - **The Blueprint Itself**: The blueprint container and its organizational structure
 *
 * This operation ensures complete removal of a blueprint and all its contents in a single atomic transaction. If any part of the deletion fails, the entire operation is rolled back to maintain data consistency.
 *
 * ### Best Practices Before Deletion
 *
 * 1. **Review Associated Resources**: Use the resource list endpoint to see all resources linked to the blueprint before deletion
 * 2. **Choose the Right Option**: Use `deleteResources: false` (default) if you want to preserve resources, or `deleteResources: true` for complete removal
 * 3. **Consider Archiving**: Instead of deleting, consider changing the blueprint's visibility to private and updating its name to indicate it's archived
 * 4. **Backup Important Configurations**: If the blueprint contains valuable configurations, consider cloning it first as a backup
 * 5. **Check for Dependencies**: Ensure no active integrations or workflows are using the blueprint's resources before performing a full deletion
 *
 * ### What Happens to Conversations?
 *
 * When deleting bots as part of a blueprint deletion (with `deleteResources: true`), any conversations associated with those bots will have their bot references cleared. The conversations themselves are not deleted but will no longer be linked to any bot.
 *
 * **Warning:** Blueprint deletion with `deleteResources: true` is permanent and cannot be undone. Once deleted, you cannot recover the blueprint, its organizational structure, or any of its associated resources. Make sure you have backups of any critical data before proceeding with a full deletion.
 */
