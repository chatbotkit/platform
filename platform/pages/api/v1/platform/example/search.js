// @ts-check
import { searchExamples } from '@/lib/example.search'
import { getExternalHostURL } from '@/lib/host'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import examplesData from '@/examples'

export const bodySchema = schema.object({
  search: schema.string(),
  take: schema.number().integer().min(1).max(100).default(10),
})

/**
 * @swagger
 *
 * /platform/example/search:
 *   post:
 *     operationId: searchPlatformExamples
 *     summary: Search platform examples
 *     tags:
 *       - Platform
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 description: The search query to find relevant examples
 *                 type: string
 *               take:
 *                 description: The maximum number of results to return (1-100, default 10)
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 10
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
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             description: The type of the example
 *                             type: string
 *                             enum:
 *                               - blueprint
 *                               - project
 *                               - widget
 *                               - slack
 *                               - discord
 *                               - whatsapp
 *                               - messenger
 *                               - telegram
 *                               - twilio
 *                               - email
 *                               - trigger
 *                           tags:
 *                             description: Tags associated with the example
 *                             type: array
 *                             items:
 *                               type: string
 *                           link:
 *                             description: The URL to the official example page
 *                             type: string
 *                         required:
 *                           - name
 *                           - description
 *                           - type
 *                           - link
 *               required:
 *                 - items
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, _session, body) {
      const { search, take = 10 } = body

      const results = await searchExamples(search, {
        limit: take,
        threshold: 0,
      })

      const items = results
        .map((result) => {
          const example = examplesData.find((ex) => ex.slug === result.slug)

          if (!example) {
            return null
          }

          const isBlueprint = example.blueprint !== undefined
          const isProject = Array.isArray(example.files)

          return {
            id: example.slug,

            name: example.title,
            description: example.description,

            type: isBlueprint
              ? 'blueprint'
              : isProject
              ? 'project'
              : example.integration || 'widget',

            tags: example.keywords,

            // @todo improve DRYness here

            link: getExternalHostURL(`/examples/${example.slug}`),

            createdAt: example.date
              ? new Date(example.date).getTime()
              : Date.now(),
            updatedAt: example.date
              ? new Date(example.date).getTime()
              : Date.now(),
          }
        })
        .filter(Boolean)

      return ok({
        items,
      })
    })
  )
)

/**
 * @manual Platform Examples
 * @index 21
 *
 * ## Searching for Relevant Examples
 *
 * When you have a specific use case or need in mind, text search helps you find
 * the most relevant examples quickly. The search ranks matches from the example
 * title, description, keywords, commentary, and configuration.
 *
 * To search for examples based on a natural language description:
 *
 * ```http
 * POST /api/v1/platform/example/search
 * Content-Type: application/json
 *
 * {
 *   "search": "chatbot for e-commerce customer support with order tracking"
 * }
 * ```
 *
 * The `search` parameter accepts natural language queries describing what you're
 * trying to build or the problem you're trying to solve. The optional `take`
 * parameter limits the number of results returned (1-100, default is 10).
 *
 * The more specific your query, the more relevant the results will be. For example:
 *
 * - "sales assistant that qualifies leads and schedules meetings"
 * - "discord bot for community moderation with automated warnings"
 * - "multilingual customer service agent with FAQ integration"
 *
 * ## Understanding Search Results
 *
 * Search results are ordered by weighted text relevance. The response structure
 * matches the list endpoint,
 * returning the same detailed information about each matching example. The
 * search algorithm considers:
 *
 * - Example descriptions and use case documentation
 * - Configured abilities and integrations
 * - Keywords and categorical tags
 * - Typical conversation patterns and behaviors
 *
 * The `take` parameter controls how many results are returned (1-100, default 10).
 * Only examples containing at least one matching query term are returned.
 *
 * ```javascript
 * {
 *   "items": [
 *     {
 *       "id": "ecommerce-support-agent",
 *       "name": "E-commerce Support Agent",
 *       "description": "Handles order tracking and product questions",
 *       "type": "blueprint",
 *       "tags": ["ecommerce", "orders", "support"],
 *       "link": "https://chatbotkit.com/examples/ecommerce-support-agent",
 *       "createdAt": 1700000000000,
 *       "updatedAt": 1700000000000
 *     }
 *   ]
 * }
 * ```
 *
 * ## Best Practices for Searching
 *
 * For optimal search results:
 *
 * - Be specific about your use case and requirements
 * - Mention key features or integrations you need
 * - Include industry or domain context if relevant
 * - Include the terms most likely to appear in titles, descriptions, or keywords
 * - Adjust the `take` parameter based on how many alternatives you want to review
 *
 * If your initial search doesn't return relevant results, try rephrasing your
 * query with different terms or breaking down your requirements into simpler
 * concepts. You can also browse the full example list to discover categories
 * and use cases you might not have considered.
 */
