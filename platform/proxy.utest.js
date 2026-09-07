/** @jest-environment node */
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'

import { config } from './proxy'

jest.mock('@chatbotkit-dev/partners', () => ({
  __esModule: true,
  default:
    process.env.FIXTURE_EMPTY_PARTNERS === '1'
      ? {}
      : {
          acme: {
            id: 'private-account',
            name: 'Acme',
            domain: 'partner.example',
            auth: { allowGlobalLogin: true },
            email: { token: 'private-token' },
          },
        },
}))

async function loadProxy(apex, portalApex = '', appConfiguration = {}) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SPACE_APEX: process.env.SPACE_APEX,
    PORTAL_APEX: process.env.PORTAL_APEX,
    ...Object.fromEntries(
      Object.keys(appConfiguration).map((key) => [key, process.env[key]])
    ),
  }
  let proxy

  try {
    process.env.NODE_ENV = 'production'
    process.env.SPACE_APEX = apex
    process.env.PORTAL_APEX = portalApex
    Object.assign(process.env, appConfiguration)
    // @note reload the package catalogue as well as the routing configuration
    jest.resetModules()
    await jest.isolateModulesAsync(async () => {
      proxy = (await import('./proxy')).proxy
    })

    return proxy
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
  }
}

describe('runtime space host routing', () => {
  it('classifies a space host without rewriting its URL', async () => {
    const proxy = await loadProxy('space.localhost')
    const request = new NextRequest('http://localhost:3000/docs?q=one', {
      headers: {
        host: 'test.space.localhost:3000',
        'x-cbk-space-site': 'untrusted',
      },
    })
    const response = proxy(request)

    expect(response.headers.get('x-middleware-request-x-cbk-space-site')).toBe(
      '1'
    )
    expect(response.headers.get('x-middleware-request-x-cbk-portal')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(request.url).toBe('http://localhost:3000/docs?q=one')
  })

  it('classifies a space host independently of its base path and locale', async () => {
    const proxy = await loadProxy('space.localhost')
    const request = new NextRequest('http://localhost:3000/platform/fr/docs', {
      headers: { host: 'test.space.localhost:3000' },
      nextConfig: {
        basePath: '/platform',
        i18n: { locales: ['en', 'fr'], defaultLocale: 'en' },
      },
    })

    expect(
      proxy(request).headers.get('x-middleware-request-x-cbk-space-site')
    ).toBe('1')
    expect(request.url).toBe('http://localhost:3000/platform/fr/docs')
  })

  it('preserves the original host, path and query during classification', async () => {
    const proxy = await loadProxy('space.localhost')
    const request = new NextRequest(
      'http://localhost:3000/assets/a%20b.css?theme=dark',
      {
        headers: { host: 'TEST.space.localhost:3000' },
      }
    )
    const response = proxy(request)

    expect(response.headers.get('x-middleware-request-x-cbk-space-site')).toBe(
      '1'
    )
    expect(request.url).toBe(
      'http://localhost:3000/assets/a%20b.css?theme=dark'
    )
    expect(request.headers.get('host')).toBe('TEST.space.localhost:3000')
    expect(response.headers.get('location')).toBeNull()
  })

  it.each([
    'cbk.localhost:3000',
    'test.cbk-space.localhost:3000',
    'space.localhost:3000',
    'a.b.space.localhost:3000',
    'test.space.localhost.attacker.example',
    'test.notspace.localhost:3000',
  ])('leaves the unrelated host %s alone', async (host) => {
    const proxy = await loadProxy('space.localhost')
    const response = proxy(
      new NextRequest('http://localhost:3000/', { headers: { host } })
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(
      response.headers.get('x-middleware-request-x-cbk-space-site')
    ).toBeNull()
  })

  it('does not trust a forwarded host to select a public space', async () => {
    const proxy = await loadProxy('space.localhost')
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: {
          host: 'cbk.localhost:3000',
          'x-forwarded-host': 'test.space.localhost:3000',
        },
      })
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(
      response.headers.get('x-middleware-request-x-cbk-space-site')
    ).toBeNull()
  })

  it('does not infer a space host from the request URL without a Host header', async () => {
    const proxy = await loadProxy('space.localhost')
    const response = proxy(new NextRequest('http://test.space.localhost:3000/'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(
      response.headers.get('x-middleware-request-x-cbk-space-site')
    ).toBeNull()
  })

  it('disables routing when no space apex is configured', async () => {
    const proxy = await loadProxy('')
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { host: 'test.space.localhost:3000' },
      })
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(
      response.headers.get('x-middleware-request-x-cbk-space-site')
    ).toBeNull()
  })
})

describe('runtime portal host selection', () => {
  it.each([
    'test.portal.localhost:3000',
    'TEST.PORTAL.LOCALHOST:3000',
    'a.b.portal.localhost:3000',
  ])('selects portal rewrites for %s', async (host) => {
    const proxy = await loadProxy('space.localhost', 'portal.localhost')
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { host, 'x-cbk-portal': 'untrusted' },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-portal')).toBe('1')
    expect(response.headers.get('x-middleware-request-host')).toBe(host)
    expect(response.headers.get('location')).toBeNull()
  })

  it.each([
    'portal.localhost:3000',
    '.portal.localhost:3000',
    'test.cbk-portal.localhost:3000',
    'testXportal.localhost:3000',
    'test.portal.localhost.attacker.example',
    'custom.example.com',
  ])('removes a spoofed portal marker on %s', async (host) => {
    const proxy = await loadProxy('space.localhost', 'portal.localhost')
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: {
          host,
          'x-cbk-portal': '1',
          'x-forwarded-host': 'test.portal.localhost:3000',
        },
      })
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get('x-middleware-request-x-cbk-portal')).toBeNull()
  })

  it.each([
    '/',
    '/api/health',
    '/oauth/callback',
    '/_next/static/file.js',
    '/redirect/missing',
  ])(
    'sanitizes the portal marker on %s even when the path bypasses space routing',
    async (pathname) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          url: `http://localhost:3000${pathname}`,
        })
      ).toBe(true)

      const proxy = await loadProxy('space.localhost', '')
      const response = proxy(
        new NextRequest(`http://localhost:3000${pathname}`, {
          headers: { host: 'test.portal.localhost:3000', 'x-cbk-portal': '1' },
        })
      )

      expect(
        response.headers.get('x-middleware-request-x-cbk-portal')
      ).toBeNull()
    }
  )

  it('does not infer a portal host from the URL or forwarded headers', async () => {
    const proxy = await loadProxy('', 'portal.localhost')
    const response = proxy(
      new NextRequest('http://test.portal.localhost:3000/', {
        headers: {
          'x-cbk-portal': '1',
          'x-forwarded-host': 'test.portal.localhost:3000',
        },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-portal')).toBeNull()
  })
})

describe('runtime app host routing', () => {
  const appConfiguration = {
    APP_APEX: 'app.localhost',
    APP_MAIN_ORIGIN: 'https://apps.localhost:444',
    APP_LABS_ORIGIN: 'https://labs.localhost:445',
    APP_MANIFESTS_JSON: JSON.stringify([
      {
        slug: 'chat',
        start: '/apps/chat',
        name: 'Chat',
        description: 'Test app',
      },
    ]),
  }

  it.each([
    ['apps.localhost:3000', '1', null],
    ['LABS.LOCALHOST:3000', '1', null],
    ['CHAT.APP.LOCALHOST:3000', null, 'chat'],
  ])('classifies %s using runtime hostnames', async (host, shell, app) => {
    const proxy = await loadProxy(
      'space.localhost',
      'portal.localhost',
      appConfiguration
    )
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: {
          host,
          'x-cbk-app-shell': '1',
          'x-cbk-app': 'spoofed',
          'x-cbk-space-site': '1',
          'x-cbk-portal': '1',
        },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-app-shell')).toBe(
      shell
    )
    expect(response.headers.get('x-middleware-request-x-cbk-app')).toBe(app)
    expect(
      response.headers.get('x-middleware-request-x-cbk-space-site')
    ).toBeNull()
    expect(response.headers.get('x-middleware-request-x-cbk-portal')).toBeNull()
    expect(response.headers.get('x-middleware-request-host')).toBe(host)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it.each([
    'unknown.app.localhost',
    'app.localhost',
    'chatXapp.localhost',
    'chat.app.localhost.attacker.example',
    'a.chat.app.localhost',
    'child.apps.localhost',
    'cbk-apps.localhost',
    ':main.app.localhost',
  ])('does not route unregistered or unrelated host %s', async (host) => {
    const proxy = await loadProxy('', '', appConfiguration)
    const response = proxy(
      new NextRequest('http://localhost:3000/overview', {
        headers: {
          host,
          'x-cbk-app': 'chat',
          'x-cbk-app-shell': '1',
          'x-forwarded-host': 'chat.app.localhost',
        },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-app')).toBeNull()
    expect(
      response.headers.get('x-middleware-request-x-cbk-app-shell')
    ).toBeNull()
    expect(response.headers.get('location')).toBeNull()
  })

  it('disables app host routing when the apex and shell origins are empty', async () => {
    const proxy = await loadProxy('', '', {
      ...appConfiguration,
      APP_APEX: '',
      APP_MAIN_ORIGIN: '',
      APP_LABS_ORIGIN: '',
    })

    for (const host of [
      'chat.app.localhost',
      'apps.localhost',
      'labs.localhost',
    ]) {
      const response = proxy(
        new NextRequest('http://localhost:3000/', {
          headers: { host, 'x-cbk-app': 'chat', 'x-cbk-app-shell': '1' },
        })
      )

      expect(response.headers.get('x-middleware-request-x-cbk-app')).toBeNull()
      expect(
        response.headers.get('x-middleware-request-x-cbk-app-shell')
      ).toBeNull()
    }
  })

  it.each([
    ['', '/'],
    ['/platform', '/platform'],
  ])(
    'redirects app overview with base path %s',
    async (basePath, expectedPath) => {
      const proxy = await loadProxy('', '', appConfiguration)
      const response = proxy(
        new NextRequest(
          `http://localhost:3000${basePath}/overview?q=one%20two`,
          {
            headers: { host: 'chat.app.localhost:3000' },
            nextConfig: { basePath },
          }
        )
      )
      const destination = new URL(response.headers.get('location'))

      expect(response.status).toBe(307)
      expect(destination.origin).toBe('http://chat.app.localhost:3000')
      expect(destination.pathname).toBe(expectedPath)
      expect(destination.searchParams.get('q')).toBe('one two')
    }
  )

  it('canonicalizes the slash before redirecting app overview', async () => {
    const proxy = await loadProxy('', '', appConfiguration)
    const response = proxy(
      new NextRequest('https://internal.localhost:8080/platform/overview/', {
        headers: { host: 'chat.app.localhost:3000' },
        nextConfig: { basePath: '/platform' },
      })
    )

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      'https://chat.app.localhost:3000/platform/overview'
    )
  })

  it('does not redirect overview on a shell that overlaps an app host', async () => {
    const proxy = await loadProxy('', '', {
      ...appConfiguration,
      APP_MAIN_ORIGIN: 'http://chat.app.localhost:3000',
    })
    const response = proxy(
      new NextRequest('http://localhost:3000/overview', {
        headers: { host: 'chat.app.localhost:3000' },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-app-shell')).toBe(
      '1'
    )
    expect(response.headers.get('x-middleware-request-x-cbk-app')).toBeNull()
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('routing marker isolation', () => {
  it.each([
    ['test.space.localhost:3000', '1', null],
    ['test.portal.localhost:3000', null, '1'],
    ['cbk.localhost:3000', null, null],
  ])('replaces both markers for %s', async (host, space, portal) => {
    const proxy = await loadProxy('space.localhost', 'portal.localhost')
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { host, 'x-cbk-space-site': '1', 'x-cbk-portal': '1' },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-space-site')).toBe(
      space
    )
    expect(response.headers.get('x-middleware-request-x-cbk-portal')).toBe(
      portal
    )
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('assigns only the space marker when apexes overlap', async () => {
    const proxy = await loadProxy('space.localhost', 'space.localhost')
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { host: 'test.space.localhost:3000' },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-space-site')).toBe(
      '1'
    )
    expect(response.headers.get('x-middleware-request-x-cbk-portal')).toBeNull()
  })
})

describe('runtime partner routing', () => {
  it.each(['/signin', '/api/health', '/_next/static/test.js', '/favicon.ico'])(
    'removes a forged partner marker on %s',
    async (pathname) => {
      const proxy = await loadProxy('', '', {
        PARTNERS_APEX: 'partners.localhost',
      })
      const response = proxy(
        new NextRequest(`http://localhost:3000${pathname}`, {
          headers: {
            host: 'unrelated.example',
            'x-cbk-partner': 'acme',
            'x-forwarded-host': 'acme.partners.localhost',
            'x-cbk-host': 'partner.example',
          },
        })
      )

      expect(
        response.headers.get('x-middleware-request-x-cbk-partner')
      ).toBeNull()
      expect(response.headers.get('server-timing')).toBeNull()
    }
  )

  it('does not expose inherited catalogue properties as branding', async () => {
    const proxy = await loadProxy('', '', {
      PARTNERS_APEX: 'partners.localhost',
    })
    const response = proxy(
      new NextRequest('http://localhost:3000/signin', {
        headers: { host: 'constructor.partners.localhost' },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-partner')).toBe(
      'constructor'
    )
    expect(response.headers.get('server-timing')).toBeNull()
  })

  it('works with the empty public catalogue', async () => {
    const proxy = await loadProxy('', '', {
      PARTNERS_APEX: '',
      FIXTURE_EMPTY_PARTNERS: '1',
    })
    const response = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { host: 'partner.example', 'x-cbk-partner': 'acme' },
      })
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('server-timing')).toBeNull()
    expect(
      response.headers.get('x-middleware-request-x-cbk-partner')
    ).toBeNull()
  })

  it('preserves the base path, locale, query and public host in partner root redirects', async () => {
    const proxy = await loadProxy('', '', {
      PARTNERS_APEX: 'partners.localhost',
    })
    const response = proxy(
      new NextRequest('http://localhost:3000/platform/fr?q=one', {
        headers: { host: 'acme.partners.localhost:3000' },
        nextConfig: {
          basePath: '/platform',
          i18n: { locales: ['en', 'fr'], defaultLocale: 'en' },
        },
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://acme.partners.localhost:3000/platform/fr/overview?q=one'
    )

    const encoded = response.headers
      .get('server-timing')
      .match(/partner;desc="([^"]+)"/)[1]

    expect(JSON.parse(Buffer.from(encoded, 'base64').toString())).toEqual({
      name: 'Acme',
      whitelabel: false,
    })
  })
})

describe('runtime static host routing', () => {
  const configuration = {
    SITE_URL: 'https://example.com',
    STATIC_URL: 'https://assets.example.com',
    HOSTS_CONFIG: JSON.stringify({
      family: {
        match: ['example.com'],
        site: 'example.com',
        api: 'api.example.com',
        static: 'static.example.com',
        widgets: 'widgets.example.com',
      },
      secondary: {
        match: ['legacy.example.com'],
        site: 'legacy.example.com',
        api: 'api.legacy.example.com',
        static: 'static.legacy.example.com',
        widgets: 'widgets.legacy.example.com',
      },
      single: {
        match: ['single.example.com'],
        site: 'single.example.com',
        api: 'single.example.com',
        static: 'single.example.com',
        widgets: 'single.example.com',
      },
    }),
  }

  it.each([
    'assets.example.com',
    'static.example.com',
    'STATIC.LEGACY.EXAMPLE.COM:3000',
  ])(
    'selects scalar and mapped static targets for %s even outside match',
    async (host) => {
      const proxy = await loadProxy('', '', configuration)
      const response = proxy(
        new NextRequest('http://localhost:3000/signin', { headers: { host } })
      )

      expect(response.headers.get('x-middleware-request-x-cbk-static')).toBe(
        '1'
      )
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    }
  )

  it.each([
    'example.com',
    'legacy.example.com',
    'single.example.com',
    'api.example.com',
    'staticXexample.com',
    'static.example.com.attacker.example',
  ])(
    'does not apply static restrictions to %s or trust its supplied markers',
    async (host) => {
      const proxy = await loadProxy('', '', configuration)
      const response = proxy(
        new NextRequest('http://localhost:3000/signin', {
          headers: {
            host,
            'x-cbk-static': '1',
            'x-forwarded-host': 'static.example.com',
          },
        })
      )

      expect(
        response.headers.get('x-middleware-request-x-cbk-static')
      ).toBeNull()
    }
  )

  it.each(['', 'https://example.com'])(
    'leaves the site unrestricted when STATIC_URL is %s',
    async (staticUrl) => {
      const proxy = await loadProxy('', '', {
        SITE_URL: 'https://example.com',
        STATIC_URL: staticUrl,
        HOSTS_CONFIG: '',
      })
      const response = proxy(
        new NextRequest('https://example.com/', {
          headers: { host: 'example.com' },
        })
      )

      expect(
        response.headers.get('x-middleware-request-x-cbk-static')
      ).toBeNull()
      expect(response.headers.get('location')).toBeNull()
    }
  )

  it('excludes every mapped site host even when it is the scalar static target', async () => {
    const proxy = await loadProxy('', '', {
      ...configuration,
      STATIC_URL: 'https://legacy.example.com',
    })
    const response = proxy(
      new NextRequest('https://legacy.example.com/', {
        headers: { host: 'legacy.example.com' },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-static')).toBeNull()
  })

  it.each([
    '/api/health',
    '/_next/static/chunk.js',
    '/integrations/widget/v1.js',
    '/favicon.ico',
  ])(
    'removes forged static markers on the excluded path %s',
    async (pathname) => {
      const proxy = await loadProxy('', '', configuration)
      const response = proxy(
        new NextRequest(`https://example.com${pathname}`, {
          headers: { host: 'example.com', 'x-cbk-static': '1' },
        })
      )

      expect(
        response.headers.get('x-middleware-request-x-cbk-static')
      ).toBeNull()
    }
  )
})

describe('public redirect authority', () => {
  it.each([
    ['acme.partners.localhost', '/', '/overview'],
    ['acme.partners.localhost:8080', '/', '/overview'],
    ['chat.app.localhost', '/overview', '/'],
    ['chat.app.localhost:8080', '/overview', '/'],
  ])(
    'preserves the public host and port for %s',
    async (host, pathname, destination) => {
      const proxy = await loadProxy('', '', {
        PARTNERS_APEX: 'partners.localhost',
        APP_APEX: 'app.localhost',
      })
      const response = proxy(
        new NextRequest(`https://internal:3000${pathname}?q=one`, {
          headers: { host },
        })
      )

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        `https://${host}${destination}?q=one`
      )
    }
  )
})

describe('runtime API host routing', () => {
  const configuration = {
    SITE_URL: 'https://example.com',
    API_URL: 'https://api.scalar.example.com',
    HOSTS_CONFIG: JSON.stringify({
      family: {
        match: ['example.com'],
        site: 'example.com',
        api: 'api.example.com',
        static: 'static.example.com',
        widgets: 'widgets.example.com',
      },
      secondary: {
        match: ['legacy.example.com'],
        site: 'legacy.example.com',
        api: 'api.legacy.example.com',
        static: 'static.legacy.example.com',
        widgets: 'widgets.legacy.example.com',
      },
      single: {
        match: ['single.example.com'],
        site: 'single.example.com',
        api: 'single.example.com',
        static: 'single.example.com',
        widgets: 'single.example.com',
      },
    }),
  }

  it.each([
    'api.scalar.example.com',
    'api.example.com',
    'API.LEGACY.EXAMPLE.COM:3000',
  ])('selects the scalar and every mapped API target for %s', async (host) => {
    const proxy = await loadProxy('', '', configuration)
    const response = proxy(
      new NextRequest('http://internal:3000/v1/probe', { headers: { host } })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-api')).toBe('1')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toBe(
      'GET,POST'
    )
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'X-Requested-With, Accept, Content-Length, Content-Type, Authorization'
    )
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it.each([
    'example.com',
    'legacy.example.com',
    'single.example.com',
    'apiXexample.com',
    'api.example.com.attacker.example',
  ])('rejects forged API selection and CORS for %s', async (host) => {
    const proxy = await loadProxy('', '', configuration)
    const response = proxy(
      new NextRequest('http://internal:3000/v1/probe', {
        headers: {
          host,
          'x-cbk-api': '1',
          'x-forwarded-host': 'api.example.com',
        },
      })
    )

    expect(response.headers.get('x-middleware-request-x-cbk-api')).toBeNull()
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it.each(['', 'https://example.com', 'https://legacy.example.com'])(
    'excludes site hosts when API_URL is %s',
    async (apiUrl) => {
      const proxy = await loadProxy('', '', {
        ...configuration,
        API_URL: apiUrl,
      })

      for (const host of ['example.com', 'legacy.example.com']) {
        const response = proxy(
          new NextRequest(`https://${host}/v1/probe`, { headers: { host } })
        )

        expect(
          response.headers.get('x-middleware-request-x-cbk-api')
        ).toBeNull()
        expect(response.headers.get('access-control-allow-origin')).toBeNull()
      }
    }
  )

  it.each(['/v1', '/v1/', '/v1/probe', '/V1/probe'])(
    'applies the existing clean API CORS policy to %s',
    async (pathname) => {
      const proxy = await loadProxy('', '', configuration)
      const response = proxy(
        new NextRequest(`http://internal:3000${pathname}`, {
          headers: { host: 'api.example.com' },
          method: 'OPTIONS',
        })
      )

      expect(response.headers.get('access-control-allow-origin')).toBe('*')

      if (pathname.endsWith('/')) {
        expect(response.status).toBe(308)
        expect(response.headers.get('location')).toBe(
          'http://api.example.com/v1'
        )
      } else {
        expect(response.headers.get('x-middleware-next')).toBe('1')
      }
    }
  )

  it.each([
    '/',
    '/v10/probe',
    '/v1other',
    '/oauth/token',
    '/signin',
    '/_next/static/test.js',
  ])('does not broaden CORS to %s', async (pathname) => {
    const proxy = await loadProxy('', '', configuration)
    const response = proxy(
      new NextRequest(`http://internal:3000${pathname}`, {
        headers: { host: 'api.example.com' },
      })
    )

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('classifies CORS independently of base path and locale', async () => {
    const proxy = await loadProxy('', '', configuration)
    const response = proxy(
      new NextRequest('http://internal:3000/platform/fr/v1/probe', {
        headers: { host: 'api.example.com' },
        nextConfig: {
          basePath: '/platform',
          i18n: { locales: ['en', 'fr'], defaultLocale: 'en' },
        },
      })
    )

    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('runtime browser security host selection', () => {
  it('leaves manuals paths to the deployment routing table', async () => {
    const proxy = await loadProxy('', '', { API_URL: '', HOSTS_CONFIG: '' })

    for (const pathname of ['/manuals', '/manuals/api/example']) {
      const response = proxy(
        new NextRequest(`https://example.com${pathname}`, {
          headers: { host: 'example.com' },
        })
      )

      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    }
  })

  it.each(['gateway.example.com', 'api.example.com'])(
    'exempts the configured API host %s',
    async (host) => {
      const proxy = await loadProxy('', '', {
        SITE_URL: 'https://example.com',
        API_URL: `https://${host}`,
        HOSTS_CONFIG: '',
      })
      const response = proxy(
        new NextRequest(`https://${host}/v1/probe`, { headers: { host } })
      )

      expect(response.headers.get('content-security-policy')).toBeNull()
      expect(response.headers.get('x-frame-options')).toBeNull()
      expect(response.headers.get('x-content-type-options')).toBeNull()
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    }
  )

  it('protects a shared site/API host even with an api prefix', async () => {
    const proxy = await loadProxy('', '', {
      SITE_URL: 'https://api.example.com',
      API_URL: 'https://api.example.com',
      HOSTS_CONFIG: '',
    })
    const response = proxy(
      new NextRequest('https://api.example.com/signin', {
        headers: { host: 'api.example.com', 'x-cbk-api': '1' },
      })
    )

    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'self'"
    )
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })

  it('does not accept a forwarded API host or forged marker to disable browser protections', async () => {
    const proxy = await loadProxy('', '', {
      SITE_URL: 'https://example.com',
      API_URL: 'https://gateway.example.com',
      HOSTS_CONFIG: '',
    })
    const response = proxy(
      new NextRequest('https://example.com/signin', {
        headers: {
          host: 'example.com',
          'x-forwarded-host': 'gateway.example.com',
          'x-cbk-api': '1',
        },
      })
    )

    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'self'"
    )
  })

  it('selects the embedding policy after removing the base path and locale', async () => {
    const proxy = await loadProxy('', '', { API_URL: '', HOSTS_CONFIG: '' })
    const response = proxy(
      new NextRequest(
        'http://localhost:3000/platform/fr/integrations/widget/demo/frame',
        {
          headers: { host: 'example.com' },
          nextConfig: {
            basePath: '/platform',
            i18n: { locales: ['en', 'fr'], defaultLocale: 'en' },
          },
        }
      )
    )

    expect(response.headers.get('x-frame-options')).toBeNull()
    expect(response.headers.get('content-security-policy')).toContain(
      'frame-ancestors * capacitor: ionic:'
    )
  })
})
