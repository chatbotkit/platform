// @ts-check
import { ONE_HOUR_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import { PLATFORM_LIMITS } from '@/config/execution'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getNext } from '@/lib/task.schedule'

import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import contactIdSchema from '@/schemas/contactId'
import descriptionSchema from '@/schemas/description'
import expiresAtSchema from '@/schemas/expiresAt'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import taskScheduleSchema from '@/schemas/taskSchedule'
import timezoneSchema from '@/schemas/timezone'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  contactId: contactIdSchema('use'),

  botId: botIdSchema('use'),

  schedule: taskScheduleSchema,
  timezone: timezoneSchema,

  expiresAt: expiresAtSchema,

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_HOUR_IN_MILLISECONDS)
    .allow(null),

  maxIterations: schema
    .number()
    .integer()
    .min(0) // allow 0 to be treated the same as null
    .max(PLATFORM_LIMITS.maxIterations)
    .allow(null),

  maxTime: schema
    .number()
    .min(0) // allow 0 to be treated the same as null
    .max(PLATFORM_LIMITS.maxTime)
    .allow(null),

  maxCalls: schema
    .number()
    .integer()
    .min(0) // allow 0 to be treated the same as null (unbounded)
    .max(PLATFORM_LIMITS.maxCalls)
    .allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /task/{taskId}/update:
 *   post:
 *     operationId: updateTask
 *     summary: Update task
 *     tags:
 *       - Task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   contactId:
 *                     type: string
 *                     description: The contact associated with the task
 *                   botId:
 *                     type: string
 *                     description: The bot associated with the task
 *                   schedule:
 *                     type: string
 *                     description: The schedule of the task. Cron expressions and date-based schedules are evaluated in the provided timezone when set.
 *                   timezone:
 *                     type: string
 *                     nullable: true
 *                     description: An optional IANA timezone identifier used when evaluating the task schedule.
 *                     example: America/New_York
 *                   expiresAt:
 *                     type: number
 *                     nullable: true
 *                     description: An optional epoch-millisecond timestamp after which the task is automatically deleted. Pass null to clear an existing expiry.
 *                   sessionDuration:
 *                     description: The session duration of the Widget integration
 *                     type: number
 *                   maxIterations:
 *                     description: The maximum number of iterations per task execution
 *                     type: number
 *                   maxTime:
 *                     description: The maximum time per task execution in milliseconds
 *                     type: number
 *                   maxCalls:
 *                     description: The maximum number of tool calls across the whole task run (0 or null for unbounded)
 *                     type: number
 *                     nullable: true
 *     responses:
 *       200:
 *         description: The task was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated task
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
        name,
        description,

        blueprintId: blueprint,

        contactId: contact,

        botId: bot,

        schedule,
        timezone,

        expiresAt,

        sessionDuration,

        maxIterations,

        maxTime,

        maxCalls,

        meta,
      } = body

      const normalizedSchedule =
        schedule === undefined ? undefined : schedule || null
      const normalizedTimezone =
        timezone === undefined ? undefined : timezone || null

      // @note undefined -> leave unchanged; null -> clear expiry; epoch ms -> Date
      const normalizedExpiresAt =
        expiresAt === undefined
          ? undefined
          : expiresAt == null
            ? null
            : new Date(expiresAt)

      const task = await prisma.task.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'taskId')
      )

      if (!task) {
        return notFound()
      }

      if (task.userId !== session.user.id) {
        return notAuthorized()
      }

      const effectiveSchedule =
        normalizedSchedule !== undefined ? normalizedSchedule : task.schedule
      const effectiveTimezone =
        normalizedTimezone !== undefined ? normalizedTimezone : task.timezone

      const nextRunAt =
        effectiveSchedule &&
        (normalizedSchedule !== undefined || normalizedTimezone !== undefined)
          ? getNext(effectiveSchedule, { timezone: effectiveTimezone })
          : null

      await prisma.task.update({
        where: {
          id: task.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          contactId: contact?.id,

          botId: bot?.id,

          // resource specific

          schedule: normalizedSchedule,
          timezone: normalizedTimezone,

          nextRunAt:
            normalizedSchedule !== undefined || normalizedTimezone !== undefined
              ? effectiveSchedule
                ? nextRunAt && nextRunAt > new Date()
                  ? nextRunAt
                  : null
                : null
              : undefined,

          expiresAt: normalizedExpiresAt,

          sessionDuration,

          maxIterations,

          maxTime,

          maxCalls,

          // meta and others

          meta: getMeta(meta, task.meta),
        },
      })

      return ok({ id: task.id })
    })
  )
)

/**
 * @manual Tasks
 * @index 30
 *
 * ## Updating a Task
 *
 * Modifying an existing task allows you to adjust automation workflows as your
 * requirements evolve. You can change schedules, update bot associations, modify
 * session parameters, or adjust any other task configuration without recreating
 * the entire task.
 *
 * The update endpoint accepts the same parameters as task creation, applying only
 * the fields you provide while preserving existing values for omitted fields. This
 * partial update capability makes it easy to modify specific aspects of a task
 * without affecting its other configurations.
 *
 * When you update a task's schedule, the system automatically recalculates the next
 * run time based on the new schedule. Updating a task's timezone also triggers
 * recalculation so the next execution remains aligned with the intended local
 * time. This ensures that schedule changes take effect immediately and tasks
 * execute at the correct times according to your updated configuration.
 *
 * To update a task, send a POST request with the fields you want to modify:
 *
 * ```http
 * POST /api/v1/task/{taskId}/update
 * Content-Type: application/json
 *
 * {
 *   "schedule": "hourly",
 *   "timezone": "America/New_York",
 *   "description": "Updated to run hourly instead of daily"
 * }
 * ```
 *
 * For example, to change a task's schedule and session duration:
 *
 * ```http
 * POST /api/v1/task/task_abc123/update
 * Content-Type: application/json
 *
 * {
 *   "schedule": "weekly",
 *   "sessionDuration": 7200000
 * }
 * ```
 *
 * **Important:** Updating the schedule will immediately recalculate the next run time.
 * If the task is currently scheduled to run, the update will take effect after the
 * current execution completes.
 */
