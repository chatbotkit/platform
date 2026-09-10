/* eslint-disable custom-eslint-rules/require-custom-use-router -- this suite mocks the Next router wrapped by useRouter */
import useRouter from './useRouter'

import { renderHook } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  useParams: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('@/config/apps', () => ({
  APP_TYPES: [':main', ':labs', ':builtin', ':portal', ':custom'],
  appSlugs: ['chat', 'connect'],
  appSlugToHostMap: Object.freeze({}),
}))

jest.mock('@/config/site', () => ({
  siteUrl: 'https://site.example.com',
  siteHostname: 'site.example.com',
}))

jest.mock('@/lib/host', () => ({
  getExternalFrontendHostURL: jest.fn(
    (path, host) => `https://${host || 'front.example'}${path}`
  ),
}))

jest.mock('@/hooks/useHost', () => ({
  useAppSlugToHostMap: jest.fn(),
  useAudienceHost: jest.fn(),
  useCookieHost: jest.fn(),
  useSiteHost: jest.fn(),
}))

jest.mock('@/i18n.config', () => ({
  __esModule: true,
  default: { locales: ['en'], defaultLocale: 'en', domainLocales: [] },
}))

jest.mock('@/next.config.d/base.config', () => ({
  __esModule: true,
  default: { basePath: '' },
}))

import {
  useRouter as useNextRouter,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
  usePathname as useNextPathname,
} from 'next/navigation'

import {
  useAppSlugToHostMap,
  useAudienceHost,
  useCookieHost,
  useSiteHost,
} from '@/hooks/useHost'

const push = jest.fn()

function setup({
  cookieHostname = '',
  audienceHostname = '',
  hostnameMap = {},
  pathname = '/',
  searchParams = new URLSearchParams(),
} = {}) {
  useNextRouter.mockReturnValue({ push, replace: jest.fn() })
  useNextSearchParams.mockReturnValue(searchParams)
  useNextParams.mockReturnValue({})
  useNextPathname.mockReturnValue(pathname)

  useCookieHost.mockReturnValue(cookieHostname)
  useAudienceHost.mockReturnValue(audienceHostname)
  useSiteHost.mockReturnValue('site.example.com')
  useAppSlugToHostMap.mockReturnValue(Object.freeze(hostnameMap))

  return renderHook(() => useRouter()).result.current
}

describe('useRouter href resolution by host', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('on the site host', () => {
    it('keeps the /apps prefix', () => {
      const router = setup({ cookieHostname: 'site.example.com' })

      expect(router.resolveHref('/apps/chat/abc')).toBe('/apps/chat/abc')
    })

    it('strips the site url from absolute hrefs', () => {
      const router = setup({ cookieHostname: 'site.example.com' })

      // @note the runtime host is the page's own origin; nothing else is
      expect(router.resolveHref('https://site.example.com')).toBe('/')
      expect(router.resolveHref('https://site.example.com/pricing')).toBe(
        '/pricing'
      )
    })
  })

  describe('on a portal host', () => {
    const portal = {
      cookieHostname: 'acme-portal.portal.example',
      hostnameMap: { ':portal': 'portal.example' },
    }

    it('strips the /apps prefix but keeps the app segment', () => {
      const router = setup(portal)

      expect(router.resolveHref('/apps/chat/abc')).toBe('/chat/abc')
    })

    it('resolves the bare /apps to the root', () => {
      const router = setup(portal)

      expect(router.resolveHref('/apps')).toBe('/')
    })

    it('resolves through the audience hostname without a cookie', () => {
      const router = setup({
        audienceHostname: 'acme-portal.portal.example',
        hostnameMap: { ':portal': 'portal.example' },
      })

      expect(router.resolveHref('/apps/chat/abc')).toBe('/chat/abc')
    })

    it('pushes resolved hrefs', () => {
      const router = setup(portal)

      router.push('/apps/chat/abc')

      expect(push).toHaveBeenCalledWith('/chat/abc')
    })

    it('reports the portal host as an app hostname', () => {
      const router = setup(portal)

      expect(router.isAppHostname).toBe(true)
    })
  })

  describe('on a standalone app host', () => {
    const appHost = {
      cookieHostname: 'chat.apps.example',
      hostnameMap: {
        chat: 'chat.apps.example',
        connect: 'connect.apps.example',
        ':builtin': 'apps.example',
      },
    }

    it('strips both the /apps prefix and the own app segment', () => {
      const router = setup(appHost)

      expect(router.resolveHref('/apps/chat/abc')).toBe('/abc')
    })

    it('resolves the bare own app path to the root', () => {
      const router = setup(appHost)

      expect(router.resolveHref('/apps/chat')).toBe('/')
    })
  })

  describe('with an empty hostname map (browser constants fallback)', () => {
    it('does not treat a portal host as an app hostname', () => {
      // @note this is the regression shape: without the runtime overlay the
      // portal host is unrecognisable and hrefs keep their internal /apps form

      const router = setup({
        cookieHostname: 'acme-portal.portal.example',
        hostnameMap: {},
      })

      expect(router.resolveHref('/apps/chat/abc')).toBe('/apps/chat/abc')
      expect(router.isAppHostname).toBe(false)
    })
  })

  describe('own origin on a foreign host', () => {
    it('keeps a configured-site link absolute on a portal domain', () => {
      const router = setup({ cookieHostname: 'acme.example' })

      // @note siteUrl in this suite is https://site.example.com
      expect(router.resolveHref('https://site.example.com/overview')).toBe(
        'https://site.example.com/overview'
      )
      expect(router.resolveHref('https://acme.example/overview')).toBe(
        '/overview'
      )
    })

    it('never cuts a look-alike host or another port down to a path', () => {
      const router = setup({ cookieHostname: 'acme.example' })

      expect(router.resolveHref('https://acme.example.evil/x')).toBe(
        'https://acme.example.evil/x'
      )
      expect(router.resolveHref('https://acme.example:8443/x')).toBe(
        'https://acme.example:8443/x'
      )
      expect(router.resolveHref('https://acme.example/x?a=1#b')).toBe(
        '/x?a=1#b'
      )
    })

    it('transfers session options only onto the page origin', () => {
      const router = setup({
        cookieHostname: 'acme.example',
        searchParams: new URLSearchParams({ _experience: 'builder' }),
      })

      expect(router.normalizeHref('https://acme.example/x')).toBe(
        'https://acme.example/x?_experience=builder'
      )
      expect(router.normalizeHref('https://site.example.com/x')).toBe(
        'https://site.example.com/x'
      )
    })
  })

  describe('normalizeHref', () => {
    it('never strips the /apps prefix', () => {
      const router = setup({
        cookieHostname: 'acme-portal.portal.example',
        hostnameMap: { ':portal': 'portal.example' },
      })

      expect(router.normalizeHref('/apps/chat/abc')).toBe('/apps/chat/abc')
    })
  })

  describe('isKnownHref', () => {
    it('recognises hosts from the runtime map', () => {
      const router = setup({
        cookieHostname: 'site.example.com',
        hostnameMap: { ':portal': 'portal.example' },
      })

      expect(router.isKnownHref('https://acme.portal.example/x')).toBe(true)
      expect(router.isKnownHref('https://unrelated.example/x')).toBe(false)
    })

    it('knows a localhost deployment host by hostname, port and all', () => {
      // @note the registrable domain of cbk.localhost is `localhost`, which
      // would match nothing; the comparison is on hostnames
      const router = setup({
        hostnameMap: { ':main': 'cbk.localhost:3000' },
      })

      expect(router.isKnownHref('http://cbk.localhost:3000/x')).toBe(true)
      expect(router.isKnownHref('http://apps.cbk.localhost:3000/x')).toBe(true)
      expect(router.isKnownHref('http://other.localhost:3000/x')).toBe(false)
    })
  })
})

describe('useRouter on hosts that carry a port', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const portal = {
    cookieHostname: 'acme-portal.portal.example:3000',
    hostnameMap: { ':portal': 'portal.example:3000' },
  }

  it('recognises the portal by hostname and reports host and hostname apart', () => {
    const router = setup(portal)

    // @note the app tables are looked up by hostname; passing the host as-is
    // matches nothing, so the /apps prefix would survive
    expect(router.resolveHref('/apps/chat/abc')).toBe('/chat/abc')
    expect(router.isAppHostname).toBe(true)

    expect(router.host).toBe('acme-portal.portal.example:3000')
    expect(router.hostname).toBe('acme-portal.portal.example')
    expect(router.isSite).toBe(false)
  })

  it('resolves through a ported audience host without a cookie', () => {
    const router = setup({
      audienceHostname: 'acme-portal.portal.example:3000',
      hostnameMap: { ':portal': 'portal.example:3000' },
    })

    expect(router.resolveHref('/apps/chat/abc')).toBe('/chat/abc')
    expect(router.host).toBe('acme-portal.portal.example:3000')
  })

  it('builds absolute hrefs on the ported host', () => {
    const router = setup(portal)

    expect(router.absoluteHref('/x')).toBe(
      'https://acme-portal.portal.example:3000/x'
    )
  })
})
