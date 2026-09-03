import { nullOr, undefinedOr } from '@/lib/util'

describe('util helpers', () => {
  describe('undefinedOr', () => {
    describe('basic functionality', () => {
      it('should return value when value is defined', () => {
        expect(undefinedOr('hello', 'default')).toBe('hello')
      })

      it('should return default when value is undefined', () => {
        expect(undefinedOr(undefined, 'default')).toBe('default')
      })

      it('should return value for numeric inputs', () => {
        expect(undefinedOr(42, 0)).toBe(42)
      })

      it('should return default for undefined numeric inputs', () => {
        expect(undefinedOr(undefined, 99)).toBe(99)
      })

      it('should return value for boolean inputs', () => {
        expect(undefinedOr(true, false)).toBe(true)
        expect(undefinedOr(false, true)).toBe(false)
      })

      it('should return value for object inputs', () => {
        const obj = { key: 'value' }
        const defaultObj = { key: 'default' }

        expect(undefinedOr(obj, defaultObj)).toBe(obj)
      })

      it('should return value for array inputs', () => {
        const arr = [1, 2, 3]
        const defaultArr = []

        expect(undefinedOr(arr, defaultArr)).toBe(arr)
      })
    })

    describe('edge cases', () => {
      it('should return null when value is null (not undefined)', () => {
        expect(undefinedOr(null, 'default')).toBe(null)
      })

      it('should return empty string when value is empty string', () => {
        expect(undefinedOr('', 'default')).toBe('')
      })

      it('should return 0 when value is 0', () => {
        expect(undefinedOr(0, 100)).toBe(0)
      })

      it('should return false when value is false', () => {
        expect(undefinedOr(false, true)).toBe(false)
      })

      it('should return NaN when value is NaN', () => {
        const result = undefinedOr(NaN, 0)

        expect(Number.isNaN(result)).toBe(true)
      })

      it('should return empty array when value is empty array', () => {
        const arr = []
        const result = undefinedOr(arr, [1, 2, 3])

        expect(result).toBe(arr)
        expect(result).toEqual([])
      })

      it('should return empty object when value is empty object', () => {
        const obj = {}
        const result = undefinedOr(obj, { key: 'value' })

        expect(result).toBe(obj)
        expect(result).toEqual({})
      })

      it('should handle nested undefined default values', () => {
        expect(undefinedOr(undefined, undefined)).toBe(undefined)
      })

      it('should preserve reference equality', () => {
        const obj = { key: 'value' }
        const result = undefinedOr(obj, { key: 'default' })

        expect(result).toBe(obj)
      })
    })

    describe('type preservation', () => {
      it('should preserve string type', () => {
        const result = undefinedOr('test', 'default')

        expect(typeof result).toBe('string')
      })

      it('should preserve number type', () => {
        const result = undefinedOr(123, 0)

        expect(typeof result).toBe('number')
      })

      it('should preserve boolean type', () => {
        const result = undefinedOr(true, false)

        expect(typeof result).toBe('boolean')
      })

      it('should preserve object type', () => {
        const result = undefinedOr({ key: 'value' }, {})

        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()
      })

      it('should preserve array type', () => {
        const result = undefinedOr([1, 2, 3], [])

        expect(Array.isArray(result)).toBe(true)
      })
    })
  })

  describe('nullOr', () => {
    describe('basic functionality', () => {
      it('should return value when value is not null', () => {
        expect(nullOr('hello', 'default')).toBe('hello')
      })

      it('should return default when value is null', () => {
        expect(nullOr(null, 'default')).toBe('default')
      })

      it('should return value for numeric inputs', () => {
        expect(nullOr(42, 0)).toBe(42)
      })

      it('should return default for null numeric inputs', () => {
        expect(nullOr(null, 99)).toBe(99)
      })

      it('should return value for boolean inputs', () => {
        expect(nullOr(true, false)).toBe(true)
        expect(nullOr(false, true)).toBe(false)
      })

      it('should return value for object inputs', () => {
        const obj = { key: 'value' }
        const defaultObj = { key: 'default' }

        expect(nullOr(obj, defaultObj)).toBe(obj)
      })

      it('should return value for array inputs', () => {
        const arr = [1, 2, 3]
        const defaultArr = []

        expect(nullOr(arr, defaultArr)).toBe(arr)
      })
    })

    describe('edge cases', () => {
      it('should return undefined when value is undefined (not null)', () => {
        expect(nullOr(undefined, 'default')).toBe(undefined)
      })

      it('should return empty string when value is empty string', () => {
        expect(nullOr('', 'default')).toBe('')
      })

      it('should return 0 when value is 0', () => {
        expect(nullOr(0, 100)).toBe(0)
      })

      it('should return false when value is false', () => {
        expect(nullOr(false, true)).toBe(false)
      })

      it('should return NaN when value is NaN', () => {
        const result = nullOr(NaN, 0)

        expect(Number.isNaN(result)).toBe(true)
      })

      it('should return empty array when value is empty array', () => {
        const arr = []
        const result = nullOr(arr, [1, 2, 3])

        expect(result).toBe(arr)
        expect(result).toEqual([])
      })

      it('should return empty object when value is empty object', () => {
        const obj = {}
        const result = nullOr(obj, { key: 'value' })

        expect(result).toBe(obj)
        expect(result).toEqual({})
      })

      it('should handle nested null default values', () => {
        expect(nullOr(null, null)).toBe(null)
      })

      it('should preserve reference equality', () => {
        const obj = { key: 'value' }
        const result = nullOr(obj, { key: 'default' })

        expect(result).toBe(obj)
      })
    })

    describe('type preservation', () => {
      it('should preserve string type', () => {
        const result = nullOr('test', 'default')

        expect(typeof result).toBe('string')
      })

      it('should preserve number type', () => {
        const result = nullOr(123, 0)

        expect(typeof result).toBe('number')
      })

      it('should preserve boolean type', () => {
        const result = nullOr(true, false)

        expect(typeof result).toBe('boolean')
      })

      it('should preserve object type', () => {
        const result = nullOr({ key: 'value' }, {})

        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()
      })

      it('should preserve array type', () => {
        const result = nullOr([1, 2, 3], [])

        expect(Array.isArray(result)).toBe(true)
      })
    })
  })

  describe('undefinedOr vs nullOr comparison', () => {
    it('undefinedOr should not treat null as undefined', () => {
      expect(undefinedOr(null, 'default')).toBe(null)
      expect(nullOr(null, 'default')).toBe('default')
    })

    it('nullOr should not treat undefined as null', () => {
      expect(nullOr(undefined, 'default')).toBe(undefined)
      expect(undefinedOr(undefined, 'default')).toBe('default')
    })

    it('both should handle defined non-null values the same way', () => {
      const value = 'test'
      const defaultValue = 'default'

      expect(undefinedOr(value, defaultValue)).toBe(value)
      expect(nullOr(value, defaultValue)).toBe(value)
    })

    it('both should handle falsy values (except null/undefined) the same way', () => {
      expect(undefinedOr(0, 100)).toBe(0)
      expect(nullOr(0, 100)).toBe(0)

      expect(undefinedOr(false, true)).toBe(false)
      expect(nullOr(false, true)).toBe(false)

      expect(undefinedOr('', 'default')).toBe('')
      expect(nullOr('', 'default')).toBe('')
    })
  })
})
