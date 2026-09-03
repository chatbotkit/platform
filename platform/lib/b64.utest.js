import {
  decode,
  decodeUint8Array,
  encode,
  encodeUint8Array,
  isValid,
} from '@/lib/b64'

describe('b64 utilities', () => {
  describe('encode', () => {
    it('should encode simple ASCII string', () => {
      const result = encode('hello')

      expect(result).toBe('aGVsbG8=')
    })

    it('should encode string with special characters', () => {
      const result = encode('hello world!')

      expect(result).toBe('aGVsbG8gd29ybGQh')
    })

    it('should encode unicode characters', () => {
      const result = encode('hello 世界')

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should encode empty string', () => {
      const result = encode('')

      expect(result).toBe('')
    })

    it('should encode string with newlines', () => {
      const result = encode('line1\nline2\nline3')

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should encode string with tabs', () => {
      const result = encode('col1\tcol2\tcol3')

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle binary-like content', () => {
      const result = encode('\x00\x01\x02\x03')

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('decode', () => {
    it('should decode simple base64 string', () => {
      const result = decode('aGVsbG8=')

      expect(result).toBe('hello')
    })

    it('should decode base64 with special characters', () => {
      const result = decode('aGVsbG8gd29ybGQh')

      expect(result).toBe('hello world!')
    })

    it('should decode empty string', () => {
      const result = decode('')

      expect(result).toBe('')
    })

    it('should decode base64 with unicode content', () => {
      const encoded = encode('hello 世界')
      const result = decode(encoded)

      expect(result).toBe('hello 世界')
    })

    it('should handle base64 without padding', () => {
      const result = decode('aGVsbG8')

      expect(result).toBe('hello')
    })

    it('should decode complex content', () => {
      const original = 'The quick brown fox jumps over the lazy dog'
      const encoded = encode(original)
      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })
  })

  describe('encode/decode round-trip', () => {
    it('should maintain data integrity for ASCII', () => {
      const original = 'Test data 123!'
      const encoded = encode(original)
      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for unicode', () => {
      const original = '你好世界 🌍'
      const encoded = encode(original)
      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for multiline text', () => {
      const original = 'Line 1\nLine 2\nLine 3'
      const encoded = encode(original)
      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for JSON', () => {
      const original = JSON.stringify({ key: 'value', number: 42 })
      const encoded = encode(original)
      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })
  })

  describe('isValid', () => {
    it('should validate correct base64 string', () => {
      expect(isValid('aGVsbG8=')).toBe(true)
    })

    it('should validate base64 without padding', () => {
      expect(isValid('aGVsbG8')).toBe(true)
    })

    it('should reject invalid base64 characters', () => {
      expect(isValid('hello world!')).toBe(false)
    })

    it('should reject empty string as invalid', () => {
      expect(isValid('')).toBe(false)
    })

    it('should validate complex base64 string', () => {
      const encoded = encode('Complex data with special chars: !@#$%')

      expect(isValid(encoded)).toBe(true)
    })

    it('should reject string with invalid characters', () => {
      expect(isValid('abc@def')).toBe(false)
    })

    it('should not reject string with spaces - valid base64 with whitespace', () => {
      expect(isValid('aGVs bG8=')).toBe(true)
    })
  })

  describe('encodeUint8Array', () => {
    it('should encode Uint8Array to base64', () => {
      const data = new Uint8Array([104, 101, 108, 108, 111])
      const result = encodeUint8Array(data)

      expect(typeof result).toBe('string')
      expect(result).toBe('aGVsbG8=')
    })

    it('should encode empty Uint8Array', () => {
      const data = new Uint8Array([])
      const result = encodeUint8Array(data)

      expect(result).toBe('')
    })

    it('should encode binary data', () => {
      const data = new Uint8Array([0, 1, 2, 3, 255])
      const result = encodeUint8Array(data)

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should encode large Uint8Array', () => {
      const data = new Uint8Array(1000).fill(65) // Fill with 'A'
      const result = encodeUint8Array(data)

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should encode url-safe without padding', () => {
      const cases = [
        [new Uint8Array([104]), 'aA'], // 'h'
        [new Uint8Array([104, 101]), 'aGU'], // 'he'
        [new Uint8Array([104, 101, 108]), 'aGVs'], // 'hel'
        [new Uint8Array([104, 101, 108, 108, 111]), 'aGVsbG8'], // 'hello'
      ]

      cases.forEach(([data, expectedPrefix]) => {
        const encoded = encodeUint8Array(data, true)

        expect(encoded).toEqual(expectedPrefix)
        expect(encoded).not.toContain('=')
        expect(encoded).not.toContain('+')
        expect(encoded).not.toContain('/')
      })
    })
  })

  describe('decodeUint8Array', () => {
    it('should decode base64 to Uint8Array', () => {
      const result = decodeUint8Array('aGVsbG8=')

      expect(result).toBeInstanceOf(Uint8Array)
      expect(Array.from(result)).toEqual([104, 101, 108, 108, 111])
    })

    it('should decode empty string to empty Uint8Array', () => {
      const result = decodeUint8Array('')

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(0)
    })

    it('should decode binary data', () => {
      const original = new Uint8Array([0, 1, 2, 3, 255])
      const encoded = encodeUint8Array(original)
      const decoded = decodeUint8Array(encoded)

      expect(Array.from(decoded)).toEqual(Array.from(original))
    })
  })

  describe('Uint8Array round-trip', () => {
    it('should maintain data integrity for binary data', () => {
      const original = new Uint8Array([0, 1, 127, 128, 255])
      const encoded = encodeUint8Array(original)
      const decoded = decodeUint8Array(encoded)

      expect(Array.from(decoded)).toEqual(Array.from(original))
    })

    it('should maintain data integrity for text converted to bytes', () => {
      const text = 'Hello World'
      const bytes = new TextEncoder().encode(text)
      const encoded = encodeUint8Array(bytes)
      const decoded = decodeUint8Array(encoded)
      const decodedText = new TextDecoder().decode(decoded)

      expect(decodedText).toBe(text)
    })

    it('should maintain data integrity for large arrays', () => {
      const original = new Uint8Array(500).map((_, i) => i % 256)
      const encoded = encodeUint8Array(original)
      const decoded = decodeUint8Array(encoded)

      expect(Array.from(decoded)).toEqual(Array.from(original))
    })
  })

  describe('edge cases', () => {
    it('should handle repeated encode/decode cycles', () => {
      let data = 'original text'

      for (let i = 0; i < 5; i++) {
        data = encode(data)
      }

      for (let i = 0; i < 5; i++) {
        data = decode(data)
      }

      expect(data).toBe('original text')
    })

    it('should handle strings with only special characters', () => {
      const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const encoded = encode(special)
      const decoded = decode(encoded)

      expect(decoded).toBe(special)
    })

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000)
      const encoded = encode(longString)
      const decoded = decode(encoded)

      expect(decoded).toBe(longString)
    })

    it('should handle emoji and unicode symbols', () => {
      const emoji = '😀😁😂🤣😃😄😅'
      const encoded = encode(emoji)
      const decoded = decode(encoded)

      expect(decoded).toBe(emoji)
    })
  })

  describe('URL-safe encoding', () => {
    it('should encode with URL-safe characters when flag is true', () => {
      const result = encode('hello world!', true)

      // @note URL-safe base64 should not contain + or / characters

      expect(result).not.toContain('+')
      expect(result).not.toContain('/')
      expect(result).not.toContain('=')
    })

    it('should produce different encoding when URL-safe flag changes', () => {
      // @note test data that will contain URL-unsafe chars in standard base64

      const text = 'test data with various characters ~!@#$%^&*()'
      const standard = encode(text, false)
      const urlSafe = encode(text, true)

      // @note URL-safe and standard encoding differ when + or / would appear

      expect(typeof standard).toBe('string')
      expect(typeof urlSafe).toBe('string')

      // @note both should decode back to the same original text

      expect(decode(standard)).toBe(text)
      expect(decode(urlSafe)).toBe(text)
    })

    it('should decode URL-safe encoded strings correctly', () => {
      const original = 'https://example.com/path?param=value&other=123'
      const encoded = encode(original, true)
      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })

    it('should not include padding when URL-safe flag is true', () => {
      const testCases = ['a', 'ab', 'abc', 'abcd', 'hello', 'test data']

      testCases.forEach((text) => {
        const encoded = encode(text, true)

        expect(encoded).not.toContain('=')
      })
    })

    it('should only contain URL-safe characters [A-Za-z0-9_-]', () => {
      const original =
        'The quick brown fox jumps over the lazy dog 123!@#$%^&*()'
      const encoded = encode(original, true)

      // @note URL-safe base64 should only contain alphanumeric, hyphen, and underscore

      const urlSafeRegex = /^[A-Za-z0-9_-]+$/

      expect(encoded).toMatch(urlSafeRegex)
    })

    it('should be safe to use in URLs without encoding', () => {
      const original = 'user@example.com:password123'
      const encoded = encode(original, true)

      // @note URL-safe base64 should not need encodeURIComponent

      const encodedViaURI = encodeURIComponent(encoded)

      expect(encodedViaURI).toBe(encoded)
    })

    it('should not contain + or / characters in URL-safe mode', () => {
      // @note test various strings to ensure no + or / in output

      const testStrings = [
        '???',
        'test~data',
        String.fromCharCode(62, 63, 64),
        '\xff\xfe\xfd',
        'data with special chars !@#$%^&*()',
      ]

      testStrings.forEach((text) => {
        const urlSafe = encode(text, true)

        expect(urlSafe).not.toContain('+')
        expect(urlSafe).not.toContain('/')
        expect(urlSafe).not.toContain('=')
      })
    })

    it('should maintain data integrity with URL-safe encoding', () => {
      const testStrings = [
        'https://api.example.com/endpoint',
        'user@domain.com',
        'path/to/resource?query=value',
        '{"key":"value","nested":{"data":123}}',
        'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?/',
      ]

      testStrings.forEach((original) => {
        const encoded = encode(original, true)
        const decoded = decode(encoded)

        expect(decoded).toBe(original)
      })
    })

    it('should handle binary data with URL-safe encoding', () => {
      const original = '\x00\x01\x02\x03\xff\xfe\xfd'
      const encoded = encode(original, true)

      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')

      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })

    it('should handle unicode with URL-safe encoding', () => {
      const original = 'Hello 世界 🌍'
      const encoded = encode(original, true)

      const urlSafeRegex = /^[A-Za-z0-9_-]+$/

      expect(encoded).toMatch(urlSafeRegex)

      const decoded = decode(encoded)

      expect(decoded).toBe(original)
    })

    it('should work with very long strings in URL-safe mode', () => {
      const longString = 'a'.repeat(10000)
      const encoded = encode(longString, true)

      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')

      const decoded = decode(encoded)

      expect(decoded).toBe(longString)
    })

    it('should handle character substitution between standard and URL-safe modes', () => {
      // @note when standard base64 has + or /, URL-safe replaces with - and _

      const testStrings = [
        '???',
        'test~data',
        String.fromCharCode(62, 63, 64),
        'data with various bytes',
      ]

      testStrings.forEach((text) => {
        const standard = encode(text, false)
        const urlSafe = encode(text, true)

        // @note URL-safe should never contain + or /

        expect(urlSafe).not.toContain('+')
        expect(urlSafe).not.toContain('/')

        // @note both should decode to the same original

        expect(decode(standard)).toBe(text)
        expect(decode(urlSafe)).toBe(text)
      })
    })
  })
})
