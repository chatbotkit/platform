// @ts-check
import { clamp } from '@chatbotkit-dev/math'
import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import limitsConfig from '@/config/limits'

import prisma from '@/prisma/client'
import { SyncStatus } from '@/prisma/types'

import { runBatchJobAsync } from '@/lib/batch'
import debug from '@/lib/debug'
import { getExternalAPIHostURL } from '@/lib/host'
import { databaseLimitsOk } from '@/lib/limit.core'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { withSessionRate } from '@/lib/rate'
import {
  conflict,
  notAuthorized,
  notFound,
  ok,
  respondFromError,
  throwConflict,
} from '@/lib/response'
import { syncScheduleToMilliseconds } from '@/lib/schedule'
import { getTemporaryUserToken } from '@/lib/session.temp'
import { revealUserPlan } from '@/lib/user.plan'

import {
  IMPORT_BLOB_EVENT_TYPE,
  IMPORT_JOB_END_EVENT_TYPE,
  IMPORT_JOB_START_EVENT_TYPE,
} from '@/pages/api/v1/dataset/[datasetId]/queue'

/**
 * @param {import('@/prisma/types').NotionIntegration & { user: import('@/prisma/types').User}} notionIntegration
 * @returns {Promise<void>}
 */
export async function doSync(notionIntegration) {
  if (!notionIntegration.datasetId) {
    throwConflict('No dataset specified')

    return
  }

  if (!(await databaseLimitsOk(notionIntegration.user, ['database/record']))) {
    debug(`aborting due to exceeded limits`)

    return
  }

  // @note set status to pending at the start of sync - the job runs async via
  // Apify so the synced/error status is set in handleImportJobEndEvent when the
  // job completes
  //
  // @note we also update lastSyncedAt here to prevent the scheduler from
  // re-triggering the sync while it's still running. If this job times out
  // or fails, the stalled cleanup handler will reset the status.

  await prisma.notionIntegration.update({
    where: { id: notionIntegration.id },
    data: { syncStatus: SyncStatus.pending, lastSyncedAt: new Date() },
  })

  const { plan } = await revealUserPlan(notionIntegration.user)

  const { maxPages, maxTime } = limitsConfig[plan].notionIntegration

  const scheduleIn = syncScheduleToMilliseconds(notionIntegration.syncSchedule)

  const queueUrl = new URL(getExternalAPIHostURL())

  // We deliberately assign the path here instead of using the constructor in
  // order to avoid injection attacks. It is not a big deal though.

  queueUrl.pathname = `/api/v1/dataset/${notionIntegration.datasetId}/ingest`

  // @note a token scoped to that one route, for a little longer than the job may
  // run. The runner used to be handed this deployment's QStash token instead -
  // see the same note on the sitemap sync.

  const queueToken = await getTemporaryUserToken(notionIntegration.userId, {
    durationInSeconds: maxTime * 60 + QUARTER_HOUR_IN_SECONDS,

    allowedRoutes: [
      `/api/v1/dataset/${notionIntegration.datasetId}/ingest`,
      `/v1/dataset/${notionIntegration.datasetId}/ingest`,
    ],
  })

  /**
   * @type {{
   *   notionToken: string,
   *   expiresAt?: number,
   *   maxPages: number,
   *   queueUrl: string,
   *   queueToken: string,
   *   queueImportBlobEventType: string,
   *   queueJobStartEventType: string,
   *   queueJobEndEventType: string,
   *   context: Record<string, unknown>,
   *   meta: Record<string, unknown>
   * }}
   */
  const input = {
    // basic information

    notionToken: notionIntegration.token,

    // dataset

    expiresAt: notionIntegration.expiresIn
      ? Date.now() + notionIntegration.expiresIn
      : scheduleIn
      ? Date.now() + scheduleIn
      : undefined,

    // limits

    maxPages: clamp(maxPages, 10, 100000),

    // queue

    queueUrl: queueUrl.toString(),
    queueToken,
    queueImportBlobEventType: IMPORT_BLOB_EVENT_TYPE,
    queueJobStartEventType: IMPORT_JOB_START_EVENT_TYPE,
    queueJobEndEventType: IMPORT_JOB_END_EVENT_TYPE,

    // persisted with imported records so callbacks can identify the integration

    context: {
      notionIntegrationId: notionIntegration.id,
    },

    meta: {
      // add whatever else metadata you need here

      integration: 'notion',
    },
  }

  debug(`launching task`, { input })

  // @note pass input as JSON-encoded BATCH_INPUT environment variable
  await runBatchJobAsync({
    image: 'ghcr.io/chatbotkit/runner-notion:latest',
    manifest_ttl: 60, // 1 minute in seconds
    env: {
      BATCH_INPUT: JSON.stringify(input),
    },
    timeout: maxTime * 60,
    memory: 512,
  })
}

/**
 * @swagger
 *
 * /integration/notion/{notionIntegrationId}/sync:
 *   post:
 *     operationId: syncNotionIntegration
 *     summary: Sync Notion integration
 *     tags:
 *       - Notion Integration
 *     parameters:
 *       - in: path
 *         name: notionIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Notion integration
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
 *         description: The Notion integration was synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the synced Notion integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionRate(1, '15 m', async function (req, session) {
    const notionIntegration =
      await prisma.notionIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'notionIntegrationId'),
        {
          include: {
            user: true,
          },
        }
      )

    if (!notionIntegration) {
      return notFound()
    }

    if (notionIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    if (!notionIntegration.datasetId) {
      return conflict('No dataset specified')
    }

    try {
      await doSync(notionIntegration)
    } catch (e) {
      return respondFromError(e)
    }

    return ok({ id: notionIntegration.id })
  })
)

/**
 * @manual Notion Integration
 *
 * ## Syncing Notion Content
 *
 * Syncing a Notion integration initiates the process of importing content
 * from your Notion workspace into a ChatBotKit dataset, making your Notion
 * pages, databases, and knowledge accessible to your conversational AI bots.
 * This synchronization process extracts text content, maintains document
 * structure, and populates your dataset with searchable, conversable
 * information from Notion.
 *
 * The sync operation runs asynchronously as a background task, processing
 * your Notion workspace according to configured limits and schedules. It
 * respects rate limiting to ensure system stability and processes content
 * incrementally, allowing you to work with large Notion workspaces without
 * overwhelming system resources.
 *
 * ```http
 * POST /api/v1/integration/notion/{notionIntegrationId}/sync
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### Sync Process and Behavior
 *
 * When you trigger a sync operation, the system launches an asynchronous
 * worker that connects to your Notion workspace using the configured
 * authentication token. The worker discovers pages and databases, extracts
 * content, and imports it into the associated dataset as searchable records.
 *
 * The sync respects plan-based limits for both the number of pages processed
 * and the maximum execution time. These limits ensure fair resource usage
 * across the platform while allowing sufficient processing capacity for
 * typical Notion workspaces. The system automatically applies appropriate
 * limits based on your account plan.
 *
 * Content extracted from Notion is processed and stored as dataset records
 * with metadata indicating their source. Each record includes the page
 * content, structural information, and references back to the original
 * Notion pages. This metadata enables traceability and helps maintain
 * connections between your dataset and source documents.
 *
 * ### Rate Limiting and Scheduling
 *
 * Manual sync operations are rate-limited to prevent excessive API usage
 * and ensure system stability. You can trigger a manual sync once every
 * 15 minutes per integration. This rate limit prevents accidental duplicate
 * syncs while still allowing reasonable manual control over content updates.
 *
 * If you've configured automatic sync scheduling on the integration, manual
 * syncs work alongside scheduled syncs. The `lastSyncedAt` timestamp is
 * updated after each successful sync, whether manual or automatic, helping
 * you track content freshness and sync frequency.
 *
 * ### Prerequisites and Requirements
 *
 * Before syncing a Notion integration, ensure:
 *
 * **Dataset Association**: The integration must be connected to a dataset
 * where Notion content will be imported. Attempting to sync without a
 * dataset will result in a conflict error.
 *
 * **Valid Authentication**: The Notion token must be valid and have
 * appropriate permissions to access the workspace content you want to sync.
 * Expired or revoked tokens will cause sync failures.
 *
 * **Available Resources**: Your account must have sufficient dataset record
 * limits available. The system checks limits before beginning the sync to
 * prevent partial imports that exceed your plan allocation.
 *
 * ### Understanding Sync Results
 *
 * The sync operation returns immediately with the integration ID, but the
 * actual content import happens asynchronously in the background. You can
 * monitor sync progress by checking the `lastSyncedAt` timestamp on the
 * integration and reviewing dataset record counts.
 *
 * Successful syncs update the dataset with new and modified content from
 * Notion. The exact behavior depends on your sync configuration, including
 * whether records expire and how frequently content is refreshed.
 *
 * **Note**: This operation is rate-limited to once every 15 minutes per
 * integration. Attempting to sync more frequently will result in a rate
 * limit error.
 */
