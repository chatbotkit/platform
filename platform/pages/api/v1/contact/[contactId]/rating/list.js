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
 * /contact/{contactId}/rating/list:
 *   get:
 *     operationId: listContactRatings
 *     summary: List contact ratings
 *     tags:
 *       - Contact Rating
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to list ratings for
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
 *         description: The list of ratings was retrieved successfully
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
 *                             description: The contact id assigned to this rating
 *                             type: string
 *                           botId:
 *                             description: The bot id assigned to this rating
 *                             type: string
 *                           conversationId:
 *                             description: The conversation id assigned to this rating
 *                             type: string
 *                           messageId:
 *                             description: The message id assigned to this rating
 *                             type: string
 *                           value:
 *                             description: The rating value
 *                             type: number
 *                           reason:
 *                             description: The reason for the rating
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
 *                       $ref: '#/paths/~1contact~1{contactId}~1rating~1list/get/responses/200/content/application~1json/schema/properties/items/items'
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

      const ratings = await prisma.rating.findMany({
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

          contactId: true,

          botId: true,

          conversationId: true,

          messageId: true,

          // resource specific

          value: true,

          reason: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(ratings),
      }
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Listing Contact Ratings
 *
 * Contact ratings capture user feedback on chatbot interactions, enabling
 * you to monitor conversation quality, identify areas for improvement, and
 * track user satisfaction with AI-generated responses.
 *
 * ```http
 * GET /api/v1/contact/{contactId}/rating/list
 * Content-Type: application/json
 * ```
 *
 * Each rating records a user's evaluation of a specific chatbot message or
 * conversation, including the rating value and any explanatory feedback they
 * provided about why they rated the interaction that way.
 *
 * ## Understanding Rating Data
 *
 * The rating list endpoint returns comprehensive information about each
 * rating submitted by the contact:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "rating_xyz789",
 *       "name": "Message Rating",
 *       "description": "User feedback on response quality",
 *       "contactId": "contact_abc123",
 *       "botId": "bot_def456",
 *       "conversationId": "conv_ghi789",
 *       "messageId": "msg_jkl012",
 *       "value": 5,
 *       "reason": "Very helpful and accurate response",
 *       "createdAt": "2025-11-22T18:30:00Z",
 *       "updatedAt": "2025-11-22T18:30:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * Each rating includes:
 *
 * - **Rating value**: Numerical score indicating satisfaction level
 * - **Reason**: Optional text explaining the rating decision
 * - **Context**: Links to the specific bot, conversation, and message rated
 * - **Timestamps**: When the rating was created and last updated
 *
 * ## Analyzing User Feedback
 *
 * Contact ratings provide valuable insights for improving chatbot
 * performance:
 *
 * **Quality Monitoring:**
 * Track how users perceive response quality across different conversations
 * and identify patterns in positive and negative ratings.
 *
 * **Bot Improvement:**
 * Use rating reasons to understand what users find helpful or problematic,
 * informing adjustments to bot configuration, training data, or response
 * generation strategies.
 *
 * **User Satisfaction Trends:**
 * Monitor rating patterns over time to measure improvements and catch
 * declining satisfaction early.
 *
 * **Conversation Analysis:**
 * Link ratings back to specific conversations and messages to understand
 * context and identify which types of interactions generate the best or
 * worst responses.
 *
 * ## Filtering and Pagination
 *
 * Like other list endpoints, rating lists support pagination and filtering:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/rating/list?take=50&order=desc
 * Content-Type: application/json
 * ```
 *
 * You can filter ratings by metadata using the `meta` query parameter to
 * find ratings with specific attributes or analyze ratings from particular
 * time periods or interaction contexts.
 *
 * ## Integration with Chatbot Flows
 *
 * Ratings are typically collected through chatbot interactions where users
 * are prompted to rate responses. The rating system supports:
 *
 * - **Inline feedback**: Users can rate messages during conversations
 * - **Post-conversation surveys**: Collect ratings after conversation completion
 * - **Selective rating**: Target specific messages or conversation types for feedback
 * - **Multi-dimensional ratings**: Use metadata to capture different rating aspects
 *
 * **Important:** Ratings are associated with specific contacts, bots,
 * conversations, and messages, creating a complete feedback trail that
 * enables detailed analysis of user satisfaction and response quality across
 * your entire chatbot ecosystem.
 */
