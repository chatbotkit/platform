// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * -@swagger
 *
 * /rating/{ratingId}/fetch:
 *   get:
 *     operationId: fetchRating
 *     summary: Fetch rating
 *     tags:
 *       - Rating
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           description: The ID of the rating to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The rating was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contactId:
 *                   description: The contact ID associated with this rating
 *                   type: string
 *                 botId:
 *                   description: The bot ID associated with this rating
 *                   type: string
 *                 conversationId:
 *                   description: The conversation ID associated with this rating
 *                   type: string
 *                 messageId:
 *                   description: The message ID associated with this rating
 *                   type: string
 *                 value:
 *                   description: The rating value
 *                   type: number
 *                 reason:
 *                   description: The reason for the rating
 *                   type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const rating = await prisma.rating.findUnique({
      where: {
        id: requiredUrlParam(req, 'ratingId'),
      },

      select: {
        // identifiers

        id: true,

        // basic information

        name: true,
        description: true,

        // resource linking

        userId: true,

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

    if (!rating) {
      return notFound()
    }

    if (rating.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (rating).userId)

    return ok(makeJsonSafe(rating))
  })
)

/**
 * @manual Ratings
 * @index 20
 *
 * ## Fetching a Rating
 *
 * Retrieve detailed information about a specific rating using its unique
 * identifier. This operation returns all rating data including the numerical
 * value, associated reason, linked resources, and metadata, enabling detailed
 * review and analysis of individual feedback records.
 *
 * To fetch a rating, send a GET request with the rating ID:
 *
 * ```http
 * GET /api/v1/rating/{ratingId}/fetch
 * ```
 *
 * Replace `{ratingId}` with your rating's unique identifier (format:
 * `rtg_abc123xyz`).
 *
 * ### Response Structure
 *
 * The endpoint returns comprehensive rating information including all
 * contextual data needed to understand and analyze the feedback:
 *
 * ```json
 * {
 *   "id": "rtg_abc123xyz",
 *   "name": "Support Bot Performance Rating",
 *   "description": "Quality assessment for customer inquiry response",
 *   "value": -50,
 *   "reason": "Bot provided generic answer instead of using specific documentation from the knowledge base",
 *   "contactId": "ctc_user789",
 *   "botId": "bot_support_001",
 *   "conversationId": "cnv_session_456",
 *   "messageId": "msg_response_012",
 *   "meta": {
 *     "category": "accuracy",
 *     "severity": "medium",
 *     "reviewStatus": "pending"
 *   },
 *   "createdAt": "2026-01-10T00:00:00.000Z",
 *   "updatedAt": "2026-01-10T00:00:00.000Z"
 * }
 * ```
 *
 * ### Understanding Rating Context
 *
 * The fetched rating includes several fields providing context about what was
 * rated and why:
 *
 * - **value**: The numerical rating score using your chosen scale
 * - **reason**: Optional qualitative explanation for the rating
 * - **Resource links**: IDs connecting the rating to specific contacts, bots,
 *   conversations, or messages
 * - **name/description**: Optional human-readable labels for rating
 *   organization
 * - **meta**: Custom attributes for flexible categorization and analysis
 * - **timestamps**: Creation and last update times for tracking rating history
 *
 * All resource ID fields (contactId, botId, conversationId, messageId) may be
 * null if the rating wasn't explicitly linked to those resources during
 * creation.
 *
 * ### Use Cases for Fetching Ratings
 *
 * Retrieving individual ratings supports several analytical workflows:
 *
 * - **Quality review**: Examine detailed feedback including reasons and context
 *   for understanding specific quality issues
 * - **Performance audits**: Review ratings associated with particular bots,
 *   conversations, or time periods
 * - **Follow-up actions**: Access rating details to inform improvement
 *   initiatives or customer outreach
 * - **Reporting**: Pull specific rating data for inclusion in dashboards,
 *   reports, or presentations
 * - **Debugging**: Investigate rating-related issues or verify rating data
 *   accuracy
 *
 * ### Integration with Analytics
 *
 * Use fetch operations in combination with list operations for comprehensive
 * analytics workflows. First, query ratings list with filters to identify
 * ratings of interest, then fetch individual ratings to access complete details
 * for deeper analysis:
 *
 * ```http
 * # Step 1: Find negative ratings for a bot
 * GET /api/v1/rating/list?botId=bot_abc&value=-100
 *
 * # Step 2: Fetch detailed info for specific ratings
 * GET /api/v1/rating/rtg_xyz123/fetch
 * ```
 *
 * This two-step pattern enables efficient data access, retrieving summary
 * information for many ratings while accessing full details only when needed.
 *
 * **Important:** Rating fetch requires proper authorization. You can only
 * retrieve ratings that belong to your user account. Attempting to fetch
 * ratings owned by other users will result in an authorization error.
 */