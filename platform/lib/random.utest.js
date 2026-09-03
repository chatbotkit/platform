import { getRandomArrayItem, getRandomNumberBetween } from './random'

describe('random', () => {
  describe('getRandomNumberBetween', () => {
    describe('basic functionality', () => {
      it('should return a number within the specified range', () => {
        const result = getRandomNumberBetween(1, 10)

        expect(result).toBeGreaterThanOrEqual(1)
        expect(result).toBeLessThanOrEqual(10)
        expect(Number.isInteger(result)).toBe(true)
      })

      it('should return the same number when min equals max', () => {
        const result = getRandomNumberBetween(5, 5)

        expect(result).toBe(5)
      })

      it('should handle negative numbers', () => {
        const result = getRandomNumberBetween(-10, -1)

        expect(result).toBeGreaterThanOrEqual(-10)
        expect(result).toBeLessThanOrEqual(-1)
      })

      it('should handle range spanning negative to positive', () => {
        const result = getRandomNumberBetween(-5, 5)

        expect(result).toBeGreaterThanOrEqual(-5)
        expect(result).toBeLessThanOrEqual(5)
      })
    })

    describe('edge cases', () => {
      it('should handle zero as min', () => {
        const result = getRandomNumberBetween(0, 10)

        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(10)
      })

      it('should handle zero as max', () => {
        const result = getRandomNumberBetween(-10, 0)

        expect(result).toBeGreaterThanOrEqual(-10)
        expect(result).toBeLessThanOrEqual(0)
      })

      it('should handle large numbers', () => {
        const result = getRandomNumberBetween(1000000, 2000000)

        expect(result).toBeGreaterThanOrEqual(1000000)
        expect(result).toBeLessThanOrEqual(2000000)
      })
    })

    describe('distribution', () => {
      it('should produce different values over multiple calls', () => {
        const results = new Set()

        for (let i = 0; i < 100; i++) {
          results.add(getRandomNumberBetween(1, 100))
        }

        // With 100 calls on 1-100 range, we should get multiple different values
        expect(results.size).toBeGreaterThan(10)
      })

      it('should include min and max values in distribution', () => {
        const results = new Set()

        for (let i = 0; i < 1000; i++) {
          results.add(getRandomNumberBetween(1, 3))
        }

        expect(results.has(1)).toBe(true)
        expect(results.has(2)).toBe(true)
        expect(results.has(3)).toBe(true)
      })
    })
  })

  describe('getRandomArrayItem', () => {
    describe('basic functionality', () => {
      it('should return an item from the array', () => {
        const items = ['a', 'b', 'c', 'd', 'e']
        const result = getRandomArrayItem(items)

        expect(items).toContain(result)
      })

      it('should return the only item in a single-item array', () => {
        const items = ['only']
        const result = getRandomArrayItem(items)

        expect(result).toBe('only')
      })

      it('should work with number arrays', () => {
        const items = [1, 2, 3, 4, 5]
        const result = getRandomArrayItem(items)

        expect(items).toContain(result)
      })

      it('should work with object arrays', () => {
        const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
        const result = getRandomArrayItem(items)

        expect(items).toContain(result)
      })
    })

    describe('edge cases', () => {
      it('should return undefined for empty array', () => {
        const result = getRandomArrayItem([])

        expect(result).toBeUndefined()
      })

      it('should return undefined for null input', () => {
        const result = getRandomArrayItem(null)

        expect(result).toBeUndefined()
      })

      it('should return undefined for undefined input', () => {
        const result = getRandomArrayItem(undefined)

        expect(result).toBeUndefined()
      })

      it('should work with arrays containing undefined values', () => {
        const items = ['a', undefined, 'c']
        const result = getRandomArrayItem(items)

        expect(items).toContain(result)
      })

      it('should work with arrays containing null values', () => {
        const items = ['a', null, 'c']
        const result = getRandomArrayItem(items)

        expect(items).toContain(result)
      })
    })

    describe('distribution', () => {
      it('should produce different items over multiple calls', () => {
        const items = ['a', 'b', 'c', 'd', 'e']
        const results = new Set()

        for (let i = 0; i < 100; i++) {
          results.add(getRandomArrayItem(items))
        }

        // With 100 calls on 5 items, we should get multiple different values
        expect(results.size).toBeGreaterThan(2)
      })

      it('should select all items given enough iterations', () => {
        const items = ['a', 'b', 'c']
        const results = new Set()

        for (let i = 0; i < 100; i++) {
          results.add(getRandomArrayItem(items))
        }

        expect(results.has('a')).toBe(true)
        expect(results.has('b')).toBe(true)
        expect(results.has('c')).toBe(true)
      })
    })
  })
})
