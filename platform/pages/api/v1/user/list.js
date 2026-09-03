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
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /user/list:
 *   get:
 *     operationId: listUsers
 *     summary: List users
 *     tags:
 *       - User
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
 *           description: Key-value pairs to filter the users by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of users was retrieved successfully
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
 *                         properties:
 *                           image:
 *                             description: The image of the user
 *                             type: string
 *                           email:
 *                             description: The email of the user
 *                             type: string
 *                           limits:
 *                             $ref: '#/components/schemas/Limits'
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
 *                       $ref: '#/paths/~1user~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const users = await prisma.user.findMany({
        where: {
          AND: [
            { parentId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').User>} */ (
              getFieldQueryFilter
            )(req, [['parentContextEmail', 'email']]),
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

          // resource specific

          image: true,

          parentContextEmail: true,

          limits: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(
          users.map(({ parentContextEmail, ...thisUser }) => {
            return {
              ...thisUser,

              email: parentContextEmail,
            }
          })
        ),
      }
    })
  )
)

/**
 * @manual Users
 *
 * ## Listing Users
 *
 * You can retrieve a list of all child users associated with
 * your parent user by sending a GET request to the user list
 * endpoint. This operation returns paginated results, allowing you to
 * efficiently manage large numbers of customer accounts.
 *
 * The list endpoint supports pagination through cursor-based navigation,
 * enabling you to retrieve results in manageable chunks. You can control the
 * order of results (ascending or descending by creation date) and specify how
 * many items to retrieve per request using query parameters.
 *
 * ```http
 * GET /api/v1/user/list?take=50&order=desc
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * Each child User in the response includes basic information such as
 * ID, name, profile image, contact email, configured limits, metadata, and
 * timestamps for when the account was created and last updated. This
 * information allows you to build comprehensive dashboards and management
 * interfaces for your multi-user solution.
 *
 * The response also includes pagination metadata when applicable, providing
 * cursors for fetching the next page of results. This is particularly useful
 * when building user interfaces that need to display large lists of customer
 * accounts with smooth scrolling or pagination controls.
 *
 * **Best Practice:** Implement caching strategies for user lists when
 * building dashboards or management interfaces. Consider storing frequently
 * accessed user data locally and refreshing it periodically or when
 * updates occur, rather than fetching the entire list on every page load.
 *
 * **Note:** The list endpoint only returns child Users that belong to the
 * current parent User. You cannot access Users from other parent Users,
 * ensuring complete isolation between account hierarchies.
 */
