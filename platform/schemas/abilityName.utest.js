import { nameMaxLength } from '@/config/abilities'

import abilityNameSchema from '@/schemas/abilityName'

describe('abilityNameSchema', () => {
  it('should validate a valid ability name', () => {
    const validName = 'Get User Information'
    const result = abilityNameSchema.validate(validName)

    expect(result).toEqual({ value: validName })
  })

  it('should allow null values', () => {
    const result = abilityNameSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = abilityNameSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  it('should validate a name at maximum character length', () => {
    // Create a string that is exactly at the character limit (256 characters)
    const maxLengthName = 'a'.repeat(nameMaxLength)
    const result = abilityNameSchema.validate(maxLengthName)

    expect(result).toEqual({ value: maxLengthName })
  })

  it('should reject a name exceeding maximum character length', () => {
    // Create a string that exceeds the character limit (257 characters)
    const oversizedName = 'a'.repeat(nameMaxLength + 1)
    const result = abilityNameSchema.validate(oversizedName)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain(
      'length must be less than or equal to'
    )
  })

  it('should handle unicode characters in ability names', () => {
    const unicodeName = 'Get Weather 🌤️ Information'
    const result = abilityNameSchema.validate(unicodeName)

    expect(result).toEqual({ value: unicodeName })
  })

  it('should handle special characters and spaces', () => {
    const specialName = 'Get User Profile & Settings (v2.0)'
    const result = abilityNameSchema.validate(specialName)

    expect(result).toEqual({ value: specialName })
  })

  it('should handle functional ability names', () => {
    const functionalNames = [
      'Send Email Notification',
      'Create Database Record',
      'Process Payment Transaction',
      'Generate PDF Report',
      'Upload File to Storage',
    ]

    functionalNames.forEach((name) => {
      const result = abilityNameSchema.validate(name)

      expect(result).toEqual({ value: name })
    })
  })

  it('should reject non-string values', () => {
    const result = abilityNameSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject arrays', () => {
    const result = abilityNameSchema.validate(['ability', 'name'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject objects', () => {
    const result = abilityNameSchema.validate({ name: 'ability' })

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle long descriptive names within limit', () => {
    const longName =
      'Advanced User Authentication and Authorization Management System Integration'
    const result = abilityNameSchema.validate(longName)

    expect(result).toEqual({ value: longName })
  })

  it('should verify character counting is correct for mixed content', () => {
    // Test with exactly 256 characters including unicode
    const mixedContent = 'A'.repeat(250) + '🚀🚀🚀' // 250 + 3 = 253 characters (unicode counts as 1 char each)
    const result = abilityNameSchema.validate(mixedContent)

    expect(result).toEqual({ value: mixedContent })
  })
})
