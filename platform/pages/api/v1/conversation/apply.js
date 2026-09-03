// @ts-check
import '@/lib/scope.server'

import { isTrustedSession } from '@/lib/audience.helpers'
import { setContextNamespace } from '@/lib/context.store'
import { getStatelessConversationEngine } from '@/lib/conversation.engine'
import {
  TAG_ERROR,
  TAG_MESSAGE,
  TAG_RESULT,
  createSinkEvent,
} from '@/lib/conversation.tag'
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
import {
  makeNamespaceAttachmentUploadActivityMessages,
  uploadNamespaceAttachmentFromURL,
} from '@/lib/namespace.attachment'
import { getSafeNamespace } from '@/lib/namespace.safe'
import { throwBadRequest } from '@/lib/response'
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

  name: schema.string().min(1).required(),
  input: schema.object({}).unknown(true).required(),

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
 * @param {{ abortSignal?: AbortSignal }} [options]
 * @returns {AsyncGenerator<import('@/lib/conversation.tag').EngineSinkEvent>}
 * @todo add proper types for the body
 */
export async function* apply(session, body, options = {}) {
  debug('apply conversation called', { body }).log('api.v1.conversation.apply')

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

      name,
      input,

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
      },
    })

    try {
      const usage = {
        token: 0,
      }

      const {
        result,

        usage: applyUsage,

        messages: applyMessages,
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

            messages: applyMessages,
          },
        })
      )
    } catch (e) {
      debug(`responding with error`, { e }).log('api.v1.conversation.apply')

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
      withStreamContinuity(async function (_req, stream, session, body) {
        const isStreamingResponse =
          stream.acceptFormat !== undefined && stream.acceptFormat !== 'json'

        const it = apply(session, body, { abortSignal: stream.abortSignal })

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

// @note this is a private/non-public API route
