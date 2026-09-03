// @ts-check
import prisma from '@/prisma/client'
import { PolicyType } from '@/prisma/types'
import { PolicyConfig } from '@/prisma/zod'

import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { parsePolicyConfig } from '@/lib/policy.config'
import { badRequest, ok } from '@/lib/response'
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

  type: schema
    .string()
    .valid(...Object.keys(PolicyType))
    .default(PolicyType.retention),

  state: stateSchema,

  // @note a loose structural check against the union of config shapes; the
  // type-specific validation is done in the handler via parsePolicyConfig (the
  // row `type` is the authoritative discriminator).
  config: schema.object().zodSchema(PolicyConfig).allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /policy/create:
 *   post:
 *     operationId: createPolicy
 *     summary: Create policy
 *     tags:
 *       - Policy
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
 *                 required:
 *                   - type
 *     responses:
 *       200:
 *         description: The policy was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created policy
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withLimits(
      ['database/policy'],
      withSchema(bodySchema, async function (_req, session, body) {
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

        // validate the config against the shape selected by the policy type
        try {
          parsePolicyConfig(type, config)
        } catch (e) {
          return badRequest(/** @type {Error} */ (e).message)
        }

        const { id } = await prisma.policy.create({
          data: {
            userId: session.user.id,

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

            meta,
          },

          select: {
            id: true,
          },
        })

        return ok({ id })
      })
    )
  )
)

/**
 * @manual Policies
 * @description Policies define automated rules and governance for data management, including retention, archival, and compliance operations across conversations, messages, and other platform resources.
 * @category Resources/Policies
 * @tags policy, governance, retention, compliance
 * @index 1
 *
 * Policies provide a powerful mechanism for automating data governance and
 * compliance operations within your ChatBotKit platform. They enable you to
 * define rules that automatically manage the lifecycle of conversations,
 * messages, and other data according to your organizational requirements,
 * legal obligations, and business policies.
 *
 * ## Understanding Policy Types
 *
 * Currently, only retention policies are available. Retention policies
 * automatically manage how long data is kept before archival or deletion,
 * helping you maintain compliance with data retention requirements and
 * optimize storage usage.
 *
 * ## Creating Policies
 *
 * Creating a policy allows you to define automated rules for data
 * management. Each policy requires a name, description, and a type that
 * determines what kind of automated operation will be performed. The
 * configuration object provides type-specific settings that control
 * the policy's behavior.
 *
 * ```http
 * POST /api/v1/policy/create
 * Content-Type: application/json
 *
 * {
 *   "name": "30DayRetention",
 *   "description": "Automatically archive conversations older than 30 days",
 *   "type": "retention",
 *   "config": {}
 * }
 * ```
 *
 * **Policy Configuration:**
 *
 * - `name`: A descriptive name for the policy (required)
 * - `description`: Detailed explanation of what the policy does (required)
 * - `type`: The policy type (currently only "retention" is available)
 * - `config`: Type-specific configuration object
 * - `blueprintId`: Optional blueprint association for organized management
 * - `meta`: Additional metadata for custom tracking and configuration
 *
 * **Configuration Object:**
 *
 * The `config` object contains policy-specific settings that control how
 * the policy operates. The structure and required fields depend on the
 * policy type being created.
 *
 * **Important Considerations:**
 *
 * - Policies are evaluated and executed automatically by the platform
 * - Changes to policy configuration affect future evaluations, not past actions
 * - Multiple policies can coexist with different scopes and priorities
 * - Policy execution is logged for compliance auditing purposes
 * - Deleted data cannot be recovered - use archival when preservation is needed
 *
 * **Best Practices:**
 *
 * - Start with archival policies before implementing deletion policies
 * - Test policies with small scopes before applying broadly
 * - Document policy purposes clearly for compliance requirements
 * - Review policy effectiveness regularly and adjust configurations
 * - Consider legal and regulatory requirements when setting retention periods
 */
