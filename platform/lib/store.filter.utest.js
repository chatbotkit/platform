import { FilterSchema } from '@/lib/store.filter'

describe('FilterSchema', () => {
  describe('direct value filters', () => {
    it('should validate string filter', () => {
      const filter = { name: 'John' }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: 'John' })
    })

    it('should validate number filter', () => {
      const filter = { age: 25 }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ age: 25 })
    })

    it('should validate boolean filter', () => {
      const filter = { active: true }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ active: true })
    })

    it('should validate boolean false filter', () => {
      const filter = { archived: false }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ archived: false })
    })

    it('should validate multiple direct values', () => {
      const filter = {
        name: 'Alice',
        age: 30,
        active: true,
      }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(filter)
    })
  })

  describe('$eq operator', () => {
    it('should validate $eq with string', () => {
      const filter = { name: { $eq: 'John' } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ name: { $eq: 'John' } })
    })

    it('should validate $eq with number', () => {
      const filter = { count: { $eq: 42 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ count: { $eq: 42 } })
    })

    it('should validate $eq with boolean', () => {
      const filter = { enabled: { $eq: true } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ enabled: { $eq: true } })
    })

    it('should validate $eq with zero', () => {
      const filter = { value: { $eq: 0 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ value: { $eq: 0 } })
    })

    it('should validate $eq with empty string', () => {
      const filter = { text: { $eq: '' } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ text: { $eq: '' } })
    })
  })

  describe('$ne operator', () => {
    it('should validate $ne with string', () => {
      const filter = { status: { $ne: 'deleted' } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ status: { $ne: 'deleted' } })
    })

    it('should validate $ne with number', () => {
      const filter = { score: { $ne: 0 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ score: { $ne: 0 } })
    })

    it('should validate $ne with boolean', () => {
      const filter = { archived: { $ne: true } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ archived: { $ne: true } })
    })
  })

  describe('$gt operator', () => {
    it('should validate $gt with positive number', () => {
      const filter = { age: { $gt: 18 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ age: { $gt: 18 } })
    })

    it('should validate $gt with zero', () => {
      const filter = { balance: { $gt: 0 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ balance: { $gt: 0 } })
    })

    it('should validate $gt with negative number', () => {
      const filter = { temperature: { $gt: -10 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ temperature: { $gt: -10 } })
    })

    it('should validate $gt with decimal', () => {
      const filter = { price: { $gt: 9.99 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ price: { $gt: 9.99 } })
    })

    it('should reject $gt with string', () => {
      const filter = { value: { $gt: 'invalid' } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })
  })

  describe('$gte operator', () => {
    it('should validate $gte with number', () => {
      const filter = { minAge: { $gte: 21 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ minAge: { $gte: 21 } })
    })

    it('should validate $gte with zero', () => {
      const filter = { quantity: { $gte: 0 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ quantity: { $gte: 0 } })
    })
  })

  describe('$lt operator', () => {
    it('should validate $lt with positive number', () => {
      const filter = { maxAge: { $lt: 65 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ maxAge: { $lt: 65 } })
    })

    it('should validate $lt with negative number', () => {
      const filter = { debt: { $lt: -1000 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ debt: { $lt: -1000 } })
    })

    it('should reject $lt with boolean', () => {
      const filter = { value: { $lt: true } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })
  })

  describe('$lte operator', () => {
    it('should validate $lte with number', () => {
      const filter = { limit: { $lte: 100 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ limit: { $lte: 100 } })
    })

    it('should validate $lte with large number', () => {
      const filter = { max: { $lte: 1000000 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ max: { $lte: 1000000 } })
    })
  })

  describe('complex filters', () => {
    it('should validate multiple fields with different operators', () => {
      const filter = {
        name: 'John',
        age: { $gte: 18 },
        score: { $lt: 100 },
        active: true,
        status: { $ne: 'deleted' },
      }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(filter)
    })

    it('should validate mix of direct and operator filters', () => {
      const filter = {
        category: 'electronics',
        price: { $gt: 100 },
        inStock: true,
        rating: { $gte: 4 },
      }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(filter)
    })

    it('should validate range filters with multiple operators', () => {
      const filter = {
        temperature: { $gt: 0 },
        humidity: { $lte: 80 },
      }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(filter)
    })
  })

  describe('edge cases', () => {
    it('should validate empty filter object', () => {
      const filter = {}
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({})
    })

    it('should validate field with special characters', () => {
      const filter = { 'field-name': 'value' }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ 'field-name': 'value' })
    })

    it('should validate field with dot notation', () => {
      const filter = { 'user.email': 'test@example.com' }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ 'user.email': 'test@example.com' })
    })

    it('should validate very long field names', () => {
      const longFieldName = 'a'.repeat(100)
      const filter = { [longFieldName]: 'value' }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ [longFieldName]: 'value' })
    })
  })

  describe('invalid filters', () => {
    it('should reject null value', () => {
      const filter = { field: null }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject undefined value', () => {
      const filter = { field: undefined }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject array value', () => {
      const filter = { field: ['value1', 'value2'] }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject object without operator', () => {
      const filter = { field: { invalid: 'operator' } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject multiple operators in single field', () => {
      const filter = { field: { $gt: 10, $lt: 20 } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject invalid operator', () => {
      const filter = { field: { $invalid: 'value' } }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject string as filter root', () => {
      const filter = 'invalid'
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject number as filter root', () => {
      const filter = 123
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })

    it('should reject array as filter root', () => {
      const filter = ['field', 'value']
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(false)
    })
  })

  describe('type coercion', () => {
    it('should not coerce string to number', () => {
      const filter = { age: '25' }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data.age).toBe('25')
      expect(typeof result.data.age).toBe('string')
    })

    it('should not coerce number to string', () => {
      const filter = { name: 123 }
      const result = FilterSchema.safeParse(filter)

      expect(result.success).toBe(true)
      expect(result.data.name).toBe(123)
      expect(typeof result.data.name).toBe('number')
    })
  })
})
