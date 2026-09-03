/* eslint-disable @typescript-eslint/no-require-imports */
import { UserInputError } from '@/lib/error'

import {
  parseUserInput,
  schemaErrorToUserInputError,
  withSchema,
} from './zod.handler'

import { ZodError, z } from 'zod'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    log: jest.fn(),
  })),
  createSpan: jest.fn(() => ({
    finish: jest.fn(),
  })),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  respondFromError: jest.fn(
    (error) => new Response(error.message, { status: 400 })
  ),
}))

describe('zod.handler', () => {
  describe('schemaErrorToUserInputError', () => {
    it('should convert zod error with path to user input error', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['user', 'email'],
          message: 'Expected string, received number',
        },
      ])

      const result = schemaErrorToUserInputError(zodError)

      expect(result).toBeInstanceOf(UserInputError)
      expect(result.message).toBe(
        'user.email: Expected string, received number'
      )
    })

    it('should convert zod error with multiple errors', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string',
        },
        {
          code: 'too_small',
          minimum: 5,
          type: 'string',
          inclusive: true,
          path: ['password'],
          message: 'String must contain at least 5 characters',
        },
      ])

      const result = schemaErrorToUserInputError(zodError)

      expect(result).toBeInstanceOf(UserInputError)
      expect(result.message).toBe(
        'name: Expected string; password: String must contain at least 5 characters'
      )
    })

    it('should handle zod error with empty path', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'string',
          path: [],
          message: 'Expected object, received string',
        },
      ])

      const result = schemaErrorToUserInputError(zodError)

      expect(result).toBeInstanceOf(UserInputError)
      expect(result.message).toBe(': Expected object, received string')
    })

    it('should handle zod error with nested path', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['user', 'profile', 'address', 'street'],
          message: 'Required',
        },
      ])

      const result = schemaErrorToUserInputError(zodError)

      expect(result).toBeInstanceOf(UserInputError)
      expect(result.message).toBe('user.profile.address.street: Required')
    })

    it('should use default message if no errors array', () => {
      const zodError = new ZodError([])

      const result = schemaErrorToUserInputError(zodError)

      expect(result).toBeInstanceOf(UserInputError)
      // ZodError with empty errors array will have auto-generated message
      expect(result.message).toBeTruthy()
    })
  })

  describe('parseUserInput', () => {
    it('should parse valid input successfully', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const input = { name: 'John', age: 30 }

      const result = parseUserInput(schema, input)

      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should throw user input error for invalid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const input = { name: 'John', age: 'thirty' }

      expect(() => parseUserInput(schema, input)).toThrow(UserInputError)
    })

    it('should handle string schema validation', () => {
      const schema = z.string().email()

      const result = parseUserInput(schema, 'test@example.com')

      expect(result).toBe('test@example.com')
    })

    it('should throw for invalid string format', () => {
      const schema = z.string().email()

      expect(() => parseUserInput(schema, 'not-an-email')).toThrow(
        UserInputError
      )
    })

    it('should handle array schema validation', () => {
      const schema = z.array(z.number())

      const result = parseUserInput(schema, [1, 2, 3])

      expect(result).toEqual([1, 2, 3])
    })

    it('should throw for invalid array items', () => {
      const schema = z.array(z.number())

      expect(() => parseUserInput(schema, [1, 'two', 3])).toThrow(
        UserInputError
      )
    })

    it('should handle nested object schema', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      })

      const input = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      }

      const result = parseUserInput(schema, input)

      expect(result).toEqual(input)
    })

    it('should throw with detailed path for nested validation errors', () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      })

      const input = {
        user: {
          email: 'invalid',
        },
      }

      expect(() => parseUserInput(schema, input)).toThrow(UserInputError)

      try {
        parseUserInput(schema, input)
      } catch (e) {
        expect(e.message).toContain('user.email')
      }
    })
  })

  describe('withSchema', () => {
    let mockRequest
    let mockFn
    let parseRequestJson
    let respondFromError

    beforeEach(() => {
      jest.clearAllMocks()

      parseRequestJson = require('@/lib/request').parseRequestJson
      respondFromError = require('@/lib/response').respondFromError

      mockRequest = new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })

      mockFn = jest.fn(async (value) => new Response(JSON.stringify(value)))
    })

    it('should validate and call function with parsed value', async () => {
      const schema = z.object({
        name: z.string(),
      })

      parseRequestJson.mockResolvedValue({ name: 'test' })

      const wrapped = withSchema(schema, mockFn)
      const response = await wrapped(mockRequest)

      expect(parseRequestJson).toHaveBeenCalledWith(mockRequest)
      expect(mockFn).toHaveBeenCalledWith({ name: 'test' }, mockRequest)
      expect(response).toBeInstanceOf(Response)
    })

    it('should return error response for invalid input', async () => {
      const schema = z.object({
        name: z.string(),
      })

      parseRequestJson.mockResolvedValue({ name: 123 })

      const wrapped = withSchema(schema, mockFn)
      const response = await wrapped(mockRequest)

      expect(respondFromError).toHaveBeenCalled()
      expect(mockFn).not.toHaveBeenCalled()
      expect(response).toBeInstanceOf(Response)
    })

    it('should pass additional arguments to wrapped function', async () => {
      const schema = z.object({
        name: z.string(),
      })

      parseRequestJson.mockResolvedValue({ name: 'test' })

      const wrapped = withSchema(schema, mockFn)

      await wrapped(mockRequest, 'arg1', 'arg2')

      expect(mockFn).toHaveBeenCalledWith(
        { name: 'test' },
        mockRequest,
        'arg1',
        'arg2'
      )
    })

    it('should handle schema validation with complex nested objects', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number().min(0),
        }),
        tags: z.array(z.string()),
      })

      const input = {
        user: { name: 'John', age: 30 },
        tags: ['tag1', 'tag2'],
      }

      parseRequestJson.mockResolvedValue(input)

      const wrapped = withSchema(schema, mockFn)

      await wrapped(mockRequest)

      expect(mockFn).toHaveBeenCalledWith(input, mockRequest)
    })

    it('should handle validation errors with multiple fields', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      parseRequestJson.mockResolvedValue({ name: 123, age: 'invalid' })

      const wrapped = withSchema(schema, mockFn)

      await wrapped(mockRequest)

      expect(respondFromError).toHaveBeenCalled()
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should finish span even if function throws', async () => {
      const createSpan = require('@/lib/debug').createSpan
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      const schema = z.object({
        name: z.string(),
      })

      parseRequestJson.mockResolvedValue({ name: 'test' })
      mockFn.mockRejectedValue(new Error('Function error'))

      const wrapped = withSchema(schema, mockFn)

      await expect(wrapped(mockRequest)).rejects.toThrow('Function error')

      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should finish span even if validation fails', async () => {
      const createSpan = require('@/lib/debug').createSpan
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      const schema = z.object({
        name: z.string(),
      })

      parseRequestJson.mockResolvedValue({ name: 123 })

      const wrapped = withSchema(schema, mockFn)

      await wrapped(mockRequest)

      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should finish span on successful execution', async () => {
      const createSpan = require('@/lib/debug').createSpan
      const mockSpan = { finish: jest.fn() }

      createSpan.mockReturnValue(mockSpan)

      const schema = z.object({
        name: z.string(),
      })

      parseRequestJson.mockResolvedValue({ name: 'test' })

      const wrapped = withSchema(schema, mockFn)

      await wrapped(mockRequest)

      expect(mockSpan.finish).toHaveBeenCalled()
    })
  })
})
