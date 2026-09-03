import debug, { createSpan } from '@/lib/debug'
import { schemaErrorToError } from '@/lib/joi.schema'
import { parseRequestJson } from '@/lib/request'
import { respondFromError } from '@/lib/response'

import type { Schema } from 'joi'

export * from '@/lib/joi.schema'
export { default } from '@/lib/joi.schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFunction = (req: Request, ...rest: any[]) => Promise<Response>

/**
 * Wraps a handler function with Joi schema validation
 */
export function withSchema(
  schema: Schema,
  fn: HandlerFunction
): HandlerFunction {
  return async function (req, ...rest) {
    const span = createSpan({ name: 'withSchema' })

    try {
      const body = await parseRequestJson(req)

      debug(`validating body`, body)

      let value

      try {
        value =
          (await schema.validateAsync(body, {
            context: { session: rest[0] },
          })) || {}
      } catch (e) {
        return respondFromError(schemaErrorToError(e))
      }

      return await fn(req, ...rest, value)
    } finally {
      span.finish()
    }
  }
}
