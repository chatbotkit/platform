// @ts-check
import '@/lib/scope.server'

import { isTrustedSession } from '@/lib/audience.helpers'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import {
  TAG_ERROR,
  TAG_RECEIVE_RESULT,
  TAG_RESULT,
  TAG_SEND_RESULT,
  createSinkEvent,
} from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { withStreamContinuity } from '@/lib/stream'
import {
  captureError,
  errorResponseToError,
  errorToSafeErrorResponse,
} from '@/lib/error'
import { anySignal } from '@/lib/fetch'
import { events } from '@/lib/it'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { getRandomId } from '@/lib/string'
import { createTimeoutMonitor } from '@/lib/timeout.monitor'

import extensionsSchema from '@/schemas/inlineExtensions'
import functionsSchema from '@/schemas/functionsSchema'

export const bodySchema = schema.object({
  text: schema.string().trim().min(1),

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

  // ---

  limits: schema.object({
    iterations: schema.number().integer().min(1),
    continuations: schema.number().integer().min(1),
    calls: schema.number().integer().min(1),
  }),

  // ----------------
  // unstable options
  // ----------------

  // debugging

  debug: schema.boolean().default(false), // @todo add custom schema to only allow debug to be used under certain audiences
})

/**
 * @param {import('@/lib/session.get').Session} session
 * @param {string} conversationId
 * @param {*} body
 * @param {{ abortSignal?: AbortSignal, markSignals?: AbortSignal[] }} [options]
 * @returns {AsyncGenerator<import('@/lib/conversation.tag').EngineSinkEvent>}
 * @todo add proper types for the body
 */
export async function* complete(session, conversationId, body, options = {}) {
  yield* events(async (push) => {
    const {
      text,

      entities,

      // ---

      functions,

      extensions,

      // ---

      limits,

      // ----------------
      // unstable options
      // ----------------

      // debugging

      debug: debugFlag,
    } = body

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
          case TAG_RESULT: {
            return event // @note there must be only one result
          }

          default: {
            push(event)

            return event
          }
        }
      }
    })()

    const isTrusted = isTrustedSession(session)

    const engine = await getStatefulConversationEngine({
      conversationId: conversationId,

      options: {
        sessionId: session.id,
        userId: session.user.id,

        entities,

        sink,

        backstoryExtra: isTrusted ? extensions?.backstory : undefined,

        features: [
          // @note record a checkpoint activity into the conversation each time
          // the handler crosses a timeout-budget mark (driven by markSignals
          // below). Lets a slow/aborted long-running completion leave a
          // breadcrumb of how far it got, visible to the model on the next turn
          { name: 'timeoutMarks' },

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
          // @note botId and conversationId are assumed to be recorded by the engine
        },

        maxIterations: limits?.iterations,
        maxContinuations: limits?.continuations,
        maxCalls: limits?.calls,

        signal: options.abortSignal,

        // @note fire-once per-mark signals from the timeout monitor; the
        // engine's `timeoutMarks` feature listens to these. NOT cancellation
        // signals

        markSignals: options.markSignals,
      },
    })

    try {
      const usage = {
        token: 0,
      }

      if (text !== undefined) {
        const {
          usage: sendUsage,

          messages: sendMessages,

          entities: safeEntities,
        } = await engine.send(text)

        usage.token += sendUsage.token

        const lastSendMessage = sendMessages.slice().pop()

        push(
          createSinkEvent({
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
      }

      const {
        usage: completeUsage,

        messages: completeMessages,

        reason: completeReason,
      } = await engine.complete()

      usage.token += completeUsage.token

      const lastCompleteMessage = completeMessages.slice().pop()

      push(
        createSinkEvent({
          type: TAG_RECEIVE_RESULT,
          data: {
            id: lastCompleteMessage?.id || getRandomId('msg-'),

            text: lastCompleteMessage?.text || '',

            usage,

            end: {
              reason: completeReason,
            },

            // @todo any activity requests must be returned to enable non-streaming responses
          },
        })
      )

      push(
        createSinkEvent({
          type: TAG_RESULT,
          data: {
            id: lastCompleteMessage?.id || getRandomId('msg-'),

            text: lastCompleteMessage?.text || '',

            usage,

            end: {
              reason: completeReason,
            },

            // @todo any activity requests must be returned to enable non-streaming responses
          },
        })
      )
    } catch (e) {
      debug(`responding with error`, { e }).log(
        'api.v1.conversation.[conversationId].complete'
      )

      await captureError(e)

      push(
        createSinkEvent({
          type: TAG_ERROR,
          data: errorToSafeErrorResponse(e),
        })
      )

      return
    } finally {
      await engine.dispose()
    }
  })
}

/**
 * @swagger
 *
 * /conversation/{conversationId}/complete:
 *   post:
 *     operationId: completeConversationMessage
 *     summary: Send and receive a conversation response
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
 *             allOf:
 *               - type: object
 *                 properties:
 *                   text:
 *                     description: The text of the message to send. Omit to continue receiving from the existing conversation state without sending a new user message.
 *                     type: string
 *                   entities:
 *                     description: Known entities
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Entity'
 *               - type: object
 *                 properties:
 *                   functions:
 *                     $ref: '#/components/schemas/FunctionsDefinition'
 *                   extensions:
 *                     $ref: '#/components/schemas/ExtensionsDefinition'
 *               - type: object
 *                 properties:
 *                   limits:
 *                     $ref: '#/components/schemas/ExecutionLimits'
 *     responses:
 *       200:
 *         description: The next message in the conversation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     id:
 *                       description: The ID of the created message
 *                       type: string
 *                   required:
 *                     - id
 *                 - type: object
 *                   properties:
 *                     text:
 *                       description: The text of the message received
 *                       type: string
 *                     usage:
 *                       $ref: '#/components/schemas/Usage'
 *                     end:
 *                       $ref: '#/components/schemas/CompleteEnd'
 *                   required:
 *                     - text
 *                     - usage
 *                     - end
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
 *                 - $ref: '#/components/schemas/CompleteStreamingResponseItem'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStreamContinuity(async function (req, stream, session, body) {
        const conversationId = requiredUrlParam(req, 'conversationId')

        const isStreamingResponse =
          stream.acceptFormat !== undefined && stream.acceptFormat !== 'json'

        // @note this endpoint runs the engine inline rather than via a queue
        // wrapper, so we set up the timeout monitor here ourselves. Its mark
        // signals drive the engine's `timeoutMarks` feature, and its hard-abort
        // signal is merged into the cancellation path to gracefully stop the
        // completion just before the platform timeout

        const monitor = createTimeoutMonitor({
          context: { conversationId, sessionId: session.id },
          label: 'Conversation completion',
        })

        try {
          const it = complete(session, conversationId, body, {
            abortSignal: anySignal([stream.abortSignal, monitor.signal]),
            markSignals: monitor.markSignals,
          })

          for await (const event of it) {
            switch (event.type) {
              case TAG_ERROR: {
                if (isStreamingResponse) {
                  await stream.push(event)
                } else {
                  await stream.error(errorResponseToError(event.data))
                }

                break
              }

              case TAG_RESULT: {
                if (isStreamingResponse) {
                  await stream.push(event)
                } else {
                  await stream.result(event.data)
                }

                break
              }

              default: {
                await stream.push(event)
              }
            }
          }
        } finally {
          monitor.dispose()
        }
      })
    )
  )
)

/**
 * @manual Conversations
 * @index 60
 *
 * ## Complete Conversation Interaction
 *
 * The complete endpoint provides a full round-trip conversation interaction,
 * sending a user message and receiving the AI's complete response through a
 * streaming connection. Unlike the send endpoint which only sends the message,
 * complete handles both sending and receiving in a single operation, making it
 * ideal for traditional request-response chat patterns.
 *
 * To complete a conversation interaction, send a POST request. The API supports
 * both streaming and non-streaming responses. For streaming, include the
 * `Accept: application/jsonl` header; otherwise, the response defaults to
 * non-streaming JSON:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/complete
 * Content-Type: application/json
 * Accept: application/jsonl
 *
 * {
 *   "text": "Can you explain how your pricing works?"
 * }
 * ```
 *
 * Replace `{conversationId}` with the actual conversation ID. The text field
 * contains the user's message when you want to send a new turn. Omit it when
 * you want to continue receiving from the existing conversation state.
 *
 * ### How Complete Works
 *
 * The complete endpoint orchestrates a conversation turn and can optionally
 * continue an existing one:
 *
 * 1. **Optional Send Phase**: Your message is added to the conversation when
 *    `text` is provided
 * 2. **Processing**: The AI analyzes the conversation with full context
 * 3. **Receive Phase**: The AI generates and streams its response
 * 4. **Result**: The response is saved to the conversation history
 *
 * When `text` is provided, this two-phase approach ensures that both the user's
 * message and the AI's response are properly recorded and contribute to the
 * ongoing conversation context. When `text` is omitted, the endpoint skips the
 * send phase and resumes from the current conversation state.
 *
 * ### Streaming Response Events
 *
 * The complete endpoint delivers a stream of events as JSONL (JSON Lines), with
 * three main event types:
 *
 * **send_result Event:**
 *
 * Emitted after the user's message is processed, when `text` is provided,
 * containing:
 * - **id**: The ID of the user's message
 * - **text**: The user's message text
 * - **entities**: Extracted entities from the user's message
 * - **usage**: Token usage for processing the user's message
 *
 * **receive_result Event:**
 *
 * Emitted after the AI's response is complete, containing:
 * - **id**: The ID of the AI's response message
 * - **text**: The AI's complete response text
 * - **usage**: Cumulative token usage for the entire interaction
 *
 * **Streaming Tokens:**
 *
 * Between send_result and receive_result, the AI's response is streamed as
 * individual tokens (word pieces), allowing you to display the response
 * incrementally as it's generated.
 *
 * ### Advanced Features
 *
 * The complete endpoint supports advanced features for enhanced functionality:
 *
 * **Function Calling:**
 *
 * Enable the AI to call functions during the interaction:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/complete
 * Content-Type: application/json
 *
 * {
 *   "text": "What's my account balance?",
 *   "functions": [
 *     {
 *       "name": "get_account_balance",
 *       "description": "Retrieve current account balance",
 *       "parameters": {
 *         "type": "object",
 *         "properties": {
 *           "account_id": {
 *             "type": "string",
 *             "description": "Account identifier"
 *           }
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * **Extensions (Trusted Sessions Only):**
 *
 * For API sessions with trusted status, you can extend conversation capabilities
 * for a single interaction:
 *
 * - **extensions.backstory**: Additional instructions for this specific
 *   interaction
 * - **extensions.datasets**: Inline dataset records to provide context
 * - **extensions.skillsets**: Temporary abilities for this message
 * - **extensions.features**: Enable specific features for this interaction
 *
 * ### When to Use Complete vs Send
 *
 * **Use Complete When:**
 * - You want a traditional request-response chat pattern
 * - You need both messages saved in a single operation
 * - You want separated send and receive events in the stream
 * - Your application requires explicit confirmation of both phases
 *
 * **Use Send When:**
 * - You only need to send a message without waiting for a response
 * - You're implementing a fire-and-forget pattern
 * - You have a different mechanism for receiving responses
 *
 * ### Error Handling
 *
 * The complete endpoint includes comprehensive error handling. If an error occurs
 * during either the send or receive phase, an error event will be included in
 * the stream with details about what went wrong. Your client should handle these
 * error events gracefully and provide appropriate feedback to users.
 *
 * ### Performance Considerations
 *
 * - The complete operation can take up to 800 seconds for long-running
 *   generations
 * - Token streaming provides immediate feedback while generation continues
 * - Both send and receive phases count toward token usage limits
 * - Rate limits apply to both message count and token usage
 *
 * **Best Practices:**
 *
 * - Implement proper JSONL streaming parsing in your client
 * - Handle all three event types (send_result, receive_result, and tokens)
 * - Display tokens incrementally for better user experience
 * - Watch for error events and handle them appropriately
 * - Store message IDs for reference and conversation management
 * - Monitor usage data to track conversation costs
 *
 * ## Execution Limits
 *
 * For agentic conversations that involve function calling or iterative
 * reasoning, you can control execution bounds using the `limits` parameter.
 * This prevents runaway conversations and helps manage resource consumption.
 *
 * The limits object accepts three optional properties:
 *
 * - **iterations**: Maximum number of agentic iterations (tool call cycles)
 * - **continuations**: Maximum number of model continuations after stop
 *   conditions
 * - **calls**: Maximum total function/tool calls allowed
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/complete
 * Content-Type: application/json
 *
 * {
 *   "text": "Research competitors and create a comparison table",
 *   "limits": {
 *     "iterations": 5,
 *     "calls": 10
 *   }
 * }
 * ```
 *
 * When a limit is reached, the response's `end.reason` will be `iteration`,
 * allowing your application to detect bounded processing.
 *
 * ## Completion End Reasons
 *
 * Every completion returns an `end` object explaining why processing finished.
 * The `end.reason` field contains one of:
 *
 * - **stop**: Normal completion - the model finished its response naturally
 * - **length**: Response truncated due to token limits
 * - **activity**: The model invoked a function or tool during processing
 * - **error**: An error occurred during processing
 * - **iteration**: Hit configured execution limits
 *
 * **Example Response:**
 *
 * ```json
 * {
 *   "id": "msg_xyz789",
 *   "text": "Based on your order history...",
 *   "usage": {
 *     "token": 850
 *   },
 *   "end": {
 *     "reason": "stop"
 *   }
 * }
 * ```
 *
 * **Best Practices:**
 *
 * - Always check `end.reason` for programmatic response handling
 * - Handle `length` truncation for long-form content generation
 * - Monitor `iteration` to tune your limits appropriately
 * - Use `stop` as the expected success case in your logic
 */

// @todo document entity annotations API
