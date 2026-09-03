// @ts-check
import prisma from '@/prisma/client'

import { canUseDataset } from '@/lib/dataset.access'
import { DatasetFilterSchema } from '@/lib/dataset.filter'
import { searchDataset } from '@/lib/dataset.search'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export const bodySchema = schema.object({
  search: schema.string(),
  filter: schema.object().zodSchema(DatasetFilterSchema).optional(),
})

/**
 * @swagger
 *
 * /dataset/{datasetId}/search:
 *   post:
 *     operationId: searchDataset
 *     summary: Search a dataset for records matching a given search query
 *     tags:
 *       - Dataset
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset to search
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
 *               filter:
 *                 $ref: '#/components/schemas/DatasetFilter'
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
 *                 id:
 *                   description: The ID of the dataset that was searched
 *                   type: string
 *                 records:
 *                   description: An array of records matching the search query
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       text:
 *                         type: string
 *                       source:
 *                         type: string
 *                       meta:
 *                         type: object
 *                       score:
 *                         type: number
 *                     required:
 *                       - id
 *                       - text
 *                       - score
 *               required:
 *                 - id
 *                 - records
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { search, filter } = body

      const dataset = await prisma.dataset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'datasetId')
      )

      if (!dataset) {
        return notFound()
      }

      if ((await canUseDataset(session.user.id, dataset)) === false) {
        return notAuthorized()
      }

      const records = await searchDataset(
        session.user.id,
        dataset,
        search,
        filter
      )

      return ok({
        id: dataset.id,

        records: makeJsonSafe(records),
      })
    })
  )
)

/**
 * @manual Dataset Search
 * @description Datasets provide powerful semantic search capabilities to find relevant information based on natural language queries, enabling your bots to retrieve contextually appropriate knowledge from large knowledge bases.
 * @category Resources/Datasets
 * @tags dataset, search, semantic-search, vector-search
 * @index 1
 *
 * Dataset search is the core functionality that enables intelligent information retrieval from your knowledge bases. Unlike traditional keyword-based search, dataset search uses semantic understanding to find records that are contextually relevant to a query, even when the exact words don't match. This makes it ideal for powering conversational AI applications where users ask questions in natural language.
 *
 * When you search a dataset, the system converts your query into a vector embedding that captures its semantic meaning, then compares this embedding against all record embeddings in the dataset using similarity metrics. The most relevant records are returned ranked by their relevance scores, giving you the best matches for answering questions or providing context to your bots.
 *
 * Dataset search is used extensively in bot conversations to provide relevant context for generating accurate responses. When a user asks a question, the bot can search connected datasets to find pertinent information, then use that information to formulate an informed answer. This retrieval-augmented generation (RAG) approach significantly improves response quality and accuracy.
 *
 * ## Performing Searches
 *
 * To search a dataset, provide a natural language query string that describes the information you're looking for. The search query can be a question, a statement, or keywords - the semantic search will find contextually relevant records regardless of exact phrasing:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/search
 * Content-Type: application/json
 *
 * {
 *   "search": "How do I reset my password?"
 * }
 * ```
 *
 * The response includes an array of records ordered by relevance, with each record containing its text content, source information, metadata, and a relevance score. Higher scores indicate stronger semantic similarity between the query and the record content.
 *
 * ### Understanding Relevance Scores
 *
 * Each returned record includes a relevance score that indicates how well it matches your search query. Scores typically range from 0 to 1, with higher values representing stronger semantic similarity. You can use these scores to filter results or present only the most relevant records to users.
 *
 * The scoring algorithm considers semantic meaning rather than simple keyword matching, so records with different wording but similar concepts will score well. This allows the search to understand synonyms, related concepts, and contextual relevance that keyword searches would miss.
 *
 * ### Advanced Filtering
 *
 * In addition to the basic search query, you can apply filters to narrow results based on metadata fields, source information, or other record attributes. This is useful when you need to search within specific categories, filter by document types, or restrict results to particular sources:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/search
 * Content-Type: application/json
 *
 * {
 *   "search": "product pricing information",
 *   "filter": {
 *     "meta.category": "pricing",
 *     "meta.status": "published"
 *   }
 * }
 * ```
 *
 * Filters allow you to combine semantic search with structured metadata queries, giving you precise control over which records are considered while still leveraging semantic relevance ranking.
 *
 * ### Search Performance and Limits
 *
 * Dataset search is optimized for speed even with large knowledge bases containing thousands of records. Search queries typically complete in milliseconds, making them suitable for real-time bot interactions where users expect immediate responses.
 *
 * By default, searches return the top most relevant records. You can adjust the number of results returned based on your use case - fewer results for focused answers, more results when you need comprehensive context or want to present multiple options to users.
 *
 * **Important**: You must have access permissions to search a dataset. This includes datasets you own directly, datasets shared with your organization, or public datasets. The search endpoint will verify permissions before processing your query.
 */
