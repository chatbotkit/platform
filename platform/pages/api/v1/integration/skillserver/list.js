// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/skillserver/list:
 *   get:
 *     operationId: listSkillServerIntegrations
 *     summary: List SkillServer integrations
 *     tags:
 *       - SkillServer Integration
 *     parameters:
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
 *           description: Key-value pairs to filter by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of SkillServer integrations was retrieved successfully
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
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - type: object
 *                         properties:
 *                           skillsetId:
 *                             description: The ID of the skillset
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
 *                       $ref: '#/paths/~1integration~1skillserver~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const skillserverIntegrations =
        await prisma.skillserverIntegration.findMany({
          where: {
            AND: [
              { userId: session.user.id },

              ...getMetaQueryFilter(req),

              ...getBlueprintIdQueryFilter(req),
            ],
          },

          ...getCursorConstraints(req, cursor),

          ...getTakeConstraints(req),

          select: {
            // identifiers

            id: true,

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            blueprintId: true,

            skillsetId: true,

            // resource specific

            // accessToken: true, // disabled for security reasons

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        })

      return {
        items: makeJsonSafe(skillserverIntegrations),
      }
    })
  )
)

/**
 * @manual SkillServer Integration
 * @category Integrations
 * @index 41
 *
 * ## Listing SkillServer Integrations
 *
 * Retrieve a paginated list of your SkillServer integrations to inventory which
 * skillsets you have exposed as text-first HTTP skill servers and review their
 * configuration.
 *
 * ```http
 * GET /api/v1/integration/skillserver/list
 * ```
 *
 * The endpoint supports cursor-based pagination (`cursor`, `take`, `order`) and
 * filtering by `blueprintId` and `meta`. The static access token is never
 * returned by the list endpoint for security reasons; fetch a single
 * integration as a user-audience session to retrieve it.
 */
