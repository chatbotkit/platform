import { SystemError } from '@/lib/error'
import { parseRequestJson, parseRequestSchema } from '@/lib/request'
import { BAD_REQUEST_CODE } from '@/lib/response'

import { z } from 'zod'

describe('parseRequestJson', () => {
  it('should parse valid JSON from request body', async () => {
    const testData = { name: 'John', age: 30 }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestJson(mockRequest)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should parse empty object from request body', async () => {
    const testData = {}

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestJson(mockRequest)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should parse array from request body', async () => {
    const testData = [1, 2, 3]

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestJson(mockRequest)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should parse null from request body', async () => {
    const testData = null

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestJson(mockRequest)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should parse primitive values from request body', async () => {
    const testCases = ['string', 42, true, false]

    for (const testData of testCases) {
      const mockRequest = {
        json: jest.fn().mockResolvedValue(testData),
      }

      const result = await parseRequestJson(mockRequest)

      expect(result).toEqual(testData)
      expect(mockRequest.json).toHaveBeenCalledTimes(1)
    }
  })

  it('should throw SystemError with BAD_REQUEST_CODE when json parsing fails', async () => {
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    }

    await expect(parseRequestJson(mockRequest)).rejects.toThrow(SystemError)

    try {
      await parseRequestJson(mockRequest)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }

    expect(mockRequest.json).toHaveBeenCalledTimes(2)
  })

  it('should throw SystemError when json method throws synchronously', async () => {
    const mockRequest = {
      json: jest.fn().mockImplementation(() => {
        throw new Error('Synchronous error')
      }),
    }

    await expect(parseRequestJson(mockRequest)).rejects.toThrow(SystemError)

    try {
      await parseRequestJson(mockRequest)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }

    expect(mockRequest.json).toHaveBeenCalledTimes(2)
  })

  it('should throw SystemError when json method is undefined', async () => {
    const mockRequest = {}

    await expect(parseRequestJson(mockRequest)).rejects.toThrow(SystemError)

    try {
      await parseRequestJson(mockRequest)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }
  })
})

describe('parseRequestSchema', () => {
  const validUserSchema = z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  })

  const simpleStringSchema = z.string()

  const optionalFieldsSchema = z.object({
    required: z.string(),
    optional: z.string().optional(),
  })

  it('should parse and validate valid data with object schema', async () => {
    const testData = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, validUserSchema)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should parse and validate simple string schema', async () => {
    const testData = 'hello world'

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, simpleStringSchema)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should handle schema with optional fields', async () => {
    const testData = { required: 'value' }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, optionalFieldsSchema)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should handle schema transformation and defaults', async () => {
    const schemaWithDefaults = z.object({
      name: z.string(),
      count: z.number().default(0),
    })

    const testData = { name: 'test' }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, schemaWithDefaults)

    expect(result).toEqual({ name: 'test', count: 0 })
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should throw SystemError when schema validation fails - missing required field', async () => {
    const testData = { name: 'John', age: 30 } // missing email

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    await expect(
      parseRequestSchema(mockRequest, validUserSchema)
    ).rejects.toThrow(SystemError)

    try {
      await parseRequestSchema(mockRequest, validUserSchema)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }

    expect(mockRequest.json).toHaveBeenCalledTimes(2)
  })

  it('should throw SystemError when schema validation fails - wrong type', async () => {
    const testData = {
      name: 'John',
      age: 'thirty', // should be number
      email: 'john@example.com',
    }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    await expect(
      parseRequestSchema(mockRequest, validUserSchema)
    ).rejects.toThrow(SystemError)

    try {
      await parseRequestSchema(mockRequest, validUserSchema)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }

    expect(mockRequest.json).toHaveBeenCalledTimes(2)
  })

  it('should throw SystemError when schema validation fails - invalid email format', async () => {
    const testData = {
      name: 'John',
      age: 30,
      email: 'invalid-email', // invalid email format
    }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    await expect(
      parseRequestSchema(mockRequest, validUserSchema)
    ).rejects.toThrow(SystemError)

    try {
      await parseRequestSchema(mockRequest, validUserSchema)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }

    expect(mockRequest.json).toHaveBeenCalledTimes(2)
  })

  it('should throw SystemError when schema validation fails - extra fields with strict schema', async () => {
    const strictSchema = z
      .object({
        name: z.string(),
      })
      .strict()

    const testData = {
      name: 'John',
      extraField: 'not allowed', // extra field in strict schema
    }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    await expect(parseRequestSchema(mockRequest, strictSchema)).rejects.toThrow(
      SystemError
    )

    try {
      await parseRequestSchema(mockRequest, strictSchema)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }

    expect(mockRequest.json).toHaveBeenCalledTimes(2)
  })

  it('should throw SystemError when JSON parsing fails before schema validation', async () => {
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    }

    await expect(
      parseRequestSchema(mockRequest, validUserSchema)
    ).rejects.toThrow(SystemError)

    try {
      await parseRequestSchema(mockRequest, validUserSchema)
    } catch (error) {
      expect(error).toBeInstanceOf(SystemError)
      expect(error.code).toBe(BAD_REQUEST_CODE)
    }

    expect(mockRequest.json).toHaveBeenCalledTimes(2)
  })

  it('should handle complex nested schema validation', async () => {
    const nestedSchema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
          preferences: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
          }),
        }),
      }),
      metadata: z.array(z.string()),
    })

    const testData = {
      user: {
        profile: {
          name: 'John',
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
      },
      metadata: ['tag1', 'tag2'],
    }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, nestedSchema)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should handle array schema validation', async () => {
    const arraySchema = z.array(
      z.object({
        id: z.number(),
        name: z.string(),
      })
    )

    const testData = [
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' },
    ]

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, arraySchema)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should handle union schema validation', async () => {
    const unionSchema = z.union([
      z.object({ type: z.literal('user'), name: z.string() }),
      z.object({ type: z.literal('admin'), permissions: z.array(z.string()) }),
    ])

    const userData = { type: 'user', name: 'John' }
    const adminData = { type: 'admin', permissions: ['read', 'write'] }

    for (const testData of [userData, adminData]) {
      const mockRequest = {
        json: jest.fn().mockResolvedValue(testData),
      }

      const result = await parseRequestSchema(mockRequest, unionSchema)

      expect(result).toEqual(testData)
      expect(mockRequest.json).toHaveBeenCalledTimes(1)
    }
  })

  it('should handle null values when schema allows them', async () => {
    const nullableSchema = z.object({
      name: z.string().nullable(),
      value: z.number().optional(),
    })

    const testData = { name: null }

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, nullableSchema)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })

  it('should handle empty object when schema allows it', async () => {
    const emptyObjectSchema = z.object({}).passthrough()

    const testData = {}

    const mockRequest = {
      json: jest.fn().mockResolvedValue(testData),
    }

    const result = await parseRequestSchema(mockRequest, emptyObjectSchema)

    expect(result).toEqual(testData)
    expect(mockRequest.json).toHaveBeenCalledTimes(1)
  })
})
