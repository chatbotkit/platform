import type { Session } from 'next-auth'

import debug, { createSpan } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { getHeader } from '@/lib/header'
import { withAny } from '@/lib/method'
import { withSession } from '@/lib/session.handler'

import type { Context } from '@/graphql/v1/schema'
import { schema } from '@/graphql/v1/schema'

import { initContextCache } from '@pothos/core'

import { createYoga } from 'graphql-yoga'

const { handleRequest } = createYoga<Context>({
  schema: schema,

  // @note pass the session to the context and initialize the cache

  context: async ({ session, caller }) => ({
    ...initContextCache(),

    session,

    caller,
  }),

  // @note when requests arrive through the api.chatbotkit.com beforeFiles
  // rewrite the original path (/v1/graphql) is preserved on req.url so the
  // endpoint pattern must accept both the rewritten and the original path

  graphqlEndpoint: '{/api}?/v1/graphql',

  // @note yoga needs to know how to create a valid Next response

  fetchAPI: { Response },
})

/**
 * @swagger
 *
 * /graphql:
 *   post:
 *     operationId: graphql
 *     summary: Execute a GraphQL query
 *     tags:
 *       - GraphQL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 description: The GraphQL query or mutation string
 *                 type: string
 *               variables:
 *                 description: The variables for the GraphQL operation
 *                 type: object
 *                 additionalProperties: true
 *               operationName:
 *                 description: The name of the operation to execute
 *                 type: string
 *             required:
 *               - query
 *     responses:
 *       200:
 *         description: The result of the GraphQL operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   description: The data returned by the GraphQL operation
 *                   type: object
 *                   additionalProperties: true
 *                 errors:
 *                   description: Any errors returned by the GraphQL operation
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withAny(
  withSession(async (req: Request, session: Session) => {
    debug(`graphql request received`).log('pages.api.v1.graphql.handler')

    // @note the reason we return a Response directly is that we want to start
    // streaming the response as soon as possible to avoid timeouts - on edge
    // runtime the timeout will occur after 25 seconds and while we hope to
    // perform the query in less than that, we also want to handle the situation
    // when the query takes longer for some reason

    return new Response(
      new ReadableStream({
        async start(controller) {
          debug(`graphql request started`).log('pages.api.v1.graphql.handler')

          const span = createSpan({ name: '/api/v1/graphql' })

          let alreadySentSome = false
          let controllerDone = false

          try {
            const caller = getHeader(req, 'x-chatbotkit-caller')

            const stream = await handleRequest(req, { session, caller })

            debug(`graphql request handled`).log('pages.api.v1.graphql.handler')

            const reader = stream.body?.getReader()

            if (!reader) {
              throw new Error('Failed to get reader from response body')
            }

            while (true) {
              const { done, value } = await reader.read()

              if (done) {
                break
              }

              controller.enqueue(value)

              alreadySentSome = true
            }
          } catch (e) {
            await captureException(e)

            if (alreadySentSome) {
              controller.error(e)

              controllerDone = true
            } else {
              controller.enqueue(
                JSON.stringify({
                  errors: [{ message: (e as Error).message }],
                })
              )
            }
          } finally {
            span.finish()

            if (!controllerDone) {
              controller.close()
            }
          }
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    )
  })
)

/**
 * @manual GraphQL
 * @description The GraphQL API provides a flexible, powerful interface for querying and manipulating platform resources using a single endpoint with strongly-typed schemas.
 * @category GraphQL
 * @tags graphql, api, query, mutation
 * @index 1
 *
 * The GraphQL API is a modern alternative to traditional REST endpoints,
 * offering a flexible and efficient way to interact with ChatBotKit platform
 * resources. Unlike REST APIs where you make multiple requests to different
 * endpoints, GraphQL allows you to request exactly the data you need in a
 * single query, reducing network overhead and improving application
 * performance.
 *
 * ## Understanding GraphQL
 *
 * GraphQL uses a strongly-typed schema system that defines all available
 * operations and data structures. This schema serves as a contract between
 * the client and server, enabling powerful tooling like auto-completion,
 * validation, and automatic documentation generation. The GraphQL endpoint
 * supports both queries (for reading data) and mutations (for modifying
 * data), all through a single HTTP POST request.
 *
 * The platform's GraphQL implementation uses GraphQL Yoga, providing a
 * robust, production-ready GraphQL server with streaming support for
 * long-running operations. The API automatically handles authentication
 * through your session and enforces the same access controls as REST
 * endpoints.
 *
 * ## Executing GraphQL Queries
 *
 * To execute a GraphQL query, send a POST request to the GraphQL endpoint
 * with your query string and any required variables. The query language is
 * intuitive and self-documenting, allowing you to specify exactly which
 * fields you want to retrieve.
 *
 * ```http
 * POST /api/v1/graphql
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "query": "query GetBots { bots(first: 10) { items { id name description } } }",
 *   "variables": {}
 * }
 * ```
 *
 * The response contains a `data` field with your requested information and
 * an optional `errors` array if any issues occurred during execution. This
 * structure allows partial success - you might receive some data along with
 * errors for fields that couldn't be resolved.
 *
 * ## Using Variables and Operation Names
 *
 * For complex queries with dynamic values, use GraphQL variables instead of
 * string interpolation. Variables are type-checked against your query,
 * providing compile-time safety and preventing injection vulnerabilities.
 *
 * ```http
 * POST /api/v1/graphql
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "query": "query GetBot($id: ID!) { bot(id: $id) { id name backstory model } }",
 *   "variables": {
 *     "id": "bot_abc123"
 *   },
 *   "operationName": "GetBot"
 * }
 * ```
 *
 * The `operationName` field is optional but recommended when your query
 * document contains multiple operations. It explicitly tells the server
 * which operation to execute, improving clarity and enabling better
 * monitoring and debugging.
 *
 * ## Performing Mutations
 *
 * Mutations modify server-side data and follow the same request format as
 * queries. By convention, mutation operations are named with verbs that
 * describe the action being performed.
 *
 * ```http
 * POST /api/v1/graphql
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "query": "mutation CreateBot($input: CreateBotInput!) { createBot(input: $input) { id name } }",
 *   "variables": {
 *     "input": {
 *       "name": "Support Assistant",
 *       "description": "Helps customers with common questions"
 *     }
 *   }
 * }
 * ```
 *
 * Mutations return the newly created or modified resource, allowing you to
 * immediately access updated data without making an additional query. This
 * pattern reduces network round-trips and ensures consistency between your
 * local state and the server.
 *
 * ## Error Handling
 *
 * GraphQL errors are returned in a structured format within the response,
 * allowing you to handle different error types appropriately. Errors include
 * detailed information about what went wrong, including field paths and
 * error codes when applicable.
 *
 * The platform uses streaming responses for GraphQL operations, which means
 * long-running queries won't timeout prematurely. If an error occurs after
 * partial data has been sent, the stream will include the error information
 * in the GraphQL errors array while preserving any successfully resolved
 * data.
 *
 * **Best Practice:** Use GraphQL introspection queries during development to
 * explore the available schema, types, and operations. Most GraphQL clients
 * provide built-in schema exploration tools that auto-complete field names
 * and validate queries against the schema before execution.
 *
 * **Note:** The GraphQL API provides access to the same resources as REST
 * endpoints but with more flexibility in data fetching. For simple CRUD
 * operations, REST endpoints may be more straightforward, while GraphQL
 * excels at complex data requirements and reducing over-fetching.
 */
