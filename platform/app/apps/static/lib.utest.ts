import prisma from '@/prisma/client'

import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { getPortalGlobalConfig } from '@/lib/portal.config'
import { getPortalSlugFromHostname } from '@/lib/portal.hostname'

import {
  getAppMountBaseHref,
  getContentTypeForPath,
  getDirectoryIndexStoragePath,
  getNotFoundResponse,
  getRootMountBaseHref,
  getSitePathCandidates,
  injectHtmlBase,
  isDocumentRequest,
  normalizeSiteStoragePath,
  resolveSpaceSiteConfig,
} from './lib'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    portal: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/context.store', () => ({
  ...jest.requireActual('@/lib/context.store'),
  getContextFrontendHost: jest.fn(),
  getContextRequestHost: jest.fn(),
}))

jest.mock('@/lib/portal.config', () => ({
  getPortalGlobalConfig: jest.fn(),
}))

jest.mock('@/lib/portal.hostname', () => ({
  getPortalSlugFromHostname: jest.fn(),
}))

describe('resolveSpaceSiteConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getContextFrontendHost as jest.Mock).mockReturnValue(
      'missing.chatbotkit.agency'
    )
    ;(getContextRequestHost as jest.Mock).mockReturnValue(null)
    ;(getPortalSlugFromHostname as jest.Mock).mockReturnValue('missing')
  })

  it('returns empty config when the portal no longer exists', async () => {
    ;(prisma.portal.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(resolveSpaceSiteConfig()).resolves.toEqual({})
    expect(getPortalGlobalConfig).not.toHaveBeenCalled()
  })
})

describe('isDocumentRequest', () => {
  it('uses sec-fetch-dest when present', () => {
    expect(
      isDocumentRequest(
        new Request('https://x/', { headers: { 'sec-fetch-dest': 'document' } })
      )
    ).toBe(true)
    expect(
      isDocumentRequest(
        new Request('https://x/', { headers: { 'sec-fetch-dest': 'style' } })
      )
    ).toBe(false)
  })

  it('falls back to the Accept header when sec-fetch-dest is absent', () => {
    expect(
      isDocumentRequest(
        new Request('https://x/', { headers: { accept: 'text/html' } })
      )
    ).toBe(true)
    expect(
      isDocumentRequest(
        new Request('https://x/', { headers: { accept: 'text/css,*/*' } })
      )
    ).toBe(false)
    expect(isDocumentRequest(new Request('https://x/'))).toBe(false)
  })
})

describe('getNotFoundResponse', () => {
  it('returns a 404 with a client redirect for a document navigation', async () => {
    const res = getNotFoundResponse({
      head: false,
      isDocument: true,
      isOwnAppHost: false,
    })

    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).toContain('text/html')

    const body = await res.text()

    expect(body).toContain('location.replace("/404")')
    expect(body).toContain('url=/404')
  })

  it('returns a bare 404 for sub-resource (asset) requests', async () => {
    const res = getNotFoundResponse({
      head: false,
      isDocument: false,
      isOwnAppHost: false,
    })

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('')
  })

  it('returns a bare 404 on the app own host (avoids the /404 redirect loop)', async () => {
    const res = getNotFoundResponse({
      head: false,
      isDocument: true,
      isOwnAppHost: true,
    })

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('')
  })

  it('returns a bare 404 for HEAD requests', async () => {
    const res = getNotFoundResponse({
      head: true,
      isDocument: true,
      isOwnAppHost: false,
    })

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('')
  })
})

describe('space site base href resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getContextFrontendHost as jest.Mock).mockReturnValue(null)
    ;(getContextRequestHost as jest.Mock).mockReturnValue(null)
  })

  describe('getRootMountBaseHref', () => {
    it('strips the internal /apps prefix for the portal root mount', () => {
      expect(
        getRootMountBaseHref(
          new Request('https://acme.chatbotkit.agency/apps/about/')
        )
      ).toBe('/about/')
    })

    it('returns root for the bare mount', () => {
      expect(
        getRootMountBaseHref(new Request('https://acme.chatbotkit.agency/apps'))
      ).toBe('/')
    })

    it('adds a trailing slash for directory requests without one', () => {
      expect(
        getRootMountBaseHref(
          new Request('https://acme.chatbotkit.agency/apps/docs')
        )
      ).toBe('/docs/')
    })
  })

  describe('getAppMountBaseHref', () => {
    it('serves from the bare root on the app own hostname', () => {
      ;(getContextRequestHost as jest.Mock).mockReturnValue(
        'static.chatbotkit.app'
      )

      const req = new Request('https://static.chatbotkit.app/about/', {
        headers: { 'x-forwarded-host': 'static.chatbotkit.app' },
      })

      expect(getAppMountBaseHref(req, { params: { path: ['about'] } })).toBe(
        '/about/'
      )
    })

    it('keeps the app-prefixed mount for a portal host', () => {
      ;(getContextRequestHost as jest.Mock).mockReturnValue(
        'acme.chatbotkit.agency'
      )

      const req = new Request(
        'https://acme.chatbotkit.agency/apps/static/docs',
        { headers: { 'x-forwarded-host': 'acme.chatbotkit.agency' } }
      )

      expect(getAppMountBaseHref(req, { params: { path: ['docs'] } })).toBe(
        '/static/docs/'
      )
    })
  })
})

describe('static site helpers', () => {
  describe('normalizeSiteStoragePath', () => {
    it('normalizes leading and trailing slashes', () => {
      expect(normalizeSiteStoragePath('/public/site/')).toBe('public/site')
    })

    it('rejects traversal segments', () => {
      expect(normalizeSiteStoragePath('../secret')).toBeNull()
      expect(normalizeSiteStoragePath('public/../secret')).toBeNull()
    })

    it('rejects backslash path segments', () => {
      expect(normalizeSiteStoragePath('public\\secret')).toBeNull()
    })
  })

  describe('getSitePathCandidates', () => {
    it('resolves directory index storage paths', () => {
      expect(
        getSitePathCandidates({ path: 'about', prefix: 'public/site' })
      ).toEqual({
        candidates: ['public/site/about', 'public/site/about/index.html'],
        notFoundPath: 'public/site/404.html',
      })
    })

    it('serves the index at the configured prefix for the root path', () => {
      expect(
        getSitePathCandidates({ path: '', prefix: 'public/site' })
      ).toEqual({
        candidates: ['public/site/index.html'],
        notFoundPath: 'public/site/404.html',
      })
    })

    it('tries exact files before directory indexes', () => {
      expect(getSitePathCandidates({ path: 'styles.css' })).toEqual({
        candidates: ['styles.css', 'styles.css/index.html'],
        notFoundPath: '404.html',
      })
    })

    it('uses only the directory index for trailing slash paths', () => {
      expect(
        getSitePathCandidates({ path: 'about', trailingSlash: true })
      ).toEqual({
        candidates: ['about/index.html'],
        notFoundPath: '404.html',
      })
    })

    it('returns null for unsafe configured prefixes', () => {
      expect(
        getSitePathCandidates({ path: 'about', prefix: '../secret' })
      ).toBe(null)
    })
  })

  describe('getContentTypeForPath', () => {
    it('returns stable content types for common static assets', () => {
      expect(getContentTypeForPath('index.html')).toBe(
        'text/html; charset=utf-8'
      )
      expect(getContentTypeForPath('style.css')).toBe('text/css; charset=utf-8')
      expect(getContentTypeForPath('logo.png')).toBe('image/png')
      expect(getContentTypeForPath('unknown.bin')).toBe(null)
    })
  })

  describe('injectHtmlBase', () => {
    it('adds a base tag inside the document head', () => {
      expect(
        injectHtmlBase('<html><head><title>x</title></head></html>', '/site/')
      ).toContain('<base href="/site/">')
    })

    it('does not override an existing base tag', () => {
      const html = '<html><head><base href="/existing/"></head></html>'

      expect(injectHtmlBase(html, '/site/')).toBe(html)
    })

    it('escapes the base href attribute', () => {
      expect(injectHtmlBase('<html><head></head></html>', '/a"b/')).toContain(
        '<base href="/a&quot;b/">'
      )
    })
  })

  describe('getDirectoryIndexStoragePath', () => {
    it('joins prefix, path and index', () => {
      expect(
        getDirectoryIndexStoragePath({ path: 'about', prefix: 'public/site' })
      ).toBe('public/site/about/index.html')
    })
  })
})
