/**
 * @jest-environment @chatbotkit-dev/jest-jsdom
 * @jest-environment-options {"url": "http://api.brand.example/"}
 */

// @note a mapped host may spell the default http port; the browser never
// does, so the comparison has to normalise under the page's scheme

function loadHost() {
  let host

  jest.isolateModules(() => {
    host = jest.requireActual('@/lib/host')
  })

  return host
}

describe('lib/host in the browser on a mapped host spelled with :80', () => {
  const previous = process.env.SITE_URL

  beforeEach(() => {
    delete process.env.SITE_URL
    document.documentElement.dataset.siteUrl = 'http://console.example'
    // @note the mapping serves the site on this host too, so the API lives
    // under /api - the stamped runtime site host says so
    document.documentElement.dataset.siteHost = 'api.brand.example:80'
  })

  afterAll(() => {
    delete document.documentElement.dataset.siteHost

    if (previous === undefined) {
      delete process.env.SITE_URL
    } else {
      process.env.SITE_URL = previous
    }
  })

  it('keeps http and drops the default port for the page host', () => {
    const host = loadHost()

    expect(host.getExternalFrontendHostURL('/hub/demo', 'api.brand.example:80')).toBe(
      'http://api.brand.example/hub/demo'
    )
    expect(host.getExternalAPIHostURL('/v1/models', 'api.brand.example:80')).toBe(
      'http://api.brand.example/api/v1/models'
    )
  })
})
