// @ts-check
import { validateSelectors } from '@chatbotkit-dev/file-html/parse'
import { THREE_MONTHS_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

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
 * /integration/sitemap/{sitemapIntegrationId}/update:
 *   post:
 *     operationId: updateSitemapIntegration
 *     summary: Update a Sitemap integration
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
 *         description: The Sitemap integration was updated successfully
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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const sitemapIntegration =
        await prisma.sitemapIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'sitemapIntegrationId')
        )

      if (!sitemapIntegration) {
        return notFound()
      }

      if (sitemapIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.sitemapIntegration.update({
        where: {
          id: sitemapIntegration.id,
        },

        data: {
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

          meta: getMeta(meta, sitemapIntegration.meta),
        },
      })

      return ok({ id: sitemapIntegration.id })
    })
  )
)

/**
 * @manual Sitemap Integration
 * @index 30
 *
 * ## Updating Sitemap Integration Configuration
 *
 * To modify the configuration of an existing sitemap integration, including changing
 * target URLs, adjusting crawling rules, updating content selectors, or modifying
 * synchronization schedules, use the update endpoint. This operation enables you to
 * adapt your web content crawling strategy as websites evolve, refine content extraction
 * rules for better accuracy, or adjust crawl frequency based on content update patterns.
 *
 * Sitemap integration updates are particularly valuable when website structures change,
 * requiring updated CSS selectors or glob patterns to correctly identify and extract
 * content. You can also use updates to enable or disable JavaScript rendering based on
 * website technology changes, redirect crawling to new URLs or domains, or modify record
 * expiration policies to align with content freshness requirements.
 *
 * ```http
 * POST /api/v1/integration/sitemap/{sitemapIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Documentation Crawler",
 *   "description": "Crawls product and API documentation",
 *   "url": "https://docs.example.com/sitemap.xml",
 *   "selectors": "article.docs-content, div.api-reference",
 *   "javascript": true,
 *   "syncSchedule": "@daily"
 * }
 * ```
 *
 * **Updatable Configuration Fields:**
 *
 * - **name**: Update the integration's display name for better organization
 * - **description**: Modify the description to reflect current crawling scope or purpose
 * - **blueprintId**: Reassign the integration to a different blueprint for organizational purposes
 * - **datasetId**: Change the target dataset where crawled content is stored
 * - **url**: Update the sitemap URL or starting page for the crawler
 * - **glob**: Modify URL pattern matching rules
 * - **selectors**: Update CSS selectors for content extraction (e.g., `article.content, main.documentation`)
 * - **javascript**: Enable/disable JavaScript execution before content extraction
 * - **syncSchedule**: Adjust crawl frequency (`@hourly`, `@daily`, `@weekly`, or cron expressions)
 * - **expiresIn**: Modify record expiration time in milliseconds (max: 3 months)
 * - **meta**: Update custom metadata for tracking or organizational purposes
 *
 * **Common Update Scenarios:**
 *
 * **Updating Selectors After Website Redesign:**
 * ```json
 * {
 *   "selectors": "main.new-content-wrapper, article.post-body"
 * }
 * ```
 * Essential when websites change their HTML structure or CSS classes.
 *
 * **Enabling JavaScript for SPA Content:**
 * ```json
 * {
 *   "javascript": true
 * }
 * ```
 * Required when sites migrate from static HTML to React, Vue, or Angular.
 *
 * **Refining Crawl Scope with Glob Patterns:**
 * ```json
 * {
 *   "glob": "https://docs.example.com/api/** https://docs.example.com/guides/**"
 * }
 * ```
 * Useful for including specific sections while excluding others (e.g., skipping blog posts).
 *
 * **Adjusting Crawl Frequency:**
 * ```json
 * {
 *   "syncSchedule": "0 9 * * 1"
 * }
 * ```
 * Use cron expressions for custom schedules (this example: every Monday at 9:00 AM).
 *
 * **Important Considerations:**
 *
 * - Configuration changes take effect on the next scheduled crawl, not immediately
 * - Changing selectors may result in different content being extracted from previously crawled pages
 * - Enabling JavaScript significantly increases crawl time and resource usage
 * - Changing the dataset redirects future crawls; existing records in the old dataset remain
 * - Glob patterns must be valid and properly escaped for special characters
 * - The `expiresIn` value must be between 0 and three months (7,776,000,000 milliseconds)
 *
 * **Testing Updated Configurations:** After updating crawling rules, consider triggering
 * a manual sync to verify that the new selectors, glob patterns, or JavaScript settings
 * correctly extract the desired content. Monitor the crawl results to ensure accuracy
 * before relying on automatic scheduled syncs.
 *
 * **Performance Impact:** Changes to the `javascript` setting, `glob` patterns, or
 * `selectors` can significantly affect crawl performance and resource consumption. Enable
 * JavaScript only when necessary, use specific glob patterns to limit crawl scope, and
 * ensure selectors are as specific as possible to avoid extracting unwanted content.
 */
