/** @jest-environment node */
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'

import { config } from './proxy'

async function loadProxy(apex, portalApex = '') {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SPACE_APEX: process.env.SPACE_APEX,
    PORTAL_APEX: process.env.PORTAL_APEX,
  }
  let proxy

  try {
    process.env.NODE_ENV = 'production'
    process.env.SPACE_APEX = apex
    process.env.PORTAL_APEX = portalApex
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
    const request = new NextRequest('http://localhost:3000/platform/fr/docs/', {
      headers: { host: 'test.space.localhost:3000' },
      nextConfig: {
        basePath: '/platform',
        i18n: { locales: ['en', 'fr'], defaultLocale: 'en' },
      },
    })

    expect(
      proxy(request).headers.get('x-middleware-request-x-cbk-space-site')
    ).toBe('1')
    expect(request.url).toBe('http://localhost:3000/platform/fr/docs/')
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
