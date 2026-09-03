// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import contactIdSchema from '@/schemas/contactId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  contactId: contactIdSchema('use'),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /space/create:
 *   post:
 *     operationId: createSpace
 *     summary: Create space
 *     tags:
 *       - Space
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
 *                   contactId:
 *                     type: string
 *                     description: The contact associated with the space
 *     responses:
 *       200:
 *         description: The space was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created space
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

        blueprintId: blueprint,

        contactId: contact,

        meta,
      } = body

      const { id } = await prisma.space.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          contactId: contact?.id,

          // resource specific

          // @todo add here

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
 * @manual Spaces
 * @description Spaces are collaborative environments that enable teams to organize and manage conversations, contacts, and shared resources in isolated workspaces.
 * @category Resources/Spaces
 * @tags space, collaboration, workspace
 * @index 15
 *
 * Spaces provide a powerful way to organize your conversational AI resources
 * into distinct, isolated environments. Each space acts as a container for
 * conversations, contacts, and other related resources, allowing teams to
 * maintain separate contexts for different projects, clients, or use cases.
 *
 * ## Creating Spaces
 *
 * Creating a space is the foundational step in organizing your conversational
 * resources into isolated workspaces. Each space can be configured with a
 * meaningful name and description to help team members understand its purpose
 * and scope.
 *
 * To create a new space, send a POST request with the space details:
 *
 * ```http
 * POST /api/v1/space/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support - ACME Corp",
 *   "description": "Dedicated space for ACME Corporation support operations",
 *   "blueprintId": "blueprint_xyz789",
 *   "contactId": "contact_abc123",
 *   "meta": {
 *     "department": "support",
 *     "priority": "high"
 *   }
 * }
 * ```
 *
 * The API returns the unique identifier for the newly created space, which
 * you use to manage conversations, configure space-specific settings, and
 * share the workspace with contacts.
 *
 * ## Space Sharing and Collaboration
 *
 * Spaces support sharing with contacts, enabling collaborative workflows where
 * end users (represented as contacts) can participate in the same isolated
 * workspace. You establish this relationship by providing a `contactId` when
 * creating or updating a space.
 *
 * Once a contact is associated with a space, the contact's conversations,
 * tasks, and memories can be organized within that shared workspace context.
 * This contact-space relationship is the foundation for multi-participant
 * scenarios such as team collaboration, client portals, and segmented support
 * workflows.
 *
 * To create a space shared with a specific contact:
 *
 * ```http
 * POST /api/v1/space/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Project Alpha Workspace",
 *   "description": "Shared workspace for Project Alpha team",
 *   "contactId": "contact_alice123",
 *   "meta": {
 *     "project": "alpha",
 *     "team": "engineering"
 *   }
 * }
 * ```
 *
 * You can retrieve all spaces associated with a given contact using the
 * `/api/v1/contact/{contactId}/space/list` endpoint. This makes it easy to
 * build workspace-aware routing, context-specific bots, and per-workspace
 * analytics.
 *
 * **Contact-Space Association:**
 * - One contact can be linked to multiple spaces
 * - A space holds a reference to one contact at a time via `contactId`
 * - Update the `contactId` on a space to reassign it to a different contact
 * - Set `contactId` to `null` via update to remove the association
 *
 * ## Blueprint-Based Workspace Templates
 *
 * The `blueprintId` field associates a space with a blueprint, enabling
 * templated workspace deployments. When you clone a blueprint, all spaces
 * linked to it are replicated as part of the deployment, preserving your
 * workspace structure across different projects, clients, or environments.
 *
 * This is particularly useful for agencies or SaaS applications that need
 * to provision identical workspace configurations for each new customer:
 *
 * ```http
 * POST /api/v1/space/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Onboarding Workspace",
 *   "blueprintId": "blueprint_onboarding_template",
 *   "meta": {
 *     "client": "acme-corp",
 *     "tier": "enterprise"
 *   }
 * }
 * ```
 *
 * ## Using Metadata for Organization
 *
 * Custom metadata (`meta`) lets you attach arbitrary key-value pairs to a
 * space for organization, filtering, and integration with external systems.
 * Use metadata to tag spaces by department, project, environment, or any
 * other business-specific classification:
 *
 * ```json
 * {
 *   "meta": {
 *     "environment": "production",
 *     "region": "us-east",
 *     "tier": "enterprise",
 *     "owner": "team-alpha"
 *   }
 * }
 * ```
 *
 * Metadata is queryable via the list and export endpoints, enabling you to
 * filter spaces by any combination of metadata properties.
 */
