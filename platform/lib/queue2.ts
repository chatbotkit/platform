import debug from '@/lib/debug'
import { withStreamContinuity } from '@/lib/stream'
import { captureError, captureException, errorToSystemError } from '@/lib/error'
import { requiredUrlParam } from '@/lib/query.get'
import { withQueue } from '@/lib/queue'
import { parseRequestJson } from '@/lib/request'
import { captureUnknownException, throwBadRequest } from '@/lib/response'
import { createTimeoutMonitor } from '@/lib/timeout.monitor'
import { z } from '@/lib/zod.schema'

const eventSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown()),
})

/**
 * Joi-style async validation schema.
 */
interface JoiAsyncSchema {
  validateAsync: (
    payload: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
}

/**
 * Joi-style sync validation schema result.
 */
interface JoiValidationResult {
  error?: Error | null
  value: Record<string, unknown>
}

/**
 * Joi-style sync validation schema.
 */
interface JoiSyncSchema {
  validate: (payload: Record<string, unknown>) => JoiValidationResult
}

/**
 * Zod-style async validation schema.
 */
interface ZodAsyncSchema {
  parseAsync: (
    payload: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
}

/**
 * Zod-style sync validation schema.
 */
interface ZodSyncSchema {
  parse: (payload: Record<string, unknown>) => Record<string, unknown>
}

/**
 * Union of all supported validation schema types.
 */
type Schema = JoiAsyncSchema | JoiSyncSchema | ZodAsyncSchema | ZodSyncSchema

/**
 * Validates data against a schema that can be Joi, Zod, or similar validation library.
 *
 * @throws Will throw if validation fails
 */
export async function validateSchema(
  schema: Schema,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  debug('validating schema', { schema, data }).log('lib.queue2.validateSchema')

  if ('validateAsync' in schema) {
    try {
      return await schema.validateAsync(data)
    } catch (error) {
      await captureException(error)

      const _error = errorToSystemError(error)

      throwBadRequest(_error.message)
    }
  }

  if ('validate' in schema) {
    const result = schema.validate(data)

    if (result.error) {
      await captureError(result.error)

      const _error = errorToSystemError(result.error)

      throwBadRequest(_error.message)
    }

    return result.value
  }

  if ('parseAsync' in schema) {
    try {
      return await schema.parseAsync(data)
    } catch (error) {
      await captureException(error)

      const _error = errorToSystemError(error)

      throwBadRequest(_error.message)
    }
  }

  if ('parse' in schema) {
    try {
      return schema.parse(data)
    } catch (error) {
      await captureException(error)

      const _error = errorToSystemError(error)

      throwBadRequest(_error.message)
    }
  }

  // @note This should be unreachable if Schema type is correctly narrowed, but
  // TypeScript doesn't know that, so we throw here as a safeguard

  const error = new Error('Invalid schema config')

  await captureException(error)

  throwBadRequest(error.message)
}

/**
 * Context object passed to queue handlers.
 */
export interface HandlerContext {
  /** Signal that aborts at the hard timeout (the end of the clock). */
  signal: AbortSignal
  /**
   * One fire-once signal per {@link QUEUE_TIMEOUT_MARKS}, each aborting when the
   * request crosses that mark on the way to {@link HandlerContext.signal} - well
   * before the hard abort. Each signal's `reason` is a
   * {@link import('@/lib/timeout.monitor').QueueTimeoutMark}.
   *
   * These reuse `AbortSignal` as an event primitive only; they are the request
   * *clock* (wall-clock, advances even if the handler is stuck), NOT cancellation
   * signals. Never fold them into the cancellation path (e.g. `anySignal`).
   */
  markSignals: AbortSignal[]
}

/**
 * Configuration for a queue handler.
 */
export interface HandlerConfig {
  /** The handler function to process the payload */
  handler: (
    payload: Record<string, unknown>,
    context: HandlerContext
  ) => Promise<void>
  /** Optional schema to validate the payload before processing */
  schema?: Schema
}

/**
 * Map of event types to their handler configurations.
 */
export type HandlerDefinitions = {
  [key: string]: HandlerConfig
}

/**
 * Creates a queue handler that processes typed payloads with optional schema validation.
 */
export function withQueueHandler(handlers: HandlerDefinitions) {
  return withQueue(
    withStreamContinuity(async function (req, stream) {
      const data = await parseRequestJson(req)

      const { type, payload } = eventSchema.parse(data)

      debug(`received payload`, { type, payload }).log(
        'lib.queue2.withQueueHandler'
      )

      const monitor = createTimeoutMonitor({
        context: { type },
      })

      try {
        const config = handlers[type]

        if (!config) {
          throwBadRequest(`Unrecognized type ${type}`)
        }

        const { handler, schema } = config

        let validatedPayload = payload

        if (schema) {
          validatedPayload = await validateSchema(schema, payload)
        }

        await handler(validatedPayload, {
          signal: monitor.signal,
          markSignals: monitor.markSignals,
        })
      } catch (e) {
        await captureUnknownException(e)

        await stream.error(e instanceof Error ? e : new Error(String(e)))
      } finally {
        monitor.dispose()
      }
    })
  )
}

/**
 * Configuration for a bounded queue handler with URL parameter.
 */
export interface BoundedHandlerConfig {
  /** The handler function to process the payload with a bound parameter */
  handler: (
    param: string,
    payload: Record<string, unknown>,
    context: HandlerContext
  ) => Promise<void>
  /** Optional schema to validate the payload before processing */
  schema?: Schema
}

/**
 * Map of event types to their bounded handler configurations.
 */
export type BoundedHandlerDefinitions = {
  [key: string]: BoundedHandlerConfig
}

/**
 * Creates a queue handler with URL parameter binding.
 */
export function withQueueHandlerBounded(
  paramName: string,
  handlers: BoundedHandlerDefinitions
) {
  return withQueue(
    withStreamContinuity(async function (req, stream) {
      const param = requiredUrlParam(req, paramName)

      const data = await parseRequestJson(req)

      const { type, payload } = eventSchema.parse(data)

      debug(`received request`, {
        [paramName]: param,
        body: {
          type,
          payload,
        },
      }).log('lib.queue2.withQueueHandlerBounded')

      const monitor = createTimeoutMonitor({
        context: { type, [paramName]: param },
      })

      try {
        const config = handlers[type]

        if (!config) {
          throwBadRequest(`Unrecognized type ${type}`)
        }

        const { handler, schema } = config

        let validatedPayload = payload

        if (schema) {
          validatedPayload = await validateSchema(schema, payload)
        }

        await handler(param, validatedPayload, {
          signal: monitor.signal,
          markSignals: monitor.markSignals,
        })
      } catch (e) {
        await captureUnknownException(e)

        await stream.error(e instanceof Error ? e : new Error(String(e)))
      } finally {
        monitor.dispose()
      }
    })
  )
}
