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
 * /contact/list:
 *   get:
 *     operationId: listContacts
 *     summary: List contacts
 *     tags:
 *       - Contact
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
 *         description: The list of contacts was retrieved successfully
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
 *                           fingerprint:
 *                             description: The fingerprint of the contact
 *                             type: string
 *                           email:
 *                             description: The email address of the contact
 *                             type: string
 *                           phone:
 *                             description: The phone number of the contact
 *                             type: string
 *                           nick:
 *                             description: The nickname of the contact
 *                             type: string
 *                           preferences:
 *                             description: The preferences of the contact
 *                             type: string
 *                           verifiedAt:
 *                             description: The timestamp (ms) when the contact was verified
 *                             type: number
 *                         required:
 *                           - fingerprint
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
 *                       $ref: '#/paths/~1contact~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const contacts = await prisma.contact.findMany({
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

          fingerprint: true,

          email: true,
          phone: true,

          nick: true,

          preferences: true,

          verifiedAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(contacts),
      }
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Listing Contacts
 *
 * The list contacts operation retrieves all contacts associated with your
 * account, enabling you to build contact management interfaces, perform bulk
 * operations, or analyze your user base. The endpoint supports cursor-based
 * pagination for efficiently handling large contact databases and includes
 * comprehensive filtering options through metadata queries.
 *
 * When listing contacts, you receive complete contact information including
 * all identifying attributes, preferences, verification status, and metadata.
 * The response is paginated to ensure optimal performance even with thousands
 * or millions of contacts, and you can control the page size and ordering to
 * suit your specific use case.
 *
 * The endpoint supports both ascending and descending order, allowing you to
 * retrieve contacts in chronological order (oldest first) or reverse
 * chronological order (newest first). This flexibility is particularly useful
 * when building user interfaces that need to display recently added contacts
 * or when performing sequential processing operations.
 *
 * ```http
 * GET /api/v1/contact/list?order=desc&take=50
 * ```
 *
 * For paginated results, use the cursor from the previous response:
 *
 * ```http
 * GET /api/v1/contact/list?cursor=contact_abc123&order=desc&take=50
 * ```
 *
 * You can also filter contacts using metadata queries, which is useful for
 * segmenting your contact database by custom attributes or tags. For example,
 * you might filter for premium customers, users from specific regions, or
 * contacts with certain preferences:
 *
 * ```http
 * GET /api/v1/contact/list?meta.segment=premium&take=100
 * ```
 *
 * The response includes complete contact records with all fields populated,
 * including the `verifiedAt` timestamp which indicates whether the contact is
 * verified (non-null) or unverified (null). This allows you to implement
 * different UI treatments or business logic based on verification status.
 *
 * **Performance Note:** For large contact databases with millions of records,
 * always use cursor-based pagination rather than attempting to retrieve all
 * contacts at once. The cursor approach ensures consistent performance and
 * prevents memory issues or timeouts.
 *
 * **Security:** All list operations are scoped to the authenticated user's
 * account, ensuring proper data isolation. You can never retrieve contacts
 * belonging to other users, maintaining strict privacy boundaries.
 */
