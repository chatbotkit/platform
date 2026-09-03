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
 * /policy/{policyId}/fetch:
 *   get:
 *     operationId: fetchPolicy
 *     summary: Fetch a policy
 *     tags:
 *       - Policy
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema:
 *           description: The ID of the policy to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The policy was fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     botId:
 *                       description: The ID of the bot this policy applies to. When omitted the policy is global and applies to every bot.
 *                       type: string
 *                     type:
 *                       $ref: '#/components/schemas/PolicyType'
 *                     state:
 *                       $ref: '#/components/schemas/ResourceState'
 *                     config:
 *                       description: The policy configuration as JSON
 *                       type: object
 *                       additionalProperties: true
 *                   required:
 *                     - type
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const policy = await prisma.policy.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'policyId'),
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
          botId: true,

          // resource specific

          type: true,

          config: true,

          // lifecycle

          state: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!policy) {
      return notFound()
    }

    if (policy.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (policy).userId)

    return ok(makeJsonSafe(policy))
  })
)

/**
 * @manual Policies
 * @index 20
 *
 * ## Fetching a Policy
 *
 * Retrieve detailed information about a specific policy by its ID. This
 * endpoint provides complete access to all policy configuration details,
 * including the type, configuration settings, associated resources, and
 * metadata. Use this when you need to inspect or verify a policy's current
 * settings.
 *
 * ```http
 * GET /api/v1/policy/{policyId}/fetch
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * **Response Format:**
 *
 * ```json
 * {
 *   "id": "policy_abc123",
 *   "name": "30DayRetention",
 *   "description": "Automatically archive conversations older than 30 days",
 *   "type": "retention",
 *   "blueprintId": "blueprint_xyz789",
 *   "config": {},
 *   "meta": {},
 *   "createdAt": "2025-11-10T08:00:00Z",
 *   "updatedAt": "2025-11-15T14:30:00Z"
 * }
 * ```
 *
 * **Response Fields:**
 *
 * - `id`: Unique identifier for the policy
 * - `name`: Descriptive name of the policy
 * - `description`: Detailed explanation of what the policy does
 * - `type`: Policy type (currently only "retention" is available)
 * - `blueprintId`: Associated blueprint ID (if applicable)
 * - `config`: Policy-specific configuration object
 * - `meta`: Additional metadata
 * - `createdAt`: Timestamp when the policy was created
 * - `updatedAt`: Timestamp of last policy modification
 *
 * **Understanding Policy Configuration:**
 *
 * The `config` field contains type-specific settings that control how the
 * policy operates. The structure varies depending on the policy type.
 * Currently, only retention policies are supported.
 *
 * **Common Use Cases:**
 *
 * - **Configuration Review**: Verify current policy settings before making changes
 * - **Audit Compliance**: Document policy configurations for regulatory requirements
 * - **Troubleshooting**: Inspect policy details when investigating unexpected behavior
 * - **Migration**: Export policy settings for backup or environment migration
 * - **Documentation**: Generate reports of current policy configurations
 *
 * **Best Practices:**
 *
 * - Fetch policy details before updating to ensure you have current values
 * - Regularly review policy configurations to ensure they align with requirements
 * - Document any manual changes to policy settings for audit trails
 * - Verify policy effectiveness by reviewing associated resource states
 */
