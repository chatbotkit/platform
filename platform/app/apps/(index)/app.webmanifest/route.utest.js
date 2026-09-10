/**
 * @jest-environment node
 */
import { GET } from './route'

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

jest.mock('@/lib/app.router.app.config', () => ({
  getPublicAppConfig: jest.fn(async () => null),
}))

describe('app.webmanifest', () => {
  it('identifies the manifest by the request host, port included', async () => {
    requestHeaders.current = new Headers({ host: 'CBK-Labs.localhost:3000' })

    const manifest = await (await GET()).json()

    expect(manifest.id).toBe('cbk-labs-localhost-3000')
  })

  it('falls back to the configured site host without a request host', async () => {
    requestHeaders.current = new Headers()

    const manifest = await (await GET()).json()

    // @note the fallback is the host as configured - on a Compose stack
    // that carries the port, so it stays distinct from a bare hostname
    expect(manifest.id).toBe('cbk-localhost-3000')
  })
})
