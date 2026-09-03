// @ts-check
import prisma from '@/prisma/client'

import { setContextContact, setContextNamespace } from '@/lib/context.store'
import { TAG_ERROR, TAG_RESULT, createSinkEvent } from '@/lib/conversation.tag'
import { withStream } from '@/lib/stream'
import {
  captureError,
  errorResponseToError,
  errorToSafeErrorResponse,
} from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { getSafeNamespace } from '@/lib/namespace.safe'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { applySkillset } from '@/lib/skillset.apply'
import { Usage } from '@/lib/usage.model'

import contactIdSchema from '@/schemas/contactId'
import namespaceSchema from '@/schemas/namespace'

export const bodySchema = schema.object({
  input: schema.string().allow(null, '').default(''),

  contactId: contactIdSchema('use'),

  // ----------------
  // unstable options
  // ----------------

  debug: schema.boolean(),

  namespace: namespaceSchema,
})

/**
 * @swagger
 *
 * /skillset/{skillsetId}/ability/{abilityId}/execute:
 *   post:
 *     operationId: executeSkillsetAbility
 *     summary: Execute a skillset ability
 *     description: |
 *       Executes a specific ability from a skillset with the provided input.
 *       This endpoint processes the ability's instruction template using the
 *       given input and returns the execution result along with usage statistics.
 *       The response is streamed as JSON lines (JSONL) to support real-time
 *       progress updates during execution.
 *     tags:
 *       - Skillset Ability
 *     parameters:
 *       - in: path
 *         name: skillsetId
 *         required: true
 *         schema:
 *           description: The ID of the skillset containing the ability
 *           type: string
 *       - in: path
 *         name: abilityId
 *         required: true
 *         schema:
 *           description: The ID of the ability to execute
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 description: |
 *                   The input to process with the ability. This can be structured
 *                   text such as JSON or YAML for precise parameter control, or
 *                   unstructured natural language text. When unstructured text is
 *                   provided, the system will automatically detect and extract the
 *                   relevant parameters from the input.
 *                 type: string
 *               contactId:
 *                 description: The ID of the contact to associate with the execution
 *                 type: string
 *     responses:
 *       200:
 *         description: The ability was executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usage:
 *                   $ref: '#/components/schemas/Usage'
 *                 error:
 *                   description: Error message if execution failed
 *                   type: string
 *                 result:
 *                   description: The result of the ability execution
 *                 messages:
 *                   description: Messages generated during execution
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *               required:
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
 *                       $ref: '#/paths/~1skillset~1{skillsetId}~1ability~1{abilityId}~1execute/post/responses/200/content/application~1json/schema'
 *                   required:
 *                     - type
 *                     - data
 *                 - $ref: '#/components/schemas/CompleteStreamingResponseItem'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const isStreamingResponse =
          stream.acceptFormat !== undefined && stream.acceptFormat !== 'json'

        const {
          input,

          contactId: contact,

          // ----------------
          // unstable options
          // ----------------

          debug,

          namespace: _namespace,
        } = body

        let namespace

        if (_namespace) {
          namespace = getSafeNamespace(session.user, _namespace)
        }

        if (namespace) {
          setContextNamespace(namespace)
        }

        if (contact) {
          setContextContact(contact)
        }

        const skillset = await prisma.skillset.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'skillsetId'),
          {
            include: {
              abilities: {
                where: {
                  id: requiredUrlParam(req, 'abilityId'),
                },
              },
            },
          }
        )

        if (!skillset) {
          return throwNotFound()
        }

        if (skillset.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        const ability = skillset.abilities[0]

        if (!ability) {
          return throwNotFound()
        }

        /** @type {import('@/lib/conversation.tag').Sink} */
        const sink = new (class {
          async push(type, data) {
            const event = createSinkEvent(
              /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ ({
                type,
                data:
                  type === TAG_ERROR ? errorToSafeErrorResponse(data) : data,
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

                break
              }

              case TAG_RESULT: {
                break // @note there must be only one result
              }

              default: {
                await stream.push(event)

                break
              }
            }

            return event
          }
        })()

        try {
          // @todo will fail when testing the gmail draft create ability like this:
          // create a draft email with this attachment https://pdfobject.com/pdf/sample.pdf
          // @note it works in normal chat

          const { usage, error, result, messages } = await applySkillset(
            session.user.id,

            skillset,

            ability.name,
            input,

            {
              sink,

              debug,

              // @note we need to add some default placeholders
              // @todo investigate why and how we can avoid this or ensure that
              // we have type safety to guarantee these are always present
              // @todo make sure this is type-safe and documented

              substitutions: {
                NAMESPACE: '""',
                CONTACT_ID: '""',
                CONVERSATION_ID: '""',
                BOT_ID: '""',
                EXTERNAL_ID: '""',
              },

              signal: stream.abortSignal,
            }
          )

          await Usage.createAndRecord({
            user: session.user,
            token: usage.token,
            model: usage.model,
            meta: {
              reason: 'ability/execute',
            },
            references: {
              skillsetId: skillset.id,
              abilityId: ability.id,
            },
          })

          await stream.result({
            usage,
            error,
            result,
            messages,
          })
        } catch (e) {
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

          return
        }
      })
    )
  )
)

/**
 * @manual Skillset Abilities
 * @index 50
 *
 * ## Executing Abilities Directly
 *
 * The execute endpoint allows you to run a specific ability directly without
 * going through a full conversation flow. This is useful for testing abilities
 * during development, building custom integrations that need to invoke specific
 * capabilities, or creating automation workflows that leverage skillset abilities
 * outside of the standard chatbot context.
 *
 * When you execute an ability, the platform processes the ability's instruction
 * template using the provided input, substitutes parameters, makes any necessary
 * API calls or data retrievals defined in the instruction, and returns the
 * processed result. The response is streamed in real-time using JSON Lines (JSONL)
 * format, allowing you to receive progress updates during longer executions.
 *
 * ```http
 * POST /api/v1/skillset/{skillsetId}/ability/{abilityId}/execute
 * Content-Type: application/json
 *
 * {
 *   "input": "What is the weather in San Francisco?"
 * }
 * ```
 *
 * The response is delivered as a stream of JSON lines, with the final result
 * containing execution details:
 *
 * ```json
 * {
 *   "type": "result",
 *   "data": {
 *     "usage": {
 *       "token": 150,
 *       "model": "glm-5.2"
 *     },
 *     "result": {
 *       "temperature": "68°F",
 *       "conditions": "Partly cloudy"
 *     },
 *     "messages": [
 *       {
 *         "type": "context",
 *         "text": "Weather data retrieved successfully"
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * **Request Parameters:**
 *
 * - **input**: The text input to process with the ability. This is typically the
 *   user's request or query that the ability should handle. The ability's instruction
 *   template will use this input to extract parameters and execute actions.
 *
 * - **debug**: When set to true, enables debug mode which provides additional
 *   execution details and intermediate steps in the response. Useful for
 *   troubleshooting ability configurations.
 *
 * **Response Fields:**
 *
 * - **usage**: Token consumption and model information for the execution
 * - **result**: The processed output from the ability, format depends on the ability type
 * - **error**: Present if the ability execution encountered an error
 * - **messages**: Context messages generated during execution
 *
 * **Common Use Cases:**
 *
 * - **Development Testing**: Validate ability configurations before deploying to production bots
 * - **Direct Integration**: Call abilities from external systems without conversation context
 * - **Automation Workflows**: Trigger specific capabilities from scheduled jobs or webhooks
 * - **Debugging**: Isolate and test individual abilities when troubleshooting bot behavior
 * - **API Composition**: Chain multiple ability executions together in custom workflows
 *
 * **Streaming Response Handling:**
 *
 * The execute endpoint streams responses using JSONL format. Each line is a separate
 * JSON object with a `type` field indicating the event type:
 *
 * - **token**: Partial response tokens during generation
 * - **message**: Context messages from the execution
 * - **result**: Final execution result (always the last event)
 * - **error**: Error information if execution fails
 *
 * When building clients, parse each line as a separate JSON object and handle
 * events based on their type. The connection remains open until the result or
 * error event is received.
 *
 * **Error Handling:**
 *
 * If the ability execution fails, the response will include an error event with
 * details about what went wrong. Common error scenarios include:
 *
 * - Invalid ability configuration or missing required parameters
 * - External API failures when the ability makes HTTP requests
 * - Authentication errors if referenced secrets are invalid or expired
 * - Rate limiting if the ability makes too many external requests
 *
 * **Best Practices:**
 *
 * - Test abilities with various inputs to ensure robust parameter extraction
 * - Use debug mode during development to understand execution flow
 * - Monitor token usage to optimize ability efficiency
 * - Handle streaming responses properly in client applications
 * - Implement proper error handling for failed executions
 * - Consider using conversations for complex multi-turn interactions instead
 *
 * **Limitations:**
 *
 * - Execute operates without conversation context, so context-dependent features
 *   like message history or conversation state are not available
 * - Some substitution placeholders (CONVERSATION_ID, BOT_ID, etc.) will have
 *   empty default values since there's no active conversation
 * - Rate limits apply to ability executions and token consumption
 * - Long-running abilities may timeout; consider breaking complex operations
 *   into smaller steps
 */
