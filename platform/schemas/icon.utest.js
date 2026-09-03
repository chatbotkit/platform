import iconSchema from '@/schemas/icon'

describe('iconSchema', () => {
  it('should validate a valid icon format', async () => {
    const validIcon = ':rocket:'
    const result = await iconSchema.validateAsync(validIcon)

    expect(result).toEqual(validIcon)
  })

  it('should validate icons with underscores', async () => {
    const validIcon = ':thumbs_up:'
    const result = await iconSchema.validateAsync(validIcon)

    expect(result).toEqual(validIcon)
  })

  it('should validate icons with numbers', async () => {
    const validIcon = ':100:'
    const result = await iconSchema.validateAsync(validIcon)

    expect(result).toEqual(validIcon)
  })

  it('should allow null values', async () => {
    const result = await iconSchema.validateAsync(null)

    expect(result).toEqual(null)
  })

  it('should allow empty strings', async () => {
    const result = await iconSchema.validateAsync('')

    expect(result).toEqual('')
  })

  it('should reject invalid icon format without colons', async () => {
    const invalidIcon = 'rocket'

    await expect(iconSchema.validateAsync(invalidIcon)).rejects.toThrow(
      'Invalid icon'
    )
  })

  it('should reject icon format with only one colon', async () => {
    const invalidIcon = ':rocket'

    await expect(iconSchema.validateAsync(invalidIcon)).rejects.toThrow(
      'Invalid icon'
    )
  })

  it('should reject icon format with colon at the end only', async () => {
    const invalidIcon = 'rocket:'

    await expect(iconSchema.validateAsync(invalidIcon)).rejects.toThrow(
      'Invalid icon'
    )
  })

  it('should reject icons with special characters other than underscore', async () => {
    const invalidIcon = ':rock-et:'

    await expect(iconSchema.validateAsync(invalidIcon)).rejects.toThrow(
      'Invalid icon'
    )
  })

  it('should reject icons with spaces', async () => {
    const invalidIcon = ':rock et:'

    await expect(iconSchema.validateAsync(invalidIcon)).rejects.toThrow(
      'Invalid icon'
    )
  })

  it('should reject empty icon format', async () => {
    const invalidIcon = '::'

    await expect(iconSchema.validateAsync(invalidIcon)).rejects.toThrow(
      'Invalid icon'
    )
  })

  it('should reject non-string values', async () => {
    await expect(iconSchema.validateAsync(123)).rejects.toThrow()
  })

  it('should reject arrays', async () => {
    await expect(iconSchema.validateAsync([':rocket:'])).rejects.toThrow()
  })
})
