/**
 * @jest-environment node
 */
import { apiUrl, siteHost, siteUrl, staticUrl, widgetUrl } from '@/config/site'

import {
  getPartnerByIdentifier,
  getPartnerSlugFromHostname,
} from '@/lib/partner.helpers'

import Document from './_document'

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

jest.mock('next/document', () => {
  class NextDocument {
    static async getInitialProps() {
      return { html: '', head: [], styles: [] }
    }
  }

  return {
    __esModule: true,
    default: NextDocument,
    Head: () => null,
    Html: () => null,
    Main: () => null,
    NextScript: () => null,
  }
})

jest.mock('@/lib/partner.helpers', () => ({
  getPartnerByIdentifier: jest.fn(async () => null),
  getPartnerSlugFromHostname: jest.fn(() => null),
}))

jest.mock('@/components/GlobalRoot', () => () => null)

function request(host) {
  return {
    method: 'GET',
    url: '/',
    query: {},
    headers: host ? { host } : {},
  }
}

describe('Document.getInitialProps', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stamps the configured origins and the request host on a request', async () => {
    const props = await Document.getInitialProps({
      req: request('cbk-labs.localhost:3000'),
    })

    expect(props).toMatchObject({
      _host: 'cbk-labs.localhost:3000',
      _siteUrl: siteUrl,
      _staticUrl: staticUrl,
      _widgetUrl: widgetUrl,
      _apiUrl: apiUrl,
    })
  })

  it('stamps the configured origins but no request host on a prerender', async () => {
    const props = await Document.getInitialProps({})

    // @note a build-time render has no request: the origins do not depend
    // on one and keep the browser from seeding them from the page origin,
    // while the request host itself falls back to the cookie and the page
    expect(props).toMatchObject({
      _siteUrl: siteUrl,
      _staticUrl: staticUrl,
      _widgetUrl: widgetUrl,
      _apiUrl: apiUrl,
    })

    for (const key of ['_host', '_siteHost']) {
      expect(props).not.toHaveProperty(key)
    }

    expect(props).toHaveProperty('_partner', null)
  })

  it('falls back to the configured site host, port included', async () => {
    const props = await Document.getInitialProps({ req: request() })

    expect(props._host).toBe(siteHost)
  })

  it('looks the partner up by hostname, IPv6 literals included', async () => {
    await Document.getInitialProps({ req: request('[::1]:3000') })

    // @note splitting on the first colon would hand `[` to the partner table
    expect(getPartnerSlugFromHostname).toHaveBeenCalledWith('[::1]')
    expect(getPartnerByIdentifier).not.toHaveBeenCalled()
  })
})
