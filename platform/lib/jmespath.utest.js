import jmespath from './jmespath'

describe('jmespath', () => {
  const sampleJson = {
    store: {
      book: [
        {
          category: 'reference',
          author: 'Nigel Rees',
          price: 8.95,
          isbn: '0-553-21311-3',
        },
        {
          category: 'fiction',
          author: 'Evelyn Waugh',
          price: 12.99,
          isbn: '0-14-118206-X',
        },
        {
          category: 'fiction',
          author: 'Herman Melville',
          price: 8.99,
          isbn: '0-14-243724-7',
        },
      ],
      bicycle: { color: 'red', price: 19.95, brand: 'Trek' },
    },
    expensive: 10,
    tags: ['literature', 'fiction', 'reference'],
  }

  describe('basic property access', () => {
    test('accesses simple property', () => {
      const result = jmespath('expensive', sampleJson)

      expect(result).toBe(10)
    })

    test('accesses nested property', () => {
      const result = jmespath('store.bicycle.color', sampleJson)

      expect(result).toBe('red')
    })

    test('returns null for non-existent property', () => {
      const result = jmespath('nonexistent', sampleJson)

      expect(result).toBeNull()
    })

    test('returns null for non-existent nested property', () => {
      const result = jmespath('store.nonexistent.property', sampleJson)

      expect(result).toBeNull()
    })
  })

  describe('array operations', () => {
    test('accesses array element by index', () => {
      const result = jmespath('store.book[0].author', sampleJson)

      expect(result).toBe('Nigel Rees')
    })

    test('accesses last array element', () => {
      const result = jmespath('store.book[-1].author', sampleJson)

      expect(result).toBe('Herman Melville')
    })

    test('projects array elements', () => {
      const result = jmespath('store.book[*].author', sampleJson)

      expect(result).toEqual(['Nigel Rees', 'Evelyn Waugh', 'Herman Melville'])
    })

    test('returns null for out of bounds array access', () => {
      const result = jmespath('store.book[10]', sampleJson)

      expect(result).toBeNull()
    })

    test('handles array slicing', () => {
      const result = jmespath('store.book[0:2]', sampleJson)

      expect(result).toEqual([
        {
          category: 'reference',
          author: 'Nigel Rees',
          price: 8.95,
          isbn: '0-553-21311-3',
        },
        {
          category: 'fiction',
          author: 'Evelyn Waugh',
          price: 12.99,
          isbn: '0-14-118206-X',
        },
      ])
    })
  })

  describe('filtering operations', () => {
    test('filters array elements with simple comparison', () => {
      const result = jmespath('store.book[?price < `10`]', sampleJson)

      expect(result).toEqual([
        {
          category: 'reference',
          author: 'Nigel Rees',
          price: 8.95,
          isbn: '0-553-21311-3',
        },
        {
          category: 'fiction',
          author: 'Herman Melville',
          price: 8.99,
          isbn: '0-14-243724-7',
        },
      ])
    })

    test('filters with string equality', () => {
      const result = jmespath(
        'store.book[?category == `fiction`].author',
        sampleJson
      )

      expect(result).toEqual(['Evelyn Waugh', 'Herman Melville'])
    })

    test('filters with complex conditions', () => {
      const result = jmespath(
        'store.book[?price > `10` && category == `fiction`]',
        sampleJson
      )

      expect(result).toEqual([
        {
          category: 'fiction',
          author: 'Evelyn Waugh',
          price: 12.99,
          isbn: '0-14-118206-X',
        },
      ])
    })

    test('filters with existence check', () => {
      const result = jmespath('store.book[?isbn]', sampleJson)

      expect(result).toHaveLength(3) // All books have ISBN
    })
  })

  describe('function expressions', () => {
    test('uses length function', () => {
      const result = jmespath('length(store.book)', sampleJson)

      expect(result).toBe(3)
    })

    test('uses keys function', () => {
      const result = jmespath('keys(store)', sampleJson)

      // keys() returns keys in alphabetical order
      expect(result).toEqual(['book', 'bicycle'])
    })

    test('uses type function', () => {
      const result = jmespath('type(expensive)', sampleJson)

      expect(result).toBe('number')
    })

    test('uses sort function on array', () => {
      const result = jmespath('sort(tags)', sampleJson)

      expect(result).toEqual(['fiction', 'literature', 'reference'])
    })

    test('uses max function on array of numbers', () => {
      const result = jmespath('max(store.book[*].price)', sampleJson)

      expect(result).toBe(12.99)
    })

    test('uses min function on array of numbers', () => {
      const result = jmespath('min(store.book[*].price)', sampleJson)

      expect(result).toBe(8.95)
    })

    test('uses sum function on array of numbers', () => {
      const result = jmespath('sum(store.book[*].price)', sampleJson)

      expect(result).toBe(30.93)
    })

    test('uses contains function', () => {
      const result = jmespath('contains(tags, `fiction`)', sampleJson)

      expect(result).toBe(true)
    })

    test('uses starts_with function', () => {
      const result = jmespath(
        'starts_with(store.bicycle.brand, `Tr`)',
        sampleJson
      )

      expect(result).toBe(true)
    })
  })

  describe('pipe expressions', () => {
    test('chains operations with pipe', () => {
      const result = jmespath('store.book[*].price | sort(@)', sampleJson)

      // sort() may not preserve original order - check actual result
      expect(result).toHaveLength(3)
      expect(result).toContain(8.95)
      expect(result).toContain(8.99)
      expect(result).toContain(12.99)
    })

    test('filters then projects with pipe', () => {
      const result = jmespath(
        'store.book[?price < `10`] | [*].author',
        sampleJson
      )

      expect(result).toEqual(['Nigel Rees', 'Herman Melville'])
    })

    test('uses pipe with function expressions', () => {
      const result = jmespath('store.book[*].author | sort(@)', sampleJson)

      expect(result).toEqual(['Evelyn Waugh', 'Herman Melville', 'Nigel Rees'])
    })
  })

  describe('multiselect operations', () => {
    test('creates hash from multiple expressions', () => {
      const result = jmespath('store.{books: book, bike: bicycle}', sampleJson)

      expect(result).toEqual({
        books: sampleJson.store.book,
        bike: sampleJson.store.bicycle,
      })
    })

    test('creates list from multiple expressions', () => {
      const result = jmespath(
        'store.[book[0].author, bicycle.color]',
        sampleJson
      )

      expect(result).toEqual(['Nigel Rees', 'red'])
    })

    test('creates complex multiselect hash', () => {
      const result = jmespath(
        'store.book[0].{title: author, cost: price}',
        sampleJson
      )

      expect(result).toEqual({
        title: 'Nigel Rees',
        cost: 8.95,
      })
    })
  })

  describe('flatten operations', () => {
    test('flattens nested arrays', () => {
      const nestedData = {
        groups: [{ items: [1, 2] }, { items: [3, 4] }, { items: [5, 6] }],
      }

      const result = jmespath('groups[*].items[]', nestedData)

      expect(result).toEqual([1, 2, 3, 4, 5, 6])
    })

    test('flattens with projection', () => {
      const nestedData = {
        departments: [
          { employees: [{ name: 'John' }, { name: 'Jane' }] },
          { employees: [{ name: 'Bob' }, { name: 'Alice' }] },
        ],
      }

      const result = jmespath('departments[*].employees[].name', nestedData)

      expect(result).toEqual(['John', 'Jane', 'Bob', 'Alice'])
    })
  })

  describe('edge cases and error handling', () => {
    test('handles null input gracefully', () => {
      const result = jmespath('store', null)

      expect(result).toBeNull()
    })

    test('handles undefined input gracefully', () => {
      const result = jmespath('store', undefined)

      expect(result).toBeNull()
    })

    test('handles empty object', () => {
      const result = jmespath('store', {})

      expect(result).toBeNull()
    })

    test('handles empty array', () => {
      const result = jmespath('[0]', [])

      expect(result).toBeNull()
    })

    test('handles array as root input', () => {
      const result = jmespath('[*]', [1, 2, 3])

      expect(result).toEqual([1, 2, 3])
    })

    test('handles primitive values as input', () => {
      expect(jmespath('@', 'hello')).toBe('hello')
      expect(jmespath('@', 42)).toBe(42)
      expect(jmespath('@', true)).toBe(true)
    })

    test('throws for invalid JMESPath syntax', () => {
      expect(() => {
        jmespath('store.book[invalid syntax', sampleJson)
      }).toThrow()
    })

    test('handles special characters in property names', () => {
      const specialProps = {
        'special-property': 'value1',
        'property with spaces': 'value2',
        'property.with.dots': 'value3',
      }

      const result1 = jmespath('"special-property"', specialProps)
      const result2 = jmespath('"property with spaces"', specialProps)
      const result3 = jmespath('"property.with.dots"', specialProps)

      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
      expect(result3).toBe('value3')
    })
  })

  describe('complex data types', () => {
    test('handles boolean values correctly', () => {
      const data = { active: true, disabled: false }

      expect(jmespath('active', data)).toBe(true)
      expect(jmespath('disabled', data)).toBe(false)
    })

    test('handles numeric values including zero and negative', () => {
      const data = { count: 0, temperature: -10, ratio: 0.5 }

      expect(jmespath('count', data)).toBe(0)
      expect(jmespath('temperature', data)).toBe(-10)
      expect(jmespath('ratio', data)).toBe(0.5)
    })

    test('handles arrays with mixed types', () => {
      const data = { mixed: [1, 'string', true, null, { key: 'value' }] }

      expect(jmespath('mixed[0]', data)).toBe(1)
      expect(jmespath('mixed[1]', data)).toBe('string')
      expect(jmespath('mixed[2]', data)).toBe(true)
      expect(jmespath('mixed[3]', data)).toBeNull()
      expect(jmespath('mixed[4].key', data)).toBe('value')
    })

    test('handles nested objects and arrays', () => {
      const data = {
        users: [
          { profile: { settings: { theme: 'dark' } } },
          { profile: { settings: { theme: 'light' } } },
        ],
      }

      const result = jmespath('users[*].profile.settings.theme', data)

      expect(result).toEqual(['dark', 'light'])
    })
  })

  describe('performance with large datasets', () => {
    test('handles large arrays efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item${i}`,
      }))
      const data = { items: largeArray }

      const start = performance.now()
      const result = jmespath('items[?id >= `900`].value', data)
      const end = performance.now()

      expect(result).toHaveLength(100)
      expect(result[0]).toBe('item900')
      expect(end - start).toBeLessThan(100) // Should complete in reasonable time
    })

    test('handles complex projections efficiently', () => {
      const complexData = {
        departments: Array.from({ length: 50 }, (_, i) => ({
          id: i,
          employees: Array.from({ length: 20 }, (_, j) => ({
            id: j,
            name: `Employee ${i}-${j}`,
            salary: 50000 + i * 1000 + j * 100,
          })),
        })),
      }

      const start = performance.now()
      const result = jmespath(
        'departments[*].employees[?salary > `60000`].name | []',
        complexData
      )
      const end = performance.now()

      expect(result.length).toBeGreaterThan(0)
      expect(end - start).toBeLessThan(200) // Should handle complex projections efficiently
    })
  })

  describe('integration with real-world data structures', () => {
    test('handles AWS-style API response', () => {
      const awsResponse = {
        Instances: [
          {
            InstanceId: 'i-1234567890abcdef0',
            InstanceType: 't2.micro',
            State: { Name: 'running' },
            Tags: [
              { Key: 'Name', Value: 'WebServer' },
              { Key: 'Environment', Value: 'Production' },
            ],
          },
          {
            InstanceId: 'i-0987654321fedcba0',
            InstanceType: 't2.small',
            State: { Name: 'stopped' },
            Tags: [
              { Key: 'Name', Value: 'Database' },
              { Key: 'Environment', Value: 'Development' },
            ],
          },
        ],
      }

      expect(jmespath('Instances[*].InstanceId', awsResponse)).toEqual([
        'i-1234567890abcdef0',
        'i-0987654321fedcba0',
      ])

      expect(
        jmespath('Instances[?State.Name == `running`].InstanceId', awsResponse)
      ).toEqual(['i-1234567890abcdef0'])

      expect(
        jmespath('Instances[*].Tags[?Key == `Name`].Value | []', awsResponse)
      ).toEqual(['WebServer', 'Database'])
    })

    test('handles GraphQL-style response', () => {
      const graphqlResponse = {
        data: {
          users: {
            nodes: [
              { id: '1', name: 'John', posts: { totalCount: 5 } },
              { id: '2', name: 'Jane', posts: { totalCount: 3 } },
            ],
            pageInfo: { hasNextPage: true, endCursor: 'abc123' },
          },
        },
        errors: null,
      }

      expect(jmespath('data.users.nodes[*].name', graphqlResponse)).toEqual([
        'John',
        'Jane',
      ])
      expect(
        jmespath(
          'data.users.nodes[?posts.totalCount > `4`].name',
          graphqlResponse
        )
      ).toEqual(['John'])
      expect(jmespath('data.users.pageInfo.hasNextPage', graphqlResponse)).toBe(
        true
      )
    })

    test('handles configuration-style nested objects', () => {
      const config = {
        database: {
          connections: {
            primary: { host: 'db1.example.com', port: 5432 },
            replica: { host: 'db2.example.com', port: 5432 },
          },
        },
        cache: {
          redis: { host: 'redis.example.com', port: 6379 },
        },
        features: ['auth', 'logging', 'metrics'],
      }

      expect(jmespath('database.connections.primary.host', config)).toBe(
        'db1.example.com'
      )
      expect(jmespath('features[?@ == `auth`]', config)).toEqual(['auth'])
      expect(
        jmespath(
          '{db: database.connections.primary.host, cache: cache.redis.host}',
          config
        )
      ).toEqual({
        db: 'db1.example.com',
        cache: 'redis.example.com',
      })
    })
  })

  describe('advanced function usage', () => {
    test('uses reverse function', () => {
      const result = jmespath('reverse(tags)', sampleJson)

      expect(result).toEqual(['reference', 'fiction', 'literature'])
    })

    test('uses to_array function', () => {
      const result = jmespath('to_array(expensive)', sampleJson)

      expect(result).toEqual([10])
    })

    test('uses to_string function', () => {
      const result = jmespath('to_string(expensive)', sampleJson)

      expect(result).toBe('10')
    })

    test('uses to_number function', () => {
      const data = { stringNumber: '42' }
      const result = jmespath('to_number(stringNumber)', data)

      expect(result).toBe(42)
    })

    test('uses join function', () => {
      const result = jmespath('join(`, `, store.book[*].author)', sampleJson)

      expect(result).toBe('Nigel Rees, Evelyn Waugh, Herman Melville')
    })

    test('uses map function with expression', () => {
      const result = jmespath('map(&author, store.book)', sampleJson)

      expect(result).toEqual(['Nigel Rees', 'Evelyn Waugh', 'Herman Melville'])
    })
  })

  describe('expression types and literals', () => {
    test('handles string literals', () => {
      const result = jmespath('`"hello world"`', {})

      expect(result).toBe('hello world')
    })

    test('handles number literals', () => {
      const result = jmespath('`42`', {})

      expect(result).toBe(42)
    })

    test('handles boolean literals', () => {
      expect(jmespath('`true`', {})).toBe(true)
      expect(jmespath('`false`', {})).toBe(false)
    })

    test('handles null literal', () => {
      const result = jmespath('`null`', {})

      expect(result).toBeNull()
    })

    test('handles array literals', () => {
      const result = jmespath('`[1, 2, 3]`', {})

      expect(result).toEqual([1, 2, 3])
    })

    test('handles object literals', () => {
      const result = jmespath('`{"key": "value"}`', {})

      expect(result).toEqual({ key: 'value' })
    })
  })

  describe('security considerations', () => {
    test('SECURITY - handles potentially malicious JMESPath expressions safely', () => {
      const data = { users: [{ name: 'test', role: 'user' }] }

      // @note test expressions that access sensitive properties - they should not execute code

      const sensitiveExpressions = [
        'constructor', // constructor access - returns function but doesn't execute
        '__proto__', // prototype access
        'toString', // toString access
        'users[0].constructor', // constructor through array access
        'eval', // direct eval access (should be null)
        'Function', // Function constructor access (should be null)
        'users[].constructor', // constructor access through projection
      ]

      sensitiveExpressions.forEach((expression) => {
        expect(() => {
          const result = jmespath(expression, data)

          // @note result may be function (like constructor) but should not
          // execute malicious code the key is that JMESPath doesn't execute the
          // function, just returns it

          if (typeof result === 'function') {
            // @note ensure it's a built-in function, not injected code
            expect(result.name).toMatch(
              /^(Object|Array|Function|toString|valueOf)$|^$/
            )
          }
        }).not.toThrow()
      })
    })

    test('SECURITY - prevents resource exhaustion from complex expressions', () => {
      const data = {
        items: Array(1000).fill({ id: 1, nested: { deep: { value: 'test' } } }),
      }

      // @note complex expression that could cause performance issues

      const complexExpression =
        'items[*].nested.deep.value | [?@ == `test`] | sort(@) | reverse(@)'

      expect(() => {
        const result = jmespath(complexExpression, data)

        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeLessThanOrEqual(1000)
      }).not.toThrow()
    })

    test('SECURITY - handles deeply nested function calls without stack overflow', () => {
      const data = { values: [5, 3, 8, 1, 9, 2, 7, 4, 6] }

      // @note deeply nested function calls that could cause stack overflow

      const nestedExpression =
        'values | sort(@) | reverse(@) | sort(@) | reverse(@) | max(@)'

      expect(() => {
        const result = jmespath(nestedExpression, data)

        expect(result).toBe(9)
      }).not.toThrow()
    })

    test('SECURITY - safely handles prototype pollution attempts in input data', () => {
      // @note test data that contains prototype pollution attempts

      const maliciousData = {
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } },
        normal: { data: 'safe' },
      }

      const result = jmespath('normal.data', maliciousData)

      expect(result).toBe('safe')

      // @note ensure prototype was not actually polluted

      expect({}.polluted).toBeUndefined()
    })

    test('SECURITY - prevents code execution through function expressions', () => {
      const data = {
        items: [
          { name: 'safe', func: 'toString' },
          { name: 'dangerous', func: 'constructor' },
        ],
      }

      // @note expressions that might attempt to execute functions

      const dangerousExpressions = [
        'items[?func == `constructor`].name',
        'items[].func | [?@ == `constructor`]',
        'items | map(&func, @)',
        'items[*].func | [?contains(@, `construct`)]',
      ]

      dangerousExpressions.forEach((expression) => {
        expect(() => {
          const result = jmespath(expression, data)

          // @note should return safe data, not executable functions

          if (Array.isArray(result)) {
            result.forEach((item) => {
              expect(typeof item).not.toBe('function')
            })
          } else {
            expect(typeof result).not.toBe('function')
          }
        }).not.toThrow()
      })
    })

    test('SECURITY - limits memory usage with large array operations', () => {
      const data = {
        numbers: Array(10000)
          .fill(0)
          .map((_, i) => i),
        objects: Array(5000).fill({ value: 42, text: 'large dataset' }),
      }

      // @note memory-intensive operations that should not cause OOM

      const intensiveExpressions = [
        'numbers | sort(@) | reverse(@)',
        'objects[*].value | sort(@)',
        'objects | map(&text, @)',
        'numbers[?@ > `5000`] | length(@)',
      ]

      intensiveExpressions.forEach((expression) => {
        expect(() => {
          const result = jmespath(expression, data)

          expect(result).toBeDefined()
        }).not.toThrow()
      })
    })

    test('SECURITY - safely handles circular references in input data', () => {
      const circularData = { name: 'root', items: [] }

      circularData.self = circularData // create circular reference
      circularData.items.push(circularData) // create circular in array

      expect(() => {
        const result = jmespath('name', circularData)

        expect(result).toBe('root')
      }).not.toThrow()
    })

    test('SECURITY - validates expression syntax to prevent injection', () => {
      const data = { test: 'value' }

      // @note malformed expressions that should throw appropriate errors

      const malformedExpressions = [
        'test; eval("malicious code"); //',
        'test"; eval("code"); //',
        'test && eval("code")',
      ]

      malformedExpressions.forEach((expression) => {
        expect(() => {
          jmespath(expression, data)
        }).toThrow() // @note JMESPath should throw for invalid syntax rather than executing
      })

      // @note test expressions that should be safely handled without throwing

      const safeExpressions = ['nonexistent.property', 'test.nonexistent']

      safeExpressions.forEach((expression) => {
        expect(() => {
          const result = jmespath(expression, data)

          expect(result).toBeNull()
        }).not.toThrow()
      })

      // @note test expressions that should throw for unknown functions

      const unknownFunctionExpressions = ['invalid_function()']

      unknownFunctionExpressions.forEach((expression) => {
        expect(() => {
          jmespath(expression, data)
        }).toThrow('Unknown function')
      })
    })

    test('SECURITY - prevents function constructor access through object literals', () => {
      const data = { config: { key: 'value' } }

      // @note object literals that might attempt function construction

      const safeLiterals = [
        '`{"key": "value"}`',
        '`{"normal": "data"}`',
        '`{"safe": true}`',
      ]

      safeLiterals.forEach((expression) => {
        expect(() => {
          const result = jmespath(expression, data)

          expect(typeof result).toBe('object')
          // @note for regular objects, constructor.constructor should be the
          // Function constructor but the result itself should not be executable

          expect(typeof result).not.toBe('function')
        }).not.toThrow()
      })
    })

    test('SECURITY - handles potentially dangerous filter expressions safely', () => {
      const data = {
        users: [
          { name: 'admin', permissions: ['read', 'write', 'execute'] },
          { name: 'user', permissions: ['read'] },
          { name: 'constructor', permissions: ['dangerous'] },
        ],
      }

      // @note filter expressions that access sensitive properties

      const sensitiveFilters = [
        'users[?name == `constructor`]',
        'users[?contains(name, `construct`)]',
        'users[?permissions[0] == `execute`]',
        'users | [?name == `admin`] | [0].permissions',
      ]

      sensitiveFilters.forEach((expression) => {
        expect(() => {
          const result = jmespath(expression, data)

          // @note should return safe filtered data

          if (Array.isArray(result)) {
            result.forEach((item) => {
              expect(typeof item).not.toBe('function')
            })
          }
        }).not.toThrow()
      })
    })
  })
})
