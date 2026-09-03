import { apexesSchema } from '@/config/apexes'
import { hostsSchema } from '@/config/hosts'
import { originsSchema } from '@/config/origins'

describe('HOSTS_CONFIG host mappings', () => {
  const mapping = {
    match: [
      'example.com',
      'api.example.com',
      'static.example.com',
      'widgets.example.com',
    ],
    site: 'example.com',
    api: 'api.example.com',
    static: 'static.example.com',
    widgets: 'widgets.example.com',
  }

  it('accepts host mappings keyed by operator-defined names', () => {
    expect(() =>
      hostsSchema.parse({
        family: mapping,
        legacy: {
          match: ['legacy.example.com'],
          site: 'legacy.example.com',
          api: 'legacy.example.com',
          static: 'legacy.example.com',
          widgets: 'legacy.example.com',
        },
      })
    ).not.toThrow()
  })

  it.each(['match', 'site', 'api', 'static', 'widgets'])(
    'requires the %s field',
    (field) => {
      const incomplete = { ...mapping }

      delete incomplete[field]

      expect(() => hostsSchema.parse({ family: incomplete })).toThrow()
    }
  )

  it.each([
    'https://example.com',
    'example.com/',
    'example.com/path',
    '*.example.com',
  ])('rejects a malformed hostname: %s', (hostname) => {
    expect(() =>
      hostsSchema.parse({
        family: { ...mapping, site: hostname },
      })
    ).toThrow()
  })

  it('rejects duplicate matches across mappings', () => {
    expect(() =>
      hostsSchema.parse({
        family: mapping,
        duplicate: {
          ...mapping,
          match: ['example.com'],
        },
      })
    ).toThrow()
  })

  it.each([
    { family: { ...mapping, apps: 'apps.example.com' } },
    { family: { ...mapping, portal: 'example.agency' } },
  ])('rejects identity configuration %#', (table) => {
    expect(() => hostsSchema.parse(table)).toThrow()
  })
})

describe('apex environment schema', () => {
  it('accepts a fully populated environment', () => {
    const env = {
      APP_APEX: 'example.app',
      PORTAL_APEX: 'example.agency',
      SPACE_APEX: 'example.site',
      PARTNERS_APEX: 'example.partners',
    }

    expect(() => apexesSchema.parse(env)).not.toThrow()
  })
})

describe('origin environment schema', () => {
  it('accepts complete app shell origins', () => {
    const env = {
      APP_MAIN_ORIGIN: 'https://apps.example.com',
      APP_LABS_ORIGIN: 'https://labs.example.com',
    }

    expect(() => originsSchema.parse(env)).not.toThrow()
  })

  it('accepts omitted and explicitly disabled app shell origins', () => {
    expect(originsSchema.safeParse({}).success).toBe(true)
    expect(
      originsSchema.safeParse({
        APP_MAIN_ORIGIN: '',
        APP_LABS_ORIGIN: '',
      }).success
    ).toBe(true)
  })

  it.each([
    'apps.example.com',
    'https://apps.example.com/',
    'https://apps.example.com/path',
  ])('returns a validation failure for a non-origin value: %s', (value) => {
    expect(originsSchema.safeParse({ APP_MAIN_ORIGIN: value }).success).toBe(
      false
    )
  })

  it.each([
    'apps.example.com',
    'https://apps.example.com/',
    'https://apps.example.com/path',
  ])('rejects a non-origin value: %s', (value) => {
    expect(() => originsSchema.parse({ APP_MAIN_ORIGIN: value })).toThrow()
  })
})
