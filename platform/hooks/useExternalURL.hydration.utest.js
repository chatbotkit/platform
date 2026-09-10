/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports -- server and browser phases load separate module graphs */

import { createRequire } from 'node:module'

const { JSDOM } = createRequire(require.resolve('jest-environment-jsdom'))(
  'jsdom'
)

const ENV_KEYS = [
  'SITE_URL',
  'API_URL',
  'STATIC_URL',
  'WIDGET_URL',
  'HOSTS_CONFIG',
]

function loadProbe() {
  const React = require('react')
  const useFrontendURL = require('./useExternalFrontendURL').default
  const useAPIURL = require('./useExternalAPIURL').default

  function Probe() {
    const frontendURL = useFrontendURL()
    const apiURL = useAPIURL()

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'a',
        { id: 'frontend', href: frontendURL('/hub/demo') },
        'Frontend'
      ),
      React.createElement(
        'a',
        { id: 'api', href: apiURL('/v1/models') },
        'API'
      )
    )
  }

  return { React, Probe }
}

describe('external URL hydration across schemes', () => {
  const previousEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  )
  const previousActEnvironment = global.IS_REACT_ACT_ENVIRONMENT

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    delete global.window
    delete global.document
    global.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
  })

  it.each([
    ['http://console.example', 'https://console.example', undefined],
    ['https://console.example', 'http://console.example', undefined],
    ['https://console.example', 'http://console.example:3000', undefined],
    ['http://console.example', 'http://shell.example:3000', undefined],
    [
      'http://console.example:3000',
      'http://console.example:3000',
      'https://console.example:9443',
    ],
    [
      'https://console.example:8443',
      'https://console.example:8443',
      'http://console.example:3000',
    ],
    [
      'http://console.example:3000',
      'http://console.example:3000',
      'https://localhost:9443',
    ],
  ])('hydrates %s on %s without leaving stale links', async (configuredOrigin, pageOrigin, apiOrigin) => {
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }

    process.env.SITE_URL = configuredOrigin

    if (apiOrigin) {
      process.env.API_URL = apiOrigin
    }

    let html

    jest.isolateModules(() => {
      const { React, Probe } = loadProbe()

      html = require('react-dom/server').renderToString(React.createElement(Probe))
    })

    const dom = new JSDOM(`<html><body><div id="root">${html}</div></body></html>`, {
      url: pageOrigin,
    })

    global.window = dom.window
    global.document = dom.window.document
    global.IS_REACT_ACT_ENVIRONMENT = true

    const pageHost = new URL(pageOrigin).host

    Object.assign(document.documentElement.dataset, {
      siteUrl: configuredOrigin,
      apiUrl: apiOrigin || configuredOrigin,
      audience: pageHost,
      siteHost: pageHost,
      apiHost: apiOrigin ? new URL(apiOrigin).host : pageHost,
      apiCleanRoutes: '0',
    })
    document.cookie = `chatbotkit.host=${pageHost}`
    delete process.env.SITE_URL
    delete process.env.API_URL

    let React
    let Probe
    let hydrateRoot
    let root

    jest.isolateModules(() => {
      ;({ React, Probe } = loadProbe())
      ;({ hydrateRoot } = require('react-dom/client'))
    })

    const errors = []
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((...args) => errors.push(args))

    try {
      await React.act(async () => {
        root = hydrateRoot(document.getElementById('root'), React.createElement(Probe), {
          onRecoverableError: (error) => errors.push(error),
        })
      })

      expect(document.getElementById('frontend').getAttribute('href')).toBe(
        `${pageOrigin}/hub/demo`
      )
      expect(document.getElementById('api').getAttribute('href')).toBe(
        `${apiOrigin || pageOrigin}/api/v1/models`
      )
      expect(errors).toEqual([])
    } finally {
      if (root) {
        await React.act(async () => root.unmount())
      }

      errorSpy.mockRestore()
      dom.window.close()
    }
  })
})
