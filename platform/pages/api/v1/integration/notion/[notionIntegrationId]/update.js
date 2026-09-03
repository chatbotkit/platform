// @ts-check
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

  token: schema.string().allow(null, ''),

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
 * /integration/notion/{notionIntegrationId}/update:
 *   post:
 *     operationId: updateNotionIntegration
 *     summary: Update a Notion integration
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
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   datasetId:
 *                     description: The ID of the dataset to sync into
 *                     type: string
 *                   token:
 *                     description: The Notion API token
 *                     type: string
 *                   syncSchedule:
 *                     description: The sync schedule
 *                     type: string
 *                   expiresIn:
 *                     description: The time in milliseconds until records expire
 *                     type: number
 *     responses:
 *       200:
 *         description: The Notion integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Notion Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      let {
        alias,

        name,
        description,

        blueprintId: blueprint,

        datasetId: dataset,

        token,

        syncSchedule,

        expiresIn,

        meta,
      } = body

      if (token === '********') {
        token = undefined
      }

      const notionIntegration =
        await prisma.notionIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'notionIntegrationId')
        )

      if (!notionIntegration) {
        return notFound()
      }

      if (notionIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.notionIntegration.update({
        where: {
          id: notionIntegration.id,
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

          token,

          syncSchedule,

          expiresIn,

          // meta and others

          meta: getMeta(meta, notionIntegration.meta),
        },
      })

      return ok({ id: notionIntegration.id })
    })
  )
)

/**
 * @manual Notion Integration
 * @index 30
 *
 * ## Updating Notion Integration Configuration
 *
 * To modify the configuration of an existing Notion integration, including changing
 * the target dataset, updating API credentials, adjusting sync schedules, or modifying
 * content expiration policies, use the update endpoint. This operation enables you to
 * adapt your Notion integration as your requirements evolve, such as redirecting content
 * to different datasets, increasing sync frequency for time-sensitive content, or
 * updating authentication tokens when they are rotated.
 *
 * Updating a Notion integration does not interrupt ongoing synchronization operations,
 * but configuration changes take effect on the next scheduled sync. This ensures that
 * in-progress operations complete successfully before new settings are applied. You
 * can update any combination of configuration parameters in a single request, and
 * unchanged fields will retain their existing values.
 *
 * ```http
 * POST /api/v1/integration/notion/{notionIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Company Wiki",
 *   "description": "Syncs engineering documentation from Notion",
 *   "datasetId": "dataset_new789",
 *   "syncSchedule": "@hourly",
 *   "expiresIn": 1209600000
 * }
 * ```
 *
 * **Updatable Configuration Fields:**
 *
 * - **name**: Update the integration's display name for better organization
 * - **description**: Modify the description to reflect current usage or purpose
 * - **blueprintId**: Reassign the integration to a different blueprint for organizational purposes
 * - **datasetId**: Change the target dataset where Notion content is synchronized
 * - **token**: Update the Notion API token when credentials are rotated or changed
 * - **syncSchedule**: Adjust how frequently content is synchronized (`@hourly`, `@daily`, `@weekly`, or cron expressions)
 * - **expiresIn**: Modify record expiration time in milliseconds (max: 3 months / 7,776,000,000 ms)
 * - **meta**: Update custom metadata for tracking or organizational purposes
 *
 * **Common Update Scenarios:**
 *
 * **Changing Sync Frequency:**
 * ```json
 * {
 *   "syncSchedule": "@hourly"
 * }
 * ```
 * Useful when content updates more frequently than initially anticipated.
 *
 * **Rotating API Credentials:**
 * ```json
 * {
 *   "token": "new_notion_api_token_v2"
 * }
 * ```
 * Required when Notion access tokens expire or are regenerated.
 *
 * **Redirecting to New Dataset:**
 * ```json
 * {
 *   "datasetId": "dataset_production_001"
 * }
 * ```
 * Useful when reorganizing knowledge bases or promoting from staging to production.
 *
 * **Important Considerations:**
 *
 * - Configuration changes take effect on the next scheduled sync, not immediately
 * - Changing the dataset will cause future syncs to populate the new dataset; existing data in the old dataset is not automatically migrated
 * - The `expiresIn` value must be between 0 and three months (7,776,000,000 milliseconds)
 * - Setting `token` to `null` or empty string will remove the authentication token (requires re-authentication)
 * - Schedule changes do not affect currently running synchronization operations
 *
 * **Token Security:** When updating the token, provide the full new token value. The API
 * will securely store it and never expose the actual token value in subsequent fetch or
 * list operations (always masked as `********`).
 */
