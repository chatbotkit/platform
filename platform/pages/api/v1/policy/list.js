// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /policy/list:
 *   get:
 *     operationId: listPolicies
 *     summary: Retrieve a list of policies
 *     tags:
 *       - Policy
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *       - in: query
 *         name: botId
 *         schema:
 *           description: Filter policies that apply to a specific bot
 *           type: string
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of policies was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceRefProperties'
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - type: object
 *                         properties:
 *                           botId:
 *                             description: The ID of the bot this policy applies to. When omitted the policy is global and applies to every bot.
 *                             type: string
 *                           type:
 *                             $ref: '#/components/schemas/PolicyType'
 *                           state:
 *                             $ref: '#/components/schemas/ResourceState'
 *                           config:
 *                             description: The policy configuration as JSON
 *                             type: object
 *                             additionalProperties: true
 *                         required:
 *                           - type
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1policy~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const policies = await prisma.policy.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').Policy>} */ (
              getFieldQueryFilter
            )(req, ['type', 'botId']),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

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
      })

      return {
        items: makeJsonSafe(policies),
      }
    })
  )
)

/**
 * @manual Policies
 * @index 10
 *
 * ## Listing Policies
 *
 * Retrieve all policies configured in your account. Policies define rules
 * and behaviors that govern how your conversational AI agents operate,
 * including content moderation, response filtering, safety guidelines, and
 * compliance requirements. This endpoint provides a comprehensive view of
 * your policy landscape for audit, management, and configuration purposes.
 *
 * ```http
 * GET /api/v1/policy/list
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * **Response Format:**
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "policy_abc123",
 *       "name": "30DayRetention",
 *       "description": "Automatically archive conversations older than 30 days",
 *       "type": "retention",
 *       "blueprintId": "blueprint_xyz789",
 *       "config": {},
 *       "meta": {},
 *       "createdAt": "2025-11-10T08:00:00Z",
 *       "updatedAt": "2025-11-15T14:30:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * **Understanding Policy Types:**
 *
 * The `type` field indicates what kind of policy this is. Currently, only
 * retention policies are available:
 *
 * - **Retention**: Data retention and cleanup policies for managing conversation lifecycle
 * - **Access**: Access control and permission policies
 *
 * Different policy types have different configuration structures in the
 * `config` field, tailored to their specific purposes.
 *
 * **Policy Configuration:**
 *
 * The `config` field contains policy-specific settings as a JSON object.
 * The structure varies by policy type and includes all the parameters that
 * control how the policy operates. When listing policies, you can inspect
 * these configurations to understand your current policy settings.
 *
 * **Query Parameters for Filtering:**
 *
 * - `cursor`: Pagination cursor for retrieving subsequent pages
 * - `take`: Number of policies to return per page
 * - `order`: Sort order ("asc" or "desc", default is "desc")
 * - `type`: Filter by specific policy type
 * - `blueprintId`: Filter policies belonging to a specific blueprint
 * - `meta`: Filter by metadata fields using JSON query syntax
 *
 * **Filtering by Policy Type:**
 *
 * To retrieve only policies of a specific type, use the type query parameter.
 * This is useful when you want to review all moderation policies, compliance
 * policies, or any other specific category:
 *
 * ```http
 * GET /api/v1/policy/list?type=moderation
 * ```
 *
 * **Filtering by Blueprint:**
 *
 * When working within the context of a specific project or blueprint, filter
 * policies to see only those associated with that blueprint:
 *
 * ```http
 * GET /api/v1/policy/list?blueprintId=blueprint_xyz789
 * ```
 *
 * **Pagination:**
 *
 * For accounts with many policies, use cursor-based pagination to efficiently
 * retrieve results:
 *
 * ```http
 * GET /api/v1/policy/list?cursor=next_page_cursor&take=25
 * ```
 *
 * **Policy Management Workflows:**
 *
 * **Audit and Review:**
 * Periodically list all policies to ensure they align with current requirements
 * and organizational standards. Review policy configurations to verify they're
 * still appropriate for your use cases.
 *
 * **Blueprint Configuration:**
 * When setting up a new blueprint, list existing policies to identify which
 * ones should be associated with the new project.
 *
 * **Compliance Verification:**
 * Filter by compliance policy types to generate reports for regulatory
 * requirements or internal audits.
 *
 * **Policy Consolidation:**
 * Review all policies to identify duplicates or similar policies that could
 * be consolidated for easier management.
 *
 * **Common Use Cases:**
 *
 * - **Policy Inventory**: Get a complete view of all active policies
 * - **Compliance Auditing**: Review policies for regulatory compliance
 * - **Security Review**: Verify moderation and safety policies are configured
 * - **Blueprint Setup**: Identify policies to attach to new projects
 * - **Policy Migration**: Export policy configurations for environment migration
 * - **Access Control Review**: Audit access policies for security assessment
 * - **Configuration Backup**: Document policy settings for disaster recovery
 *
 * **Best Practices:**
 *
 * - Regularly audit your policy list to ensure it's up-to-date
 * - Use descriptive names that clearly indicate each policy's purpose
 * - Document policy rationale in the description field
 * - Group related policies using blueprints for easier management
 * - Remove obsolete policies to reduce configuration complexity
 * - Use consistent naming conventions across policy types
 * - Track policy updates to maintain change history
 * - Test policy configurations in non-production environments first
 * - Maintain documentation of policy settings outside the platform
 * - Review policies when regulations or requirements change
 *
 * **Security Considerations:**
 *
 * - Policy configurations may contain sensitive rules or thresholds
 * - Access to policy list should be restricted to authorized personnel
 * - Changes to policies can significantly impact agent behavior
 * - Document all policy modifications for audit trails
 * - Test policy changes thoroughly before production deployment
 */
