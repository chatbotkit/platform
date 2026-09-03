import metaSchema from '@/schemas/meta'

describe('meta', () => {
  test('should accept a valid object with no meta', () => {
    const result = metaSchema.validate({})

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual({})
  })

  test('should accept a valid object with valid meta keys', () => {
    const input = {
      validKey: 'value',
      anotherValidKey: 123,
    }

    const result = metaSchema.validate(input)

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual(input)
  })

  test('should reject an object with meta keys starting with _', () => {
    const input = {
      _privateKey: 'secret',
    }

    const result = metaSchema.validate(input)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('is not allowed')
  })

  test('should allow null values', () => {
    const result = metaSchema.validate(null)

    expect(result.error).toBeUndefined()
    expect(result.value).toBeNull()
  })

  test('should handle complex objects correctly', () => {
    const input = {
      validKey: 'value',
      complexKey: {
        nestedKey: 'nestedValue',
        anotherNestedKey: 456,
      },
    }

    const result = metaSchema.validate(input)

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual(input)
  })

  test('should reject objects with multiple invalid meta keys', () => {
    const input = {
      _privateKey: 'secret',
      _anotherPrivateKey: 'hidden',
    }

    const result = metaSchema.validate(input)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('is not allowed')
  })
})
