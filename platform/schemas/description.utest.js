import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import descriptionSchema from '@/schemas/description'

const itIfTextLengthIsConstrained =
  MAX_DB_TEXT_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('descriptionSchema', () => {
  it('should validate a valid description string', () => {
    const validDescription = 'This is a test description'
    const result = descriptionSchema.validate(validDescription)

    expect(result).toEqual({ value: validDescription })
  })

  it('should allow null values', () => {
    const result = descriptionSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = descriptionSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  itIfTextLengthIsConstrained(
    'should validate a string at maximum byte length',
    () => {
      // Create a string that is exactly at the byte limit
      const maxLengthString = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH)
      const result = descriptionSchema.validate(maxLengthString)

      expect(result).toEqual({ value: maxLengthString })
    }
  )

  itIfTextLengthIsConstrained(
    'should reject a string exceeding maximum byte length',
    () => {
      // Create a string that exceeds the byte limit
      const oversizedString = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH + 1)
      const result = descriptionSchema.validate(oversizedString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  itIfTextLengthIsConstrained(
    'should handle unicode characters correctly for byte length',
    () => {
      // Unicode characters can take multiple bytes
      // '🚀' takes 4 bytes in UTF-8
      const oversizedUnicodeString = '🚀'.repeat(
        Math.floor(MAX_DB_TEXT_BYTES_LENGTH / 4) + 1
      )
      const result = descriptionSchema.validate(oversizedUnicodeString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should accept unicode characters within byte limit', () => {
    // Use a reasonable size string with unicode characters
    const unicodeString = '🚀'.repeat(100)
    const result = descriptionSchema.validate(unicodeString)

    expect(result).toEqual({ value: unicodeString })
  })

  it('should reject non-string values', () => {
    const result = descriptionSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle long text descriptions', () => {
    const longDescription = 'This is a very long description. '.repeat(1000)
    const result = descriptionSchema.validate(longDescription)

    expect(result).toEqual({ value: longDescription })
  })
})
