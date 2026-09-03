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
 * /space/{spaceId}/fetch:
 *   get:
 *     operationId: fetchSpace
 *     summary: Fetch a space
 *     tags:
 *       - Space
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           description: The ID of the space to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The space was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     contactId:
 *                       description: The contact associated with the space
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
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          blueprintId: true,

          contactId: true,

          // resource specific

          // @todo add here

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!space) {
      return notFound()
    }

    if (space.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (space).userId)

    return ok(makeJsonSafe(space))
  })
)

/**
 * @manual Spaces
 * @index 20
 *
 * ## Fetching a Space
 *
 * Retrieving detailed information about a specific space is a common operation
 * when building applications that need to display or work with space
 * configuration and metadata. The fetch endpoint provides complete space
 * details including all associated properties and relationships.
 *
 * When fetching a space, you receive the full set of space properties including
 * its unique identifier, name, description, any associated contact relationships,
 * custom metadata, and timestamp information for creation and last update.
 * This comprehensive data enables you to build detailed space management
 * interfaces and make informed decisions about space operations.
 *
 * To retrieve a specific space by its identifier:
 *
 * ```http
 * GET /api/v1/space/{spaceId}/fetch
 * ```
 *
 * For example, fetching a space with ID `space_abc123`:
 *
 * ```http
 * GET /api/v1/space/space_abc123/fetch
 * ```
 *
 * The response includes all space details:
 *
 * ```json
 * {
 *   "id": "space_abc123",
 *   "name": "Customer Support - ACME Corp",
 *   "description": "Dedicated space for ACME Corporation support operations",
 *   "contactId": "contact_xyz789",
 *   "meta": {
 *     "department": "support",
 *     "priority": "high"
 *   },
 *   "createdAt": "2025-01-01T10:00:00.000Z",
 *   "updatedAt": "2025-01-05T14:30:00.000Z"
 * }
 * ```
 */
