import { APP_CONFIG_JSON_SCHEMA_BY_SLUG } from '@/lib/app.config.schemas'

function collectArrayItemShapeViolations(schema, path = 'root') {
  if (!schema || typeof schema !== 'object') {
    return []
  }

  const violations = []

  if (schema.type === 'array' && schema.items !== undefined) {
    if (!Array.isArray(schema.items)) {
      violations.push(`${path}.items`) 
    }
  }

  if (Array.isArray(schema.items)) {
    schema.items.forEach((item, index) => {
      violations.push(
        ...collectArrayItemShapeViolations(item, `${path}.items[${index}]`)
      )
    })
  }

  if (schema.properties && typeof schema.properties === 'object') {
    Object.entries(schema.properties).forEach(([key, value]) => {
      violations.push(
        ...collectArrayItemShapeViolations(value, `${path}.properties.${key}`)
      )
    })
  }

  if (Array.isArray(schema.anyOf)) {
    schema.anyOf.forEach((item, index) => {
      violations.push(
        ...collectArrayItemShapeViolations(item, `${path}.anyOf[${index}]`)
      )
    })
  }

  if (Array.isArray(schema.oneOf)) {
    schema.oneOf.forEach((item, index) => {
      violations.push(
        ...collectArrayItemShapeViolations(item, `${path}.oneOf[${index}]`)
      )
    })
  }

  return violations
}

describe('APP_CONFIG_JSON_SCHEMA_BY_SLUG normalization', () => {
  it('normalizes array nodes to use array-form items recursively', () => {
    const entries = Object.entries(APP_CONFIG_JSON_SCHEMA_BY_SLUG)

    expect(entries.length).toBeGreaterThan(0)

    for (const [slug, schema] of entries) {
      const violations = collectArrayItemShapeViolations(schema)

      expect(violations).toEqual([])
      expect(schema).toBeDefined()
      expect(typeof schema).toBe('object')
      expect(schema.type).toBe('object')
      expect(schema.properties).toBeDefined()

      if (violations.length > 0) {
        throw new Error(
          `schema normalization failed for ${slug}: ${violations.join(', ')}`
        )
      }
    }
  })
})