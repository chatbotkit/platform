/* eslint-disable @typescript-eslint/no-require-imports */

function loadConfig(hosts) {
  let config

  jest.isolateModules(() => {
    process.env.HOSTS_CONFIG = JSON.stringify(hosts)

    config = require('./actions.config').default
  })

  return config
}

describe('actions.config', () => {
  const original = process.env.HOSTS_CONFIG

  afterEach(() => {
    process.env.HOSTS_CONFIG = original
  })

  it('allows every configured match host', () => {
    const config = loadConfig({
      family: {
        match: ['example.com', 'api.example.com', 'static.example.com'],
        site: 'example.com',
        api: 'api.example.com',
        static: 'static.example.com',
        widgets: 'widgets.example.com',
      },
      legacy: {
        match: ['legacy.example.com'],
        site: 'legacy.example.com',
        api: 'api.legacy.example.com',
        static: 'static.legacy.example.com',
        widgets: 'widgets.legacy.example.com',
      },
    })

    expect(config.experimental.serverActions.allowedOrigins).toEqual(
      expect.arrayContaining([
        'example.com',
        'api.example.com',
        'static.example.com',
        'legacy.example.com',
      ])
    )
  })
})
