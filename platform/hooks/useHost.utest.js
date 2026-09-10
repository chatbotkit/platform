/* eslint-disable @typescript-eslint/no-require-imports */
import { renderToString } from 'react-dom/server'

import useCookie from './useCookie'
import useHost, {
  getDocumentHost,
  useAPIHost,
  useApexHostURL,
  useAppSlugToHostMap,
  useAudienceHost,
  useCookieHost,
  useHostname,
  usePortalApex,
  useSiteHost,
  useSpaceApex,
  useStaticHost,
  useWidgetHost,
} from './useHost'

import { renderHook } from '@testing-library/react'

jest.mock('./useCookie', () => jest.fn())

let isProductionValue = false
let siteUrlValue = 'https://default.example.com'
let siteHostValue = 'site.example.com:8443'

jest.mock('@/lib/env', () => ({
  get isProduction() {
    return isProductionValue
  },
}))

jest.mock('@/lib/localhost', () => ({
  isLocalhost: jest.fn(),
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHost: jest.fn(() => 'api.example.com'),
}))

// @note the hosts carry a port so a hostname leaking into a host seam fails
jest.mock('@/config/site', () => ({
  siteHostname: 'site.example.com',
  get siteHost() {
    return siteHostValue
  },
  staticHostname: 'static.example.com',
  staticHost: 'static.example.com:8443',
  widgetHostname: 'widgets.example.com',
  widgetHost: 'widgets.example.com:8443',
  get siteUrl() {
    return siteUrlValue
  },
}))

jest.mock('@/config/apexes', () => ({
  portalApex: 'portal.example.com',
  spaceApex: 'space.example.com',
}))

jest.mock('@/config/apps', () => ({
  MAIN_TYPE: ':main',
  LABS_TYPE: ':labs',
  BUILTIN_TYPE: ':builtin',
  PORTAL_TYPE: ':portal',
  appSlugs: ['chat', 'connect', ':main', ':labs'],
  // @note mirrors the browser bundle, where the map carries no apex-derived
  // entries because the constants read server-only environment
  appSlugToHostMap: Object.freeze({}),
}))

jest.mock('@/config/cookie', () => ({
  HOST_COOKIE_NAME: 'host_cookie',
}))

const { isLocalhost } = require('@/lib/localhost')

describe('useHost', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    siteUrlValue = 'https://default.example.com'
    siteHostValue = 'site.example.com:8443'
    isProductionValue = false

    isLocalhost.mockReturnValue(false)

    delete document.documentElement.dataset.audience
  })

  describe('basic functionality', () => {
    it('should return hostname from cookie', () => {
      useCookie.mockReturnValue('cookie.example.com')

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('cookie.example.com')
    })

    it('should return hostname from siteUrl when cookie is empty', () => {
      useCookie.mockReturnValue(null)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('default.example.com')
    })

    it('should call useCookie with HOST_COOKIE_NAME', () => {
      useCookie.mockReturnValue('test.com')

      renderHook(() => useHost())

      expect(useCookie).toHaveBeenCalledWith('host_cookie')
    })
  })

  describe('production mode', () => {
    beforeEach(() => {
      isProductionValue = true
    })

    it('should replace localhost with the site host in production', () => {
      useCookie.mockReturnValue('localhost')
      isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('site.example.com:8443')
    })

    it('should replace 127.0.0.1 with the site host in production', () => {
      useCookie.mockReturnValue('127.0.0.1')
      isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('site.example.com:8443')
    })

    it('should keep valid hostname in production', () => {
      useCookie.mockReturnValue('valid.example.com')
      isLocalhost.mockReturnValue(false)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('valid.example.com')
    })

    it('keeps a loopback host when the site itself is loopback', () => {
      isProductionValue = true
      siteHostValue = '127.0.0.1:3000'
      isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))
      document.documentElement.dataset.audience = 'localhost:3000'
      useCookie.mockReturnValue(null)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('localhost:3000')
    })

    it('falls back to the site url host when nothing is known in production', () => {
      useCookie.mockReturnValue(null)
      isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('default.example.com')
    })
  })

  describe('non-production mode', () => {
    it('should allow localhost hostname', () => {
      useCookie.mockReturnValue('localhost')
      isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('localhost')
    })

    it('should allow 127.0.0.1 hostname', () => {
      useCookie.mockReturnValue('127.0.0.1')
      isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('127.0.0.1')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined cookie', () => {
      useCookie.mockReturnValue(undefined)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('default.example.com')
    })

    it('should handle empty string cookie', () => {
      useCookie.mockReturnValue('')

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('default.example.com')
    })

    it('should handle siteUrl with port', () => {
      siteUrlValue = 'https://example.com:3000'
      useCookie.mockReturnValue(null)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('example.com:3000')
    })

    it('should handle siteUrl with path', () => {
      siteUrlValue = 'https://example.com/path'
      useCookie.mockReturnValue(null)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('example.com')
    })

    it('should handle siteUrl with subdomain', () => {
      siteUrlValue = 'https://sub.example.com'
      useCookie.mockReturnValue(null)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('sub.example.com')
    })
  })

  describe('html data-audience', () => {
    it('should prefer data-audience over cookie', () => {
      document.documentElement.dataset.audience = 'html.example.com'
      useCookie.mockReturnValue('cookie.example.com')

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('html.example.com')
    })

    it('keeps a ported audience over the cookie even when it is the site host', () => {
      document.documentElement.dataset.audience = 'site.example.com:8443'
      useCookie.mockReturnValue('platform.internal:3000')

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('site.example.com:8443')
    })

    it('lets the cookie refine a bare site hostname audience', () => {
      document.documentElement.dataset.audience = 'site.example.com'
      useCookie.mockReturnValue('brand.example.com')

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('brand.example.com')
    })

    it('should fall back to cookie when data-audience is absent', () => {
      useCookie.mockReturnValue('cookie.example.com')

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('cookie.example.com')
    })

    it('should fall back to siteUrl when both data-audience and cookie are absent', () => {
      useCookie.mockReturnValue(null)
      siteUrlValue = 'https://fallback.example.com'

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('fallback.example.com')
    })

    it('should always call useCookie regardless of data-audience', () => {
      document.documentElement.dataset.audience = 'html.example.com'
      useCookie.mockReturnValue('cookie.example.com')

      renderHook(() => useHost())

      expect(useCookie).toHaveBeenCalledWith('host_cookie')
    })

    it('should apply production localhost check to data-audience value', () => {
      isProductionValue = true
      document.documentElement.dataset.audience = 'localhost'
      isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))
      useCookie.mockReturnValue(null)

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('site.example.com:8443')
    })
  })

  describe('fallback logic', () => {
    it('should use siteUrl when cookie is falsy', () => {
      useCookie.mockReturnValue(null)
      siteUrlValue = 'https://fallback.example.com'

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('fallback.example.com')
    })

    it('should prefer cookie over siteUrl when both exist', () => {
      useCookie.mockReturnValue('cookie.example.com')
      siteUrlValue = 'https://fallback.example.com'

      const { result } = renderHook(() => useHost())

      expect(result.current).toBe('cookie.example.com')
    })
  })

  describe('rerenders', () => {
    it('should update when cookie changes', () => {
      useCookie.mockReturnValue('first.example.com')

      const { result, rerender } = renderHook(() => useHost())

      expect(result.current).toBe('first.example.com')

      useCookie.mockReturnValue('second.example.com')
      rerender()

      expect(result.current).toBe('second.example.com')
    })

    it('should switch from cookie to fallback', () => {
      useCookie.mockReturnValue('cookie.example.com')

      const { result, rerender } = renderHook(() => useHost())

      expect(result.current).toBe('cookie.example.com')

      useCookie.mockReturnValue(null)
      rerender()

      expect(result.current).toBe('default.example.com')
    })
  })
})

describe('useCookieHost', () => {
  it.each(['a b:c', 'host:abc', 'example.com/path', 'x;domain=evil'])(
    'ignores a cookie that is not a host (%s)',
    (value) => {
      useCookie.mockReturnValue(value)

      const { result } = renderHook(() => useCookieHost())

      expect(result.current).toBe('')
    }
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return the cookie value when set', () => {
    useCookie.mockReturnValue('cookie.example.com')

    const { result } = renderHook(() => useCookieHost())

    expect(result.current).toBe('cookie.example.com')
  })

  it('should return empty string when cookie is null', () => {
    useCookie.mockReturnValue(null)

    const { result } = renderHook(() => useCookieHost())

    expect(result.current).toBe('')
  })

  it('should return empty string when cookie is undefined', () => {
    useCookie.mockReturnValue(undefined)

    const { result } = renderHook(() => useCookieHost())

    expect(result.current).toBe('')
  })

  it('should call useCookie with HOST_COOKIE_NAME', () => {
    useCookie.mockReturnValue('test.com')

    renderHook(() => useCookieHost())

    expect(useCookie).toHaveBeenCalledWith('host_cookie')
  })
})

describe('useAudienceHost', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.audience
  })

  it('should return the data-audience value when set', () => {
    document.documentElement.dataset.audience = 'audience.example.com'

    const { result } = renderHook(() => useAudienceHost())

    expect(result.current).toBe('audience.example.com')
  })

  it('should return empty string when data-audience is not set', () => {
    const { result } = renderHook(() => useAudienceHost())

    expect(result.current).toBe('')
  })

  it('should return empty string when data-audience is empty string', () => {
    document.documentElement.dataset.audience = ''

    const { result } = renderHook(() => useAudienceHost())

    expect(result.current).toBe('')
  })
})

describe('configured apexes', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.portalApex
    delete document.documentElement.dataset.spaceApex
  })

  it('should resolve the portal apex from the document', () => {
    document.documentElement.dataset.portalApex = 'portal.brand.example'

    const { result } = renderHook(() => usePortalApex())

    expect(result.current).toBe('portal.brand.example')
  })

  it('should fall back to the configured portal apex', () => {
    const { result } = renderHook(() => usePortalApex())

    expect(result.current).toBe('portal.example.com')
  })

  it('should resolve the space apex from the document', () => {
    document.documentElement.dataset.spaceApex = 'space.brand.example'

    const { result } = renderHook(() => useSpaceApex())

    expect(result.current).toBe('space.brand.example')
  })

  it('should fall back to the configured space apex', () => {
    const { result } = renderHook(() => useSpaceApex())

    expect(result.current).toBe('space.example.com')
  })
})

describe('useApexHostURL', () => {
  afterEach(() => {
    siteUrlValue = 'https://default.example.com'
  })

  it('should follow the document location scheme and port once hydrated', () => {
    // @note jsdom serves the test document from http://localhost/
    const { result } = renderHook(() => useApexHostURL())

    expect(result.current('acme', 'space.localhost')).toBe(
      'http://acme.space.localhost'
    )
  })

  it('should seed the scheme and port from the site url on the server', () => {
    siteUrlValue = 'http://localhost:3000'

    let href = ''

    function Probe() {
      href = useApexHostURL()('acme', 'space.localhost')

      return null
    }

    renderToString(<Probe />)

    expect(href).toBe('http://acme.space.localhost:3000')
  })

  it('should omit the port when the site url has none', () => {
    siteUrlValue = 'https://app.example.com'

    let href = ''

    function Probe() {
      href = useApexHostURL()('acme', 'space.example.com')

      return null
    }

    renderToString(<Probe />)

    expect(href).toBe('https://acme.space.example.com')
  })
})

describe('useAppSlugToHostMap', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.appApex
    delete document.documentElement.dataset.portalApex
    delete document.documentElement.dataset.appMainHost
    delete document.documentElement.dataset.appLabsHost
  })

  it('overlays the runtime deployment hosts from the document', () => {
    document.documentElement.dataset.appApex = 'apps.brand.example'
    document.documentElement.dataset.portalApex = 'portal.brand.example'
    document.documentElement.dataset.appMainHost = 'main.brand.example'
    document.documentElement.dataset.appLabsHost = 'labs.brand.example'

    const { result } = renderHook(() => useAppSlugToHostMap())

    expect(result.current).toEqual({
      chat: 'chat.apps.brand.example',
      connect: 'connect.apps.brand.example',
      ':builtin': 'apps.brand.example',
      ':portal': 'portal.brand.example',
      ':main': 'main.brand.example',
      ':labs': 'labs.brand.example',
    })
  })

  it('overlays the labs shell host on its own, port included', () => {
    document.documentElement.dataset.appLabsHost = 'cbk-labs.localhost:3000'

    const { result } = renderHook(() => useAppSlugToHostMap())

    expect(result.current).toEqual({
      ':labs': 'cbk-labs.localhost:3000',
    })
  })

  it('never derives shell hosts from the app apex', () => {
    document.documentElement.dataset.appApex = 'apps.brand.example'

    const { result } = renderHook(() => useAppSlugToHostMap())

    expect(result.current).toEqual({
      chat: 'chat.apps.brand.example',
      connect: 'connect.apps.brand.example',
      ':builtin': 'apps.brand.example',
    })
  })

  it('keeps the constants table when the document carries no hosts', () => {
    const { result } = renderHook(() => useAppSlugToHostMap())

    expect(result.current).toEqual({})
  })

  it('overlays only the hosts the document names', () => {
    document.documentElement.dataset.portalApex = 'portal.brand.example'

    const { result } = renderHook(() => useAppSlugToHostMap())

    expect(result.current).toEqual({
      ':portal': 'portal.brand.example',
    })
  })

  it('renders the constants table during SSR without reading the document', () => {
    // @note server render must reproduce the constants exactly - the overlay
    // lands in a layout effect, so a first client render that disagrees with
    // the server HTML would break hydration

    document.documentElement.dataset.portalApex = 'portal.brand.example'

    let ssrValue

    function Probe() {
      ssrValue = useAppSlugToHostMap()

      return null
    }

    renderToString(<Probe />)

    expect(ssrValue).toEqual({})
  })
})

describe('configured widget host', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.widgetHost
  })

  it('should resolve the widget host from the document', () => {
    document.documentElement.dataset.widgetHost = 'widgets.brand.example'

    const { result } = renderHook(() => useWidgetHost())

    expect(result.current).toBe('widgets.brand.example')
  })

  it('should fall back to the configured widget host', () => {
    const { result } = renderHook(() => useWidgetHost())

    expect(result.current).toBe('widgets.example.com:8443')
  })
})

describe('configured site host', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.siteHost
  })

  it('should resolve the site host from the document', () => {
    document.documentElement.dataset.siteHost = 'brand.example'

    const { result } = renderHook(() => useSiteHost())

    expect(result.current).toBe('brand.example')
  })

  it('should fall back to the configured site host', () => {
    const { result } = renderHook(() => useSiteHost())

    expect(result.current).toBe('site.example.com:8443')
  })
})

describe('configured static host', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.staticHost
  })

  it('should resolve the static host from the document', () => {
    document.documentElement.dataset.staticHost = 'static.brand.example'

    const { result } = renderHook(() => useStaticHost())

    expect(result.current).toBe('static.brand.example')
  })

  it('should fall back to the configured static host', () => {
    const { result } = renderHook(() => useStaticHost())

    expect(result.current).toBe('static.example.com:8443')
  })
})

describe('configured API host', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.apiHost
  })

  it('should resolve the API host from the document', () => {
    document.documentElement.dataset.apiHost = 'api.brand.example'

    const { result } = renderHook(() => useAPIHost())

    expect(result.current).toBe('api.brand.example')
  })

  it('should fall back to the configured API host', () => {
    const { result } = renderHook(() => useAPIHost())

    expect(result.current).toBe('api.example.com')
  })
})

describe('server rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    isProductionValue = false

    isLocalhost.mockReturnValue(false)

    delete document.documentElement.dataset.audience
  })

  // @note the page tree renders on the server without a document, so neither
  // the data-audience attribute nor the cookie may be read during render -
  // doing so makes the first client render disagree and breaks hydration

  function Probe() {
    return <>{useHost()}</>
  }

  it('should not read data-audience while rendering', () => {
    document.documentElement.dataset.audience = 'html.example.com'
    useCookie.mockReturnValue(null)

    expect(renderToString(<Probe />)).toBe('default.example.com')
  })

  // @note useCookie resolves the request cookie on the server through Next's
  // incremental cache and returns null on the client, so the cookie is the
  // second source that must not reach the first render

  it('should not read the host cookie while rendering', () => {
    useCookie.mockReturnValue('cookie.example.com')

    expect(renderToString(<Probe />)).toBe('default.example.com')
  })

  it('should render the same hostname the server and the client agree on', () => {
    document.documentElement.dataset.audience = 'html.example.com'
    useCookie.mockReturnValue('cookie.example.com')

    const serverHtml = renderToString(<Probe />)

    // the first client render reproduces the server HTML, and only then do
    // the layout effects resolve the real hostname
    const { result } = renderHook(() => useHost())

    expect(serverHtml).toBe('default.example.com')
    expect(result.current).toBe('html.example.com')
  })
})

describe('getDocumentHost', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    isProductionValue = false

    isLocalhost.mockReturnValue(false)

    delete document.documentElement.dataset.audience

    document.cookie = 'host_cookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  it('should resolve the hostname from the host cookie', () => {
    document.cookie = 'host_cookie=cookie.example.com'

    expect(getDocumentHost()).toBe('cookie.example.com')
  })

  it('should prefer data-audience over the cookie', () => {
    document.cookie = 'host_cookie=cookie.example.com'
    document.documentElement.dataset.audience = 'html.example.com'

    expect(getDocumentHost()).toBe('html.example.com')
  })

  it('should fall back to the location host when neither is set', () => {
    expect(getDocumentHost()).toBe(window.location.host)
  })

  it('should replace localhost with the site host in production', () => {
    isProductionValue = true
    isLocalhost.mockImplementation((value) => /^(localhost|127\.)/.test(value))

    document.cookie = 'host_cookie=localhost'

    expect(getDocumentHost()).toBe('site.example.com:8443')
  })
})

describe('useHostname', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    delete document.documentElement.dataset.audience
  })

  it('reduces the resolved host to its hostname', () => {
    useCookie.mockReturnValue('acme.portal.example:3000')

    const { result: host } = renderHook(() => useHost())
    const { result: hostname } = renderHook(() => useHostname())

    // @note the host keeps the port, the hostname never does
    expect(host.current).toBe('acme.portal.example:3000')
    expect(hostname.current).toBe('acme.portal.example')
  })
})
