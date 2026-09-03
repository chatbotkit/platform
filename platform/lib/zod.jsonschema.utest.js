import { extractProperties, toJsonSchema } from '@/lib/zod.jsonschema'

import { z } from 'zod'

describe('toJsonSchema', () => {
  it('should convert simple Zod schema to JSON Schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const result = toJsonSchema(schema)

    expect(result.type).toBe('object')
    expect(result.properties.name).toMatchObject({ type: 'string' })
    expect(result.properties.age).toMatchObject({ type: 'number' })
  })

  it('should handle optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.required).toBeDefined()
    expect(result.properties.optional).toBeDefined()
  })

  it('should preserve null type fields (resolution is caller responsibility)', () => {
    const schema = z.object({
      name: z.string(),
      nullField: z.null(),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.name).toBeDefined()
    // @note null types are now preserved - caller is responsible for resolution
    expect(result.properties.nullField).toBeDefined()
    expect(result.properties.nullField.type).toBe('null')
  })

  it('should handle nullable fields', () => {
    const schema = z.object({
      name: z.string().nullable(),
    })

    const result = toJsonSchema(schema)

    // @note nullable creates anyOf with null, we preserve the raw output
    expect(result.properties.name).toBeDefined()
  })

  it('should exclude specified fields', () => {
    const schema = z.object({
      name: z.string(),
      secret: z.string(),
      internal: z.string(),
    })

    const result = toJsonSchema(schema, {
      excludeFields: ['secret', 'internal'],
    })

    expect(result.properties.name).toBeDefined()
    expect(result.properties.secret).toBeUndefined()
    expect(result.properties.internal).toBeUndefined()
  })

  it('should handle boolean fields', () => {
    const schema = z.object({
      enabled: z.boolean(),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.enabled).toMatchObject({ type: 'boolean' })
  })

  it('should handle integer fields', () => {
    const schema = z.object({
      count: z.number().int(),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.count).toMatchObject({ type: 'integer' })
  })

  it('should handle enum fields', () => {
    const schema = z.object({
      status: z.enum(['active', 'inactive', 'pending']),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.status).toBeDefined()
    expect(result.properties.status.enum).toEqual([
      'active',
      'inactive',
      'pending',
    ])
  })

  it('should handle nested objects', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        email: z.string(),
      }),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.user).toBeDefined()
    expect(result.properties.user.type).toBe('object')
  })

  it('should handle arrays', () => {
    const schema = z.object({
      tags: z.array(z.string()),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.tags).toBeDefined()
    expect(result.properties.tags.type).toBe('array')
  })

  it('should handle union types with null (common pattern)', () => {
    // @note this simulates the SecretConfig pattern: z.union([z.null(), z.object({...})])
    const schema = z.object({
      config: z.union([z.null(), z.object({ key: z.string() })]),
    })

    const result = toJsonSchema(schema)

    // @note the union with null should result in the field being processed
    // but type resolution from null is caller's responsibility
    expect(result.properties.config).toBeDefined()
  })

  it('should preserve descriptions', () => {
    const schema = z.object({
      name: z.string().describe('The name of the item'),
    })

    const result = toJsonSchema(schema)

    expect(result.properties.name.description).toBe('The name of the item')
  })

  it('should handle empty schema', () => {
    const schema = z.object({})

    const result = toJsonSchema(schema)

    expect(result.type).toBe('object')
    expect(result.properties).toEqual({})
  })
})

describe('extractProperties', () => {
  it('should return just the properties without wrapper', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const result = extractProperties(schema)

    expect(result.name).toBeDefined()
    expect(result.age).toBeDefined()
    expect(result.name.type).toBe('string')
    expect(result.age.type).toBe('number')
  })

  it('should respect options', () => {
    const schema = z.object({
      name: z.string(),
      secret: z.string(),
    })

    const result = extractProperties(schema, { excludeFields: ['secret'] })

    expect(result.name).toBeDefined()
    expect(result.secret).toBeUndefined()
  })
})
