// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { assertSpaceSiteSlug, normalizeSpaceSiteSlug } from '@/lib/space.site'

import aliasSchema from '@/schemas/alias'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import spaceSiteSlugSchema from '@/schemas/spaceSiteSlug'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  // site address

  slug: spaceSiteSlugSchema,

  // serving config

  prefix: schema.string().allow(null, '').max(1024),
  index: schema.string().min(1).max(256),
  notFound: schema.string().min(1).max(256),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /space/{spaceId}/site/{siteId}/update:
 *   post:
 *     operationId: updateSpaceSite
 *     summary: Update a space site
 *     tags:
 *       - Space Site
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: siteId
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
 *               - type: object
 *                 properties:
 *                   slug:
 *                     description: The subdomain slug beneath the configured space apex
 *                     type: string
 *                   prefix:
 *                     description: Optional folder prefix inside the space to serve from
 *                     type: string
 *                   index:
 *                     description: Directory index filename
 *                     type: string
 *                   notFound:
 *                     description: Not found filename
 *                     type: string
 *     responses:
 *       200:
 *         description: The site was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated site
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

        slug,

        prefix,
        index,
        notFound: notFoundFile,

        meta,
      } = body

      const space = await prisma.space.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'spaceId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!space) {
        return notFound()
      }

      if (space.userId !== session.user.id) {
        return notAuthorized()
      }

      const site = await prisma.spaceSite.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'siteId'),
        {
          select: {
            id: true,
            userId: true,
            spaceId: true,
            meta: true,
          },
        }
      )

      if (!site || site.spaceId !== space.id) {
        return notFound()
      }

      if (site.userId !== session.user.id) {
        return notAuthorized()
      }

      let normalizedSlug

      if (slug !== undefined) {
        normalizedSlug = normalizeSpaceSiteSlug(slug)

        assertSpaceSiteSlug(normalizedSlug)
      }

      await prisma.spaceSite.update({
        where: {
          id: site.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // site address

          slug: normalizedSlug,

          // serving config

          prefix,
          index,
          notFound: notFoundFile,

          // meta and others

          meta: getMeta(meta, site.meta),
        },
      })

      return ok({ id: site.id })
    })
  )
)

/**
 * @manual Space Sites
 * @index 30
 *
 * ## Updating a Site
 *
 * Modify the slug, serving files, and metadata of an existing site.
 *
 * ```http
 * POST /api/v1/space/{spaceId}/site/{siteId}/update
 * Content-Type: application/json
 *
 * {
 *   "slug": "new-site",
 *   "prefix": "/v2",
 *   "index": "home.html",
 *   "notFound": "error.html"
 * }
 * ```
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "site_abc123def456"
 * }
 * ```
 *
 * **Updateable Fields:**
 *
 * - **slug**: Change the subdomain slug (must remain unique)
 * - **prefix**: Modify the path prefix within the space
 * - **index**: Update the directory index filename
 * - **notFound**: Change the not-found error page
 * - **name**: Update the site display name
 * - **description**: Change the site description
 * - **alias**: Update the reference identifier
 * - **meta**: Update or add metadata
 *
 * **Important Considerations:**
 *
 * - Changing the slug changes the site URL, so existing links will break
 * - The new slug must be available across the deployment
 * - Index and notFound files must exist in your space after updating
 * - Partial updates are supported - only include fields you want to change
 * - All string fields can be set to null or empty string to clear them (except slug)
 *
 * **Best Practices:**
 *
 * - Plan slug changes during low-traffic periods
 * - Test configuration changes on a staging site before production
 * - Keep descriptive names and descriptions for easier management
 * - Use custom metadata for organizing related sites
 */
