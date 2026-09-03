import structstrSchema from '@/schemas/structstr'

describe('structstrSchema', () => {
  it('should validate null values', () => {
    const result = structstrSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = structstrSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  it('should validate valid structured string', () => {
    const validStructstr = 'validStructuredString'
    const result = structstrSchema.validate(validStructstr)

    expect(result).toEqual({ value: validStructstr })
  })

  it('should handle simple string values', () => {
    const simpleStrings = [
      'simple',
      'structured_string',
      'key:value',
      'type=example',
      'data[123]',
    ]

    simpleStrings.forEach((str) => {
      const result = structstrSchema.validate(str)

      expect(result).toEqual({ value: str })
    })
  })

  it('should reject non-string values', () => {
    const result = structstrSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject arrays', () => {
    const result = structstrSchema.validate(['string1', 'string2'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject objects', () => {
    const result = structstrSchema.validate({ key: 'value' })

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle special characters and symbols', () => {
    const specialChars = [
      'struct:str',
      'key=value&other=data',
      'data[0].field',
      'namespace/resource',
      'field_name-value',
    ]

    specialChars.forEach((str) => {
      const result = structstrSchema.validate(str)

      expect(result).toEqual({ value: str })
    })
  })

  it('should handle unicode characters', () => {
    const unicodeString = 'struct🚀string'
    const result = structstrSchema.validate(unicodeString)

    expect(result).toEqual({ value: unicodeString })
  })
})
