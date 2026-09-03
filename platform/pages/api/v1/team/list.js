// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
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
 * /team/list:
 *   get:
 *     operationId: listTeams
 *     summary: Retrieve a list of teams
 *     tags:
 *       - Team
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
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of teams was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties: {}
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
 *                       $ref: '#/paths/~1team~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const teams = await prisma.team.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          // resource specific

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(teams),
      }
    })
  )
)

/**
 * @manual Teams
 * @description Teams enable collaborative resource management by allowing you to organize and share bots, datasets, integrations, and other platform resources with groups of users who work together on projects.
 * @category Collaboration
 * @tags teams, collaboration, sharing, groups
 * @index 1
 *
 * Teams provide a powerful way to collaborate on AI projects by creating
 * shared workspaces where multiple users can access and manage resources
 * collectively. When you create a team and add members, those team members
 * gain visibility and access to resources associated with the team,
 * streamlining collaboration without requiring individual resource sharing.
 *
 * This collaboration model is particularly valuable for organizations where
 * multiple people work on the same bots, datasets, or integrations. Instead
 * of duplicating resources or managing complex individual permissions, teams
 * provide a clean, organizational structure that naturally supports
 * collaborative workflows.
 *
 * ## Listing Your Teams
 *
 * You can retrieve a list of all teams you've created to view your
 * collaborative workspaces and understand how resources are organized across
 * different groups. The list includes team metadata, member information, and
 * creation timestamps to help you manage your team structure effectively.
 *
 * ```http
 * GET /api/v1/team/list
 * ```
 *
 * The response includes all teams where you are the owner, providing a
 * complete view of the collaborative workspaces you manage. Each team entry
 * includes its name, description, and any custom metadata you've attached for
 * organizational purposes.
 *
 * ### Team Organization Strategies
 *
 * Teams are commonly organized by:
 *
 * - **Project**: Separate teams for different customer projects or initiatives
 * - **Department**: Marketing, engineering, support, or other functional teams
 * - **Client**: Dedicated teams for managing resources for specific clients
 * - **Environment**: Development, staging, and production teams
 * - **Product Line**: Different teams for distinct product offerings
 *
 * By maintaining well-organized teams, you create clear boundaries for
 * resource access and simplify permission management as your organization
 * grows.
 *
 * ### Pagination Support
 *
 * For accounts managing many teams, the list endpoint supports cursor-based
 * pagination to efficiently handle large team collections:
 *
 * ```http
 * GET /api/v1/team/list?take=20&cursor={nextCursor}
 * ```
 *
 * You can also filter teams by metadata to quickly locate specific teams
 * based on tags or categorization you've applied. This is particularly useful
 * for large organizations with complex team structures.
 *
 * **Note**: Team functionality enables resource sharing and collaborative
 * workflows, but remember that resource-level permissions and access controls
 * still apply. Team membership provides visibility but doesn't automatically
 * grant modification permissions unless the resource's access settings permit
 * it.
 */
