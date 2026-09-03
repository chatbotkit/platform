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
  appSlugToHostnameMap: Object.freeze({}),
}))

jest.mock('@/config/site', () => ({
  siteUrl: 'https://site.example.com',
  siteHostname: 'site.example.com',
}))

jest.mock('@/lib/host', () => ({
  getExternalFrontendHostURL: jest.fn((path) => `https://front.example${path}`),
}))

jest.mock('@/hooks/useHostname', () => ({
  useAppSlugToHostnameMap: jest.fn(),
  useAudienceHostname: jest.fn(),
  useCookieHostname: jest.fn(),
  useSiteHostname: jest.fn(),
}))

jest.mock('@/i18n.config', () => ({
  __esModule: true,
  default: { locales: ['en'], defaultLocale: 'en', domainLocales: [] },
}))

jest.mock('@/next.config.d/base.config', () => ({
  __esModule: true,
  default: { basePath: '' },
}))

const {
  useRouter: useNextRouter,
  useSearchParams: useNextSearchParams,
  useParams: useNextParams,
  usePathname: useNextPathname,
} = require('next/navigation')

const {
  useAppSlugToHostnameMap,
  useAudienceHostname,
  useCookieHostname,
  useSiteHostname,
} = require('@/hooks/useHostname')

const push = jest.fn()

function setup({
  cookieHostname = '',
  audienceHostname = '',
  hostnameMap = {},
  pathname = '/',
} = {}) {
  useNextRouter.mockReturnValue({ push, replace: jest.fn() })
  useNextSearchParams.mockReturnValue(new URLSearchParams())
  useNextParams.mockReturnValue({})
  useNextPathname.mockReturnValue(pathname)

  useCookieHostname.mockReturnValue(cookieHostname)
  useAudienceHostname.mockReturnValue(audienceHostname)
  useSiteHostname.mockReturnValue('site.example.com')
  useAppSlugToHostnameMap.mockReturnValue(Object.freeze(hostnameMap))

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
  })
})
