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
 * /contact/{contactId}/memory/list:
 *   get:
 *     operationId: listContactMemories
 *     summary: List contact memories
 *     tags:
 *       - Contact Memory
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to list memories for
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
 *         description: The list of memories was retrieved successfully
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
 *                           botId:
 *                             description: The ID of the bot the memory belongs to
 *                             type: string
 *                           text:
 *                             description: The text of the memory
 *                             type: string
 *                         required:
 *                           - text
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
 *                       $ref: '#/paths/~1contact~1{contactId}~1memory~1list/get/responses/200/content/application~1json/schema/properties/items/items'
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

      const memories = await prisma.memory.findMany({
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

          // contactId: true, // @note contactId is intentionally excluded as it's implied by the endpoint

          botId: true,

          // resource specific

          text: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(memories),
      }
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Listing Contact Memories
 *
 * Retrieve all memories associated with a specific contact to access their
 * personalization data, understand conversation context, and review what
 * information has been retained about them across interactions. Memories
 * enable personalized, contextual conversations by storing key facts and
 * preferences about individual contacts.
 *
 * This endpoint is essential for building chatbots that remember user
 * preferences, track conversation history, and provide personalized responses
 * based on past interactions. Each memory represents a discrete piece of
 * information that AI agents can recall and utilize in future conversations.
 *
 * ```http
 * GET /api/v1/contact/{contactId}/memory/list
 * ```
 *
 * **Query Parameters:**
 *
 * - `cursor`: Pagination cursor for retrieving additional results
 * - `order`: Sort order ("asc" or "desc", default: "desc")
 * - `take`: Number of memories to retrieve (default: 25)
 * - `meta`: Filter memories by metadata key-value pairs
 *
 * Each memory entry includes the memory text content, associated bot ID,
 * timestamps, and optional metadata, providing complete visibility into
 * what information is being retained and utilized for personalization.
 *
 * **Practical Example:**
 *
 * ```http
 * GET /api/v1/contact/contact-abc123/memory/list?take=100
 * ```
 *
 * This retrieves up to 100 memories for the specified contact, enabling you
 * to audit personalization data, understand what information has been captured,
 * and ensure memories are being appropriately utilized to enhance conversation
 * quality and user experience.
 *
 * **Use Cases:**
 *
 * - **Personalization Auditing**: Review what information is stored about contacts
 * - **Data Management**: Identify outdated memories for cleanup or updates
 * - **Compliance**: Verify data retention meets privacy requirements
 * - **Analytics**: Analyze common memory patterns across contact base
 * - **Quality Assurance**: Ensure memories are accurately capturing key information
 */
