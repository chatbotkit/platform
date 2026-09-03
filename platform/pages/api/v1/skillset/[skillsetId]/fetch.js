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
 * /skillset/{skillsetId}/fetch:
 *   get:
 *     operationId: fetchSkillset
 *     summary: Fetch a skillset
 *     tags:
 *       - Skillset
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           description: The ID of the skillset to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The skillset was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     visibility:
 *                       $ref: '#/components/schemas/SkillsetVisibility'
 *                     state:
 *                       $ref: '#/components/schemas/ResourceState'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const skillset = await prisma.skillset.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'skillsetId'),
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

          // resource specific

          visibility: true,

          // lifecycle

          state: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!skillset) {
      return notFound()
    }

    if (skillset.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (skillset).userId)

    return ok(makeJsonSafe(skillset))
  })
)

/**
 * @manual Skillsets
 *
 * ## Fetching Skillset Details
 *
 * Retrieving detailed information about a specific skillset allows you to
 * inspect its configuration, properties, and metadata. This is essential for
 * debugging, auditing, or displaying skillset information in your application's
 * user interface. The fetch operation returns complete details about the
 * skillset, including when it was created and last modified.
 *
 * When you fetch a skillset, you receive all of its properties including the
 * name, description, visibility settings, blueprint associations, and metadata.
 * However, the fetch operation does not include the list of abilities - you'll
 * need to use the ability list endpoint separately to retrieve those. This
 * separation allows for efficient querying when you only need the skillset's
 * basic information.
 *
 * ```http
 * GET /api/v1/skillset/{skillsetId}/fetch
 * ```
 *
 * The response includes timestamps that show when the skillset was created and
 * when it was last updated. These timestamps are useful for tracking changes,
 * implementing caching strategies, or displaying activity information to users.
 * The metadata field contains any custom data you've associated with the
 * skillset, which can be useful for storing application-specific information.
 *
 * **Response includes:**
 *
 * - Skillset ID and basic identification information
 * - Name and description for human-readable context
 * - Visibility settings that control access permissions
 * - Blueprint association for project organization
 * - Creation and modification timestamps
 * - Custom metadata if previously stored
 * - All configuration properties set during creation or updates
 */
