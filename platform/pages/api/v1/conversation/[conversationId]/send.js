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
  text: schema.string().trim().min(1).required(),

  entities: schema
    .array()
    .items(
      schema.object({
        begin: schema.number().integer().min(0),
        end: schema.number().integer().min(1),
      })
    )
    .default([]),

  // ---

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
 * /conversation/{conversationId}/send:
 *   post:
 *     operationId: sendConversationMessage
 *     summary: Send a message to a conversation
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to send the message to
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - type: object
 *                 properties:
 *                   text:
 *                     description: The text of the message to send
 *                     type: string
 *                   entities:
 *                     description: Known entities
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Entity'
 *                 required:
 *                   - text
 *               - type: object
 *                 properties:
 *                   functions:
 *                     $ref: '#/components/schemas/FunctionsDefinition'
 *                   extensions:
 *                     $ref: '#/components/schemas/ExtensionsDefinition'
 *     responses:
 *       200:
 *         description: The message was sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the sent message
 *                   type: string
 *                 entities:
 *                   description: Extracted entities from the message
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Entity'
 *               required:
 *                 - id
 *                 - entities
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
 *                       $ref: '#/paths/~1conversation~1{conversationId}~1send/post/responses/200/content/application~1json/schema'
 *                   required:
 *                     - type
 *                     - data
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
          text,

          entities,

          // ---

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
            userId: session.user.id,

            entities,

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
            usage: sendUsage,
            messages: sendMessages,
            entities: safeEntities,
          } = await engine.send(text)

          usage.token += sendUsage.token

          const lastSendMessage = sendMessages.slice().pop()

          const event = createSinkEvent(
            /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ (
              /** @type {unknown} */ ({
                type: TAG_RESULT,
                data: {
                  id: lastSendMessage?.id,
                  text: lastSendMessage?.text,
                  entities: safeEntities,
                  usage: usage,
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
 * @index 50
 *
 * ## Sending Messages to a Conversation
 *
 * The send endpoint allows you to send a user message to a conversation and
 * add it to the conversation history. The message is processed and events may
 * be generated, but this endpoint does not produce an AI response. To receive
 * the AI's response, you need to call the receive route separately. This design
 * provides flexibility in controlling conversation flow and separating message
 * sending from response generation.
 *
 * To send a message to a conversation, use a POST request with streaming support:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/send
 * Content-Type: application/json
 *
 * {
 *   "text": "What are your business hours?"
 * }
 * ```
 *
 * Replace `{conversationId}` with the actual ID of the conversation. The text
 * field is required and contains the user's message.
 *
 * ### How Send Works
 *
 * The send endpoint adds your message to the conversation and processes it, but
 * does not generate an AI response. It may generate events and perform some
 * processing based on the message content, but to receive a message from the AI
 * agent, you need to call the receive route separately. This allows you to have
 * more control over the conversation flow and separate the message sending from
 * the response generation phases.
 *
 * The response is delivered as a stream of JSON lines (JSONL), where each line
 * represents an event related to message processing.
 *
 * ### Advanced Features
 *
 * The send endpoint supports several advanced features for enhanced
 * functionality:
 *
 * **Function Calling:**
 *
 * You can enable the AI to call functions during the conversation:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/send
 * Content-Type: application/json
 *
 * {
 *   "text": "What's the weather in San Francisco?",
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
 *         }
 *       },
 *       "result": {}
 *     }
 *   ]
 * }
 * ```
 *
 * When the AI determines a function call is appropriate, it will include function
 * call information in the streaming response. The result object is used to return
 * the function execution results.
 *
 * **Extensions (Trusted Sessions Only):**
 *
 * For trusted API sessions, you can temporarily extend the conversation's
 * capabilities:
 *
 * - **extensions.backstory**: Add additional instructions for this message only
 * - **extensions.datasets**: Provide inline dataset records for context
 * - **extensions.skillsets**: Add temporary abilities for this interaction
 * - **extensions.features**: Enable specific features for this message
 *
 * ### Response Structure
 *
 * The final result event includes the ID of the created message and usage
 * statistics for the operation.
 *
 * ### Message Flow
 *
 * When you send a message:
 *
 * 1. Your message is added to the conversation history
 * 2. The message is processed and events may be generated
 * 3. The message ID is returned in the result event
 * 4. No AI response is generated (use the receive route to get the AI response)
 * 5. The conversation is ready for further interactions
 *
 * ### Best Practices
 *
 * - **Handle Streaming Properly**: Implement proper streaming parsing in your
 *   client to handle JSONL responses
 * - **Handle Errors Gracefully**: Watch for error events in the stream and
 *   display appropriate messages
 * - **Respect Rate Limits**: Be aware of message and token rate limits for your
 *   account
 *
 * **Important Notes:**
 *
 * - The conversation maintains full message history for context
 * - The send operation adds your message to the conversation but does not
 *   generate an AI response
 * - To receive an AI response, call the receive route after sending
 * - Token usage is tracked and counted against your account limits
 * - Streaming responses can be interrupted if the connection is lost
 */

// @todo document entity annotations API
