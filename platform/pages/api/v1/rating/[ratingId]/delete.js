// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * -@swagger
 *
 * /rating/{ratingId}/delete:
 *   post:
 *     operationId: deleteRating
 *     summary: Delete rating
 *     tags:
 *       - Rating
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           description: The ID of the rating to delete
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The rating was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted rating
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
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

    await prisma.rating.delete({
      where: {
        id: rating.id,
      },
    })

    return ok({ id: rating.id })
  })
)

/**
 * @manual Ratings
 * @index 40
 *
 * ## Deleting a Rating
 *
 * Permanently remove a rating from your account when it's no longer needed,
 * was created in error, or requires removal for data management purposes. The
 * delete operation irreversibly removes all rating data including the value,
 * reason, resource associations, and metadata.
 *
 * To delete a rating, send a POST request with the rating ID:
 *
 * ```http
 * POST /api/v1/rating/{ratingId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{ratingId}` with your rating's unique identifier. The operation
 * requires an empty JSON body but must include the Content-Type header.
 *
 * ### When to Delete Ratings
 *
 * Rating deletion is appropriate in specific scenarios:
 *
 * - **Erroneous creation**: Removing ratings created by mistake or with
 *   incorrect data
 * - **Test data cleanup**: Removing ratings created during testing or
 *   development
 * - **Data privacy compliance**: Fulfilling data deletion requests or privacy
 *   regulations
 * - **Duplicate removal**: Cleaning up accidentally duplicated rating entries
 * - **Invalid feedback**: Removing ratings that don't meet your quality
 *   standards or were created under unusual circumstances
 *
 * Consider carefully whether deletion is necessary versus updating the rating
 * or marking it as invalid through metadata. Deletion removes historical data
 * that might have analytical value even if initially assessed incorrectly.
 *
 * ### Alternative to Deletion: Deactivation
 *
 * Instead of deleting ratings, consider using metadata to mark them as inactive
 * or invalid while preserving the historical record:
 *
 * ```http
 * POST /api/v1/rating/{ratingId}/update
 * Content-Type: application/json
 *
 * {
 *   "meta": {
 *     "status": "deactivated",
 *     "deactivationReason": "Rating created under test conditions",
 *     "deactivatedAt": "2026-01-10T00:00:00Z"
 *   }
 * }
 * ```
 *
 * This approach maintains data integrity for historical analysis while allowing
 * you to filter out invalid ratings from active reports and analytics. Your
 * list operations can exclude deactivated ratings using metadata filters,
 * achieving similar practical results to deletion while preserving the complete
 * historical record.
 *
 * ### Impact on Analytics
 *
 * Deleting ratings affects historical analytics and performance metrics:
 *
 * - **Aggregate calculations**: Average ratings, total counts, and distribution
 *   metrics change immediately upon deletion
 * - **Trend analysis**: Historical trends and time-series data lose data points
 * - **Performance tracking**: Bot or conversation performance metrics are
 *   recalculated without the deleted rating
 * - **Reporting accuracy**: Existing reports or dashboards referencing deleted
 *   ratings become incomplete
 *
 * If ratings contribute to published reports, shared dashboards, or compliance
 * documentation, consider the downstream impact of deletion on those systems.
 * In regulated environments or audit scenarios, marking ratings as invalid
 * through metadata may be preferable to permanent deletion.
 *
 * ### Deletion Scope and Permanence
 *
 * Rating deletion is immediate and permanent:
 *
 * - **No recovery**: Deleted ratings cannot be restored. There is no "undelete"
 *   operation
 * - **Complete removal**: All data associated with the rating (value, reason,
 *   associations, metadata) is permanently deleted
 * - **No cascade effects**: Deleting a rating doesn't affect the associated
 *   resources (bots, conversations, messages, contacts) which remain unchanged
 *
 * Ensure you have backups or exports of important rating data before deletion
 * if there's any possibility you might need the information later.
 *
 * ### Bulk Deletion Workflow
 *
 * For deleting multiple ratings, combine list operations with individual
 * deletions:
 *
 * ```http
 * # Step 1: Find ratings to delete
 * GET /api/v1/rating/list?meta[status]=test&meta[createdBy]=automation
 *
 * # Step 2: Delete each rating individually
 * POST /api/v1/rating/rtg_abc123/delete
 * POST /api/v1/rating/rtg_def456/delete
 * POST /api/v1/rating/rtg_ghi789/delete
 * ```
 *
 * Implement bulk deletion carefully with proper error handling, as each
 * deletion is independent and some may succeed while others fail due to
 * authorization or existence issues.
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "rtg_abc123xyz"
 * }
 * ```
 *
 * The API returns the deleted rating's ID confirming successful removal. After
 * receiving this response, the rating no longer exists and cannot be fetched,
 * updated, or referenced.
 *
 * **Best Practices:**
 *
 * - **Verify before deletion**: Fetch the rating first to confirm you're
 *   deleting the correct record
 * - **Export important data**: If ratings have analytical value, export before
 *   deletion for archival purposes
 * - **Consider alternatives**: Evaluate whether deactivation through metadata
 *   is more appropriate than permanent deletion
 * - **Batch carefully**: When deleting multiple ratings, implement proper error
 *   handling and logging
 * - **Document deletion rationale**: Maintain logs of why ratings were deleted
 *   for audit and compliance purposes
 *
 * **Warning:** Rating deletion is irreversible. Once deleted, the rating data
 * is permanently lost and cannot be recovered. Ensure you have proper backups
 * or exports of any rating data that might be needed for future analysis,
 * compliance, or audit purposes before performing deletion operations.
 */