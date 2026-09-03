// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
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

  slug: spaceSiteSlugSchema.required(),

  // serving config

  prefix: schema.string().allow(null, '').max(1024),
  index: schema.string().min(1).max(256),
  notFound: schema.string().min(1).max(256),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /space/{spaceId}/site/create:
 *   post:
 *     operationId: createSpaceSite
 *     summary: Create a space site
 *     tags:
 *       - Space Site
 *     parameters:
 *       - in: path
 *         name: spaceId
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
 *                 required:
 *                   - slug
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
 *                     default: index.html
 *                   notFound:
 *                     description: Not found filename
 *                     type: string
 *                     default: 404.html
 *     responses:
 *       200:
 *         description: The site was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created site
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

      const normalizedSlug = normalizeSpaceSiteSlug(slug)

      assertSpaceSiteSlug(normalizedSlug)

      const { id } = await prisma.spaceSite.create({
        data: {
          userId: session.user.id,

          // attachment

          spaceId: space.id,

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
 * @manual Space Sites
 * @description Space Sites publish space content beneath the configured site apex.
 * @category Resources/Spaces
 * @tags space, site, slug
 * @index 10
 *
 * A space site publishes content at `<slug>.<space apex>` with optional path prefixes and custom error pages.
 *
 * ## Creating a Site
 *
 * Specify the globally unique slug used beneath the configured space apex, along with optional serving configuration.
 *
 * ```http
 * POST /api/v1/space/{spaceId}/site/create
 * Content-Type: application/json
 *
 * {
 *   "slug": "myapp",
 *   "name": "My App Site",
 *   "description": "Production site for my application",
 *   "prefix": "/app",
 *   "index": "index.html",
 *   "notFound": "404.html",
 *   "alias": "main-site"
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
 * **Parameters:**
 *
 * - **slug** (required): The DNS-label slug used in `<slug>.<space apex>`
 * - **name**: Human-readable name for the site
 * - **description**: Detailed description of the site's purpose
 * - **prefix**: Optional path prefix within the space to serve from (e.g., `/app`). Useful when hosting multiple sites from one space.
 * - **index**: Default directory index file (default: `index.html`). Used when users access the site without a specific file.
 * - **notFound**: Filename to serve for not-found errors (default: `404.html`). Returns HTTP 404 when accessed.
 * - **alias**: Optional reference identifier for your site
 * - **meta**: Optional key-value metadata object
 *
 * **Important Notes:**
 *
 * - Slugs are unique across the deployment
 * - Custom domains are not supported
 * - Path prefixes are useful for organizing multiple sites within a single space
 * - Both index and notFound files must exist in your space content
 */
