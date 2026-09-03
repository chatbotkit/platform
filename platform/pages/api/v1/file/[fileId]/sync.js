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
 * /file/{fileId}/sync:
 *   post:
 *     operationId: syncFile
 *     summary: Sync file
 *     tags:
 *       - File
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           description: The ID of the file to sync
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
 *         description: The file was synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the file
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionRate(1, '2 m', async function (req, session) {
    const file = await prisma.file.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'fileId'),
      {
        include: {
          datasets: {
            select: {
              datasetId: true,
            },
          },
        },
      }
    )

    if (!file) {
      return notFound()
    }

    if (file.userId !== session.user.id) {
      return notAuthorized()
    }

    await Promise.all(
      file.datasets.map(async ({ datasetId }) => {
        await sendEvent(datasetId, {
          type: 'importFile',
          payload: {
            fileId: file.id,
          },
        })
      })
    )

    return ok({ id: file.id })
  })
)

/**
 * @manual Files
 *
 * ## Syncing Files to Datasets
 *
 * File synchronization is a critical operation when using files as data sources
 * for datasets. The sync endpoint triggers the import process that reads the
 * file content and creates or updates records in all datasets where the file is
 * attached.
 *
 * Files are not automatically processed when uploaded or attached to datasets.
 * This design gives you explicit control over when file content is imported,
 * allowing you to prepare and verify files before triggering potentially
 * expensive processing operations. The sync operation must be explicitly
 * requested when you're ready to import the file data.
 *
 * To sync a file to its associated datasets, make a POST request to the sync
 * endpoint:
 *
 * ```http
 * POST /api/v1/file/{fileId}/sync
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{fileId}` with the ID of the file you want to sync. Even though this
 * endpoint doesn't require any body parameters, you must still send a POST
 * request with an empty JSON object.
 *
 * ### How File Sync Works
 *
 * When you trigger a file sync:
 *
 * 1. **Dataset Discovery**: The system identifies all datasets where this file
 *    is currently attached
 * 2. **Queue Processing**: Sync events are queued for each associated dataset,
 *    ensuring reliable processing even under high load
 * 3. **Asynchronous Import**: The file content is processed asynchronously in
 *    the background, parsing the file and creating dataset records
 * 4. **Event Logging**: Progress and results are recorded in the dataset event
 *    log, which you can monitor to track sync status
 *
 * The sync operation returns immediately after queuing the sync events, rather
 * than waiting for processing to complete. This prevents timeouts for large
 * files and allows you to continue with other operations while the import runs
 * in the background.
 *
 * ### Rate Limiting
 *
 * The sync endpoint has rate limiting to prevent excessive resource usage. You
 * can trigger a sync for a specific file once every 2 minutes. This prevents
 * duplicate processing and ensures system stability.
 *
 * If you attempt to sync a file more frequently than allowed, you'll receive a
 * rate limit error. Wait for the rate limit window to expire before triggering
 * another sync.
 *
 * ### Use Cases
 *
 * - **Initial Import**: After uploading and attaching a file to a dataset, sync
 *   to import the initial data
 * - **Content Updates**: When you re-upload a file with updated content, sync
 *   to refresh dataset records
 * - **Multi-Dataset Import**: Trigger import across all datasets where the file
 *   is attached with a single sync operation
 *
 * **Important Note**: If a file is not attached to any datasets, the sync
 * operation will succeed but won't perform any processing. Ensure your file is
 * properly attached to datasets before syncing.
 */
