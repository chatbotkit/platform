import { MAX_DB_MEDIUMTEXT_BYTES_LENGTH } from '@/prisma/constraints'

import backstorySchema from '@/schemas/backstory'

const itIfTextLengthIsConstrained =
  MAX_DB_MEDIUMTEXT_BYTES_LENGTH <= 20000000 ? it : it.skip

describe('backstorySchema', () => {
  it('should validate a valid backstory string', () => {
    const validBackstory = 'This is a chatbot backstory'
    const result = backstorySchema.validate(validBackstory)

    expect(result).toEqual({ value: validBackstory })
  })

  it('should allow null values', () => {
    const result = backstorySchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = backstorySchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  it('should validate a very large backstory within limits', () => {
    // Create a large string within the MEDIUMTEXT limit
    const largeBackstory = 'This is a very detailed chatbot backstory. '.repeat(
      10000
    )
    const result = backstorySchema.validate(largeBackstory)

    expect(result).toEqual({ value: largeBackstory })
  })

  itIfTextLengthIsConstrained(
    'should reject a string exceeding maximum byte length',
    () => {
      const oversizedString = 'a'.repeat(MAX_DB_MEDIUMTEXT_BYTES_LENGTH + 1)

      const result = backstorySchema.validate(oversizedString)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should handle multiline backstories', () => {
    const multilineBackstory = `You are a helpful assistant.
You should be polite and professional.
You have expertise in various topics.

Always provide accurate information.`
    const result = backstorySchema.validate(multilineBackstory)

    expect(result).toEqual({ value: multilineBackstory })
  })

  it('should handle special characters in backstory', () => {
    const backstoryWithSpecialChars =
      'You are a bot that speaks 🤖 and uses emojis! 😊'
    const result = backstorySchema.validate(backstoryWithSpecialChars)

    expect(result).toEqual({ value: backstoryWithSpecialChars })
  })

  it('should reject non-string values', () => {
    const result = backstorySchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle empty object input', () => {
    const result = backstorySchema.validate({})

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })
})
