/**
 * @jest-environment node
 */
import { apiUrl, siteHost, siteUrl, staticUrl, widgetUrl } from '@/config/site'

import RootLayout from './layout'

const requestHeaders = { current: new Headers() }

// @note the tests carry their own site fixture - a Compose-style origin with
// a port - instead of depending on whatever SITE_URL the shell exports
jest.mock('@/config/site', () => {
  const siteUrl = 'http://cbk.localhost:3000'
  const staticUrl = 'http://cbk-static.localhost:3000'
  const widgetUrl = 'http://cbk-widgets.localhost:3000'
  const apiUrl = 'http://cbk.localhost:3000'

  return {
    siteUrl,
    siteHostname: new URL(siteUrl).hostname,
    siteHost: new URL(siteUrl).host,
    staticUrl,
    staticHostname: new URL(staticUrl).hostname,
    staticHost: new URL(staticUrl).host,
    widgetUrl,
    widgetHostname: new URL(widgetUrl).hostname,
    widgetHost: new URL(widgetUrl).host,
    apiUrl,
    apiHostname: new URL(apiUrl).hostname,
    apiHost: new URL(apiUrl).host,
  }
})

jest.mock('next/headers', () => ({
  headers: jest.fn(async () => requestHeaders.current),
}))

jest.mock('@/components/ChunkErrorListener', () => () => null)
jest.mock('@/components/GlobalRoot', () => () => null)

describe('root layout', () => {
  it('stamps the configured origins alongside the resolved hosts', async () => {
    requestHeaders.current = new Headers({ host: 'cbk-labs.localhost:3000' })

    const html = await RootLayout({ children: null })

    // @note the browser seeds config/site from these; without them it
    // would seed from its own origin and never patch server-rendered hrefs
    expect(html.props).toMatchObject({
      'data-audience': 'cbk-labs.localhost:3000',
      'data-site-url': siteUrl,
      'data-static-url': staticUrl,
      'data-widget-url': widgetUrl,
      'data-api-url': apiUrl,
    })
  })

  it('falls back to the configured site host, port included', async () => {
    requestHeaders.current = new Headers()

    const html = await RootLayout({ children: null })

    expect(html.props['data-audience']).toBe(siteHost)
  })
})
