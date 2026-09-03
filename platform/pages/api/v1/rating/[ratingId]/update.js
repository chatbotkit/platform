// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import botIdSchema from '@/schemas/botId'
import contactIdSchema from '@/schemas/contactId'
import conversationIdSchema from '@/schemas/conversationId'
import descriptionSchema from '@/schemas/description'
import messageIdSchema from '@/schemas/messageId'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  contactId: contactIdSchema('use'),

  botId: botIdSchema('use'),

  conversationId: conversationIdSchema('use'),

  messageId: messageIdSchema('use'),

  value: schema.number(),

  reason: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * -@swagger
 *
 * /rating/{ratingId}/update:
 *   post:
 *     operationId: updateRating
 *     summary: Update rating
 *     tags:
 *       - Rating
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   contactId:
 *                     description: The contact id assigned to this rating
 *                     type: string
 *                   botId:
 *                     description: The bot id assigned to this rating
 *                     type: string
 *                   conversationId:
 *                     description: The conversation id associated with this rating
 *                     type: string
 *                   messageId:
 *                     description: The message id associated with this rating
 *                     type: string
 *                   value:
 *                     description: The rating value
 *                     type: number
 *                   reason:
 *                     description: The reason for the rating
 *                     type: string
 *                     nullable: true
 *     responses:
 *       200:
 *         description: The rating was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated rating
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        contactId: contact,

        botId: bot,

        conversationId: conversation,

        messageId: message,

        value,

        reason,

        meta,
      } = body

      const rating = await prisma.rating.findUnique({
        where: {
          id: requiredUrlParam(req, 'ratingId'),
        },
      })

      if (!rating) {
        return notFound()
      }

      if (rating.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.rating.update({
        where: {
          id: rating.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          contactId: contact?.id,

          botId: bot?.id,

          conversationId: conversation?.id,

          messageId: message?.id,

          // resource specific

          value,

          reason,

          // meta and others

          meta: getMeta(meta, rating.meta),
        },
      })

      return ok({ id: rating.id })
    })
  )
)

/**
 * @manual Ratings
 * @index 30
 *
 * ## Updating a Rating
 *
 * Modify an existing rating to reflect changed assessments, add additional
 * context, or update resource associations. The update operation provides
 * flexibility to revise ratings as situations evolve, new information becomes
 * available, or initial assessments require refinement.
 *
 * To update a rating, send a POST request with the rating ID and updated
 * fields:
 *
 * ```http
 * POST /api/v1/rating/{ratingId}/update
 * Content-Type: application/json
 *
 * {
 *   "value": -25,
 *   "reason": "Upon review, the response was partially accurate but missed some nuance. Adjusting from -50 to -25.",
 *   "meta": {
 *     "reviewStatus": "completed",
 *     "reviewedBy": "quality_team",
 *     "correctionNotes": "Initial rating too harsh given bot performed better than typical baseline"
 *   }
 * }
 * ```
 *
 * Replace `{ratingId}` with your rating's unique identifier. All fields are
 * optional-include only the properties you want to modify.
 *
 * ### When to Update Ratings
 *
 * Several scenarios justify rating updates rather than creating new ratings:
 *
 * - **Quality review refinement**: Adjusting ratings after human review or
 *   quality assurance processes identify different perspectives
 * - **Context changes**: Updating when additional information becomes available
 *   that changes the assessment
 * - **Reason elaboration**: Adding more detailed explanations or context to
 *   existing ratings
 * - **Resource association**: Linking ratings to additional resources (e.g.,
 *   adding a botId after initial message-only rating)
 * - **Metadata enrichment**: Adding categorization, tags, or other metadata
 *   after initial creation
 * - **Error correction**: Fixing mistakes in original rating values or
 *   associations
 *
 * Updates preserve the original rating ID and creation timestamp while updating
 * the `updatedAt` field, maintaining a clear audit trail of when changes
 * occurred.
 *
 * ### Updating Rating Values
 *
 * Change the numerical rating score to reflect revised assessments:
 *
 * ```http
 * POST /api/v1/rating/{ratingId}/update
 * Content-Type: application/json
 *
 * {
 *   "value": 75,
 *   "reason": "After investigation, bot behavior was correct. Dataset was outdated, not bot fault. Changing from -75 to +75."
 * }
 * ```
 *
 * When updating values, consider including updated reasons that explain both
 * the new rating and why it changed from the previous value. This creates
 * valuable context for anyone reviewing rating history and helps maintain
 * confidence in your feedback data quality.
 *
 * ### Managing Resource Associations
 *
 * Update which resources a rating is associated with, useful when initial
 * context was incomplete or when reorganizing feedback structure:
 *
 * ```http
 * POST /api/v1/rating/{ratingId}/update
 * Content-Type: application/json
 *
 * {
 *   "conversationId": "cnv_new_session_789",
 *   "messageId": "msg_corrected_012"
 * }
 * ```
 *
 * You can add new associations (providing IDs for previously null fields),
 * change existing associations (replacing IDs with new ones), or remove
 * associations by setting fields to null. This flexibility enables rating
 * reorganization as your understanding of feedback context evolves.
 *
 * ### Enriching with Metadata
 *
 * Add or update custom metadata to enhance rating organization and analysis
 * capabilities. The update operation merges new metadata with existing data,
 * preserving untouched fields:
 *
 * ```http
 * POST /api/v1/rating/{ratingId}/update
 * Content-Type: application/json
 *
 * {
 *   "meta": {
 *     "reviewStatus": "verified",
 *     "priorityLevel": "high",
 *     "actionRequired": true,
 *     "assignedTo": "product_team"
 *   }
 * }
 * ```
 *
 * Metadata updates enable progressive enrichment of ratings over time as they
 * move through review workflows, get categorized into reporting structures, or
 * accumulate additional context from various analysis processes.
 *
 * ### Partial Updates
 *
 * The update endpoint supports partial updates-you only need to include fields
 * you want to change. Omitted fields retain their existing values:
 *
 * ```http
 * POST /api/v1/rating/{ratingId}/update
 * Content-Type: application/json
 *
 * {
 *   "reason": "Adding more context: This occurred during peak traffic when response times were elevated."
 * }
 * ```
 *
 * This partial update approach enables targeted modifications without requiring
 * you to re-specify unchanged data, reducing update complexity and minimizing
 * the risk of unintentional modifications.
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "rtg_abc123xyz"
 * }
 * ```
 *
 * The API returns the updated rating's ID confirming successful modification.
 * Use the fetch endpoint to retrieve the complete updated rating data if needed.
 *
 * **Best Practices:**
 *
 * - **Document changes**: When significantly modifying ratings, update the
 *   reason field to explain what changed and why
 * - **Preserve history**: Consider storing update context in metadata rather
 *   than replacing reason text entirely
 * - **Avoid excessive updates**: Frequent rating changes can indicate unclear
 *   rating criteria-establish clear standards to minimize post-creation revisions
 * - **Audit trails**: Use metadata to track update history, reviewers, and
 *   approval workflows
 *
 * **Important:** Rating updates affect analytics and reporting. Consider how
 * rating modifications impact historical analysis, trend tracking, and
 * performance metrics. In some cases, creating a new rating with updated values
 * may be preferable to modifying existing ratings, especially when maintaining
 * temporal accuracy is critical for your analysis needs.
 */
