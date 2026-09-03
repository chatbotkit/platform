/* eslint-disable @typescript-eslint/no-require-imports */

function loadConfig(hosts, staticUrl = '') {
  let config

  jest.isolateModules(() => {
    process.env.HOSTS_CONFIG = JSON.stringify(hosts)
    process.env.SITE_URL = 'https://example.com'
    process.env.STATIC_URL = staticUrl

    config = require('./static.config').default
  })

  return config
}

function hostPattern(rule) {
  return rule.has?.[0]?.value
}

describe('static.config', () => {
  const originalHostsConfig = process.env.HOSTS_CONFIG
  const originalSiteUrl = process.env.SITE_URL
  const originalStaticUrl = process.env.STATIC_URL

  afterEach(() => {
    process.env.HOSTS_CONFIG = originalHostsConfig
    process.env.SITE_URL = originalSiteUrl
    process.env.STATIC_URL = originalStaticUrl
  })

  it('gates static rewrites on every configured static host', async () => {
    const config = loadConfig({
      family: {
        match: ['example.com', 'static.example.com'],
        site: 'example.com',
        api: 'api.example.com',
        static: 'static.example.com',
        widgets: 'widgets.example.com',
      },
      secondary: {
        match: ['legacy.example.com', 'static.legacy.example.com'],
        site: 'legacy.example.com',
        api: 'api.legacy.example.com',
        static: 'static.legacy.example.com',
        widgets: 'widgets.legacy.example.com',
      },
    })

    const { beforeFiles, fallback } = await config.rewrites()

    expect(hostPattern(beforeFiles[0])).toBe(
      '(?<host>static\\.example\\.com|static\\.legacy\\.example\\.com)'
    )
    expect(
      beforeFiles.every(
        (rule) => hostPattern(rule) === hostPattern(beforeFiles[0])
      )
    ).toBe(true)
    expect(hostPattern(fallback[0])).toBe(hostPattern(beforeFiles[0]))
  })

  it('includes the scalar static host with configured mappings', async () => {
    const config = loadConfig(
      {
        family: {
          match: ['example.com'],
          site: 'example.com',
          api: 'api.example.com',
          static: 'static.example.com',
          widgets: 'widgets.example.com',
        },
      },
      'https://assets.example.com'
    )

    const { beforeFiles } = await config.rewrites()

    expect(hostPattern(beforeFiles[0])).toBe(
      '(?<host>static\\.example\\.com|assets\\.example\\.com)'
    )
  })

  it('ignores the scalar static host when it is the site host', async () => {
    const { beforeFiles, fallback } = await loadConfig(
      {},
      'https://example.com'
    ).rewrites()

    expect(beforeFiles).toEqual([])
    expect(fallback).toEqual([])
  })

  it('ignores a HOSTS_CONFIG static host that is also a site host', async () => {
    const config = loadConfig({
      single: {
        match: ['single.example.com'],
        site: 'single.example.com',
        api: 'single.example.com',
        static: 'single.example.com',
        widgets: 'single.example.com',
      },
      family: {
        match: ['example.com'],
        site: 'example.com',
        api: 'api.example.com',
        static: 'static.example.com',
        widgets: 'widgets.example.com',
      },
    })

    const { beforeFiles } = await config.rewrites()

    expect(hostPattern(beforeFiles[0])).toBe('(?<host>static\\.example\\.com)')
  })

  it('emits no host-gated rules without a configured static host', async () => {
    const { beforeFiles, fallback } = await loadConfig({}).rewrites()

    expect(beforeFiles).toEqual([])
    expect(fallback).toEqual([])
  })
})
