/**
 * @jest-environment node
 */

import type * as SiteConfig from '@/config/site'

const ENV_KEYS = ['SITE_URL', 'STATIC_URL', 'WIDGET_URL', 'API_URL'] as const

function loadSite(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const name of ENV_KEYS) {
    if (env[name] === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = env[name]
    }
  }

  let seam!: typeof SiteConfig

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    seam = require('@/config/site')
  })

  return seam
}

describe('@/config/site origin normalization', () => {
  const originalEnv = Object.fromEntries(
    ENV_KEYS.map((name) => [name, process.env[name]])
  )

  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()

    for (const name of ENV_KEYS) {
      if (originalEnv[name] === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = originalEnv[name] as string
      }
    }

    jest.resetModules()
  })

  it('keeps bare origins untouched and stays silent', () => {
    const site = loadSite({
      SITE_URL: 'https://example.com',
      API_URL: 'https://api.example.com',
    })

    expect(site.siteUrl).toBe('https://example.com')
    expect(site.apiUrl).toBe('https://api.example.com')
    expect(warn).not.toHaveBeenCalled()
  })

  it('normalizes a path-carrying value to its origin and warns', () => {
    const site = loadSite({
      SITE_URL: 'https://example.com',
      API_URL: 'https://api.example.com/the/api',
    })

    expect(site.apiUrl).toBe('https://api.example.com')
    expect(site.apiHostname).toBe('api.example.com')
    expect(warn).toHaveBeenCalledWith(
      '[config/site] API_URL is not a bare origin - using https://api.example.com'
    )
  })

  it.each([
    ['SITE_URL', 'https://example.com/', 'https://example.com'],
    ['STATIC_URL', 'https://static.example.com/assets', 'https://static.example.com'],
    ['WIDGET_URL', 'https://widgets.example.com?x=1', 'https://widgets.example.com'],
    ['API_URL', 'https://api.example.com#frag', 'https://api.example.com'],
  ])('normalizes %s from %s', (name, value, expected) => {
    const site = loadSite({
      SITE_URL: 'https://example.com',
      [name]: value,
    })

    const exported = {
      SITE_URL: site.siteUrl,
      STATIC_URL: site.staticUrl,
      WIDGET_URL: site.widgetUrl,
      API_URL: site.apiUrl,
    }[name]

    expect(exported).toBe(expected)
    expect(warn).toHaveBeenCalledWith(
      `[config/site] ${name} is not a bare origin - using ${expected}`
    )
  })

  it('still rejects a value that is not a URL at all', () => {
    expect(() => loadSite({ SITE_URL: 'not-a-url' })).toThrow()
  })

  it('leaves unset optional values on their site URL fallback', () => {
    const site = loadSite({ SITE_URL: 'https://example.com' })

    expect(site.apiUrl).toBe('https://example.com')
    expect(site.staticUrl).toBe('https://example.com')
    expect(site.widgetUrl).toBe('https://example.com')
    expect(warn).not.toHaveBeenCalled()
  })
})
