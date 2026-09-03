import {
  DOUBLE_QUOTE_REGEX,
  SINGLE_QUOTE_REGEX,
  UNICODE_DOUBLE_QUOTE_REGEX,
  UNICODE_SINGLE_QUOTE_REGEX,
  WHITE_SPACE_REGEX,
  escape,
  isRegexString,
  regex,
} from './index'

describe('escape', () => {
  it('should escape special regex characters', () => {
    const specialChars = '-[]/{()}*+?.\\^$|'
    const result = escape(specialChars)

    expect(result).toBe('\\-\\[\\]\\/\\{\\(\\)\\}\\*\\+\\?\\.\\\\\\^\\$\\|')
  })

  it('should leave regular characters unchanged', () => {
    const input = 'abcdefghijklmnopqrstuvwxyz123456789'
    const result = escape(input)

    expect(result).toBe(input)
  })

  it('should handle empty string', () => {
    const result = escape('')

    expect(result).toBe('')
  })

  it('should handle string with mixed regular and special characters', () => {
    const input = 'test.regex*pattern'
    const result = escape(input)

    expect(result).toBe('test\\.regex\\*pattern')
  })

  it('should handle multiple consecutive special characters', () => {
    const input = '...**++??'
    const result = escape(input)

    expect(result).toBe('\\.\\.\\.\\*\\*\\+\\+\\?\\?')
  })

  it('should handle word boundaries and anchors', () => {
    const input = '^start$'
    const result = escape(input)

    expect(result).toBe('\\^start\\$')
  })
})

describe('isRegexString', () => {
  it('should return true for valid regex string with no flags', () => {
    expect(isRegexString('/test/')).toBe(true)
  })

  it('should return true for valid regex string with single flag', () => {
    expect(isRegexString('/test/i')).toBe(true)
    expect(isRegexString('/test/g')).toBe(true)
    expect(isRegexString('/test/m')).toBe(true)
  })

  it('should return true for valid regex string with multiple flags', () => {
    expect(isRegexString('/test/gim')).toBe(true)
    expect(isRegexString('/test/ig')).toBe(true)
  })

  it('should return true for complex regex patterns', () => {
    expect(isRegexString('/^[a-zA-Z0-9]+$/')).toBe(true)
    expect(isRegexString('/\\d{3}-\\d{3}-\\d{4}/g')).toBe(true)
    expect(isRegexString('/(test|example)/i')).toBe(true)
  })

  it('should return false for regular strings', () => {
    expect(isRegexString('test')).toBe(false)
    expect(isRegexString('regular string')).toBe(false)
    expect(isRegexString('123456')).toBe(false)
  })

  it('should return false for strings starting with slash but not ending properly', () => {
    expect(isRegexString('/test')).toBe(false)
    expect(isRegexString('test/')).toBe(false)
    expect(isRegexString('/test/invalid_flag')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isRegexString('')).toBe(false)
  })

  it('should return false for just slashes', () => {
    expect(isRegexString('//')).toBe(true) // this is actually a valid empty regex
    expect(isRegexString('/')).toBe(false)
  })

  it('should handle lowercase flags only', () => {
    expect(isRegexString('/test/i')).toBe(true)
    expect(isRegexString('/test/g')).toBe(true)
    expect(isRegexString('/test/m')).toBe(true)
  })
})

describe('regex', () => {
  it('should return a regex for a string', () => {
    const input = 'test'
    const result = regex(input)

    expect(result).toBeInstanceOf(RegExp)
    expect(result.source).toBe('test')
  })

  it('should return the same regex if passed a RegExp', () => {
    const input = /test/
    const result = regex(input)

    expect(result).toBe(input)
  })

  it('should handle escaped characters', () => {
    const input = 'test\\d+'
    const result = regex(input)

    expect(result.source).toBe('test\\\\d\\+')
  })

  it('should handle regex with flags', () => {
    const input = '/test/i'
    const result = regex(input)

    expect(result.source).toBe('test')
    expect(result.flags).toBe('i')
  })

  it('should handle regex with multiple flags', () => {
    const input = '/test/gim'
    const result = regex(input)

    expect(result.source).toBe('test')
    expect(result.flags).toBe('gim')
  })

  it('should handle empty string by escaping and creating regex', () => {
    const input = ''
    const result = regex(input)

    expect(result).toBeInstanceOf(RegExp)
    expect(result.source).toBe('(?:)') // empty regex becomes (?:)
  })

  it('should handle complex regex patterns in string format', () => {
    const input = '/^[a-zA-Z0-9]+$/g'
    const result = regex(input)

    expect(result.source).toBe('^[a-zA-Z0-9]+$')
    expect(result.flags).toBe('g')
  })

  it('should auto-escape special characters for non-regex strings', () => {
    const input = 'test.regex*pattern'
    const result = regex(input)

    expect(result.source).toBe('test\\.regex\\*pattern')
  })

  it('should handle regex with escaped slashes inside', () => {
    const input = '/test\\/with\\/slashes/i'
    const result = regex(input)

    expect(result.source).toBe('test\\/with\\/slashes')
    expect(result.flags).toBe('i')
  })

  it('should handle valid lowercase flags only', () => {
    const input = '/test/i'
    const result = regex(input)

    expect(result.source).toBe('test')
    expect(result.flags).toBe('i')
  })

  it('should handle no flags in regex string', () => {
    const input = '/pattern/'
    const result = regex(input)

    expect(result.source).toBe('pattern')
    expect(result.flags).toBe('')
  })

  it('should preserve RegExp flags when passed a RegExp object', () => {
    const input = /test/gim
    const result = regex(input)

    expect(result).toBe(input)
    expect(result.flags).toBe('gim')
  })
})

describe('edge cases and error handling', () => {
  describe('escape function edge cases', () => {
    it('should handle strings with only special characters', () => {
      const input = '[]{}()*+?.\\^$|-'
      const result = escape(input)

      expect(result).toBe('\\[\\]\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|\\-')
    })

    it('should handle unicode characters mixed with special characters', () => {
      const input = 'test\\d+🚀'
      const result = escape(input)

      expect(result).toBe('test\\\\d\\+🚀')
    })
  })

  describe('isRegexString edge cases', () => {
    it('should handle various flag combinations (case insensitive)', () => {
      expect(isRegexString('/test/xyz')).toBe(true) // any letters are valid due to [a-z]* pattern
      expect(isRegexString('/test/XYZ')).toBe(true) // uppercase letters allowed due to /i flag
      expect(isRegexString('/test/GiM')).toBe(true) // mixed case allowed
    })

    it('should reject strings with numbers or special characters in flags', () => {
      expect(isRegexString('/test/12')).toBe(false) // numeric flags
      expect(isRegexString('/test/g!')).toBe(false) // special character in flags
      expect(isRegexString('/test/ ')).toBe(false) // space after flags
    })

    it('should handle strings with slashes but invalid structure', () => {
      expect(isRegexString('test/test')).toBe(false)
      expect(isRegexString('/test/test')).toBe(true) // this matches the pattern \/(.*)\/([a-z]*)
      expect(isRegexString('test/test/')).toBe(false)
    })

    it('should handle edge whitespace cases', () => {
      expect(isRegexString(' /test/i')).toBe(false) // leading space
      expect(isRegexString('/test/i ')).toBe(false) // trailing space
      expect(isRegexString('/test /i')).toBe(true) // space inside pattern is valid
    })
  })

  describe('regex function edge cases', () => {
    it('should handle strings that look like regex but will cause errors', () => {
      // The regex function doesn't validate flags, so invalid flags will throw
      // This is the actual behavior - the function trusts isRegexString
      expect(() => regex('/test/xyz')).toThrow() // invalid flags will cause RegExp constructor to throw
    })

    it('should handle complex regex patterns with special escapes', () => {
      const input = '/\\w+@\\w+\\.\\w+/g'
      const result = regex(input)

      expect(result.source).toBe('\\w+@\\w+\\.\\w+')
      expect(result.flags).toBe('g')
    })

    it('should handle regex with valid JavaScript flags only', () => {
      const input = '/test/gim' // valid JS flags
      const result = regex(input)

      expect(result.source).toBe('test')
      expect(result.flags).toBe('gim')
    })

    it('should handle very long strings', () => {
      const input = 'a'.repeat(1000)
      const result = regex(input)

      expect(result.source).toBe(input)
      expect(result).toBeInstanceOf(RegExp)
    })

    it('should handle strings with newlines and special whitespace (they get escaped)', () => {
      const input = 'test\nwith\rnewlines\tand\ttabs'
      const result = regex(input)

      // newlines and carriage returns get escaped by RegExp constructor, tabs don't
      expect(result.source).toBe('test\\nwith\\rnewlines\tand\ttabs')
    })
  })

  describe('constant regex behavior verification', () => {
    it('should verify WHITE_SPACE_REGEX matches behavior', () => {
      const testString = 'hello   world\n\r\t  test'
      const matches = testString.match(WHITE_SPACE_REGEX)

      expect(matches).not.toBeNull()
      expect(matches[0]).toBe('   ') // first whitespace sequence
    })

    it('should verify quote regexes distinguish correctly', () => {
      const testString = `"left" 'single' "right" 'test'`

      expect(testString.match(SINGLE_QUOTE_REGEX)).toBeTruthy()
      expect(testString.match(DOUBLE_QUOTE_REGEX)).toBeTruthy()
      expect(testString.match(UNICODE_SINGLE_QUOTE_REGEX)).toBeFalsy()
      expect(testString.match(UNICODE_DOUBLE_QUOTE_REGEX)).toBeFalsy()
    })

    it('should verify unicode quote regexes work with actual unicode', () => {
      const unicodeString = '\u2018hello\u2019 \u201Cworld\u201D'

      expect(unicodeString.match(UNICODE_SINGLE_QUOTE_REGEX)).toBeTruthy()
      expect(unicodeString.match(UNICODE_DOUBLE_QUOTE_REGEX)).toBeTruthy()
      expect(unicodeString.match(SINGLE_QUOTE_REGEX)).toBeTruthy() // includes unicode
      expect(unicodeString.match(DOUBLE_QUOTE_REGEX)).toBeTruthy() // includes unicode
    })
  })
})

describe('exported regex constants', () => {
  describe('WHITE_SPACE_REGEX', () => {
    it('should match whitespace characters', () => {
      expect(WHITE_SPACE_REGEX.test(' ')).toBe(true)
      expect(WHITE_SPACE_REGEX.test('\n')).toBe(true)
      expect(WHITE_SPACE_REGEX.test('\r')).toBe(true)
      expect(WHITE_SPACE_REGEX.test('\t')).toBe(true)
    })

    it('should match multiple consecutive whitespace characters', () => {
      expect(WHITE_SPACE_REGEX.test('   ')).toBe(true)
      expect(WHITE_SPACE_REGEX.test('\n\r\n')).toBe(true)
      expect(WHITE_SPACE_REGEX.test(' \t \n ')).toBe(true)
    })

    it('should not match non-whitespace characters', () => {
      expect(WHITE_SPACE_REGEX.test('a')).toBe(false)
      expect(WHITE_SPACE_REGEX.test('test')).toBe(false)
      expect(WHITE_SPACE_REGEX.test('123')).toBe(false)
    })
  })

  describe('SINGLE_QUOTE_REGEX', () => {
    it('should match regular single quote', () => {
      expect(SINGLE_QUOTE_REGEX.test("'")).toBe(true)
    })

    it('should match unicode single quotes', () => {
      expect(SINGLE_QUOTE_REGEX.test('\u2018')).toBe(true) // left single quotation mark
      expect(SINGLE_QUOTE_REGEX.test('\u2019')).toBe(true) // right single quotation mark
      expect(SINGLE_QUOTE_REGEX.test('\u201f')).toBe(true) // single high-reversed-9 quotation mark
      expect(SINGLE_QUOTE_REGEX.test('\u201e')).toBe(true) // double low-9 quotation mark
    })

    it('should not match double quotes', () => {
      expect(SINGLE_QUOTE_REGEX.test('"')).toBe(false)
    })

    it('should not match regular characters', () => {
      expect(SINGLE_QUOTE_REGEX.test('a')).toBe(false)
      expect(SINGLE_QUOTE_REGEX.test('test')).toBe(false)
    })
  })

  describe('UNICODE_SINGLE_QUOTE_REGEX', () => {
    it('should match unicode single quotes only', () => {
      expect(UNICODE_SINGLE_QUOTE_REGEX.test('\u2018')).toBe(true)
      expect(UNICODE_SINGLE_QUOTE_REGEX.test('\u2019')).toBe(true)
      expect(UNICODE_SINGLE_QUOTE_REGEX.test('\u201f')).toBe(true)
      expect(UNICODE_SINGLE_QUOTE_REGEX.test('\u201e')).toBe(true)
    })

    it('should not match regular single quote', () => {
      expect(UNICODE_SINGLE_QUOTE_REGEX.test("'")).toBe(false)
    })

    it('should not match other characters', () => {
      expect(UNICODE_SINGLE_QUOTE_REGEX.test('"')).toBe(false)
      expect(UNICODE_SINGLE_QUOTE_REGEX.test('a')).toBe(false)
    })
  })

  describe('DOUBLE_QUOTE_REGEX', () => {
    it('should match regular double quote', () => {
      expect(DOUBLE_QUOTE_REGEX.test('"')).toBe(true)
    })

    it('should match unicode double quotes', () => {
      expect(DOUBLE_QUOTE_REGEX.test('\u201C')).toBe(true) // left double quotation mark
      expect(DOUBLE_QUOTE_REGEX.test('\u201D')).toBe(true) // right double quotation mark
    })

    it('should not match single quotes', () => {
      expect(DOUBLE_QUOTE_REGEX.test("'")).toBe(false)
    })

    it('should not match regular characters', () => {
      expect(DOUBLE_QUOTE_REGEX.test('a')).toBe(false)
      expect(DOUBLE_QUOTE_REGEX.test('test')).toBe(false)
    })
  })

  describe('UNICODE_DOUBLE_QUOTE_REGEX', () => {
    it('should match unicode double quotes only', () => {
      expect(UNICODE_DOUBLE_QUOTE_REGEX.test('\u201C')).toBe(true)
      expect(UNICODE_DOUBLE_QUOTE_REGEX.test('\u201D')).toBe(true)
    })

    it('should not match regular double quote', () => {
      expect(UNICODE_DOUBLE_QUOTE_REGEX.test('"')).toBe(false)
    })

    it('should not match other characters', () => {
      expect(UNICODE_DOUBLE_QUOTE_REGEX.test("'")).toBe(false)
      expect(UNICODE_DOUBLE_QUOTE_REGEX.test('a')).toBe(false)
    })
  })
})
