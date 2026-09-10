/**
 * @jest-environment @chatbotkit-dev/jest-jsdom
 * @jest-environment-options {"url": "http://cbk-labs.localhost:3000/"}
 */

/* eslint-disable @typescript-eslint/no-require-imports -- every phase loads the real config/site under a different environment through jest.isolateModules */

// @note the page lives on the runtime host, not the configured SITE_URL - the
// labs shell served by a deployment whose SITE_URL is the loopback origin.
// This is the layout that hid the bug: seeding the browser from
// window.location.origin already yields the post-hydration host, so React
// sees no change and leaves the server-rendered href untouched.

const CONFIGURED_URL = 'http://127.0.0.1:3000'
const CONFIGURED_HOST = '127.0.0.1:3000'
const RUNTIME_HOST = 'cbk-labs.localhost:3000'

const SERVER_HTML = `<a href="http://${CONFIGURED_HOST}/x">link</a>`

// @note getExternalAPIHost reads the request context store, which is
// server-only; useSiteHost never calls it, so a stub keeps the import inert
jest.mock('@/lib/host', () => ({
  getExternalAPIHost: jest.fn((host) => host),
}))

const ORIGINAL_ENV = {
  SITE_URL: process.env.SITE_URL,
  STATIC_URL: process.env.STATIC_URL,
  WIDGET_URL: process.env.WIDGET_URL,
  API_URL: process.env.API_URL,
}

function restoreEnv() {
  for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }
}

/**
 * The server phase: config/site takes the environment branch when no window
 * exists, so the module is loaded with the global hidden.
 */
function loadServer() {
  const descriptor = Object.getOwnPropertyDescriptor(global, 'window')

  Object.defineProperty(global, 'window', {
    configurable: true,
    value: undefined,
  })

  try {
    let modules

    jest.isolateModules(() => {
      const { renderToString } = require('react-dom/server')

      modules = { ...loadProbe(), renderToString }
    })

    return modules
  } finally {
    Object.defineProperty(global, 'window', descriptor)
  }
}

/**
 * Loads the real config/site and useHost modules into the current registry -
 * call it inside jest.isolateModules so each phase sees its own seed - and
 * builds the probe anchor on that React instance.
 */
function loadProbe() {
  const React = require('react')
  const { useSiteHost } = require('./useHost')

  function Probe() {
    const host = useSiteHost()

    return React.createElement('a', { href: `http://${host}/x` }, 'link')
  }

  return { React, Probe, site: require('@/config/site') }
}

/**
 * Hydrates the server markup in a fresh container with the browser modules
 * and returns the anchor once React has committed the layout effects.
 */
async function hydrate(html) {
  const container = document.createElement('div')

  container.innerHTML = html

  document.body.appendChild(container)

  let React
  let Probe
  let hydrateRoot
  let site

  jest.isolateModules(() => {
    ;({ React, Probe, site } = loadProbe())
    ;({ hydrateRoot } = require('react-dom/client'))
  })

  global.IS_REACT_ACT_ENVIRONMENT = true

  const recoverable = []

  let root

  await React.act(async () => {
    root = hydrateRoot(container, React.createElement(Probe), {
      onRecoverableError: (error) => recoverable.push(error),
    })
  })

  return {
    anchor: container.querySelector('a'),
    recoverable,
    site,
    unmount: () => React.act(() => root.unmount()),
  }
}

describe('useSiteHost hydration', () => {
  let consoleError

  beforeEach(() => {
    process.env.SITE_URL = CONFIGURED_URL

    delete process.env.STATIC_URL
    delete process.env.WIDGET_URL
    delete process.env.API_URL

    // @note only React's hydration mismatch report is expected noise; any
    // other console.error still surfaces
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        if (typeof args[0] === 'string' && args[0].includes('hydrat')) {
          return
        }

        throw new Error(`unexpected console.error: ${args.join(' ')}`)
      })
  })

  afterEach(() => {
    consoleError.mockRestore()

    restoreEnv()

    delete document.documentElement.dataset.siteUrl
    delete document.documentElement.dataset.siteHost

    document.body.innerHTML = ''
  })

  it('renders the configured site host on the server', () => {
    const { React, Probe, site, renderToString } = loadServer()

    expect(site.siteHost).toBe(CONFIGURED_HOST)

    expect(renderToString(React.createElement(Probe))).toBe(SERVER_HTML)
  })

  describe('in the browser', () => {
    beforeEach(() => {
      // @note the browser bundle carries no SITE_URL
      delete process.env.SITE_URL
    })

    it('patches the server-rendered href to the runtime host after hydration', async () => {
      document.documentElement.dataset.siteUrl = CONFIGURED_URL
      document.documentElement.dataset.siteHost = RUNTIME_HOST

      const { anchor, recoverable, site, unmount } = await hydrate(SERVER_HTML)

      expect(anchor.getAttribute('href')).toBe(`http://${RUNTIME_HOST}/x`)

      // the seed reproduced the server render, so hydration was clean
      expect(site.siteHost).toBe(CONFIGURED_HOST)
      expect(recoverable).toEqual([])
      expect(consoleError).not.toHaveBeenCalled()

      unmount()
    })

    it('keeps the href when the runtime host is the configured host', async () => {
      document.documentElement.dataset.siteUrl = CONFIGURED_URL
      document.documentElement.dataset.siteHost = CONFIGURED_HOST

      const { anchor, recoverable, unmount } = await hydrate(SERVER_HTML)

      expect(recoverable).toEqual([])
      expect(consoleError).not.toHaveBeenCalled()

      expect(anchor.getAttribute('href')).toBe(`http://${CONFIGURED_HOST}/x`)

      unmount()
    })

    // @note without the stamped origin the seed falls back to the page origin,
    // which on the runtime host is already the post-hydration value: React
    // reports the mismatch, does not patch attributes, and the layout effect
    // sets the same host again - the stale server href survives. This is the
    // failure the data-site-url attribute exists to prevent.
    it('leaves the server href stale when seeded from the page origin instead', async () => {
      document.documentElement.dataset.siteHost = RUNTIME_HOST

      const { anchor, site, unmount } = await hydrate(SERVER_HTML)

      expect(site.siteHost).toBe(RUNTIME_HOST)
      expect(consoleError).toHaveBeenCalled()

      expect(anchor.getAttribute('href')).toBe(`http://${CONFIGURED_HOST}/x`)

      unmount()
    })
  })
})
