import { isParsable, parse, stringify } from '@/lib/query'

describe('query utilities', () => {
  describe('parse', () => {
    describe('basic parsing', () => {
      it('should parse simple query string', () => {
        const result = parse('key1=value1&key2=value2')

        expect(result).toEqual({
          key1: 'value1',
          key2: 'value2',
        })
      })

      it('should parse single parameter', () => {
        const result = parse('key=value')

        expect(result).toEqual({
          key: 'value',
        })
      })

      it('should handle empty value', () => {
        const result = parse('key=')

        expect(result).toEqual({
          key: '',
        })
      })

      it('should handle missing equals sign', () => {
        const result = parse('key')

        expect(result).toEqual({
          key: '',
        })
      })
    })

    describe('special characters and encoding', () => {
      it('should decode URL-encoded values', () => {
        const result = parse('name=John%20Doe&email=test%40example.com')

        expect(result).toEqual({
          name: 'John Doe',
          email: 'test@example.com',
        })
      })

      it('should handle plus signs as spaces', () => {
        const result = parse('text=hello+world')

        expect(result).toEqual({
          text: 'hello world',
        })
      })

      it('should decode special characters', () => {
        const result = parse('symbols=%21%40%23%24%25')

        expect(result).toEqual({
          symbols: '!@#$%',
        })
      })

      it('should handle unicode characters', () => {
        const result = parse('text=%E2%9C%93&emoji=%F0%9F%91%8D')

        expect(result).toEqual({
          text: '✓',
          emoji: '👍',
        })
      })
    })

    describe('duplicate keys', () => {
      it('should keep last value for duplicate keys', () => {
        const result = parse('key=first&key=second&key=third')

        expect(result).toEqual({
          key: 'third',
        })
      })
    })

    describe('edge cases', () => {
      it('should return empty object for empty string', () => {
        const result = parse('')

        expect(result).toEqual({})
      })

      it('should handle query string with leading question mark', () => {
        const result = parse('?key1=value1&key2=value2')

        expect(result).toEqual({
          key1: 'value1',
          key2: 'value2',
        })
      })

      it('should handle multiple ampersands', () => {
        const result = parse('key1=value1&&key2=value2')

        expect(result).toEqual({
          key1: 'value1',
          key2: 'value2',
        })
      })

      it('should handle trailing ampersand', () => {
        const result = parse('key1=value1&')

        expect(result).toEqual({
          key1: 'value1',
        })
      })
    })
  })

  describe('stringify', () => {
    describe('basic stringification', () => {
      it('should stringify simple object', () => {
        const result = stringify({
          key1: 'value1',
          key2: 'value2',
        })

        expect(result).toBe('key1=value1&key2=value2')
      })

      it('should stringify single parameter', () => {
        const result = stringify({
          key: 'value',
        })

        expect(result).toBe('key=value')
      })

      it('should handle empty value', () => {
        const result = stringify({
          key: '',
        })

        expect(result).toBe('key=')
      })
    })

    describe('special characters and encoding', () => {
      it('should encode special characters', () => {
        const result = stringify({
          name: 'John Doe',
          email: 'test@example.com',
        })

        expect(result).toBe('name=John+Doe&email=test%40example.com')
      })

      it('should encode symbols', () => {
        const result = stringify({
          symbols: '!@#$%',
        })

        expect(result).toBe('symbols=%21%40%23%24%25')
      })

      it('should encode unicode characters', () => {
        const result = stringify({
          text: '✓',
          emoji: '👍',
        })

        expect(result).toBe('text=%E2%9C%93&emoji=%F0%9F%91%8D')
      })
    })

    describe('edge cases', () => {
      it('should return empty string for empty object', () => {
        const result = stringify({})

        expect(result).toBe('')
      })

      it('should maintain consistent order for same object', () => {
        const obj = {
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
        }

        const result1 = stringify(obj)
        const result2 = stringify(obj)

        expect(result1).toBe(result2)
      })
    })

    describe('round-trip consistency', () => {
      it('should maintain data through parse-stringify cycle', () => {
        const original = {
          name: 'John Doe',
          email: 'test@example.com',
          age: '30',
        }

        const stringified = stringify(original)
        const parsed = parse(stringified)

        expect(parsed).toEqual(original)
      })

      it('should maintain data through stringify-parse cycle', () => {
        const original = 'name=John+Doe&email=test%40example.com'

        const parsed = parse(original)
        const stringified = stringify(parsed)
        const reParsed = parse(stringified)

        expect(reParsed).toEqual(parse(original))
      })
    })
  })

  describe('isParsable', () => {
    describe('valid query strings', () => {
      it('should return true for valid query string', () => {
        expect(isParsable('key1=value1&key2=value2')).toBe(true)
      })

      it('should return true for empty string', () => {
        expect(isParsable('')).toBe(true)
      })

      it('should return true for single parameter', () => {
        expect(isParsable('key=value')).toBe(true)
      })

      it('should return true for query string with special characters', () => {
        expect(isParsable('key=%20%21%40')).toBe(true)
      })

      it('should return true for query string with leading question mark', () => {
        expect(isParsable('?key=value')).toBe(true)
      })

      it('should return true for parameters without values', () => {
        expect(isParsable('key1&key2')).toBe(true)
      })

      it('should return true for complex query strings', () => {
        expect(isParsable('a=1&b=2&c=hello+world&d=%40test&e=&f')).toBe(true)
      })
    })

    describe('URLSearchParams compatibility', () => {
      it('should accept all strings that URLSearchParams accepts', () => {
        const testStrings = [
          '',
          'simple=value',
          'a=1&b=2&c=3',
          'key',
          'key=',
          '=value',
          '?key=value',
          'unicode=%E2%9C%93',
          'spaces=hello+world',
          'special=%21%40%23',
        ]

        testStrings.forEach((str) => {
          expect(isParsable(str)).toBe(true)
        })
      })
    })
  })
})
