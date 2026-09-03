// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { deleteRecord } from '@/lib/record'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'

/**
 * @swagger
 *
 * /dataset/{datasetId}/record/{recordId}/delete:
 *   post:
 *     operationId: deleteDatasetRecord
 *     summary: Delete a record from a dataset
 *     tags:
 *       - Dataset Record
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset
 *           type: string
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           description: The ID of the record to delete
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
 *         description: The record was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted record
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
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

    try {
      await store.accessRecord({ datasetId: dataset.id, recordId })
    } catch {
      return notFound()
    }

    await deleteRecord({ store, datasetId: dataset.id, recordId })

    return ok({ id: recordId })
  })
)

/**
 * @manual Dataset Records
 * @index 40
 *
 * ## Deleting Dataset Records
 *
 * Deleting individual records from a dataset allows you to remove specific pieces of information from your knowledge base without affecting other records or files. This fine-grained control is essential for managing dataset content quality, removing outdated information, or handling data privacy requests where specific content needs to be permanently removed.
 *
 * Each record in a dataset represents a discrete piece of information, typically a text chunk extracted from a file or manually created through the API. When you delete a record, you permanently remove not only the text content but also its associated embeddings, metadata, and any indexing that makes it searchable. The record becomes immediately unavailable for semantic search and bot interactions.
 *
 * Record deletion is useful in several scenarios: removing inaccurate information that was extracted incorrectly from a source file, purging sensitive data that should no longer be accessible, cleaning up duplicate or redundant records that clutter search results, or maintaining dataset quality by removing low-value content that doesn't contribute to meaningful bot responses.
 *
 * ### Performing Record Deletion
 *
 * To delete a specific record, you need both the dataset ID and the record ID. The operation is straightforward and executes immediately:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/record/{recordId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The request body can be empty as no additional parameters are required. The operation verifies that both the dataset and record exist and that you have permission to delete the record before proceeding with the deletion.
 *
 * ### Important Considerations
 *
 * **Permanence**: Deleting a dataset record is a permanent action that cannot be undone. Once deleted, the record and its embeddings are removed from storage and cannot be recovered. If you need the information again, you'll need to recreate the record manually or reprocess the source file.
 *
 * **File Relationships**: Deleting a record doesn't affect the source file if the record was created from a file attachment. The file remains attached to the dataset, but this specific record extracted from it will be gone. Other records from the same file remain intact.
 *
 * **Search Impact**: After deletion, the record immediately stops appearing in search results and semantic queries. Bots connected to the dataset will no longer be able to reference this information in their responses.
 *
 * **Authorization**: You can only delete records from datasets that belong to your account. The operation will fail if you attempt to delete records from datasets you don't own or don't have appropriate permissions to modify.
 */
