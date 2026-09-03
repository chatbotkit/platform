// @ts-check
import { isTrustedSession } from '@/lib/audience.helpers'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { TAG_ERROR, TAG_RESULT, createSinkEvent } from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { withStream } from '@/lib/stream'
import {
  captureError,
  errorResponseToError,
  errorToSafeErrorResponse,
} from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'

import extensionsSchema from '@/schemas/inlineExtensions'
import functionsSchema from '@/schemas/functionsSchema'

export const bodySchema = schema.object({
  functions: functionsSchema,

  extensions: extensionsSchema,

  // ----------------
  // unstable options
  // ----------------

  // debugging

  debug: schema.boolean().default(false),
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/receive:
 *   post:
 *     operationId: receiveConversationMessage
 *     summary: Receive a conversation response
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to receive message from
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - type: object
 *                 properties: {}
 *               - type: object
 *                 properties:
 *                   functions:
 *                     $ref: '#/components/schemas/FunctionsDefinition'
 *                   extensions:
 *                     $ref: '#/components/schemas/ExtensionsDefinition'
 *     responses:
 *       200:
 *         description: The message was received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created message
 *                   type: string
 *                 text:
 *                   description: The text of the message received
 *                   type: string
 *                 usage:
 *                   $ref: '#/components/schemas/Usage'
 *               required:
 *                 - id
 *                 - text
 *                 - usage
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - result
 *                     data:
 *                       $ref: '#/paths/~1conversation~1{conversationId}~1receive/post/responses/200/content/application~1json/schema'
 *                 - $ref: '#/components/schemas/CompleteStreamingResponseItem'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const {
          functions,

          extensions,

          // ----------------
          // unstable options
          // ----------------

          // debugging

          debug: debugFlag,
        } = body

        const isStreamingResponse =
          stream.acceptFormat !== undefined && stream.acceptFormat !== 'json'

        const sink = new (class {
          /**
           * @param {string} type
           * @param {unknown} data
           */
          async push(type, data) {
            const event = createSinkEvent(
              /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ ({
                type,
                data,
              })
            )

            switch (type) {
              case TAG_ERROR: {
                if (isStreamingResponse) {
                  await stream.push(event)
                } else {
                  await stream.error(
                    errorResponseToError(
                      /** @type {import('@/lib/conversation.tag').ErrorData} */ (
                        event.data
                      )
                    )
                  )
                }

                return event
              }

              case TAG_RESULT: {
                return event // @note there must be only one result
              }

              default: {
                await stream.push(event)

                return event
              }
            }
          }
        })()

        const isTrusted = isTrustedSession(session)

        const engine = await getStatefulConversationEngine({
          conversationId: requiredUrlParam(req, 'conversationId'),

          options: {
            sessionId: session.id,
            userId: session.user.id,

            sink,

            backstoryExtra: isTrusted ? extensions?.backstory : undefined,

            features: [
              ...(session.options?.engine?.features || []),

              ...(isTrusted ? extensions?.features || [] : []),
            ],

            functions,

            inlineDatasets:
              isTrusted && extensions?.datasets?.length
                ? extensions.datasets
                : undefined,

            inlineSkillsets:
              isTrusted && extensions?.skillsets?.length
                ? extensions.skillsets
                : undefined,

            ...(isTrusted ? { debug: debugFlag } : {}),

            usageMeta: {
              // @note additional meta can be added here
              // @note conversationId and botId are assumed to be recorded by the engine
            },

            signal: stream.abortSignal,
          },
        })

        try {
          const usage = {
            token: 0,
          }

          const {
            usage: receiveUsage,

            messages: receiveMessages,
          } = await engine.receive()

          usage.token += receiveUsage.token

          const lastReceiveMessage = receiveMessages.slice().pop()

          const event = createSinkEvent(
            /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ (
              /** @type {unknown} */ ({
                type: TAG_RESULT,
                data: {
                  id: lastReceiveMessage?.id,
                  text: lastReceiveMessage?.text,
                  usage,
                },
              })
            )
          )

          if (isStreamingResponse) {
            await stream.push(event)
          } else {
            await stream.result(event.data)
          }
        } catch (e) {
          debug(`responding with error`, { e })

          await captureError(e)

          const event = createSinkEvent({
            type: TAG_ERROR,
            data: errorToSafeErrorResponse(e),
          })

          if (isStreamingResponse) {
            await stream.push(event)
          } else {
            await stream.error(errorResponseToError(event.data))
          }
        } finally {
          await engine.dispose()
        }
      })
    )
  )
)

/**
 * @manual Conversations
 * @index 30
 *
 * ## Receiving AI Responses
 *
 * The receive endpoint enables you to request and receive AI-generated responses
 * within a conversation. This endpoint is essential for real-time chat interactions
 * where you need the AI to process the conversation history and generate an
 * appropriate response based on the context, backstory, and any configured
 * datasets or skillsets.
 *
 * Unlike the send endpoint which adds user messages and triggers processing, the
 * receive endpoint focuses specifically on getting the AI's response, giving you
 * fine-grained control over the conversation flow and allowing you to customize
 * behavior with extensions and runtime configurations.
 *
 * ### Basic Usage
 *
 * To receive an AI response, send a POST request to the receive endpoint. The
 * endpoint returns a streaming response containing the AI-generated message:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/receive
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response is delivered as a server-sent events (SSE) stream, allowing you
 * to process the AI's response as it is generated in real-time, providing a
 * smooth user experience with progressive text rendering.
 *
 * ### Extending Conversations with Runtime Configuration
 *
 * One of the most powerful features of the receive endpoint is the ability to
 * extend and customize the conversation at runtime without modifying the
 * underlying bot or conversation configuration. You can provide extensions that
 * temporarily augment the conversation with additional context, data sources,
 * and capabilities:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/receive
 * Content-Type: application/json
 *
 * {
 *   "extensions": {
 *     "backstory": "Additional context: The user is asking about enterprise pricing.",
 *     "datasets": [
 *       {
 *         "name": "Pricing Information",
 *         "description": "Enterprise pricing and plans",
 *         "records": [
 *           {
 *             "text": "Enterprise plan starts at $500/month for 10 users",
 *             "meta": {}
 *           }
 *         ]
 *       }
 *     ],
 *     "skillsets": [
 *       {
 *         "name": "Sales Tools",
 *         "description": "Tools for sales conversations",
 *         "abilities": [
 *           {
 *             "name": "check_inventory",
 *             "description": "Check product inventory status",
 *             "instruction": "fetch https://api.example.com/inventory",
 *             "meta": {}
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * ### Extension Capabilities
 *
 * The extensions object supports multiple types of runtime customizations:
 *
 * **Backstory Extensions**: Add or override conversation instructions temporarily
 * without modifying the bot's base configuration. This is useful for providing
 * conversation-specific context, handling special cases, or adapting behavior
 * based on user attributes or session data.
 *
 * **Dataset Extensions**: Inject additional knowledge into the conversation
 * dynamically. This allows you to provide context-specific information without
 * permanently adding it to your datasets, ideal for user-specific data,
 * session-specific context, or temporary information that may change frequently.
 *
 * **Skillset Extensions**: Temporarily grant the AI access to additional
 * capabilities and tools for specific conversations. This enables you to provide
 * specialized functionality based on user permissions, conversation type, or
 * specific workflow requirements without permanently modifying the bot's skillset.
 *
 * **Feature Extensions**: Enable or disable specific conversation features at
 * runtime, such as tool calling, code interpretation, or image understanding,
 * allowing fine-grained control over AI capabilities on a per-interaction basis.
 *
 * ### Function Calling
 *
 * The receive endpoint supports function calling, enabling the AI to invoke
 * predefined functions during response generation. Define available functions
 * in your request:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/receive
 * Content-Type: application/json
 *
 * {
 *   "functions": [
 *     {
 *       "name": "get_weather",
 *       "description": "Get current weather for a location",
 *       "parameters": {
 *         "type": "object",
 *         "properties": {
 *           "location": {
 *             "type": "string",
 *             "description": "City name"
 *           }
 *         },
 *         "required": ["location"]
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * When the AI determines that a function call is needed, the response stream
 * will include function call requests that your application should handle and
 * respond to, enabling dynamic, interactive conversations with external data
 * sources and services.
 *
 * ### Streaming Response Format
 *
 * The receive endpoint returns responses as a streaming SSE (Server-Sent Events)
 * format, allowing you to process the AI's response progressively as it is
 * generated. This provides a better user experience compared to waiting for the
 * complete response.
 *
 * The stream emits tagged events that indicate different types of responses:
 *
 * - **result**: Contains chunks of the AI-generated text response
 * - **error**: Indicates an error occurred during processing
 * - **done**: Signals the end of the response stream
 *
 * **Important Notes:**
 *
 * - The receive endpoint is typically used in conjunction with the send endpoint
 *   in client-side applications
 * - Extensions are temporary and do not modify the underlying bot or conversation
 *   configuration
 * - Function responses must be handled by your application and fed back into the
 *   conversation
 * - The endpoint supports both API key authentication and conversation session
 *   tokens
 * - Response streaming requires proper SSE handling in your client application
 *
 * **Security Considerations:**
 *
 * When using extensions, be mindful of the data you inject into conversations.
 * Extensions allow powerful runtime customization but should be used carefully
 * to avoid exposing sensitive information or granting unintended capabilities.
 * Always validate and sanitize any user-provided data before including it in
 * extensions.
 */
