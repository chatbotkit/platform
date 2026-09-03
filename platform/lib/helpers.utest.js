import { either } from '@/lib/helpers'

describe('either', () => {
  describe('basic functionality', () => {
    it('should return first value when defined', () => {
      expect(either('value1', 'value2')).toBe('value1')
    })

    it('should return second value when first is undefined', () => {
      expect(either(undefined, 'value2')).toBe('value2')
    })

    it('should return first value even if second is undefined', () => {
      expect(either('value1', undefined)).toBe('value1')
    })
  })

  describe('falsy value handling', () => {
    it('should return null if first value is null', () => {
      // @note null is defined, so it is returned
      expect(either(null, 'default')).toBe(null)
    })

    it('should return 0 if first value is 0', () => {
      // @note 0 is defined, so it is returned
      expect(either(0, 100)).toBe(0)
    })

    it('should return false if first value is false', () => {
      // @note false is defined, so it is returned
      expect(either(false, true)).toBe(false)
    })

    it('should return empty string if first value is empty string', () => {
      // @note empty string is defined, so it is returned
      expect(either('', 'default')).toBe('')
    })
  })

  describe('undefined handling', () => {
    it('should return second value when first is explicitly undefined', () => {
      expect(either(undefined, 'fallback')).toBe('fallback')
    })

    it('should return undefined if both values are undefined', () => {
      expect(either(undefined, undefined)).toBe(undefined)
    })
  })

  describe('complex value types', () => {
    it('should work with objects', () => {
      const obj1 = { key: 'value1' }
      const obj2 = { key: 'value2' }

      expect(either(obj1, obj2)).toBe(obj1)
    })

    it('should work with arrays', () => {
      const arr1 = [1, 2, 3]
      const arr2 = [4, 5, 6]

      expect(either(arr1, arr2)).toBe(arr1)
    })

    it('should work with functions', () => {
      const fn1 = () => 'first'
      const fn2 = () => 'second'

      expect(either(fn1, fn2)).toBe(fn1)
    })

    it('should return second value when first is undefined with complex types', () => {
      const obj = { key: 'value' }

      expect(either(undefined, obj)).toBe(obj)
    })
  })
})
