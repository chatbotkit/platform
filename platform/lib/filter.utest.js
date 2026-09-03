import {
  buildMetaQueryFilter,
  buildValueQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
  getValueQueryFilter,
} from './filter'

function createMockRequest(queryParams = {}) {
  const url = new URL('http://example.com')

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value)
  }

  return {
    url: url.toString(),
  }
}

describe('buildMetaQueryFilter', () => {
  it('returns an empty array for an empty object', () => {
    expect(buildMetaQueryFilter({})).toEqual([])
  })

  it('filters out undefined and null values', () => {
    const meta = { a: 1, b: undefined, c: null, d: 'x' }
    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.a', equals: 1 } },
      { meta: { path: '$.d', equals: 'x' } },
    ])
  })

  it('handles flat objects', () => {
    const meta = { foo: 'bar', num: 42 }
    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.foo', equals: 'bar' } },
      { meta: { path: '$.num', equals: 42 } },
    ])
  })

  it('handles nested objects', () => {
    const meta = { a: { b: { c: 'd' } }, x: 1 }
    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.a.b.c', equals: 'd' } },
      { meta: { path: '$.x', equals: 1 } },
    ])
  })

  it('handles arrays as values', () => {
    const meta = { arr: [1, 2], foo: 'bar' }
    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.arr[0]', equals: 1 } },
      { meta: { path: '$.arr[1]', equals: 2 } },
      { meta: { path: '$.foo', equals: 'bar' } },
    ])
  })

  it('handles deeply nested objects with multiple properties', () => {
    const meta = { a: { b: 1, c: { d: 2 } }, e: 3 }
    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.a.b', equals: 1 } },
      { meta: { path: '$.a.c.d', equals: 2 } },
      { meta: { path: '$.e', equals: 3 } },
    ])
  })

  it('should build filter from flat meta object with boolean', () => {
    const meta = { key1: 'value1', key2: 42, key3: true }

    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.key1', equals: 'value1' } },
      { meta: { path: '$.key2', equals: 42 } },
      { meta: { path: '$.key3', equals: true } },
    ])
  })

  it('should flatten arrays of objects with bracket notation', () => {
    const meta = {
      users: [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
      ],
    }

    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.users[0].name', equals: 'Alice' } },
      { meta: { path: '$.users[0].age', equals: 25 } },
      { meta: { path: '$.users[1].name', equals: 'Bob' } },
      { meta: { path: '$.users[1].age', equals: 30 } },
    ])
  })

  it('should handle empty arrays', () => {
    const meta = { key1: 'value1', items: [] }

    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([{ meta: { path: '$.key1', equals: 'value1' } }])
  })

  it('should handle arrays with mixed valid types', () => {
    const meta = { items: ['text', 42, true] }

    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.items[0]', equals: 'text' } },
      { meta: { path: '$.items[1]', equals: 42 } },
      { meta: { path: '$.items[2]', equals: true } },
    ])
  })

  it('should skip null values in arrays', () => {
    const meta = { items: ['valid', null, 'also-valid'] }

    const result = buildMetaQueryFilter(meta)

    expect(result).toEqual([
      { meta: { path: '$.items[0]', equals: 'valid' } },
      { meta: { path: '$.items[2]', equals: 'also-valid' } },
    ])
  })

  it('should handle mixed valid and invalid types', () => {
    const meta = {
      valid1: 'string',
      valid2: 123,
      valid3: false,
      invalid1: null,
      invalid2: undefined,
    }

    const result = buildMetaQueryFilter(meta)

    expect(result).toHaveLength(3)
    expect(result).toContainEqual({
      meta: { path: '$.valid1', equals: 'string' },
    })
    expect(result).toContainEqual({
      meta: { path: '$.valid2', equals: 123 },
    })
    expect(result).toContainEqual({
      meta: { path: '$.valid3', equals: false },
    })
  })
})

describe('getMetaQueryFilter', () => {
  describe('meta.* format for nested metadata filtering', () => {
    it('should return empty array when no meta query params are provided', () => {
      const req = createMockRequest({})
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([])
    })

    it('should return empty array when only non-meta params are provided', () => {
      const req = createMockRequest({
        botId: 'bot-123',
        contactId: 'contact-456',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([])
    })

    it('should handle single meta.* parameter', () => {
      const req = createMockRequest({
        'meta.name': 'John',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
      ])
    })

    it('should handle multiple meta.* parameters', () => {
      const req = createMockRequest({
        'meta.name': 'John',
        'meta.age': '30',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
        {
          meta: {
            path: '$.age',
            equals: '30',
          },
        },
      ])
    })

    it('should handle nested paths with meta.* format', () => {
      const req = createMockRequest({
        'meta.user.profile.name': 'Alice',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.user.profile.name',
            equals: 'Alice',
          },
        },
      ])
    })

    it('should handle boolean string values correctly', () => {
      const req = createMockRequest({
        'meta.active': 'true',
        'meta.deleted': 'false',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.active',
            equals: true,
          },
        },
        {
          meta: {
            path: '$.deleted',
            equals: false,
          },
        },
      ])
    })

    it('should preserve non-boolean string values', () => {
      const req = createMockRequest({
        'meta.status': 'active',
        'meta.type': 'user',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.status',
            equals: 'active',
          },
        },
        {
          meta: {
            path: '$.type',
            equals: 'user',
          },
        },
      ])
    })

    it('should handle numeric string values', () => {
      const req = createMockRequest({
        'meta.count': '42',
        'meta.score': '100',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.count',
            equals: '42',
          },
        },
        {
          meta: {
            path: '$.score',
            equals: '100',
          },
        },
      ])
    })

    it('should ignore empty meta.* values', () => {
      const req = createMockRequest({
        'meta.name': '',
        'meta.age': '30',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.age',
            equals: '30',
          },
        },
      ])
    })

    it('should handle mixed meta.* and non-meta parameters', () => {
      const req = createMockRequest({
        'meta.name': 'John',
        botId: 'bot-123',
        'meta.age': '30',
        contactId: 'contact-456',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
        {
          meta: {
            path: '$.age',
            equals: '30',
          },
        },
      ])
    })

    it('should handle special characters in meta keys', () => {
      const req = createMockRequest({
        'meta.user-name': 'test',
        'meta.email_address': 'test@example.com',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.user-name',
            equals: 'test',
          },
        },
        {
          meta: {
            path: '$.email_address',
            equals: 'test@example.com',
          },
        },
      ])
    })

    it('should handle deeply nested paths', () => {
      const req = createMockRequest({
        'meta.a.b.c.d.e': 'deep',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.a.b.c.d.e',
            equals: 'deep',
          },
        },
      ])
    })
  })

  describe('meta[key] format for metadata filtering', () => {
    it('should handle single meta[key] parameter', () => {
      const req = createMockRequest({
        'meta[name]': 'John',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
      ])
    })

    it('should handle multiple meta[key] parameters', () => {
      const req = createMockRequest({
        'meta[name]': 'John',
        'meta[age]': '30',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
        {
          meta: {
            path: '$.age',
            equals: '30',
          },
        },
      ])
    })

    it('should handle nested paths with meta[key] format', () => {
      const req = createMockRequest({
        'meta[user.profile.name]': 'Alice',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.user.profile.name',
            equals: 'Alice',
          },
        },
      ])
    })

    it('should handle boolean string values with meta[key] format', () => {
      const req = createMockRequest({
        'meta[active]': 'true',
        'meta[deleted]': 'false',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.active',
            equals: true,
          },
        },
        {
          meta: {
            path: '$.deleted',
            equals: false,
          },
        },
      ])
    })

    it('should preserve non-boolean string values with meta[key] format', () => {
      const req = createMockRequest({
        'meta[status]': 'active',
        'meta[type]': 'user',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.status',
            equals: 'active',
          },
        },
        {
          meta: {
            path: '$.type',
            equals: 'user',
          },
        },
      ])
    })

    it('should ignore empty meta[key] values', () => {
      const req = createMockRequest({
        'meta[name]': '',
        'meta[age]': '30',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.age',
            equals: '30',
          },
        },
      ])
    })

    it('should handle special characters in meta[key] format', () => {
      const req = createMockRequest({
        'meta[user-name]': 'test',
        'meta[email_address]': 'test@example.com',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.user-name',
            equals: 'test',
          },
        },
        {
          meta: {
            path: '$.email_address',
            equals: 'test@example.com',
          },
        },
      ])
    })

    it('should handle numeric string values with meta[key] format', () => {
      const req = createMockRequest({
        'meta[count]': '42',
        'meta[score]': '100',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.count',
            equals: '42',
          },
        },
        {
          meta: {
            path: '$.score',
            equals: '100',
          },
        },
      ])
    })
  })

  describe('mixed meta.* and meta[key] formats', () => {
    it('should handle both meta.* and meta[key] formats together', () => {
      const req = createMockRequest({
        'meta.name': 'John',
        'meta[age]': '30',
        'meta.city': 'NYC',
        'meta[country]': 'USA',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
        {
          meta: {
            path: '$.age',
            equals: '30',
          },
        },
        {
          meta: {
            path: '$.city',
            equals: 'NYC',
          },
        },
        {
          meta: {
            path: '$.country',
            equals: 'USA',
          },
        },
      ])
    })

    it('should handle same key in different formats', () => {
      const req = createMockRequest({
        'meta.name': 'John',
        'meta[name]': 'Jane',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
        {
          meta: {
            path: '$.name',
            equals: 'Jane',
          },
        },
      ])
    })

    it('should handle mixed formats with non-meta parameters', () => {
      const req = createMockRequest({
        botId: 'bot-123',
        'meta.name': 'John',
        contactId: 'contact-456',
        'meta[age]': '30',
        taskId: 'task-789',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: 'John',
          },
        },
        {
          meta: {
            path: '$.age',
            equals: '30',
          },
        },
      ])
    })
  })

  describe('edge cases and special scenarios', () => {
    it('should handle meta parameter without suffix', () => {
      const req = createMockRequest({
        meta: 'value',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([])
    })

    it('should handle malformed meta[key format without closing bracket', () => {
      const req = createMockRequest({
        'meta[name': 'John',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([])
    })

    it('should handle empty meta[key] format', () => {
      const req = createMockRequest({
        'meta[]': 'value',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.',
            equals: 'value',
          },
        },
      ])
    })

    it('should handle meta. with no key following', () => {
      const req = createMockRequest({
        'meta.': 'value',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.',
            equals: 'value',
          },
        },
      ])
    })

    it('should handle whitespace in meta values', () => {
      const req = createMockRequest({
        'meta.name': '  John Doe  ',
        'meta[age]': '  30  ',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: '  John Doe  ',
          },
        },
        {
          meta: {
            path: '$.age',
            equals: '  30  ',
          },
        },
      ])
    })

    it('should handle URL encoded special characters', () => {
      const req = createMockRequest({
        'meta.email': 'test@example.com',
        'meta[url]': 'https://example.com',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.email',
            equals: 'test@example.com',
          },
        },
        {
          meta: {
            path: '$.url',
            equals: 'https://example.com',
          },
        },
      ])
    })

    it('should handle unicode characters in meta values', () => {
      const req = createMockRequest({
        'meta.name': '日本語',
        'meta[city]': 'Москва',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.name',
            equals: '日本語',
          },
        },
        {
          meta: {
            path: '$.city',
            equals: 'Москва',
          },
        },
      ])
    })

    it('should handle numeric-only keys', () => {
      const req = createMockRequest({
        'meta.123': 'numeric-key',
        'meta[456]': 'another-numeric',
      })
      const result = getMetaQueryFilter(req)

      expect(result).toEqual([
        {
          meta: {
            path: '$.123',
            equals: 'numeric-key',
          },
        },
        {
          meta: {
            path: '$.456',
            equals: 'another-numeric',
          },
        },
      ])
    })

    it('should use first value when same key is repeated (using native Request)', () => {
      const req = new Request(
        'http://localhost?meta.tag=tag1&meta.tag=tag2&meta.tag=tag3'
      )

      const result = getMetaQueryFilter(req)

      expect(result).toEqual([{ meta: { path: '$.tag', equals: 'tag1' } }])
    })
  })

  describe('boolean conversion logic', () => {
    it('should convert string "true" to boolean true', () => {
      const req = createMockRequest({
        'meta.active': 'true',
      })
      const result = getMetaQueryFilter(req)

      expect(result[0].meta.equals).toBe(true)
      expect(typeof result[0].meta.equals).toBe('boolean')
    })

    it('should convert string "false" to boolean false', () => {
      const req = createMockRequest({
        'meta.inactive': 'false',
      })
      const result = getMetaQueryFilter(req)

      expect(result[0].meta.equals).toBe(false)
      expect(typeof result[0].meta.equals).toBe('boolean')
    })

    it('should not convert "True" or "False" with different casing', () => {
      const req = createMockRequest({
        'meta.field1': 'True',
        'meta.field2': 'False',
        'meta.field3': 'TRUE',
        'meta.field4': 'FALSE',
      })
      const result = getMetaQueryFilter(req)

      expect(result[0].meta.equals).toBe('True')
      expect(result[1].meta.equals).toBe('False')
      expect(result[2].meta.equals).toBe('TRUE')
      expect(result[3].meta.equals).toBe('FALSE')
    })

    it('should not convert boolean-like strings', () => {
      const req = createMockRequest({
        'meta.field1': 'truthy',
        'meta.field2': 'falsy',
        'meta.field3': '1',
        'meta.field4': '0',
      })
      const result = getMetaQueryFilter(req)

      expect(result[0].meta.equals).toBe('truthy')
      expect(result[1].meta.equals).toBe('falsy')
      expect(result[2].meta.equals).toBe('1')
      expect(result[3].meta.equals).toBe('0')
    })
  })

  describe('jsonpath format validation', () => {
    it('should always prefix paths with $. for meta.* format', () => {
      const req = createMockRequest({
        'meta.user': 'test',
        'meta.profile.name': 'John',
      })
      const result = getMetaQueryFilter(req)

      expect(result[0].meta.path).toBe('$.user')
      expect(result[1].meta.path).toBe('$.profile.name')

      for (const filter of result) {
        expect(filter.meta.path).toMatch(/^\$\./)
      }
    })

    it('should always prefix paths with $. for meta[key] format', () => {
      const req = createMockRequest({
        'meta[user]': 'test',
        'meta[profile.name]': 'John',
      })
      const result = getMetaQueryFilter(req)

      expect(result[0].meta.path).toBe('$.user')
      expect(result[1].meta.path).toBe('$.profile.name')

      for (const filter of result) {
        expect(filter.meta.path).toMatch(/^\$\./)
      }
    })

    it('should produce valid jsonpath format for prisma queries', () => {
      const req = createMockRequest({
        'meta.nested.field': 'value',
      })
      const result = getMetaQueryFilter(req)

      const whereClause = {
        AND: result,
      }

      expect(whereClause.AND).toContainEqual({
        meta: {
          path: '$.nested.field',
          equals: 'value',
        },
      })
    })
  })

  describe('integration with prisma json filtering', () => {
    it('should produce filter structure compatible with prisma json queries', () => {
      const req = createMockRequest({
        'meta.user.id': 'user-123',
        'meta.user.active': 'true',
      })
      const result = getMetaQueryFilter(req)

      const prismaWhere = {
        AND: result,
      }

      expect(prismaWhere).toEqual({
        AND: [
          {
            meta: {
              path: '$.user.id',
              equals: 'user-123',
            },
          },
          {
            meta: {
              path: '$.user.active',
              equals: true,
            },
          },
        ],
      })
    })

    it('should work with combined field and meta filters', () => {
      const req = createMockRequest({
        botId: 'bot-123',
        'meta.status': 'active',
        contactId: 'contact-456',
        'meta[type]': 'user',
      })

      const metaFilters = getMetaQueryFilter(req)
      const fieldFilters = getFieldQueryFilter(req, ['botId', 'contactId'])

      const combinedWhere = {
        AND: [...fieldFilters, ...metaFilters],
      }

      expect(combinedWhere.AND).toHaveLength(4)
      expect(combinedWhere.AND).toContainEqual({ botId: 'bot-123' })
      expect(combinedWhere.AND).toContainEqual({ contactId: 'contact-456' })
      expect(combinedWhere.AND).toContainEqual({
        meta: { path: '$.status', equals: 'active' },
      })
      expect(combinedWhere.AND).toContainEqual({
        meta: { path: '$.type', equals: 'user' },
      })
    })
  })
})

describe('getBlueprintIdQueryFilter', () => {
  it('should extract blueprintId from query params', () => {
    const req = new Request('http://localhost?blueprintId=blueprint-123')

    const result = getBlueprintIdQueryFilter(req)

    expect(result).toEqual([{ blueprintId: 'blueprint-123' }])
  })

  it('should return empty array when no blueprintId present', () => {
    const req = new Request('http://localhost?other=value')

    const result = getBlueprintIdQueryFilter(req)

    expect(result).toEqual([])
  })

  it('should return empty array when blueprintId is empty', () => {
    const req = new Request('http://localhost?blueprintId=')

    const result = getBlueprintIdQueryFilter(req)

    expect(result).toEqual([])
  })

  it('should handle blueprintId with special characters', () => {
    const req = new Request(
      'http://localhost?blueprintId=blueprint-123-abc_xyz'
    )

    const result = getBlueprintIdQueryFilter(req)

    expect(result).toEqual([{ blueprintId: 'blueprint-123-abc_xyz' }])
  })
})

describe('getFieldQueryFilter', () => {
  describe('current behavior', () => {
    it('should return empty array when no query params match fields', () => {
      const req = createMockRequest({ otherParam: 'value' })
      const result = getFieldQueryFilter(req, ['botId', 'contactId'])

      expect(result).toEqual([])
    })

    it('should return filters for matching query params', () => {
      const req = createMockRequest({
        botId: 'bot-123',
        contactId: 'contact-456',
        otherParam: 'ignored',
      })

      const result = getFieldQueryFilter(req, ['botId', 'contactId'])

      expect(result).toEqual([
        { botId: 'bot-123' },
        { contactId: 'contact-456' },
      ])
    })

    it('should ignore empty values', () => {
      const req = createMockRequest({
        botId: 'bot-123',
        contactId: '',
        taskId: '   ',
      })

      const result = getFieldQueryFilter(req, ['botId', 'contactId', 'taskId'])

      expect(result).toEqual([{ botId: 'bot-123' }])
    })

    it('should handle empty fields array', () => {
      const req = createMockRequest({ botId: 'bot-123' })

      const result = getFieldQueryFilter(req, [])

      expect(result).toEqual([])
    })
  })

  describe('comma-separated ID fields', () => {
    it('should use an in filter for multiple IDs', () => {
      const req = createMockRequest({ botId: 'bot-1,bot-2' })

      const result = getFieldQueryFilter(req, ['botId'])

      expect(result).toEqual([
        { botId: { in: ['bot-1', 'bot-2'] } },
      ])
    })

    it('should trim IDs and ignore empty segments', () => {
      const req = createMockRequest({ botId: 'bot-1, , bot-2,,' })

      const result = getFieldQueryFilter(req, ['botId'])

      expect(result).toEqual([
        { botId: { in: ['bot-1', 'bot-2'] } },
      ])
    })

    it('should apply ID behavior using the database field name', () => {
      const req = createMockRequest({ bot: 'bot-1,bot-2' })

      const result = getFieldQueryFilter(req, [['botId', 'bot']])

      expect(result).toEqual([
        { botId: { in: ['bot-1', 'bot-2'] } },
      ])
    })

    it('should preserve comma-separated values for non-ID fields', () => {
      const req = createMockRequest({ status: 'ready,pending' })

      const result = getFieldQueryFilter(req, ['status'])

      expect(result).toEqual([{ status: 'ready,pending' }])
    })
  })

  describe('array syntax with dbKey and queryKey composition', () => {
    it('should map query param to different database field using array syntax', () => {
      const req = createMockRequest({
        bot: 'bot-123',
      })

      const result = getFieldQueryFilter(req, [['botId', 'bot']])

      expect(result).toEqual([{ botId: 'bot-123' }])
    })

    it('should handle multiple fields with array syntax', () => {
      const req = createMockRequest({
        bot: 'bot-123',
        contact: 'contact-456',
      })

      const result = getFieldQueryFilter(req, [
        ['botId', 'bot'],
        ['contactId', 'contact'],
      ])

      expect(result).toEqual([
        { botId: 'bot-123' },
        { contactId: 'contact-456' },
      ])
    })

    it('should handle mixed array and string field syntax', () => {
      const req = createMockRequest({
        bot: 'bot-123',
        contactId: 'contact-456',
        taskId: 'task-789',
      })

      const result = getFieldQueryFilter(req, [
        ['botId', 'bot'],
        'contactId',
        ['taskId', 'task'],
      ])

      expect(result).toEqual([
        { botId: 'bot-123' },
        { contactId: 'contact-456' },
      ])
    })

    it('should ignore empty values with array syntax', () => {
      const req = createMockRequest({
        bot: '',
        contact: 'contact-456',
      })

      const result = getFieldQueryFilter(req, [
        ['botId', 'bot'],
        ['contactId', 'contact'],
      ])

      expect(result).toEqual([{ contactId: 'contact-456' }])
    })

    it('should use queryKey for lookup but dbKey for filter result', () => {
      const req = createMockRequest({
        myCustomParam: 'value-123',
      })

      const result = getFieldQueryFilter(req, [
        ['databaseFieldName', 'myCustomParam'],
      ])

      expect(result).toEqual([{ databaseFieldName: 'value-123' }])
    })

    it('should handle special characters in query param names', () => {
      const req = createMockRequest({
        'bot-id': 'bot-123',
      })

      const result = getFieldQueryFilter(req, [['botId', 'bot-id']])

      expect(result).toEqual([{ botId: 'bot-123' }])
    })

    it('should return empty array when no array syntax query params match', () => {
      const req = createMockRequest({
        otherParam: 'value',
      })

      const result = getFieldQueryFilter(req, [
        ['botId', 'bot'],
        ['contactId', 'contact'],
      ])

      expect(result).toEqual([])
    })
  })
})

describe('getValueQueryFilter', () => {
  describe('legacy upvote/downvote filters', () => {
    it('should return gte filter for upvote', () => {
      const req = createMockRequest({ value: 'upvote' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gte: 0 } }])
    })

    it('should return lt filter for downvote', () => {
      const req = createMockRequest({ value: 'downvote' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lt: 0 } }])
    })
  })

  describe('exact numeric value filters', () => {
    it('should return equals filter for exact numeric value', () => {
      const req = createMockRequest({ value: '100' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { equals: 100 } }])
    })

    it('should handle zero as exact value', () => {
      const req = createMockRequest({ value: '0' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { equals: 0 } }])
    })

    it('should handle negative numbers as exact value', () => {
      const req = createMockRequest({ value: '-50' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { equals: -50 } }])
    })

    it('should handle large numbers as exact value', () => {
      const req = createMockRequest({ value: '999999' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { equals: 999999 } }])
    })
  })

  describe('greater than filters', () => {
    it('should return gt filter for greater than operator', () => {
      const req = createMockRequest({ value: '>100' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gt: 100 } }])
    })

    it('should handle zero with greater than operator', () => {
      const req = createMockRequest({ value: '>0' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gt: 0 } }])
    })

    it('should handle large numbers with greater than operator', () => {
      const req = createMockRequest({ value: '>999999' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gt: 999999 } }])
    })

    it('should handle negative numbers with greater than', () => {
      const req = createMockRequest({ value: '>-10' })

      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gt: -10 } }])
    })
  })

  describe('greater than or equal filters', () => {
    it('should return gte filter for greater than or equal operator', () => {
      const req = createMockRequest({ value: '>=100' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gte: 100 } }])
    })

    it('should handle zero with greater than or equal operator', () => {
      const req = createMockRequest({ value: '>=0' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gte: 0 } }])
    })

    it('should handle negative numbers with greater than or equal operator', () => {
      const req = createMockRequest({ value: '>=-10' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { gte: -10 } }])
    })
  })

  describe('less than filters', () => {
    it('should return lt filter for less than operator', () => {
      const req = createMockRequest({ value: '<100' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lt: 100 } }])
    })

    it('should handle zero with less than operator', () => {
      const req = createMockRequest({ value: '<0' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lt: 0 } }])
    })

    it('should handle large numbers with less than operator', () => {
      const req = createMockRequest({ value: '<999999' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lt: 999999 } }])
    })

    it('should handle negative numbers with less than', () => {
      const req = createMockRequest({ value: '<-5' })

      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lt: -5 } }])
    })
  })

  describe('less than or equal filters', () => {
    it('should return lte filter for less than or equal operator', () => {
      const req = createMockRequest({ value: '<=100' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lte: 100 } }])
    })

    it('should handle zero with less than or equal operator', () => {
      const req = createMockRequest({ value: '<=0' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lte: 0 } }])
    })

    it('should handle negative numbers with less than or equal operator', () => {
      const req = createMockRequest({ value: '<=-5' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { lte: -5 } }])
    })
  })

  describe('edge cases and error handling', () => {
    it('should return empty array when no value parameter is provided', () => {
      const req = createMockRequest({})
      const result = getValueQueryFilter(req)

      expect(result).toEqual([])
    })

    it('should return empty array for empty value parameter', () => {
      const req = createMockRequest({ value: '' })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([])
    })

    it('should return empty array for invalid numeric formats', () => {
      const testCases = [
        'abc',
        '>abc',
        '<abc',
        '>=abc',
        '<=abc',
        'abc100',
        '100abc',
        '>>100',
        '<<100',
        '>=<=100',
        '1.5', // @note decimal numbers are not supported by parseInt
        '100.50',
        'NaN',
        'Infinity',
        '-Infinity',
        'invalid',
      ]

      for (const testValue of testCases) {
        const req = createMockRequest({ value: testValue })
        const result = getValueQueryFilter(req)

        expect(result).toEqual([])
      }
    })

    it('should handle malformed comparison operators gracefully', () => {
      const testCases = [
        '> 100', // space after operator
        '< 100',
        '>= 100',
        '<= 100',
        '=>100', // reversed operators
        '=<100',
        '><100',
        '<>100',
        '>', // partial operator
      ]

      for (const testValue of testCases) {
        const req = createMockRequest({ value: testValue })
        const result = getValueQueryFilter(req)

        expect(result).toEqual([])
      }
    })

    it('should handle special numeric strings correctly', () => {
      // @note these should be handled as invalid since they are not pure integers

      const req1 = createMockRequest({ value: '001' })
      const result1 = getValueQueryFilter(req1)

      expect(result1).toEqual([{ value: { equals: 1 } }]) // @note parseInt('001') === 1

      // all other cases should return empty arrays

      const invalidCases = ['+100', '1e2', '0x64', '0o144', '0b1100100']

      for (const testValue of invalidCases) {
        const req = createMockRequest({ value: testValue })
        const result = getValueQueryFilter(req)

        expect(result).toEqual([])
      }
    })
  })

  describe('boundary value testing', () => {
    it('should handle maximum safe integer', () => {
      const maxSafeInt = Number.MAX_SAFE_INTEGER.toString()
      const req = createMockRequest({ value: maxSafeInt })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { equals: Number.MAX_SAFE_INTEGER } }])
    })

    it('should handle minimum safe integer', () => {
      const minSafeInt = Number.MIN_SAFE_INTEGER.toString()
      const req = createMockRequest({ value: minSafeInt })
      const result = getValueQueryFilter(req)

      expect(result).toEqual([{ value: { equals: Number.MIN_SAFE_INTEGER } }])
    })

    it('should handle comparison operators with boundary values', () => {
      const req1 = createMockRequest({ value: `>=${Number.MAX_SAFE_INTEGER}` })
      const result1 = getValueQueryFilter(req1)

      expect(result1).toEqual([{ value: { gte: Number.MAX_SAFE_INTEGER } }])

      const req2 = createMockRequest({ value: `<=${Number.MIN_SAFE_INTEGER}` })
      const result2 = getValueQueryFilter(req2)

      expect(result2).toEqual([{ value: { lte: Number.MIN_SAFE_INTEGER } }])
    })
  })

  describe('integration with existing vote filtering logic', () => {
    it('should maintain backward compatibility with existing upvote/downvote logic', () => {
      // @note these tests ensure that existing API behavior is preserved

      const upvoteReq = createMockRequest({ value: 'upvote' })
      const upvoteResult = getValueQueryFilter(upvoteReq)

      expect(upvoteResult).toEqual([{ value: { gte: 0 } }])

      const downvoteReq = createMockRequest({ value: 'downvote' })
      const downvoteResult = getValueQueryFilter(downvoteReq)

      expect(downvoteResult).toEqual([{ value: { lt: 0 } }])
    })

    it('should work correctly in prisma query structure', () => {
      // @note this test verifies the filter structure matches prisma expectations

      const req = createMockRequest({ value: '>50' })
      const result = getValueQueryFilter(req)

      // @note the structure should be compatible with prisma where clauses

      const whereClause = {
        AND: [{ userId: 'test-user-id' }, ...result],
      }

      expect(whereClause.AND).toContainEqual({ value: { gt: 50 } })
    })
  })
})

describe('buildValueQueryFilter', () => {
  it('should build the same comparison filter without an HTTP request', () => {
    expect(buildValueQueryFilter('<=-10')).toEqual([
      { value: { lte: -10 } },
    ])
  })
})

describe('getCursorConstraints', () => {
  describe('default ordering without cursor', () => {
    it('should return default desc ordering without cursor', () => {
      const req = createMockRequest({})
      const result = getCursorConstraints(req)

      expect(result).toEqual({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })

    it('should use specified default order when provided', () => {
      const req = createMockRequest({})
      const result = getCursorConstraints(req, undefined, 'asc')

      expect(result).toEqual({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    })

    it('should respect order query parameter', () => {
      const req = createMockRequest({ order: 'asc' })
      const result = getCursorConstraints(req)

      expect(result).toEqual({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    })

    it('should use desc for invalid order values', () => {
      const req = createMockRequest({ order: 'invalid' })
      const result = getCursorConstraints(req)

      expect(result).toEqual({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })
  })

  describe('cursor-based pagination', () => {
    it('should include cursor and skip when cursor is provided', () => {
      const req = createMockRequest({})
      const cursor = 'cursor-123'
      const result = getCursorConstraints(req, cursor)

      expect(result).toEqual({
        cursor: { id: cursor },
        skip: 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })

    it('should trim whitespace from cursor', () => {
      const req = createMockRequest({})
      const cursor = '  cursor-123  '
      const result = getCursorConstraints(req, cursor)

      expect(result).toEqual({
        cursor: { id: 'cursor-123' },
        skip: 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })

    it('should combine order parameter with cursor', () => {
      const req = createMockRequest({ order: 'asc' })
      const cursor = 'cursor-456'
      const result = getCursorConstraints(req, cursor)

      expect(result).toEqual({
        cursor: { id: cursor },
        skip: 1,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    })

    it('should use default order with cursor when order is invalid', () => {
      const req = createMockRequest({ order: 'invalid' })
      const cursor = 'cursor-789'
      const result = getCursorConstraints(req, cursor, 'asc')

      expect(result).toEqual({
        cursor: { id: cursor },
        skip: 1,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty cursor string', () => {
      const req = createMockRequest({})
      const cursor = ''
      const result = getCursorConstraints(req, cursor)

      expect(result).toEqual({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })

    it('should handle whitespace-only cursor', () => {
      const req = createMockRequest({})
      const cursor = '   '
      const result = getCursorConstraints(req, cursor)

      expect(result).toEqual({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })

    it('should handle undefined cursor explicitly', () => {
      const req = createMockRequest({})
      const result = getCursorConstraints(req, undefined)

      expect(result).toEqual({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })

    it('should ensure id ordering follows the resolved createdAt order', () => {
      const req = createMockRequest({ order: 'asc' })
      const cursor = 'test-cursor'
      const result = getCursorConstraints(req, cursor)

      expect(result.orderBy).toContainEqual({ id: 'asc' })
      expect(result.orderBy).toContainEqual({ createdAt: 'asc' })
    })
  })
})

describe('getTakeConstraints', () => {
  describe('default behavior', () => {
    it('should return default take value when no parameter provided', () => {
      const req = createMockRequest({})
      const result = getTakeConstraints(req)

      expect(result).toEqual({ take: 100 })
    })

    it('should use custom default take when provided', () => {
      const req = createMockRequest({})
      const result = getTakeConstraints(req, 50)

      expect(result).toEqual({ take: 50 })
    })

    it('should respect valid take parameter', () => {
      const req = createMockRequest({ take: '25' })
      const result = getTakeConstraints(req)

      expect(result).toEqual({ take: 25 })
    })
  })

  describe('boundary limits', () => {
    it('should enforce minimum take value of 1', () => {
      const testCases = ['0', '-1', '-100']

      for (const take of testCases) {
        const req = createMockRequest({ take })
        const result = getTakeConstraints(req)

        if (take === '0') {
          // @note take=0 is treated as invalid and uses default
          expect(result).toEqual({ take: 100 })
        } else {
          // @note negative values are clamped to 1
          expect(result).toEqual({ take: 1 })
        }
      }
    })

    it('should enforce maximum take value of 100', () => {
      const testCases = ['101', '200', '1000', '999999']

      for (const take of testCases) {
        const req = createMockRequest({ take })
        const result = getTakeConstraints(req)

        expect(result).toEqual({ take: 100 })
      }
    })

    it('should allow boundary values of 1 and 100', () => {
      const req1 = createMockRequest({ take: '1' })
      const result1 = getTakeConstraints(req1)

      expect(result1).toEqual({ take: 1 })

      const req2 = createMockRequest({ take: '100' })
      const result2 = getTakeConstraints(req2)

      expect(result2).toEqual({ take: 100 })
    })
  })

  describe('invalid input handling', () => {
    it('should use default take for invalid numeric strings', () => {
      const testCases = [
        { input: 'abc', expected: 75 },
        { input: 'not-a-number', expected: 75 },
        { input: '10.5', expected: 10 },
        { input: '1e2', expected: 1 },
        { input: 'NaN', expected: 75 },
        { input: 'Infinity', expected: 75 },
        { input: 'invalid', expected: 75 },
      ]

      for (const { input, expected } of testCases) {
        const req = createMockRequest({ take: input })
        const result = getTakeConstraints(req, 75)

        expect(result).toEqual({ take: expected })
      }
    })

    it('should use default take for empty parameter', () => {
      const req = createMockRequest({ take: '' })
      const result = getTakeConstraints(req, 60)

      expect(result).toEqual({ take: 60 })
    })

    it('should handle special numeric formats', () => {
      // @note parseInt handles these formats differently:
      // - '+50' -> 50 (parseInt handles + prefix)
      // - '050' -> 50 (leading zeros are handled by parseInt in base 10)
      // - '0x32' -> 50 (parseInt recognizes hex prefix)
      // - '0o62' -> 0 (parseInt stops at 'o') -> treated as invalid, uses default
      // - '0b110010' -> 0 (parseInt stops at 'b') -> treated as invalid, uses default
      const testCases = [
        { input: '+50', expected: 50 },
        { input: '050', expected: 50 },
        { input: '0x32', expected: 50 },
        { input: '0o62', expected: 30 }, // parseInt returns 0, treated as invalid
        { input: '0b110010', expected: 30 }, // parseInt returns 0, treated as invalid
      ]

      for (const { input, expected } of testCases) {
        const req = createMockRequest({ take: input })
        const result = getTakeConstraints(req, 30)

        expect(result).toEqual({ take: expected })
      }
    })

    it('should parse decimal take as integer', () => {
      const req = createMockRequest({ take: '25.7' })

      const result = getTakeConstraints(req)

      expect(result).toEqual({ take: 25 })
    })
  })

  describe('integration with pagination', () => {
    it('should work correctly with memory management constraints', () => {
      // @note the max limit of 100 prevents memory issues in production
      const req = createMockRequest({ take: '500' })
      const result = getTakeConstraints(req)

      expect(result.take).toBeLessThanOrEqual(100)
      expect(result).toEqual({ take: 100 })
    })

    it('should support typical pagination use cases', () => {
      const commonPageSizes = ['10', '20', '25', '50']

      for (const take of commonPageSizes) {
        const req = createMockRequest({ take })
        const result = getTakeConstraints(req)

        expect(result).toEqual({ take: parseInt(take) })
        expect(result.take).toBeGreaterThanOrEqual(1)
      }
    })
  })
})

describe('cursor and orderBy integration', () => {
  describe('orderBy array composition', () => {
    it('should include createdAt and id ordering when no cursor is present', () => {
      const req = createMockRequest({ order: 'desc' })
      const result = getCursorConstraints(req)

      expect(result.orderBy).toHaveLength(2)
      expect(result.orderBy[0]).toEqual({ createdAt: 'desc' })
      expect(result.orderBy[1]).toEqual({ id: 'desc' })
    })

    it('should add id ordering when cursor is present for consistent pagination', () => {
      const req = createMockRequest({ order: 'asc' })
      const result = getCursorConstraints(req, 'test-cursor')

      expect(result.orderBy).toHaveLength(2)
      expect(result.orderBy[0]).toEqual({ createdAt: 'asc' })
      expect(result.orderBy[1]).toEqual({ id: 'asc' })
    })

    it('should align id ordering with createdAt ordering', () => {
      const ascReq = createMockRequest({ order: 'asc' })
      const ascResult = getCursorConstraints(ascReq, 'cursor-1')

      const descReq = createMockRequest({ order: 'desc' })
      const descResult = getCursorConstraints(descReq, 'cursor-2')

      expect(ascResult.orderBy[1]).toEqual({ id: 'asc' })
      expect(descResult.orderBy[1]).toEqual({ id: 'desc' })
    })
  })

  describe('cursor pagination flow', () => {
    it('should support typical pagination workflow', () => {
      const firstPageReq = createMockRequest({ order: 'desc' })
      const firstPageResult = getCursorConstraints(firstPageReq)

      expect(firstPageResult).toEqual({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      expect(firstPageResult).not.toHaveProperty('cursor')
      expect(firstPageResult).not.toHaveProperty('skip')

      const nextPageReq = createMockRequest({ order: 'desc' })
      const lastItemId = 'item-123'
      const nextPageResult = getCursorConstraints(nextPageReq, lastItemId)

      expect(nextPageResult).toEqual({
        cursor: { id: lastItemId },
        skip: 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    })

    it('should maintain order consistency across paginated requests', () => {
      const baseOrder = 'asc'
      const cursor1 = 'cursor-page-1'
      const cursor2 = 'cursor-page-2'

      const req1 = createMockRequest({ order: baseOrder })
      const req2 = createMockRequest({ order: baseOrder })

      const result1 = getCursorConstraints(req1, cursor1)
      const result2 = getCursorConstraints(req2, cursor2)

      expect(result1.orderBy).toEqual(result2.orderBy)
      expect(result1.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
    })
  })

  describe('combined constraints usage', () => {
    it('should work correctly with getTakeConstraints for complete pagination', () => {
      const req = createMockRequest({
        order: 'desc',
        take: '25',
      })

      const cursorConstraints = getCursorConstraints(req, 'page-cursor')
      const takeConstraints = getTakeConstraints(req)

      const queryConstraints = {
        ...cursorConstraints,
        ...takeConstraints,
      }

      expect(queryConstraints).toEqual({
        cursor: { id: 'page-cursor' },
        skip: 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 25,
      })
    })

    it('should handle edge case where take and cursor are both at boundaries', () => {
      const req = createMockRequest({
        order: 'asc',
        take: '1',
      })

      const cursorConstraints = getCursorConstraints(req, 'edge-cursor')
      const takeConstraints = getTakeConstraints(req)

      expect(cursorConstraints.orderBy).toHaveLength(2)
      expect(takeConstraints.take).toBe(1)

      const combined = { ...cursorConstraints, ...takeConstraints }

      expect(combined.take).toBe(1)
      expect(combined.skip).toBe(1)
    })
  })

  describe('orderBy consistency rules', () => {
    it('should never modify the createdAt order when cursor is added', () => {
      const ascReq = createMockRequest({ order: 'asc' })
      const descReq = createMockRequest({ order: 'desc' })

      const ascWithoutCursor = getCursorConstraints(ascReq)
      const ascWithCursor = getCursorConstraints(ascReq, 'test')

      const descWithoutCursor = getCursorConstraints(descReq)
      const descWithCursor = getCursorConstraints(descReq, 'test')

      expect(ascWithoutCursor.orderBy[0]).toEqual({ createdAt: 'asc' })
      expect(ascWithCursor.orderBy[0]).toEqual({ createdAt: 'asc' })

      expect(descWithoutCursor.orderBy[0]).toEqual({ createdAt: 'desc' })
      expect(descWithCursor.orderBy[0]).toEqual({ createdAt: 'desc' })
    })

    it('should ensure deterministic sorting for database queries', () => {
      const req = createMockRequest({ order: 'desc' })
      const result = getCursorConstraints(req, 'deterministic-cursor')

      expect(result.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
    })
  })
})
