/* eslint-disable @typescript-eslint/no-require-imports */

function loadConfig(value) {
  let config

  jest.isolateModules(() => {
    process.env.ZONE_CONFIG = JSON.stringify(value)
    config = require('./zone.config').default
  })

  return config
}

describe('zone.config', () => {
  const original = process.env.ZONE_CONFIG

  afterEach(() => {
    process.env.ZONE_CONFIG = original
  })

  it('accepts the legacy single-zone object', async () => {
    const { beforeFiles } = await loadConfig({
      origin: 'https://marketing.example',
      hosts: ['example.com'],
      paths: ['/pricing'],
    }).rewrites()

    expect(beforeFiles).toContainEqual(
      expect.objectContaining({
        source: '/:slug(pricing)',
        destination: 'https://marketing.example/:slug',
      })
    )
    expect(beforeFiles).toContainEqual(
      expect.objectContaining({
        source: '/zone-static/:path*',
        destination: 'https://marketing.example/zone-static/:path*',
      })
    )
  })

  it('creates rewrites for every zone in an array', async () => {
    const { beforeFiles } = await loadConfig([
      {
        origin: 'https://marketing.example',
        hosts: ['example.com'],
        paths: ['/pricing'],
        assetPrefix: '/marketing-static',
      },
      {
        origin: 'https://docs.example',
        hosts: ['example.com'],
        paths: ['/docs'],
        assetPrefix: '/docs-static',
      },
    ]).rewrites()

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/:slug(pricing)',
          destination: 'https://marketing.example/:slug',
        }),
        expect.objectContaining({
          source: '/:slug(docs)',
          destination: 'https://docs.example/:slug',
        }),
        expect.objectContaining({
          source: '/marketing-static/:path*',
          destination: 'https://marketing.example/marketing-static/:path*',
        }),
        expect.objectContaining({
          source: '/docs-static/:path*',
          destination: 'https://docs.example/docs-static/:path*',
        }),
      ])
    )
  })
})
