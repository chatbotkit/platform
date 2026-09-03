// @ts-check
import schema, { withSchema } from '@/lib/joi.handler'
import { searchMemories } from '@/lib/memory.search'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export const bodySchema = schema.object({
  search: schema.string(),

  contactId: schema.string().optional(),

  botId: schema.string().optional(),
})

/**
 * @swagger
 *
 * /memory/search:
 *   post:
 *     operationId: searchMemory
 *     summary: Search memories for records matching a given search query
 *     tags:
 *       - Memory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 description: The keyword/phrase to search for
 *                 type: string
 *               contactId:
 *                 description: The ID of the contact to filter memories by
 *                 type: string
 *               botId:
 *                 description: The ID of the bot to filter memories by
 *                 type: string
 *             required:
 *               - search
 *     responses:
 *       200:
 *         description: The search was successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   description: An array of memories matching the search query
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       text:
 *                         type: string
 *                       meta:
 *                         type: object
 *                     required:
 *                       - id
 *                       - text
 *               required:
 *                 - items
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const { search, contactId, botId } = body

      const items = await searchMemories(session.user, search, {
        contactId: contactId,
        botId: botId,
        take: 50,
        limit: 10,
      })

      return ok({
        items: makeJsonSafe(items),
      })
    })
  )
)

/**
 * @manual Memories
 * @index 50
 *
 * ## Searching Memories
 *
 * Searching memories enables you to find relevant information using semantic
 * similarity matching, going beyond simple keyword searches to understand the
 * meaning and context of your query. This powerful search capability helps you
 * discover memories that are conceptually related, even when they don't
 * contain exact matching terms.
 *
 * The search operation uses vector embeddings to find semantically similar
 * content, making it ideal for natural language queries and fuzzy matching
 * scenarios. This is particularly useful when you need to find information but
 * don't remember the exact wording, or when searching for conceptually related
 * content across your memory collection.
 *
 * ```http
 * POST /api/v1/memory/search
 * Content-Type: application/json
 *
 * {
 *   "search": "customer refund policy"
 * }
 * ```
 *
 * To narrow your search to memories associated with specific resources, use
 * optional filter parameters:
 *
 * ```http
 * POST /api/v1/memory/search
 * Content-Type: application/json
 *
 * {
 *   "search": "payment preferences",
 *   "botId": "bot_123",
 *   "contactId": "contact_456"
 * }
 * ```
 *
 * The search returns up to 50 of the most relevant memories, ordered by
 * similarity score. Each result includes the memory ID, full text content, and
 * associated metadata, allowing you to access complete memory details without
 * additional API calls.
 *
 * **Search Parameters:**
 *
 * - `search` (required) - The query text to search for
 * - `botId` (optional) - Filter results to memories associated with this bot
 * - `contactId` (optional) - Filter results to memories associated with this contact
 *
 * The semantic search understands context and relationships between concepts,
 * making it more effective than traditional text matching for finding relevant
 * information in natural language scenarios. Results are automatically limited
 * to 50 memories to ensure performance while providing comprehensive coverage
 * of relevant matches.
 *
 * **Note:** For bot-specific or contact-specific memory searches, use the
 * dedicated routes at `/api/v1/bot/{botId}/memory/search` and
 * `/api/v1/contact/{contactId}/memory/search` which are scoped to those
 * specific resources.
 */
