// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { updateRecord } from '@/lib/record'
import { notAuthorized, notFound, ok, respondFromError } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'

import metaSchema from '@/schemas/meta'
import recordTextSchema from '@/schemas/recordText'
import sourceSchema from '@/schemas/source'

export const bodySchema = schema.object({
  text: recordTextSchema,

  source: sourceSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /dataset/{datasetId}/record/{recordId}/update:
 *   post:
 *     operationId: updateDatasetRecord
 *     summary: Update a dataset record
 *     tags:
 *       - Dataset Record
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 description: The text to update the record with
 *                 type: string
 *               source:
 *                 description: The source to update the record with
 *                 type: string
 *               meta:
 *                 $ref: '#/components/schemas/Meta'
 *     responses:
 *       200:
 *         description: The record was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated record
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { text, source, meta } = body

      const datasetId = requiredUrlParam(req, 'datasetId')
      const recordId = requiredUrlParam(req, 'recordId')

      const dataset = await prisma.dataset.findUniqueByIdentifier(
        session.user,
        datasetId
      )

      if (!dataset) {
        return notFound()
      }

      if (dataset.userId !== session.user.id) {
        return notAuthorized()
      }

      const store = await getStore()

      let existingRecord

      try {
        existingRecord = await store.accessRecord({
          datasetId: dataset.id,
          recordId,
        })
      } catch {
        return notFound()
      }

      debug(`updating record`, { text })

      try {
        await updateRecord({
          datasetId: dataset.id,
          recordId,
          store,
          text,
          source,
          meta: getMeta(meta, existingRecord.meta),
        })

        return ok({ id: recordId })
      } catch (e) {
        await captureError(e)

        return respondFromError(e)
      }
    })
  )
)

/**
 * @manual Dataset Records
 *
 * ## Updating a Dataset Record
 *
 * Modifying existing records allows you to keep your knowledge base current,
 * correct inaccuracies, refine content for better search results, and update
 * metadata as your organizational needs evolve. Record updates automatically
 * trigger re-indexing, ensuring that the new content is immediately searchable
 * and will be reflected in future query results.
 *
 * When you update a record, you can modify its text content, change source
 * attribution, or update custom metadata fields. The update operation preserves
 * the record's unique identifier while applying your changes and updating the
 * modification timestamp. This maintains referential integrity while allowing
 * content evolution.
 *
 * The ability to update records incrementally is essential for maintaining
 * knowledge base quality without disrupting service. Whether you're fixing
 * typos, expanding explanations, updating product information, or refining
 * categorization metadata, record updates provide the flexibility needed for
 * continuous improvement of your AI's knowledge foundation.
 *
 * To update an existing record, send a POST request with the fields you want
 * to modify:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/record/{recordId}/update
 * Content-Type: application/json
 *
 * {
 *   "text": "Updated product information: Our premium support package includes 24/7 live chat, priority email response within 2 hours, and dedicated account management.",
 *   "source": "support-packages-2024.pdf, page 2",
 *   "meta": {
 *     "category": "support",
 *     "tier": "premium",
 *     "lastReviewed": "2024-01-20",
 *     "reviewedBy": "support-team"
 *   }
 * }
 * ```
 *
 * Replace `{datasetId}` with your dataset identifier and `{recordId}` with the
 * specific record you want to update. You only need to include the fields you
 * want to change-omitted fields will retain their current values.
 *
 * ### Updatable Fields
 *
 * - **text**: The primary content that will be searched and retrieved
 * - **source**: Attribution indicating where this information originated
 * - **meta**: Custom metadata object for organization and filtering
 *
 * ### Response
 *
 * Upon successful update, the API returns the record ID:
 *
 * ```json
 * {
 *   "id": "rec_def456ghi"
 * }
 * ```
 *
 * ### Automatic Re-indexing
 *
 * When you update a record's text content, the system automatically:
 *
 * 1. **Regenerates embeddings**: Creates new vector representations of the
 *    updated text for semantic search
 * 2. **Updates search indexes**: Ensures the new content is immediately
 *    searchable
 * 3. **Maintains record identity**: Preserves the record ID and relationships
 * 4. **Updates timestamps**: Records when the modification occurred
 *
 * This automatic re-indexing means your changes take effect immediately without
 * requiring manual reprocessing or service restarts.
 *
 * ### Common Update Scenarios
 *
 * **Content Corrections**: Fix typos, grammatical errors, or factual
 * inaccuracies discovered through use or review.
 *
 * **Information Updates**: Refresh content when underlying facts change, such as
 * policy updates, pricing changes, or product specifications.
 *
 * **Search Optimization**: Refine text to improve search relevance by adding
 * keywords, clarifying terminology, or restructuring content.
 *
 * **Metadata Enhancement**: Add or update categorization metadata to improve
 * filtering and organization without changing the core content.
 *
 * **Source Attribution**: Update source information when content is verified
 * against newer documentation or different authoritative sources.
 *
 * ### Best Practices
 *
 * - **Preserve context**: When updating text, maintain enough context for the
 *   record to be understood independently
 * - **Update sources**: Keep source attribution current to maintain content
 *   provenance
 * - **Use metadata effectively**: Leverage metadata updates for versioning,
 *   review tracking, and quality management
 * - **Test search impact**: After significant content updates, verify that
 *   search results still return relevant information
 * - **Batch similar updates**: If updating multiple related records, consider
 *   doing so in sequence to maintain consistency
 * - **Keep records concise**: Text content is automatically truncated to fit
 *   within the embedding model's token limit (approximately 8,000 tokens).
 *   Content exceeding this limit is silently truncated during re-indexing-
 *   split long documents into multiple records to ensure all content is
 *   searchable
 *
 * ### Authorization
 *
 * You can only update records in datasets that belong to your account.
 * Attempting to modify records in other users' datasets will result in an
 * authorization error.
 */
