import { captureInputError } from '@/lib/error'
import z, {
  ZodError,
  createSchemaByType,
  parse,
  parseAsync,
  partialObjectParse,
  partialObjectParseAsync,
  tryParse,
  tryParseAsync,
} from '@/lib/zod.schema'

jest.mock('@/lib/error', () => ({
  captureInputError: jest.fn(),
}))

const mockedCaptureInputError = captureInputError as jest.MockedFunction<
  typeof captureInputError
>

describe('parse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should parse valid data successfully', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 30,
    }

    const result = parse(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      age: 30,
    })
  })

  it('should throw ZodError for invalid data', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age', // should be number
    }

    expect(() => parse(schema, data)).toThrow(ZodError)
  })

  it('should call captureInputError when onError is true', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    expect(() => parse(schema, data, true)).toThrow(ZodError)
    expect(captureInputError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should call custom error handler function', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest.fn()

    expect(() => parse(schema, data, onError)).toThrow(ZodError)
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should ignore error handler failures and still throw original ZodError', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest.fn(() => {
      throw new Error('Error handler failed')
    })

    expect(() => parse(schema, data, onError)).toThrow(ZodError)
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should work without error handler', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const validData = {
      name: 'John Doe',
      age: 30,
    }

    const invalidData = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    expect(parse(schema, validData)).toEqual(validData)
    expect(() => parse(schema, invalidData)).toThrow(ZodError)
  })

  it('should handle complex nested schemas', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
          age: z.number(),
        }),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
        }),
      }),
      metadata: z.record(z.string()),
    })

    const validData = {
      user: {
        profile: {
          name: 'John Doe',
          age: 30,
        },
        settings: {
          theme: 'dark',
          notifications: true,
        },
      },
      metadata: {
        source: 'api',
        version: '1.0',
      },
    }

    const result = parse(schema, validData)

    expect(result).toEqual(validData)
  })
})

describe('tryParse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return parsed data for valid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 30,
    }

    const result = tryParse(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      age: 30,
    })
  })

  it('should return null for invalid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const result = tryParse(schema, data)

    expect(result).toBeNull()
  })

  it('should call captureInputError when onError is true and parsing fails', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const result = tryParse(schema, data, true)

    expect(result).toBeNull()
    expect(captureInputError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should call custom error handler and return null', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest.fn()
    const result = tryParse(schema, data, onError)

    expect(result).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should return null even when error handler throws', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest.fn(() => {
      throw new Error('Error handler failed')
    })

    const result = tryParse(schema, data, onError)

    expect(result).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })
})

describe('parseAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should parse valid data successfully', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 30,
    }

    const result = await parseAsync(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      age: 30,
    })
  })

  it('should throw ZodError for invalid data', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    await expect(parseAsync(schema, data)).rejects.toThrow(ZodError)
  })

  it('should call captureInputError when onError is true', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    await expect(parseAsync(schema, data, true)).rejects.toThrow(ZodError)
    expect(captureInputError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should ignore captureInputError failures and still throw original ZodError', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    mockedCaptureInputError.mockRejectedValueOnce(new Error('Capture failed'))

    await expect(parseAsync(schema, data, true)).rejects.toThrow(ZodError)
    expect(mockedCaptureInputError).toHaveBeenCalledWith(
      expect.any(ZodError),
      data
    )
  })

  it('should call custom async error handler function', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest.fn().mockResolvedValueOnce(undefined)

    await expect(parseAsync(schema, data, onError)).rejects.toThrow(ZodError)
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should ignore async error handler failures and still throw original ZodError', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest
      .fn()
      .mockRejectedValueOnce(new Error('Error handler failed'))

    await expect(parseAsync(schema, data, onError)).rejects.toThrow(ZodError)
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should work with async validation schemas', async () => {
    const schema = z.object({
      username: z.string().refine(async (val) => {
        await new Promise((resolve) => setTimeout(resolve, 1))

        return val.length >= 3
      }, 'Username must be at least 3 characters'),
      email: z.string().email(),
    })

    const validData = {
      username: 'john',
      email: 'john@example.com',
    }

    const invalidData = {
      username: 'jo',
      email: 'john@example.com',
    }

    await expect(parseAsync(schema, validData)).resolves.toEqual(validData)
    await expect(parseAsync(schema, invalidData)).rejects.toThrow(ZodError)
  })
})

describe('tryParseAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return parsed data for valid input', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 30,
    }

    const result = await tryParseAsync(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      age: 30,
    })
  })

  it('should return null for invalid input', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const result = await tryParseAsync(schema, data)

    expect(result).toBeNull()
  })

  it('should call captureInputError when onError is true and parsing fails', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const result = await tryParseAsync(schema, data, true)

    expect(result).toBeNull()
    expect(captureInputError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should call custom async error handler and return null', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest.fn().mockResolvedValueOnce(undefined)
    const result = await tryParseAsync(schema, data, onError)

    expect(result).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should return null even when async error handler throws', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    const onError = jest
      .fn()
      .mockRejectedValueOnce(new Error('Error handler failed'))

    const result = await tryParseAsync(schema, data, onError)

    expect(result).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.any(ZodError), data)
  })

  it('should work with async validation schemas', async () => {
    const schema = z.object({
      username: z.string().refine(async (val) => {
        await new Promise((resolve) => setTimeout(resolve, 1))

        return val.length >= 3
      }, 'Username must be at least 3 characters'),
      email: z.string().email(),
    })

    const validData = {
      username: 'john',
      email: 'john@example.com',
    }

    const invalidData = {
      username: 'jo',
      email: 'john@example.com',
    }

    await expect(tryParseAsync(schema, validData)).resolves.toEqual(validData)
    await expect(tryParseAsync(schema, invalidData)).resolves.toBeNull()
  })

  it('should ignore captureInputError failures and still return null', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age',
    }

    mockedCaptureInputError.mockRejectedValueOnce(new Error('Capture failed'))

    const result = await tryParseAsync(schema, data, true)

    expect(result).toBeNull()
    expect(mockedCaptureInputError).toHaveBeenCalledWith(
      expect.any(ZodError),
      data
    )
  })

  it('should handle complex error scenarios with nested data', async () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
      tags: z.array(z.string()),
    })

    const data = {
      user: {
        name: 'John',
        age: 'not-a-number',
      },
      tags: ['valid', 'tags'],
    }

    const result = await tryParseAsync(schema, data)

    expect(result).toBeNull()
  })
})

describe('partialObjectParse', () => {
  it('should return valid data when all fields pass validation', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    const data = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    })
  })

  it('should omit invalid fields and return partial object with valid fields only', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
      isActive: z.boolean(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age', // invalid - should be number
      email: 'invalid-email', // invalid - not a valid email
      isActive: true,
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      isActive: true,
    })
  })

  it('should handle nested validation errors by omitting top-level fields', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
      status: z.string(),
    })

    const data = {
      user: {
        name: 'John',
        age: 'invalid', // causes validation error for entire user object
      },
      status: 'active',
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      status: 'active',
    })
  })

  it('should handle multiple field errors and omit all invalid fields', () => {
    const schema = z.object({
      name: z.string().min(2),
      age: z.number().positive(),
      email: z.string().email(),
      score: z.number().max(100),
      category: z.enum(['A', 'B', 'C']),
    })

    const data = {
      name: 'J', // too short
      age: -5, // not positive
      email: 'john@example.com', // valid
      score: 150, // too high
      category: 'D', // not in enum
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      email: 'john@example.com',
    })
  })

  it('should return empty object when all fields are invalid', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    const data = {
      name: 123, // invalid - should be string
      age: 'not-a-number', // invalid - should be number
      email: 'not-an-email', // invalid - not a valid email
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({})
  })

  it('should handle optional fields correctly when they are invalid', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      email: z.string().email().optional(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age', // invalid optional field
      email: 'invalid-email', // invalid optional field
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
    })
  })

  it('should throw ZodError when empty data object fails validation after omitting fields', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {}

    // @note when all fields are missing, fieldsToOmit will contain undefined values
    // and omit() still requires the remaining required fields to be present
    expect(() => partialObjectParse(schema, data)).toThrow()
  })

  it('should handle schema with no required fields', () => {
    const schema = z.object({
      name: z.string().optional(),
      age: z.number().optional(),
    })

    const data = {
      name: 'John',
      age: 30,
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      name: 'John',
      age: 30,
    })
  })

  it('should re-throw non-ZodError exceptions', () => {
    const schema = z.object({
      name: z.string(),
    })

    // @note mock parse to throw a non-ZodError to test error handling
    const originalParse = schema.parse

    schema.parse = jest.fn(() => {
      throw new Error('Non-ZodError')
    })

    const data = { name: 'John' }

    expect(() => partialObjectParse(schema, data)).toThrow('Non-ZodError')

    // restore original method
    schema.parse = originalParse
  })

  it('should handle array fields in validation errors correctly', () => {
    const schema = z.object({
      tags: z.array(z.string()),
      name: z.string(),
      count: z.number(),
    })

    const data = {
      tags: [1, 2, 3], // invalid - should be string array
      name: 'valid name',
      count: 'invalid count', // invalid - should be number
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      name: 'valid name',
    })
  })

  it('should preserve field values in fieldsToOmit for omit operation', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    const data = {
      name: 'John',
      age: 'invalid-age',
      email: 'john@example.com',
    }

    // @note spy on omit method to verify it receives correct fields
    const omitSpy = jest.spyOn(schema, 'omit')

    const result = partialObjectParse(schema, data)

    expect(omitSpy).toHaveBeenCalledWith({ age: 'invalid-age' })
    expect(result).toEqual({
      name: 'John',
      email: 'john@example.com',
    })

    omitSpy.mockRestore()
  })

  it('should handle deeply nested path errors correctly', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
        }),
      }),
      status: z.string(),
    })

    const data = {
      user: {
        profile: {
          name: 123, // invalid - causes error at path ['user']
        },
      },
      status: 'active',
    }

    // @note only top-level field 'user' should be omitted due to nested error
    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      status: 'active',
    })
  })

  it('should handle mixed valid and invalid fields with complex schema', () => {
    const schema = z.object({
      id: z.string().uuid(),
      metadata: z.record(z.string()),
      tags: z.array(z.string()).min(1),
      config: z.object({
        enabled: z.boolean(),
        timeout: z.number().positive(),
      }),
      priority: z.enum(['low', 'medium', 'high']),
    })

    const data = {
      id: 'not-a-uuid', // invalid uuid
      metadata: { key: 'value' }, // valid
      tags: [], // invalid - minimum 1 item required
      config: {
        enabled: true,
        timeout: 5000,
      }, // valid
      priority: 'urgent', // invalid - not in enum
    }

    const result = partialObjectParse(schema, data)

    expect(result).toEqual({
      metadata: { key: 'value' },
      config: {
        enabled: true,
        timeout: 5000,
      },
    })
  })
})

describe('partialObjectParseAsync', () => {
  it('should return valid data when all fields pass validation', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    const data = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    })
  })

  it('should omit invalid fields and return partial object with valid fields only', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
      isActive: z.boolean(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age', // invalid - should be number
      email: 'invalid-email', // invalid - not a valid email
      isActive: true,
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
      isActive: true,
    })
  })

  it('should handle nested validation errors by omitting top-level fields', async () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
      status: z.string(),
    })

    const data = {
      user: {
        name: 'John',
        age: 'invalid', // causes validation error for entire user object
      },
      status: 'active',
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      status: 'active',
    })
  })

  it('should handle multiple field errors and omit all invalid fields', async () => {
    const schema = z.object({
      name: z.string().min(2),
      age: z.number().positive(),
      email: z.string().email(),
      score: z.number().max(100),
      category: z.enum(['A', 'B', 'C']),
    })

    const data = {
      name: 'J', // too short
      age: -5, // not positive
      email: 'john@example.com', // valid
      score: 150, // too high
      category: 'D', // not in enum
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      email: 'john@example.com',
    })
  })

  it('should return empty object when all fields are invalid', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    const data = {
      name: 123, // invalid - should be string
      age: 'not-a-number', // invalid - should be number
      email: 'not-an-email', // invalid - not a valid email
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({})
  })

  it('should handle optional fields correctly when they are invalid', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      email: z.string().email().optional(),
    })

    const data = {
      name: 'John Doe',
      age: 'invalid-age', // invalid optional field
      email: 'invalid-email', // invalid optional field
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      name: 'John Doe',
    })
  })

  it('should throw ZodError when empty data object fails validation after omitting fields', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const data = {}

    // @note when all fields are missing, fieldsToOmit will contain undefined values
    // and omit() still requires the remaining required fields to be present
    await expect(partialObjectParseAsync(schema, data)).rejects.toThrow()
  })

  it('should handle schema with no required fields', async () => {
    const schema = z.object({
      name: z.string().optional(),
      age: z.number().optional(),
    })

    const data = {
      name: 'John',
      age: 30,
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      name: 'John',
      age: 30,
    })
  })

  it('should re-throw non-ZodError exceptions', async () => {
    const schema = z.object({
      name: z.string(),
    })

    // @note mock parseAsync to throw a non-ZodError to test error handling
    const originalParseAsync = schema.parseAsync

    schema.parseAsync = jest.fn(() => {
      throw new Error('Non-ZodError')
    })

    const data = { name: 'John' }

    await expect(partialObjectParseAsync(schema, data)).rejects.toThrow(
      'Non-ZodError'
    )

    // restore original method
    schema.parseAsync = originalParseAsync
  })

  it('should handle array fields in validation errors correctly', async () => {
    const schema = z.object({
      tags: z.array(z.string()),
      name: z.string(),
      count: z.number(),
    })

    const data = {
      tags: [1, 2, 3], // invalid - should be string array
      name: 'valid name',
      count: 'invalid count', // invalid - should be number
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      name: 'valid name',
    })
  })

  it('should preserve field values in fieldsToOmit for omit operation', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    const data = {
      name: 'John',
      age: 'invalid-age',
      email: 'john@example.com',
    }

    // @note spy on omit method to verify it receives correct fields
    const omitSpy = jest.spyOn(schema, 'omit')

    const result = await partialObjectParseAsync(schema, data)

    expect(omitSpy).toHaveBeenCalledWith({ age: 'invalid-age' })
    expect(result).toEqual({
      name: 'John',
      email: 'john@example.com',
    })

    omitSpy.mockRestore()
  })

  it('should handle async validation with refinements', async () => {
    const schema = z.object({
      username: z.string().refine(async (val) => {
        // @note simulate async validation that checks username availability
        await new Promise((resolve) => setTimeout(resolve, 1))

        return val !== 'taken'
      }, 'Username is already taken'),
      email: z.string().email(),
      age: z.number(),
    })

    const data = {
      username: 'taken', // will fail async validation
      email: 'user@example.com',
      age: 25,
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      email: 'user@example.com',
      age: 25,
    })
  })

  it('should handle promise rejection in parseAsync', async () => {
    const schema = z.object({
      name: z.string(),
    })

    // @note mock parseAsync to return rejected promise
    const originalParseAsync = schema.parseAsync

    schema.parseAsync = jest.fn(() => Promise.reject(new Error('Async error')))

    const data = { name: 'John' }

    await expect(partialObjectParseAsync(schema, data)).rejects.toThrow(
      'Async error'
    )

    // restore original method
    schema.parseAsync = originalParseAsync
  })

  it('should handle complex async schema with multiple refinements', async () => {
    const schema = z.object({
      username: z.string().refine(async (val) => {
        await new Promise((resolve) => setTimeout(resolve, 1))

        return val.length >= 3
      }, 'Username too short'),
      email: z
        .string()
        .email()
        .refine(async (val) => {
          await new Promise((resolve) => setTimeout(resolve, 1))

          return !val.includes('banned')
        }, 'Email domain not allowed'),
      age: z.number(),
    })

    const data = {
      username: 'ab', // fails first refinement
      email: 'user@banned.com', // fails second refinement
      age: 25, // valid
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      age: 25,
    })
  })

  it('should handle ZodError with multiple path levels in async context', async () => {
    const schema = z.object({
      nested: z.object({
        deep: z.object({
          value: z.string(),
        }),
      }),
      simple: z.string(),
    })

    const data = {
      nested: {
        deep: {
          value: 123, // invalid - should be string, error path: ['nested']
        },
      },
      simple: 'valid',
    }

    const result = await partialObjectParseAsync(schema, data)

    expect(result).toEqual({
      simple: 'valid',
    })
  })
})

describe('createSchemaByType', () => {
  describe('basic functionality', () => {
    it('should create schema that matches target type exactly', () => {
      type User = { name: string; age: number }

      const userSchema = createSchemaByType<User>()(
        z.object({
          name: z.string(),
          age: z.number(),
        })
      )

      const result = userSchema.parse({ name: 'John', age: 30 })

      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should handle optional fields correctly', () => {
      type Config = { host: string; port?: number }

      const configSchema = createSchemaByType<Config>()(
        z.object({
          host: z.string(),
          port: z.number().optional(),
        })
      )

      expect(configSchema.parse({ host: 'localhost' })).toEqual({
        host: 'localhost',
      })

      expect(configSchema.parse({ host: 'localhost', port: 3000 })).toEqual({
        host: 'localhost',
        port: 3000,
      })
    })

    it('should handle nested objects', () => {
      type Nested = {
        user: { name: string; email?: string }
        active: boolean
      }

      const nestedSchema = createSchemaByType<Nested>()(
        z.object({
          user: z.object({
            name: z.string(),
            email: z.string().optional(),
          }),
          active: z.boolean(),
        })
      )

      const result = nestedSchema.parse({
        user: { name: 'John' },
        active: true,
      })

      expect(result).toEqual({ user: { name: 'John' }, active: true })
    })

    it('should handle arrays', () => {
      type WithArray = { tags: string[]; counts?: number[] }

      const arraySchema = createSchemaByType<WithArray>()(
        z.object({
          tags: z.array(z.string()),
          counts: z.array(z.number()).optional(),
        })
      )

      const result = arraySchema.parse({ tags: ['a', 'b'] })

      expect(result).toEqual({ tags: ['a', 'b'] })
    })

    it('should handle enums', () => {
      type WithEnum = {
        status: 'active' | 'inactive'
        priority?: 'low' | 'high'
      }

      const enumSchema = createSchemaByType<WithEnum>()(
        z.object({
          status: z.enum(['active', 'inactive']),
          priority: z.enum(['low', 'high']).optional(),
        })
      )

      const result = enumSchema.parse({ status: 'active' })

      expect(result).toEqual({ status: 'active' })
    })

    it('should handle records', () => {
      type WithRecord = {
        data: Record<string, number>
        meta?: Record<string, string>
      }

      const recordSchema = createSchemaByType<WithRecord>()(
        z.object({
          data: z.record(z.number()),
          meta: z.record(z.string()).optional(),
        })
      )

      const result = recordSchema.parse({ data: { count: 42 } })

      expect(result).toEqual({ data: { count: 42 } })
    })

    it('should handle union types', () => {
      type WithUnion = { value: string | number }

      const unionSchema = createSchemaByType<WithUnion>()(
        z.object({
          value: z.union([z.string(), z.number()]),
        })
      )

      expect(unionSchema.parse({ value: 'text' })).toEqual({ value: 'text' })
      expect(unionSchema.parse({ value: 42 })).toEqual({ value: 42 })
    })
  })

  describe('type safety - compile time checks', () => {
    // @note these tests verify that TypeScript correctly prevents invalid schemas
    // at compile time using @ts-expect-error comments - if the error is NOT raised,
    // the type system has a bug

    it('should not allow extra fields not in target type', () => {
      type User = { name: string }

      createSchemaByType<User>()(
        // @ts-expect-error - extra field 'age' not in User type
        z.object({
          name: z.string(),
          age: z.number(),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow missing required fields', () => {
      type User = { name: string; age: number }

      createSchemaByType<User>()(
        // @ts-expect-error - missing required field 'age'
        z.object({
          name: z.string(),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow missing optional fields', () => {
      // @note this is the key test - optional fields must still be declared in schema

      type Config = { host: string; port?: number }

      createSchemaByType<Config>()(
        // @ts-expect-error - missing optional field 'port' - all keys must be present
        z.object({
          host: z.string(),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow wrong type for required field', () => {
      type User = { name: string; age: number }

      createSchemaByType<User>()(
        // @ts-expect-error - 'age' should be number, not string
        z.object({
          name: z.string(),
          age: z.string(),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow wrong type for optional field', () => {
      type Config = { host: string; port?: number }

      createSchemaByType<Config>()(
        // @ts-expect-error - 'port' should be optional number, not optional string
        z.object({
          host: z.string(),
          port: z.string().optional(),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow making required field optional', () => {
      type User = { name: string; age: number }

      createSchemaByType<User>()(
        // @ts-expect-error - 'age' is required in User but optional in schema
        z.object({
          name: z.string(),
          age: z.number().optional(),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow wrong nested object structure', () => {
      type Nested = { user: { name: string; email: string } }

      createSchemaByType<Nested>()(
        // @ts-expect-error - nested 'user.email' is missing
        z.object({
          user: z.object({
            name: z.string(),
          }),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow wrong array element type', () => {
      type WithArray = { items: string[] }

      createSchemaByType<WithArray>()(
        // @ts-expect-error - array should contain strings, not numbers
        z.object({
          items: z.array(z.number()),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow wrong enum values', () => {
      type WithEnum = { status: 'active' | 'inactive' }

      createSchemaByType<WithEnum>()(
        // @ts-expect-error - enum values don't match target type
        z.object({
          status: z.enum(['pending', 'completed']),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow wrong record value type', () => {
      type WithRecord = { data: Record<string, number> }

      createSchemaByType<WithRecord>()(
        // @ts-expect-error - record value should be number, not string
        z.object({
          data: z.record(z.string()),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow missing multiple optional fields', () => {
      // @note verifies that ALL optional fields must be present, not just some

      type Config = {
        host: string
        port?: number
        timeout?: number
        retries?: number
      }

      createSchemaByType<Config>()(
        // @ts-expect-error - missing optional fields 'timeout' and 'retries'
        z.object({
          host: z.string(),
          port: z.number().optional(),
        })
      )

      expect(true).toBe(true)
    })

    it('should not allow complex nested optional field to be missing', () => {
      // @note this tests the real-world scenario that prompted this fix

      type RequestSchema = {
        method?: 'GET' | 'POST'
        url: string
        path?: string[]
        query?: Record<string, string | number | boolean>
        headers?: Record<string, string | number | boolean>
        body?: string | Record<string, unknown>
        options?: {
          text?: boolean
          format?: string
        }
      }

      createSchemaByType<RequestSchema>()(
        // @ts-expect-error - missing 'path' and 'options' optional fields
        z.object({
          method: z.enum(['GET', 'POST']).optional(),
          url: z.string(),
          query: z
            .record(z.union([z.string(), z.number(), z.boolean()]))
            .optional(),
          headers: z
            .record(z.union([z.string(), z.number(), z.boolean()]))
            .optional(),
          body: z.union([z.string(), z.record(z.unknown())]).optional(),
        })
      )

      expect(true).toBe(true)
    })
  })
})
