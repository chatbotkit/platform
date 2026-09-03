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
 * /user/{userId}/fetch:
 *   get:
 *     operationId: fetchUser
 *     summary: Fetch a user
 *     tags:
 *       - User
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           description: The ID of the user to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The user was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     image:
 *                       description: The image of the user
 *                       type: string
 *                     email:
 *                       description: The email of the user
 *                       type: string
 *                     limits:
 *                       $ref: '#/components/schemas/Limits'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const user = await prisma.user.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'userId'),
      {
        select: {
          // identifiers

          id: true,

          // basic information

          name: true,

          // resource linking

          parentId: true,

          // resource specific

          image: true,

          parentContextEmail: true,

          limits: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!user) {
      return notFound()
    }

    if (user.parentId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (user).parentId)

    const { parentContextEmail, ...thisUser } = user

    return ok(
      makeJsonSafe({
        ...thisUser,

        email: parentContextEmail,
      })
    )
  })
)

/**
 * @manual Users
 *
 * ## Fetching User Details
 *
 * To retrieve detailed information about a specific user,
 * send a GET request to the user fetch endpoint with the user's ID.
 * This operation returns comprehensive information about the user,
 * including all configuration settings, limits, and metadata.
 *
 * Fetching individual user details is useful when you need to display
 * account information, verify configuration settings, or prepare data for
 * update operations. The endpoint provides a complete snapshot of the
 * user's current state without including sensitive authentication
 * credentials.
 *
 * ```http
 * GET /api/v1/user/{userId}/fetch
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 *
 * The response includes the user's ID, name, description, profile
 * image, contact email, resource limits, custom metadata, and timestamp
 * information. This data can be used to populate forms for editing, display
 * account dashboards, or validate user configurations.
 *
 * **Use Case:** When building a customer-account dashboard, use this endpoint
 * to load detailed information when an operator selects a User from the list.
 * This allows you to show comprehensive account details
 * and provide edit functionality without loading all data upfront.
 */
