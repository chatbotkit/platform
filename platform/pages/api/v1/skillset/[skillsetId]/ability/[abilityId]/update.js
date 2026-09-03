// @ts-check
import prisma from '@/prisma/client'

import { getRealInstruction } from '@/lib/ability.instruction'
import debug from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import abilityDescriptionSchema from '@/schemas/abilityDescription'
import abilityInstructionSchema from '@/schemas/abilityInstruction'
import abilityNameSchema from '@/schemas/abilityName'
import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import fileIdSchema from '@/schemas/fileId'
import metaSchema from '@/schemas/meta'
import secretIdSchema from '@/schemas/secretId'
import spaceIdSchema from '@/schemas/spaceId'
import stateSchema from '@/schemas/state'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: abilityNameSchema,
  description: abilityDescriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  linkedSecretId: secretIdSchema('use'),

  linkedFileId: fileIdSchema('use'),

  linkedBotId: botIdSchema('use'),

  linkedSpaceId: spaceIdSchema('use'),

  instruction: abilityInstructionSchema,

  state: stateSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /skillset/{skillsetId}/ability/{abilityId}/update:
 *   post:
 *     operationId: updateSkillsetAbility
 *     summary: Update a skillset ability
 *     tags:
 *       - Skillset Ability
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: abilityId
 *         required: true
 *         schema:
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
 *                   linkedSecretId:
 *                     description: The ID of the secret associated with the ability
 *                     type: string
 *                     nullable: true
 *                   linkedFileId:
 *                     description: The ID of the file associated with the ability
 *                     type: string
 *                     nullable: true
 *                   linkedBotId:
 *                     description: The ID of the bot associated with the ability
 *                     type: string
 *                     nullable: true
 *                   linkedSpaceId:
 *                     description: The ID of the space associated with the ability
 *                     type: string
 *                     nullable: true
 *                   instruction:
 *                     description: The text to update the ability with
 *                     type: string
 *                   state:
 *                     $ref: '#/components/schemas/ResourceState'
 *     responses:
 *       200:
 *         description: The ability was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated ability
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

        linkedSecretId: secret,

        linkedFileId: file,

        linkedBotId: bot,

        linkedSpaceId: space,

        instruction,

        state,

        meta,
      } = body

      const skillset = await prisma.skillset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'skillsetId'),
        {
          include: {
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

      debug(`updating ability`, {
        name,
        description,

        instruction,
      })

      await prisma.ability.update({
        where: {
          id: ability.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          linkedSecretId: secret?.id || secret,

          linkedFileId: file?.id || file,

          linkedBotId: bot?.id || bot,

          linkedSpaceId: space?.id || space,

          // resource specific

          instruction,

          // lifecycle

          state,

          // meta and others

          meta: {
            ...getMeta(meta, ability.meta),

            _instruction: await getRealInstruction(session.user, instruction),
          },
        },
      })

      return ok({ id: ability.id })
    })
  )
)

/**
 * @manual Skillset Abilities
 * @index 30
 *
 * ## Updating Ability Configuration
 *
 * To modify an existing ability's configuration, including updating its instruction
 * template, changing associated resources, or adjusting metadata, use the update
 * endpoint. This operation enables you to refine ability behavior as requirements
 * evolve, correct configuration errors, update authentication credentials, or adapt
 * abilities to changes in external APIs or business logic. Updating abilities is
 * a common maintenance task as integrations mature and requirements become clearer.
 *
 * Ability updates take effect immediately for all future executions, but do not
 * affect abilities currently being executed by bots or agents. This ensures that
 * in-progress operations complete successfully with their original configuration
 * before new settings are applied. You can update any combination of configuration
 * parameters in a single request, and unchanged fields will retain their existing values.
 *
 * ```http
 * POST /api/v1/skillset/{skillsetId}/ability/{abilityId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Enhanced Weather Query",
 *   "description": "Fetches weather data with extended forecast",
 *   "instruction": "```fetch\\nmethod: GET\\nurl: https://api.openweathermap.org/data/2.5/forecast\\nheaders:\\n  Authorization: ${SECRET_DEFAULT}\\nquery:\\n  q: ((location! ys|the location))\\n  cnt: 5\\n```",
 *   "linkedSecretId": "secret_new123"
 * }
 * ```
 *
 * **Updatable Configuration Fields:**
 *
 * - **name**: Update the ability's display name for better organization and clarity
 * - **description**: Modify the description to reflect current functionality or purpose
 * - **blueprintId**: Reassign the ability to a different blueprint for organizational purposes
 * - **linkedSecretId**: Change the authentication credentials used for external API access
 * - **linkedFileId**: Update or add an associated file that provides context or code
 * - **linkedBotId**: The bot this ability acts on, or null to clear the link
 * - **linkedSpaceId**: Associate the ability with a specific space for context isolation and resource organization
 * - **instruction**: Modify the execution template that defines ability behavior
 * - **meta**: Update custom metadata for tracking or organizational purposes
 *
 * **Common Update Scenarios:**
 *
 * **Updating API Integration Details:**
 * ```json
 * {
 *   "instruction": "```fetch\\nmethod: GET\\nurl: https://api.newprovider.com/v2/data\\n```"
 * }
 * ```
 * Essential when external APIs change endpoints or introduce new versions.
 *
 * **Changing Authentication Credentials:**
 * ```json
 * {
 *   "linkedSecretId": "secret_rotated456"
 * }
 * ```
 * Required when API keys or tokens are rotated for security.
 *
 * **Refining Instruction Parameters:**
 * ```json
 * {
 *   "instruction": "```fetch\\nmethod: POST\\nurl: https://api.example.com/data\\nbody:\\n  query: ((query! ys|search query))\\n  limit: 10\\n  fields: [\"id\", \"name\", \"description\"]\\n```"
 * }
 * ```
 * Useful for adding new parameters or adjusting defaults as usage patterns emerge.
 *
 * **Changing the Target Bot:**
 * ```json
 * {
 *   "linkedBotId": "bot_xyz789"
 * }
 * ```
 * Points the ability at a different bot to act on (for example, the bot that a
 * `bot/call` action invokes). This does not restrict which bots may use the ability.
 *
 * **Associating with a Space:**
 * ```json
 * {
 *   "linkedSpaceId": "space_abc123"
 * }
 * ```
 * Links the ability to a specific space for context isolation and resource organization.
 *
 * **Important Considerations:**
 *
 * - Instruction changes take effect immediately for new ability executions
 * - Changing linkedSecretId requires the new secret to exist and be accessible to your account
 * - linkedBotId only names the bot the ability acts on; it does not restrict which bots can use the ability
 * - Setting linkedBotId to null only removes the acted-on bot; which bots can use the ability is unchanged
 * - Instruction syntax must be valid according to the ability template format
 * - Complex instructions with multiple actions should be thoroughly tested after updates
 *
 * **Validation and Testing:** After updating ability instructions, especially when
 * modifying API endpoints, parameters, or authentication methods, test the ability
 * execution to ensure it works as expected. Invalid instruction syntax or incorrect
 * secret references can cause ability execution failures, so verify configurations
 * before deploying to production bots.
 *
 * **Instruction Format:** Abilities use a specialized instruction format with action
 * blocks (like `fetch`, `pack`, `bot`) and parameter placeholders. When updating
 * instructions, ensure you maintain proper syntax including correct indentation,
 * parameter definitions, and action type specifications. Refer to ability documentation
 * for detailed instruction format guidelines.
 *
 * **Rollback Strategy:** If an ability update causes unexpected behavior, you can
 * quickly rollback by updating the ability again with its previous instruction and
 * configuration. Consider keeping records of working configurations before making
 * significant changes to enable fast recovery if needed.
 */
