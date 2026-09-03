/* eslint-disable no-undef */
import {
  isParsable,
  parse,
  relaxedJsonParse,
  safeJsonParse,
  stringify,
  tryParse,
  tryStringify,
} from './index'

describe('json utilities', () => {
  describe('relaxedJsonParse', () => {
    describe('valid JSON objects', () => {
      it('should parse valid JSON object', () => {
        const result = relaxedJsonParse('{"key": "value"}')

        expect(result).toEqual({ key: 'value' })
      })

      it('should parse JSON with whitespace', () => {
        const result = relaxedJsonParse('  {"key": "value"}  ')

        expect(result).toEqual({ key: 'value' })
      })

      it('should parse nested JSON objects', () => {
        const result = relaxedJsonParse('{"outer": {"inner": "value"}}')

        expect(result).toEqual({ outer: { inner: 'value' } })
      })
    })

    describe('malformed JSON handling', () => {
      it('should handle JSON with text before opening brace', () => {
        const result = relaxedJsonParse('some text {"key": "value"}')

        expect(result).toEqual({ key: 'value' })
      })

      it('should handle JSON with text after closing brace', () => {
        const result = relaxedJsonParse('{"key": "value"} trailing text')

        expect(result).toEqual({ key: 'value' })
      })

      it('should return null for JSON with text both before and after', () => {
        // @note relaxedJsonParse only handles text before OR after, not both
        const result = relaxedJsonParse('prefix {"key": "value"} suffix')

        expect(result).toBeNull()
      })

      it('should return null for multiple closing braces', () => {
        // @note trimToLastOccurrence includes all trailing braces, making invalid JSON
        const result = relaxedJsonParse('{"key": "value"}}}')

        expect(result).toBeNull()
      })

      it('should return null for multiple opening braces', () => {
        // @note trimToFirstOccurrence keeps all leading braces, making invalid JSON
        const result = relaxedJsonParse('{{{{"key": "value"}')

        expect(result).toBeNull()
      })
    })

    describe('invalid input handling', () => {
      it('should return null for completely invalid JSON', () => {
        const result = relaxedJsonParse('not json at all')

        expect(result).toBeNull()
      })

      it('should return null for empty string', () => {
        const result = relaxedJsonParse('')

        expect(result).toBeNull()
      })

      it('should return null for only whitespace', () => {
        const result = relaxedJsonParse('   ')

        expect(result).toBeNull()
      })

      it('should return null for incomplete JSON', () => {
        const result = relaxedJsonParse('{"key":')

        expect(result).toBeNull()
      })

      it('should return null for malformed JSON', () => {
        const result = relaxedJsonParse('{key: value}')

        expect(result).toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should handle JSON arrays', () => {
        const result = relaxedJsonParse('[1, 2, 3]')

        expect(result).toEqual([1, 2, 3])
      })

      it('should handle JSON primitives', () => {
        expect(relaxedJsonParse('123')).toBe(123)
        expect(relaxedJsonParse('"string"')).toBe('string')
        expect(relaxedJsonParse('true')).toBe(true)
        expect(relaxedJsonParse('false')).toBe(false)
        expect(relaxedJsonParse('null')).toBeNull()
      })

      it('should handle empty object', () => {
        const result = relaxedJsonParse('{}')

        expect(result).toEqual({})
      })

      it('should handle empty array', () => {
        const result = relaxedJsonParse('[]')

        expect(result).toEqual([])
      })
    })
  })

  describe('safeJsonParse', () => {
    describe('valid input', () => {
      it('should parse valid JSON string', () => {
        const result = safeJsonParse('{"key": "value"}')

        expect(result).toEqual({ key: 'value' })
      })

      it('should parse JSON arrays', () => {
        const result = safeJsonParse('[1, 2, 3]')

        expect(result).toEqual([1, 2, 3])
      })

      it('should parse JSON primitives', () => {
        expect(safeJsonParse('123')).toBe(123)
        expect(safeJsonParse('"test"')).toBe('test')
        expect(safeJsonParse('true')).toBe(true)
      })
    })

    describe('invalid input handling', () => {
      it('should return null for invalid JSON', () => {
        const result = safeJsonParse('invalid json')

        expect(result).toBeNull()
      })

      it('should return null for malformed JSON', () => {
        const result = safeJsonParse('{key: value}')

        expect(result).toBeNull()
      })

      it('should return null for incomplete JSON', () => {
        const result = safeJsonParse('{"key":')

        expect(result).toBeNull()
      })

      it('should return null for empty string', () => {
        const result = safeJsonParse('')

        expect(result).toBeNull()
      })

      it('should return null for undefined', () => {
        const result = safeJsonParse(undefined)

        expect(result).toBeNull()
      })

      it('should return null for null', () => {
        const result = safeJsonParse(null)

        expect(result).toBeNull()
      })
    })
  })

  describe('parse', () => {
    it('should parse valid JSON', () => {
      const result = parse('{"key": "value"}')

      expect(result).toEqual({ key: 'value' })
    })

    it('should throw on invalid JSON', () => {
      expect(() => parse('invalid')).toThrow()
    })

    it('should parse primitives', () => {
      expect(parse('123')).toBe(123)
      expect(parse('"string"')).toBe('string')
      expect(parse('true')).toBe(true)
    })
  })

  describe('tryParse', () => {
    describe('valid input', () => {
      it('should parse valid JSON string', () => {
        const result = tryParse('{"key": "value"}')

        expect(result).toEqual({ key: 'value' })
      })

      it('should parse JSON arrays', () => {
        const result = tryParse('[1, 2, 3]')

        expect(result).toEqual([1, 2, 3])
      })
    })

    describe('invalid input handling', () => {
      it('should return null for invalid JSON', () => {
        const result = tryParse('invalid')

        expect(result).toBeNull()
      })

      it('should return null for malformed JSON', () => {
        const result = tryParse('{key: value}')

        expect(result).toBeNull()
      })

      it('should return null for empty string', () => {
        const result = tryParse('')

        expect(result).toBeNull()
      })
    })
  })

  describe('stringify', () => {
    describe('standard objects', () => {
      it('should stringify objects', () => {
        const result = stringify({ key: 'value' })

        expect(result).toBe('{"key":"value"}')
      })

      it('should stringify arrays', () => {
        const result = stringify([1, 2, 3])

        expect(result).toBe('[1,2,3]')
      })

      it('should stringify primitives', () => {
        expect(stringify(123)).toBe('123')
        expect(stringify('string')).toBe('"string"')
        expect(stringify(true)).toBe('true')
        expect(stringify(null)).toBe('null')
      })

      it('should stringify nested objects', () => {
        const result = stringify({ outer: { inner: 'value' } })

        expect(result).toBe('{"outer":{"inner":"value"}}')
      })
    })

    describe('BigInt handling', () => {
      it('should convert small BigInt to Number', () => {
        const result = stringify({ value: BigInt(123) })

        expect(result).toBe('{"value":123}')
      })

      it('should convert large safe BigInt to Number', () => {
        const safeBigInt = BigInt(Number.MAX_SAFE_INTEGER)
        const result = stringify({ value: safeBigInt })

        expect(result).toBe(`{"value":${Number.MAX_SAFE_INTEGER}}`)
      })

      it('should append n to BigInt larger than MAX_SAFE_INTEGER', () => {
        const largeBigInt = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)
        const result = stringify({ value: largeBigInt })

        expect(result).toBe(`{"value":"${largeBigInt.toString()}n"}`)
      })

      it('should handle multiple BigInt values', () => {
        const result = stringify({
          small: BigInt(100),
          large: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
        })

        expect(result).toContain('"small":100')
        expect(result).toContain(
          `"large":"${(
            BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)
          ).toString()}n"`
        )
      })

      it('should handle BigInt in arrays', () => {
        const result = stringify([BigInt(1), BigInt(2), BigInt(3)])

        expect(result).toBe('[1,2,3]')
      })
    })

    describe('edge cases', () => {
      it('should handle empty object', () => {
        const result = stringify({})

        expect(result).toBe('{}')
      })

      it('should handle empty array', () => {
        const result = stringify([])

        expect(result).toBe('[]')
      })

      it('should handle undefined in object', () => {
        const result = stringify({ key: undefined })

        expect(result).toBe('{}')
      })

      it('should handle undefined in array', () => {
        const result = stringify([1, undefined, 3])

        expect(result).toBe('[1,null,3]')
      })

      it('should handle functions in object', () => {
        const result = stringify({ key: () => {} })

        expect(result).toBe('{}')
      })
    })
  })

  describe('tryStringify', () => {
    describe('valid input', () => {
      it('should stringify objects', () => {
        const result = tryStringify({ key: 'value' })

        expect(result).toBe('{"key":"value"}')
      })

      it('should stringify arrays', () => {
        const result = tryStringify([1, 2, 3])

        expect(result).toBe('[1,2,3]')
      })

      it('should stringify primitives', () => {
        expect(tryStringify(123)).toBe('123')
        expect(tryStringify('string')).toBe('"string"')
      })

      it('should handle BigInt', () => {
        const result = tryStringify({ value: BigInt(123) })

        expect(result).toBe('{"value":123}')
      })
    })

    describe('invalid input handling', () => {
      it('should return empty string for circular references', () => {
        const circular = {}

        circular.self = circular

        const result = tryStringify(circular)

        expect(result).toBe('')
      })

      it('should handle objects with toJSON that throws', () => {
        const obj = {
          toJSON() {
            throw new Error('toJSON error')
          },
        }
        const result = tryStringify(obj)

        expect(result).toBe('')
      })
    })

    describe('edge cases', () => {
      it('should return undefined for undefined input', () => {
        // @note JSON.stringify(undefined) returns undefined (not a string), and doesn't throw
        const result = tryStringify(undefined)

        expect(result).toBeUndefined()
      })
    })
  })

  describe('isParsable', () => {
    describe('parsable input', () => {
      it('should return true for valid JSON object', () => {
        expect(isParsable('{"key": "value"}')).toBe(true)
      })

      it('should return true for valid JSON array', () => {
        expect(isParsable('[1, 2, 3]')).toBe(true)
      })

      it('should return true for JSON primitives', () => {
        expect(isParsable('123')).toBe(true)
        expect(isParsable('"string"')).toBe(true)
        expect(isParsable('true')).toBe(true)
        expect(isParsable('false')).toBe(true)
        expect(isParsable('null')).toBe(true)
      })

      it('should return true for empty object', () => {
        expect(isParsable('{}')).toBe(true)
      })

      it('should return true for empty array', () => {
        expect(isParsable('[]')).toBe(true)
      })
    })

    describe('non-parsable input', () => {
      it('should return false for invalid JSON', () => {
        expect(isParsable('invalid')).toBe(false)
      })

      it('should return false for malformed JSON', () => {
        expect(isParsable('{key: value}')).toBe(false)
      })

      it('should return false for incomplete JSON', () => {
        expect(isParsable('{"key":')).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(isParsable('')).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isParsable(undefined)).toBe(false)
      })

      it('should return false for trailing comma', () => {
        expect(isParsable('{"key": "value",}')).toBe(false)
      })
    })
  })
})
