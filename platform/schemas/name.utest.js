import { MAX_DB_STRING_BYTES_LENGTH } from '@/prisma/constraints'

import nameSchema from '@/schemas/name'

const itIfStringLengthIsConstrained =
  MAX_DB_STRING_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('nameSchema', () => {
  it('should validate a valid name string', () => {
    const validName = 'Test Name'
    const result = nameSchema.validate(validName)

    expect(result).toEqual({ value: validName })
  })

  it('should allow null values', () => {
    const result = nameSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = nameSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  itIfStringLengthIsConstrained(
    'should validate a string at maximum byte length',
    () => {
      // Create a string that is exactly at the byte limit (191 bytes)
      const maxLengthString = 'a'.repeat(191)
      const result = nameSchema.validate(maxLengthString)

      expect(result).toEqual({ value: maxLengthString })
    }
  )

  itIfStringLengthIsConstrained(
    'should reject a string exceeding maximum byte length',
    () => {
      // Create a string that exceeds the byte limit (192 bytes)
      const oversizedString = 'a'.repeat(192)
      const result = nameSchema.validate(oversizedString)

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
      const result = nameSchema.validate(unicodeString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should accept unicode characters within byte limit', () => {
    // '🚀' takes 4 bytes, so 47 * 4 = 188 bytes (under limit)
    const unicodeString = '🚀'.repeat(47)
    const result = nameSchema.validate(unicodeString)

    expect(result).toEqual({ value: unicodeString })
  })

  it('should reject non-string values', () => {
    const result = nameSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })
})
