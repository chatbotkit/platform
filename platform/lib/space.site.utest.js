import {
  SPACE_SITE_APEX,
  assertSpaceSiteSlug,
  getSpaceSiteSlug,
  isReservedSpaceSiteSlug,
  normalizeSpaceSiteSlug,
} from './space.site'

describe('getSpaceSiteSlug', () => {
  it('extracts the slug from a space-site host', () => {
    expect(getSpaceSiteSlug(`acme.${SPACE_SITE_APEX}`)).toBe('acme')
  })

  it('rejects hosts outside the space apex', () => {
    expect(getSpaceSiteSlug('acme.example.com')).toBeNull()
    expect(getSpaceSiteSlug(SPACE_SITE_APEX)).toBeNull()
  })

  it('rejects a multi-label subdomain', () => {
    expect(getSpaceSiteSlug(`a.b.${SPACE_SITE_APEX}`)).toBeNull()
  })
})

describe('isReservedSpaceSiteSlug', () => {
  it('reserves operational and platform slugs', () => {
    expect(isReservedSpaceSiteSlug('www')).toBe(true)
    expect(isReservedSpaceSiteSlug('api')).toBe(true)
    expect(isReservedSpaceSiteSlug('portal')).toBe(true)
  })

  it('allows an ordinary site slug', () => {
    expect(isReservedSpaceSiteSlug('acme')).toBe(false)
  })
})

describe('normalizeSpaceSiteSlug', () => {
  it('trims and lowercases the slug without appending the apex', () => {
    expect(normalizeSpaceSiteSlug('  ACME-Site ')).toBe('acme-site')
  })

  it('does not convert a hostname into a slug', () => {
    expect(normalizeSpaceSiteSlug('acme.example.com')).toBe('acme.example.com')
  })
})

describe('assertSpaceSiteSlug', () => {
  it('accepts valid DNS-label slugs', () => {
    expect(() => assertSpaceSiteSlug('acme')).not.toThrow()
    expect(() => assertSpaceSiteSlug('acme-site-2')).not.toThrow()
    expect(() => assertSpaceSiteSlug('a'.repeat(63))).not.toThrow()
  })

  it('rejects hostnames and invalid DNS labels', () => {
    expect(() => assertSpaceSiteSlug('acme.example.com')).toThrow(
      'Slug must be a valid DNS label'
    )
    expect(() => assertSpaceSiteSlug('-acme')).toThrow(
      'Slug must be a valid DNS label'
    )
    expect(() => assertSpaceSiteSlug('a'.repeat(64))).toThrow(
      'Slug must be a valid DNS label'
    )
  })

  it('rejects reserved slugs', () => {
    expect(() => assertSpaceSiteSlug('api')).toThrow('This slug is reserved')
  })
})
