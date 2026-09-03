// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /contact/{contactId}/space/list:
 *   get:
 *     operationId: listContactSpaces
 *     summary: List contact spaces
 *     tags:
 *       - Contact Space
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to list spaces for
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
 *         description: The list of spaces was retrieved successfully
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
 *                           contactId:
 *                             description: The contact id assigned to this space
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
 *                       $ref: '#/paths/~1contact~1{contactId}~1space~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const contact = await prisma.contact.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'contactId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!contact) {
        throwNotFound()
      }

      if (contact.userId !== session.user.id) {
        throwNotAuthorized()
      }

      const spaces = await prisma.space.findMany({
        where: {
          AND: [{ contactId: contact.id }, ...getMetaQueryFilter(req)],
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

          blueprintId: true,

          contactId: true,

          // resource specific

          // @todo add here

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(spaces),
      }
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Listing Contact Spaces
 *
 * The contact spaces listing endpoint retrieves all workspace spaces associated
 * with a specific contact, enabling you to discover and access the shared
 * environments where contact interactions occur. Spaces represent isolated
 * workspaces that can contain conversations, tasks, memories, and other
 * resources linked to particular contacts, providing organizational boundaries
 * for multi-tenant or segmented applications.
 *
 * Understanding a contact's associated spaces is crucial for applications that
 * organize interactions by workspace, team, or organizational unit. This
 * endpoint allows you to enumerate all spaces where a contact has activity,
 * facilitating workspace-aware conversation routing, resource isolation, and
 * context-specific interactions. Each space maintains its own set of resources
 * and configurations, ensuring proper separation of concerns across different
 * organizational contexts.
 *
 * The listing operation supports standard pagination with cursor-based
 * iteration, allowing efficient traversal of large collections of spaces. You
 * can also filter spaces using metadata queries, enabling sophisticated space
 * discovery based on custom attributes such as workspace type, organizational
 * unit, or business-specific classifications.
 *
 * ### Retrieving Contact Spaces
 *
 * To list all spaces associated with a contact:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/space/list
 * ```
 *
 * Replace `{contactId}` with the actual contact identifier. The response
 * includes basic space information including identifiers, names, descriptions,
 * and timestamps.
 *
 * ### Pagination and Ordering
 *
 * The endpoint supports cursor-based pagination for efficient traversal:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/space/list?take=20&order=desc
 * ```
 *
 * - **cursor**: Continuation token from the previous response for pagination
 * - **order**: Sort order, either `asc` or `desc` (default: `desc`)
 * - **take**: Number of items to retrieve per page
 *
 * Cursor-based pagination ensures consistent results even as spaces are added
 * or modified during traversal, preventing duplicate or missing items in
 * paginated result sets.
 *
 * ### Metadata Filtering
 *
 * You can filter spaces by metadata attributes:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/space/list?meta.workspace_type=team
 * ```
 *
 * Metadata filtering allows sophisticated space discovery based on custom
 * classification schemes. Common filtering scenarios include:
 *
 * - Finding spaces for specific organizational units
 * - Identifying spaces with particular configuration flags
 * - Filtering by workspace type or category
 * - Selecting spaces based on business-specific attributes
 *
 * ### Response Structure
 *
 * The response contains an array of space objects:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "space-abc123",
 *       "name": "Customer Support Team",
 *       "description": "Primary support workspace",
 *       "contactId": "contact-xyz789",
 *       "meta": {
 *         "workspace_type": "team",
 *         "department": "support"
 *       },
 *       "createdAt": "2024-01-15T10:30:00Z",
 *       "updatedAt": "2024-01-20T14:45:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * Each space includes its unique identifier, descriptive information, the
 * contact association, optional metadata, and timestamp information for
 * tracking creation and modification dates.
 *
 * ### Authorization and Access Control
 *
 * Only the contact owner can list spaces associated with their contacts. The
 * endpoint verifies that the authenticated user owns the specified contact
 * before returning any space information, ensuring proper data isolation and
 * access control across different user accounts.
 *
 * ### Use Cases for Contact Space Listing
 *
 * Enumerating contact spaces supports various organizational scenarios:
 *
 * - **Workspace Discovery**: Identifying all workspaces where a contact has
 *   interactions
 * - **Context Routing**: Directing conversations to appropriate workspace-
 *   specific bots or resources
 * - **Multi-tenant Applications**: Managing contact interactions across
 *   different organizational units
 * - **Resource Isolation**: Ensuring conversations and resources remain
 *   properly segmented by workspace
 * - **Workspace Analytics**: Understanding contact activity distribution
 *   across different spaces
 * - **Organizational Reporting**: Generating reports on contact engagement
 *   by workspace or team
 *
 * **Important Notes:**
 *
 * - Only contact owners can access space listings
 * - Spaces provide organizational boundaries for resources
 * - Pagination cursors remain valid during active traversal
 * - Metadata filtering supports standard equality operators
 * - Empty result sets indicate no spaces associated with the contact
 */
