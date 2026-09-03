import prisma from '@/prisma/client'

import {
  ensureCharset,
  getContentTypeForPath,
  getSitePathCandidates,
  getSpaceSiteHost,
  getSpaceSiteMountBaseHref,
  injectHtmlBase,
  normalizeSiteStoragePath,
  resolveSpaceSiteConfigByHost,
} from './space.site.serve'

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      spaceSite: {
        findUnique: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestHost: jest.fn(),
}))

const {
  getContextFrontendHost,
  getContextRequestHost,
} = require('@/lib/context.store')

const findUnique = prisma.spaceSite.findUnique as unknown as jest.Mock

const MOUNT = '/api/v1/space/system/site'

function req(url = `https://acme.chatbotkit.space${MOUNT}`): Request {
  return { url } as unknown as Request
}

describe('getSpaceSiteHost', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost.mockReturnValue(null)
    getContextRequestHost.mockReturnValue(null)
  })

  it('prefers the verified frontend host and strips the port', () => {
    getContextFrontendHost.mockReturnValue('ACME.chatbotkit.space:443')
    getContextRequestHost.mockReturnValue('internal:3000')

    expect(getSpaceSiteHost()).toBe('acme.chatbotkit.space')
  })

  it('falls back to the request host in context', () => {
    getContextRequestHost.mockReturnValue('docs.chatbotkit.space')

    expect(getSpaceSiteHost()).toBe('docs.chatbotkit.space')
  })

  it('returns null when there is no host', () => {
    getContextRequestHost.mockReturnValue(null)

    expect(getSpaceSiteHost()).toBeNull()
  })
})

describe('getSpaceSiteMountBaseHref', () => {
  it('strips the mount prefix to the root', () => {
    expect(
      getSpaceSiteMountBaseHref(req(`https://x.chatbotkit.space${MOUNT}`))
    ).toBe('/')
  })

  it('strips the mount prefix for a subdirectory', () => {
    expect(
      getSpaceSiteMountBaseHref(req(`https://x.chatbotkit.space${MOUNT}/blog/`))
    ).toBe('/blog/')
  })

  it('adds a trailing slash for a directory request', () => {
    expect(
      getSpaceSiteMountBaseHref(req(`https://x.chatbotkit.space${MOUNT}/blog`))
    ).toBe('/blog/')
  })
})

describe('resolveSpaceSiteConfigByHost', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getContextFrontendHost.mockReturnValue(null)
    getContextRequestHost.mockReturnValue(null)
  })

  it('returns an empty config when there is no host', async () => {
    getContextRequestHost.mockReturnValue(null)

    expect(await resolveSpaceSiteConfigByHost()).toEqual({})
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('returns an empty config for an unknown host', async () => {
    getContextFrontendHost.mockReturnValue('unknown.chatbotkit.space')
    getContextRequestHost.mockReturnValue(null)
    findUnique.mockResolvedValue(null)

    expect(await resolveSpaceSiteConfigByHost()).toEqual({})
  })

  it('resolves the serving config by slug', async () => {
    getContextFrontendHost.mockReturnValue('acme.chatbotkit.space')
    getContextRequestHost.mockReturnValue(null)

    findUnique.mockResolvedValue({
      spaceId: 'space_1',
      prefix: 'marketing',
      index: 'index.html',
      notFound: '404.html',
    })

    const config = await resolveSpaceSiteConfigByHost()

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'acme' } })
    )

    expect(config).toEqual({
      spaceId: 'space_1',
      prefix: 'marketing',
      index: 'index.html',
      notFound: '404.html',
    })
  })

  it('does not resolve a host outside the configured space apex', async () => {
    getContextFrontendHost.mockReturnValue('acme.example.com')

    expect(await resolveSpaceSiteConfigByHost()).toEqual({})
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('drops a blank prefix', async () => {
    getContextFrontendHost.mockReturnValue('acme.chatbotkit.space')
    getContextRequestHost.mockReturnValue(null)

    findUnique.mockResolvedValue({
      spaceId: 'space_1',
      prefix: null,
      index: 'index.html',
      notFound: '404.html',
    })

    const config = await resolveSpaceSiteConfigByHost()

    expect(config.prefix).toBeUndefined()
  })
})

describe('normalizeSiteStoragePath', () => {
  it('trims surrounding slashes', () => {
    expect(normalizeSiteStoragePath('/a/b/')).toBe('a/b')
  })

  it('rejects traversal and backslash segments', () => {
    expect(normalizeSiteStoragePath('a/../b')).toBeNull()
    expect(normalizeSiteStoragePath('a\\b')).toBeNull()
  })
})

describe('getSitePathCandidates', () => {
  it('serves the prefixed index for the root path', () => {
    const result = getSitePathCandidates({
      path: '',
      prefix: 'marketing',
      index: 'index.html',
    })

    expect(result?.candidates).toEqual(['marketing/index.html'])
    expect(result?.notFoundPath).toBe('marketing/404.html')
  })

  it('tries the exact file before the directory index', () => {
    const result = getSitePathCandidates({ path: 'about', prefix: '' })

    expect(result?.candidates).toEqual(['about', 'about/index.html'])
  })

  it('uses only the directory index for trailing-slash paths', () => {
    const result = getSitePathCandidates({
      path: 'blog',
      prefix: '',
      trailingSlash: true,
    })

    expect(result?.candidates).toEqual(['blog/index.html'])
  })

  it('returns null for an unsafe path', () => {
    expect(getSitePathCandidates({ path: 'a/../b', prefix: '' })).toBeNull()
  })
})

describe('getContentTypeForPath', () => {
  it('maps known extensions', () => {
    expect(getContentTypeForPath('a/b.html')).toBe('text/html; charset=utf-8')
    expect(getContentTypeForPath('x.png')).toBe('image/png')
  })

  it('returns null for unknown or extensionless paths', () => {
    expect(getContentTypeForPath('file')).toBeNull()
    expect(getContentTypeForPath('x.unknownext')).toBeNull()
  })
})

describe('ensureCharset', () => {
  it('adds a utf-8 charset to a textual type that lacks one', () => {
    expect(ensureCharset('text/plain')).toBe('text/plain; charset=utf-8')
    expect(ensureCharset('text/markdown')).toBe('text/markdown; charset=utf-8')
  })

  it('leaves an existing charset untouched', () => {
    expect(ensureCharset('text/html; charset=utf-8')).toBe(
      'text/html; charset=utf-8'
    )
    expect(ensureCharset('text/plain; charset=iso-8859-1')).toBe(
      'text/plain; charset=iso-8859-1'
    )
  })

  it('does not touch binary types', () => {
    expect(ensureCharset('image/png')).toBe('image/png')
    expect(ensureCharset('application/octet-stream')).toBe(
      'application/octet-stream'
    )
  })
})

describe('injectHtmlBase', () => {
  it('adds a base tag inside the head', () => {
    const out = injectHtmlBase('<html><head></head><body></body></html>', '/')

    expect(out).toContain('<base href="/">')
    expect(out.indexOf('<base')).toBeGreaterThan(out.indexOf('<head'))
  })

  it('does not override an existing base tag', () => {
    const html = '<html><head><base href="/x/"></head></html>'

    expect(injectHtmlBase(html, '/')).toBe(html)
  })

  it('escapes the href', () => {
    const out = injectHtmlBase('<head></head>', '/a"b')

    expect(out).toContain('<base href="/a&quot;b">')
  })
})
