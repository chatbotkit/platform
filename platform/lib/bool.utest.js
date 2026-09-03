import { and, firstBoolLike, or } from '@/lib/bool'

describe('bool utilities', () => {
  describe('firstBoolLike', () => {
    describe('basic functionality', () => {
      it('should return first defined boolean value', () => {
        expect(firstBoolLike(true)).toBe(true)
        expect(firstBoolLike(false)).toBe(false)
      })

      it('should return first defined value when multiple provided', () => {
        expect(firstBoolLike(undefined, true)).toBe(true)
        expect(firstBoolLike(undefined, false)).toBe(false)
        expect(firstBoolLike(undefined, undefined, true)).toBe(true)
      })

      it('should convert string "true" to boolean true', () => {
        expect(firstBoolLike('true')).toBe(true)
      })

      it('should convert any other string to boolean false', () => {
        expect(firstBoolLike('false')).toBe(false)
        expect(firstBoolLike('False')).toBe(false)
        expect(firstBoolLike('TRUE')).toBe(false)
        expect(firstBoolLike('1')).toBe(false)
        expect(firstBoolLike('0')).toBe(false)
        expect(firstBoolLike('yes')).toBe(false)
        expect(firstBoolLike('no')).toBe(false)
        expect(firstBoolLike('')).toBe(false)
        expect(firstBoolLike('random')).toBe(false)
      })

      it('should skip undefined values and return first defined one', () => {
        expect(firstBoolLike(undefined, 'true')).toBe(true)
        expect(firstBoolLike(undefined, 'false')).toBe(false)
        expect(firstBoolLike(undefined, undefined, 'true')).toBe(true)
        expect(firstBoolLike(undefined, true, false)).toBe(true)
        expect(firstBoolLike(undefined, undefined, false, true)).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should return false when all values are undefined', () => {
        expect(firstBoolLike()).toBe(false)
        expect(firstBoolLike(undefined)).toBe(false)
        expect(firstBoolLike(undefined, undefined)).toBe(false)
        expect(firstBoolLike(undefined, undefined, undefined)).toBe(false)
      })

      it('should handle empty string as a string that converts to false', () => {
        expect(firstBoolLike('')).toBe(false)
        expect(firstBoolLike(undefined, '')).toBe(false)
      })

      it('should return null as-is when not undefined', () => {
        expect(firstBoolLike(null)).toBe(null)
        expect(firstBoolLike(undefined, null)).toBe(null)
      })

      it('should return number 0 as-is', () => {
        expect(firstBoolLike(0)).toBe(0)
        expect(firstBoolLike(undefined, 0)).toBe(0)
      })

      it('should return number 1 as-is', () => {
        expect(firstBoolLike(1)).toBe(1)
        expect(firstBoolLike(undefined, 1)).toBe(1)
      })

      it('should return objects as-is', () => {
        const obj = {}
        const arr = []

        expect(firstBoolLike(obj)).toBe(obj)
        expect(firstBoolLike(arr)).toBe(arr)
        expect(firstBoolLike(undefined, obj)).toBe(obj)
      })

      it('should prioritize earlier defined values', () => {
        expect(firstBoolLike(false, true)).toBe(false)
        expect(firstBoolLike(true, false)).toBe(true)
        expect(firstBoolLike('false', 'true')).toBe(false)
        expect(firstBoolLike('true', 'false')).toBe(true)
      })
    })

    describe('mixed types', () => {
      it('should handle mix of booleans and strings', () => {
        expect(firstBoolLike(undefined, true, 'false')).toBe(true)
        expect(firstBoolLike(undefined, false, 'true')).toBe(false)
        expect(firstBoolLike(undefined, 'true', false)).toBe(true)
        expect(firstBoolLike(undefined, 'false', true)).toBe(false)
      })

      it('should return first defined value regardless of truthiness', () => {
        expect(firstBoolLike(undefined, null, false)).toBe(null)
        expect(firstBoolLike(undefined, 0, true)).toBe(0)
        expect(firstBoolLike(undefined, '', false)).toBe(false)
      })

      it('should handle various types of values', () => {
        expect(firstBoolLike(undefined, 1, false)).toBe(1)
        expect(firstBoolLike(undefined, 'any string', false)).toBe(false)

        const obj = {}

        expect(firstBoolLike(undefined, obj, false)).toBe(obj)
      })
    })
  })

  describe('and', () => {
    describe('basic functionality', () => {
      it('should return true when all values are truthy', () => {
        expect(and(true)).toBe(true)
        expect(and(true, true)).toBe(true)
        expect(and(true, true, true)).toBe(true)
        expect(and(1, 2, 3)).toBe(true)
        expect(and('string', {}, [])).toBe(true)
      })

      it('should return false when any value is falsy', () => {
        expect(and(false)).toBe(false)
        expect(and(true, false)).toBe(false)
        expect(and(false, true)).toBe(false)
        expect(and(true, true, false)).toBe(false)
      })

      it('should return false when all values are falsy', () => {
        expect(and(false, false)).toBe(false)
        expect(and(false, false, false)).toBe(false)
        expect(and(0, null, undefined)).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should return true for empty arguments', () => {
        expect(and()).toBe(true)
      })

      it('should handle null and undefined as falsy', () => {
        expect(and(null)).toBe(false)
        expect(and(undefined)).toBe(false)
        expect(and(true, null)).toBe(false)
        expect(and(true, undefined)).toBe(false)
      })

      it('should handle zero as falsy', () => {
        expect(and(0)).toBe(false)
        expect(and(1, 0)).toBe(false)
        expect(and(0, 1)).toBe(false)
      })

      it('should handle empty string as falsy', () => {
        expect(and('')).toBe(false)
        expect(and('string', '')).toBe(false)
      })

      it('should handle NaN as falsy', () => {
        expect(and(NaN)).toBe(false)
        expect(and(true, NaN)).toBe(false)
      })
    })

    describe('mixed types', () => {
      it('should handle mix of truthy and falsy values', () => {
        expect(and(1, 'string', true, {})).toBe(true)
        expect(and(1, 'string', false, {})).toBe(false)
        expect(and(0, 'string', true, {})).toBe(false)
      })

      it('should handle arrays and objects as truthy', () => {
        expect(and([], {})).toBe(true)
        expect(and([1], { a: 1 })).toBe(true)
        expect(and([], {}, true)).toBe(true)
      })
    })
  })

  describe('or', () => {
    describe('basic functionality', () => {
      it('should return true when at least one value is truthy', () => {
        expect(or(true)).toBe(true)
        expect(or(false, true)).toBe(true)
        expect(or(true, false)).toBe(true)
        expect(or(false, false, true)).toBe(true)
      })

      it('should return false when all values are falsy', () => {
        expect(or(false)).toBe(false)
        expect(or(false, false)).toBe(false)
        expect(or(false, false, false)).toBe(false)
        expect(or(0, null, undefined, '')).toBe(false)
      })

      it('should return true when all values are truthy', () => {
        expect(or(true, true)).toBe(true)
        expect(or(1, 2, 3)).toBe(true)
        expect(or('a', 'b', 'c')).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('should return false for empty arguments', () => {
        expect(or()).toBe(false)
      })

      it('should handle null and undefined as falsy', () => {
        expect(or(null)).toBe(false)
        expect(or(undefined)).toBe(false)
        expect(or(null, undefined)).toBe(false)
        expect(or(null, undefined, false)).toBe(false)
      })

      it('should handle zero as falsy', () => {
        expect(or(0)).toBe(false)
        expect(or(0, 0, 0)).toBe(false)
      })

      it('should handle empty string as falsy', () => {
        expect(or('')).toBe(false)
        expect(or('', '', '')).toBe(false)
      })

      it('should handle NaN as falsy', () => {
        expect(or(NaN)).toBe(false)
        expect(or(NaN, NaN)).toBe(false)
      })

      it('should return true if any value is truthy despite other falsy values', () => {
        expect(or(0, 1)).toBe(true)
        expect(or(false, 'string')).toBe(true)
        expect(or(null, undefined, {}, false)).toBe(true)
      })
    })

    describe('mixed types', () => {
      it('should handle mix of truthy and falsy values', () => {
        expect(or(0, '', null, 1)).toBe(true)
        expect(or(false, false, 'string')).toBe(true)
        expect(or(0, 0, 0, true)).toBe(true)
      })

      it('should handle arrays and objects as truthy', () => {
        expect(or([], false)).toBe(true)
        expect(or(false, {})).toBe(true)
        expect(or(null, undefined, [])).toBe(true)
      })
    })
  })
})
