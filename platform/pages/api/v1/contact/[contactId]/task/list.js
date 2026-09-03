// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /contact/{contactId}/task/list:
 *   get:
 *     operationId: listContactTasks
 *     summary: List contact tasks
 *     tags:
 *       - Contact Task
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to list tasks for
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *     responses:
 *       200:
 *         description: The list of tasks was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           contactId:
 *                             description: The contact id assigned to this task
 *                             type: string
 *                           botId:
 *                             type: string
 *                             description: The bot associated with the task
 *                           schedule:
 *                             type: string
 *                             description: The schedule of the task
 *                           timezone:
 *                             type: string
 *                             nullable: true
 *                             description: The IANA timezone identifier used to evaluate the task schedule.
 *                           sessionDuration:
 *                             description: The session duration of the task execution (in milliseconds)
 *                             type: number
 *                             nullable: true
 *                           maxIterations:
 *                             description: The maximum number of iterations per task execution
 *                             type: number
 *                           maxTime:
 *                             description: The maximum time per task execution (in milliseconds)
 *                             type: number
 *                           status:
 *                             $ref: '#/components/schemas/TaskStatus'
 *                           outcome:
 *                             $ref: '#/components/schemas/TaskOutcome'
 *                           lastRunAt:
 *                             description: The timestamp (ms) of the last task execution
 *                             type: number
 *                             nullable: true
 *                           nextRunAt:
 *                             description: The timestamp (ms) of the next scheduled task execution
 *                             type: number
 *                             nullable: true
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1contact~1{contactId}~1task~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const contact = await prisma.contact.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'contactId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!contact) {
        throwNotFound()
      }

      if (contact.userId !== session.user.id) {
        throwNotAuthorized()
      }

      const tasks = await prisma.task.findMany({
        where: {
          AND: [{ contactId: contact.id }, ...getMetaQueryFilter(req)],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          contactId: true,

          botId: true,

          // resource specific

          schedule: true,
          timezone: true,

          sessionDuration: true,

          // resource specific: options

          maxIterations: true,

          maxTime: true,

          // resource state

          status: true,
          outcome: true,

          lastRunAt: true,
          nextRunAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(tasks),
      }
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Listing Contact Tasks
 *
 * The contact tasks listing endpoint retrieves all scheduled and completed
 * tasks associated with a specific contact, providing comprehensive visibility
 * into automated operations, scheduled interactions, and workflow executions
 * tied to that contact. Tasks represent time-based or event-driven actions
 * that the system performs on behalf of or in relation to a contact, such as
 * scheduled follow-ups, recurring check-ins, automated reminders, or workflow
 * triggers.
 *
 * Understanding a contact's task history and upcoming scheduled tasks is
 * essential for building sophisticated automation workflows, tracking
 * engagement cadences, and ensuring appropriate follow-up actions occur at
 * the right times. This endpoint allows you to audit task execution, monitor
 * automation health, and understand the complete timeline of automated
 * interactions with each contact.
 *
 * The listing operation provides detailed task information including execution
 * status, outcomes, scheduling details, and associated bot configurations. This
 * comprehensive view enables you to troubleshoot task failures, analyze
 * automation effectiveness, and ensure your scheduled interactions are
 * functioning as intended. The endpoint supports pagination and metadata
 * filtering, allowing efficient discovery of specific task types or execution
 * states.
 *
 * ### Retrieving Contact Tasks
 *
 * To list all tasks for a specific contact:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/task/list
 * ```
 *
 * Replace `{contactId}` with the actual contact identifier. The response
 * includes comprehensive task information including scheduling details,
 * execution status, outcomes, and associated bot references.
 *
 * ### Task Information Structure
 *
 * Each task in the response includes:
 *
 * - **id**: Unique task identifier
 * - **name**: Task name or label
 * - **description**: Detailed task description
 * - **contactId**: Associated contact identifier
 * - **botId**: Bot executing the task
 * - **schedule**: CRON-style schedule specification
 * - **timezone**: IANA timezone used to evaluate the task schedule, or UTC when omitted
 * - **sessionDuration**: Maximum session duration per task execution in milliseconds
 * - **maxIterations**: Maximum number of iterations allowed per task execution
 * - **maxTime**: Maximum total time allowed per task execution in milliseconds
 * - **status**: Current task status (pending, running, completed, failed)
 * - **outcome**: Task execution outcome (success, failure, details)
 * - **lastRunAt**: Timestamp of the last task execution in milliseconds (null if never run)
 * - **nextRunAt**: Timestamp of the next scheduled task execution in milliseconds (null if not scheduled)
 * - **meta**: Custom metadata including execution history
 * - **createdAt**: Task creation timestamp
 * - **updatedAt**: Last modification timestamp
 *
 * ### Pagination and Ordering
 *
 * The endpoint supports standard cursor-based pagination:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/task/list?take=50&order=desc
 * ```
 *
 * - **cursor**: Pagination continuation token
 * - **order**: Sort order (`asc` or `desc`, default: `desc`)
 * - **take**: Number of items per page
 *
 * Descending order (default) shows the most recently modified tasks first,
 * making it easy to find recent executions or newly scheduled tasks.
 *
 * ### Filtering by Status and Metadata
 *
 * You can filter tasks by status or custom metadata:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/task/list?meta.status=pending
 * ```
 *
 * Common filtering scenarios include:
 *
 * - **Pending tasks**: Tasks scheduled but not yet executed
 * - **Failed tasks**: Tasks that encountered errors during execution
 * - **Recurring tasks**: Tasks with CRON schedules for repeated execution
 * - **Task type**: Custom metadata for categorizing task purposes
 * - **Execution date**: Finding tasks within specific time windows
 *
 * ### Response Structure
 *
 * The response contains an array of task objects:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "task-abc123",
 *       "name": "Weekly Check-in",
 *       "description": "Automated weekly customer check-in",
 *       "contactId": "contact-xyz789",
 *       "botId": "bot-def456",
 *       "schedule": "0 9 * * 1",
 *       "timezone": "America/New_York",
 *       "status": "completed",
 *       "outcome": "success",
 *       "meta": {
 *         "last_execution": "2024-01-22T09:00:00Z",
 *         "execution_count": 12
 *       },
 *       "createdAt": "2024-01-01T10:00:00Z",
 *       "updatedAt": "2024-01-22T09:05:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * ### Understanding Task Schedules
 *
 * Task schedules use standard CRON format (5 fields):
 *
 * ```
 * * * * * *
 * │ │ │ │ │
 * │ │ │ │ └─── Day of week (0-6, Sunday=0)
 * │ │ │ └───── Month (1-12)
 * │ │ └─────── Day of month (1-31)
 * │ └───────── Hour (0-23)
 * └─────────── Minute (0-59)
 * ```
 *
 * Common schedule examples:
 *
 * - `0 9 * * 1`: Every Monday at 9:00 AM
 * - `30 14 1 * *`: First day of month at 2:30 PM
 * - `0 0 * * 0`: Every Sunday at midnight
 *
 * ### Task Status Values
 *
 * Tasks progress through various status states:
 *
 * - **pending**: Scheduled but not yet executed
 * - **running**: Currently executing
 * - **completed**: Successfully finished execution
 * - **failed**: Encountered an error during execution
 * - **cancelled**: Manually cancelled before execution
 *
 * ### Task Outcome Information
 *
 * Task outcomes provide execution results:
 *
 * - **success**: Task completed successfully
 * - **failure**: Task encountered an error
 * - **timeout**: Task exceeded maximum execution time
 * - **skipped**: Task was skipped based on conditions
 *
 * The outcome field typically includes additional details about the execution
 * result in the task's metadata.
 *
 * ### Authorization and Access Control
 *
 * Only the contact owner can list tasks associated with their contacts. The
 * endpoint verifies contact ownership before returning any task information,
 * ensuring proper data isolation and preventing unauthorized access to
 * automation details.
 *
 * ### Use Cases for Contact Task Listing
 *
 * Enumerating contact tasks supports various automation scenarios:
 *
 * - **Automation Monitoring**: Tracking scheduled follow-ups and automated
 *   interactions
 * - **Task Auditing**: Understanding execution history and outcomes for
 *   compliance or debugging
 * - **Workflow Analytics**: Analyzing automation effectiveness and success
 *   rates
 * - **Failure Recovery**: Identifying and addressing failed task executions
 * - **Schedule Management**: Reviewing upcoming and past scheduled interactions
 * - **Bot Activity Tracking**: Understanding which bots are engaging with
 *   specific contacts
 * - **Engagement Cadence**: Ensuring appropriate frequency of automated
 *   outreach
 *
 * **Performance Considerations:**
 *
 * For contacts with extensive task histories (hundreds or thousands of tasks),
 * use pagination to retrieve results in manageable chunks. Consider filtering
 * by date ranges or status to narrow result sets for better performance and
 * more focused analysis.
 *
 * **Important Notes:**
 *
 * - Only contact owners can access task listings
 * - Task schedules may include an explicit timezone and otherwise default to UTC
 * - Status and outcome fields provide complementary information
 * - Metadata can include execution logs and error details
 * - Completed tasks remain in history for audit purposes
 * - Recurring tasks create new task instances for each execution
 */
