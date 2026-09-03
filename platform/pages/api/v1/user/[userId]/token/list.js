// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { makeJsonSafe } from '@/lib/struct'
import { withChildUserSession } from '@/lib/user.handler'

/**
 * @swagger
 *
 * /user/{userId}/token/list:
 *   get:
 *     operationId: listUserTokens
 *     summary: List user tokens
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
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
 *     responses:
 *       200:
 *         description: The list of user tokens was retrieved successfully
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
 *                       $ref: '#/paths/~1user~1{userId}~1token~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withChildUserSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const tokens = await prisma.token.findMany({
        where: {
          AND: [{ userId: session.user.id }, ...getMetaQueryFilter(req)],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(tokens),
      }
    })
  )
)

/**
 * @manual User Tokens
 *
 * ## Listing User Tokens
 *
 * You can retrieve a list of all API tokens belonging to a specific child
 * User by sending a GET request to the user token list
 * endpoint. This operation returns paginated results showing all tokens that
 * have been created for the specified user, allowing you to audit
 * API access and manage token lifecycle.
 *
 * The list endpoint provides essential information about each token including
 * its ID, name, description, metadata, and timestamps for creation and last
 * update. However, for security reasons, the actual token values are never
 * returned in list operations - they are only provided once during token
 * creation.
 *
 * ```http
 * GET /api/v1/user/{userId}/token/list?take=50&order=desc
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * This endpoint is particularly useful when building administrative interfaces
 * for managing customer API access, auditing token usage, or implementing
 * token rotation workflows. You can display a list of active tokens with
 * their creation dates and metadata to help parent users track which tokens are
 * being used for what purposes.
 *
 * **Security Audit:** Regularly listing user tokens allows you to identify
 * unused or orphaned tokens that should be deleted. Long-lived tokens that
 * haven't been rotated represent potential security risks and should be
 * reviewed periodically. Consider implementing automated alerts for tokens
 * that are older than your organization's security policy allows.
 *
 * **Best Practice:** Implement a naming convention for user tokens that
 * indicates their purpose and associated application or integration. For
 * example, use names like "Production API Integration" or "Staging Environment
 * Access" to make token management more intuitive and reduce the risk of
 * accidentally deleting active tokens.
 */
