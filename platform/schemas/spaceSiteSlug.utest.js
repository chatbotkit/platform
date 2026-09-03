import spaceSiteSlugSchema from './spaceSiteSlug'

describe('spaceSiteSlugSchema', () => {
  it('accepts a valid slug', () => {
    const { error, value } = spaceSiteSlugSchema.validate('acme-site')

    expect(error).toBeUndefined()
    expect(value).toBe('acme-site')
  })

  it('trims and lowercases the slug', () => {
    const { error, value } = spaceSiteSlugSchema.validate('  ACME-Site  ')

    expect(error).toBeUndefined()
    expect(value).toBe('acme-site')
  })

  it('rejects a slug longer than one DNS label', () => {
    const { error } = spaceSiteSlugSchema.validate('a'.repeat(64))

    expect(error).toBeDefined()
  })

  it('rejects a non-string value', () => {
    const { error } = spaceSiteSlugSchema.validate(42)

    expect(error).toBeDefined()
  })
})
