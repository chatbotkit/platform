import schema from '@/lib/joi.schema'

import { z } from 'zod'

describe('schema', () => {
  it('validate 001', () => {
    const s = schema.object({
      trial: schema.boolean().default(false),
    })

    expect(s.validate({})).toEqual({ value: { trial: false } })

    expect(s.validate({ trial: true })).toEqual({ value: { trial: true } })

    expect(s.validate({ trial: 'abc 123' })?.error?.message).toEqual(
      '"trial" must be a boolean'
    )
  })

  it('validate 002', () => {
    const s = schema.object({
      description: schema.string().allow(null, ''),
    })

    expect(s.validate({})).toEqual({ value: {} })
    expect(s.validate({ description: null })).toEqual({
      value: { description: null },
    })
    expect(s.validate({ description: '' })).toEqual({
      value: { description: '' },
    })
    expect(s.validate({ description: 'test' })).toEqual({
      value: { description: 'test' },
    })
  })

  it('validate 003', () => {
    const s = schema.object({
      name: schema.string().valid('abc', '123').optional(),
    })

    expect(s.validate({})).toEqual({ value: {} })
    expect(s.validate({ name: 'abc' })).toEqual({ value: { name: 'abc' } })
    expect(s.validate({ name: '123' })).toEqual({ value: { name: '123' } })
    expect(s.validate({ name: 'test' })?.error).toBeDefined()
  })

  it('validate no extra keys', () => {
    const s = schema.object({
      trial: schema.boolean().default(false),
    })

    expect(s.validate({ trial: true })).toEqual({ value: { trial: true } })

    expect(s.validate({ trial: true, extra: 'key' })?.error?.message).toEqual(
      '"extra" is not allowed'
    )
  })
})

describe('maxByteLength', () => {
  const maxByteLengthSchema = schema.string().allow(null, '').maxByteLength(10) // Define the schema with byte length

  it('should validate a string within the byte limit', () => {
    const validString = 'a'.repeat(10)
    const { error } = maxByteLengthSchema.validate(validString)

    expect(error).toBeUndefined()
  })

  it('should invalidate a string exceeding the byte limit', () => {
    const invalidString = 'a'.repeat(11)
    const { error } = maxByteLengthSchema.validate(invalidString)

    expect(error).toBeDefined()
    expect(error.details[0].message).toContain('must be less than or equal to')
  })

  it('should validate a string with multi-byte characters within the byte limit', () => {
    const validString = 'ü'.repeat(5) // Each 'ü' is 2 bytes in UTF-8
    const { error } = maxByteLengthSchema.validate(validString)

    expect(error).toBeUndefined()
  })

  it('should invalidate a string with multi-byte characters exceeding the byte limit', () => {
    const invalidString = 'ü'.repeat(6) // Each 'ü' is 2 bytes in UTF-8
    const { error } = maxByteLengthSchema.validate(invalidString)

    expect(error).toBeDefined()
    expect(error.details[0].message).toContain('must be less than or equal to')
  })

  it('should validate an empty string', () => {
    const { error } = maxByteLengthSchema.validate('')

    expect(error).toBeUndefined()
  })
})

describe('timestamp', () => {
  const timestampSchema = schema.any().flexibleTimestamp()

  it('should validate a valid timestamp (number)', () => {
    const validTimestamp = Date.now()

    const { error, value } = timestampSchema.validate(validTimestamp)

    expect(error).toBeUndefined()
    expect(value).toEqual(validTimestamp)
  })

  it('should validate a valid timestamp (ISO date string)', () => {
    const validTimestamp = new Date().toISOString()

    const { error, value } = timestampSchema.validate(validTimestamp)

    expect(error).toBeUndefined()
    expect(value).toEqual(new Date(validTimestamp).getTime())
  })

  it('should validate a valid timestamp (parsable date string)', () => {
    const validTimestamp = '2023-10-01T12:00:00Z'

    const { error, value } = timestampSchema.validate(validTimestamp)

    expect(error).toBeUndefined()
    expect(value).toEqual(new Date(validTimestamp).getTime())
  })

  it('should invalidate an invalid timestamp', () => {
    const invalidTimestamp = 'invalid-date-string'

    const { error } = timestampSchema.validate(invalidTimestamp)

    expect(error).toBeDefined()
  })
})

describe('zodSchema', () => {
  const zodSchema = z.object({
    name: z.string(),
    age: z.number().min(18),
  })

  const zodSchemaValidation = schema.object().zodSchema(zodSchema)

  it('should validate a valid object against the Zod schema', () => {
    const validObject = { name: 'John', age: 30 }
    const { error } = zodSchemaValidation.validate(validObject)

    expect(error).toBeUndefined()
  })

  it('should invalidate an object that does not match the Zod schema', () => {
    const invalidObject = { name: 'John', age: 17 }
    const { error } = zodSchemaValidation.validate(invalidObject)

    expect(error).toBeDefined()
    expect(error.details[0].message).toContain(
      'Number must be greater than or equal to 18'
    )
  })

  it('should invalidate an object with missing required fields', () => {
    const invalidObject = { age: 30 }
    const { error } = zodSchemaValidation.validate(invalidObject)

    expect(error).toBeDefined()
    expect(error.details[0].message).toContain('Required')
  })

  it('should validate an empty object if the Zod schema allows it', () => {
    const emptySchema = z.object({}).passthrough()
    const emptySchemaValidation = schema.object().zodSchema(emptySchema)
    const { error } = emptySchemaValidation.validate({})

    expect(error).toBeUndefined()
  })
})
