// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /usage/list:
 *   get:
 *     operationId: listUsageRecords
 *     summary: List usage records
 *     tags:
 *       - Usage
 *     parameters:
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
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter usage records by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of usage records was retrieved successfully
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
 *                           type:
 *                             description: The usage type
 *                             type: string
 *                           count:
 *                             description: The usage count
 *                             type: integer
 *                           conversationId:
 *                             description: Related conversation ID if applicable
 *                             type: string
 *                           messageId:
 *                             description: Related message ID if applicable
 *                             type: string
 *                           taskId:
 *                             description: Related task ID if applicable
 *                             type: string
 *                           contactId:
 *                             description: Related contact ID if applicable
 *                             type: string
 *                           blueprintId:
 *                             description: Related blueprint ID if applicable
 *                             type: string
 *                           botId:
 *                             description: Related bot ID if applicable
 *                             type: string
 *                           datasetId:
 *                             description: Related dataset ID if applicable
 *                             type: string
 *                           skillsetId:
 *                             description: Related skillset ID if applicable
 *                             type: string
 *                           abilityId:
 *                             description: Related ability ID if applicable
 *                             type: string
 *                         required:
 *                           - type
 *                           - count
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const records = await prisma.usage.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').Usage>} */ (
              getFieldQueryFilter
            )(req, [
              'type',
              'conversationId',
              'messageId',
              'taskId',
              'contactId',
              'blueprintId',
              'botId',
              'datasetId',
              'skillsetId',
              'abilityId',
            ]),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // resource linking

          conversationId: true,
          messageId: true,
          taskId: true,
          contactId: true,
          blueprintId: true,
          botId: true,
          datasetId: true,
          skillsetId: true,
          abilityId: true,

          // resource specific

          type: true,
          count: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(records),
      }
    })
  )
)

/**
 * @manual Usage
 * @index 20
 *
 * ## Listing Usage Records
 *
 * Individual usage records capture granular token and resource consumption
 * events throughout your application. Each record corresponds to a specific
 * operation - such as a conversation completion, a task execution, or an
 * ability invocation - and includes the type of usage, the count of units
 * consumed, and links to the related platform resources.
 *
 * Listing usage records gives you detailed, audit-level visibility into how
 * your application consumes platform resources. Unlike the aggregate usage
 * fetch endpoint, this endpoint returns individual event records that can
 * be filtered, paginated, and correlated with specific conversations, bots,
 * tasks, and other platform entities.
 *
 * ```http
 * GET /api/v1/usage/list
 * ```
 *
 * ### Pagination
 *
 * Results are returned in pages using cursor-based pagination. Include the
 * `cursor` value from a previous response to fetch the next page. Use the
 * `order` parameter to control sort direction (`asc` or `desc`, defaulting
 * to `desc` for most recent records first), and the `take` parameter to
 * control page size.
 *
 * ```http
 * GET /api/v1/usage/list?take=50&order=desc
 * ```
 *
 * ### Filtering by Resource
 *
 * You can narrow results to usage records associated with a specific platform
 * resource by providing one of the available filter parameters. This is
 * particularly useful when auditing consumption for a particular bot,
 * conversation, or task.
 *
 * ```http
 * GET /api/v1/usage/list?botId=bot_abc123
 * GET /api/v1/usage/list?conversationId=conv_xyz789
 * GET /api/v1/usage/list?type=conversation%2Fcomplete
 * ```
 *
 * Supported filter fields include `type`, `conversationId`, `messageId`,
 * `taskId`, `contactId`, `blueprintId`, `botId`, `datasetId`, `skillsetId`,
 * and `abilityId`. Multiple filters can be combined to narrow results
 * further.
 *
 * ### Filtering by Metadata
 *
 * Usage records can also be filtered using metadata key-value pairs attached
 * at the time of recording. Use the `meta` query parameter with deep object
 * syntax to match records by their metadata values.
 *
 * ```http
 * GET /api/v1/usage/list?meta[reason]=conversation%2Fcomplete
 * ```
 *
 * ### Response Structure
 *
 * Each record in the `items` array includes the usage `type` (a string
 * identifying the operation category), a `count` representing the number of
 * units consumed (such as token count), optional relation IDs linking the
 * record to platform resources, custom `meta` data, and standard `createdAt`
 * and `updatedAt` timestamps. A `cursor` field in the response envelope can
 * be used to retrieve subsequent pages.
 *
 * **Note**: Usage records are immutable. They are created automatically by
 * the platform during API operations and cannot be modified or deleted via
 * the API. Use this endpoint for monitoring and auditing purposes only.
 */
