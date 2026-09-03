// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /space/{spaceId}/site/list:
 *   get:
 *     operationId: listSpaceSites
 *     summary: List space sites
 *     tags:
 *       - Space Site
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the sites by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of sites was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceRefProperties'
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           slug:
 *                             description: The subdomain slug of the site
 *                             type: string
 *                           prefix:
 *                             description: The folder prefix inside the space
 *                             type: string
 *                           index:
 *                             description: Directory index filename
 *                             type: string
 *                           notFound:
 *                             description: Not found filename
 *                             type: string
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1space~1{spaceId}~1site~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
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
        throwNotFound()
      }

      if (space.userId !== session.user.id) {
        throwNotAuthorized()
      }

      const sites = await prisma.spaceSite.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            { spaceId: space.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').SpaceSite>} */ (
              getFieldQueryFilter
            )(req, ['slug']),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

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
      })

      return {
        items: makeJsonSafe(sites),
      }
    })
  )
)

/**
 * @manual Space Sites
 * @index 20
 *
 * ## Listing Sites
 *
 * Retrieve a paginated list of all sites in your space. This endpoint supports cursor-based pagination and filtering by metadata or slug.
 *
 * ```http
 * GET /api/v1/space/{spaceId}/site/list?order=desc&take=20
 * ```
 *
 * **Response:**
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "site_abc123def456",
 *       "alias": "main-site",
 *       "name": "My App Site",
 *       "description": "Production site for my application",
 *       "slug": "myapp",
 *       "prefix": "/app",
 *       "index": "index.html",
 *       "notFound": "404.html",
 *       "createdAt": "2025-06-24T10:30:00Z",
 *       "updatedAt": "2025-06-24T10:30:00Z"
 *     }
 *   ],
 *   "cursor": "eyJpZCI6InNpdGVfYWJjMTIzIn0="
 * }
 * ```
 *
 * **Query Parameters:**
 *
 * - **cursor**: Pagination cursor from the previous response to fetch the next page
 * - **order**: Sort order for results (`asc` or `desc`, default: `desc`)
 * - **take**: Number of items to retrieve per page (typically 10-100)
 * - **meta**: Filter sites by metadata key-value pairs (supports `?meta[key]=value` syntax)
 *
 * **Response Format:**
 *
 * - **items**: Array of site objects with all configuration details
 * - **cursor**: Pagination token for fetching the next page of results
 *
 * **Pagination Notes:**
 *
 * - Always check if the returned cursor is present before making the next request
 * - When cursor is empty or missing, you've reached the end of the list
 * - Use the `take` parameter to control page size based on your needs
 * - Results are returned in reverse chronological order by default
 */
