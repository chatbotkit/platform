// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { withSessionRate } from '@/lib/rate'
import { notAuthorized, notFound, ok } from '@/lib/response'

import { sendEvent } from '@/pages/api/v1/dataset/[datasetId]/queue'

/**
 * @swagger
 *
 * /dataset/{datasetId}/file/{fileId}/sync:
 *   post:
 *     operationId: syncDatasetFile
 *     summary: Sync dataset file
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
 *             properties: {}
 *     responses:
 *       200:
 *         description: The dataset file that was synced successfully
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
  withSessionRate(1, '2 m', async function (req, session) {
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

    await sendEvent(attachment.dataset.id, {
      type: 'importFile',
      payload: {
        fileId: attachment.file.id,
      },
    })

    return ok({ id: attachment.file.id })
  })
)

/**
 * @manual Dataset Files
 * @index 30
 *
 * ## Synchronizing File Content to Datasets
 *
 * File synchronization is the process that extracts text content from attached files, processes it into searchable records, generates embeddings for semantic search, and indexes everything into the dataset. Unlike attachment which only creates the connection, synchronization performs the actual content extraction and indexing that makes file information accessible to your AI agents.
 *
 * Synchronization is intentionally a separate operation from attachment to give you complete control over when processing occurs. This design allows you to attach multiple files and then trigger synchronization in batch, avoid unnecessary processing when files are being updated, and manage computational resources efficiently by scheduling sync operations strategically.
 *
 * ### Basic Synchronization
 *
 * To trigger synchronization of an attached file:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/file/{fileId}/sync
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The sync operation is asynchronous and returns immediately with the file ID. The actual content extraction and indexing happens in the background through the dataset processing queue. You can monitor sync progress and completion through the dataset event log or by checking for new records in the dataset.
 *
 * ### What Happens During Sync
 *
 * When you trigger a file sync, the platform performs several complex operations automatically:
 *
 * **1. Content Extraction**: The file is analyzed and its text content is extracted. This varies by file type:
 * - **Text files** (TXT, MD): Direct content read
 * - **PDFs**: Text layer extraction or OCR for image-based PDFs
 * - **Office documents** (DOCX, XLSX, PPTX): Content parsing from structured formats
 * - **HTML/XML**: Tag stripping and content extraction
 * - **Code files**: Source code with syntax preservation
 *
 * **2. Text Chunking**: Extracted content is intelligently split into manageable chunks. The chunking algorithm:
 * - Respects document structure (paragraphs, sections, headings)
 * - Maintains semantic coherence in each chunk
 * - Ensures chunks are optimally sized for embedding models
 * - Preserves context by including overlapping content between chunks
 *
 * **3. Record Creation**: Each chunk becomes a dataset record containing:
 * - The text content
 * - Source metadata identifying the file: `file:///{fileId}`
 * - Positional information (which chunk in the sequence)
 * - File metadata (name, type, creation date)
 *
 * **4. Embedding Generation**: Text chunks are processed through embedding models to create high-dimensional vector representations that capture semantic meaning. These embeddings enable semantic search capabilities.
 *
 * **5. Vector Indexing**: Generated embeddings are stored in the vector database with indexes optimized for similarity search, allowing fast retrieval of relevant content during bot conversations.
 *
 * ### Monitoring Sync Progress
 *
 * Since synchronization is asynchronous, you need to monitor its progress:
 *
 * ```javascript
 * // Trigger sync
 * const syncResponse = await fetch(
 *   `/api/v1/dataset/${datasetId}/file/${fileId}/sync`,
 *   {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({})
 *   }
 * );
 *
 * // Poll dataset event log to check progress
 * const checkProgress = async () => {
 *   const response = await fetch(
 *     `/api/v1/event/log/list?filter[datasetId]=${datasetId}`
 *   );
 *   const { items } = await response.json();
 *   
 *   // Look for file processing events
 *   const syncEvents = items.filter(e => 
 *     e.type === 'dataset.file.sync' && 
 *     e.meta?.fileId === fileId
 *   );
 *   
 *   return syncEvents[0]?.status === 'completed';
 * };
 *
 * // Wait for completion
 * while (!(await checkProgress())) {
 *   await new Promise(resolve => setTimeout(resolve, 5000));
 * }
 * ```
 *
 * ### Re-synchronization and Updates
 *
 * If you update a file's content (by uploading a new version), the file attachment doesn't automatically detect the change. You need to manually trigger synchronization again to refresh the dataset with updated content:
 *
 * ```javascript
 * // Upload new file version
 * const newFileResponse = await fetch('/api/v1/file/create', {
 *   method: 'POST',
 *   body: formData
 * });
 * const { id: newFileId } = await newFileResponse.json();
 *
 * // Detach old file and remove its records
 * await fetch(`/api/v1/dataset/${datasetId}/file/${oldFileId}/detach`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ deleteRecords: true })
 * });
 *
 * // Attach new file version
 * await fetch(`/api/v1/dataset/${datasetId}/file/${newFileId}/attach`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ type: 'source' })
 * });
 *
 * // Sync new version
 * await fetch(`/api/v1/dataset/${datasetId}/file/${newFileId}/sync`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({})
 * });
 * ```
 *
 * ### Rate Limiting
 *
 * The sync endpoint implements rate limiting to prevent excessive queue load:
 * - **Limit**: 1 sync request per 2 minutes per file attachment
 * - **Purpose**: Prevents accidental rapid re-syncing of the same file
 * - **Scope**: Applied per authenticated session
 *
 * If you need to re-sync multiple files rapidly, stagger your sync requests or wait for the rate limit window to reset. The rate limit applies per file, so you can sync different files concurrently without hitting limits.
 *
 * ### Synchronization Performance
 *
 * Sync processing time varies based on several factors:
 *
 * **Small Text Files** (< 100 KB): Usually process in under 30 seconds
 * **Medium Documents** (100 KB - 1 MB): Typically 1-3 minutes
 * **Large Documents** (1-10 MB): May take 5-15 minutes
 * **Very Large Files** (> 10 MB): Can require 15-30+ minutes
 *
 * **PDF Complexity**: Image-heavy PDFs or those requiring OCR take significantly longer than text-based PDFs due to image processing requirements.
 *
 * **Concurrent Processing**: Multiple file syncs for the same dataset are processed sequentially to maintain consistency, so queuing delays may occur during bulk operations.
 *
 * ### Error Handling
 *
 * Common sync failures and their causes:
 *
 * **File Format Not Supported**: The file type cannot be processed for text extraction. Check that your file format is in the supported list.
 *
 * **Corrupted File**: The file cannot be read or parsed. Verify file integrity and try uploading again.
 *
 * **Empty Content**: The file contains no extractable text. This can occur with image-only PDFs when OCR fails or with binary files mistakenly attached.
 *
 * **Processing Timeout**: Very large or complex files may exceed processing limits. Consider splitting large documents into smaller files.
 *
 * **Storage Limits**: Your account's record or storage limits may be reached. Check usage and upgrade if necessary.
 *
 * Check the dataset event log for detailed error messages when sync operations fail.
 *
 * ### Best Practices
 *
 * **Batch Attachments, Then Sync**: When adding multiple files, attach them all first, then trigger synchronization. This reduces queue overhead and provides better performance than alternating attach/sync operations.
 *
 * **Schedule Large Syncs**: For processing many large files, consider scheduling sync operations during off-peak hours to ensure adequate processing resources and avoid user-facing delays.
 *
 * **Monitor and Validate**: After synchronization completes, verify that records were created successfully by checking the dataset record count and performing test searches.
 *
 * **Optimize File Preparation**: Clean up documents before upload - remove unnecessary pages, compress images, and eliminate non-textual content to improve processing speed and quality.
 *
 * **Handle Failures Gracefully**: Implement retry logic with exponential backoff for sync operations that fail due to temporary issues.
 *
 * **Use Webhooks**: Configure webhooks to receive notifications when sync operations complete, enabling event-driven workflows instead of polling.
 *
 * ### Integration Patterns
 *
 * **Pattern 1: Bulk Knowledge Base Creation**
 *
 * Upload and sync multiple documents to build a comprehensive knowledge base:
 *
 * ```javascript
 * // Upload all files
 * const fileIds = await Promise.all(
 *   documents.map(async doc => {
 *     const formData = new FormData();
 *     formData.append('file', doc);
 *     const res = await fetch('/api/v1/file/create', {
 *       method: 'POST',
 *       body: formData
 *     });
 *     return (await res.json()).id;
 *   })
 * );
 *
 * // Attach all files
 * await Promise.all(
 *   fileIds.map(fileId =>
 *     fetch(`/api/v1/dataset/${datasetId}/file/${fileId}/attach`, {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ type: 'source' })
 *     })
 *   )
 * );
 *
 * // Sync all files with rate limit awareness
 * for (const fileId of fileIds) {
 *   await fetch(`/api/v1/dataset/${datasetId}/file/${fileId}/sync`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({})
 *   });
 *   await new Promise(resolve => setTimeout(resolve, 2100)); // Rate limit buffer
 * }
 * ```
 *
 * **Pattern 2: Continuous Document Updates**
 *
 * Keep dataset in sync with external document repository:
 *
 * ```javascript
 * // Detect document changes in external system
 * const updatedDocs = await checkForDocumentUpdates();
 *
 * for (const doc of updatedDocs) {
 *   // Remove old version
 *   await fetch(
 *     `/api/v1/dataset/${datasetId}/file/${doc.oldFileId}/detach`,
 *     {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ deleteRecords: true })
 *     }
 *   );
 *
 *   // Upload and sync new version
 *   const uploadRes = await uploadDocument(doc.newVersion);
 *   const { id: newFileId } = await uploadRes.json();
 *
 *   await fetch(`/api/v1/dataset/${datasetId}/file/${newFileId}/attach`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ type: 'source' })
 *   });
 *
 *   await fetch(`/api/v1/dataset/${datasetId}/file/${newFileId}/sync`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({})
 *   });
 * }
 * ```
 *
 * **Important**: Synchronization requires an active file attachment. Ensure the file is attached before attempting to sync. Attempting to sync a detached file will result in a 404 Not Found error.
 */
