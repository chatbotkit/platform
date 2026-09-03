// @ts-check
import prisma from '@/prisma/client'
import { SkillsetVisibility } from '@/prisma/types'

import debug from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import stateSchema from '@/schemas/state'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  visibility: schema.string().valid(...Object.keys(SkillsetVisibility)),

  state: stateSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /skillset/create:
 *   post:
 *     operationId: createSkillset
 *     summary: Create skillset
 *     tags:
 *       - Skillset
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
 *                   visibility:
 *                     $ref: '#/components/schemas/SkillsetVisibility'
 *                   state:
 *                     $ref: '#/components/schemas/ResourceState'
 *     responses:
 *       200:
 *         description: The skillset was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created skillset
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withLimits(
      ['database/skillset'],
      withSchema(bodySchema, async function (_req, session, body) {
        const {
          alias,

          name,
          description,

          blueprintId: blueprint,

          visibility,

          state,

          meta,
        } = body

        debug(`creating skillset`, {
          name,
          description,

          visibility,

          meta,
        })

        const { id } = await prisma.skillset.create({
          data: {
            userId: session.user.id,

            // ref

            alias,

            // basic information

            name,
            description,

            // resource linking

            blueprintId: blueprint?.id || blueprint,

            // resource specific

            visibility,

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
 * @manual Skillsets
 * @description Skillsets are collections of abilities that define what actions your AI agents can perform, from fetching web data to sending emails and generating content.
 * @category Resources/Skillsets
 * @tags skillset, abilities, actions
 * @index 7
 *
 * Skillsets are powerful collections of abilities that define the actions your AI
 * agents can perform. Think of a skillset as a toolbox that gives your agent
 * specific capabilities - from fetching web pages and searching datasets to
 * sending emails and generating images. Each skillset contains multiple abilities,
 * and each ability contains detailed instructions for how to execute a specific
 * action.
 *
 * When you attach a skillset to a conversation or agent, the AI can automatically
 * detect user intent and execute the appropriate abilities to fulfill requests.
 * This makes your agents significantly more capable and interactive, enabling
 * them to take real actions rather than just generating text responses.
 *
 * **Note on Skillsets and Skills:** Skillsets in ChatBotKit have properties and
 * behavior similar to what are now commonly known as "skills" - a concept
 * popularized by Anthropic and other AI providers. However, ChatBotKit's skillset
 * implementation pre-dates this terminology. An important aspect of skillsets is
 * that the skillset's name and description are automatically known to the AI agent,
 * which directly impacts the agent's behavior and decision-making. When abilities
 * are connected to a skillset, they provide structured information that tells the
 * agent how to use those connected abilities effectively. This seamless integration
 * allows agents to understand both what capabilities they have available and how to
 * properly utilize them during conversations.
 *
 * ## Creating Skillsets
 *
 * Creating a skillset is the foundation for building capable AI agents. When you
 * create a skillset, you're establishing a container for abilities that your
 * agents will be able to use during conversations. The skillset acts as a logical
 * grouping of related capabilities, making it easier to manage and reuse
 * functionality across multiple agents.
 *
 * To create a skillset, you need to provide basic information including a name
 * and description. The name should clearly indicate the skillset's purpose, while
 * the description helps you and your team understand what capabilities this
 * skillset provides. You can also configure visibility settings to control
 * whether the skillset is private to your account or can be shared with others.
 *
 * ```http
 * POST /api/v1/skillset/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Toolkit",
 *   "description": "Abilities for handling customer support inquiries including knowledge base search, ticket creation, and email notifications",
 *   "visibility": "private"
 * }
 * ```
 *
 * The API will return the ID of the newly created skillset, which you can then
 * use to add abilities. After creating a skillset, your next step is typically
 * to add abilities that define specific actions the agent can perform. You can
 * add abilities one at a time or use ability templates to quickly set up common
 * functionality.
 *
 * **Important Notes:**
 *
 * - Skillsets start empty - you need to add abilities separately after creation
 * - The visibility setting controls who can see and use the skillset
 * - You can optionally link skillsets to blueprints for organized project management
 * - Skillset names should be descriptive to make them easy to identify later
 * - Consider creating separate skillsets for different functional areas (support, sales, analytics)
 */
