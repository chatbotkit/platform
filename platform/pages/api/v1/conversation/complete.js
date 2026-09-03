// @ts-check
import '@/lib/scope.server'

import { isTrustedSession } from '@/lib/audience.helpers'
import { setContextNamespace } from '@/lib/context.store'
import { getStatelessConversationEngine } from '@/lib/conversation.engine'
import {
  TAG_ERROR,
  TAG_MESSAGE,
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
import {
  makeNamespaceAttachmentUploadActivityMessages,
  uploadNamespaceAttachmentFromURL,
} from '@/lib/namespace.attachment'
import { getSafeNamespace } from '@/lib/namespace.safe'
import { throwBadRequest } from '@/lib/response'
import { createTimeoutMonitor } from '@/lib/timeout.monitor'
import { getMaxFileSize } from '@/lib/user.limits'

import backstorySchema from '@/schemas/backstory'
import contactIdSchema from '@/schemas/contactId'
import extensionsSchema from '@/schemas/inlineExtensions'
import functionsSchema from '@/schemas/functionsSchema'
import languageModelSchema from '@/schemas/languageModel'
import messagesSchema from '@/schemas/messages'
import namespaceSchema from '@/schemas/namespace'

export const bodySchema = schema.object({
  botId: schema.string().allow(null, ''), // @note we do not use botId schema because we perform the validation inside the engine

  backstory: backstorySchema,

  model: languageModelSchema,

  datasetId: schema.string().allow(null, ''), // @note we do not use datasetId schema because we perform the validation inside the engine
  skillsetId: schema.string().allow(null, ''), // @note we do not use skillsetId schema because we perform the validation inside the engine

  privacy: schema.boolean(),
  moderation: schema.boolean(),

  // ---

  messages: messagesSchema.min(1).required(),

  attachments: schema.array().items(
    schema.object({
      url: schema
        .string()
        .uri({
          scheme: ['http', 'https'],
        })
        .required(),
    })
  ),

  // ---

  contactId: contactIdSchema('use'),

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

  // namespace

  namespace: namespaceSchema,

  // debugging

  debug: schema.boolean().default(false), // @todo add custom schema to only allow debug to be used under certain audiences
})

/**
 * @param {import('@/lib/session.get').Session} session
 * @param {*} body
 * @param {{ abortSignal?: AbortSignal, markSignals?: AbortSignal[] }} [options]
 * @returns {AsyncGenerator<import('@/lib/conversation.tag').EngineSinkEvent>}
 * @todo add proper types for the body
 */
export async function* complete(session, body, options = {}) {
  debug('complete conversation called', { body }).log(
    'api.v1.conversation.complete'
  )

  yield* events(async (push) => {
    const {
      botId,

      backstory,

      model,

      datasetId,
      skillsetId,

      privacy,
      moderation,

      // ---

      messages: _messages,

      attachments,

      // ---

      contactId: contact,

      // ---

      functions,

      extensions,

      // ---

      limits,

      // ----------------
      // unstable options
      // ----------------

      // namespace

      namespace: _namespace,

      // debugging

      debug: debugFlag,
    } = body

    const messages = _messages.slice()

    let namespace

    {
      // @note in a perfect world we would have passed the namespace into the
      // engine as it is which already encodes it but in this case we also need
      // it for the attachment uploads before the engine is created so we
      // replicate the same logic here

      if (_namespace) {
        namespace = getSafeNamespace(session.user, _namespace)
      }

      if (namespace) {
        setContextNamespace(namespace)
      }
    }

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

    if (attachments?.length) {
      if (!namespace) {
        throwBadRequest('Attachments require a namespace')
      }

      const maxFileSize = await getMaxFileSize(session.user)

      const results = await Promise.all(
        attachments.map(async ({ url }) => {
          return await uploadNamespaceAttachmentFromURL(
            namespace,
            url,
            undefined,
            {
              maxSize: maxFileSize,
            }
          )
        })
      )

      const activities = results.flatMap((result) => {
        const { request, response } =
          makeNamespaceAttachmentUploadActivityMessages({
            id: result.attachmentId,
            name: result.name,
            type: result.type,
          })

        return [request, response]
      })

      for (const activity of activities) {
        push(
          createSinkEvent({
            type: TAG_MESSAGE,
            data: activity,
          })
        )

        messages.push(activity) // @note should we push them before the last message?
      }
    }

    const isTrusted = isTrustedSession(session)

    const engine = await getStatelessConversationEngine({
      backstory,
      model,

      privacy,
      moderation,

      botId,
      datasetId,
      skillsetId,

      messages,

      // namespace, // @note the namespace is already set in the context

      contact,

      options: {
        sessionId: session.id,
        userId: session.user.id,

        sink,

        backstoryExtra: isTrusted ? extensions?.backstory : undefined,

        features: [
          // @note record a checkpoint activity into the conversation each time
          // the handler crosses a timeout-budget mark (driven by markSignals
          // below). Lets a slow/aborted long-running completion leave a
          // breadcrumb of how far it got, visible to the model on continuation
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
          // @note botId is assumed to be recorded by the engine
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

      const {
        usage: processUsage,

        messages: sendMessages,

        entities: sendEntities,
      } = await engine.process()

      usage.token += processUsage.token

      const lastSendMessage = sendMessages.slice().pop()

      push(
        createSinkEvent({
          type: TAG_SEND_RESULT,
          data: {
            text: lastSendMessage?.text || '',
            entities: sendEntities,

            usage,

            // @todo any activity requests must be returned to enable non-streaming responses
          },
        })
      )

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
      debug(`responding with error`, { e }).log('api.v1.conversation.complete')

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
 * /conversation/complete:
 *   post:
 *     operationId: completeConversation
 *     summary: Complete the next message in a conversation
 *     tags:
 *       - Conversation
 *     parameters:
 *       - $ref: '#/components/parameters/TimezoneHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BotRefOrConfig'
 *               - type: object
 *                 properties:
 *                   messages:
 *                     description: An array of messages to be added to the conversation
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Message'
 *                   attachments:
 *                     description: An array of attachments to be added to the conversation
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         url:
 *                           description: The URL of the attachment
 *                           type: string
 *                 required:
 *                   - messages
 *               - type: object
 *                 properties:
 *                   contactId:
 *                     description: The contact ID to associate with this conversation
 *                     oneOf:
 *                       - type: string
 *                         description: An existing contact ID
 *                       - type: object
 *                         description: A contact object to create or retrieve a trusted contact
 *                         properties:
 *                           fingerprint:
 *                             description: A unique fingerprint to identify the contact
 *                             type: string
 *                           name:
 *                             description: The name of the contact
 *                             type: string
 *                           description:
 *                             description: A description of the contact
 *                             type: string
 *                           email:
 *                             description: The email address of the contact
 *                             type: string
 *                           phone:
 *                             description: The phone number of the contact
 *                             type: string
 *                           nick:
 *                             description: A nickname for the contact
 *                             type: string
 *                           meta:
 *                             description: Additional metadata for the contact
 *                             type: object
 *                             additionalProperties: true
 *                         required:
 *                           - fingerprint
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
 *                       $ref: '#/paths/~1conversation~1complete/post/responses/200/content/application~1json/schema'
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
      withStreamContinuity(async function (_req, stream, session, body) {
        const isStreamingResponse =
          stream.acceptFormat !== undefined && stream.acceptFormat !== 'json'

        // @note this endpoint runs the engine inline rather than via a queue
        // wrapper, so we set up the timeout monitor here ourselves. Its mark
        // signals drive the engine's `timeoutMarks` feature, and its hard-abort
        // signal is merged into the cancellation path to gracefully stop the
        // completion just before the platform timeout

        const monitor = createTimeoutMonitor({
          context: { sessionId: session.id },
          label: 'Conversation completion',
        })

        try {
          const it = complete(session, body, {
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
 * @manual Conversation Flow
 * @description Managing conversation workflows including stateless and stateful interaction patterns for different use cases and integration scenarios.
 * @category Objects/Conversations
 * @tags conversation, flow, stateless, stateful
 * @index 80
 *
 * ## Stateless Conversation Completion
 *
 * The stateless complete endpoint provides a powerful way to have complete
 * conversation interactions without creating or managing persistent conversation
 * records. This is ideal for one-off interactions, API integrations, or
 * scenarios where you don't need to maintain conversation history in the
 * platform.
 *
 * Unlike the conversation-based complete endpoint, the stateless complete
 * endpoint allows you to provide the entire conversation context in a single
 * request, including all previous messages. This gives you complete control over
 * conversation state and history management.
 *
 * To use stateless conversation completion:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "botId": "bot_abc123",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "What is your return policy?"
 *     }
 *   ]
 * }
 * ```
 *
 * The messages array must contain at least one message and represents the full
 * conversation history that the AI will use as context.
 *
 * ### Configuration Options
 *
 * The stateless complete endpoint supports extensive configuration:
 *
 * **Bot Configuration:**
 * - **botId**: ID of an existing bot to use (optional if providing backstory)
 * - **backstory**: Custom instructions for the AI (optional if using botId)
 * - **model**: Specific AI model to use (overrides bot default)
 * - **datasetId**: Dataset to provide as knowledge base
 * - **skillsetId**: Skillset to provide abilities
 * - **privacy**: Enable privacy mode for PII handling
 * - **moderation**: Enable content moderation
 *
 * **Message History:**
 * - **messages**: Array of message objects with type and text (required)
 *   - Each message must specify type (user, bot, context, activity)
 *   - Each message must include text content
 *   - Messages are processed in order to build conversation context
 *
 * **Attachments:**
 * - **attachments**: Array of attachment URLs to include in the conversation
 *   - Each attachment must specify a url field
 *   - Attachments are processed and included as context
 *
 * **Contact Association:**
 * - **contactId**: Associate the interaction with a specific contact
 *   - Can be an existing contact ID string
 *   - Can be a contact object with fingerprint for trusted contact creation
 *
 * ### Advanced Stateless Features
 *
 * **Function Calling:**
 *
 * Function calling enables the AI to invoke external functions during a
 * conversation, allowing it to access real-time data, perform computations, or
 * interact with external systems. The platform supports two primary patterns for
 * providing function results: static data for predetermined responses, and
 * channels for dynamic, real-time function execution.
 *
 * **Basic Function Definition:**
 *
 * Define functions using the standard JSON Schema format:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "backstory": "You are a helpful assistant with access to weather data",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "What's the weather in Tokyo?"
 *     }
 *   ],
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
 * When the AI determines that a function call is necessary, it will return a
 * message indicating the function to call and its arguments.
 *
 * **Function Results: Static Data Pattern:**
 *
 * For functions with predetermined or mock data, you can provide static results
 * directly in the function definition. This is ideal for testing, development, or
 * scenarios where function outputs are predictable:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "backstory": "You are a store assistant",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "What's the status of order #12345?"
 *     }
 *   ],
 *   "functions": [
 *     {
 *       "name": "get_order_status",
 *       "description": "Retrieve order status information",
 *       "parameters": {
 *         "type": "object",
 *         "properties": {
 *           "orderId": {
 *             "type": "string",
 *             "description": "The order ID to look up"
 *           }
 *         },
 *         "required": ["orderId"]
 *       },
 *       "result": {
 *         "data": {
 *           "status": "shipped",
 *           "tracking": "1Z999AA10123456784",
 *           "estimatedDelivery": "2025-11-25"
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * With static results, the AI will automatically receive the predefined data when
 * it calls the function, without requiring any external interaction. The
 * conversation continues seamlessly with the function result incorporated into the
 * AI's response.
 *
 * **Function Results: Channel-Based Pattern:**
 *
 * For dynamic function execution where results depend on real-time data or
 * external systems, use the channel-based pattern. This approach enables true
 * remote function calling where your application executes the function and
 * publishes the result back to the AI:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "backstory": "You are a helpful assistant with access to weather data",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "What's the weather in Tokyo?"
 *     }
 *   ],
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
 *       },
 *       "result": {
 *         "channel": "weather-channel-abc123xyz456"
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * **Channel-Based Function Calling Workflow:**
 *
 * 1. **Define Function with Channel**: Include a `result.channel` property in
 *    your function definition. The channel ID must be at least 16 characters long
 *    for security.
 *
 * 2. **AI Invokes Function**: When the AI determines the function should be
 *    called, the streaming response will include a function call message with:
 *    - The function name (`get_weather`)
 *    - The function arguments (`{ "location": "Tokyo" }`)
 *    - The channel name for publishing results
 *
 * 3. **Execute Function Locally**: Your application receives the function call,
 *    executes the actual function with the provided arguments, and obtains the
 *    result.
 *
 * 4. **Publish Result to Channel**: Send the function result back to the AI by
 *    publishing to the channel:
 *
 * ```http
 * POST /api/v1/channel/weather-channel-abc123xyz456/publish
 * Content-Type: application/json
 *
 * {
 *   "message": {"temperature": 18, "conditions": "partly cloudy", "humidity": 65}
 * }
 * ```
 *
 * 5. **AI Processes Result**: The platform delivers the result to the AI in
 *    real-time, and the AI incorporates it into its response to the user.
 *
 * **Complete Channel-Based Example:**
 *
 * Here's a full example showing the request-response flow:
 *
 * ```javascript
 * // Step 1: Initial request with channel-based function
 * const response = await fetch('/api/v1/conversation/complete', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     backstory: "You help users with weather information",
 *     messages: [{
 *       type: "user",
 *       text: "What's the weather like in London?"
 *     }],
 *     functions: [{
 *       name: "get_weather",
 *       description: "Retrieve current weather data",
 *       parameters: {
 *         type: "object",
 *         properties: {
 *           location: { type: "string" }
 *         }
 *       },
 *       result: {
 *         channel: "my-weather-channel-abc123"
 *       }
 *     }]
 *   })
 * });
 *
 * // Step 2: Process streaming response
 * const reader = response.body.getReader();
 * const decoder = new TextDecoder();
 *
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *
 *   const chunk = decoder.decode(value);
 *   const lines = chunk.split('\n').filter(line => line.trim());
 *
 *   for (const line of lines) {
 *     const event = JSON.parse(line);
 *
 *     // Step 3: Detect function call
 *     if (event.type === 'message' &&
 *         event.data.type === 'activity' &&
 *         event.data.function) {
 *       const { function: fnName, args, channel } = event.data;
 *
 *       // Step 4: Execute function locally
 *       const weatherData = await fetchWeatherAPI(args.location);
 *
 *       // Step 5: Publish result to channel
 *       await fetch(`/api/v1/channel/${channel}/publish`, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           message: weatherData
 *         })
 *       });
 *     }
 *   }
 * }
 * ```
 *
 * **Important Channel Considerations:**
 *
 * - **Channel ID Length**: Channel IDs must be at least 16 characters for
 *   security and collision avoidance. Use cryptographically random strings.
 *
 * - **Channel Uniqueness**: Each channel ID should be unique to the conversation
 *   session. Don't reuse channel IDs across different interactions.
 *
 * - **Real-Time Delivery**: Messages are delivered in real-time to active
 *   subscribers. The AI must be actively waiting for the result when you publish.
 *
 * - **No Message Persistence**: Channels don't maintain message history. Results
 *   published before the AI is listening or after it has moved on will be lost.
 *
 * - **Result Format**: The `message` field in channel publish requests accepts a
 *   string. For structured data (like function results), serialize to JSON.
 *
 * - **Timeout Handling**: Implement timeout logic in your application. If a
 *   function takes too long, the conversation may timeout (800-second maximum).
 *
 * **Choosing Between Static and Channel-Based Results:**
 *
 * **Use Static Results When:**
 * - Testing function calling implementations
 * - Working with mock or sample data during development
 * - Function outputs are predetermined and don't change
 * - You want immediate responses without external function execution
 * - Building demos or prototypes
 *
 * **Use Channel-Based Results When:**
 * - Function results depend on real-time external data (APIs, databases)
 * - Function execution requires external system interaction
 * - Results vary based on input parameters
 * - You need to perform actual computations or business logic
 * - Building production systems with dynamic data
 *
 * **Multiple Functions:**
 *
 * You can define multiple functions in a single request, mixing static and
 * channel-based results:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "backstory": "You are a helpful assistant",
 *   "messages": [{ "type": "user", "text": "Help me plan my day" }],
 *   "functions": [
 *     {
 *       "name": "get_weather",
 *       "description": "Get current weather",
 *       "parameters": { ... },
 *       "result": {
 *         "channel": "weather-channel-abc123"
 *       }
 *     },
 *     {
 *       "name": "get_calendar",
 *       "description": "Get calendar events",
 *       "parameters": { ... },
 *       "result": {
 *         "channel": "calendar-channel-def456"
 *       }
 *     },
 *     {
 *       "name": "get_time",
 *       "description": "Get current time",
 *       "parameters": { ... },
 *       "result": {
 *         "data": {
 *           "currentTime": "2025-11-20T10:30:00Z",
 *           "timezone": "UTC"
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * The AI will intelligently choose which function(s) to call based on the user's
 * query and will handle the results appropriately whether they're static or
 * channel-based.
 *
 * **Extensions (Trusted Sessions Only):**
 *
 * For trusted API sessions, you can provide inline extensions:
 *
 * - **extensions.backstory**: Additional instructions for this specific
 *   interaction
 * - **extensions.datasets**: Inline dataset records as arrays of text and
 *   metadata
 * - **extensions.skillsets**: Inline skillset definitions with abilities
 * - **extensions.features**: Enable specific features for this interaction
 *
 * ### Multi-Turn Conversations
 *
 * The stateless endpoint excels at multi-turn conversations where you manage
 * state externally:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "botId": "bot_abc123",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "I need help with my order"
 *     },
 *     {
 *       "type": "bot",
 *       "text": "I'd be happy to help! What's your order number?"
 *     },
 *     {
 *       "type": "user",
 *       "text": "It's #12345"
 *     }
 *   ]
 * }
 * ```
 *
 * In this example, you're providing the previous exchange as context, and the AI
 * will generate a response considering the full conversation history. You would
 * store this history in your own application and add the AI's response to it for
 * the next turn.
 *
 * ### Response Structure
 *
 * The stateless complete endpoint returns streaming events similar to the
 * stateful complete endpoint:
 *
 * - **send_result**: Confirmation of the user's message processing
 * - **Streaming tokens**: The AI's response delivered incrementally
 * - **receive_result**: The complete AI response with usage statistics
 * - **result**: Final result with complete response and metadata
 *
 * ### When to Use Stateless vs Stateful
 *
 * **Use Stateless Complete When:**
 * - You want complete control over conversation state and history
 * - You're integrating with existing systems that maintain their own conversation
 *   storage
 * - You need temporary or one-off AI interactions without persistence
 * - You want to avoid managing conversation IDs and lifecycle
 * - You have specific requirements for how conversation data is stored
 * - You're building a custom conversation UI with your own state management
 *
 * **Use Stateful Complete When:**
 * - You want the platform to manage conversation history automatically
 * - You need conversation persistence for later retrieval or analysis
 * - You're building a traditional chat interface
 * - You want to leverage platform features like conversation search and analytics
 * - You need conversation metadata and timestamps managed automatically
 *
 * ### Performance and Resource Considerations
 *
 * The stateless complete endpoint:
 *
 * - Can handle conversations of any length (limited by message array size and
 *   token limits)
 * - Processes all messages to build context each time (no cached state)
 * - Uses streaming for real-time response delivery
 * - Has the same 800-second maximum duration as stateful endpoints
 * - Counts tokens and messages toward your usage limits
 *
 * ### Integration Patterns
 *
 * **Pattern 1: External State Management**
 *
 * Store conversation history in your application's database and include it in
 * each request. This works well for applications that already have sophisticated
 * state management.
 *
 * **Pattern 2: Temporary Interactions**
 *
 * Use stateless complete for one-time interactions where you don't need to
 * maintain history, such as form validation, content generation, or quick
 * queries.
 *
 * **Pattern 3: Hybrid Approach**
 *
 * Use stateless complete for testing and development, then transition to
 * stateful conversations in production for better performance and built-in
 * history management.
 *
 * **Best Practices:**
 *
 * - Keep message arrays manageable - very long conversations should be
 *   summarized or truncated
 * - Include only the most recent and relevant messages for context
 * - Use contact association to track interactions across multiple stateless
 *   requests
 * - Implement proper error handling for streaming responses
 * - Monitor token usage as stateless calls can be more token-intensive than
 *   stateful
 * - Consider rate limits when making frequent stateless requests
 * - Cache bot configuration (botId, backstory, etc.) to avoid redundant
 *   specifications
 *
 * **Important Notes:**
 *
 * - Stateless complete requests do not create conversation records in the
 *   platform
 * - All context must be provided in each request's messages array
 * - The AI has no memory between stateless requests unless you provide previous
 *   messages
 * - Attachments are processed for each request and count toward usage limits
 * - Contact tracking can link multiple stateless interactions to the same user
 *
 * ## Execution Limits
 *
 * When working with agentic conversations that involve function calling, tool
 * usage, or iterative reasoning, you can control the execution bounds using the
 * `limits` parameter. This allows you to prevent runaway conversations and
 * manage resource consumption.
 *
 * The limits object accepts three optional properties:
 *
 * - **iterations**: Maximum number of agentic iterations. Controls how many
 *   times the model can iterate through tool calls and responses. Each iteration
 *   represents a complete cycle of the model calling a tool and processing its
 *   result.
 *
 * - **continuations**: Maximum number of model continuations. Controls how many
 *   times the model can continue generating after reaching a stop condition.
 *   This is useful for limiting extended responses or chain-of-thought
 *   reasoning.
 *
 * - **calls**: Maximum number of function/tool calls. Controls how many total
 *   function calls can be made during the conversation, regardless of which
 *   iteration they occur in.
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "botId": "bot_abc123",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "Research the top 3 competitors and summarize their features"
 *     }
 *   ],
 *   "limits": {
 *     "iterations": 5,
 *     "calls": 10
 *   }
 * }
 * ```
 *
 * When a limit is reached, the conversation will stop and return a result with
 * an `end.reason` of `iteration`. This allows your application to detect
 * when processing was bounded and handle it appropriately.
 *
 * **Default Behavior:**
 *
 * If no limits are specified, the system uses sensible defaults that balance
 * capability with resource protection. For most use cases, the defaults are
 * sufficient, but complex agentic workflows may benefit from explicit limits.
 *
 * **Use Cases for Limits:**
 *
 * - Preventing infinite loops in recursive tool usage
 * - Controlling costs for complex multi-step operations
 * - Ensuring predictable response times for user-facing applications
 * - Limiting resource usage for untrusted or experimental conversations
 *
 * ## Completion End Reasons
 *
 * Every conversation completion returns an `end` object that explains why the
 * completion finished. Understanding these reasons helps you build robust
 * applications that handle different completion scenarios appropriately.
 *
 * The `end.reason` field contains one of the following values:
 *
 * - **stop**: The model finished generating naturally, reaching a logical
 *   conclusion to its response. This is the most common and expected outcome
 *   for successful completions.
 *
 * - **length**: The response was truncated because it reached the maximum token
 *   limit. The response may be incomplete, and you might need to continue the
 *   conversation or increase token limits.
 *
 * - **activity**: The model invoked a function or tool during processing. When
 *   using static results, this is handled automatically. With channel-based
 *   integrations, your application must provide the result.
 *
 * - **error**: An error occurred during completion. Check the response for
 *   error details and handle accordingly.
 *
 * - **iteration**: The conversation reached one of the configured limits
 *   (iterations, continuations, or calls). The response contains whatever was
 *   generated before hitting the limit.
 *
 * **Example Response with End Reason:**
 *
 * ```json
 * {
 *   "text": "Based on my research, here are the top features...",
 *   "usage": {
 *     "token": 1250
 *   },
 *   "end": {
 *     "reason": "stop"
 *   }
 * }
 * ```
 *
 * **Handling Different Reasons:**
 *
 * ```javascript
 * const result = await client.conversation.complete({
 *   botId: "bot_abc123",
 *   messages: [{ type: "user", text: "Help me with my order" }]
 * });
 *
 * switch (result.end.reason) {
 *   case "stop":
 *     // Normal completion, display the response
 *     displayMessage(result.text);
 *     break;
 *
 *   case "length":
 *     // Response was truncated, might want to continue
 *     displayMessage(result.text);
 *     showWarning("Response was truncated due to length");
 *     break;
 *
 *   case "iteration":
 *     // Hit execution limits, show partial result
 *     displayMessage(result.text);
 *     showWarning("Processing was limited to prevent excessive usage");
 *     break;
 *
 *   case "error":
 *     // Something went wrong
 *     showError("An error occurred during processing");
 *     break;
 * }
 * ```
 *
 * **Best Practices:**
 *
 * - Always check `end.reason` when processing responses programmatically
 * - Handle `length` truncation gracefully, especially for long-form content
 * - Monitor `iteration` occurrences to tune your limits appropriately
 * - Log `error` reasons for debugging and monitoring
 * - Use `stop` as the expected success case in your application logic
 */
