import { getLocale, localeToLocaleMap } from '@/lib/og'

describe('og module', () => {
  describe('localeToLocaleMap', () => {
    it('should export a locale mapping object', () => {
      expect(localeToLocaleMap).toBeDefined()
      expect(typeof localeToLocaleMap).toBe('object')
    })

    it('should contain en to en_US mapping', () => {
      expect(localeToLocaleMap.en).toBe('en_US')
    })
  })

  describe('getLocale', () => {
    it('should convert en to en_US using the map', () => {
      const result = getLocale('en')

      expect(result).toBe('en_US')
    })

    it('should replace hyphens with underscores', () => {
      const result = getLocale('en-GB')

      expect(result).toBe('en_GB')
    })

    it('should handle multiple hyphens', () => {
      const result = getLocale('zh-Hans-CN')

      expect(result).toBe('zh_Hans_CN')
    })

    it('should return original locale if not in map', () => {
      const result = getLocale('fr-FR')

      expect(result).toBe('fr_FR')
    })

    it('should apply map after hyphen replacement', () => {
      // Even if input has hyphens, map lookup happens after conversion
      const result = getLocale('en')

      expect(result).toBe('en_US')
    })

    it('should handle locale already with underscores', () => {
      const result = getLocale('de_DE')

      expect(result).toBe('de_DE')
    })

    it('should handle mixed hyphens and underscores', () => {
      const result = getLocale('es-AR_variant')

      expect(result).toBe('es_AR_variant')
    })

    it('should handle empty string', () => {
      const result = getLocale('')

      expect(result).toBe('')
    })

    it('should handle locale without region code', () => {
      const result = getLocale('fr')

      expect(result).toBe('fr')
    })

    it('should handle single character locales', () => {
      const result = getLocale('x')

      expect(result).toBe('x')
    })

    it('should preserve case sensitivity', () => {
      const result = getLocale('EN-GB')

      expect(result).toBe('EN_GB')
    })

    it('should handle numeric characters in locale', () => {
      const result = getLocale('zh-Hans-123')

      expect(result).toBe('zh_Hans_123')
    })

    it('should apply locale map only for exact matches', () => {
      // 'en-US' becomes 'en_US' but doesn't match 'en' in map
      const result = getLocale('en-US')

      expect(result).toBe('en_US')
    })

    it('should handle trailing hyphens', () => {
      const result = getLocale('en-')

      expect(result).toBe('en_')
    })

    it('should handle leading hyphens', () => {
      const result = getLocale('-en')

      expect(result).toBe('_en')
    })

    it('should handle consecutive hyphens', () => {
      const result = getLocale('en--GB')

      expect(result).toBe('en__GB')
    })
  })
})
