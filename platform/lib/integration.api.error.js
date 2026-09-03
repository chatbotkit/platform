// @ts-check
import { logEvent } from '@/lib/log'
import { OMIT_UNDEFINED, omit } from '@/lib/object'

/**
 * @param {unknown} error
 * @returns {{ name?: string, message: string, code?: string, data?: unknown }}
 */
export function getIntegrationApiErrorMeta(error) {
  if (error instanceof Error) {
    const code = /** @type {{ code?: unknown }} */ (error).code
    const data = /** @type {{ data?: unknown }} */ (error).data

    return omit(
      {
        name: error.name,
        message: error.message,
        code: typeof code === 'string' ? code : undefined,
        data,
      },
      [OMIT_UNDEFINED]
    )
  }

  return {
    message: String(error),
  }
}

/**
 * @param {{
 *   userId: string,
 *   type: import('@/lib/event').EventConfigEventType,
 *   name: string,
 *   description: string,
 *   relations: Record<string, unknown>,
 *   operation: string,
 *   error: unknown,
 *   meta?: Record<string, unknown>,
 * }} options
 * @returns {Promise<void>}
 */
export async function logIntegrationApiError({
  userId,
  type,
  name,
  description,
  relations,
  operation,
  error,
  meta,
}) {
  await logEvent({
    user: { id: userId },
    name,
    description,
    type,
    relations: omit(relations, [OMIT_UNDEFINED]),
    meta: omit(
      {
        operation,
        error: getIntegrationApiErrorMeta(error),
        ...meta,
      },
      [OMIT_UNDEFINED]
    ),
  })
}
