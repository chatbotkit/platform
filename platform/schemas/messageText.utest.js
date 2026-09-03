import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import messageTextSchema from '@/schemas/messageText'

const itIfTextLengthIsConstrained =
  MAX_DB_TEXT_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('messageTextSchema', () => {
  it('should validate a valid message text', () => {
    const validText = 'This is a valid message text'
    const result = messageTextSchema.validate(validText)

    expect(result).toEqual({ value: validText })
  })

  it('should allow empty strings', () => {
    const result = messageTextSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  itIfTextLengthIsConstrained(
    'should validate a string at maximum byte length',
    () => {
      // Create a string that is exactly at the byte limit
      const maxLengthString = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH)
      const result = messageTextSchema.validate(maxLengthString)

      expect(result).toEqual({ value: maxLengthString })
    }
  )

  itIfTextLengthIsConstrained(
    'should reject a string exceeding maximum byte length',
    () => {
      // Create a string that exceeds the byte limit
      const oversizedString = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH + 1)
      const result = messageTextSchema.validate(oversizedString)

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
      const result = messageTextSchema.validate(oversizedUnicodeString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should accept unicode characters within byte limit', () => {
    // Use a reasonable size string with unicode characters
    const unicodeString = '🚀'.repeat(100)
    const result = messageTextSchema.validate(unicodeString)

    expect(result).toEqual({ value: unicodeString })
  })

  it('should handle multiline text', () => {
    const multilineText = `This is line one.
This is line two.
This is line three.`
    const result = messageTextSchema.validate(multilineText)

    expect(result).toEqual({ value: multilineText })
  })

  it('should reject null values', () => {
    const result = messageTextSchema.validate(null)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject non-string values', () => {
    const result = messageTextSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle special characters and symbols', () => {
    const textWithSymbols = 'Hello! @#$%^&*()_+ "quoted" text'
    const result = messageTextSchema.validate(textWithSymbols)

    expect(result).toEqual({ value: textWithSymbols })
  })
})
