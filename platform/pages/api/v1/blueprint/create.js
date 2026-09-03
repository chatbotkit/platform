// @ts-check
import prisma from '@/prisma/client'
import { BlueprintVisibility } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintConfigSchema from '@/schemas/blueprintConfig'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  visibility: schema.string().valid(...Object.keys(BlueprintVisibility)),

  config: blueprintConfigSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /blueprint/create:
 *   post:
 *     operationId: createBlueprint
 *     summary: Create blueprint
 *     tags:
 *       - Blueprint
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   visibility:
 *                     $ref: '#/components/schemas/BlueprintVisibility'
 *     responses:
 *       200:
 *         description: The blueprint was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created blueprint
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        visibility,

        config,

        meta,
      } = body

      const { id } = await prisma.blueprint.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource specific

          visibility,

          config,

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

/**
 * @manual Blueprints
 * @description Blueprints are organizational containers that group related resources like bots, datasets, skillsets, and integrations into reusable templates, enabling efficient management and sharing of complex conversational AI configurations.
 * @category Blueprints
 * @tags blueprint, organization, template
 * @index 1
 *
 * Blueprints serve as powerful organizational tools for managing complex conversational AI setups. They allow you to group multiple related resources together, making it easier to organize, clone, and share complete AI configurations across your organization or with other users.
 *
 * A blueprint acts as a container that can hold various resources including bots, datasets, skillsets, abilities, secrets, files, portals, and integrations. This makes blueprints ideal for creating reusable templates, managing multi-component AI solutions, and maintaining consistent configurations across different deployments.
 *
 * Blueprints can also be used as a means to create projects and manage resources like projects. By organizing related components within a blueprint, you can effectively treat it as a project workspace where all associated resources are logically grouped together, making project management and resource allocation more efficient and structured.
 *
 * ## Creating Blueprints
 *
 * Creating a blueprint is the first step in organizing your AI resources into a manageable, reusable structure. A blueprint requires basic information including a name and description, and you can control its visibility to determine who can access it.
 *
 * To create a blueprint, provide the essential metadata and specify the visibility level. The visibility setting determines whether the blueprint is private to your account, shared with your organization, or publicly accessible:
 *
 * ```http
 * POST /api/v1/blueprint/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Template",
 *   "description": "Complete customer support setup with bot, knowledge base, and integrations",
 *   "visibility": "private"
 * }
 * ```
 *
 * The visibility parameter accepts two values:
 * - `private`: Only accessible by the creator
 * - `protected`: Accessible by organization members
 *
 * **Note:** The `public` visibility option is currently reserved for future use and not available.
 *
 * Once created, you can add resources to the blueprint by specifying the blueprint ID when creating bots, datasets, and other resources. This creates a logical grouping that makes it easier to manage related components as a cohesive unit.
 *
 * **Important:** After creation, you'll receive a blueprint ID that you should use when creating associated resources. This ensures all components are properly linked within the blueprint structure.
 */
