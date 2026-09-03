/* eslint-disable @typescript-eslint/no-require-imports */
import { siteHostname, staticHostname, widgetHostname } from '@/config/site'

import {
  fetchWidgetManifest,
  getAllowedWidgetDomains,
  getCdnBundleUrl,
  isWidgetUiConfig,
  normalizeWidgetUiValue,
  parseWidgetUiValue,
  resolveWidgetManifestUrl,
} from './mcp.widget'

jest.mock(
  'mcp-widgets/src/schemas',
  () => ({
    ManifestMetadataSchema: {
      safeParse: jest.fn((data) => {
        const requiredFields = ['name', 'version', 'description', 'entrypoint']
        const hasAllFields = requiredFields.every((field) => field in data)

        if (!hasAllFields) {
          return {
            success: false,
            error: { errors: [{ message: 'Missing required fields' }] },
          }
        }

        return {
          success: true,
          data,
        }
      }),
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/debug', () => {
  const mockLog = jest.fn()
  const mockDebug = jest.fn(() => ({ log: mockLog }))

  mockDebug.log = mockLog

  return {
    __esModule: true,
    default: mockDebug,
    log: mockLog,
  }
})

jest.mock('@/lib/fetch', () => ({
  __esModule: true,

  default: jest.fn(),
  withNextCache: jest.fn((fn) => fn),
}))

jest.mock('@/lib/host', () => ({
  getExternalFrontendHost: jest.fn(() => 'runtime-site.example.com'),
  getExternalStaticHost: jest.fn(() => 'runtime-static.example.com'),
  getExternalWidgetHost: jest.fn(() => 'runtime-widgets.example.com'),
}))

describe('mcp.widget', () => {
  describe('getAllowedWidgetDomains', () => {
    it('preserves the static baseline and adds runtime domains', () => {
      expect(getAllowedWidgetDomains()).toEqual(
        new Set([
          'unpkg.com',
          'cdn.jsdelivr.net',
          siteHostname,
          staticHostname,
          widgetHostname,
          'runtime-site.example.com',
          'runtime-static.example.com',
          'runtime-widgets.example.com',
        ])
      )
    })

    it('does not duplicate a runtime domain already in the baseline', () => {
      const { getExternalStaticHost } = require('@/lib/host')

      getExternalStaticHost.mockReturnValueOnce('unpkg.com')

      expect(getAllowedWidgetDomains()).toEqual(
        new Set([
          'unpkg.com',
          'cdn.jsdelivr.net',
          siteHostname,
          staticHostname,
          widgetHostname,
          'runtime-site.example.com',
          'runtime-widgets.example.com',
        ])
      )
    })
  })

  describe('parseWidgetUiValue', () => {
    it('should parse valid string widget value', () => {
      const result = parseWidgetUiValue('data-card')

      expect(result).toBe('data-card')
    })

    it('should parse valid object widget value', () => {
      const result = parseWidgetUiValue({
        widget: 'data-card',
        invokingText: 'Loading...',
        invokedText: 'Complete',
      })

      expect(result).toEqual({
        widget: 'data-card',
        invokingText: 'Loading...',
        invokedText: 'Complete',
      })
    })

    it('should parse object with optional fields', () => {
      const result = parseWidgetUiValue({
        widget: 'data-card',
        description: 'A data card widget',
        prefersBorder: true,
      })

      expect(result).toEqual({
        widget: 'data-card',
        description: 'A data card widget',
        prefersBorder: true,
      })
    })

    it('should return null for invalid widget value', () => {
      const result = parseWidgetUiValue({ invalid: 'data' })

      expect(result).toBeNull()
    })

    it('should return null for null input', () => {
      const result = parseWidgetUiValue(null)

      expect(result).toBeNull()
    })

    it('should return null for undefined input', () => {
      const result = parseWidgetUiValue(undefined)

      expect(result).toBeNull()
    })

    it('should return null for empty object', () => {
      const result = parseWidgetUiValue({})

      expect(result).toBeNull()
    })

    it('should reject invokingText longer than 64 chars', () => {
      const result = parseWidgetUiValue({
        widget: 'data-card',
        invokingText: 'a'.repeat(65),
      })

      expect(result).toBeNull()
    })

    it('should reject invokedText longer than 64 chars', () => {
      const result = parseWidgetUiValue({
        widget: 'data-card',
        invokedText: 'a'.repeat(65),
      })

      expect(result).toBeNull()
    })

    it('should accept invokingText exactly 64 chars', () => {
      const result = parseWidgetUiValue({
        widget: 'data-card',
        invokingText: 'a'.repeat(64),
      })

      expect(result).not.toBeNull()
      expect(result.invokingText).toBe('a'.repeat(64))
    })
  })

  describe('isWidgetUiConfig', () => {
    it('should return true for valid config object', () => {
      const result = isWidgetUiConfig({ widget: 'data-card' })

      expect(result).toBe(true)
    })

    it('should return false for string value', () => {
      const result = isWidgetUiConfig('data-card')

      expect(result).toBe(false)
    })

    it('should return false for null', () => {
      const result = isWidgetUiConfig(null)

      expect(result).toBe(false)
    })

    it('should return false for object without widget property', () => {
      const result = isWidgetUiConfig({ other: 'value' })

      expect(result).toBe(false)
    })
  })

  describe('normalizeWidgetUiValue', () => {
    it('should return config object as-is', () => {
      const config = { widget: 'data-card', invokingText: 'Loading' }
      const result = normalizeWidgetUiValue(config)

      expect(result).toEqual(config)
    })

    it('should convert string to config object', () => {
      const result = normalizeWidgetUiValue('data-card')

      expect(result).toEqual({ widget: 'data-card' })
    })

    it('should preserve all config properties', () => {
      const config = {
        widget: 'data-card',
        invokingText: 'Loading...',
        invokedText: 'Done',
        description: 'A widget',
        prefersBorder: true,
      }
      const result = normalizeWidgetUiValue(config)

      expect(result).toEqual(config)
    })
  })

  describe('resolveWidgetManifestUrl', () => {
    it('should return full URL unchanged', () => {
      const url = 'https://example.com/widgets/my-widget.manifest.json'
      const result = resolveWidgetManifestUrl(url)

      expect(result).toBe(url)
    })

    it('should convert shortcut to CDN URL', () => {
      const result = resolveWidgetManifestUrl('data-card')

      expect(result).toBe(
        'https://unpkg.com/mcp-widgets@latest/cdn/widgets/data-card.manifest.json'
      )
    })

    it('should handle shortcuts with hyphens', () => {
      const result = resolveWidgetManifestUrl('my-custom-widget')

      expect(result).toBe(
        'https://unpkg.com/mcp-widgets@latest/cdn/widgets/my-custom-widget.manifest.json'
      )
    })

    it('should preserve http URL', () => {
      const url = 'http://localhost:3000/widget.manifest.json'
      const result = resolveWidgetManifestUrl(url)

      expect(result).toBe(url)
    })

    it('should preserve https URL', () => {
      const url = 'https://cdn.example.com/widget.manifest.json'
      const result = resolveWidgetManifestUrl(url)

      expect(result).toBe(url)
    })
  })

  describe('getCdnBundleUrl', () => {
    it('should replace .manifest.json with .js', () => {
      const manifestUrl =
        'https://unpkg.com/mcp-widgets@latest/cdn/widgets/data-card.manifest.json'
      const result = getCdnBundleUrl(manifestUrl)

      expect(result).toBe(
        'https://unpkg.com/mcp-widgets@latest/cdn/widgets/data-card.js'
      )
    })

    it('should handle custom domain URLs', () => {
      const manifestUrl = 'https://example.com/widgets/my-widget.manifest.json'
      const result = getCdnBundleUrl(manifestUrl)

      expect(result).toBe('https://example.com/widgets/my-widget.js')
    })

    it('should handle paths without .manifest.json extension', () => {
      const manifestUrl = 'https://example.com/widgets/data-card.json'
      const result = getCdnBundleUrl(manifestUrl)

      expect(result).toBe('https://example.com/widgets/data-card.json')
    })
  })

  describe('fetchWidgetManifest', () => {
    let mockFetch

    beforeEach(() => {
      jest.clearAllMocks()
      mockFetch = require('@/lib/fetch').default
    })

    it('should fetch and parse valid manifest', async () => {
      const manifestUrl =
        'https://unpkg.com/mcp-widgets@latest/cdn/widgets/data-card.manifest.json'
      const mockManifest = {
        name: 'Data Card',
        version: '1.0.0',
        description: 'Display data in a card',
        entrypoint: 'data-card.js',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockManifest),
      })

      const result = await fetchWidgetManifest(manifestUrl)

      expect(result).toEqual(mockManifest)
      expect(mockFetch).toHaveBeenCalledWith(manifestUrl, {
        headers: { Accept: 'application/json' },
      })
    })

    it('should return cached manifest on second call', async () => {
      const manifestUrl =
        'https://unpkg.com/mcp-widgets@latest/cdn/widgets/cached-widget.manifest.json'
      const mockManifest = {
        name: 'Cached Widget',
        version: '1.0.0',
        description: 'A cached widget',
        entrypoint: 'cached-widget.js',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockManifest),
      })

      const result1 = await fetchWidgetManifest(manifestUrl)
      const result2 = await fetchWidgetManifest(manifestUrl)

      expect(result1).toEqual(mockManifest)
      expect(result2).toEqual(mockManifest)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should return null for 404 response', async () => {
      const manifestUrl = 'https://example.com/not-found.manifest.json'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await fetchWidgetManifest(manifestUrl)

      expect(result).toBeNull()
    })

    it('should return null for invalid JSON', async () => {
      const manifestUrl = 'https://example.com/invalid.manifest.json'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ invalid: 'data' }),
      })

      const result = await fetchWidgetManifest(manifestUrl)

      expect(result).toBeNull()
    })

    it('should return null for network error', async () => {
      const manifestUrl = 'https://example.com/error.manifest.json'

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchWidgetManifest(manifestUrl)

      expect(result).toBeNull()
    })

    it('should return null for JSON parse error', async () => {
      const manifestUrl = 'https://example.com/parse-error.manifest.json'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      })

      const result = await fetchWidgetManifest(manifestUrl)

      expect(result).toBeNull()
    })
  })
})
