import { resolvePlatformApiUrl } from '@/lib/api.tool.url'
import { getExternalAPIHost } from '@/lib/host'

jest.mock('@/lib/host', () => ({
  getExternalAPIHost: jest.fn(),
}))

describe('resolvePlatformApiUrl', () => {
  const location = {
    origin: 'https://console.example',
    host: 'console.example',
  }

  beforeEach(() => {
    getExternalAPIHost.mockReturnValue('api.example')
  })

  it.each([
    ['/v1/models', 'https://console.example/api/v1/models'],
    ['/api/v1/models', 'https://console.example/api/v1/models'],
    [
      'https://console.example/v1/models',
      'https://console.example/api/v1/models',
    ],
    ['https://api.example/v1/models', 'https://console.example/api/v1/models'],
    [
      'https://api.example/api/v1/models',
      'https://console.example/api/v1/models',
    ],
  ])('folds %s onto the page origin under /api', (url, expected) => {
    expect(resolvePlatformApiUrl(url, location).href).toBe(expected)
  })

  it('prefers the API host stamped on the document', () => {
    document.documentElement.dataset.apiHost = 'api.brand.example'

    try {
      expect(
        resolvePlatformApiUrl('https://api.brand.example/v1/x', location).href
      ).toBe('https://console.example/api/v1/x')
    } finally {
      delete document.documentElement.dataset.apiHost
    }
  })

  it('keeps a foreign origin untouched for the caller to refuse', () => {
    expect(
      resolvePlatformApiUrl('https://other.example/v1/x', location).href
    ).toBe('https://other.example/v1/x')
  })

  it('normalizes an explicit default port in the mapped API host', () => {
    document.documentElement.dataset.apiHost = 'api.brand.example:80'

    try {
      expect(
        resolvePlatformApiUrl('http://api.brand.example/v1/models', location)
          .href
      ).toBe('https://console.example/api/v1/models')
    } finally {
      delete document.documentElement.dataset.apiHost
    }
  })

  it('does not accept another port on the mapped API hostname', () => {
    document.documentElement.dataset.apiHost = 'api.brand.example:8443'

    try {
      expect(
        resolvePlatformApiUrl(
          'https://api.brand.example:9443/v1/models',
          location
        ).href
      ).toBe('https://api.brand.example:9443/v1/models')
    } finally {
      delete document.documentElement.dataset.apiHost
    }
  })

  it('keeps the page port when folding', () => {
    getExternalAPIHost.mockReturnValue('api.example:8443')

    expect(
      resolvePlatformApiUrl('https://api.example:8443/v1/x', {
        origin: 'http://console.example:3000',
        host: 'console.example:3000',
      }).href
    ).toBe('http://console.example:3000/api/v1/x')
  })

  it.each([
    ['https://api.example:8443', 'https://console.example'],
    ['https://api.example:8443', 'http://console.example'],
    ['http://api.example:8080', 'https://console.example'],
    ['http://api.example:8080', 'http://console.example'],
  ])('clears the API port when folding %s onto %s', (apiOrigin, pageOrigin) => {
    getExternalAPIHost.mockReturnValue(new URL(apiOrigin).host)

    const resolved = resolvePlatformApiUrl(`${apiOrigin}/v1/x?a=1#result`, {
      origin: pageOrigin,
      host: new URL(pageOrigin).host,
    })

    expect(resolved.origin).toBe(pageOrigin)
    expect(resolved.href).toBe(`${pageOrigin}/api/v1/x?a=1#result`)
  })
})
