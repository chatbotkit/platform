// @ts-check
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import {
  TAG_ERROR,
  TAG_RECEIVE_RESULT,
  TAG_RESULT,
  TAG_SEND_RESULT,
  createSinkEvent,
} from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { withStream } from '@/lib/stream'
import {
  captureException,
  errorResponseToError,
  errorToSafeErrorResponse,
} from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { getRandomId } from '@/lib/string'

import functionsSchema from '@/schemas/functionsSchema'

export const bodySchema = schema.object({
  text: schema.string(),

  entities: schema
    .array()
    .items(
      schema.object({
        begin: schema.number().integer().min(0),
        end: schema.number().integer().min(1),
      })
    )
    .default([]),

  // ----------------
  // unstable options
  // ----------------

  // functions

  functions: functionsSchema,
})

/**
 * -@swagger
 *
 * /conversation/{conversationId}/initiate:
 *   post:
 *     operationId: initiateConversationMessage
 *     summary: Creates a bot message in a conversation based on the provided text
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to receive message from
 *           type: string
 *       - $ref: '#/components/parameters/TimezoneHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 description: The text of the message to send
 *                 type: string
 *               entities:
 *                 description: Known entities
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Entity'
 *             required:
 *               - text
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
 *                       $ref: '#/paths/~1conversation~1{conversationId}~1complete/post/responses/200/content/application~1json/schema'
 *                   required:
 *                     - type
 *                     - data
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - token
 *                     data:
 *                       description: The data for the event
 *                       type: object
 *                       properties:
 *                         token:
 *                           description: The token generated
 *                           type: string
 *                       required:
 *                         - token
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['special/rate/initiate', 'rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const {
          text,

          entities,

          // ----------------
          // unstable options
          // ----------------

          // functions

          functions,
        } = body

        const isStreamingResponse =
          stream.acceptFormat !== undefined && stream.acceptFormat !== 'json'

        // @todo return 409 is the last message received was less then some time ago

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

        const engine = await getStatefulConversationEngine({
          conversationId: requiredUrlParam(req, 'conversationId'),

          options: {
            sessionId: session.id,
            userId: session.user.id,

            entities,

            sink,

            //
            // unstable options
            //

            ...{
              // functions

              functions,

              // features

              features: [...(session.options?.engine?.features || [])],
            },

            usageMeta: {
              // @note conversationId and botId are assumed to be recorded by the engine
            },

            signal: stream.abortSignal,
          },
        })

        // @todo there is no need to wrap the exception as this is done in the queue
        // in the handler

        try {
          const usage = {
            token: 0,
          }

          // @note disabled because I don't think it does what it supposed to do
          // and it adds extra latency
          /*
          const {
            completion: initiateText,
            tokensUsed,
            modelUsed,
          } = await execPrompt(
            { ...initiateMessagePrompt, user: session.user.id },
            { input: text },
            {
              abortSignal: stream.abortSignal,
            }
          )

          {
            const u = new Usage()

            u.addTokens(tokensUsed, modelUsed)

            await u.recordBaseTokens({
              user: session.user,
              meta: {
                reason: 'conversation/initiate',
              },
            })

            usage.token += u.token
          }

          debug(`initiating conversation`, { initiateText })
          */

          const {
            usage: sendUsage,
            messages: sendMessages,
            entities: safeEntities,
          } = await engine.send(text, { type: 'instruction' }) // @todo perhaps use a function to record the initiation

          usage.token += sendUsage.token

          const lastSendMessage = sendMessages.slice().pop()

          await stream.push(
            createSinkEvent(
              /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ ({
                type: TAG_SEND_RESULT,
                data: {
                  id: lastSendMessage?.id || getRandomId('msg-'),
                  text: lastSendMessage?.text || '',
                  entities: safeEntities,
                  usage,
                  // @todo any activity requests must be returned to enable non-streaming responses
                },
              })
            )
          )

          const { usage: receiveUsage, messages: receiveMessages } =
            await engine.receive()

          usage.token += receiveUsage.token

          const lastReceiveMessage = receiveMessages.slice().pop()

          await stream.push(
            createSinkEvent(
              /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ (
                /** @type {unknown} */ ({
                  type: TAG_RECEIVE_RESULT,
                  data: {
                    id: lastReceiveMessage?.id || getRandomId('msg-'),
                    text: lastReceiveMessage?.text || '',
                    usage,
                    // @todo any activity requests must be returned to enable non-streaming responses
                  },
                })
              )
            )
          )

          const event = createSinkEvent(
            /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ (
              /** @type {unknown} */ ({
                type: TAG_RESULT,
                data: {
                  id: lastReceiveMessage?.id || getRandomId('msg-'),
                  text: lastReceiveMessage?.text || '',
                  usage,
                  // @todo any activity requests must be returned to enable non-streaming responses
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

          await captureException(e)

          const event = createSinkEvent({
            type: TAG_ERROR,
            data: errorToSafeErrorResponse(e),
          })

          if (isStreamingResponse) {
            await stream.push(event)
          } else {
            await stream.error(errorResponseToError(event.data))
          }

          return
        } finally {
          await engine.dispose()
        }
      })
    )
  )
)

/**
 * @manual Conversations
 *
 * ## Initiating Bot Messages
 *
 * The conversation initiate endpoint allows you to programmatically generate
 * bot responses based on provided text, enabling advanced automation scenarios
 * where the AI needs to respond to extracted information, processed data, or
 * system-generated content rather than direct user input. This functionality
 * is particularly useful for integrations where you're processing messages
 * through external systems before presenting them to the AI, or when you want
 * the bot to respond to structured data that's been formatted into natural
 * language.
 *
 * Unlike the standard send endpoint which expects user messages, the initiate
 * endpoint treats the provided text as context that should trigger a bot
 * response. This allows you to create sophisticated workflows where data from
 * various sources (forms, APIs, databases, sensors) is transformed into
 * conversational context that the bot can meaningfully respond to, maintaining
 * the natural dialogue flow while working with programmatically generated
 * content.
 *
 * The endpoint supports entity extraction, allowing you to annotate specific
 * portions of the input text with entity information that the AI can leverage
 * for more accurate and contextually appropriate responses. This is especially
 * valuable when dealing with structured data that contains important entities
 * like dates, names, locations, or custom business-specific entities that
 * should be preserved and understood by the conversational AI.
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "text": "The customer's order #12345 shipped yesterday to New York and is expected to arrive on Friday",
 *   "entities": [
 *     {
 *       "begin": 18,
 *       "end": 23
 *     },
 *     {
 *       "begin": 50,
 *       "end": 58
 *     }
 *   ]
 * }
 * ```
 *
 * The response streams back the bot's generated reply in real-time, maintaining
 * the same streaming format as other conversation endpoints. The bot will
 * process the provided text as context and generate an appropriate response
 * based on its configuration, backstory, and any connected knowledge sources
 * or tools.
 *
 * **Use Cases**:
 *
 * - Processing form submissions through AI before presenting to users
 * - Converting structured data into conversational responses
 * - Integrating with external systems that generate context for bot responses
 * - Creating automated customer service workflows with data enrichment
 * - Building intelligent notification systems with contextual AI responses
 *
 * **Important Notes**:
 *
 * - The provided text is treated as contextual information for bot response generation
 * - Entity annotations help the AI understand and preserve important information
 * - The endpoint maintains conversation context and history like standard message endpoints
 * - Responses are streamed in real-time for optimal user experience
 * - This endpoint is designed for integration scenarios, not direct user messaging
 */
