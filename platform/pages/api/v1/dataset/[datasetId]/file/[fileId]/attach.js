// @ts-check
import prisma from '@/prisma/client'
import { DatasetFileAttachmentType } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

const bodySchema = schema.object({
  type: schema
    .string()
    .valid(...Object.keys(DatasetFileAttachmentType))
    .required(),
})

/**
 * @swagger
 *
 * /dataset/{datasetId}/file/{fileId}/attach:
 *   post:
 *     operationId: attachDatasetFile
 *     summary: Attach dataset file
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
 *               type:
 *                 $ref: '#/components/schemas/DatasetFileAttachmentType'
 *     responses:
 *       200:
 *         description: The dataset file that was attached successfully
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
      const { type } = body

      const dataset = await prisma.dataset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'datasetId')
      )

      if (!dataset) {
        return notFound()
      }

      if (dataset.userId !== session.user.id) {
        return notAuthorized()
      }

      const file = await prisma.file.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'fileId')
      )

      if (!file) {
        return notFound()
      }

      if (file.userId !== session.user.id) {
        return notAuthorized()
      }

      const attachment = await prisma.datasetFileAttachment.findUnique({
        where: {
          datasetId_fileId: {
            datasetId: dataset.id,

            fileId: file.id,
          },
        },
      })

      if (attachment) {
        await prisma.datasetFileAttachment.delete({
          where: {
            datasetId_fileId: {
              datasetId: dataset.id,

              fileId: file.id,
            },
          },
        })
      }

      await prisma.datasetFileAttachment.create({
        data: {
          datasetId: dataset.id,

          fileId: file.id,

          type: type,
        },
      })

      return ok({ id: file.id, datasetId: dataset.id, type })
    })
  )
)

/**
 * @manual Dataset Files
 * @description Dataset files enable you to attach uploaded files to datasets, automatically extracting and indexing their content for AI-powered search and retrieval, supporting various document formats including PDFs, text files, and office documents.
 * @category Resources/Datasets
 * @tags dataset, file, attachment, document-processing
 * @index 1
 *
 * Dataset files provide a powerful mechanism for integrating document-based knowledge into your AI applications. By attaching files to datasets, you enable the platform to automatically extract text content, process it into searchable records, and make that information available to your bots through semantic search capabilities.
 *
 * The file attachment system supports a wide range of document formats and handles the complexity of text extraction, chunking, and vectorization automatically. Once attached and synced, file content becomes instantly searchable within the dataset, allowing your AI agents to access and reference information from documents when responding to user queries.
 *
 * ## Understanding File Attachments
 *
 * When you attach a file to a dataset, you're creating a connection that tells the platform to extract and index the file's content. The attachment system supports different attachment types that control how the file content is processed and stored:
 *
 * - **source**: The file serves as a source of knowledge, with its content extracted and stored as dataset records
 * - **reference**: The file is referenced but not automatically processed (useful for metadata tracking)
 *
 * File attachments are persistent connections - once attached, the file remains associated with the dataset until explicitly detached. This allows you to manage your knowledge base by adding or removing document sources as your information needs evolve.
 *
 * ## Attaching Files to Datasets
 *
 * To attach a file to a dataset, you need both a file ID (obtained by uploading a file) and a dataset ID (from creating or fetching a dataset). The attachment operation creates the connection but does not immediately process the file - you'll need to trigger a sync operation separately to extract and index the content.
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/file/{fileId}/attach
 * Content-Type: application/json
 *
 * {
 *   "type": "source"
 * }
 * ```
 *
 * The `type` parameter is required and determines how the file is handled:
 *
 * **source**: Most common type - extracts text content from the file and creates searchable records in the dataset. Use this when you want the file's content to be available for AI retrieval and reference. Supported formats include PDF, TXT, DOCX, PPTX, and many others.
 *
 * **reference**: Creates an attachment without content extraction. Useful for tracking which files are associated with a dataset without processing their content, or for files that will be processed through custom mechanisms.
 *
 * ### Supported File Formats
 *
 * The file attachment system can extract text from numerous document formats:
 *
 * - **Text Documents**: TXT, MD (Markdown), RTF
 * - **Office Documents**: DOCX, XLSX, PPTX
 * - **PDFs**: Both text-based and image-based (with OCR)
 * - **Web Documents**: HTML, XML
 * - **Code Files**: Most programming language source files
 * - **Data Formats**: JSON, CSV, YAML
 *
 * ### Attachment Workflow
 *
 * The complete workflow for making file content available in a dataset involves three steps:
 *
 * 1. **Upload**: First upload the file using the file upload endpoint to get a file ID
 * 2. **Attach**: Create the attachment between the file and dataset (this operation)
 * 3. **Sync**: Trigger synchronization to extract and index the content
 *
 * Here's a complete example:
 *
 * ```javascript
 * // Step 1: Upload file
 * const formData = new FormData();
 * formData.append('file', fileBlob, 'document.pdf');
 * const uploadResponse = await fetch('/api/v1/file/create', {
 *   method: 'POST',
 *   body: formData
 * });
 * const { id: fileId } = await uploadResponse.json();
 *
 * // Step 2: Attach file to dataset
 * await fetch(`/api/v1/dataset/${datasetId}/file/${fileId}/attach`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ type: 'source' })
 * });
 *
 * // Step 3: Sync to extract content
 * await fetch(`/api/v1/dataset/${datasetId}/file/${fileId}/sync`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({})
 * });
 * ```
 *
 * ### Re-attaching Files
 *
 * If a file is already attached to the dataset, calling attach again will update the attachment type. The existing attachment is automatically removed and recreated with the new type. This allows you to change how a file is processed without manually detaching and reattaching.
 *
 * ### Important Considerations
 *
 * **Processing Time**: Large documents or complex PDFs may take several minutes to process during sync. The platform handles this asynchronously, so your attach request returns immediately.
 *
 * **File Size Limits**: Files are subject to your account's size limits. Very large files (hundreds of MB) should be split into smaller chunks for optimal processing.
 *
 * **Content Updates**: If you update the file content (by uploading a new version), you need to trigger a new sync to refresh the dataset records. Attachments don't automatically detect file changes.
 *
 * **Multiple Datasets**: A single file can be attached to multiple datasets, allowing you to reuse content across different knowledge bases without duplicating file storage.
 *
 * **Record Source Tracking**: Records created from file content include source metadata that references the original file ID, enabling you to track which records came from which documents.
 */
