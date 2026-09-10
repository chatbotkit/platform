/**
 * @jest-environment @chatbotkit-dev/jest-jsdom
 * @jest-environment-options {"url": "http://console.example:3000/"}
 */

// @note the page is the site's hostname on another port and scheme; links to
// the page's own host must keep the scheme the page was reached on

function loadHost() {
  let host

  jest.isolateModules(() => {
    host = jest.requireActual('@/lib/host')
  })

  return host
}

describe('lib/host in the browser on an alternate port of the site', () => {
  const previous = process.env.SITE_URL

  beforeEach(() => {
    delete process.env.SITE_URL
    document.documentElement.dataset.siteUrl = 'https://console.example'
  })

  afterAll(() => {
    if (previous === undefined) {
      delete process.env.SITE_URL
    } else {
      process.env.SITE_URL = previous
    }
  })

  it('keeps http for the page host and https for the configured site', () => {
    const host = loadHost()

    expect(host.getExternalFrontendHostURL('/tokens', 'console.example:3000')).toBe(
      'http://console.example:3000/tokens'
    )
    expect(host.getExternalFrontendHostURL('/tokens', 'console.example')).toBe(
      'https://console.example/tokens'
    )
  })
})
