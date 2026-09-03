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
 * /portal/{portalId}/fetch:
 *   get:
 *     operationId: fetchPortal
 *     summary: Fetch a portal
 *     tags:
 *       - Portal
 *     parameters:
 *       - in: path
 *         name: portalId
 *         required: true
 *         schema:
 *           description: The ID of the portal to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The portal was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     slug:
 *                       description: The slug of the portal
 *                       type: string
 *                     config:
 *                       description: The config of the portal
 *                       type: object
 *                       additionalProperties: true
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const portal = await prisma.portal.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'portalId'),
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

          slug: true,

          config: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!portal) {
      return notFound()
    }

    if (portal.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (portal).userId)

    return ok(makeJsonSafe(portal))
  })
)

/**
 * @manual Portals
 * @index 20
 *
 * ## Fetching a Portal
 *
 * Retrieving detailed information about a specific portal allows you to
 * inspect its current configuration, verify its settings, and obtain the
 * data needed for management operations or display in administrative
 * interfaces.
 *
 * The fetch operation returns complete portal information including all
 * configuration details, associated blueprint references, metadata, and
 * timestamps. This is particularly useful when you need to verify portal
 * settings before making updates or when building management interfaces
 * that display portal details to administrators.
 *
 * ```http
 * GET /api/v1/portal/{portalId}/fetch
 * Content-Type: application/json
 * ```
 *
 * Replace `{portalId}` with either the portal's unique identifier (ID) or
 * its slug. The platform supports both forms of identification, making it
 * convenient to fetch portals using whichever identifier you have available
 * in your application context.
 *
 * **Response Structure:** The returned portal object includes all properties
 * set during creation and any subsequent updates, including:
 * - Basic information: name, description
 * - Portal identifiers: id, slug
 * - Resource associations: blueprintId (if configured)
 * - Configuration: config object with all portal settings
 * - Metadata: meta object with custom properties
 * - Timestamps: createdAt, updatedAt
 *
 * **Common Use Cases:**
 * - Displaying portal details in administrative dashboards
 * - Verifying portal configuration before updates
 * - Auditing portal settings and access patterns
 * - Building portal management interfaces
 * - Troubleshooting portal-related issues
 */
