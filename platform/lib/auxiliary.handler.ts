import debug from '@/lib/debug'
import { withStream } from '@/lib/stream'
import { FetchError } from '@/lib/fetch'
import { withAny } from '@/lib/method'
import { captureUnknownException } from '@/lib/response'
import type { Session } from '@/lib/session.handler'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'
import { parseUserInput } from '@/lib/zod.handler'

import { FetchError as SdkFetchError } from '@chatbotkit/fetch'

import type { ZodSchema } from 'zod'
import type z from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'

export const HANDLER_NAME_HEADER = 'x-chatbotkit-handler-name'

export function handler<T>(
  schema: ZodSchema<T>,
  fn: (parameters: T, headers: Headers) => Promise<unknown>
) {
  return withAny(
    withStream(async (request, stream) => {
      if (request.method === 'GET') {
        if (request.headers.get('accept') === 'application/schema+json') {
          await stream.result(zodToJsonSchema(schema))
        }

        await stream.result({})

        return
      }

      let parameters: z.infer<typeof schema>

      try {
        const json = await request.json()

        debug(`processing`, { json }).log('auxiliary.handler')

        parameters = parseUserInput(schema, json)
      } catch (e) {
        await stream.error(e)

        return
      }

      try {
        debug(`invoking handler`).log('auxiliary.handler')

        const response = await fn(parameters, request.headers)

        debug(`handler response`, { response }).log('auxiliary.handler')

        await stream.result(makeJsonSafe(response))
      } catch (e) {
        // @note if it is a fetch error, we assume it is an issue with the
        // upstream API, thus we don't need to capture it; the ChatBotKit SDK
        // throws its own FetchError class, distinct from @/lib/fetch's

        if (!(e instanceof FetchError) && !(e instanceof SdkFetchError)) {
          await captureUnknownException(e)
        }

        await stream.error(e)
      }
    })
  )
}

export function authenticatedHandler<T>(
  schema: ZodSchema<T>,
  fn: (session: Session, parameters: T, headers: Headers) => Promise<unknown>
) {
  return withAny(
    withSession(
      withStream(async (request, stream, session) => {
        if (request.method === 'GET') {
          if (request.headers.get('accept') === 'application/schema+json') {
            await stream.result(zodToJsonSchema(schema))
          }

          await stream.result({})

          return
        }

        let parameters: z.infer<typeof schema>

        try {
          const json = await request.json()

          debug(`processing`, { json }).log('auxiliary.authenticatedHandler')

          parameters = parseUserInput(schema, json)
        } catch (e) {
          await stream.error(e)

          return
        }

        try {
          debug(`invoking handler`).log('auxiliary.authenticatedHandler')

          const response = await fn(session, parameters, request.headers)

          debug(`handler response`, { response }).log(
            'auxiliary.authenticatedHandler'
          )

          await stream.result(makeJsonSafe(response))
        } catch (e) {
          // @note if it is a fetch error, we assume it is an issue with the
          // upstream API, thus we don't need to capture it; the ChatBotKit SDK
          // throws its own FetchError class, distinct from @/lib/fetch's

          if (!(e instanceof FetchError) && !(e instanceof SdkFetchError)) {
            await captureUnknownException(e)
          }

          await stream.error(e)
        }
      })
    )
  )
}

export function multiHandler<
  T extends Record<
    string,
    {
      schema: ZodSchema<unknown>
      fn(parameters: unknown, headers: Headers): Promise<unknown>
    }
  >,
>(handlers: T) {
  return withAny(
    withStream(async (request, stream) => {
      if (request.method === 'GET') {
        if (request.headers.get('accept') === 'application/schema+json') {
          const schemaMap: Record<string, unknown> = {}

          for (const [name, handler] of Object.entries(handlers)) {
            schemaMap[name] = zodToJsonSchema(handler.schema)
          }

          await stream.result(schemaMap)
        }

        await stream.result({})

        return
      }

      const handlerName = request.headers.get(HANDLER_NAME_HEADER)

      if (!handlerName) {
        await stream.error(
          new Error(`Missing required header: ${HANDLER_NAME_HEADER}`)
        )

        return
      }

      const handler = handlers[handlerName]

      if (!handler) {
        await stream.error(new Error(`Unknown handler: ${handlerName}`))

        return
      }

      let parameters: z.infer<typeof handler.schema>

      try {
        const json = await request.json()

        debug(`processing`, { handlerName, json }).log('auxiliary.multiHandler')

        parameters = parseUserInput(handler.schema, json)
      } catch (e) {
        await stream.error(e)

        return
      }

      try {
        debug(`invoking handler`, { handlerName }).log('auxiliary.multiHandler')

        const response = await handler.fn(parameters, request.headers)

        debug(`handler response`, { handlerName, response }).log(
          'auxiliary.multiHandler'
        )

        await stream.result(makeJsonSafe(response))
      } catch (e) {
        // @note if it is a fetch error, we assume it is an issue with the
        // upstream API, thus we don't need to capture it; the ChatBotKit SDK
        // throws its own FetchError class, distinct from @/lib/fetch's

        if (!(e instanceof FetchError) && !(e instanceof SdkFetchError)) {
          await captureUnknownException(e)
        }

        await stream.error(e)
      }
    })
  )
}

export function authenticatedMultiHandler<
  T extends Record<
    string,
    {
      schema: ZodSchema<unknown>
      fn(
        session: Session,
        parameters: unknown,
        headers: Headers
      ): Promise<unknown>
    }
  >,
>(handlers: T) {
  return withAny(
    withSession(
      withStream(async (request, stream, session) => {
        if (request.method === 'GET') {
          if (request.headers.get('accept') === 'application/schema+json') {
            const schemaMap: Record<string, unknown> = {}

            for (const [name, handler] of Object.entries(handlers)) {
              schemaMap[name] = zodToJsonSchema(handler.schema)
            }

            await stream.result(schemaMap)
          }

          await stream.result({})

          return
        }

        const handlerName = request.headers.get(HANDLER_NAME_HEADER)

        if (!handlerName) {
          await stream.error(
            new Error(`Missing required header: ${HANDLER_NAME_HEADER}`)
          )

          return
        }

        const handler = handlers[handlerName]

        if (!handler) {
          await stream.error(new Error(`Unknown handler: ${handlerName}`))

          return
        }

        let parameters: z.infer<typeof handler.schema>

        try {
          const json = await request.json()

          debug(`processing`, { handlerName, json }).log(
            'auxiliary.authenticatedMultiHandler'
          )

          parameters = parseUserInput(handler.schema, json)
        } catch (e) {
          await stream.error(e)

          return
        }

        try {
          debug(`invoking handler`, { handlerName }).log(
            'auxiliary.authenticatedMultiHandler'
          )

          const response = await handler.fn(
            session,
            parameters,
            request.headers
          )

          debug(`handler response`, { handlerName, response }).log(
            'auxiliary.authenticatedMultiHandler'
          )

          await stream.result(makeJsonSafe(response))
        } catch (e) {
          // @note if it is a fetch error, we assume it is an issue with the
          // upstream API, thus we don't need to capture it; the ChatBotKit SDK
          // throws its own FetchError class, distinct from @/lib/fetch's

          if (!(e instanceof FetchError) && !(e instanceof SdkFetchError)) {
            await captureUnknownException(e)
          }

          await stream.error(e)
        }
      })
    )
  )
}
