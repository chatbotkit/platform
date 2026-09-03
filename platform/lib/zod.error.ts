import type { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error/v3'

export { ZodError } from 'zod'

export function getFriendlyErrorMessage<T>(error: ZodError<T>): string {
  return fromZodError(error, { prefix: null }).message
}
