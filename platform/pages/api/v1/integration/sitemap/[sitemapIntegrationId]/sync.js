// @ts-check
import { clamp } from '@chatbotkit-dev/math'
import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import limitsConfig from '@/config/limits'

import prisma from '@/prisma/client'
import { Schedule, SyncStatus } from '@/prisma/types'

import { runBatchJobAsync } from '@/lib/batch'
import debug from '@/lib/debug'
import { makeGlobUrl } from '@/lib/glob'
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
import {
  shouldSkipCrawl,
  shouldSkipHTML,
  shouldSkipJSONLD,
  shouldSkipMicrodata,
  shouldSkipSitemap,
} from '@/lib/selector'
import { getTemporaryUserToken } from '@/lib/session.temp'
import { revealUserPlan } from '@/lib/user.plan'

import {
  IMPORT_BLOB_EVENT_TYPE,
  IMPORT_JOB_END_EVENT_TYPE,
  IMPORT_JOB_START_EVENT_TYPE,
} from '@/pages/api/v1/dataset/[datasetId]/queue'

/**
 * @param {import('@/prisma/types').SitemapIntegration & { user: import('@/prisma/types').User}} sitemapIntegration
 * @returns {Promise<void>}
 */
export async function doSync(sitemapIntegration) {
  if (!sitemapIntegration.datasetId) {
    throwConflict('No dataset specified')

    return
  }

  if (!(await databaseLimitsOk(sitemapIntegration.user, ['database/record']))) {
    debug(`aborting due to exceeded limits`)

    return
  }

  if (!sitemapIntegration.url) {
    debug(`aborting due to missing url`)

    await prisma.sitemapIntegration.update({
      where: { id: sitemapIntegration.id },
      data: { syncSchedule: Schedule.never },
    })

    return
  }

  let url

  try {
    url = new URL(sitemapIntegration.url)
  } catch {
    await prisma.sitemapIntegration.update({
      where: { id: sitemapIntegration.id },
      data: { syncSchedule: Schedule.never },
    })

    throw new Error(`SitemapIntegration invalid url: ${sitemapIntegration.url}`)
  }

  // @note set status to pending at the start of sync - the job runs async via
  // Apify so the synced/error status is set in handleImportJobEndEvent when the
  // job completes
  //
  // @note we also update lastSyncedAt here to prevent the scheduler from
  // re-triggering the sync while it's still running. If this job times out
  // or fails, the stalled cleanup handler will reset the status.

  await prisma.sitemapIntegration.update({
    where: { id: sitemapIntegration.id },
    data: { syncStatus: SyncStatus.pending, lastSyncedAt: new Date() },
  })

  const globs = (sitemapIntegration.glob || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l)
    .map((g) => {
      if (g.startsWith('!')) {
        return '!' + makeGlobUrl(url.origin, g.substring(1))
      } else {
        return makeGlobUrl(url.origin, g)
      }
    })

  // if no globs are specified, we will use the default glob

  if (!globs.length) {
    globs.push(makeGlobUrl(url.origin, '/**'))
  }

  // if all globs, add a default glob as well

  if (globs.every((g) => g.startsWith('!'))) {
    globs.push(makeGlobUrl(url.origin, '/**'))
  }

  const { plan } = await revealUserPlan(sitemapIntegration.user)

  const { maxUrls, maxTime, engines, memory } =
    limitsConfig[plan].sitemapIntegration

  const preferredEngine = sitemapIntegration.javascript
    ? 'puppeteer'
    : 'cheerio'

  const engine = engines.includes(preferredEngine) ? preferredEngine : 'cheerio'

  const scheduleIn = syncScheduleToMilliseconds(sitemapIntegration.syncSchedule)

  const queueUrl = new URL(getExternalAPIHostURL())

  // We deliberately assign the path here instead of using the constructor in
  // order to avoid injection attacks. It is not a big deal though.

  queueUrl.pathname = `/api/v1/dataset/${sitemapIntegration.datasetId}/ingest`

  // @note the runner is given a token scoped to that one route, for a little
  // longer than the job may run. It used to be handed this deployment's QStash
  // token instead - a vendor credential, valid for everything that vendor can
  // do, travelling into a container the platform starts but does not control.
  //
  // The lifetime is derived from the job's own timeout rather than the default
  // fifteen minutes: a crawl may run for an hour, and a token expiring midway
  // would drop the tail of an import with nothing to show for it.

  const queueToken = await getTemporaryUserToken(sitemapIntegration.userId, {
    durationInSeconds: maxTime * 60 + QUARTER_HOUR_IN_SECONDS,

    allowedRoutes: [
      `/api/v1/dataset/${sitemapIntegration.datasetId}/ingest`,
      `/v1/dataset/${sitemapIntegration.datasetId}/ingest`,
    ],
  })

  /**
   * @type {{
   *   urls: Array<{url: string}>,
   *   globs: Array<{glob: string}>,
   *   selectors?: string,
   *   skipSitemap?: boolean,
   *   skipCrawl?: boolean,
   *   skipHTML?: boolean,
   *   skipJSONLD?: boolean,
   *   skipMicrodata?: boolean,
   *   engine: string,
   *   maxUrls?: number,
   *   userAgentExtra?: string,
   *   expiresAt?: number,
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

    urls: [
      {
        url: url.toString(),
      },
    ],

    globs: globs.map((glob) => ({ glob })),

    engine: engine,

    // dataset

    expiresAt: sitemapIntegration.expiresIn
      ? Date.now() + sitemapIntegration.expiresIn
      : scheduleIn
      ? Date.now() + scheduleIn
      : undefined,

    // limits

    maxUrls: clamp(maxUrls, 10, 100000),

    // queue

    queueUrl: queueUrl.toString(),
    queueToken,
    queueImportBlobEventType: IMPORT_BLOB_EVENT_TYPE,
    queueJobStartEventType: IMPORT_JOB_START_EVENT_TYPE,
    queueJobEndEventType: IMPORT_JOB_END_EVENT_TYPE,

    // persisted with imported records so callbacks can identify the integration

    context: {
      sitemapIntegrationId: sitemapIntegration.id,
    },

    meta: {
      // add whatever else metadata you need here

      integration: 'sitemap',
    },

    // @note selectors is expected to be a string but selectors itself can
    // be a null value, hence why we are doing the following

    selectors: sitemapIntegration.selectors || undefined,

    // set other flags

    skipSitemap: shouldSkipSitemap(sitemapIntegration.selectors),
    skipCrawl: shouldSkipCrawl(sitemapIntegration.selectors),

    // set what we want to extract

    skipHTML: shouldSkipHTML(sitemapIntegration.selectors),
    skipJSONLD: shouldSkipJSONLD(sitemapIntegration.selectors),
    skipMicrodata: shouldSkipMicrodata(sitemapIntegration.selectors),
  }

  debug(`launching task`, { input })

  // @note pass input as JSON-encoded BATCH_INPUT environment variable
  await runBatchJobAsync({
    image: 'ghcr.io/chatbotkit/runner-sitemap:latest',
    manifest_ttl: 60, // 1 minute in seconds
    env: {
      BATCH_INPUT: JSON.stringify(input),
    },
    timeout: maxTime * 60,
    memory: {
      cheerio: memory.cheerio,
      puppeteer: memory.puppeteer,
    }[engine],
    disk: 8192, // 8GB
  })
}

/**
 * @swagger
 *
 * /integration/sitemap/{sitemapIntegrationId}/sync:
 *   post:
 *     operationId: syncSitemapIntegration
 *     summary: Sync a Sitemap integration
 *     tags:
 *       - Sitemap Integration
 *     parameters:
 *       - in: path
 *         name: sitemapIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Sitemap integration
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
 *         description: The Sitemap integration was scheduled for syncing successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Sitemap Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionRate(1, '15 m', async function (req, session) {
    const sitemapIntegration =
      await prisma.sitemapIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'sitemapIntegrationId'),
        {
          include: {
            user: true,
          },
        }
      )

    if (!sitemapIntegration) {
      return notFound()
    }

    if (sitemapIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    if (!sitemapIntegration.datasetId) {
      return conflict('No dataset specified')
    }

    try {
      await doSync(sitemapIntegration)
    } catch (e) {
      return respondFromError(e)
    }

    return ok({ id: sitemapIntegration.id })
  })
)

/**
 * @manual Sitemap Integration
 *
 * ## Syncing Website Content
 *
 * Syncing a sitemap integration initiates the process of crawling and
 * importing content from websites into a ChatBotKit dataset, transforming
 * your web pages, documentation sites, and online content into searchable
 * knowledge bases for your conversational AI bots. This powerful capability
 * enables your bots to answer questions based on your website content,
 * documentation, blog posts, and other web-based information.
 *
 * The sync operation runs asynchronously as a background task, discovering
 * pages through sitemaps or URL patterns, extracting content using
 * configurable methods, and populating your dataset with structured,
 * searchable records. It supports sophisticated filtering, content
 * extraction strategies, and plan-based limits to handle websites of
 * various sizes and complexities.
 *
 * ```http
 * POST /api/v1/integration/sitemap/{sitemapIntegrationId}/sync
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### Crawl Process and Content Extraction
 *
 * When you trigger a sync operation, the system launches an asynchronous
 * web crawler that discovers pages starting from your configured URL. The
 * crawler intelligently follows links, respects glob patterns for URL
 * filtering, and extracts content using your specified engine (Cheerio
 * for static content or Puppeteer for JavaScript-rendered pages).
 *
 * The crawler supports multiple content extraction strategies including
 * HTML parsing, JSON-LD structured data, microdata, and sitemap-based
 * discovery. You can configure which methods to use based on your website's
 * structure and content format. The system automatically cleans and
 * structures extracted content for optimal searchability and conversational
 * use.
 *
 * Content discovery respects glob patterns that you've configured on the
 * integration, allowing you to include specific URL patterns and exclude
 * others. For example, you might include `/docs/**` to crawl documentation
 * while excluding `/blog/**` to skip blog posts. The crawler processes
 * only URLs matching your inclusion patterns while skipping those matching
 * exclusion patterns.
 *
 * ### URL Filtering and Glob Patterns
 *
 * The integration uses glob patterns to control which URLs get crawled and
 * indexed. Patterns are evaluated against full URLs, allowing precise
 * control over content inclusion. You can specify patterns like `/docs/**`
 * to match all documentation pages, or `!/admin/**` to exclude
 * administrative sections.
 *
 * When no glob patterns are specified, the system defaults to crawling all
 * pages under the configured URL using a `/**` pattern. This ensures that
 * basic setups work without requiring pattern configuration, while still
 * allowing sophisticated filtering when needed.
 *
 * ### Crawl Engines and Rendering
 *
 * The integration supports two crawling engines with different capabilities:
 *
 * **Cheerio Engine**: Fast, lightweight parsing of static HTML content.
 * This engine works well for traditional server-rendered websites and
 * documentation sites where content is present in the initial HTML response.
 * It's more resource-efficient and faster for static content.
 *
 * **Puppeteer Engine**: Full browser rendering for JavaScript-heavy websites
 * and single-page applications. This engine executes JavaScript and waits
 * for dynamic content to render, making it suitable for modern web
 * applications that depend on client-side rendering. It requires more
 * resources but handles complex websites effectively.
 *
 * ### Rate Limiting and Plan Limits
 *
 * Manual sync operations are rate-limited to once every 15 minutes per
 * integration, preventing excessive API usage and ensuring system stability.
 * This rate limit applies to manual triggers but doesn't affect scheduled
 * automatic syncs configured on the integration.
 *
 * The crawler respects plan-based limits for both URL count and execution
 * time. These limits ensure fair resource usage across the platform while
 * providing sufficient capacity for typical websites. Higher-tier plans
 * offer increased limits for larger websites and more comprehensive crawls.
 *
 * ### Prerequisites and Validation
 *
 * Before syncing, the system validates several requirements:
 *
 * **Dataset Association**: The integration must be connected to a dataset
 * where website content will be imported. Syncing without a dataset
 * association results in a conflict error.
 *
 * **Valid URL**: The configured URL must be valid and accessible. Invalid
 * URLs cause the sync to fail and may automatically disable scheduled syncs
 * to prevent repeated failures.
 *
 * **Available Resources**: Your account must have sufficient dataset record
 * limits. The system checks limits before beginning the crawl to prevent
 * partial imports that exceed plan allocations.
 *
 * ### Content Freshness and Updates
 *
 * Each successful sync updates the `lastSyncedAt` timestamp on the
 * integration, helping you track content freshness and sync frequency.
 * If you've configured automatic sync scheduling, this timestamp reflects
 * the most recent sync whether manual or automatic.
 *
 * Depending on your sync configuration, records may have expiration times
 * that automatically remove outdated content from your dataset. This ensures
 * your conversational AI always works with current information from your
 * website.
 *
 * **Note**: This operation is rate-limited to once every 15 minutes per
 * integration. Attempting to sync more frequently will result in a rate
 * limit error. For continuous updates, configure automatic sync scheduling
 * on the integration instead of frequent manual triggers.
 */
