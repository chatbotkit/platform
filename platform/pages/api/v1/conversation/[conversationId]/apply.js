// @ts-check
import '@/lib/scope.server'

import { isTrustedSession } from '@/lib/audience.helpers'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { TAG_ERROR, TAG_RESULT, createSinkEvent } from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { withStreamContinuity } from '@/lib/stream'
import {
  captureError,
  errorResponseToError,
  errorToSafeErrorResponse,
} from '@/lib/error'
import { events } from '@/lib/it'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'

import extensionsSchema from '@/schemas/inlineExtensions'
import functionsSchema from '@/schemas/functionsSchema'

export const bodySchema = schema.object({
  name: schema.string().min(1).required(),
  input: schema.object({}).unknown(true).required(),

  // ---

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
 * @param {{ abortSignal?: AbortSignal }} [options]
 * @returns {AsyncGenerator<import('@/lib/conversation.tag').EngineSinkEvent>}
 * @todo add proper types for the body
 */
export async function* apply(session, conversationId, body, options = {}) {
  yield* events(async (push) => {
    const {
      name,
      input,

      // ---

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
      },
    })

    try {
      const usage = {
        token: 0,
      }

      const {
        result,

        usage: applyUsage,

        messages: resultMessages,

        meta,
      } = await engine.apply({
        name,
        input,
        signal: options.abortSignal,
      })

      usage.token += applyUsage.token

      push(
        createSinkEvent({
          type: TAG_RESULT,
          data: {
            result,

            usage,

            messages: resultMessages,

            meta,
          },
        })
      )
    } catch (e) {
      debug(`responding with error`, { e }).log(
        'api.v1.conversation.[conversationId].apply'
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

export default withPost(
  withSessionLimits(
    ['rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStreamContinuity(async function (req, stream, session, body) {
        const conversationId = requiredUrlParam(req, 'conversationId')

        const isStreamingResponse =
          stream.acceptFormat !== undefined && stream.acceptFormat !== 'json'

        const it = apply(session, conversationId, body, {
          abortSignal: stream.abortSignal,
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
      })
    )
  )
)
