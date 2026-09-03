// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
  getValueQueryFilter,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * -@swagger
 *
 * /rating/list:
 *   get:
 *     operationId: listRatings
 *     summary: List ratings
 *     tags:
 *       - Rating
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
 *                       $ref: '#/paths/~1rating~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const ratings = await prisma.rating.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').Rating>} */ (
              getFieldQueryFilter
            )(req, ['contactId', 'botId', 'conversationId', 'messageId']),

            ...getValueQueryFilter(req),
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
 * @manual Ratings
 * @description Ratings are structured feedback records that track quality metrics and user satisfaction for bots, conversations, and messages, providing quantitative and qualitative data for performance analysis and improvement.
 * @category Resources/Ratings
 * @tags rating, feedback, analytics, performance
 * @index 1
 *
 * Ratings provide a comprehensive system for capturing and managing feedback
 * across your conversational AI platform. Unlike simple upvote/downvote
 * operations, ratings offer flexible numerical values and detailed reasoning
 * that help you analyze performance patterns, identify improvement
 * opportunities, and make data-driven optimization decisions.
 *
 * The rating system enables you to track feedback at multiple levels:
 * individual messages, entire conversations, specific bots, and even contact
 * interactions. Each rating includes a numerical value for quantitative
 * analysis and an optional reason field for capturing qualitative insights
 * about what worked well or needs improvement.
 *
 * ## Listing Ratings
 *
 * Retrieve a paginated list of all ratings associated with your account,
 * enabling comprehensive analysis of feedback patterns across your
 * conversational AI implementations. The list operation supports advanced
 * filtering to help you focus on specific aspects of your rating data.
 *
 * ```http
 * GET /api/v1/rating/list
 * ```
 *
 * This endpoint returns all ratings you've created, ordered by creation date
 * (most recent first by default). Each rating includes complete context about
 * what was rated, including associated contact, bot, conversation, and message
 * identifiers.
 *
 * ### Filtering by Resource
 *
 * Focus your analysis by filtering ratings for specific resources using query
 * parameters. You can filter by contact, bot, conversation, or message to
 * analyze feedback for particular interactions:
 *
 * ```http
 * GET /api/v1/rating/list?botId=bot_abc123&value=-100
 * ```
 *
 * The filtering system supports multiple criteria simultaneously, allowing you
 * to create precise queries like "all negative ratings for a specific bot" or
 * "all ratings from a particular contact during a conversation." This
 * flexibility enables targeted analysis of feedback patterns and helps
 * identify specific areas requiring attention.
 *
 * ### Pagination and Ordering
 *
 * Manage large rating datasets efficiently using cursor-based pagination:
 *
 * ```http
 * GET /api/v1/rating/list?take=50&cursor=rating_xyz789
 * ```
 *
 * The `take` parameter controls how many ratings to retrieve per request
 * (useful for performance when dealing with thousands of ratings), while the
 * `cursor` parameter enables efficient pagination through large result sets.
 * Use the `order` parameter to control sort direction (`asc` or `desc`).
 *
 * ### Metadata Filtering
 *
 * Enhance your rating organization by using the metadata filtering system to
 * tag and categorize ratings according to your specific needs. Metadata
 * provides flexible key-value storage for custom attributes, enabling
 * sophisticated analysis and reporting:
 *
 * ```http
 * GET /api/v1/rating/list?meta[category]=technical&meta[severity]=high
 * ```
 *
 * Common metadata use cases include categorizing rating types (technical,
 * usability, content quality), tracking rating sources (automated testing,
 * user feedback, internal review), and associating ratings with specific
 * feature areas or business metrics.
 *
 * **Warning:** Rating data accumulates over time and can become substantial.
 * Use filtering and pagination effectively to maintain query performance and
 * avoid retrieving unnecessary data. Consider implementing date range filters
 * through metadata when analyzing time-specific feedback patterns.
 */
