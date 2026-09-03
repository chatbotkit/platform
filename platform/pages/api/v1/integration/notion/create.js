// @ts-check
import { THREE_MONTHS_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

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
 * /integration/notion/create:
 *   post:
 *     operationId: createNotionIntegration
 *     summary: Create Notion integration
 *     tags:
 *       - Notion Integration
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
 *         description: The Notion integration was created successfully
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
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
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

      const { id } = await prisma.notionIntegration.create({
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

          token,

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
 * @manual Notion Integration
 * @description Connect your Notion workspace to ChatBotKit to automatically sync pages and databases into datasets, enabling your AI agents to access and search your Notion content.
 * @category Integrations
 * @tags notion, integration, sync
 * @index 30
 *
 * Notion Integration allows you to connect your Notion workspace to ChatBotKit,
 * automatically syncing pages, databases, and content into datasets. This enables
 * your AI agents to access and search your Notion knowledge base, making it easy
 * to build chatbots that can answer questions based on your documentation,
 * wikis, and organizational knowledge.
 *
 * ## Creating a Notion Integration
 *
 * To create a Notion integration, you need to provide a Notion API token and
 * specify which dataset should receive the synced content. The integration will
 * automatically discover and sync all accessible pages and databases from your
 * Notion workspace.
 *
 * You can configure the sync schedule to control how frequently your Notion
 * content is updated in the dataset. The integration supports various sync
 * frequencies from real-time to daily updates, ensuring your AI agents always
 * have access to the latest information.
 *
 * ```http
 * POST /api/v1/integration/notion/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Company Wiki Integration",
 *   "description": "Syncs our internal Notion wiki for customer support",
 *   "datasetId": "dataset-abc123",
 *   "token": "secret_notion_api_token_here",
 *   "syncSchedule": "0 * * * *",
 *   "expiresIn": 2592000000
 * }
 * ```
 *
 * **Important:** The Notion API token must have read access to the pages and
 * databases you want to sync. You can create an integration token in your
 * Notion workspace settings and grant it access to specific pages.
 *
 * The `syncSchedule` parameter accepts cron expressions to control sync timing.
 * Common patterns include hourly ("0 * * * *"), daily ("0 0 * * *"), or custom
 * schedules based on your needs.
 *
 * The `expiresIn` parameter specifies how long synced records should be retained
 * before automatic expiration, helping manage storage costs for frequently
 * changing content. Set to null for permanent retention.
 */
