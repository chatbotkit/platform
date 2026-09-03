// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { searchMemories } from '@/lib/memory.search'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export const bodySchema = schema.object({
  search: schema.string(),
})

/**
 * @swagger
 *
 * /bot/{botId}/memory/search:
 *   post:
 *     operationId: searchBotMemory
 *     summary: Search memories for a specific bot
 *     tags:
 *       - Bot Memory
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           description: The ID of the bot to search memories for
 *           type: string
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
    withSchema(bodySchema, async function (req, session, body) {
      const botId = requiredUrlParam(req, 'botId')
      const { search } = body

      const bot = await prisma.bot.findUniqueByIdentifier(session.user, botId, {
        select: {
          id: true,
          userId: true,
        },
      })

      if (!bot) {
        return notFound()
      }

      if (bot.userId !== session.user.id) {
        return notAuthorized()
      }

      const items = await searchMemories(session.user, search, {
        botId: bot.id,
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
 * @manual Bot Memories
 * @description Bot memories store information learned from conversations, enabling bots to recall past interactions and maintain context across sessions for more intelligent and personalized responses.
 * @category Resources/Bots
 * @tags bot, memory, conversation-history, context
 * @index 1
 *
 * Bot memories are automatically created during conversations and store
 * information that the bot has encountered or learned. This memory system
 * enables bots to maintain context, recall previous interactions, and provide
 * more personalized and contextually relevant responses over time.
 *
 * ## Searching Bot Memories
 *
 * Searching bot memories enables you to query stored information associated
 * with a specific bot, allowing you to retrieve relevant details from past
 * conversations and interactions. This functionality is essential for
 * understanding what information the bot has learned, auditing conversation
 * history, and debugging bot behavior.
 *
 * The search helps you discover what the bot knows about specific topics,
 * verify that important information was captured correctly, and analyze
 * patterns in the data the bot has access to. This is particularly valuable
 * for troubleshooting, optimization, and ensuring the bot maintains accurate
 * and appropriate information.
 *
 * ```http
 * POST /api/v1/bot/{botId}/memory/search
 * Content-Type: application/json
 *
 * {
 *   "search": "customer refund policy"
 * }
 * ```
 *
 * The search operation performs semantic similarity matching against stored
 * memories, returning the most relevant results based on your query. This goes
 * beyond simple keyword matching to understand the meaning and context of your
 * search, finding memories that are conceptually related even if they don't
 * contain the exact search terms.
 *
 * Each returned memory includes its unique identifier, the text content, and
 * any associated metadata. The results are limited to 50 memories per search
 * to ensure performance and manageability. The most relevant memories appear
 * first in the results, ordered by their similarity to your search query.
 *
 * Memory search is particularly useful for several scenarios: verifying that
 * the bot correctly learned information from conversations, troubleshooting
 * why a bot might be giving certain responses, analyzing what topics users are
 * discussing with the bot, and auditing the information landscape that
 * influences bot behavior.
 *
 * The search is scoped to the specific bot you're querying, ensuring that
 * results are relevant to that bot's conversation history and learned
 * information. This isolation prevents cross-contamination between different
 * bots and maintains clear boundaries between bot-specific knowledge.
 *
 * **Note:** Memory search only returns memories associated with the specified
 * bot. Memories are automatically created from conversations but can also be
 * manually created or imported to provide the bot with specific knowledge or
 * context.
 */
