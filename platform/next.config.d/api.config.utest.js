/* eslint-disable @typescript-eslint/no-require-imports */

// @note the module reads HOSTS_CONFIG once at load, through the shared
// hosts table, so each deployment shape here is loaded in isolation rather
// than by mutating an already-parsed config.

/**
 * Loads api.config with the given HOSTS_CONFIG table.
 *
 * @param {object|undefined} hosts - the mappings, or undefined for a deployment
 *   that sets no hostnames at all
 * @param {{API_URL?: string, SITE_URL?: string}} [scalars] - the scalar
 *   variables, unset unless given
 */
function loadConfig(hosts, scalars = {}) {
  let config

  jest.isolateModules(() => {
    if (hosts === undefined) {
      process.env.HOSTS_CONFIG = JSON.stringify({})
    } else {
      process.env.HOSTS_CONFIG = JSON.stringify(hosts)
    }

    for (const name of ['API_URL', 'SITE_URL']) {
      if (scalars[name] === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = scalars[name]
      }
    }

    config = require('./api.config').default
  })

  return config
}

/**
 * The single `has` host pattern a rule matches on, or undefined when the rule
 * is not host-gated.
 */
function hostPattern(rule) {
  return rule.has?.[0]?.value
}

const HOSTED = {
  primary: {
    match: ['console.example.com', 'api.example.com'],
    site: 'console.example.com',
    api: 'api.example.com',
    static: 'static.example.com',
    widgets: 'widgets.example.com',
  },
  secondary: {
    match: ['console.example.net', 'api.example.net'],
    site: 'console.example.net',
    api: 'api.example.net',
    static: 'static.example.net',
    widgets: 'widgets.example.net',
  },
}
const CUSTOM_SUBDOMAIN = {
  custom: {
    match: ['example.org', 'api.example.org'],
    site: 'example.org',
    api: 'api.example.org',
    static: 'static.example.org',
    widgets: 'widgets.example.org',
  },
}

describe('api.config', () => {
  const original = {
    HOSTS_CONFIG: process.env.HOSTS_CONFIG,
    API_URL: process.env.API_URL,
    SITE_URL: process.env.SITE_URL,
  }

  afterEach(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
  })

  describe('hosted deployment - several API hostnames', () => {
    it('gates the API rewrites on every named host', async () => {
      const { beforeFiles, fallback } = await loadConfig(HOSTED).rewrites()

      const capture = beforeFiles.find(
        (rule) => rule.destination === '/api/:path*'
      )

      expect(hostPattern(capture)).toBe(
        '(?<host>api\\.example\\.com|api\\.example\\.net)'
      )

      // the API root and the 404 fallback answer on the same hosts
      expect(
        hostPattern(beforeFiles.find((rule) => rule.destination === '/api'))
      ).toBe(hostPattern(capture))

      expect(
        hostPattern(fallback.find((rule) => rule.destination === '/api/404'))
      ).toBe(hostPattern(capture))
    })

    it('serves the clean /v1 CORS rule as well as /api/v1', async () => {
      const headers = await loadConfig(HOSTED).headers()

      expect(headers.map((rule) => rule.source)).toEqual([
        '/v1/:path*',
        '/api/v1/:path*',
      ])
    })
  })

  describe('custom API subdomain', () => {
    it('gates on the configured API host', async () => {
      const { beforeFiles } = await loadConfig(CUSTOM_SUBDOMAIN).rewrites()

      const capture = beforeFiles.find(
        (rule) => rule.destination === '/api/:path*'
      )

      expect(hostPattern(capture)).toBe('(?<host>api\\.example\\.org)')
    })
  })

  describe('API_URL scalar', () => {
    it('routes a dedicated API_URL alongside the configured targets', async () => {
      const { beforeFiles } = await loadConfig(CUSTOM_SUBDOMAIN, {
        API_URL: 'https://api.example.io',
        SITE_URL: 'https://example.org',
      }).rewrites()

      const capture = beforeFiles.find(
        (rule) => rule.destination === '/api/:path*'
      )

      expect(hostPattern(capture)).toBe(
        '(?<host>api\\.example\\.org|api\\.example\\.io)'
      )
    })

    it('routes a dedicated API_URL with no HOSTS_CONFIG at all', async () => {
      const { beforeFiles } = await loadConfig(undefined, {
        API_URL: 'https://api.example.com',
        SITE_URL: 'https://example.com',
      }).rewrites()

      const capture = beforeFiles.find(
        (rule) => rule.destination === '/api/:path*'
      )

      expect(hostPattern(capture)).toBe('(?<host>api\\.example\\.com)')
    })

    it('derives no routing from the single-domain meaning - API_URL equal to the site URL', async () => {
      const { beforeFiles, fallback } = await loadConfig(undefined, {
        API_URL: 'https://example.com',
        SITE_URL: 'https://example.com',
      }).rewrites()

      expect(beforeFiles.every((rule) => rule.has === undefined)).toBe(true)
      expect(fallback).toEqual([])
    })

    it('does not duplicate a host already named by HOSTS_CONFIG', async () => {
      const { beforeFiles } = await loadConfig(CUSTOM_SUBDOMAIN, {
        API_URL: 'https://api.example.org',
        SITE_URL: 'https://example.org',
      }).rewrites()

      const capture = beforeFiles.find(
        (rule) => rule.destination === '/api/:path*'
      )

      expect(hostPattern(capture)).toBe('(?<host>api\\.example\\.org)')
    })
  })

  describe('single-domain HOSTS_CONFIG mapping - API host equal to site host', () => {
    it('derives no routing from the mapping, only from dedicated API hosts', async () => {
      const { beforeFiles } = await loadConfig({
        single: {
          match: ['single.example.com'],
          site: 'single.example.com',
          api: 'single.example.com',
          static: 'single.example.com',
          widgets: 'single.example.com',
        },
        ...CUSTOM_SUBDOMAIN,
      }).rewrites()

      const capture = beforeFiles.find(
        (rule) => rule.destination === '/api/:path*'
      )

      expect(hostPattern(capture)).toBe('(?<host>api\\.example\\.org)')
    })
  })

  describe('single-domain deployment - no API host named', () => {
    it('emits no host-gated rewrites at all', async () => {
      const { beforeFiles, fallback } = await loadConfig(undefined).rewrites()

      // a rule that can never match is worse than no rule: it reads as
      // configured routing while silently doing nothing
      expect(beforeFiles.every((rule) => rule.has === undefined)).toBe(true)
      expect(fallback).toEqual([])
    })

    it('still serves the well-known endpoints, which are not host-gated', async () => {
      const { beforeFiles } = await loadConfig(undefined).rewrites()

      expect(beforeFiles.map((rule) => rule.source)).toEqual([
        '/.well-known/api-catalog',
        '/.well-known/microsoft-identity-association.json',
      ])
    })

    it('still serves CORS on /api/v1, the path every deployment has', async () => {
      const headers = await loadConfig(undefined).headers()

      expect(headers.map((rule) => rule.source)).toEqual(['/api/v1/:path*'])

      expect(headers[0].has).toBeUndefined()
    })
  })

  describe('CORS policy', () => {
    it.each([HOSTED, CUSTOM_SUBDOMAIN, undefined])(
      'is public and credential-free whatever the topology',
      async (hosts) => {
        const headers = await loadConfig(hosts).headers()

        const apiV1 = headers.find((rule) => rule.source === '/api/v1/:path*')

        const value = (key) =>
          apiV1.headers.find((header) => header.key === key)?.value

        expect(value('Access-Control-Allow-Origin')).toBe('*')

        // `*` is only safe because no credentials are allowed alongside it -
        // v1 authenticates by bearer token, never by cookie
        expect(value('Access-Control-Allow-Credentials')).toBeUndefined()

        expect(value('Access-Control-Allow-Headers')).toContain('Authorization')
      }
    )
  })
})
