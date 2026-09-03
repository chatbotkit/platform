import externalUrlSchema from '@/schemas/externalUrl'

describe('externalUrlSchema', () => {
  it('should validate a valid external URL', () => {
    const validUrl = 'https://example.com/'
    const result = externalUrlSchema.validate(validUrl)

    expect(result).toEqual({ value: validUrl })
  })

  it('should invalidate an invalid URL', () => {
    const invalidUrl = 'invalid-url'
    const result = externalUrlSchema.validate(invalidUrl)

    expect(result.error).toBeDefined()
  })

  it('should invalidate a valid URL with invalid scheme', () => {
    const invalidUrl = 'http://example.com'
    const result = externalUrlSchema.validate(invalidUrl)

    expect(result.error).toBeDefined()
  })

  it('should invalidate a valid URL with invalid domain', () => {
    const invalidUrl = 'https://example.invalid'
    const result = externalUrlSchema.validate(invalidUrl)

    expect(result.error).toBeDefined()
  })

  it('should invalidate a valid URL with reserved domain', () => {
    const invalidUrl = 'https://example.test'
    const result = externalUrlSchema.validate(invalidUrl)

    expect(result.error).toBeDefined()
  })

  it('should invalidate a valid URL with IP address', () => {
    const invalidUrl = 'https://423.45.67.89'
    const result = externalUrlSchema.validate(invalidUrl)

    expect(result.error).toBeDefined()
  })

  it('should invalidate a valid URL with non-HTTPS scheme', () => {
    const invalidUrl = 'ftp://example.com'
    const result = externalUrlSchema.validate(invalidUrl)

    expect(result.error).toBeDefined()
  })

  it('should invalidate an empty string', () => {
    const emptyUrl = ''
    const result = externalUrlSchema.validate(emptyUrl)

    expect(result.error).toBeDefined()
  })

  it('should be valid when the schema is modified to accept empty strings', () => {
    const modifiedSchema = externalUrlSchema.allow('')
    const emptyUrl = ''
    const result = modifiedSchema.validate(emptyUrl)

    expect(result).toEqual({ value: emptyUrl })
  })
})
