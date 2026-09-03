// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'

const bodySchema = schema.object({
  deleteRecords: schema.boolean(),
})

/**
 * @swagger
 *
 * /dataset/{datasetId}/file/{fileId}/detach:
 *   post:
 *     operationId: detachDatasetFile
 *     summary: Detach dataset file
 *     tags:
 *       - Dataset File
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           description: The ID of the file
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteRecords:
 *                 type: boolean
 *                 description: Delete records associated with the file
 *     responses:
 *       200:
 *         description: The dataset file that was detached successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the dataset file
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { deleteRecords = false } = body

      const attachment = await prisma.datasetFileAttachment.findFirst({
        where: {
          datasetId: requiredUrlParam(req, 'datasetId'),

          fileId: requiredUrlParam(req, 'fileId'),
        },

        include: {
          dataset: true,

          file: true,
        },
      })

      if (!attachment) {
        return notFound()
      }

      if (!attachment.dataset) {
        return notFound()
      }

      if (attachment.dataset.userId !== session.user.id) {
        return notAuthorized()
      }

      if (!attachment.file) {
        return notFound()
      }

      if (attachment.file.userId !== session.user.id) {
        return notAuthorized()
      }

      if (deleteRecords) {
        // @note delete all records with source matching this file
        const source = `file:///${attachment.fileId}`
        const store = await getStore()

        await store.deleteRecordsBySource({
          datasetId: attachment.datasetId,
          source: source,
        })
      }

      await prisma.datasetFileAttachment.delete({
        where: {
          datasetId_fileId: {
            datasetId: attachment.datasetId,
            fileId: attachment.fileId,
          },
        },
      })

      return ok({
        id: attachment.fileId,
        datasetId: attachment.datasetId,
        type: attachment.type,
      })
    })
  )
)

/**
 * @manual Dataset Files
 * @index 20
 *
 * ## Detaching Files from Datasets
 *
 * When a file is no longer needed as a knowledge source for a dataset, you can detach it to remove the connection between the file and dataset. The detachment operation provides flexible control over what happens to the content that was extracted from the file, allowing you to either preserve the existing dataset records or clean them up along with the attachment.
 *
 * Detaching a file is useful when you want to update your dataset's knowledge base by removing outdated information, reorganizing document sources, or simply cleaning up attachments that are no longer relevant. The operation is immediate and can be configured to handle content cleanup automatically.
 *
 * ### Basic Detachment
 *
 * To detach a file without removing its extracted records from the dataset:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/file/{fileId}/detach
 * Content-Type: application/json
 *
 * {
 *   "deleteRecords": false
 * }
 * ```
 *
 * This removes the attachment relationship while preserving all records that were created from the file's content. The records remain searchable in the dataset and continue to provide knowledge to your AI agents. This option is useful when you want to disconnect a file but keep its information available.
 *
 * ### Detachment with Record Deletion
 *
 * To completely remove both the attachment and all associated content from the dataset:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/file/{fileId}/detach
 * Content-Type: application/json
 *
 * {
 *   "deleteRecords": true
 * }
 * ```
 *
 * This performs a complete cleanup by:
 * 1. Identifying all records in the dataset that originated from the file
 * 2. Deleting those records from both the database and vector store
 * 3. Removing the file attachment
 *
 * Use this option when you want to fully remove a document's information from the dataset, such as when content becomes outdated, incorrect, or no longer relevant to your AI application.
 *
 * ### Record Deletion Process
 *
 * When `deleteRecords` is set to true, the system:
 *
 * - Locates all records with a source matching `file:///{fileId}`
 * - Processes deletions in batches of 10 for efficient performance
 * - Removes records from both the Prisma database and the vector store
 * - Handles large files with many records without timeout issues
 *
 * The deletion process runs synchronously but is optimized for performance. For files that generated hundreds or thousands of records, the operation may take several seconds to complete.
 *
 * ### Detachment Scenarios
 *
 * **Scenario 1: Updating File Content**
 *
 * When you need to update a document's content, detach with record deletion, then re-attach and sync the updated file. This ensures clean replacement of old content with new:
 *
 * ```javascript
 * // Remove old file and its content
 * await fetch(`/api/v1/dataset/${datasetId}/file/${oldFileId}/detach`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ deleteRecords: true })
 * });
 *
 * // Attach and sync new version
 * await fetch(`/api/v1/dataset/${datasetId}/file/${newFileId}/attach`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ type: 'source' })
 * });
 *
 * await fetch(`/api/v1/dataset/${datasetId}/file/${newFileId}/sync`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({})
 * });
 * ```
 *
 * **Scenario 2: Reorganizing Knowledge Base**
 *
 * When restructuring datasets, you might detach files without deleting records to preserve knowledge while reorganizing attachments. This is useful when migrating content between datasets or consolidating knowledge sources.
 *
 * **Scenario 3: Content Removal**
 *
 * When information becomes obsolete, confidential, or needs to be removed for compliance reasons, detach with record deletion to ensure complete removal from the AI's accessible knowledge.
 *
 * ### Important Considerations
 *
 * **Irreversible Deletion**: When `deleteRecords` is true, the record deletion is permanent and cannot be undone. Ensure you have backups if there's any chance you'll need the content again.
 *
 * **File Preservation**: Detaching a file only removes its connection to the dataset. The file itself remains in your account's file storage and can be reattached later or attached to other datasets.
 *
 * **Batch Processing**: For files that generated many records, the deletion process handles batching automatically. You don't need to implement any special logic for large documents.
 *
 * **Vector Store Cleanup**: Record deletion includes cleanup from the vector store, ensuring embeddings are also removed. This helps maintain vector database efficiency and prevents ghost results in semantic searches.
 *
 * **Multiple Dataset Attachments**: If a file is attached to multiple datasets, detaching from one dataset doesn't affect its attachments to other datasets. Each attachment is independent.
 *
 * ### Validation and Authorization
 *
 * The detach operation validates that:
 * - The attachment exists between the specified file and dataset
 * - You own both the dataset and the file
 * - The dataset and file are both accessible and valid
 *
 * Attempting to detach a non-existent attachment or unauthorized resources will result in appropriate error responses (404 Not Found or 403 Not Authorized).
 *
 * **Best Practice**: Before detaching with record deletion, consider exporting dataset records to create a backup. This provides a safety net if you need to restore the content later.
 */
