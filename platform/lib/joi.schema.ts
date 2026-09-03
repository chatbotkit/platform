import { SystemError } from '@/lib/error'
import { BAD_REQUEST_CODE } from '@/lib/response'
import { byteLength } from '@/lib/string'
import { getFriendlyErrorMessage } from '@/lib/zod.error'

import joi from 'joi'
import libphonenumberJs from 'libphonenumber-js'
import type { z } from 'zod'

interface JoiErrorDetail {
  message?: string
  context?: {
    message?: string
  }
}

interface JoiError {
  message: string
  details?: JoiErrorDetail[]
}

interface JoiHelpers {
  error: (code: string, context?: Record<string, unknown>) => unknown
}

/**
 * Converts a Joi validation error to a SystemError
 */
export function schemaErrorToError(error: JoiError): SystemError {
  let message: string

  if (Array.isArray(error.details) && error.details.length) {
    message = error.details
      .map((detail) => detail.message || detail.context?.message)
      .join('; ')
  } else {
    message = error.message
  }

  return new SystemError(message, BAD_REQUEST_CODE)
}

/**
 * Validates that a string value doesn't exceed a maximum byte length
 */
export function validateByteLength(
  value: string,
  maxByteLength: number,
  helpers: JoiHelpers
): string | unknown {
  if (byteLength(value) > maxByteLength) {
    return helpers.error('string.maxByteLength', { limit: maxByteLength })
  }

  return value
}

/**
 * Validates a value against a Zod schema within a Joi validation context
 */
export function validateZodSchema(
  value: unknown,
  zodSchema: z.ZodSchema,
  helpers: JoiHelpers
): unknown {
  const result = zodSchema.safeParse(value)

  if (!result.success) {
    return helpers.error('any.invalid', {
      message: getFriendlyErrorMessage(result.error),
    })
  }

  return value
}

const schema = joi
  .extend((joi) => ({
    type: 'string',
    base: joi.string(),
    messages: {
      'string.maxByteLength':
        '{{#label}} must be less than or equal to {{#limit}} bytes long',
      'string.phone': '{{#label}} must be a phone number',
    },
    rules: {
      maxByteLength: {
        method(maxByteLength: number) {
          return this.$_addRule({
            name: 'maxByteLength',
            args: { maxByteLength },
          })
        },
        args: [
          {
            name: 'maxByteLength',
            assert: joi.number().integer().min(0).required(),
            message: 'must be a positive integer',
          },
        ],
        validate(
          value: string,
          helpers: JoiHelpers,
          args: { maxByteLength: number }
        ) {
          return validateByteLength(value, args.maxByteLength, helpers)
        },
      },

      phone: {
        method() {
          return this.$_addRule({
            name: 'phone',
            args: {},
          })
        },
        args: [],
        validate(value: string, helpers: JoiHelpers) {
          if (!value) {
            return value
          }

          const phoneNumber = libphonenumberJs(value, { defaultCountry: 'US' })

          if (!phoneNumber) {
            return helpers.error('string.phone')
          }

          if (!phoneNumber.isValid()) {
            return helpers.error('string.phone')
          }

          value = phoneNumber.number.toString()

          return value
        },
      },
    },
  }))
  .extend((joi) => ({
    type: 'object',
    base: joi.object(),
    messages: {
      'any.invalid': '{{#label}} contains an invalid value: {{#message}}',
    },
    rules: {
      zodSchema: {
        method(zodSchema: z.ZodSchema) {
          return this.$_addRule({
            name: 'zodSchema',
            args: { zodSchema },
          })
        },
        args: [
          {
            name: 'zodSchema',
            assert: (value: unknown) =>
              typeof value === 'object' &&
              value !== null &&
              'safeParse' in value &&
              typeof value.safeParse === 'function',
            message: 'must be a Zod schema',
          },
        ],
        validate(
          value: unknown,
          helpers: JoiHelpers,
          args: { zodSchema: z.ZodSchema }
        ) {
          return validateZodSchema(value, args.zodSchema, helpers)
        },
      },
    },
  }))
  .extend((joi) => ({
    type: /^(?:number|string|date|any)$/,
    messages: {
      'custom.flexibleTimestamp':
        '{{#label}} must be a valid timestamp (number, ISO date string, or parsable date)',
    },
    rules: {
      flexibleTimestamp: {
        method() {
          return this.$_addRule({
            name: 'flexibleTimestamp',
            args: {},
          })
        },
        args: [],
        validate(value: unknown, helpers: JoiHelpers) {
          if (value === undefined || value === null) {
            return value
          }

          if (typeof value === 'number') {
            return new Date(value).getTime()
          }

          if (typeof value === 'string') {
            const date = new Date(value)

            if (!isNaN(date.getTime())) {
              return date.getTime()
            }

            const numValue = parseInt(value, 10)

            if (!isNaN(numValue)) {
              const dateFromNum = new Date(numValue)

              if (!isNaN(dateFromNum.getTime())) {
                return dateFromNum.getTime()
              }
            }
          }

          return helpers.error('custom.flexibleTimestamp')
        },
      },
    },
  }))

export default schema

export { schema }
