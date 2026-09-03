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
 * /blueprint/{blueprintId}/fetch:
 *   get:
 *     operationId: fetchBlueprint
 *     summary: Fetch a blueprint
 *     tags:
 *       - Blueprint
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           description: The ID of the blueprint to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The blueprint was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     visibility:
 *                       $ref: '#/components/schemas/BlueprintVisibility'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const blueprint = await prisma.blueprint.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'blueprintId'),
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

          // resource specific

          config: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!blueprint) {
      return notFound()
    }

    if (blueprint.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (blueprint).userId)

    return ok(makeJsonSafe(blueprint))
  })
)

/**
 * @manual Blueprints
 * @index 15
 *
 * ## Fetching a Blueprint
 *
 * Retrieving a specific blueprint by its ID provides access to the blueprint's complete configuration and metadata. This is essential when you need to inspect blueprint details, verify configurations, or prepare for cloning or modification operations.
 *
 * To fetch a blueprint, make a GET request with the blueprint ID in the URL path. The response includes all blueprint properties including name, description, visibility settings, metadata, and timestamps:
 *
 * ```http
 * GET /api/v1/blueprint/{blueprintId}/fetch
 * ```
 *
 * The blueprint ID can be either the unique identifier (a string of characters like `bp_abc123`) or a slug-based identifier if one was configured. This flexibility makes it easier to reference blueprints in user-friendly ways.
 *
 * The fetched blueprint data includes:
 * - **id**: The unique blueprint identifier
 * - **name**: The blueprint's display name
 * - **description**: Detailed description of the blueprint's purpose
 * - **visibility**: Access control setting (private, protected, or public)
 * - **config**: UI configuration such as element positions and notes in the blueprint designer
 * - **meta**: Additional metadata and custom properties
 * - **createdAt**: Timestamp when the blueprint was created
 * - **updatedAt**: Timestamp of the last modification
 *
 * **Authorization:** You must be the owner of the blueprint to fetch it. Attempting to access a blueprint you don't own will result in an authorization error, even if you know the blueprint ID.
 */
