import type { Exact, ExactKeys } from '@chatbotkit-dev/typescript-utils/exact'

import { captureInputError } from '@/lib/error'

import type { ZodObject, ZodRawShape, ZodSchema } from 'zod'
import { ZodError, z } from 'zod'

export { ZodError, ZodSchema, ZodObject, z } from 'zod'

export type { ZodRawShape } from 'zod'

export type ZodSchemaFor<T> = {
  [K in keyof T]-?: undefined extends T[K]
    ? z.ZodOptional<z.ZodType<Exclude<T[K], undefined>>>
    : z.ZodType<T[K]>
}

/**
 * The function wraps the standard Zod schema parsing and provides a way to
 * handle errors in a custom manner. It throws a ZodError if the parsing fails.
 *
 * @throws
 */
export function parse<T>(
  schema: ZodSchema<T>,
  data: unknown,
  onError?: ((error: ZodError, data: unknown) => void) | true
): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    if (onError === true) {
      // @note captureInputError is async but we can't await in sync function - fire and forget
      void captureInputError(result.error, data)
    } else if (typeof onError === 'function') {
      try {
        onError(result.error, data)
      } catch {
        // @note ignore error handler failures - always throw original ZodError
      }
    }

    throw result.error
  }

  return result.data
}

/**
 * Tries to parse data using the provided Zod schema. If parsing fails, it
 * returns null instead of throwing an error. An optional error handler can be
 * provided to process the error when parsing fails.
 */
export function tryParse<T>(
  schema: ZodSchema<T>,
  data: unknown,
  onError?: ((error: ZodError, data: unknown) => void) | true
): T | null {
  try {
    return parse(schema, data, onError)
  } catch {
    return null
  }
}

/**
 * Parses the data using the provided Zod schema. If parsing fails, it omits the
 * fields that caused the errors and returns a partial object with the valid
 * fields.
 *
 * @throws
 */
export function partialObjectParse<T extends ZodRawShape>(
  schema: ZodObject<T>,
  object: Record<string, unknown>
): Partial<z.infer<ZodObject<T>>> {
  try {
    return schema.parse(object)
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldWithErrors = e.errors.map((error) => error.path[0])

      const fieldsToOmit = fieldWithErrors.reduce((obj, key) => {
        obj[key] = object[key]

        return obj
      }, {})

      return schema.omit(fieldsToOmit).parse(object)
    } else {
      throw e
    }
  }
}

/**
 * The function wraps the standard Zod schema parsing and provides a way to
 * handle errors in a custom manner. It throws a ZodError if the parsing fails.
 *
 * @throws
 */
export async function parseAsync<T>(
  schema: ZodSchema<T>,
  data: unknown,
  onError?: ((error: ZodError, data: unknown) => Promise<void>) | true
): Promise<T> {
  const result = await schema.safeParseAsync(data)

  if (!result.success) {
    if (onError === true) {
      try {
        await captureInputError(result.error, data)
      } catch {
        // @note ignore error handler failures - always throw original ZodError
      }
    } else if (typeof onError === 'function') {
      try {
        await onError(result.error, data)
      } catch {
        // @note ignore error handler failures - always throw original ZodError
      }
    }

    throw result.error
  }

  return result.data
}

/**
 * Tries to parse data using the provided Zod schema. If parsing fails, it
 * returns null instead of throwing an error. An optional error handler can be
 * provided to process the error when parsing fails.
 */
export async function tryParseAsync<T>(
  schema: ZodSchema<T>,
  data: unknown,
  onError?: ((error: ZodError, data: unknown) => Promise<void>) | true
): Promise<T | null> {
  try {
    return await parseAsync(schema, data, onError)
  } catch {
    return null
  }
}

/**
 * Parses the data using the provided Zod schema. If parsing fails, it omits the
 * fields that caused the errors and returns a partial object with the valid
 * fields.
 *
 * @throws
 */
export async function partialObjectParseAsync<T extends ZodRawShape>(
  schema: ZodObject<T>,
  object: Record<string, unknown>
): Promise<Partial<z.infer<ZodObject<T>>>> {
  try {
    return await schema.parseAsync(object)
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldWithErrors = e.errors.map((error) => error.path[0])

      const fieldsToOmit = fieldWithErrors.reduce((obj, key) => {
        obj[key] = object[key]

        return obj
      }, {})

      return schema.omit(fieldsToOmit).parseAsync(object)
    } else {
      throw e
    }
  }
}

/**
 * Creates a Zod schema that is type-checked against a target type at compile time.
 * This ensures the schema's inferred output type exactly matches the expected type,
 * catching any mismatches (extra properties, missing properties, or wrong types).
 *
 * @note this function performs two checks: (1) the inferred type must be exactly
 * equal to the target type, and (2) both types must have the same set of keys -
 * this second check catches missing optional fields that would otherwise pass
 *
 * @example
 * ```ts
 * type User = { name: string; age: number }
 *
 * // This compiles - schema matches User exactly
 * const userSchema = createSchemaByType<User>()(z.object({
 *   name: z.string(),
 *   age: z.number()
 * }))
 *
 * // This fails - extra property 'email' not in User
 * const badSchema = createSchemaByType<User>()(z.object({
 *   name: z.string(),
 *   age: z.number(),
 *   email: z.string() // Error!
 * }))
 *
 * // This also fails - missing optional property 'nickname'
 * type UserWithNick = { name: string; nickname?: string }
 * const badSchema2 = createSchemaByType<UserWithNick>()(z.object({
 *   name: z.string()
 *   // Error! Missing 'nickname' even though it's optional
 * }))
 * ```
 */
export function createSchemaByType<Target>() {
  return <T extends z.ZodType>(
    schema: T &
      (Exact<z.infer<T>, Target> extends never ? never : T) &
      (ExactKeys<z.infer<T>, Target> extends never ? never : T)
  ): T => schema
}

/**
 *
 */
export default z
