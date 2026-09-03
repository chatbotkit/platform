// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { makeJsonSafe } from '@/lib/struct'
import { withChildUserSession } from '@/lib/user.handler'

/**
 * @swagger
 *
 * /user/{userId}/context/{contextId}/fetch:
 *   get:
 *     operationId: fetchUserContext
 *     summary: Fetch a user context
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user
 *           type: string
 *       - in: path
 *         name: contextId
 *         required: true
 *         schema:
 *           description: The ID of the context to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The context was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     blueprintId:
 *                       type: string
 *                     botId:
 *                       type: string
 *                     datasetId:
 *                       type: string
 *                     skillsetId:
 *                       type: string
 *                     contactId:
 *                       type: string
 *                     payload:
 *                       type: object
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withChildUserSession(async function (req, session) {
    const context = await prisma.context.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'contextId'),
      {
        select: {
          // identifiers

          id: true,

          userId: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,
          botId: true,
          datasetId: true,
          skillsetId: true,
          contactId: true,

          // resource specific

          payload: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!context) {
      return notFound()
    }

    if (context.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (context).userId)

    return ok(makeJsonSafe(context))
  })
)

/**
 * @manual User Contexts
 * @index 25
 *
 * ## Fetching a Single User Context
 *
 * Retrieve a single context by its ID within a user's account. This
 * endpoint is useful when you need the full details of a specific context,
 * including its linked resource IDs and the custom payload object, without
 * loading the entire list.
 *
 * ```http
 * GET /api/v1/user/{userId}/context/{contextId}/fetch
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * The response returns the full context record including `id`, `name`,
 * `description`, `blueprintId`, `botId`, `datasetId`, `skillsetId`, `payload`,
 * `meta`, `createdAt`, and `updatedAt`. Resource ID fields that were not set
 * during creation will be `null`.
 *
 * **Authorization:** The context must belong to the user identified by
 * the `userId` path parameter. Attempting to fetch a context that belongs to
 * a different user will return a `401 Not Authorized` error.
 */
