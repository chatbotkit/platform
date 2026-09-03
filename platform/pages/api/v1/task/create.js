// @ts-check
import { ONE_HOUR_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import { PLATFORM_LIMITS } from '@/config/execution'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
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
 * /task/create:
 *   post:
 *     operationId: createTask
 *     summary: Create a new task
 *     description: |
 *       Create a new task with the given parameters.
 *     tags:
 *       - Task
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
 *                     description: An optional epoch-millisecond timestamp after which the task is automatically deleted. Pass null or omit for no expiry.
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
 *         description: The task was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created task
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
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

      // @note undefined -> leave unset; null -> no expiry; epoch ms -> Date
      const normalizedExpiresAt =
        expiresAt === undefined
          ? undefined
          : expiresAt == null
            ? null
            : new Date(expiresAt)

      const nextRunAt = normalizedSchedule
        ? getNext(normalizedSchedule, { timezone: normalizedTimezone })
        : null

      const { id } = await prisma.task.create({
        data: {
          userId: session.user.id,

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

          ...(normalizedSchedule
            ? {
                nextRunAt:
                  nextRunAt && nextRunAt > new Date() ? nextRunAt : null,
              }
            : null),

          expiresAt: normalizedExpiresAt,

          sessionDuration,

          maxIterations,

          maxTime,

          maxCalls,

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
 * @manual Tasks
 * @description Tasks are scheduled or on-demand actions that your agents can perform automatically, enabling workflow automation and periodic operations.
 * @category Objects/Tasks
 * @tags task, automation, scheduling
 * @index 1
 *
 * Tasks represent automated actions that can be executed on a schedule or triggered
 * on-demand within the ChatBotKit platform. They enable you to build powerful
 * automation workflows by allowing bots to perform operations at specific times or
 * in response to events, without manual intervention.
 *
 * A task combines a bot with a schedule and optional contact, creating an automated
 * workflow that executes according to your defined parameters. Tasks are particularly
 * useful for periodic notifications, scheduled data processing, automated reporting,
 * or any operation that needs to run at regular intervals or be triggered programmatically.
 *
 * ## Creating Tasks
 *
 * Creating a task establishes an automated workflow by connecting a bot with a
 * schedule and optional configuration parameters. Tasks can be scheduled to run at
 * regular intervals (quarterhourly, halfhourly, hourly, daily, weekly, monthly) or
 * triggered manually through the API.
 *
 * When creating a task, you specify the bot that will handle the execution, the
 * schedule defining when it should run, and optional parameters like session duration
 * and contact associations. The system automatically manages task execution based on
 * your schedule configuration.
 *
 * To create a task with a bot association, send a POST request with the required
 * parameters:
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Daily Report Generator",
 *   "description": "Generates and sends daily performance reports",
 *   "botId": "bot_abc123",
 *   "schedule": "daily",
 *   "timezone": "America/New_York",
 *   "sessionDuration": 3600000
 * }
 * ```
 *
 * You can also create a task without a bot association by omitting the `botId`
 * parameter:
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Scheduled Task Placeholder",
 *   "description": "Task created for later bot assignment",
 *   "schedule": "daily"
 * }
 * ```
 *
 * ## Task Scheduling Options
 *
 * The `schedule` parameter is flexible and supports three distinct scheduling patterns,
 * each designed for different use cases:
 *
 * **Predefined Intervals:**
 *
 * Use predefined interval values for common scheduling patterns. These are simple string
 * values that automatically calculate the next run time:
 *
 * - `"quarterhourly"` - Runs every 15 minutes
 * - `"halfhourly"` - Runs every 30 minutes
 * - `"hourly"` - Runs every hour
 * - `"daily"` - Runs once per day
 * - `"weekly"` - Runs once per week
 * - `"monthly"` - Runs once per month
 * - `"never"` - Task is created but never runs automatically (manual trigger only)
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Hourly Data Sync",
 *   "botId": "bot_abc123",
 *   "schedule": "hourly"
 * }
 * ```
 *
 * **Cron Expressions:**
 *
 * For more precise scheduling control, use standard cron expressions. The platform
 * supports the standard 5-field cron format (minute, hour, day of month, month, day of
 * week):
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Weekday Morning Report",
 *   "botId": "bot_abc123",
 *   "schedule": "0 9 * * 1-5"
 * }
 * ```
 *
 * Common cron expression examples:
 *
 * - `"0 9 * * *"` - Every day at 9:00 AM
 * - `"0 0 * * 0"` - Every Sunday at midnight
 * - `"0 9 * * 1-5"` - Weekdays at 9:00 AM
 * - `"0 0 1 * *"` - First day of every month at midnight
 * - `"30 14 * * 1,3,5"` - Monday, Wednesday, Friday at 2:30 PM
 *
 * **Specific Date/Time:**
 *
 * Schedule a task to run once at a specific date and time using ISO 8601 datetime
 * strings or any valid JavaScript date format:
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Campaign Launch",
 *   "botId": "bot_abc123",
 *   "schedule": "2025-12-25T10:00:00.000Z"
 * }
 * ```
 *
 * Valid date formats include:
 *
 * - ISO 8601: `"2025-12-25T10:00:00.000Z"`
 * - RFC 2822: `"Wed, 25 Dec 2025 10:00:00 GMT"`
 * - Date only: `"2025-12-25"` (defaults to midnight UTC)
 *
 * **Important:** When using a specific date/time, the task will run once at that time
 * and then stop. If you need the task to run multiple times, use intervals or cron
 * expressions instead.
 *
 * ## Session Duration
 *
 * The `sessionDuration` parameter (in milliseconds) controls how long the conversation
 * session remains active during task execution. This determines how much time the bot
 * has to complete its work before the session times out:
 *
 * - **Minimum:** 0 milliseconds (immediate termination after execution)
 * - **Maximum:** 3,600,000 milliseconds (1 hour)
 * - **Default:** If not specified, uses platform default
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Long Running Analysis",
 *   "botId": "bot_abc123",
 *   "schedule": "daily",
 *   "sessionDuration": 3600000
 * }
 * ```
 *
 * Choose an appropriate session duration based on the complexity of your task. Simple
 * notifications might need only a few seconds, while complex data processing or
 * multi-step workflows may require longer durations.
 *
 * ## Important Considerations
 *
 * **Bot Association:**
 *
 * The `botId` parameter is optional, allowing you to create tasks with or without a
 * specific bot association. When provided, the bot must exist and be accessible by
 * your account. The bot configuration determines what actions the task will perform
 * when executed. Tasks without a bot association can still be created and managed
 * through the API, useful for scenarios where bot assignment happens at a later stage
 * or through different workflows.
 *
 * **Automatic Next Run Calculation:**
 *
 * Once created, the task automatically calculates the next run time based on your
 * schedule configuration. For intervals and cron expressions, this is computed
 * dynamically. For specific dates, the next run is set to that exact time.
 *
 * **Timezone Handling:**
 *
 * Task schedules default to UTC when no timezone is provided. Set the optional
 * `timezone` field to an IANA timezone identifier such as `America/New_York`
 * when you want cron expressions or date-based schedules evaluated in a local
 * timezone.
 *
 * **Schedule Validation:**
 *
 * The platform validates all schedule values at creation time:
 * - Predefined intervals must match exactly (case-sensitive)
 * - Cron expressions must be valid standard cron format
 * - Date strings must be parseable as valid JavaScript dates
 * - Invalid schedules will result in a validation error
 *
 * ## Contact Association
 *
 * The optional `contactId` parameter associates a specific contact with the task.
 * When a contact is linked, the bot executing the task can access contact context
 * such as conversation history, preferences, and metadata. This is useful for
 * tasks that perform personalised operations, such as sending targeted messages,
 * reviewing a contact's recent activity, or updating records tied to a specific
 * user identity.
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Weekly User Summary",
 *   "botId": "bot_abc123",
 *   "contactId": "contact_xyz789",
 *   "schedule": "weekly"
 * }
 * ```
 *
 * When `contactId` is omitted the task runs without any contact context. The
 * contact must belong to your account; references to contacts in other accounts
 * will result in an error.
 *
 * ## Execution Limits
 *
 * Two optional parameters let you cap resource consumption for each task run.
 *
 * **Maximum Iterations (`maxIterations`):**
 *
 * Controls how many reasoning or tool-call cycles the bot may perform during
 * a single execution. Acceptable values range from 0 to 100,000. Setting this
 * to a low number is recommended for simple notification tasks, while complex
 * multi-step workflows may need a higher limit.
 *
 * **Maximum Time (`maxTime`):**
 *
 * Sets the upper bound in milliseconds for the total wall-clock time a task
 * execution is allowed to run before being forcibly terminated. The maximum
 * allowed value is 86,400,000 milliseconds (24 hours). Use this to prevent
 * runaway tasks from consuming excessive resources.
 *
 * ```http
 * POST /api/v1/task/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Bounded Analysis Task",
 *   "botId": "bot_abc123",
 *   "schedule": "daily",
 *   "maxIterations": 50,
 *   "maxTime": 300000
 * }
 * ```
 *
 * Both limits are optional. When omitted, the platform applies the default limits
 * defined for your subscription tier. Setting either value to 0 is treated the
 * same as omitting it, and the platform default is applied instead.
 */
