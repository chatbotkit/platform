import slugSchema, { forbiddenWords, optionalSlug } from '@/schemas/slug'

describe('slugSchema', () => {
  it('should validate a valid slug', async () => {
    const validSlug = 'valid-test-slug'
    const result = await slugSchema.validateAsync(validSlug)

    expect(result).toEqual('valid-test-slug')
  })

  it('should convert text to slug format', async () => {
    const text = 'This Is A Test Title'
    const result = await slugSchema.validateAsync(text)

    expect(result).toEqual('this-is-a-test-title')
  })

  it('should handle special characters in text', async () => {
    const text = 'Test & Special Characters!'
    const result = await slugSchema.validateAsync(text)

    expect(result).toMatch(/test-special-characters/)
  })

  it('should reject empty strings', async () => {
    await expect(slugSchema.validateAsync('')).rejects.toThrow(
      'not allowed to be empty'
    )
  })

  it('should reject null values', async () => {
    await expect(slugSchema.validateAsync(null)).rejects.toThrow(
      'must be a string'
    )
  })

  it('should reject slugs that are too short', async () => {
    const shortSlug = 'abc'

    await expect(slugSchema.validateAsync(shortSlug)).rejects.toThrow()
  })

  it('should reject slugs that are too long', async () => {
    const longSlug = 'a'.repeat(129)

    await expect(slugSchema.validateAsync(longSlug)).rejects.toThrow()
  })

  it('should accept minimum length slug', async () => {
    const minSlug = 'abcde' // exactly 5 characters
    const result = await slugSchema.validateAsync(minSlug)

    expect(result).toEqual('abcde')
  })

  it('should accept maximum length slug', async () => {
    const maxSlug = 'a'.repeat(128) // exactly 128 characters
    const result = await slugSchema.validateAsync(maxSlug)

    expect(result).toEqual(maxSlug)
  })

  it('should reject slugs containing forbidden words', async () => {
    for (const forbiddenWord of forbiddenWords.slice(0, 3)) {
      // Test first 3 forbidden words
      const slugWithForbiddenWord = `test-${forbiddenWord}-slug`

      await expect(
        slugSchema.validateAsync(slugWithForbiddenWord)
      ).rejects.toThrow('Slug contains forbidden words')
    }
  })

  it('should reject chatbotkit in slug', async () => {
    const slugWithChatbotkit = 'test-chatbotkit-example'

    await expect(slugSchema.validateAsync(slugWithChatbotkit)).rejects.toThrow(
      'Slug contains forbidden words'
    )
  })

  it('should reject non-string values', async () => {
    await expect(slugSchema.validateAsync(123)).rejects.toThrow()
  })
})

describe('optionalSlug', () => {
  it('should validate a valid slug', async () => {
    const validSlug = 'valid-test-slug'
    const result = await optionalSlug.validateAsync(validSlug)

    expect(result).toEqual('valid-test-slug')
  })

  it('should return null for empty strings', async () => {
    const result = await optionalSlug.validateAsync('')

    expect(result).toBeNull()
  })

  it('should return null for null values', async () => {
    const result = await optionalSlug.validateAsync(null)

    expect(result).toBeNull()
  })

  it('should convert text to slug format', async () => {
    const text = 'Optional Test Title'
    const result = await optionalSlug.validateAsync(text)

    expect(result).toEqual('optional-test-title')
  })

  it('should reject slugs that are too short', async () => {
    const shortSlug = 'abc'

    await expect(optionalSlug.validateAsync(shortSlug)).rejects.toThrow()
  })

  it('should reject slugs containing forbidden words', async () => {
    const slugWithForbiddenWord = 'test-widget-slug'

    await expect(
      optionalSlug.validateAsync(slugWithForbiddenWord)
    ).rejects.toThrow('Slug contains forbidden words')
  })

  it('should handle undefined values', async () => {
    const result = await optionalSlug.validateAsync(undefined)

    expect(result).toBeNull()
  })
})
