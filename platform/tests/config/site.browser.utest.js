/**
 * @jest-environment jsdom
 */

// @note the browser bundle has no SITE_URL; it seeds from the origins the
// server stamped on <html>, so server and client render the same hosts and
// the post-hydration overlay is a real change React applies to the DOM

const ORIGIN_KEYS = ['SITE_URL', 'STATIC_URL', 'WIDGET_URL', 'API_URL']

function loadSite() {
  let site

  jest.isolateModules(() => {
    site = jest.requireActual('@/config/site')
  })

  return site
}

describe('config/site in the browser', () => {
  const previous = Object.fromEntries(
    ORIGIN_KEYS.map((key) => [key, process.env[key]])
  )

  beforeEach(() => {
    for (const key of ORIGIN_KEYS) {
      delete process.env[key]
    }

    for (const key of ['siteUrl', 'staticUrl', 'widgetUrl', 'apiUrl']) {
      delete document.documentElement.dataset[key]
    }
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

  it('seeds from the origins the server rendered with', () => {
    document.documentElement.dataset.siteUrl = 'http://127.0.0.1:3000'
    document.documentElement.dataset.staticUrl = 'https://static.example:9443'

    const site = loadSite()

    expect(site.siteUrl).toBe('http://127.0.0.1:3000')
    expect(site.siteHost).toBe('127.0.0.1:3000')
    expect(site.staticHost).toBe('static.example:9443')
    // @note unset origins fall back to the site, as on the server
    expect(site.widgetHost).toBe('127.0.0.1:3000')
    expect(site.apiHost).toBe('127.0.0.1:3000')
  })

  it('falls back to the page origin when nothing is stamped', () => {
    const site = loadSite()

    expect(site.siteUrl).toBe(window.location.origin)
  })
})
