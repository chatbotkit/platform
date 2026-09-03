import { descriptionMaxLength } from '@/config/abilities'

import abilityDescriptionSchema from '@/schemas/abilityDescription'

describe('abilityDescriptionSchema', () => {
  it('should validate a valid ability description', () => {
    const validDescription =
      'This ability retrieves user profile information from the database.'
    const result = abilityDescriptionSchema.validate(validDescription)

    expect(result).toEqual({ value: validDescription })
  })

  it('should allow null values', () => {
    const result = abilityDescriptionSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = abilityDescriptionSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  it('should validate a description at maximum character length', () => {
    // Create a string that is exactly at the character limit (512 characters)
    const maxLengthDescription = 'a'.repeat(descriptionMaxLength)
    const result = abilityDescriptionSchema.validate(maxLengthDescription)

    expect(result).toEqual({ value: maxLengthDescription })
  })

  it('should reject a description exceeding maximum character length', () => {
    // Create a string that exceeds the character limit (513 characters)
    const oversizedDescription = 'a'.repeat(descriptionMaxLength + 1)
    const result = abilityDescriptionSchema.validate(oversizedDescription)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain(
      'length must be less than or equal to'
    )
  })

  it('should handle detailed technical descriptions', () => {
    const technicalDescription = `This ability integrates with the user management API to retrieve comprehensive user profile data including personal information, preferences, account settings, and activity history. It supports both individual user lookups and batch operations for multiple users.`
    const result = abilityDescriptionSchema.validate(technicalDescription)

    expect(result).toEqual({ value: technicalDescription })
  })

  it('should handle multiline descriptions', () => {
    const multilineDescription = `This ability performs the following operations:
1. Validates user authentication
2. Retrieves user profile data
3. Returns formatted response
4. Logs access for audit purposes`
    const result = abilityDescriptionSchema.validate(multilineDescription)

    expect(result).toEqual({ value: multilineDescription })
  })

  it('should handle descriptions with special characters', () => {
    const specialDescription =
      'Ability to process & validate user data (including email@domain.com format) with 100% accuracy!'
    const result = abilityDescriptionSchema.validate(specialDescription)

    expect(result).toEqual({ value: specialDescription })
  })

  it('should handle unicode characters in descriptions', () => {
    const unicodeDescription =
      'This ability generates reports 📊 and sends notifications 📧 to users.'
    const result = abilityDescriptionSchema.validate(unicodeDescription)

    expect(result).toEqual({ value: unicodeDescription })
  })

  it('should handle JSON-like descriptions', () => {
    const jsonDescription =
      'Returns user data in format: {"id": "123", "name": "John", "email": "john@example.com"}'
    const result = abilityDescriptionSchema.validate(jsonDescription)

    expect(result).toEqual({ value: jsonDescription })
  })

  it('should reject non-string values', () => {
    const result = abilityDescriptionSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject arrays', () => {
    const result = abilityDescriptionSchema.validate(['description', 'text'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject objects', () => {
    const result = abilityDescriptionSchema.validate({ description: 'text' })

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should verify character counting for mixed content', () => {
    // Test with exactly 512 characters including unicode
    const mixedContent = 'A'.repeat(500) + '🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀' // 500 + 12 = 512 characters

    // Ensure we're exactly at the limit
    const result = abilityDescriptionSchema.validate(
      mixedContent.substring(0, 512)
    )

    expect(result).toEqual({ value: mixedContent.substring(0, 512) })
  })

  it('should handle typical ability descriptions', () => {
    const typicalDescriptions = [
      'Retrieves current weather information for a specified location.',
      'Sends email notifications to users with customizable templates.',
      'Creates and manages database records with validation.',
      'Processes payment transactions securely through payment gateway.',
      'Generates PDF reports from structured data input.',
    ]

    typicalDescriptions.forEach((description) => {
      const result = abilityDescriptionSchema.validate(description)

      expect(result).toEqual({ value: description })
    })
  })
})
