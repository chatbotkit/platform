// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /skillset/{skillsetId}/ability/{abilityId}/delete:
 *   post:
 *     operationId: deleteSkillsetAbility
 *     summary: Delete a ability from a skillset
 *     tags:
 *       - Skillset Ability
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           description: The ID of the skillset
 *           type: string
 *       - in: path
 *         name: abilityId
 *         required: true
 *         schema:
 *           description: The ID of the ability to delete
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
 *         description: The ability was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted ability
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

          abilities: {
            where: {
              id: requiredUrlParam(req, 'abilityId'),
            },

            take: 1,
          },
        },
      }
    )

    if (!skillset) {
      return notFound()
    }

    if (skillset.userId !== session.user.id) {
      return notAuthorized()
    }

    const ability = skillset.abilities[0]

    if (!ability) {
      return notFound()
    }

    await prisma.ability.delete({
      where: {
        id: ability.id,
      },
    })

    return ok({ id: ability.id })
  })
)

/**
 * @manual Skillset Abilities
 * @index 40
 *
 * ## Deleting an Ability from a Skillset
 *
 * To permanently remove an ability from a skillset, use the delete endpoint. This
 * operation irreversibly removes the ability configuration and prevents any bots
 * using the skillset from accessing this capability in future operations. Deleting
 * abilities is typically done when capabilities are no longer needed, when consolidating
 * duplicate functionality, or when removing deprecated or malfunctioning integrations
 * from your skillset portfolio.
 *
 * Deleting an ability does not immediately affect bots currently executing tasks that
 * use this ability. In-progress operations will complete with the ability still
 * available. However, any new bot conversations, tasks, or operations started after
 * the deletion will not have access to the removed ability. This ensures graceful
 * degradation without interrupting active bot operations.
 *
 * ```http
 * POST /api/v1/skillset/{skillsetId}/ability/{abilityId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response confirms successful deletion:
 *
 * ```json
 * {
 *   "id": "ability_abc123"
 * }
 * ```
 *
 * **What Gets Deleted:**
 * - The ability configuration including all instruction templates
 * - References to associated secrets, files, and bots
 * - Metadata and configuration history for the ability
 * - The ability's presence in the skillset's capability list
 *
 * **What Is NOT Deleted:**
 * - The associated secret (if configured) remains available for other abilities
 * - The associated file (if configured) remains available for other uses
 * - Historical audit logs showing past ability executions
 * - The skillset itself continues to function with remaining abilities
 * - Bots using the skillset continue to operate (with reduced capabilities)
 *
 * **Important Considerations:**
 *
 * **Before Deleting:**
 * - Verify that no bots depend on this ability for critical functionality
 * - Check if other abilities in the skillset reference or depend on this ability
 * - Export the ability configuration (instruction, secrets, parameters) if you might need to recreate it
 * - Review recent execution logs to confirm the ability is not actively being used
 * - Consider whether the ability should be disabled rather than deleted if you might need it later
 *
 * **After Deletion:**
 * - Bots will no longer be able to execute this ability in new operations
 * - Any bot instructions or workflows that reference the deleted ability will fail when attempted
 * - The ability cannot be recovered; you must recreate it from scratch if needed
 * - Consider updating bot prompts or instructions that may have referenced this capability
 * - Monitor bot performance to ensure the missing ability doesn't impact expected functionality
 *
 * **Impact on Bot Behavior:** When an ability is deleted, bots using the skillset
 * lose that specific capability. If the ability was essential for certain bot functions,
 * those functions will no longer work. Bots may need updated instructions or prompts
 * to handle the absence of the deleted ability gracefully, or you may need to add
 * an alternative ability to maintain functionality.
 *
 * **Cascading Effects:** If other abilities in the skillset use `pack` actions that
 * include the deleted ability, those pack executions will fail when they attempt to
 * invoke the missing capability. Review any pack abilities that might reference the
 * deleted ability and update them accordingly.
 *
 * **Alternative to Deletion:** If you want to temporarily disable an ability without
 * losing its configuration, consider:
 * - Modifying the instruction to return an error message instead of executing
 * - Documenting the ability as deprecated in its description while keeping it available
 *
 * These approaches preserve the ability configuration for future use while preventing
 * it from being actively executed by production bots. When ready to fully remove the
 * capability, you can then delete it with confidence that its configuration has been
 * properly documented and backed up.
 */
