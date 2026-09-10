/**
 * @jest-environment @chatbotkit-dev/jest-jsdom
 * @jest-environment-options {"url": "http://192.168.1.10:3000/"}
 */

// @note the browser seeds config/site from the origins the server stamped on
// <html>; these cases cover what the page then builds for itself

const ORIGIN_KEYS = ['SITE_URL', 'STATIC_URL', 'WIDGET_URL', 'API_URL']

function loadHost() {
  let host

  jest.isolateModules(() => {
    host = jest.requireActual('@/lib/host')
  })

  return host
}

describe('lib/host in the browser', () => {
  const previous = Object.fromEntries(
    ORIGIN_KEYS.map((key) => [key, process.env[key]])
  )

  beforeEach(() => {
    for (const key of ORIGIN_KEYS) {
      delete process.env[key]
    }

    document.documentElement.dataset.siteUrl = 'http://localhost:3000'
    delete document.documentElement.dataset.apiUrl
    delete document.documentElement.dataset.siteHost
    delete document.documentElement.dataset.apiHost
    delete document.documentElement.dataset.apiCleanRoutes
  })

  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it('keeps the page scheme for an alternate address reached over http', () => {
    const host = loadHost()

    expect(host.getExternalFrontendHostURL('/x', '192.168.1.10:3000')).toBe(
      'http://192.168.1.10:3000/x'
    )
  })

  it('follows the API route policy the server stamped for its API host', () => {
    document.documentElement.dataset.siteUrl = 'https://console.example'
    document.documentElement.dataset.apiUrl = 'https://api.example:8443'
    document.documentElement.dataset.apiHost = 'api.example:8443'
    // @note the mapping that makes api.example a site hostname lives on the
    // server only; without the stamp the browser would emit a clean route
    document.documentElement.dataset.apiCleanRoutes = '0'

    const host = loadHost()

    expect(host.getExternalAPIHostURL('/v1/models', 'api.example:8443')).toBe(
      'https://api.example:8443/api/v1/models'
    )

    document.documentElement.dataset.apiCleanRoutes = '1'

    expect(loadHost().getExternalAPIHostURL('/v1/models', 'api.example:8443')).toBe(
      'https://api.example:8443/v1/models'
    )
  })

  it('keeps the /api prefix on a mapped api.* origin shared with the site', () => {
    document.documentElement.dataset.siteUrl = 'https://platform.example.com'
    document.documentElement.dataset.siteHost = 'api.brand.example'

    const host = loadHost()

    expect(host.getExternalAPIHostURL('/v1/models', 'api.brand.example')).toBe(
      'https://api.brand.example/api/v1/models'
    )
  })
})
