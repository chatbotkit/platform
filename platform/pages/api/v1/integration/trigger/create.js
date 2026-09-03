// @ts-check
import { ONE_MONTH_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { getNext } from '@/lib/task.schedule'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import timezoneSchema from '@/schemas/timezone'
// eslint-disable-next-line import/extensions
import triggerIntegrationScheduleSchema from '@/schemas/triggerIntegrationSchedule'

import crypto from 'crypto'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  authenticate: schema.boolean(),

  schedule: triggerIntegrationScheduleSchema,
  timezone: timezoneSchema,

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/trigger/create:
 *   post:
 *     operationId: createTriggerIntegration
 *     summary: Create Trigger integration
 *     tags:
 *       - Trigger Integration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - $ref: '#/components/schemas/BotRef'
 *               - type: object
 *                 properties:
 *                   authenticate:
 *                     description: When enabled the integration requires authentication
 *                     type: boolean
 *                   schedule:
 *                     description: The schedule for the trigger integration (interval, cron expression, or ISO date)
 *                     type: string
 *                     nullable: true
 *                   timezone:
 *                     description: An optional IANA timezone identifier used when evaluating the trigger schedule.
 *                     type: string
 *                     nullable: true
 *                     example: America/New_York
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *     responses:
 *       200:
 *         description: The Trigger integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Trigger Integration
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

        botId: bot,

        authenticate,

        schedule,
        timezone,

        sessionDuration,

        meta,
      } = body

      const normalizedSchedule =
        schedule === undefined ? undefined : schedule || null
      const normalizedTimezone =
        timezone === undefined ? undefined : timezone || null

      const nextTriggerAt = normalizedSchedule
        ? getNext(normalizedSchedule, { timezone: normalizedTimezone })
        : null

      const { id } = await prisma.triggerIntegration.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          botId: bot?.id || bot,

          // resource specific

          secret: crypto.randomBytes(32).toString('hex'),

          authenticate: authenticate ?? true,

          schedule: normalizedSchedule,
          timezone: normalizedTimezone,

          ...(normalizedSchedule
            ? {
                nextTriggerAt:
                  nextTriggerAt && nextTriggerAt > new Date()
                    ? nextTriggerAt
                    : null,
              }
            : null),

          sessionDuration,

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
 * @manual Trigger Integration
 * @description Trigger Integrations enable powerful event-driven workflows by allowing your applications to send events and information to bots through a dedicated API endpoint, with the bot processing events in the background and executing appropriate actions.
 * @category Integrations
 * @tags trigger, integration, events, workflows, background-processing
 * @index 20
 *
 * ChatBotKit Trigger Integration is a powerful feature that enables event-driven
 * workflows by allowing external applications and services to send events and
 * information to your bots through a dedicated API endpoint. Once a trigger
 * receives an event, it schedules the event for background processing, allowing
 * your application to continue without waiting for a response. The bot then
 * processes the event, determines the required actions, executes them using
 * available skillsets, and records the results in the conversation history.
 *
 * This integration is particularly valuable for agent workflows, scheduled tasks,
 * and scenarios where immediate bot responses aren't required. All trigger
 * interactions are logged in the Conversations tab for tracking and auditing.
 *
 * ## Creating a Trigger Integration
 *
 * Creating a trigger integration establishes a dedicated endpoint that can
 * receive events from your applications. During creation, you configure the
 * trigger's behavior, including authentication requirements, session management,
 * and bot linkage.
 *
 * To create a trigger integration, send a POST request with configuration details:
 *
 * ```http
 * POST /api/v1/integration/trigger/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Order Processing Trigger",
 *   "description": "Handles order processing events",
 *   "botId": "bot_abc123",
 *   "authenticate": true,
 *   "timezone": "America/New_York",
 *   "sessionDuration": 3600000
 * }
 * ```
 *
 * **Important Configuration Options:**
 *
 * - **`botId`**: The bot that will process trigger events (required)
 * - **`authenticate`**: When enabled, requests must include authentication
 * - **`schedule`**: Optional cron schedule for recurring trigger execution
 * - **`timezone`**: Optional IANA timezone used to evaluate cron and date schedules
 * - **`sessionDuration`**: How long conversations persist (in milliseconds)
 * - **`blueprintId`**: Optional blueprint for resource grouping
 *
 * When a trigger integration is created, the system generates a unique secret
 * key that can be used for authentication. This secret is returned in the
 * response and should be stored securely if authentication is enabled.
 *
 * **Warning:** The trigger secret is only displayed once during creation. Store
 * it securely for future use with authenticated requests.
 */
