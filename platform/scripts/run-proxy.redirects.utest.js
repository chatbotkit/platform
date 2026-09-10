/** @jest-environment node */
import { NextRequest } from 'next/server'

import { runScript } from '@/lib/script'

import { proxy as routeRequest } from '@/proxy'

import './run-proxy'

import http from 'http'
import { once } from 'node:events'

jest.mock('@/lib/script', () => ({
  runScript: jest.fn(),
  log: jest.fn(),
}))

jest.mock('@chatbotkit-dev/partners', () => ({
  __esModule: true,
  default: {
    fixture: { name: 'Fixture partner', domain: 'backend.example' },
  },
}))

const { handler } = runScript.mock.calls[0][0]

describe('local proxy redirects over HTTP', () => {
  let upstream
  let server
  let port

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      if (req.url === '/external') {
        res.writeHead(302, {
          location: 'https://accounts.example/signin?q=one',
        })
      } else if (req.url === '/other-port') {
        res.writeHead(307, {
          location: 'https://backend.example:9000/overview',
        })
      } else if (req.url === '/relative') {
        res.writeHead(302, { location: '/signin?callbackUrl=%2Foverview' })
      } else if (req.url === '/client-redirect') {
        res.writeHead(200, {
          'x-nextjs-redirect': 'https://backend.example:8085/overview?q=one',
        })
      } else if (req.url === '/action-redirect') {
        res.writeHead(303, {
          'x-action-redirect':
            'https://backend.example:8085/overview?q=one;replace',
        })
      } else if (req.url === '/external-action') {
        res.writeHead(303, {
          'x-action-redirect': 'https://accounts.example/signin;push',
        })
      } else if (req.url === '/network-relative') {
        res.writeHead(307, { location: '//backend.example:8085/overview' })
      } else if (req.url === '/double-slash') {
        res.writeHead(307, {
          location:
            'https://backend.example:8085//external.example/path?q=one#section',
        })
      } else {
        const response = routeRequest(
          new NextRequest(`https://localhost:8080${req.url}`, {
            headers: req.headers,
          })
        )

        res.writeHead(response.status, {
          ...Object.fromEntries(response.headers),
          ...(response.status === 308
            ? { refresh: `0;url=${response.headers.get('location')}` }
            : {}),
        })

        if (response.headers.has('x-middleware-next')) {
          res.end(
            JSON.stringify({
              host: req.headers.host,
              forwardedHost: req.headers['x-forwarded-host'],
              partner: response.headers.get(
                'x-middleware-request-x-cbk-partner'
              ),
            })
          )

          return
        }
      }

      res.end()
    })
    upstream.listen(0, '127.0.0.1')
    await once(upstream, 'listening')

    const createServer = jest.spyOn(http, 'createServer')

    try {
      await handler({
        host: 'backend.example:8085',
        port: '0',
        target: `http://127.0.0.1:${upstream.address().port}`,
      })
      server = createServer.mock.results[0].value
    } finally {
      createServer.mockRestore()
    }

    if (!server.listening) {
      await once(server, 'listening')
    }

    port = server.address().port
  })

  afterAll(async () => {
    await Promise.all(
      [server, upstream]
        .filter(Boolean)
        .map((socket) => new Promise((resolve) => socket.close(resolve)))
    )
  })

  function request(path = '/', headers = {}, method = 'GET') {
    return new Promise((resolve, reject) => {
      const req = http.request(
        `http://127.0.0.1:${port}${path}`,
        {
          method,
          headers: { host: `localhost:${port}`, ...headers },
        },
        (response) => {
          const chunks = []

          response.on('data', (chunk) => chunks.push(chunk))
          response.on('error', reject)
          response.on('end', () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks).toString(),
            })
          )
        }
      )

      req.on('error', reject)
      req.end()
    })
  }

  it.each([
    ['tunnel.example', 'https', 'https://tunnel.example'],
    ['tunnel.example:8443', 'https', 'https://tunnel.example:8443'],
    ['[::1]:9090', 'http', 'http://[::1]:9090'],
    ['tunnel.example:443', 'http', 'http://tunnel.example:443'],
    ['tunnel.example', 'https, http', 'https://tunnel.example'],
    ['tunnel.example', 'invalid', 'http://tunnel.example'],
    ['localhost:8085', 'https', 'https://tunnel.example'],
    ['localhost:8085', 'http', 'https://tunnel.example'],
  ])(
    'keeps partner redirects on the public origin %s',
    async (host, protocol, origin) => {
      const response = await request('/?q=one%20two&q=three', {
        host,
        'x-forwarded-proto': protocol,
        'x-forwarded-host': 'untrusted.example',
      })

      expect(response.status).toBe(307)

      const destination = new URL(response.headers.location, origin)

      expect(destination.href).toBe(`${origin}/overview?q=one%20two&q=three`)

      const followed = await request(destination.pathname, { host })

      expect(JSON.parse(followed.body)).toEqual({
        host: 'backend.example:8085',
        forwardedHost: 'backend.example:8085',
        partner: 'fixture',
      })
      expect(followed.headers['server-timing']).toContain('partner;desc=')
    }
  )

  it('keeps direct localhost requests on their actual HTTP port', async () => {
    const response = await request()

    expect(
      new URL(response.headers.location, `http://localhost:${port}`).href
    ).toBe(`http://localhost:${port}/overview`)
  })

  it('preserves POST redirect status and the public origin', async () => {
    const response = await request(
      '/',
      {
        host: 'tunnel.example',
        'x-forwarded-proto': 'https',
      },
      'POST'
    )

    expect(response.status).toBe(307)
    expect(response.headers.location).toBe('/overview')
  })

  it('translates both Location and Refresh on permanent redirects', async () => {
    const response = await request('/overview/?q=a%2Fb', {
      host: 'tunnel.example',
      'x-forwarded-proto': 'https',
    })

    expect(response.status).toBe(308)
    expect(response.headers.location).toBe('/overview?q=a%2Fb')
    expect(response.headers.refresh).toBe(`0;url=${response.headers.location}`)
  })

  it('translates absolute Next page-data redirects', async () => {
    const response = await request('/client-redirect', {
      host: 'tunnel.example',
      'x-forwarded-proto': 'https',
    })

    expect(response.headers['x-nextjs-redirect']).toBe('/overview?q=one')
  })

  it('translates Server Action redirects without changing navigation mode', async () => {
    const response = await request('/action-redirect', {
      host: 'tunnel.example',
      'x-forwarded-proto': 'https',
    })

    expect(response.status).toBe(303)
    expect(response.headers['x-action-redirect']).toBe(
      '/overview?q=one;replace'
    )
  })

  it('preserves external Server Action redirects', async () => {
    const response = await request('/external-action')

    expect(response.headers['x-action-redirect']).toBe(
      'https://accounts.example/signin;push'
    )
  })

  it('translates protocol-relative redirects to the simulated host', async () => {
    const response = await request('/network-relative', {
      host: 'tunnel.example',
      'x-forwarded-proto': 'https',
    })

    expect(response.headers.location).toBe('/overview')
  })

  it('keeps double-slash paths on the public origin and preserves fragments', async () => {
    const response = await request('/double-slash')
    const destination = new URL(
      response.headers.location,
      'https://tunnel.example'
    )

    expect(destination.origin).toBe('https://tunnel.example')
    expect(destination.pathname).toBe('//external.example/path')
    expect(destination.search).toBe('?q=one')
    expect(destination.hash).toBe('#section')
  })

  it.each([
    ['/external', 'https://accounts.example/signin?q=one'],
    ['/other-port', 'https://backend.example:9000/overview'],
    ['/relative', '/signin?callbackUrl=%2Foverview'],
  ])(
    'preserves unrelated and relative redirects at %s',
    async (path, expected) => {
      const response = await request(path)

      expect(response.headers.location).toBe(expected)
    }
  )
})
