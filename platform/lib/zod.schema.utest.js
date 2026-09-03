/* eslint-disable @typescript-eslint/no-require-imports */
import {
  createSchemaByType,
  parse,
  parseAsync,
  partialObjectParse,
  partialObjectParseAsync,
  tryParse,
  tryParseAsync,
  z,
} from './zod.schema'

jest.mock('@/lib/error', () => ({
  captureInputError: jest.fn(),
}))

describe('zod.schema', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('parse', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    it('should parse valid data', () => {
      const data = { name: 'John', age: 30 }
      const result = parse(schema, data)

      expect(result).toEqual(data)
    })

    it('should throw ZodError for invalid data', () => {
      const invalidData = { name: 'John', age: 'not a number' }

      expect(() => parse(schema, invalidData)).toThrow()
    })

    it('should call custom error handler when provided', () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const onError = jest.fn()

      expect(() => parse(schema, invalidData, onError)).toThrow()
      expect(onError).toHaveBeenCalled()
    })

    it('should capture input error when onError is true', () => {
      const { captureInputError } = require('@/lib/error')
      const invalidData = { name: 'John', age: 'not a number' }

      expect(() => parse(schema, invalidData, true)).toThrow()
      expect(captureInputError).toHaveBeenCalled()
    })

    it('should handle error handler that throws', () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const onError = jest.fn(() => {
        throw new Error('Handler error')
      })

      expect(() => parse(schema, invalidData, onError)).toThrow()
      expect(onError).toHaveBeenCalled()
    })

    it('should handle missing required fields', () => {
      const invalidData = { name: 'John' }

      expect(() => parse(schema, invalidData)).toThrow()
    })

    it('should handle extra fields with strict schema', () => {
      const strictSchema = z.object({ name: z.string() }).strict()
      const data = { name: 'John', extra: 'field' }

      expect(() => parse(strictSchema, data)).toThrow()
    })
  })

  describe('tryParse', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    it('should return parsed data for valid input', () => {
      const data = { name: 'John', age: 30 }
      const result = tryParse(schema, data)

      expect(result).toEqual(data)
    })

    it('should return null for invalid input', () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const result = tryParse(schema, invalidData)

      expect(result).toBeNull()
    })

    it('should call custom error handler when provided', () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const onError = jest.fn()

      const result = tryParse(schema, invalidData, onError)

      expect(result).toBeNull()
      expect(onError).toHaveBeenCalled()
    })

    it('should capture input error when onError is true', () => {
      const { captureInputError } = require('@/lib/error')
      const invalidData = { name: 'John', age: 'not a number' }

      const result = tryParse(schema, invalidData, true)

      expect(result).toBeNull()
      expect(captureInputError).toHaveBeenCalled()
    })

    it('should handle null input', () => {
      const result = tryParse(schema, null)

      expect(result).toBeNull()
    })

    it('should handle undefined input', () => {
      const result = tryParse(schema, undefined)

      expect(result).toBeNull()
    })
  })

  describe('partialObjectParse', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    it('should parse valid object', () => {
      const data = { name: 'John', age: 30, email: 'john@example.com' }
      const result = partialObjectParse(schema, data)

      expect(result).toEqual(data)
    })

    it('should omit fields with errors', () => {
      const data = {
        name: 'John',
        age: 'not a number',
        email: 'john@example.com',
      }
      const result = partialObjectParse(schema, data)

      expect(result).toEqual({ name: 'John', email: 'john@example.com' })
    })

    it('should omit multiple fields with errors', () => {
      const data = { name: 'John', age: 'not a number', email: 'invalid-email' }
      const result = partialObjectParse(schema, data)

      expect(result).toEqual({ name: 'John' })
    })

    it('should handle all fields invalid', () => {
      const data = { name: 123, age: 'not a number', email: 'invalid-email' }
      const result = partialObjectParse(schema, data)

      expect(result).toEqual({})
    })

    it('should throw non-ZodError errors', () => {
      const badSchema = {
        parse: () => {
          throw new Error('Non-Zod error')
        },
      }
      const data = { name: 'John' }

      expect(() => partialObjectParse(badSchema, data)).toThrow('Non-Zod error')
    })
  })

  describe('parseAsync', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    it('should parse valid data', async () => {
      const data = { name: 'John', age: 30 }
      const result = await parseAsync(schema, data)

      expect(result).toEqual(data)
    })

    it('should throw ZodError for invalid data', async () => {
      const invalidData = { name: 'John', age: 'not a number' }

      await expect(parseAsync(schema, invalidData)).rejects.toThrow()
    })

    it('should call async error handler when provided', async () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const onError = jest.fn(async () => {})

      await expect(parseAsync(schema, invalidData, onError)).rejects.toThrow()
      expect(onError).toHaveBeenCalled()
    })

    it('should capture input error when onError is true', async () => {
      const { captureInputError } = require('@/lib/error')
      const invalidData = { name: 'John', age: 'not a number' }

      await expect(parseAsync(schema, invalidData, true)).rejects.toThrow()
      expect(captureInputError).toHaveBeenCalled()
    })

    it('should handle async error handler that throws', async () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const onError = jest.fn(async () => {
        throw new Error('Handler error')
      })

      await expect(parseAsync(schema, invalidData, onError)).rejects.toThrow()
      expect(onError).toHaveBeenCalled()
    })
  })

  describe('tryParseAsync', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    it('should return parsed data for valid input', async () => {
      const data = { name: 'John', age: 30 }
      const result = await tryParseAsync(schema, data)

      expect(result).toEqual(data)
    })

    it('should return null for invalid input', async () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const result = await tryParseAsync(schema, invalidData)

      expect(result).toBeNull()
    })

    it('should call async error handler when provided', async () => {
      const invalidData = { name: 'John', age: 'not a number' }
      const onError = jest.fn(async () => {})

      const result = await tryParseAsync(schema, invalidData, onError)

      expect(result).toBeNull()
      expect(onError).toHaveBeenCalled()
    })

    it('should capture input error when onError is true', async () => {
      const { captureInputError } = require('@/lib/error')
      const invalidData = { name: 'John', age: 'not a number' }

      const result = await tryParseAsync(schema, invalidData, true)

      expect(result).toBeNull()
      expect(captureInputError).toHaveBeenCalled()
    })

    it('should handle null input', async () => {
      const result = await tryParseAsync(schema, null)

      expect(result).toBeNull()
    })
  })

  describe('partialObjectParseAsync', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    it('should parse valid object', async () => {
      const data = { name: 'John', age: 30, email: 'john@example.com' }
      const result = await partialObjectParseAsync(schema, data)

      expect(result).toEqual(data)
    })

    it('should omit fields with errors', async () => {
      const data = {
        name: 'John',
        age: 'not a number',
        email: 'john@example.com',
      }
      const result = await partialObjectParseAsync(schema, data)

      expect(result).toEqual({ name: 'John', email: 'john@example.com' })
    })

    it('should omit multiple fields with errors', async () => {
      const data = { name: 'John', age: 'not a number', email: 'invalid-email' }
      const result = await partialObjectParseAsync(schema, data)

      expect(result).toEqual({ name: 'John' })
    })

    it('should handle all fields invalid', async () => {
      const data = { name: 123, age: 'not a number', email: 'invalid-email' }
      const result = await partialObjectParseAsync(schema, data)

      expect(result).toEqual({})
    })

    it('should throw non-ZodError errors', async () => {
      const badSchema = {
        parseAsync: async () => {
          throw new Error('Non-Zod error')
        },
      }
      const data = { name: 'John' }

      await expect(partialObjectParseAsync(badSchema, data)).rejects.toThrow(
        'Non-Zod error'
      )
    })
  })

  describe('createSchemaByType', () => {
    it('should create schema that validates type', () => {
      const userSchema = createSchemaByType()(
        z.object({
          name: z.string(),
          age: z.number(),
        })
      )

      expect(userSchema).toBeDefined()
      expect(userSchema.parse({ name: 'John', age: 30 })).toEqual({
        name: 'John',
        age: 30,
      })
    })

    it('should validate nested objects', () => {
      const addressSchema = createSchemaByType()(
        z.object({
          street: z.string(),
          city: z.string(),
        })
      )

      expect(
        addressSchema.parse({ street: '123 Main St', city: 'NYC' })
      ).toEqual({
        street: '123 Main St',
        city: 'NYC',
      })
    })
  })

  describe('edge cases', () => {
    it('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      })

      const result = parse(schema, { name: 'John' })

      expect(result).toEqual({ name: 'John' })
    })

    it('should handle default values', () => {
      const schema = z.object({
        name: z.string(),
        active: z.boolean().default(true),
      })

      const result = parse(schema, { name: 'John' })

      expect(result).toEqual({ name: 'John', active: true })
    })

    it('should handle array schemas', () => {
      const schema = z.array(z.string())
      const result = parse(schema, ['a', 'b', 'c'])

      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('should handle union schemas', () => {
      const schema = z.union([z.string(), z.number()])

      expect(parse(schema, 'hello')).toBe('hello')
      expect(parse(schema, 42)).toBe(42)
    })

    it('should handle enum schemas', () => {
      const schema = z.enum(['admin', 'user', 'guest'])

      expect(parse(schema, 'admin')).toBe('admin')
      expect(() => parse(schema, 'invalid')).toThrow()
    })
  })
})
