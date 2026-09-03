// @ts-check
import prisma from '@/prisma/client'
import { PolicyType } from '@/prisma/types'
import { PolicyConfig } from '@/prisma/zod'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { parsePolicyConfig } from '@/lib/policy.config'
import { requiredUrlParam } from '@/lib/query.get'
import { badRequest, notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import stateSchema from '@/schemas/state'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),
  botId: botIdSchema('use'),

  type: schema.string().valid(...Object.keys(PolicyType)),

  state: stateSchema,

  // @note a loose structural check against the union of config shapes; the
  // type-specific validation is done in the handler via parsePolicyConfig
  // against the effective type (the incoming one, or the existing row's when a
  // partial update omits it).
  config: schema.object().zodSchema(PolicyConfig).allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /policy/{policyId}/update:
 *   post:
 *     operationId: updatePolicy
 *     summary: Update policy
 *     tags:
 *       - Policy
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema:
 *           description: The ID of the policy to update
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   botId:
 *                     description: The ID of the bot this policy applies to. When omitted the policy is global and applies to every bot.
 *                     type: string
 *                   type:
 *                     $ref: '#/components/schemas/PolicyType'
 *                   state:
 *                     $ref: '#/components/schemas/ResourceState'
 *                   config:
 *                     description: The policy configuration as JSON
 *                     type: object
 *                     additionalProperties: true
 *     responses:
 *       200:
 *         description: The policy was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated policy
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,
        botId: bot,

        type,

        state,

        config,

        meta,
      } = body

      const policy = await prisma.policy.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'policyId')
      )

      if (!policy) {
        return notFound()
      }

      if (policy.userId !== session.user.id) {
        return notAuthorized()
      }

      // validate the config against the shape selected by the effective type
      // (the incoming type, or the existing one for a partial update). When the
      // type changes without a new config, validate the existing config against
      // the new type so an update can't leave the row and its config mismatched.
      const effectiveType = type ?? policy.type
      const effectiveConfig = config !== undefined ? config : policy.config

      try {
        parsePolicyConfig(effectiveType, effectiveConfig)
      } catch (e) {
        return badRequest(/** @type {Error} */ (e).message)
      }

      await prisma.policy.update({
        where: {
          id: policy.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,
          botId: bot?.id || bot,

          // resource specific

          type,

          config,

          // lifecycle

          state,

          // meta and others

          meta: getMeta(meta, policy.meta),
        },
      })

      return ok({ id: policy.id })
    })
  )
)

/**
 * @manual Policies
 * @index 30
 *
 * ## Updating a Policy
 *
 * Modify an existing policy's configuration, settings, or metadata. This
 * endpoint allows you to update any aspect of a policy including its name,
 * description, type-specific configuration, and resource associations. Changes
 * take effect immediately and will be applied to future policy evaluations.
 *
 * ```http
 * POST /api/v1/policy/{policyId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "60DayRetention",
 *   "description": "Extended retention period for compliance requirements",
 *   "type": "retention",
 *   "config": {}
 * }
 * ```
 *
 * **Updatable Fields:**
 *
 * - `name`: Update the policy's descriptive name
 * - `description`: Modify the detailed explanation
 * - `type`: Change the policy type (currently only "retention" is available)
 * - `config`: Update type-specific configuration settings
 * - `blueprintId`: Change blueprint association
 * - `meta`: Update additional metadata
 *
 * **Important Considerations:**
 *
 * - Policy changes affect future evaluations only, not past actions
 * - Changing critical configuration may have immediate impact on data management
 * - The policy type can be modified, but currently only "retention" is supported
 * - Configuration updates should be tested carefully before production deployment
 * - Policy execution continues without interruption during updates
 *
 * **Update Strategies:**
 *
 * **Incremental Updates:**
 * Include only the fields you want to change. Omitted fields retain their
 * current values. This is the recommended approach for targeted modifications.
 *
 * **Complete Replacement:**
 * Provide all fields to replace the entire policy configuration. This ensures
 * a known configuration state but requires fetching current values first.
 *
 * **Configuration Validation:**
 * The platform validates configuration structure before applying updates. Invalid
 * configurations will be rejected with detailed error messages to help you
 * correct issues before affecting policy operation.
 *
 * **Common Use Cases:**
 *
 * - **Adjust Retention Periods**: Modify retention settings based on changing requirements
 * - **Update Descriptions**: Clarify policy purposes as organizational needs evolve
 * - **Change Associations**: Move policies between blueprints for better organization
 * - **Refine Configuration**: Optimize policy settings based on operational experience
 * - **Compliance Updates**: Adjust policies to meet new regulatory requirements
 *
 * **Best Practices:**
 *
 * - Fetch current policy configuration before updating to avoid overwriting recent changes
 * - Test configuration changes in non-production environments first
 * - Document why policy changes were made for audit and compliance purposes
 * - Monitor policy execution after updates to verify expected behavior
 * - Consider the impact on existing data before changing retention settings
 * - Update policy descriptions to reflect any significant configuration changes
 */
