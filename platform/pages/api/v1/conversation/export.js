// @ts-check
import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { getSortedMessages } from '@/lib/message'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'
import yaml from '@/lib/yaml'

/**
 * @swagger
 *
 * /conversation/export:
 *   get:
 *     operationId: exportConversations
 *     summary: Export conversations
 *     tags:
 *       - Conversation
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
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of conversations was retrieved successfully
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
 *                       - $ref: '#/components/schemas/BotRefOrConfig'
 *                       - type: object
 *                         properties:
 *                           contactId:
 *                             description: The contact id assigned to this conversation
 *                             type: string
 *                           taskId:
 *                             description: The task id assigned to this conversation
 *                             type: string
 *                           spaceId:
 *                             description: The space id assigned to this conversation
 *                             type: string
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
 *                       $ref: '#/paths/~1conversation~1export/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *           text/csv:
 *             schema:
 *               type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const conversations = await prisma.conversation.findMany({
        where: {
          AND: [
            {
              userId: session.user.id,
            },

            // @todo maybe restrict by date range

            ...getMetaQueryFilter(req),
          ],
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

          taskId: true,

          spaceId: true,

          botId: true,

          datasetId: true,

          skillsetId: true,

          // resource specific

          backstory: true,

          model: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,

          // messages

          messages: {
            where: {
              type: {
                in: [MessageType.bot, MessageType.user],
              },
            },

            select: {
              id: true,

              type: true,
              text: true,

              meta: true,

              createdAt: true,
              updatedAt: true,
            },

            // @note disabled because it can overfill the memory for very long messages
            // orderBy: [
            //   {
            //     createdAt: 'asc',
            //   },
            //   { id: 'asc' },
            // ],
          },
        },
      })

      return {
        items: makeJsonSafe(conversations).map(
          ({ meta, messages, ...rest }) => {
            messages = getSortedMessages(messages)

            return {
              ...rest,

              meta: new Proxy(meta || {}, {
                get: function (target, prop) {
                  if (prop === 'toString') {
                    return function () {
                      return target ? yaml.stringify(target) : ''
                    }
                  }

                  return target[prop]
                },
              }),

              messages: new Proxy(messages || [], {
                get: function (target, prop) {
                  if (prop === 'toString') {
                    return function () {
                      return target
                        .map((item) => `${item.type}: ${item.text}`)
                        .join('\n\n')
                    }
                  }

                  return target[prop]
                },
              }),
            }
          }
        ),
      }
    })
  )
)

/**
 * @manual Conversations
 * @index 50
 *
 * ## Exporting Conversations
 *
 * The export endpoint enables you to retrieve conversations and their complete
 * message histories in bulk, supporting multiple output formats for different
 * use cases. This capability is essential for data analysis, backup purposes,
 * training data preparation, compliance requirements, and migrating conversations
 * between systems.
 *
 * Unlike the standard list endpoint that returns basic conversation metadata,
 * the export endpoint provides comprehensive conversation data including full
 * message histories, making it ideal for scenarios where you need complete
 * conversation records rather than just metadata summaries.
 *
 * ### Supported Export Formats
 *
 * The export endpoint supports three output formats, each optimized for different
 * use cases:
 *
 * **JSON Format** (`application/json`): Returns conversations as a structured
 * JSON array, ideal for programmatic processing, API integrations, and when you
 * need to work with conversation data in JavaScript or other modern applications.
 * This format provides the most structured and easily parseable output.
 *
 * **JSONL Format** (`application/jsonl`): Delivers conversations as JSON Lines
 * (newline-delimited JSON), where each line represents a single conversation.
 * This format is optimized for streaming large datasets, processing data
 * line-by-line, and integration with data pipeline tools that expect JSONL input.
 * It's particularly useful for large-scale exports that might exceed memory limits
 * if loaded entirely at once.
 *
 * **CSV Format** (`text/csv`): Exports conversations in comma-separated values
 * format, ideal for spreadsheet applications, data analysis tools, and situations
 * where human readability and Excel compatibility are priorities. This format
 * flattens the conversation structure for easier tabular analysis.
 *
 * ### Basic Export Request
 *
 * To export conversations, send a GET request with the desired format specified
 * in the Accept header:
 *
 * ```http
 * GET /api/v1/conversation/export
 * Accept: application/json
 * ```
 *
 * For JSONL format:
 *
 * ```http
 * GET /api/v1/conversation/export
 * Accept: application/jsonl
 * ```
 *
 * For CSV format:
 *
 * ```http
 * GET /api/v1/conversation/export
 * Accept: text/csv
 * ```
 *
 * ### Pagination and Filtering
 *
 * The export endpoint supports pagination and filtering to manage large datasets
 * efficiently:
 *
 * **Cursor-based Pagination**: Use the `cursor` parameter to paginate through
 * large result sets. The response includes a cursor that you can use to fetch
 * the next page of results:
 *
 * ```http
 * GET /api/v1/conversation/export?cursor=eyJpZCI6ImNvbnZfYWJjMTIzIn0&take=100
 * Accept: application/json
 * ```
 *
 * **Ordering**: Control the sort order of exported conversations using the `order`
 * parameter. Use `desc` for most recent first (default) or `asc` for oldest first:
 *
 * ```http
 * GET /api/v1/conversation/export?order=asc&take=50
 * Accept: application/json
 * ```
 *
 * **Record Limits**: Specify the number of conversations to retrieve per request
 * using the `take` parameter. This helps manage export size and processing time:
 *
 * ```http
 * GET /api/v1/conversation/export?take=25
 * Accept: application/json
 * ```
 *
 * **Metadata Filtering**: Filter conversations by metadata using the `meta`
 * parameter with deep object notation. This allows you to export only conversations
 * matching specific criteria:
 *
 * ```http
 * GET /api/v1/conversation/export?meta[tier]=premium&meta[region]=us-east
 * Accept: application/json
 * ```
 *
 * ### Export Data Structure
 *
 * Each exported conversation includes comprehensive information:
 *
 * - **Basic Information**: ID, name, description, creation and update timestamps
 * - **Configuration**: Bot settings, model configuration, privacy and moderation
 *   settings
 * - **Associations**: Contact ID, task ID, space ID for organizational relationships
 * - **Message History**: Complete conversation messages with type, text, entities,
 *   and metadata
 * - **Metadata**: Custom metadata fields for tracking and categorization
 *
 * The exact structure depends on the output format, but all formats include
 * complete conversation data suitable for archival, analysis, or migration purposes.
 *
 * ### Use Cases
 *
 * **Data Backup and Archival**: Regularly export conversations for backup purposes,
 * ensuring you have offline copies of important conversation data.
 *
 * **Compliance and Audit**: Export conversation records for compliance reviews,
 * legal discovery, or audit requirements where complete conversation histories
 * are needed.
 *
 * **Training Data Preparation**: Extract conversations to create training datasets
 * for fine-tuning language models or improving AI performance.
 *
 * **Analytics and Reporting**: Export conversation data for analysis in business
 * intelligence tools, spreadsheets, or custom analytics platforms.
 *
 * **System Migration**: Transfer conversations between systems, environments, or
 * accounts using the export functionality.
 *
 * **Quality Assurance**: Review conversation quality by exporting samples for
 * manual review, analysis, or testing purposes.
 *
 * ### Performance Considerations
 *
 * Exporting large volumes of conversations can be resource-intensive. Follow
 * these best practices:
 *
 * **Use Pagination**: Don't attempt to export all conversations at once. Use the
 * `take` parameter to limit export size and process data in manageable chunks.
 *
 * **Implement Incremental Exports**: Export conversations periodically (e.g.,
 * daily) rather than attempting to export your entire history at once.
 *
 * **Choose Appropriate Formats**: Use JSONL for large exports to enable streaming
 * and line-by-line processing rather than loading everything into memory.
 *
 * **Schedule Off-Peak Exports**: Run large export operations during off-peak
 * hours to minimize impact on system performance.
 *
 * **Filter Effectively**: Use metadata filters to export only the conversations
 * you actually need rather than exporting everything and filtering locally.
 *
 * **Important Notes:**
 *
 * - Exports include all messages in each conversation, which can result in large
 *   data volumes for conversations with extensive histories
 * - The default sort order is newest conversations first (desc), which is typically
 *   most useful for incremental exports
 * - CSV format may not preserve all data structures perfectly due to flattening;
 *   use JSON or JSONL for complete data fidelity
 * - Exported data includes sensitive information; ensure proper security measures
 *   when storing or transmitting exports
 * - Large exports may take significant time to complete; implement appropriate
 *   timeout handling in your client code
 */
