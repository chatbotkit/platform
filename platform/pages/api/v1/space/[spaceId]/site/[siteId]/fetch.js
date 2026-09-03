// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /space/{spaceId}/site/{siteId}/fetch:
 *   get:
 *     operationId: fetchSpaceSite
 *     summary: Fetch a space site
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
 *           description: The ID of the site to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The site was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     spaceId:
 *                       description: The space the site belongs to
 *                       type: string
 *                     slug:
 *                       description: The subdomain slug of the site
 *                       type: string
 *                     prefix:
 *                       description: The folder prefix inside the space
 *                       type: string
 *                     index:
 *                       description: Directory index filename
 *                       type: string
 *                     notFound:
 *                       description: Not found filename
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
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
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,
          spaceId: true,

          // site address

          slug: true,

          // serving config

          prefix: true,
          index: true,
          notFound: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!site || site.spaceId !== space.id) {
      return notFound()
    }

    if (site.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (site).userId)

    return ok(makeJsonSafe(site))
  })
)

/**
 * @manual Space Sites
 * @index 20
 *
 * ## Fetching a Single Site
 *
 * Retrieve detailed information about a specific site by its ID, including its slug and serving options.
 *
 * ```http
 * GET /api/v1/space/{spaceId}/site/{siteId}/fetch
 * ```
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "site_abc123def456",
 *   "spaceId": "space_xyz789",
 *   "alias": "main-site",
 *   "name": "My App Site",
 *   "description": "Production site for my application",
 *   "slug": "myapp",
 *   "prefix": "/app",
 *   "index": "index.html",
 *   "notFound": "404.html",
 *   "createdAt": "2025-06-24T10:30:00Z",
 *   "updatedAt": "2025-06-24T10:30:00Z"
 * }
 * ```
 *
 * **URL Parameters:**
 *
 * - **spaceId**: The ID or identifier of the space containing the site
 * - **siteId**: The ID or alias of the site to retrieve
 *
 * **Response Properties:**
 *
 * - **id**: Unique identifier for the site
 * - **spaceId**: The space this site belongs to
 * - **slug**: The subdomain slug beneath the configured space apex
 * - **prefix**: Path prefix within the space (if configured)
 * - **index**: Directory index filename
 * - **notFound**: Error page filename
 * - **name** and **description**: Metadata for organization
 * - **createdAt/updatedAt**: Timestamps for tracking changes
 *
 * **Error Cases:**
 *
 * - Returns `404` if the space or site doesn't exist
 * - Returns `401` if you don't have permission to access the space
 */
