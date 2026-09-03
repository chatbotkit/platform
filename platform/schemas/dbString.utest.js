import { MAX_DB_STRING_BYTES_LENGTH } from '@/prisma/constraints'

import dbStringSchema from '@/schemas/dbString'

const itIfStringLengthIsConstrained =
  MAX_DB_STRING_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('dbStringSchema', () => {
  it('should validate a valid string', () => {
    const validString = 'This is a valid db string'
    const result = dbStringSchema.validate(validString)

    expect(result).toEqual({ value: validString })
  })

  it('should allow null values', () => {
    const result = dbStringSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = dbStringSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  itIfStringLengthIsConstrained(
    'should validate a string at maximum byte length',
    () => {
      // Create a string that is exactly at the byte limit (191 bytes)
      const maxLengthString = 'a'.repeat(MAX_DB_STRING_BYTES_LENGTH)
      const result = dbStringSchema.validate(maxLengthString)

      expect(result).toEqual({ value: maxLengthString })
    }
  )

  itIfStringLengthIsConstrained(
    'should reject a string exceeding maximum byte length',
    () => {
      // Create a string that exceeds the byte limit (192 bytes)
      const oversizedString = 'a'.repeat(MAX_DB_STRING_BYTES_LENGTH + 1)
      const result = dbStringSchema.validate(oversizedString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  itIfStringLengthIsConstrained(
    'should handle unicode characters correctly for byte length',
    () => {
      // Unicode characters can take multiple bytes
      // '🚀' takes 4 bytes in UTF-8
      const unicodeString = '🚀'.repeat(48) // 48 * 4 = 192 bytes (over limit)
      const result = dbStringSchema.validate(unicodeString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should accept unicode characters within byte limit', () => {
    // '🚀' takes 4 bytes, so 47 * 4 = 188 bytes (under limit)
    const unicodeString = '🚀'.repeat(47)
    const result = dbStringSchema.validate(unicodeString)

    expect(result).toEqual({ value: unicodeString })
  })

  it('should handle mixed ASCII and Unicode characters', () => {
    // Mix of ASCII and Unicode to test byte counting
    const mixedString = 'Test🚀Test🚀' // Test(4) + 🚀(4) + Test(4) + 🚀(4) = 16 bytes
    const result = dbStringSchema.validate(mixedString)

    expect(result).toEqual({ value: mixedString })
  })

  it('should reject non-string values except null', () => {
    const result = dbStringSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject arrays', () => {
    const result = dbStringSchema.validate(['test'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject objects', () => {
    const result = dbStringSchema.validate({ test: 'value' })

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle special characters within byte limit', () => {
    const specialChars = '@#$%^&*()_+-=[]{}|;:,.<>?'
    const result = dbStringSchema.validate(specialChars)

    expect(result).toEqual({ value: specialChars })
  })
})
