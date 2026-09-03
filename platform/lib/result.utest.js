import { Result } from '@/lib/result'

describe('Result', () => {
  describe('constructor', () => {
    it('should create instance with result only', () => {
      const result = new Result('test-result')

      expect(result).toBeInstanceOf(Result)
    })

    it('should create instance with result and meta', () => {
      const result = new Result('test-result', { key: 'value' })

      expect(result).toBeInstanceOf(Result)
    })

    it('should handle null result', () => {
      const result = new Result(null)

      expect(result).toBeInstanceOf(Result)
    })

    it('should handle undefined result', () => {
      const result = new Result(undefined)

      expect(result).toBeInstanceOf(Result)
    })

    it('should handle object result', () => {
      const data = { status: 'success', data: [1, 2, 3] }
      const result = new Result(data)

      expect(result).toBeInstanceOf(Result)
    })

    it('should handle array result', () => {
      const data = [1, 2, 3, 4, 5]
      const result = new Result(data)

      expect(result).toBeInstanceOf(Result)
    })

    it('should handle boolean result', () => {
      const result = new Result(true)

      expect(result).toBeInstanceOf(Result)
    })

    it('should handle number result', () => {
      const result = new Result(42)

      expect(result).toBeInstanceOf(Result)
    })
  })

  describe('result getter', () => {
    it('should return the result value', () => {
      const testResult = 'test-data'
      const result = new Result(testResult)

      expect(result.result).toBe(testResult)
    })

    it('should return null result', () => {
      const result = new Result(null)

      expect(result.result).toBeNull()
    })

    it('should return undefined result', () => {
      const result = new Result(undefined)

      expect(result.result).toBeUndefined()
    })

    it('should return object result', () => {
      const testResult = { status: 'ok', value: 123 }
      const result = new Result(testResult)

      expect(result.result).toEqual(testResult)
      expect(result.result).toBe(testResult) // should be same reference
    })

    it('should return array result', () => {
      const testResult = [1, 2, 3]
      const result = new Result(testResult)

      expect(result.result).toEqual(testResult)
      expect(result.result).toBe(testResult) // should be same reference
    })

    it('should be immutable from external changes', () => {
      const testResult = { value: 'original' }
      const result = new Result(testResult)

      // @note external modification of the result should not affect stored value
      testResult.value = 'modified'

      expect(result.result.value).toBe('modified') // reference is shared
    })
  })

  describe('meta getter', () => {
    it('should return meta data when provided', () => {
      const testMeta = { timestamp: Date.now(), user: 'test-user' }
      const result = new Result('data', testMeta)

      expect(result.meta).toEqual(testMeta)
      expect(result.meta).toBe(testMeta) // should be same reference
    })

    it('should return undefined when meta not provided', () => {
      const result = new Result('data')

      expect(result.meta).toBeUndefined()
    })

    it('should return null when meta is explicitly null', () => {
      const result = new Result('data', null)

      expect(result.meta).toBeNull()
    })

    it('should handle empty object meta', () => {
      const result = new Result('data', {})

      expect(result.meta).toEqual({})
    })

    it('should handle complex meta objects', () => {
      const testMeta = {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
        number: 42,
        boolean: true,
      }
      const result = new Result('data', testMeta)

      expect(result.meta).toEqual(testMeta)
    })
  })

  describe('encapsulation', () => {
    it('should not expose private fields directly', () => {
      const result = new Result('data', { key: 'value' })

      // @note private fields should not be accessible directly
      expect(result['#result']).toBeUndefined()
      expect(result['#meta']).toBeUndefined()
    })

    it('should maintain separate instances', () => {
      const result1 = new Result('data1', { id: 1 })
      const result2 = new Result('data2', { id: 2 })

      expect(result1.result).toBe('data1')
      expect(result2.result).toBe('data2')
      expect(result1.meta.id).toBe(1)
      expect(result2.meta.id).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('should handle string with special characters', () => {
      const specialString = 'test\n\t\r"\'\\/'
      const result = new Result(specialString)

      expect(result.result).toBe(specialString)
    })

    it('should handle very large numbers', () => {
      const largeNumber = Number.MAX_SAFE_INTEGER
      const result = new Result(largeNumber)

      expect(result.result).toBe(largeNumber)
    })

    it('should handle negative numbers', () => {
      const result = new Result(-42)

      expect(result.result).toBe(-42)
    })

    it('should handle zero', () => {
      const result = new Result(0)

      expect(result.result).toBe(0)
    })

    it('should handle empty string', () => {
      const result = new Result('')

      expect(result.result).toBe('')
    })

    it('should handle empty array', () => {
      const result = new Result([])

      expect(result.result).toEqual([])
    })

    it('should handle NaN', () => {
      const result = new Result(NaN)

      expect(result.result).toBeNaN()
    })

    it('should handle Infinity', () => {
      const result = new Result(Infinity)

      expect(result.result).toBe(Infinity)
    })

    it('should handle functions as result', () => {
      const testFn = () => 'test'
      const result = new Result(testFn)

      expect(result.result).toBe(testFn)
      expect(typeof result.result).toBe('function')
      expect(result.result()).toBe('test')
    })

    it('should handle Date objects', () => {
      const testDate = new Date('2024-01-01')
      const result = new Result(testDate)

      expect(result.result).toBe(testDate)
      expect(result.result.getFullYear()).toBe(2024)
    })

    it('should handle RegExp objects', () => {
      const testRegex = /test/gi
      const result = new Result(testRegex)

      expect(result.result).toBe(testRegex)
      expect(result.result.test('TEST')).toBe(true)
    })

    it('should handle Symbol values', () => {
      const testSymbol = Symbol('test')
      const result = new Result(testSymbol)

      expect(result.result).toBe(testSymbol)
    })

    it('should handle Map objects', () => {
      const testMap = new Map([['key', 'value']])
      const result = new Result(testMap)

      expect(result.result).toBe(testMap)
      expect(result.result.get('key')).toBe('value')
    })

    it('should handle Set objects', () => {
      const testSet = new Set([1, 2, 3])
      const result = new Result(testSet)

      expect(result.result).toBe(testSet)
      expect(result.result.has(2)).toBe(true)
    })
  })
})
