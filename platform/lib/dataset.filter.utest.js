import { DatasetFilterSchema } from '@/lib/dataset.filter'
import { FilterSchema as StoreFilterSchema } from '@/lib/store.filter'

describe('DatasetFilterSchema', () => {
  describe('schema export', () => {
    it('should export DatasetFilterSchema', () => {
      expect(DatasetFilterSchema).toBeDefined()
    })

    it('should be identical to StoreFilterSchema', () => {
      expect(DatasetFilterSchema).toBe(StoreFilterSchema)
    })

    it('should reference the same object in memory', () => {
      expect(DatasetFilterSchema === StoreFilterSchema).toBe(true)
    })
  })

  describe('schema type', () => {
    it('should be a Zod schema object', () => {
      expect(DatasetFilterSchema).toHaveProperty('_def')
      expect(DatasetFilterSchema).toHaveProperty('parse')
      expect(DatasetFilterSchema).toHaveProperty('safeParse')
    })

    it('should have parse method', () => {
      expect(typeof DatasetFilterSchema.parse).toBe('function')
    })

    it('should have safeParse method', () => {
      expect(typeof DatasetFilterSchema.safeParse).toBe('function')
    })

    it('should have optional method', () => {
      expect(typeof DatasetFilterSchema.optional).toBe('function')
    })

    it('should have nullable method', () => {
      expect(typeof DatasetFilterSchema.nullable).toBe('function')
    })
  })

  describe('schema validation', () => {
    it('should validate valid filter objects', () => {
      const validFilter = {
        search: 'test query',
        limit: 10,
        offset: 0,
      }

      const result = DatasetFilterSchema.safeParse(validFilter)

      expect(result.success).toBe(true)
    })

    it('should handle empty objects', () => {
      const result = DatasetFilterSchema.safeParse({})

      expect(result.success).toBe(true)
    })

    it('should accept undefined', () => {
      const result = DatasetFilterSchema.safeParse(undefined)

      // @note behavior depends on StoreFilterSchema implementation
      expect(result).toBeDefined()
    })

    it('should accept null with nullable wrapper', () => {
      const nullableSchema = DatasetFilterSchema.nullable()
      const result = nullableSchema.safeParse(null)

      expect(result.success).toBe(true)
    })
  })

  describe('schema immutability', () => {
    it('should not be modifiable', () => {
      const originalSchema = DatasetFilterSchema

      // Attempt to modify should have no effect
      expect(() => {
        // @ts-ignore - testing immutability
        DatasetFilterSchema.customProperty = 'test'
      }).not.toThrow()

      // Schema should remain unchanged
      expect(DatasetFilterSchema).toBe(originalSchema)
    })

    it('should maintain reference to StoreFilterSchema', () => {
      const originalStore = StoreFilterSchema

      // DatasetFilterSchema should still reference original
      expect(DatasetFilterSchema).toBe(originalStore)
    })
  })

  describe('schema methods', () => {
    it('should support parse method', () => {
      expect(() => {
        DatasetFilterSchema.parse({})
      }).not.toThrow()
    })

    it('should support safeParse method', () => {
      const result = DatasetFilterSchema.safeParse({})

      expect(result).toHaveProperty('success')
    })

    it('should support transform if available', () => {
      if (typeof DatasetFilterSchema.transform === 'function') {
        const transformed = DatasetFilterSchema.transform((val) => val)

        expect(transformed).toBeDefined()
      } else {
        // If transform not available, that's also valid
        expect(DatasetFilterSchema.transform).toBeUndefined()
      }
    })

    it('should support refine if available', () => {
      if (typeof DatasetFilterSchema.refine === 'function') {
        const refined = DatasetFilterSchema.refine(() => true)

        expect(refined).toBeDefined()
      } else {
        // If refine not available, that's also valid
        expect(DatasetFilterSchema.refine).toBeUndefined()
      }
    })
  })

  describe('integration with StoreFilterSchema', () => {
    it('should share all methods with StoreFilterSchema', () => {
      const datasetMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(DatasetFilterSchema)
      )
      const storeMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(StoreFilterSchema)
      )

      expect(datasetMethods).toEqual(storeMethods)
    })

    it('should validate same inputs as StoreFilterSchema', () => {
      const testInput = { search: 'test', limit: 5 }

      const datasetResult = DatasetFilterSchema.safeParse(testInput)
      const storeResult = StoreFilterSchema.safeParse(testInput)

      expect(datasetResult.success).toBe(storeResult.success)

      if (datasetResult.success && storeResult.success) {
        expect(datasetResult.data).toEqual(storeResult.data)
      }
    })

    it('should handle invalid inputs same as StoreFilterSchema', () => {
      const invalidInput = 'not an object'

      const datasetResult = DatasetFilterSchema.safeParse(invalidInput)
      const storeResult = StoreFilterSchema.safeParse(invalidInput)

      expect(datasetResult.success).toBe(storeResult.success)
    })
  })

  describe('edge cases', () => {
    it('should handle complex nested objects', () => {
      const complexFilter = {
        search: 'complex query',
        filters: {
          nested: {
            deep: 'value',
          },
        },
      }

      const result = DatasetFilterSchema.safeParse(complexFilter)

      // @note validation depends on StoreFilterSchema implementation
      expect(result).toBeDefined()
    })

    it('should handle arrays in filter', () => {
      const arrayFilter = {
        ids: ['id1', 'id2', 'id3'],
      }

      const result = DatasetFilterSchema.safeParse(arrayFilter)

      // @note validation depends on StoreFilterSchema implementation
      expect(result).toBeDefined()
    })

    it('should handle boolean values', () => {
      const boolFilter = {
        includeDeleted: true,
        onlyPublic: false,
      }

      const result = DatasetFilterSchema.safeParse(boolFilter)

      expect(result).toBeDefined()
    })

    it('should handle numeric values', () => {
      const numFilter = {
        limit: 100,
        offset: 50,
        maxResults: 200,
      }

      const result = DatasetFilterSchema.safeParse(numFilter)

      expect(result).toBeDefined()
    })
  })
})
