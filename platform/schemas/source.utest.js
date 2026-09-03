import sourceSchema from '@/schemas/source'

describe('sourceSchema', () => {
  it('should validate a valid source string', () => {
    const validSource = 'https://example.com/source'
    const result = sourceSchema.validate(validSource)

    expect(result).toEqual({ value: validSource })
  })

  it('should allow null values', () => {
    const result = sourceSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = sourceSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  it('should validate a string at maximum byte length (896 bytes)', () => {
    // Create a string that is exactly at the byte limit
    const maxLengthString = 'a'.repeat(896)
    const result = sourceSchema.validate(maxLengthString)

    expect(result).toEqual({ value: maxLengthString })
  })

  it('should reject a string exceeding maximum byte length', () => {
    // Create a string that exceeds the byte limit (897 bytes)
    const oversizedString = 'a'.repeat(897)
    const result = sourceSchema.validate(oversizedString)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('bytes long')
  })

  it('should handle unicode characters correctly for byte length', () => {
    // Unicode characters can take multiple bytes
    // '🚀' takes 4 bytes in UTF-8
    const unicodeString = '🚀'.repeat(225) // 225 * 4 = 900 bytes (over limit)
    const result = sourceSchema.validate(unicodeString)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('bytes long')
  })

  it('should accept unicode characters within byte limit', () => {
    // '🚀' takes 4 bytes, so 224 * 4 = 896 bytes (at limit)
    const unicodeString = '🚀'.repeat(224)
    const result = sourceSchema.validate(unicodeString)

    expect(result).toEqual({ value: unicodeString })
  })

  it('should handle URLs as source', () => {
    const urlSource = 'https://docs.example.com/api/reference'
    const result = sourceSchema.validate(urlSource)

    expect(result).toEqual({ value: urlSource })
  })

  it('should handle file paths as source', () => {
    const fileSource = '/path/to/document.pdf'
    const result = sourceSchema.validate(fileSource)

    expect(result).toEqual({ value: fileSource })
  })

  it('should handle document titles as source', () => {
    const titleSource = 'Important Document: Section 2.1'
    const result = sourceSchema.validate(titleSource)

    expect(result).toEqual({ value: titleSource })
  })

  it('should handle database references as source', () => {
    const dbSource = 'database:table:id:12345'
    const result = sourceSchema.validate(dbSource)

    expect(result).toEqual({ value: dbSource })
  })

  it('should reject non-string values', () => {
    const result = sourceSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject arrays', () => {
    const result = sourceSchema.validate(['source1', 'source2'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject objects', () => {
    const result = sourceSchema.validate({ url: 'https://example.com' })

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle special characters and spaces', () => {
    const specialSource =
      'Document: "Section 2.1 - User & Admin Guide" (Updated 2023)'
    const result = sourceSchema.validate(specialSource)

    expect(result).toEqual({ value: specialSource })
  })
})
