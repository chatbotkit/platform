// @ts-check
import { validateSelectors } from '@chatbotkit-dev/file-html/parse'
import { THREE_MONTHS_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import datasetIdSchema from '@/schemas/datasetId'
import dbStringSchema from '@/schemas/dbString'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import { fairSyncScheduleSchema } from '@/schemas/schedule'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  datasetId: datasetIdSchema('manipulate'),

  url: dbStringSchema.uri({
    scheme: ['http', 'https'],
  }),

  glob: dbStringSchema,

  selectors: dbStringSchema.custom((value) => {
    if (value) {
      const { valid, message } = validateSelectors(value)

      if (!valid) {
        throw new Error(message)
      }
    }

    return value
  }, 'selectors'),

  javascript: schema.boolean().default(false),

  syncSchedule: fairSyncScheduleSchema,

  expiresIn: schema
    .number()
    .min(0)
    .max(THREE_MONTHS_IN_MILLISECONDS)
    .allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/sitemap/create:
 *   post:
 *     operationId: createSitemapIntegration
 *     summary: Create Sitemap integration
 *     tags:
 *       - Sitemap Integration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   datasetId:
 *                     description: The ID of the dataset to use for this Sitemap integration
 *                     type: string
 *                   url:
 *                     description: The URL to use for this Sitemap integration
 *                     type: string
 *                   glob:
 *                     description: The glob rules to use for this Sitemap integration
 *                     type: string
 *                   selectors:
 *                     description: The selector rules to use for this Sitemap integration
 *                     type: string
 *                   javascript:
 *                     description: Indicates if the Sitemap integration should use JavaScript during the spidering process
 *                     type: boolean
 *                   syncSchedule:
 *                     description: The sync schedule to use for this Sitemap integration
 *                     type: string
 *                   expiresIn:
 *                     description: Record expiry in milliseconds
 *                     type: number
 *     responses:
 *       200:
 *         description: The Sitemap integration was created successfully
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
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        datasetId: dataset,

        url,

        glob,

        selectors,

        javascript,

        syncSchedule,

        expiresIn,

        meta,
      } = body

      const { id } = await prisma.sitemapIntegration.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          datasetId: dataset?.id || dataset,

          // resource specific

          url,

          glob,

          selectors,

          javascript,

          syncSchedule,

          expiresIn,

          // meta and others

          meta,
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)

/**
 * @manual Sitemap Integration
 * @description Automatically crawl and sync website content into datasets by providing a sitemap URL, enabling your AI agents to search and reference web content in conversations.
 * @category Integrations
 * @tags sitemap, web-crawling, integration, sync
 * @index 31
 *
 * Sitemap Integration enables you to automatically crawl and index website
 * content into datasets, making web pages searchable and accessible to your
 * AI agents. By providing a sitemap.xml URL or website URL, the integration
 * discovers and syncs all linked pages, extracting text content and metadata
 * for knowledge retrieval.
 *
 * This is particularly useful for building chatbots that answer questions based
 * on documentation sites, knowledge bases, blogs, or any web content you want
 * to make available to your AI agents.
 *
 * ## Creating a Sitemap Integration
 *
 * To create a sitemap integration, you need to provide the website or sitemap
 * URL and specify which dataset should receive the crawled content. The
 * integration will automatically discover pages through sitemap.xml files or
 * by crawling links, extracting content and storing it as searchable records.
 *
 * ```http
 * POST /api/v1/integration/sitemap/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Product Documentation",
 *   "description": "Crawls our docs site for support chatbot",
 *   "datasetId": "dataset-abc123",
 *   "url": "https://docs.example.com/sitemap.xml",
 *   "glob": "**\/docs/**",
 *   "selectors": "article.content, div.documentation",
 *   "javascript": false,
 *   "syncSchedule": "0 0 * * *",
 *   "expiresIn": 7776000000
 * }
 * ```
 *
 * ## Advanced Configuration Options
 *
 * **URL Filtering with Glob Patterns**: The `glob` parameter allows you to
 * filter which pages to crawl using glob patterns. For example, `"**\/blog/**"`
 * only crawls blog posts, while `"**\/docs/**"` focuses on documentation pages.
 *
 * **Content Extraction with CSS Selectors**: The `selectors` parameter specifies
 * which HTML elements to extract content from using CSS selectors. This helps
 * focus on main content and exclude navigation, footers, and other UI elements.
 * Multiple selectors can be comma-separated.
 *
 * **JavaScript Rendering**: Set `javascript: true` to enable JavaScript execution
 * during crawling, necessary for single-page applications or dynamic content.
 * This increases crawl time but ensures complete content extraction.
 *
 * **Sync Scheduling**: Use cron expressions to control crawl frequency. Daily
 * syncs ("0 0 * * *") work well for most documentation sites, while more
 * frequent syncs may be needed for rapidly changing content.
 *
 * **Record Expiration**: The `expiresIn` parameter (in milliseconds) determines
 * how long crawled pages are retained. Set to 90 days (7776000000ms) for
 * typical documentation, or null for permanent retention.
 *
 * **Warning:** Large websites may take significant time to crawl initially. The
 * integration processes pages incrementally and subsequent syncs only update
 * changed content for efficiency.
 */
