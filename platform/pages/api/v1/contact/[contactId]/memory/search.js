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
 * /contact/{contactId}/memory/search:
 *   post:
 *     operationId: searchContactMemory
 *     summary: Search memories for a specific contact
 *     tags:
 *       - Contact Memory
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to search memories for
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
      const contactId = requiredUrlParam(req, 'contactId')
      const { search } = body

      const contact = await prisma.contact.findUniqueByIdentifier(
        session.user,
        contactId,
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!contact) {
        return notFound()
      }

      if (contact.userId !== session.user.id) {
        return notAuthorized()
      }

      const items = await searchMemories(session.user, search, {
        contactId: contact.id,
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
 * @manual Contacts
 *
 * ## Searching Contact Memories
 *
 * Memory search enables semantic search across all memories associated with
 * a specific contact, allowing you to find relevant historical information
 * using natural language queries rather than exact text matching.
 *
 * ```http
 * POST /api/v1/contact/{contactId}/memory/search
 * Content-Type: application/json
 *
 * {
 *   "search": "favorite food preferences"
 * }
 * ```
 *
 * Unlike simple listing, memory search uses vector similarity to find
 * semantically related memories even when the exact words don't match,
 * making it ideal for conversational AI that needs to recall relevant
 * context from past interactions.
 *
 * ## How Semantic Search Works
 *
 * Memory search converts your query into a vector embedding and compares it
 * against the embeddings of all stored memories, returning the most
 * semantically similar results. This means:
 *
 * - **Conceptual matching**: Find memories about "pizza preferences" even when
 *   the stored memory uses words like "Italian food choices"
 * - **Context awareness**: Results understand meaning, not just keywords
 * - **Ranked relevance**: Memories are ordered by semantic similarity to your query
 * - **Flexible queries**: Use natural language questions or statements as search terms
 *
 * ## Search Request Parameters
 *
 * The search endpoint accepts the following body parameter:
 *
 * ```http
 * POST /api/v1/contact/{contactId}/memory/search
 * Content-Type: application/json
 *
 * {
 *   "search": "user's dietary restrictions"
 * }
 * ```
 *
 * Available parameters:
 *
 * - **search** (required): The search query in natural language
 *
 * ## Understanding Search Results
 *
 * Search results include the memory content ranked by relevance to your query:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "memory_abc123",
 *       "text": "User prefers vegetarian options and avoids dairy",
 *       "createdAt": "2025-11-15T10:00:00Z",
 *       "updatedAt": "2025-11-15T10:00:00Z"
 *     },
 *     {
 *       "id": "memory_def456",
 *       "text": "Mentioned interest in Italian cuisine",
 *       "createdAt": "2025-11-10T14:30:00Z",
 *       "updatedAt": "2025-11-10T14:30:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * Results are ranked by semantic relevance, with the most closely matching
 * memories appearing first in the list.
 *
 * ## Use Cases for Memory Search
 *
 * Memory search enables powerful conversational AI capabilities:
 *
 * **Contextual Conversations:**
 * When a user asks a question, search their memories to find relevant past
 * information that provides context for generating personalized responses.
 *
 * **Preference Recall:**
 * Find user preferences and settings stored in memories without needing to
 * know exact keywords or tags.
 *
 * **Follow-up Understanding:**
 * When a user refers to something from a past conversation, search memories
 * to understand what they're referencing.
 *
 * **Personalization:**
 * Retrieve relevant biographical details or preferences to personalize
 * interactions without asking repetitive questions.
 *
 * ## Search Performance Considerations
 *
 * Memory search uses vector embeddings and similarity calculations, which
 * have different performance characteristics than simple list queries:
 *
 * - **Semantic accuracy**: Results based on meaning, not just text matching
 * - **Ranked relevance**: Most relevant memories appear first
 * - **Bounded results**: Up to 10 reranked results are returned per request
 * - **Contact-scoped**: Search only within the specific contact's memories
 *
 * ## Best Practices
 *
 * To get the best results from memory search:
 *
 * - **Clear queries**: Use specific, well-formed search questions
 * - **Natural language**: Write queries as you would ask a person
 * - **Context integration**: Combine search results thoughtfully in your responses
 *
 * **Important:** Memory search requires that contact memories have been
 * properly stored and indexed. Newly created memories may take a moment to
 * become available for search as embeddings are generated. Search operates
 * only within the specified contact's memory space and cannot access memories
 * from other contacts.
 */
