// @ts-check
import { ONE_MONTH_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
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
 * /integration/trigger/{triggerIntegrationId}/update:
 *   post:
 *     operationId: updateTriggerIntegration
 *     summary: Update a Trigger integration
 *     tags:
 *       - Trigger Integration
 *     parameters:
 *       - in: path
 *         name: triggerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Trigger integration
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
 *         description: The Trigger integration was updated successfully
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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const triggerIntegration =
        await prisma.triggerIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'triggerIntegrationId')
        )

      if (!triggerIntegration) {
        return notFound()
      }

      if (triggerIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      const effectiveSchedule =
        normalizedSchedule !== undefined
          ? normalizedSchedule
          : triggerIntegration.schedule
      const effectiveTimezone =
        normalizedTimezone !== undefined
          ? normalizedTimezone
          : triggerIntegration.timezone

      const nextTriggerAt =
        effectiveSchedule &&
        (normalizedSchedule !== undefined ||
          normalizedTimezone !== undefined)
          ? getNext(effectiveSchedule, { timezone: effectiveTimezone })
          : null

      await prisma.triggerIntegration.update({
        where: {
          id: triggerIntegration.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          botId: bot?.id || bot,

          // resource specific

          authenticate,

          schedule: normalizedSchedule,
          timezone: normalizedTimezone,

          nextTriggerAt:
            normalizedSchedule !== undefined ||
            normalizedTimezone !== undefined
              ? effectiveSchedule
                ? nextTriggerAt && nextTriggerAt > new Date()
                  ? nextTriggerAt
                  : null
                : null
              : undefined,

          sessionDuration,

          // meta and others

          meta: getMeta(meta, triggerIntegration.meta),
        },
      })

      return ok({ id: triggerIntegration.id })
    })
  )
)

/**
 * @manual Trigger Integration
 *
 * ## Updating a Trigger Integration
 *
 * Update an existing Trigger Integration's configuration to modify its behavior,
 * authentication requirements, scheduling, or linked resources. This endpoint
 * allows you to adjust trigger settings without recreating the integration,
 * preserving its unique endpoint URL and existing conversation history.
 *
 * Updating a trigger integration is particularly useful when you need to:
 * change the bot handling events, modify authentication requirements, adjust
 * session duration for conversation persistence, or update the trigger schedule
 * for recurring automated executions. All changes take effect immediately for
 * new incoming events while preserving historical data.
 *
 * ```http
 * POST /api/v1/integration/trigger/{triggerIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Order Processor",
 *   "description": "Enhanced order processing with fraud detection",
 *   "botId": "bot_xyz789",
 *   "authenticate": true,
 *   "schedule": "0 0 * * *",
 *   "timezone": "America/New_York",
 *   "sessionDuration": 7200000
 * }
 * ```
 *
 * ### Key Configuration Updates
 *
 * **Bot Switching**: Changing the `botId` redirects all future events to a
 * different bot. This is useful when upgrading to improved bot versions or
 * splitting functionality across specialized bots. Existing conversations
 * remain accessible in the original bot's history.
 *
 * **Authentication Changes**: You can enable or disable authentication by
 * updating the `authenticate` parameter. When enabling authentication on a
 * previously open trigger, ensure you have the integration's secret key
 * available. Disabling authentication makes the trigger publicly accessible.
 *
 * **Schedule Modifications**: The `schedule` parameter accepts standard
 * cron syntax for recurring trigger executions. Use this for periodic tasks like
 * hourly data syncs (`0 * * * *`), daily reports (`0 0 * * *`), or custom
 * intervals. Setting this to null disables scheduled execution. Provide the
 * optional `timezone` field when the schedule should be evaluated in a local
 * timezone instead of UTC.
 *
 * **Session Duration**: Adjust how long the bot maintains conversation context
 * between events. Longer durations (in milliseconds) enable more coherent
 * multi-event workflows but consume more memory. Shorter durations are suitable
 * for independent, stateless event processing.
 *
 * **Blueprint Reassignment**: Updating the `blueprintId` allows you to switch
 * between different resource configurations, applying new datasets, skillsets,
 * or abilities to the trigger integration. This enables rapid deployment of
 * configuration changes across multiple integrations.
 *
 * ### Update Best Practices
 *
 * **Test Before Production**: When changing critical settings like bot IDs or
 * authentication, test the updated configuration with sample events before
 * deploying to production workflows.
 *
 * **Gradual Migration**: For major changes, consider creating a new trigger
 * integration and gradually migrating traffic rather than updating a high-volume
 * production trigger directly.
 *
 * **Monitor After Updates**: Check conversation logs after updates to ensure
 * events are processing correctly with the new configuration. Pay special
 * attention to authentication-related changes that might block legitimate
 * requests.
 *
 * **Document Changes**: Maintain records of significant configuration changes,
 * especially schedule modifications or bot switches, to aid troubleshooting
 * and maintain operational history.
 *
 * **Warning**: Changing authentication settings affects all future requests
 * immediately. Ensure external systems are updated with proper credentials
 * before enabling authentication, or you may block legitimate event submissions.
 */
