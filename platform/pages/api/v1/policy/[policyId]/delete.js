// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /policy/{policyId}/delete:
 *   post:
 *     operationId: deletePolicy
 *     summary: Delete policy
 *     tags:
 *       - Policy
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema:
 *           description: The ID of the policy to delete
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
 *         description: The policy was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted policy
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const policy = await prisma.policy.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'policyId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!policy) {
      return notFound()
    }

    if (policy.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.policy.delete({
      where: {
        id: policy.id,
      },
    })

    return ok({ id: policy.id })
  })
)

/**
 * @manual Policies
 * @index 40
 *
 * ## Deleting a Policy
 *
 * Permanently remove a policy from your account. This endpoint completely
 * deletes the policy and all its configuration. Once deleted, the policy
 * will no longer be evaluated or executed, and its automated operations
 * will cease immediately. This action cannot be undone.
 *
 * ```http
 * POST /api/v1/policy/{policyId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * **Important Considerations:**
 *
 * - Policy deletion is immediate and irreversible
 * - All automated operations governed by this policy will stop
 * - Historical data affected by the policy remains in its current state
 * - Deletion does not undo previous policy actions (e.g., archived/deleted data)
 * - Associated resources (conversations, messages, etc.) are not affected
 * - Only the policy configuration itself is removed
 *
 * **Impact on Data Management:**
 *
 * When you delete a retention policy, for example:
 * - Data already archived remains archived
 * - Data already deleted remains deleted
 * - Future retention operations will not occur
 * - No automatic cleanup of data covered by the deleted policy
 *
 * **When to Delete Policies:**
 *
 * - **Obsolete Rules**: Policy requirements have changed and rule is no longer needed
 * - **Replaced Configuration**: A new policy supersedes the old one
 * - **Testing Cleanup**: Removing test or temporary policies from development
 * - **Organizational Changes**: Business processes no longer require the policy
 * - **Compliance Updates**: Regulatory requirements have changed
 *
 * **Alternatives to Deletion:**
 *
 * Before deleting a policy, consider these alternatives:
 *
 * - **Update**: Modify the policy configuration to meet current needs instead
 * - **Disable**: Some organizations prefer to disable rather than delete for audit trails
 * - **Archive**: Export policy configuration before deletion for historical records
 * - **Document**: Record the reason for deletion for compliance purposes
 *
 * **Best Practices:**
 *
 * - Verify the policy ID before deletion to avoid removing the wrong policy
 * - Document why the policy is being deleted for audit and compliance records
 * - Review what data or operations were governed by the policy before deletion
 * - Consider exporting policy configuration for backup before deleting
 * - Notify relevant stakeholders before deleting policies that affect shared resources
 * - Verify no critical automated operations depend on the policy before deletion
 * - After deletion, update any documentation that referenced the removed policy
 *
 * **Recovery:**
 *
 * Deleted policies cannot be recovered. If you need the same policy later,
 * you must recreate it with the same configuration. Keep backups of critical
 * policy configurations if there's any chance you might need them again.
 */
