import {
  isArraySchema,
  isBooleanSchema,
  isNumberSchema,
  isObjectSchema,
  isStringSchema,
} from './jsonschema'

describe('JSON Schema Type Guards', () => {
  describe('isStringSchema', () => {
    it('should return true for string schema', () => {
      const schema = { type: 'string' }

      expect(isStringSchema(schema)).toBe(true)
    })

    it('should return false for non-string schema', () => {
      const schema = { type: 'number' }

      expect(isStringSchema(schema)).toBe(false)
    })

    it('should handle string schema with enum', () => {
      const schema = { type: 'string', enum: ['a', 'b', 'c'] }

      expect(isStringSchema(schema)).toBe(true)
    })
  })

  describe('isNumberSchema', () => {
    it('should return true for number schema', () => {
      const schema = { type: 'number' }

      expect(isNumberSchema(schema)).toBe(true)
    })

    it('should return false for non-number schema', () => {
      const schema = { type: 'string' }

      expect(isNumberSchema(schema)).toBe(false)
    })

    it('should handle number schema with enum', () => {
      const schema = { type: 'number', enum: [1, 2, 3] }

      expect(isNumberSchema(schema)).toBe(true)
    })
  })

  describe('isBooleanSchema', () => {
    it('should return true for boolean schema', () => {
      const schema = { type: 'boolean' }

      expect(isBooleanSchema(schema)).toBe(true)
    })

    it('should return false for non-boolean schema', () => {
      const schema = { type: 'string' }

      expect(isBooleanSchema(schema)).toBe(false)
    })
  })

  describe('isArraySchema', () => {
    it('should return true for array schema', () => {
      const schema = { type: 'array' }

      expect(isArraySchema(schema)).toBe(true)
    })

    it('should return false for non-array schema', () => {
      const schema = { type: 'object' }

      expect(isArraySchema(schema)).toBe(false)
    })

    it('should handle array schema with items', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
      }

      expect(isArraySchema(schema)).toBe(true)
    })
  })

  describe('isObjectSchema', () => {
    it('should return true for object schema', () => {
      const schema = { type: 'object' }

      expect(isObjectSchema(schema)).toBe(true)
    })

    it('should return false for non-object schema', () => {
      const schema = { type: 'array' }

      expect(isObjectSchema(schema)).toBe(false)
    })

    it('should handle object schema with properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      }

      expect(isObjectSchema(schema)).toBe(true)
    })

    it('should handle object schema with required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      }

      expect(isObjectSchema(schema)).toBe(true)
    })
  })

  describe('Type guard discrimination', () => {
    it('should correctly discriminate between different schema types', () => {
      const schemas = [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'array' },
        { type: 'object' },
      ]

      expect(isStringSchema(schemas[0])).toBe(true)
      expect(isNumberSchema(schemas[1])).toBe(true)
      expect(isBooleanSchema(schemas[2])).toBe(true)
      expect(isArraySchema(schemas[3])).toBe(true)
      expect(isObjectSchema(schemas[4])).toBe(true)
    })

    it('should handle schemas with additional properties', () => {
      const schema = {
        type: 'string',
        description: 'A test string',
        default: 'test',
      }

      expect(isStringSchema(schema)).toBe(true)
      expect(isNumberSchema(schema)).toBe(false)
    })
  })
})
