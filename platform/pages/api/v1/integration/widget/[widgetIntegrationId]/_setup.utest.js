/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, {
  doSetup,
  getLanguageMap,
} from '@/pages/api/v1/integration/widget/[widgetIntegrationId]/setup'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/intl', () => ({
  getFastTranslationMap: jest.fn(),
  clearFastTranslationMap: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
  withGet: (fn) => fn,
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/debug', () => {
  const logger = { log: jest.fn() }
  const debug = jest.fn(() => logger)

  return {
    __esModule: true,
    default: debug,
  }
})

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
  SystemError: class SystemError extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  },
}))

jest.mock('@/lib/response', () => {
  const actual = jest.requireActual('@/lib/response')

  return {
    ...actual,
    respondFromError: jest.fn(() => ({ status: 500, json: async () => ({}) })),
  }
})

describe('getLanguageMap', () => {
  const { getFastTranslationMap, clearFastTranslationMap } =
    jest.requireMock('@/lib/intl')

  const baseWidget = {
    id: 'widget-123',
    title: 'My Widget',
    placeholder: 'Type a message...',
    intro: 'Hello! How can I help?',
    initial: 'Hi there',
    language: '',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getFastTranslationMap.mockResolvedValue({})
    clearFastTranslationMap.mockResolvedValue(undefined)
  })

  describe('no languages configured', () => {
    it('returns only default map when language is empty string', async () => {
      const result = await getLanguageMap({ ...baseWidget, language: '' })

      expect(result).toEqual(
        expect.objectContaining({
          default: expect.any(Object),
        })
      )
      expect(getFastTranslationMap).not.toHaveBeenCalled()
    })

    it('returns only default map when language is null', async () => {
      const result = await getLanguageMap({ ...baseWidget, language: null })

      expect(result).toHaveProperty('default')
      expect(getFastTranslationMap).not.toHaveBeenCalled()
    })
  })

  describe('default map content', () => {
    it('includes widget title in default map', async () => {
      const result = await getLanguageMap(baseWidget)

      expect(result.default.title).toBe(baseWidget.title)
    })

    it('includes widget placeholder in default map', async () => {
      const result = await getLanguageMap(baseWidget)

      expect(result.default.placeholder).toBe(baseWidget.placeholder)
    })

    it('includes intro in default map', async () => {
      const result = await getLanguageMap(baseWidget)

      expect(result.default.intro).toBe(baseWidget.intro)
    })

    it('includes initial message in default map', async () => {
      const result = await getLanguageMap(baseWidget)

      expect(result.default.initial).toBe(baseWidget.initial)
    })

    it('includes standard UI strings in default map', async () => {
      const result = await getLanguageMap(baseWidget)

      const { default: map } = result

      expect(map.confirmYes).toBe('Yes')
      expect(map.confirmNo).toBe('No')
      expect(map.restart).toBe('Restart')
      expect(map.language).toBe('Language')
      expect(map.export).toBe('Export')
    })
  })

  describe('language parsing', () => {
    it('calls getFastTranslationMap when languages are configured', async () => {
      getFastTranslationMap.mockResolvedValue({ en: { title: 'My Widget' } })

      await getLanguageMap({ ...baseWidget, language: 'en' })

      expect(getFastTranslationMap).toHaveBeenCalled()
    })

    it('passes lowercased language codes to getFastTranslationMap', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: 'EN,FR' })

      expect(getFastTranslationMap).toHaveBeenCalledWith(
        ['en', 'fr'],
        expect.anything(),
        expect.anything()
      )
    })

    it('trims whitespace from language codes', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: ' en , fr ' })

      expect(getFastTranslationMap).toHaveBeenCalledWith(
        ['en', 'fr'],
        expect.anything(),
        expect.anything()
      )
    })

    it('filters out empty language entries from comma-separated list', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: 'en,,fr' })

      expect(getFastTranslationMap).toHaveBeenCalledWith(
        ['en', 'fr'],
        expect.anything(),
        expect.anything()
      )
    })

    it('uses widget id as unique key for translation cache', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: 'en' })

      expect(getFastTranslationMap).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          unique: `widget-integration-${baseWidget.id}`,
        })
      )
    })
  })

  describe('translation results merged into output', () => {
    it('merges translated maps alongside the default map', async () => {
      const frMap = { title: 'Mon Widget' }

      getFastTranslationMap.mockResolvedValue({ fr: frMap })

      const result = await getLanguageMap({ ...baseWidget, language: 'fr' })

      expect(result.default).toBeDefined()
      expect(result.fr).toEqual(frMap)
    })
  })

  describe('error handling', () => {
    it('captures exception and returns default map when translation fails', async () => {
      getFastTranslationMap.mockRejectedValue(
        new Error('Translation service unavailable')
      )

      const result = await getLanguageMap({ ...baseWidget, language: 'en' })

      const { captureException } = jest.requireMock('@/lib/error')

      expect(captureException).toHaveBeenCalled()
      // Default map is still returned despite the translation failure
      expect(result).toHaveProperty('default')
    })

    it('does not rethrow translation errors', async () => {
      getFastTranslationMap.mockRejectedValue(new Error('Network error'))

      await expect(
        getLanguageMap({ ...baseWidget, language: 'en' })
      ).resolves.toBeDefined()
    })
  })

  describe('force mode', () => {
    it('clears translation cache when force is true', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: 'en' }, true)

      expect(clearFastTranslationMap).toHaveBeenCalled()
    })

    it('does not clear translation cache when force is false', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: 'en' }, false)

      expect(clearFastTranslationMap).not.toHaveBeenCalled()
    })

    it('does not clear translation cache when force is omitted', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: 'en' })

      expect(clearFastTranslationMap).not.toHaveBeenCalled()
    })

    it('passes same unique key to both clear and get calls', async () => {
      getFastTranslationMap.mockResolvedValue({})

      await getLanguageMap({ ...baseWidget, language: 'en' }, true)

      const clearArgs = clearFastTranslationMap.mock.calls[0]
      const getArgs = getFastTranslationMap.mock.calls[0]

      expect(clearArgs[2].unique).toBe(getArgs[2].unique)
    })
  })
})

describe('doSetup', () => {
  const { getFastTranslationMap, clearFastTranslationMap } =
    jest.requireMock('@/lib/intl')

  const baseWidget = {
    id: 'widget-123',
    title: 'My Widget',
    placeholder: 'Ask me anything',
    language: 'en',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getFastTranslationMap.mockResolvedValue({})
    clearFastTranslationMap.mockResolvedValue(undefined)
  })

  it('calls getLanguageMap with force=true to refresh translation cache', async () => {
    await doSetup(baseWidget)

    // Force mode is indicated by clearFastTranslationMap being called
    expect(clearFastTranslationMap).toHaveBeenCalled()
  })

  it('resolves without returning a value', async () => {
    const result = await doSetup(baseWidget)

    expect(result).toBeUndefined()
  })
})

describe('POST /api/v1/integration/widget/[widgetIntegrationId]/setup', () => {
  const { getFastTranslationMap, clearFastTranslationMap } =
    jest.requireMock('@/lib/intl')

  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
    getFastTranslationMap.mockResolvedValue({})
    clearFastTranslationMap.mockResolvedValue(undefined)
  })

  it('returns 404 when integration is not found', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const req = { query: { widgetIntegrationId: 'nonexistent' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(404)
  })

  it('returns 403 when user does not own the integration', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget-123',
      userId: 'other-user',
      title: 'Widget',
      language: '',
    })

    const req = { query: { widgetIntegrationId: 'widget-123' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(403)
  })

  it('returns 200 with widget integration id on success', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget-123',
      userId: 'user-123',
      title: 'Widget',
      language: 'en',
    })

    const req = { query: { widgetIntegrationId: 'widget-123' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ id: 'widget-123' })
  })
})
