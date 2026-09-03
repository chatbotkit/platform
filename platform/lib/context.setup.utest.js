/**
 * @jest-environment node
 */
import { setupHeadersContext, setupRequestContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextRequest,
  getContextRequestHost,
  getContextRequestIpAddress,
  getContextRequestProtocol,
  getContextRequestQuery,
  getContextRequestStartTime,
  getContextRequestUserAgent,
  getContextTimezone,
} from '@/lib/context.store'

const SECRET = '0123456789abcdef'
const ENV_KEYS = [
  'NODE_ENV',
  'TARGET_ENV',
  'VERCEL_URL',
  'NEXT_PUBLIC_VERCEL_URL',
  'INTERNAL_HEADERS_SECRET',
  'TRUST_PROXY_HEADERS',
  'HOSTS_CONFIG',
]

function setEnv(name, value) {
  if (value === undefined) {
    delete process.env[name]

    return
  }

  process.env[name] = value
}

async function withRuntime(
  { vercel, trustProxyHeaders = false, hostsConfig = {} },
  fn
) {
  const previousEnv = Object.fromEntries(
    ENV_KEYS.map((name) => [name, process.env[name]])
  )

  try {
    setEnv('NODE_ENV', 'test')
    setEnv('TARGET_ENV', 'test')
    setEnv('VERCEL_URL', vercel ? 'platform.example.com' : undefined)
    setEnv('NEXT_PUBLIC_VERCEL_URL', undefined)
    setEnv('INTERNAL_HEADERS_SECRET', SECRET)
    setEnv('TRUST_PROXY_HEADERS', trustProxyHeaders ? 'true' : undefined)
    setEnv('HOSTS_CONFIG', JSON.stringify(hostsConfig))

    jest.resetModules()

    let context
    let contextSetup
    let headerAssertion

    await jest.isolateModulesAsync(async () => {
      context = await import('@/lib/context.store')
      contextSetup = await import('@/lib/context.setup')
      headerAssertion = await import('@/lib/header.assertion')
    })

    await fn({ context, contextSetup, headerAssertion })
  } finally {
    for (const [name, value] of Object.entries(previousEnv)) {
      setEnv(name, value)
    }

    jest.resetModules()
  }
}

describe('context.setup', () => {
  describe('setupHeadersContext', () => {
    const hostsConfig = {
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

    it('should populate every header-derived context value', async () => {
      await executeInContext(async () => {
        const headers = new Headers({
          host: 'platform.example.com',
          'user-agent': 'Test Browser',
          'x-timezone': 'Europe/London',
        })

        setupHeadersContext(headers)

        expect(getContextRequestHost()).toBe('platform.example.com')
        expect(getContextRequestIpAddress()).toBeUndefined()
        expect(getContextRequestProtocol()).toBeNull()
        expect(getContextRequestUserAgent()).toBe('Test Browser')
        expect(getContextTimezone()).toBe('Europe/London')
      })
    })

    it('should ignore forwarded metadata outside a trusted proxy', async () => {
      await withRuntime(
        { vercel: false },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Request('https://origin.example.com/path', {
                headers: {
                  'x-forwarded-host': 'forwarded.example.com',
                  'x-forwarded-proto': 'http',
                  host: 'origin.example.com',
                },
              })
            )

            expect(context.getContextRequestHost()).toBe('origin.example.com')
            expect(context.getContextRequestProtocol()).toBe('https')
          })
        }
      )
    })

    it('should trust forwarded metadata when explicitly configured', async () => {
      await withRuntime(
        { vercel: false, trustProxyHeaders: true },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({
                'x-forwarded-host': 'forwarded.example.com',
                'x-forwarded-proto': 'http',
                host: 'origin.example.com',
              })
            )

            expect(context.getContextRequestHost()).toBe(
              'forwarded.example.com'
            )
            expect(context.getContextRequestProtocol()).toBe('http')
          })
        }
      )
    })

    it('should not trust forwarded metadata from provider detection alone', async () => {
      await withRuntime({ vercel: true }, async ({ context, contextSetup }) => {
        await context.executeInContext(async () => {
          contextSetup.setupHeadersContext(
            new Headers({
              'x-forwarded-host': 'forwarded.example.com',
              'x-forwarded-proto': 'https',
              host: 'origin.example.com',
            })
          )

          expect(context.getContextRequestHost()).toBe('origin.example.com')
          expect(context.getContextRequestProtocol()).toBeNull()
        })
      })
    })

    it('should ignore a malformed forwarded protocol', async () => {
      await withRuntime(
        { vercel: false, trustProxyHeaders: true },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Request('https://origin.example.com/path', {
                headers: {
                  'x-forwarded-proto': 'javascript',
                  host: 'origin.example.com',
                },
              })
            )

            expect(context.getContextRequestProtocol()).toBe('https')
          })
        }
      )
    })

    it('should fall back to the host header', async () => {
      await executeInContext(async () => {
        setupHeadersContext(new Headers({ host: 'localhost:3000' }))

        expect(getContextRequestHost()).toBe('localhost:3000')
      })
    })

    it('should reject a malformed forwarded host and use the host header', async () => {
      await executeInContext(async () => {
        setupHeadersContext(
          new Headers({
            'x-forwarded-host': 'attacker.example; frame-ancestors *',
            host: 'platform.example.com',
          })
        )

        expect(getContextRequestHost()).toBe('platform.example.com')
      })
    })

    it('should reject a malformed host header', async () => {
      await executeInContext(async () => {
        setupHeadersContext(
          new Headers({ host: 'attacker.example; frame-ancestors *' })
        )

        expect(getContextRequestHost()).toBeNull()
      })
    })

    it('should resolve configured hosts once while injecting context', async () => {
      await withRuntime(
        { vercel: false, hostsConfig },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({ host: 'api.example.com' })
            )

            expect(context.getContextFrontendHost()).toBe(
              'console.example.com'
            )
            expect(context.getContextAPIHost()).toBe('api.example.com')
            expect(context.getContextStaticHost()).toBe('static.example.com')
            expect(context.getContextWidgetHost()).toBe(
              'widgets.example.com'
            )
          })
        }
      )
    })

    it('should select hosts from the authenticated frontend assertion', async () => {
      await withRuntime(
        { vercel: false, hostsConfig },
        async ({ context, contextSetup, headerAssertion }) => {
          const headers = new Headers({ host: 'internal.example.com' })

          for (const [name, value] of Object.entries(
            headerAssertion.getInternalAssertionHeaders(
              { frontendHost: 'console.example.net' },
              SECRET
            )
          )) {
            headers.set(name, value)
          }

          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(headers)

            expect(context.getContextFrontendHost()).toBe(
              'console.example.net'
            )
            expect(context.getContextAPIHost()).toBe('api.example.net')
            expect(context.getContextStaticHost()).toBe('static.example.net')
            expect(context.getContextWidgetHost()).toBe(
              'widgets.example.net'
            )
          })
        }
      )
    })

    it('should leave service hosts unset for an unmatched host', async () => {
      await withRuntime(
        { vercel: false, hostsConfig },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({ host: 'customer.example.org' })
            )

            expect(context.getContextFrontendHost()).toBeUndefined()
            expect(context.getContextAPIHost()).toBeUndefined()
            expect(context.getContextStaticHost()).toBeUndefined()
            expect(context.getContextWidgetHost()).toBeUndefined()
          })
        }
      )
    })
  })

  describe('setupRequestContext', () => {
    it('should populate the request metadata and header context', async () => {
      await executeInContext(async () => {
        const request = new Request(
          'https://platform.example.com/path?q=test',
          {
            headers: {
              host: 'platform.example.com',
              'user-agent': 'Test Browser',
              'x-timezone': 'Europe/London',
            },
          }
        )

        const before = Date.now()

        setupRequestContext(request)

        expect(getContextRequest()).toBe(request)
        expect(getContextRequestStartTime()).toBeGreaterThanOrEqual(before)
        expect(getContextRequestHost()).toBe('platform.example.com')
        expect(getContextRequestIpAddress()).toBeUndefined()
        expect(getContextRequestProtocol()).toBe('https')
        expect(getContextRequestUserAgent()).toBe('Test Browser')
        expect(getContextRequestQuery()).toEqual(new Map([['q', 'test']]))
        expect(getContextTimezone()).toBe('Europe/London')
      })
    })
  })

  describe('request IP context trust', () => {
    it('should ignore client address headers outside a trusted proxy', async () => {
      await withRuntime(
        { vercel: false },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({
                'x-real-ip': '192.0.2.10',
                'x-forwarded-for': '192.0.2.11',
              })
            )

            expect(context.getContextRequestIpAddress()).toBeUndefined()
          })
        }
      )
    })

    it('should use x-real-ip when a self-hosted proxy is trusted', async () => {
      await withRuntime(
        { vercel: false, trustProxyHeaders: true },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({
                'x-real-ip': '192.0.2.10',
                'x-forwarded-for': '198.51.100.1, 192.0.2.11',
              })
            )

            expect(context.getContextRequestIpAddress()).toBe('192.0.2.10')
          })
        }
      )
    })

    it('should fall back to the last x-forwarded-for hop', async () => {
      await withRuntime(
        { vercel: false, trustProxyHeaders: true },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({
                'x-forwarded-for': 'spoofed, 198.51.100.1 , 192.0.2.11',
              })
            )

            expect(context.getContextRequestIpAddress()).toBe('192.0.2.11')
          })
        }
      )
    })

    it('should use x-real-ip when proxy headers are trusted', async () => {
      await withRuntime(
        { vercel: false, trustProxyHeaders: true },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({ 'x-real-ip': '192.0.2.10' })
            )

            expect(context.getContextRequestIpAddress()).toBe('192.0.2.10')
          })
        }
      )
    })

    it('should ignore a malformed trusted address', async () => {
      await withRuntime(
        { vercel: false, trustProxyHeaders: true },
        async ({ context, contextSetup }) => {
          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(
              new Headers({
                'x-real-ip': 'not-an-ip',
                'x-forwarded-for': 'also-not-an-ip',
              })
            )

            expect(context.getContextRequestIpAddress()).toBeUndefined()
          })
        }
      )
    })

    it('should prefer a signed address over the trusted proxy fallback', async () => {
      await withRuntime(
        { vercel: false, trustProxyHeaders: true },
        async ({ context, contextSetup, headerAssertion }) => {
          const headers = new Headers({ 'x-real-ip': '192.0.2.10' })

          for (const [name, value] of Object.entries(
            headerAssertion.getInternalAssertionHeaders(
              { realIp: '203.0.113.7' },
              SECRET
            )
          )) {
            headers.set(name, value)
          }

          await context.executeInContext(async () => {
            contextSetup.setupHeadersContext(headers)

            expect(context.getContextRequestIpAddress()).toBe('203.0.113.7')
          })
        }
      )
    })
  })
})
