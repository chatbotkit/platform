import {
  isDbMediumText,
  isDbString,
  isDbText,
  stringToDbString,
} from '@/lib/db.string'
import { trimToByteLength } from '@/lib/string'

jest.mock('@/prisma/constraints', () => ({
  MAX_DB_STRING_BYTES_LENGTH: 255,
  MAX_DB_TEXT_BYTES_LENGTH: 65535,
  MAX_DB_MEDIUMTEXT_BYTES_LENGTH: 16777215,
}))

jest.mock('@/lib/string', () => ({
  trimToByteLength: jest.fn((value, maxLength) => {
    if (value.length <= maxLength) {
      return value
    }

    return value.substring(0, maxLength)
  }),
}))

describe('db.string utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('stringToDbString', () => {
    it('should call trimToByteLength with default max length', () => {
      const testString = 'test string'

      stringToDbString(testString)

      expect(trimToByteLength).toHaveBeenCalledWith(testString, 255)
    })

    it('should call trimToByteLength with custom max length', () => {
      const testString = 'test string'
      const customLength = 100

      stringToDbString(testString, customLength)

      expect(trimToByteLength).toHaveBeenCalledWith(testString, customLength)
    })

    it('should return trimmed string for short input', () => {
      const testString = 'short'
      const result = stringToDbString(testString)

      expect(result).toBe('short')
    })

    it('should handle empty string', () => {
      const result = stringToDbString('')

      expect(result).toBe('')
      expect(trimToByteLength).toHaveBeenCalledWith('', 255)
    })

    it('should handle long strings', () => {
      const longString = 'a'.repeat(300)
      const result = stringToDbString(longString)

      expect(result).toBe('a'.repeat(255))
      expect(trimToByteLength).toHaveBeenCalledWith(longString, 255)
    })

    it('should handle unicode characters', () => {
      const unicodeString = '你好世界'

      stringToDbString(unicodeString)

      expect(trimToByteLength).toHaveBeenCalledWith(unicodeString, 255)
    })

    it('should handle special characters', () => {
      const specialString = '!@#$%^&*()'
      const result = stringToDbString(specialString)

      expect(result).toBe(specialString)
    })
  })

  describe('isDbString', () => {
    it('should return true for strings within limit', () => {
      expect(isDbString('short string')).toBe(true)
    })

    it('should return true for empty string', () => {
      expect(isDbString('')).toBe(true)
    })

    it('should return true for string at exact limit', () => {
      const maxString = 'a'.repeat(255)

      expect(isDbString(maxString)).toBe(true)
    })

    it('should return false for string over limit', () => {
      const overLimitString = 'a'.repeat(256)

      expect(isDbString(overLimitString)).toBe(false)
    })

    it('should return false for very long strings', () => {
      const veryLongString = 'a'.repeat(1000)

      expect(isDbString(veryLongString)).toBe(false)
    })

    it('should handle unicode strings', () => {
      const unicodeString = '你好'

      expect(isDbString(unicodeString)).toBe(true)
    })

    it('should handle newlines and whitespace', () => {
      const stringWithNewlines = 'line1\nline2\nline3'

      expect(isDbString(stringWithNewlines)).toBe(true)
    })
  })

  describe('isDbText', () => {
    it('should return true for strings within TEXT limit', () => {
      expect(isDbText('normal string')).toBe(true)
    })

    it('should return true for empty string', () => {
      expect(isDbText('')).toBe(true)
    })

    it('should return true for string at exact limit', () => {
      const maxString = 'a'.repeat(65535)

      expect(isDbText(maxString)).toBe(true)
    })

    it('should return false for string over TEXT limit', () => {
      const overLimitString = 'a'.repeat(65536)

      expect(isDbText(overLimitString)).toBe(false)
    })

    it('should return true for medium length strings', () => {
      const mediumString = 'a'.repeat(30000)

      expect(isDbText(mediumString)).toBe(true)
    })

    it('should handle strings that exceed STRING but fit in TEXT', () => {
      const longString = 'a'.repeat(1000)

      expect(isDbText(longString)).toBe(true)
    })
  })

  describe('isDbMediumText', () => {
    it('should return true for strings within MEDIUMTEXT limit', () => {
      expect(isDbMediumText('normal string')).toBe(true)
    })

    it('should return true for empty string', () => {
      expect(isDbMediumText('')).toBe(true)
    })

    it('should return true for very large strings within limit', () => {
      const largeString = 'a'.repeat(1000000)

      expect(isDbMediumText(largeString)).toBe(true)
    })

    it('should return true for string at exact limit', () => {
      const maxString = 'a'.repeat(16777215)

      expect(isDbMediumText(maxString)).toBe(true)
    })

    it('should return false for string over MEDIUMTEXT limit', () => {
      const overLimitString = 'a'.repeat(16777216)

      expect(isDbMediumText(overLimitString)).toBe(false)
    })

    it('should handle strings that exceed TEXT but fit in MEDIUMTEXT', () => {
      const longString = 'a'.repeat(100000)

      expect(isDbMediumText(longString)).toBe(true)
    })
  })

  describe('comparison of validation functions', () => {
    it('should have different thresholds for each function', () => {
      const shortString = 'a'.repeat(100)
      const mediumString = 'a'.repeat(1000)
      const longString = 'a'.repeat(100000)

      // Short string passes all
      expect(isDbString(shortString)).toBe(true)
      expect(isDbText(shortString)).toBe(true)
      expect(isDbMediumText(shortString)).toBe(true)

      // Medium string fails STRING but passes TEXT and MEDIUMTEXT
      expect(isDbString(mediumString)).toBe(false)
      expect(isDbText(mediumString)).toBe(true)
      expect(isDbMediumText(mediumString)).toBe(true)

      // Long string fails STRING and TEXT but passes MEDIUMTEXT
      expect(isDbString(longString)).toBe(false)
      expect(isDbText(longString)).toBe(false)
      expect(isDbMediumText(longString)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle strings with only whitespace', () => {
      const whitespaceString = '   '

      expect(isDbString(whitespaceString)).toBe(true)
      expect(isDbText(whitespaceString)).toBe(true)
      expect(isDbMediumText(whitespaceString)).toBe(true)
    })

    it('should handle strings with mixed content', () => {
      const mixedString = 'Text 123 !@# 你好'

      expect(isDbString(mixedString)).toBe(true)
      expect(isDbText(mixedString)).toBe(true)
      expect(isDbMediumText(mixedString)).toBe(true)
    })

    it('should handle strings with line breaks', () => {
      const multilineString = 'line1\nline2\rline3\r\nline4'

      expect(isDbString(multilineString)).toBe(true)
    })

    it('should handle strings with tabs', () => {
      const tabbedString = 'col1\tcol2\tcol3'

      expect(isDbString(tabbedString)).toBe(true)
    })
  })
})
