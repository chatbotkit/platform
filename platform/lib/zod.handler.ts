/* eslint-disable @typescript-eslint/no-explicit-any */
import debug, { createSpan } from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { parseRequestJson } from '@/lib/request'
import { respondFromError } from '@/lib/response'

import type { ZodError, ZodSchema } from 'zod'
import { z } from 'zod'

export function schemaErrorToUserInputError(error: ZodError): UserInputError {
  const message =
    error.errors
      ?.map((detail: any) => `${detail.path.join('.')}: ${detail.message}`)
      .join('; ') ||
    error.message ||
    'Invalid input'

  return new UserInputError(message)
}

export function parseUserInput<T>(schema: ZodSchema<T>, value: unknown): T {
  try {
    return schema.parse(value)
  } catch (e) {
    throw schemaErrorToUserInputError(e)
  }
}

export function withSchema<T>(
  schema: ZodSchema<T>,
  fn: (value: T, req: Request, ...rest: any[]) => Promise<Response>
): (req: Request, ...rest: any[]) => Promise<Response> {
  return async function (req: Request, ...rest: any[]): Promise<Response> {
    const span = createSpan({ name: 'withSchema' })

    try {
      const body = await parseRequestJson(req)

      debug(`validating body`, body).log('zod.handler.withSchema')

      let value: T

      try {
        value = parseUserInput(schema, body)
      } catch (e) {
        return respondFromError(e)
      }

      return await fn(value, req, ...rest)
    } finally {
      span.finish()
    }
  }
}

export const schema = z

export default schema
