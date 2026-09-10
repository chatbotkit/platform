/* eslint-disable @typescript-eslint/no-require-imports */
import { siteUrl } from '@/config/site'

const externalAPIHostCases = [
  {
    name: 'production maps chatbotkit.com to api.chatbotkit.com',
    targetEnv: 'production',
    testSiteUrl: 'https://chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: null,
    expectedHost: 'api.chatbotkit.com',
  },
  {
    name: 'production maps next.chatbotkit.com to api.chatbotkit.com',
    targetEnv: 'production',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: null,
    expectedHost: 'api.chatbotkit.com',
  },
  {
    name: 'production keeps api.chatbotkit.com on api.chatbotkit.com',
    targetEnv: 'production',
    testSiteUrl: 'https://api.chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: null,
    expectedHost: 'api.chatbotkit.com',
  },
  {
    name: 'production keeps unrelated request hosts unchanged',
    targetEnv: 'production',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: 'someother.com',
    expectedHost: 'someother.com',
  },
  {
    name: 'production keeps agency request hosts unchanged',
    targetEnv: 'production',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: 'slug.chatbotkit.agency',
    expectedHost: 'slug.chatbotkit.agency',
  },
  {
    name: 'staging maps chatbotkit.com to next.chatbotkit.com',
    targetEnv: 'staging',
    testSiteUrl: 'https://chatbotkit.com',
    apiUrl: 'https://next.chatbotkit.com',
    requestHost: null,
    expectedHost: 'next.chatbotkit.com',
  },
  {
    name: 'staging maps api.chatbotkit.com to next.chatbotkit.com',
    targetEnv: 'staging',
    testSiteUrl: 'https://api.chatbotkit.com',
    apiUrl: 'https://next.chatbotkit.com',
    requestHost: null,
    expectedHost: 'next.chatbotkit.com',
  },
  {
    name: 'staging keeps next.chatbotkit.com on next.chatbotkit.com',
    targetEnv: 'staging',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://next.chatbotkit.com',
    requestHost: null,
    expectedHost: 'next.chatbotkit.com',
  },
  {
    name: 'staging keeps unrelated request hosts unchanged',
    targetEnv: 'staging',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://next.chatbotkit.com',
    requestHost: 'someother.com',
    expectedHost: 'someother.com',
  },
  {
    name: 'staging keeps partner request hosts unchanged',
    targetEnv: 'staging',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://next.chatbotkit.com',
    requestHost: 'slug.chatbotkit.partners',
    expectedHost: 'slug.chatbotkit.partners',
  },
]

const externalAPIHostURLCases = [
  {
    name: 'production resolves chatbotkit.com to api.chatbotkit.com URLs',
    targetEnv: 'production',
    testSiteUrl: 'https://chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: null,
    path: '/v1/models',
    expectedUrl: 'https://api.chatbotkit.com/v1/models',
  },
  {
    name: 'production resolves chatbotkit.com protected-resource URLs to api.chatbotkit.com',
    targetEnv: 'production',
    testSiteUrl: 'https://chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: null,
    path: '/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp',
    expectedUrl:
      'https://api.chatbotkit.com/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp',
  },
  {
    name: 'production resolves next.chatbotkit.com to api.chatbotkit.com URLs',
    targetEnv: 'production',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: null,
    path: '/v1/models?type=chat',
    expectedUrl: 'https://api.chatbotkit.com/v1/models?type=chat',
  },
  {
    name: 'production keeps agency request hosts on their own API path',
    targetEnv: 'production',
    testSiteUrl: 'https://next.chatbotkit.com',
    apiUrl: 'https://api.chatbotkit.com',
    requestHost: 'slug.chatbotkit.agency',
    path: '/v1/models',
    expectedUrl: 'https://slug.chatbotkit.agency/api/v1/models',
  },
  {
    name: 'staging resolves chatbotkit.com to next.chatbotkit.com URLs',
    targetEnv: 'staging',
    testSiteUrl: 'https://chatbotkit.com',
    apiUrl: 'https://next.chatbotkit.com',
    requestHost: null,
    path: '/v1/models',
    expectedUrl: 'https://next.chatbotkit.com/api/v1/models',
  },
]

const ENV_KEYS = [
  'HOSTS_CONFIG',
  'NODE_ENV',
  'TARGET_ENV',
  'VERCEL_ENV',
  'VERCEL_URL',
  'NEXT_PUBLIC_VERCEL_URL',
  'SITE_URL',
  'NGROK_HOST',
  'LOCAL_HOST',
  'EXTERNAL_HOST',
  'API_URL',
  'STATIC_URL',
  'WIDGET_URL',
  '_ITEST_CHATBOTKIT_BASE_URL',
]

function setEnv(key, value) {
  if (value === undefined) {
    delete process.env[key]

    return
  }

  process.env[key] = value
}

function loadHostScenario({
  nodeEnv = 'production',
  targetEnv = 'production',
  testSiteUrl = siteUrl,
  requestHost = null,
  requestProtocol = null,
  frontendHost = null,
  contextAPIHost,
  contextStaticHost,
  contextWidgetHost,
  ngrokHost,
  localHost,
  externalHost,
  apiUrl,
  testStaticUrl,
  testWidgetUrl,
  integrationTestBaseUrl,
  hostsConfig,
} = {}) {
  const previousEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  )

  let hostModule

  try {
    setEnv('NODE_ENV', nodeEnv)
    setEnv('TARGET_ENV', targetEnv)
    setEnv('VERCEL_ENV', undefined)
    setEnv('VERCEL_URL', undefined)
    setEnv('NEXT_PUBLIC_VERCEL_URL', undefined)
    setEnv('SITE_URL', testSiteUrl)
    setEnv('NGROK_HOST', ngrokHost)
    setEnv('LOCAL_HOST', localHost)
    setEnv('EXTERNAL_HOST', externalHost)
    setEnv('API_URL', apiUrl)
    setEnv('STATIC_URL', testStaticUrl)
    setEnv('WIDGET_URL', testWidgetUrl)
    setEnv('_ITEST_CHATBOTKIT_BASE_URL', integrationTestBaseUrl)
    setEnv('HOSTS_CONFIG', hostsConfig ? JSON.stringify(hostsConfig) : undefined)

    jest.resetModules()

    jest.isolateModules(() => {
      jest.doMock('@/lib/context.store', () => ({
        ...jest.requireActual('@/lib/context.store'),
        getContextFrontendHost: jest.fn(() => frontendHost),
        getContextRequestHost: jest.fn(() => requestHost),
        getContextRequestProtocol: jest.fn(() => requestProtocol),
        getContextAPIHost: jest.fn(() => contextAPIHost),
        getContextStaticHost: jest.fn(() => contextStaticHost),
        getContextWidgetHost: jest.fn(() => contextWidgetHost),
      }))

      hostModule = require('@/lib/host')
    })

    return hostModule
  } finally {
    ENV_KEYS.forEach((key) => setEnv(key, previousEnv[key]))
    jest.resetModules()
  }
}

describe('host selection', () => {
  it.each(['api.brand.example:8080', 'other.brand.example'])(
    'does not infer HTTP from a different request host %s',
    (requestHost) => {
      const host = loadHostScenario({
        testSiteUrl: 'http://console.example',
        requestHost,
        requestProtocol: 'http',
        frontendHost: 'api.brand.example:80',
      })

      expect(host.getExternalFrontendHostURL('/hub/demo')).toBe(
        'https://api.brand.example:80/hub/demo'
      )
    }
  )

  it.each(['api.brand.example', 'api.brand.example:80'])(
    'normalizes the default HTTP port against request host %s',
    (requestHost) => {
      const host = loadHostScenario({
        testSiteUrl: 'http://console.example',
        requestHost,
        requestProtocol: 'http',
        frontendHost: 'api.brand.example:80',
        contextAPIHost: 'api.brand.example:80',
      })

      expect(host.getExternalFrontendHostURL('/hub/demo')).toBe(
        'http://api.brand.example/hub/demo'
      )
      expect(host.getExternalAPIHostURL('/v1/models')).toBe(
        'http://api.brand.example/api/v1/models'
      )
    }
  )

  it.each([
    'platform.example.com',
    'api.platform.example.com',
    'next.platform.example.com',
  ])('preserves explicit hostname API mappings for %s', (explicitHost) => {
    const host = loadHostScenario({
      testSiteUrl: 'https://platform.example.com:8443',
      apiUrl: 'https://api.platform.example.com:9443',
    })

    expect(host.getExternalAPIHost(explicitHost)).toBe(
      'api.platform.example.com:9443'
    )
    expect(
      host.getExternalAPIHostURL(
        '/v1/models',
        host.getExternalAPIHost(explicitHost)
      )
    ).toBe('https://api.platform.example.com:9443/v1/models')
  })

  it.each([
    'http://cbk.localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
    'http://platform.internal:3000',
    'https://platform.example.com:8443',
  ])(
    'preserves the configured port without a request for %s',
    (testSiteUrl) => {
      const host = loadHostScenario({ testSiteUrl })
      const route = '/api/system/clock/queue'
      const expectedUrl = `${testSiteUrl}${route}`

      expect(host.getLocalAPIHostURL(route)).toBe(expectedUrl)
      expect(host.getLocalHost()).toBe(new URL(testSiteUrl).host)
      expect(host.getExternalHost()).toBe(new URL(testSiteUrl).host)
      expect(host.getLocalHostURL(route)).toBe(expectedUrl)
      expect(host.getExternalHostURL(route)).toBe(expectedUrl)
      expect(host.getExternalFrontendHostURL(route)).toBe(expectedUrl)
      expect(host.getExternalAPIHostURL(route)).toBe(expectedUrl)
    }
  )

  it.each([null, 'platform.example.com:8443'])(
    'keeps the configured API origin for a site with a port and request host %s',
    (requestHost) => {
      const host = loadHostScenario({
        testSiteUrl: 'https://platform.example.com:8443',
        apiUrl: 'https://api.platform.example.com:9443',
        requestHost,
      })

      expect(host.getExternalAPIHostURL('/api/system/clock/queue')).toBe(
        'https://api.platform.example.com:9443/api/system/clock/queue'
      )
    }
  )

  it.each([
    [siteUrl, new URL(siteUrl).host],
    ['http://localhost:3000', 'localhost:3000'],
    ['https://platform.example.com', 'platform.example.com'],
    ['https://platform.example.com:8443', 'platform.example.com:8443'],
  ])(
    'uses the configured site host by default in production for %s',
    (testSiteUrl, expectedHost) => {
      const host = loadHostScenario({ testSiteUrl })

      expect(host.getLocalHost()).toBe(expectedHost)
      expect(host.getExternalHost()).toBe(expectedHost)
      expect(host.getExternalFrontendHost()).toBe(expectedHost)
      expect(host.getLocalAPIHost()).toBe(expectedHost)
    }
  )

  it('prefers request and frontend context hosts when they are available', () => {
    const host = loadHostScenario({
      requestHost: 'request.example.com',
      frontendHost: 'frontend.example.com',
    })

    expect(host.getLocalHost()).toBe('request.example.com')
    expect(host.getExternalHost()).toBe('request.example.com')
    expect(host.getExternalFrontendHost()).toBe('frontend.example.com')
    expect(host.getLocalAPIHost()).toBe('request.example.com')
  })
})

describe('development host selection', () => {
  it('uses the local development host for local URLs', () => {
    const host = loadHostScenario({
      nodeEnv: 'development',
      targetEnv: undefined,
      ngrokHost: 'dev.ngrok.app',
      localHost: 'localhost:4000',
    })

    expect(host.getLocalHost()).toBe('dev.ngrok.app')
  })

  it.each([
    [{ ngrokHost: 'dev.ngrok.app' }, 'dev.ngrok.app'],
    [{ externalHost: 'external.example.com' }, 'external.example.com'],
    [{ requestHost: 'request.example.com' }, 'request.example.com'],
    [{}, 'localhost:8080'],
  ])(
    'resolves external host in development from %j to %s',
    (overrides, expectedHost) => {
      const host = loadHostScenario({
        nodeEnv: 'development',
        targetEnv: undefined,
        ...overrides,
      })

      expect(host.getExternalHost()).toBe(expectedHost)
    }
  )
})

describe('test environment host selection', () => {
  it('uses the integration test base URL when it is set', () => {
    const host = loadHostScenario({
      nodeEnv: 'test',
      targetEnv: undefined,
      integrationTestBaseUrl: 'https://itest.chatbotkit.internal',
    })

    expect(host.getLocalHost()).toBe('itest.chatbotkit.internal')
    expect(host.getExternalHost()).toBe('itest.chatbotkit.internal')
  })

  it('falls back to localhost in test without an integration base URL', () => {
    const host = loadHostScenario({
      nodeEnv: 'test',
      targetEnv: undefined,
    })

    expect(host.getLocalHost()).toBe('localhost:8080')
    expect(host.getExternalHost()).toBe('localhost:8080')
  })
})

describe('basic URL construction', () => {
  it('builds local, external, and frontend URLs from their resolved hosts', () => {
    const host = loadHostScenario({
      requestHost: 'request.example.com',
      frontendHost: 'frontend.example.com',
    })

    expect(host.getLocalHostURL('/api/v1')).toBe(
      'https://request.example.com/api/v1'
    )
    expect(host.getExternalHostURL('/docs')).toBe(
      'https://request.example.com/docs'
    )
    expect(host.getExternalFrontendHostURL('/dashboard')).toBe(
      'https://frontend.example.com/dashboard'
    )
    expect(host.getLocalAPIHostURL('/v1/users')).toBe(
      'https://request.example.com/api/v1/users'
    )
  })

  it('passes absolute URLs through unchanged', () => {
    const host = loadHostScenario()

    expect(host.getExternalHostURL('https://other.com/path')).toBe(
      'https://other.com/path'
    )
  })

  it('switches to http for localhost hosts', () => {
    const host = loadHostScenario({ requestHost: 'localhost:3000' })

    expect(host.getLocalHostURL()).toBe('http://localhost:3000/')
    expect(host.getExternalHostURL('/api/test')).toBe(
      'http://localhost:3000/api/test'
    )
    expect(host.getLocalAPIHostURL('/v1/test')).toBe(
      'http://localhost:3000/api/v1/test'
    )
  })

  // @note the community stack serves plain http on loopback and *.localhost
  // hosts; dialling them over https fails the TLS handshake

  it.each(['127.0.0.1:3000', '[::1]:3000', 'cbk.localhost:3000'])(
    'switches to http for the loopback request host %s',
    (requestHost) => {
      const host = loadHostScenario({
        testSiteUrl: 'https://platform.example.com',
        requestHost,
      })

      expect(host.getLocalHostURL()).toBe(`http://${requestHost}/`)
      expect(host.getExternalHostURL('/api/test')).toBe(
        `http://${requestHost}/api/test`
      )
      expect(host.getExternalFrontendHostURL('/dashboard')).toBe(
        `http://${requestHost}/dashboard`
      )
      expect(host.getLocalAPIHostURL('/v1/graphql')).toBe(
        `http://${requestHost}/api/v1/graphql`
      )
      expect(host.getExternalAPIHostURL('/v1/graphql')).toBe(
        `http://${requestHost}/api/v1/graphql`
      )
    }
  )

  it('follows the site scheme for the site host', () => {
    const host = loadHostScenario({
      testSiteUrl: 'http://platform.internal',
    })

    expect(host.getLocalAPIHostURL('/v1/graphql')).toBe(
      'http://platform.internal/api/v1/graphql'
    )
    expect(host.getExternalAPIHostURL('/v1/graphql')).toBe(
      'http://platform.internal/api/v1/graphql'
    )
  })

  it('follows the request scheme for a plain http request host', () => {
    const host = loadHostScenario({
      testSiteUrl: 'https://platform.example.com',
      requestHost: 'customer.example.org',
      requestProtocol: 'http',
    })

    expect(host.getLocalAPIHostURL('/v1/graphql')).toBe(
      'http://customer.example.org/api/v1/graphql'
    )
    expect(host.getExternalHostURL('/docs')).toBe(
      'http://customer.example.org/docs'
    )
  })

  it('keeps an https site host on https whatever the request scheme', () => {
    const host = loadHostScenario({
      testSiteUrl: 'https://platform.example.com',
      requestHost: 'platform.example.com',
      requestProtocol: 'http',
    })

    expect(host.getLocalAPIHostURL('/v1/graphql')).toBe(
      'https://platform.example.com/api/v1/graphql'
    )
  })

  it('defaults to https for a request host without a request scheme', () => {
    const host = loadHostScenario({
      testSiteUrl: 'https://platform.example.com',
      requestHost: 'customer.example.org',
    })

    expect(host.getLocalAPIHostURL('/v1/graphql')).toBe(
      'https://customer.example.org/api/v1/graphql'
    )
  })
})

describe('external static host', () => {
  it('uses the configured static origin', () => {
    const host = loadHostScenario({
      testSiteUrl: 'https://platform.example.com',
      testStaticUrl: 'https://assets.example.com',
    })

    expect(host.getExternalStaticHost()).toBe('assets.example.com')
    expect(host.getExternalStaticHostURL('/integrations/widget/v2.js')).toBe(
      'https://assets.example.com/integrations/widget/v2.js'
    )
  })

  it('falls back to the configured site origin', () => {
    const host = loadHostScenario({
      testSiteUrl: 'https://platform.example.com',
      testStaticUrl: '',
    })

    expect(host.getExternalStaticHost()).toBe('platform.example.com')
    expect(host.getExternalStaticHostURL('/asset.js')).toBe(
      'https://platform.example.com/asset.js'
    )
  })
})

describe('a site host spelled with its default port', () => {
  it('resolves to the site scheme with the port dropped', () => {
    const host = loadHostScenario({ testSiteUrl: 'http://console.example' })

    expect(host.getExternalFrontendHostURL('/x', 'console.example:80')).toBe(
      'http://console.example/x'
    )
  })
})

describe('configured static and widget origins keep their scheme', () => {
  it.each([
    ['http://platform.example:3000', 'https://platform.example:9443'],
    ['https://platform.example:8443', 'http://platform.example:3000'],
    ['http://platform.example:3000', 'https://localhost:9443'],
    ['http://platform.example:3000', 'https://[::1]:9443'],
    ['http://platform.example:3000', 'https://api.platform.example:9443'],
    ['http://platform.example:3000', 'https://platform.example'],
    ['https://platform.example:8443', 'http://platform.example'],
    ['http://platform.example:3000', 'https://127.0.0.1:9443'],
    ['http://platform.example:3000', 'https://api.localhost:9443'],
  ])('honors API_URL %s -> %s just like asset origins', (testSiteUrl, origin) => {
    const host = loadHostScenario({
      testSiteUrl,
      apiUrl: origin,
      testStaticUrl: origin,
      testWidgetUrl: origin,
    })
    const api = new URL(origin)
    const apiPath = api.hostname.startsWith('api.')
      ? '/v1/models'
      : '/api/v1/models'

    expect(host.getExternalStaticHostURL('/asset.js')).toBe(
      `${origin}/asset.js`
    )
    expect(host.getExternalWidgetHostURL('/bundle.js')).toBe(
      `${origin}/bundle.js`
    )
    expect(host.getExternalAPIHostURL('/v1/models', api.host)).toBe(
      `${origin}${apiPath}`
    )
  })

  it('does not infer the site scheme onto an explicit STATIC_URL', () => {
    const host = loadHostScenario({
      testSiteUrl: 'http://platform.example:3000',
      testStaticUrl: 'https://platform.example:9443',
    })

    expect(host.getExternalStaticHostURL('/asset.js')).toBe(
      'https://platform.example:9443/asset.js'
    )
  })
})

describe('external static and widget URLs on plain http', () => {
  it('keeps a mapped localhost target on http, port included', () => {
    const host = loadHostScenario({
      testSiteUrl: 'http://cbk.localhost:3000',
      testStaticUrl: '',
      contextStaticHost: 'cbk-static.localhost:3000',
      contextWidgetHost: 'cbk-widgets.localhost:3000',
    })

    expect(host.getExternalStaticHostURL('/asset.js')).toBe(
      'http://cbk-static.localhost:3000/asset.js'
    )
    expect(host.getExternalWidgetHostURL('/bundle.js')).toBe(
      'http://cbk-widgets.localhost:3000/bundle.js'
    )
  })
})

describe('injected host context', () => {
  const primaryHosts = {
    site: 'console.example.com',
    api: 'api.example.com',
    static: 'static.example.com',
    widgets: 'widgets.example.com',
  }

  const secondaryHosts = {
    site: 'console.example.net',
    api: 'api.example.net',
    static: 'static.example.net',
    widgets: 'widgets.example.net',
  }

  it.each([
    [
      'console.example.com',
      'console.example.com',
      'api.example.com',
      'static.example.com',
      'widgets.example.com',
    ],
    [
      'api.example.net',
      'console.example.net',
      'api.example.net',
      'static.example.net',
      'widgets.example.net',
    ],
  ])(
    'resolves every target for %s',
    (requestHost, site, api, staticHost, widgets) => {
      const host = loadHostScenario({
        requestHost,
        frontendHost: site,
        contextAPIHost: api,
        contextStaticHost: staticHost,
        contextWidgetHost: widgets,
      })

      expect(host.getExternalFrontendHost()).toBe(site)
      expect(host.getExternalAPIHost()).toBe(api)
      expect(host.getExternalStaticHost()).toBe(staticHost)
      expect(host.getExternalWidgetHost()).toBe(widgets)
    }
  )

  it('prefers injected context over the raw request host', () => {
    const host = loadHostScenario({
      requestHost: 'internal.example.com',
      frontendHost: secondaryHosts.site,
      contextAPIHost: secondaryHosts.api,
      contextStaticHost: secondaryHosts.static,
      contextWidgetHost: secondaryHosts.widgets,
    })

    expect(host.getExternalFrontendHost()).toBe(secondaryHosts.site)
    expect(host.getExternalAPIHost()).toBe(secondaryHosts.api)
    expect(host.getExternalStaticHost()).toBe(secondaryHosts.static)
    expect(host.getExternalWidgetHost()).toBe(secondaryHosts.widgets)
  })

  it('uses scalar fallbacks for an unmatched custom host', () => {
    const host = loadHostScenario({
      requestHost: 'customer.example.org',
      testStaticUrl: 'https://assets.example.org',
      testWidgetUrl: 'https://widgets.example.org',
    })

    expect(host.getExternalFrontendHost()).toBe('customer.example.org')
    expect(host.getExternalAPIHost()).toBe('customer.example.org')
    expect(host.getExternalStaticHost()).toBe('assets.example.org')
    expect(host.getExternalWidgetHost()).toBe('widgets.example.org')
  })

  it('uses SITE_URL and scalar defaults without request context', () => {
    const host = loadHostScenario({
      testSiteUrl: 'https://platform.example.org',
      testStaticUrl: 'https://assets.example.org',
      testWidgetUrl: 'https://widgets.example.org',
    })

    expect(host.getExternalFrontendHost()).toBe('platform.example.org')
    expect(host.getExternalStaticHost()).toBe('assets.example.org')
    expect(host.getExternalWidgetHost()).toBe('widgets.example.org')
  })

  it('builds request-affine static and widget URLs', () => {
    const host = loadHostScenario({
      requestHost: 'example.com',
      frontendHost: primaryHosts.site,
      contextAPIHost: primaryHosts.api,
      contextStaticHost: primaryHosts.static,
      contextWidgetHost: primaryHosts.widgets,
    })

    expect(host.getExternalFrontendHostURL('/dashboard')).toBe(
      'https://console.example.com/dashboard'
    )
    expect(host.getExternalAPIHostURL('/v1/models')).toBe(
      'https://api.example.com/v1/models'
    )
    expect(host.getExternalStaticHostURL('/asset.js')).toBe(
      'https://static.example.com/asset.js'
    )
    expect(host.getExternalWidgetHostURL('/manifest.json')).toBe(
      'https://widgets.example.com/manifest.json'
    )
  })
})

describe('getExternalAPIHost', () => {
  it('serves the API on the site host by default', () => {
    const host = loadHostScenario()

    // @note a host - the site port comes along with it
    expect(host.getExternalAPIHost()).toBe(new URL(siteUrl).host)
  })

  it('resolves chatbotkit.com to api.chatbotkit.com in production', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://chatbotkit.com',
      apiUrl: 'https://api.chatbotkit.com',
    })

    expect(host.getExternalHost()).toBe('chatbotkit.com')
    expect(host.getExternalAPIHost()).toBe('api.chatbotkit.com')
  })

  it.each(externalAPIHostCases)(
    '$name',
    ({ targetEnv, testSiteUrl, apiUrl, requestHost, expectedHost }) => {
      const host = loadHostScenario({
        nodeEnv: 'production',
        targetEnv,
        testSiteUrl,
        apiUrl,
        requestHost,
      })

      expect(host.getExternalAPIHost()).toBe(expectedHost)
    }
  )

  it('returns the external host unchanged in development', () => {
    const host = loadHostScenario({
      nodeEnv: 'development',
      targetEnv: undefined,
    })

    expect(host.getExternalAPIHost()).toBe('localhost:8080')
  })

  // @note API_URL equal to the site URL - the single-domain shape

  it('honors API_URL for the site host in production', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://platform.example.com',
      apiUrl: 'https://platform.example.com',
    })

    expect(host.getExternalAPIHost()).toBe('platform.example.com')
  })

  it('honors API_URL for api./next. variants of the site host', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://platform.example.com',
      apiUrl: 'https://platform.example.com',
    })

    expect(host.getExternalAPIHost('api.platform.example.com')).toBe(
      'platform.example.com'
    )
    expect(host.getExternalAPIHost('next.platform.example.com')).toBe(
      'platform.example.com'
    )
  })

  it('keeps the /api prefix on a mapped api.* origin shared with the site', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://platform.example.com',
      apiUrl: 'https://platform.example.com',
      frontendHost: 'api.brand.example',
      contextAPIHost: 'api.brand.example',
    })

    expect(host.getExternalAPIHostURL('/v1/models')).toBe(
      'https://api.brand.example/api/v1/models'
    )
  })

  it('keeps the /api prefix when mapped site and api targets share a hostname on different ports', () => {
    const mapping = {
      brand: {
        match: ['api.example:3000', 'api.example:8443'],
        site: 'api.example:3000',
        api: 'api.example:8443',
        static: 'static.example',
        widgets: 'widgets.example',
      },
    }

    // @note with a request: the mapping resolved both hosts
    const withRequest = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://console.example',
      apiUrl: 'https://api.example:8443',
      frontendHost: 'api.example:3000',
      contextAPIHost: 'api.example:8443',
      hostsConfig: mapping,
    })

    expect(withRequest.getExternalAPIHostURL('/v1/models')).toBe(
      'https://api.example:8443/api/v1/models'
    )

    // @note without one: the configured API host is still a mapped site
    // hostname, which the proxy never classifies as an API host
    const background = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://console.example',
      apiUrl: 'https://api.example:8443',
      hostsConfig: mapping,
    })

    expect(background.getExternalAPIHostURL('/v1/models')).toBe(
      'https://api.example:8443/api/v1/models'
    )
  })

  it('keeps the /api prefix when a mapping shares the configured API host with its site', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://console.example',
      apiUrl: 'https://api.example',
      frontendHost: 'api.example',
      contextAPIHost: 'api.example',
    })

    expect(host.getExternalAPIHostURL('/v1/models')).toBe(
      'https://api.example/api/v1/models'
    )
  })

  it('keeps the /api prefix on a shared site that is named api.*', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://api.example.com:8443',
      apiUrl: '',
    })

    expect(host.getExternalAPIHostURL('/v1/models')).toBe(
      'https://api.example.com:8443/api/v1/models'
    )
  })

  it('recognises the site family on any port', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'http://cbk.localhost:3000',
      apiUrl: 'http://cbk.localhost:3000',
    })

    expect(host.getExternalAPIHost('cbk.localhost:8080')).toBe(
      'cbk.localhost:3000'
    )
    expect(host.getExternalAPIHost('api.cbk.localhost')).toBe(
      'cbk.localhost:3000'
    )
    expect(host.getExternalAPIHost('other.localhost:3000')).toBe(
      'other.localhost:3000'
    )
  })

  it('passes foreign hosts through untouched with API_URL set', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://platform.example.com',
      apiUrl: 'https://platform.example.com',
    })

    expect(host.getExternalAPIHost('customer-portal.example.org')).toBe(
      'customer-portal.example.org'
    )
  })
})

describe('getExternalAPIHostURL', () => {
  it.each([
    [
      'api.chatbotkit.com',
      '/v1/models',
      'https://api.chatbotkit.com/v1/models',
    ],
    [
      'api.chatbotkit.com',
      '/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp',
      'https://api.chatbotkit.com/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp',
    ],
    [
      'slug.chatbotkit.agency',
      '/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp',
      'https://slug.chatbotkit.agency/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp',
    ],
    [
      'slug.chatbotkit.agency',
      '/api/v1/models',
      'https://slug.chatbotkit.agency/api/v1/models',
    ],
    ['localhost:8080', '/v1/test', 'http://localhost:8080/api/v1/test'],
  ])('builds %s with path %s as %s', (apiHost, path, expectedUrl) => {
    const host = loadHostScenario()

    expect(host.getExternalAPIHostURL(path, apiHost)).toBe(expectedUrl)
  })

  it.each(externalAPIHostURLCases)(
    '$name',
    ({ targetEnv, testSiteUrl, apiUrl, requestHost, path, expectedUrl }) => {
      const host = loadHostScenario({
        nodeEnv: 'production',
        targetEnv,
        testSiteUrl,
        apiUrl,
        requestHost,
      })

      expect(host.getExternalAPIHostURL(path)).toBe(expectedUrl)
    }
  )

  it('uses the resolved API host when no explicit host is provided', () => {
    const host = loadHostScenario()

    expect(host.getExternalAPIHostURL('/v2/models')).toBe(
      `${siteUrl}/api/v2/models`
    )
  })

  it('builds the MCP protected-resource URL from the request host in production', () => {
    const host = loadHostScenario({
      nodeEnv: 'production',
      targetEnv: 'production',
      testSiteUrl: 'https://next.chatbotkit.com',
      requestHost: 'slug.chatbotkit.agency',
    })

    expect(host.getExternalAPIHost()).toBe('slug.chatbotkit.agency')
    expect(
      host.getExternalAPIHostURL(
        '/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp'
      )
    ).toBe(
      'https://slug.chatbotkit.agency/.well-known/oauth-protected-resource/v1/integration/mcpserver/abc123/mcp'
    )
  })
})
