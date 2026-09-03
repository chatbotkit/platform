// @ts-check
import prisma from '@/prisma/client'
import { PortalConfig } from '@/prisma/zod'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import slugSchema from '@/schemas/slug'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  slug: slugSchema,

  config: schema.object().zodSchema(PortalConfig).allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /portal/{portalId}/update:
 *   post:
 *     operationId: updatePortal
 *     summary: Update portal
 *     tags:
 *       - Portal
 *     parameters:
 *       - in: path
 *         name: portalId
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
 *                   slug:
 *                     description: The slug for the portal
 *                     type: string
 *                   config:
 *                     description: The config for the portal
 *                     type: object
 *                     additionalProperties: true
 *     responses:
 *       200:
 *         description: The portal was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated portal
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

        slug,

        config,

        meta,
      } = body

      const portal = await prisma.portal.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'portalId')
      )

      if (!portal) {
        return notFound()
      }

      if (portal.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.portal.update({
        where: {
          id: portal.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          // resource specific

          slug,

          config,

          // meta and others

          meta: getMeta(meta, portal.meta),
        },
      })

      return ok({ id: portal.id })
    })
  )
)

/**
 * @manual Portals
 * @index 30
 *
 * ## Updating Portals
 *
 * Updating a portal allows you to modify its configuration, appearance, and
 * resource associations without disrupting existing access. This flexibility
 * enables you to refine portal settings over time as requirements evolve,
 * update branding elements, or adjust which resources are accessible through
 * the portal.
 *
 * Portal updates support modifying most properties including the name,
 * description, blueprint association, slug, and configuration object. You
 * can update individual properties or multiple properties in a single
 * request, and only the properties you specify will be modified while
 * others remain unchanged.
 *
 * ```http
 * POST /api/v1/portal/{portalId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Portal Name",
 *   "description": "New description reflecting updated purpose",
 *   "config": {
 *     "theme": "dark",
 *     "branding": {
 *       "logo": "https://example.com/new-logo.png",
 *       "primaryColor": "#4F46E5"
 *     }
 *   }
 * }
 * ```
 *
 * **Slug Updates:** While you can update the slug property, be cautious when
 * doing so as it changes the portal's access URL. Any existing links or
 * integrations using the old slug will need to be updated. Consider the
 * impact on users and systems that may be accessing the portal through its
 * URL before changing the slug.
 *
 * **Blueprint Changes:** Updating the blueprintId allows you to change which
 * blueprint (if any) the portal is associated with. This can affect which
 * resources are accessible through the portal and what configurations are
 * inherited. Set blueprintId to null to remove the blueprint association
 * entirely.
 *
 * **Configuration Merging:** The config object is replaced entirely with
 * each update - it is not merged with the existing configuration. If you
 * want to preserve existing configuration values while adding new ones,
 * you must include all desired configuration in the update request.
 *
 * **Metadata Updates:** The meta property supports partial updates, meaning
 * you can update specific metadata fields without affecting others. This is
 * useful for maintaining custom properties like tags, categories, or
 * integration identifiers without having to resend the entire metadata
 * object.
 */
