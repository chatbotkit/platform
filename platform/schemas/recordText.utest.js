import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import recordTextSchema from '@/schemas/recordText'

const itIfTextLengthIsConstrained =
  MAX_DB_TEXT_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('recordTextSchema', () => {
  it('should validate a valid record text', () => {
    const validText = 'This is a valid record text'
    const result = recordTextSchema.validate(validText)

    expect(result).toEqual({ value: validText })
  })

  it('should allow empty strings', () => {
    const result = recordTextSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  itIfTextLengthIsConstrained(
    'should validate a string at maximum byte length',
    () => {
      // Create a string that is exactly at the byte limit
      const maxLengthString = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH)
      const result = recordTextSchema.validate(maxLengthString)

      expect(result).toEqual({ value: maxLengthString })
    }
  )

  itIfTextLengthIsConstrained(
    'should reject a string exceeding maximum byte length',
    () => {
      // Create a string that exceeds the byte limit
      const oversizedString = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH + 1)
      const result = recordTextSchema.validate(oversizedString)

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
      const result = recordTextSchema.validate(oversizedUnicodeString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should accept unicode characters within byte limit', () => {
    // Use a reasonable size string with unicode characters
    const unicodeString = '🚀'.repeat(100)
    const result = recordTextSchema.validate(unicodeString)

    expect(result).toEqual({ value: unicodeString })
  })

  it('should handle structured data text', () => {
    const structuredText = JSON.stringify({
      speaker: 'User',
      message: 'Hello, how are you?',
      timestamp: '2023-01-01T10:00:00Z',
    })
    const result = recordTextSchema.validate(structuredText)

    expect(result).toEqual({ value: structuredText })
  })

  it('should reject null values', () => {
    const result = recordTextSchema.validate(null)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject non-string values', () => {
    const result = recordTextSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle record-like text formats', () => {
    const recordText =
      'timestamp:2023-01-01T10:00:00Z|speaker:Assistant|message:Hello there!'
    const result = recordTextSchema.validate(recordText)

    expect(result).toEqual({ value: recordText })
  })

  it('should handle array input', () => {
    const result = recordTextSchema.validate(['not', 'a', 'string'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })
})
