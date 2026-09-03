// @ts-check
import prisma from '@/prisma/client'

import { getRealInstruction } from '@/lib/ability.instruction'
import debug from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'

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
 * /skillset/{skillsetId}/ability/create:
 *   post:
 *     operationId: createSkillsetAbility
 *     summary: Create ability
 *     tags:
 *       - Skillset Ability
 *     parameters:
 *       - in: path
 *         name: skillsetId
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
 *                     description: The instruction of the ability
 *                     type: string
 *                   state:
 *                     $ref: '#/components/schemas/ResourceState'
 *     responses:
 *       200:
 *         description: The ability was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created ability
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/abilities', 'database/abilities'],
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
        requiredUrlParam(req, 'skillsetId')
      )

      if (!skillset) {
        return notFound()
      }

      if (skillset.userId !== session.user.id) {
        return notAuthorized()
      }

      debug(`creating ability`, {
        name,
        description,

        instruction,
      })

      const { id } = await prisma.ability.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          skillsetId: skillset.id,

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
            ...meta,

            _instruction: await getRealInstruction(session.user, instruction),
          },
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)

/**
 * @manual Skillset Abilities
 * @description Abilities are the individual actions that skillsets can perform, defined through natural language instructions and executable code blocks.
 * @category Resources/Skillsets
 * @tags skillset, abilities, actions, instructions
 * @index 8
 *
 * Abilities are the building blocks of skillsets, representing individual
 * actions that your AI agents can perform. Each ability combines a natural
 * language description with detailed executable instructions, allowing the AI
 * to understand when to trigger the ability and how to execute it correctly.
 * Think of abilities as the specific tools in your agent's toolbox - each one
 * designed for a particular task.
 *
 * When a user makes a request during a conversation, the AI examines the
 * abilities in the attached skillset to determine which one matches the user's
 * intent. The ability's description helps the AI understand what the ability
 * does, while the instruction field contains the detailed implementation that
 * gets executed when the ability is triggered. This separation between intent
 * detection and execution allows for flexible and powerful agent behaviors.
 *
 * ## Creating Abilities
 *
 * Creating an ability involves defining three key components: a name that
 * identifies the ability, a description that helps the AI understand when to
 * use it, and detailed instructions that specify how to execute the action.
 * The name should be concise and descriptive, while the description should
 * focus on what the ability does and when it should be triggered. The
 * instruction field is where you define the actual implementation using action
 * code blocks and additional guidance.
 *
 * Abilities can reference secrets for authentication, connect to files for
 * context, or even delegate to other bots for complex workflows. These
 * connections make abilities extremely flexible, allowing you to build
 * sophisticated agent behaviors without hardcoding sensitive information or
 * duplicating logic across multiple abilities.
 *
 * ```http
 * POST /api/v1/skillset/{skillsetId}/ability/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Fetch Weather",
 *   "description": "Retrieves current weather information for a specified location using the weather API",
 *   "instruction": "```fetch\nGET https://api.weather.com/v1/current?location=$[location euc!|the city name]\nAuthorization: Bearer ${SECRET_WEATHER_API}\n```"
 * }
 * ```
 *
 * The instruction field uses a special syntax that combines markdown code blocks
 * with action types (like `fetch`, `search`, `email`) and parameter
 * placeholders. Parameters starting with `$[...]` are extracted by the AI from
 * user messages, while parameters starting with `${...}` reference secrets or
 * conversation metadata. This parameterization system makes abilities dynamic
 * and reusable across different contexts.
 *
 * **Key Components:**
 *
 * - **Name**: Short, memorable identifier for the ability (e.g., "Fetch Weather", "Search Knowledge Base")
 * - **Description**: Explains what the ability does and when to use it - this is crucial for intent detection
 * - **Instruction**: Contains the executable action definition with parameters and implementation details
 * - **Secret**: Optional reference to stored credentials for authenticated actions
 * - **File**: Optional reference to documents or context that the ability should consider
 * - **Bot**: Optional reference to another bot that this ability can delegate tasks to
 * - **Space**: Optional reference to a space for context isolation and resource organization
 *
 * **Instruction Syntax Examples:**
 *
 * Fetch external data:
 * ````
 * ```fetch
 * POST https://api.example.com/data
 * Content-Type: application/json
 * Authorization: Bearer ${SECRET_API_KEY}
 *
 * {
 *   "query": "$[query js|the search query]",
 *   "limit": 10
 * }
 * ```
 * ````
 *
 * Search a dataset:
 * ````
 * ```search/datasetId=dataset_id_here
 * $[query|what the user wants to search for]
 * ```
 * ````
 *
 * Send an email:
 * ````
 * ```email/to=support@example.com/replyTo=$[email|user's email address]
 * Please help this user: $[issue|description of their problem]
 * ```
 * ````
 *
 * **Best Practices:**
 *
 * - Keep descriptions focused on user intent rather than technical implementation
 * - Use clear parameter names that help the AI extract the right information
 * - Include default values or constraints in parameter definitions when appropriate
 * - Test abilities with various user inputs to ensure robust intent detection
 * - Group related abilities into logical skillsets for better organization
 * - Use secrets for API keys and sensitive data rather than hardcoding them
 * - Consider using ability templates from the platform as starting points
 *
 * **Common Ability Patterns:**
 *
 * - **Data Retrieval**: Fetching information from external APIs or databases
 * - **Search Operations**: Querying datasets or knowledge bases for relevant information
 * - **Communication**: Sending emails, notifications, or messages
 * - **Content Generation**: Creating text, images, or other media using AI models
 * - **Workflow Triggers**: Initiating processes in external systems
 * - **Delegation**: Routing complex requests to specialized bots
 */
