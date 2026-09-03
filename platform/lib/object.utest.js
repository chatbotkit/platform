import {
  OMIT_UNDEFINED,
  omitNullExcept,
  clone,
  equal,
  find,
  flatten,
  getCaseInsensitive,
  merge,
  omit,
  pick,
  rename,
  replace,
  resolveMarkers,
  revalue,
  unflatten,
} from '@/lib/object'

describe('equal', () => {
  it('returns true for equal objects', () => {
    const objA = { a: 1, b: 2 }
    const objB = { a: 1, b: 2 }

    expect(equal(objA, objB)).toBe(true)
  })

  it('returns true for equal nested objects', () => {
    const objA = { a: 1, b: { c: 3, d: 4 } }
    const objB = { a: 1, b: { c: 3, d: 4 } }

    expect(equal(objA, objB)).toBe(true)
  })

  it('returns false for non-equal objects', () => {
    const objA = { a: 1, b: { c: 3, d: 4 } }
    const objB = { a: 1, b: { c: 3, d: 5 } }

    expect(equal(objA, objB)).toBe(false)
  })

  it('returns false when types differ', () => {
    const objA = { a: '1' }
    const objB = { a: 1 }

    expect(equal(objA, objB)).toBe(false)
  })

  it('must return true for equal objects with different key order', () => {
    const objA = { a: 1, b: 2 }
    const objB = { b: 2, a: 1 }

    expect(equal(objA, objB)).toBe(true)
  })

  it('must return true for equal arrays', () => {
    const arrA = [1, 2, 3]
    const arrB = [1, 2, 3]

    expect(equal(arrA, arrB)).toBe(true)
  })

  it('must return false for non-equal arrays', () => {
    const arrA = [1, 2, 3]
    const arrB = [1, 2, 4]

    expect(equal(arrA, arrB)).toBe(false)
  })

  it('must return false for equal arrays with different order', () => {
    const arrA = [1, 2, 3]
    const arrB = [3, 2, 1]

    expect(equal(arrA, arrB)).toBe(false)
  })
})

describe('clone', () => {
  it('clones a simple object', () => {
    const obj = { a: 1, b: 2 }
    const clonedObj = clone(obj)

    expect(clonedObj).toEqual(obj)
    expect(clonedObj).not.toBe(obj)
  })

  it('clones a nested object', () => {
    const obj = { a: 1, b: { c: 2, d: 3 } }
    const clonedObj = clone(obj)

    expect(clonedObj).toEqual(obj)
    expect(clonedObj).not.toBe(obj)
    expect(clonedObj.b).not.toBe(obj.b)
  })

  it('clones an array', () => {
    const arr = [1, 2, 3]
    const clonedArr = clone(arr)

    expect(clonedArr).toEqual(arr)
    expect(clonedArr).not.toBe(arr)
  })
})

describe('flatten', () => {
  test('flattens a simple nested object', () => {
    const input = {
      a: {
        b: {
          c: 1,
        },
      },
    }

    const expectedOutput = {
      'a.b.c': 1,
    }

    expect(flatten(input)).toEqual(expectedOutput)
  })

  test('flattens a nested object with multiple keys', () => {
    const input = {
      a: {
        b: 1,
        c: 2,
      },
      d: 3,
    }

    const expectedOutput = {
      'a.b': 1,
      'a.c': 2,
      d: 3,
    }

    expect(flatten(input)).toEqual(expectedOutput)
  })

  test('flattens an object with an array', () => {
    const input = {
      a: [1, 2, 3],
      b: {
        c: 4,
      },
    }

    const expectedOutput = {
      'a.0': 1,
      'a.1': 2,
      'a.2': 3,
      'b.c': 4,
    }

    expect(flatten(input)).toEqual(expectedOutput)
  })

  test('flattens an object with a custom separator', () => {
    const input = {
      a: {
        b: {
          c: 1,
        },
      },
    }

    const expectedOutput = {
      'a-b-c': 1,
    }

    expect(flatten(input, '', '-')).toEqual(expectedOutput)
  })

  test('returns an empty object when input is empty', () => {
    const input = {}
    const expectedOutput = {}

    expect(flatten(input)).toEqual(expectedOutput)
  })

  test('handles non-object values correctly', () => {
    const input = {
      a: 1,
      b: null,
      c: 'test',
      d: false,
    }

    const expectedOutput = {
      a: 1,
      b: null,
      c: 'test',
      d: false,
    }

    expect(flatten(input)).toEqual(expectedOutput)
  })

  test('handles nested null values correctly', () => {
    const input = {
      a: {
        b: null,
      },
    }

    const expectedOutput = {
      'a.b': null,
    }

    expect(flatten(input)).toEqual(expectedOutput)
  })
})

describe('unflatten', () => {
  it('unflattens a simple object', () => {
    const input = {
      'a.b.c': 1,
    }

    const expectedOutput = {
      a: {
        b: {
          c: 1,
        },
      },
    }

    expect(unflatten(input)).toEqual(expectedOutput)
  })

  it('unflattens an object with multiple keys', () => {
    const input = {
      'a.b': 1,
      'a.c': 2,
      d: 3,
    }

    const expectedOutput = {
      a: {
        b: 1,
        c: 2,
      },
      d: 3,
    }

    expect(unflatten(input)).toEqual(expectedOutput)
  })
})

describe('omit', () => {
  test('omits specified keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 })
  })

  test('omits keys matching regex', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(omit(obj, [/b|c/])).toEqual({ a: 1 })
  })

  test('omits keys matching function', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(omit(obj, [(k) => k === 'b'])).toEqual({ a: 1, c: 3 })
  })

  test('omits keys recursively', () => {
    const obj = { a: { b: 1, c: 2 }, d: 3 }

    expect(omit(obj, ['b'], 1)).toEqual({ a: { c: 2 }, d: 3 })
  })

  test('omits keys in arrays', () => {
    const obj = [{ a: 1 }, { b: 2 }, { c: 3 }]

    expect(omit(obj, ['b'], 1)).toEqual([{ a: 1 }, {}, { c: 3 }])
  })

  test('omit undefined values', () => {
    const obj = { a: 1, b: undefined, c: 3 }

    expect(omit(obj, [OMIT_UNDEFINED])).toEqual({ a: 1, c: 3 })
  })
})

describe('pick', () => {
  test('picks specified keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(pick(obj, ['b'])).toEqual({ b: 2 })
  })

  test('picks keys matching regex', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(pick(obj, [/b|c/])).toEqual({ b: 2, c: 3 })
  })

  test('picks keys matching function', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(pick(obj, [(k) => k === 'b'])).toEqual({ b: 2 })
  })

  // @note not supported in the current implementation

  test.skip('picks keys recursively', () => {
    const obj = { a: { b: 1, c: 2 }, d: 3 }

    expect(pick(obj, ['b'], 1)).toEqual({ a: { b: 1 } })
  })

  // @note not supported in the current implementation

  test.skip('picks keys in arrays', () => {
    const obj = [{ a: 1 }, { b: 2 }, { c: 3 }]

    expect(pick(obj, ['b'], 1)).toEqual([{ b: 2 }])
  })
})

describe('getCaseInsensitive', () => {
  test('gets value by key case-insensitively', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(getCaseInsensitive(obj, 'A')).toBe(1)
    expect(getCaseInsensitive(obj, 'B')).toBe(2)
    expect(getCaseInsensitive(obj, 'C')).toBe(3)
  })

  test('returns undefined for non-existent key', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(getCaseInsensitive(obj, 'd')).toBeUndefined()
  })
})

describe('merge', () => {
  it('merges two objects', () => {
    const obj1 = { a: 1, b: 2 }
    const obj2 = { b: 3, c: 4 }

    expect(merge(obj1, obj2)).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('merges objects at the same level', () => {
    const obj1 = { input: { a: 1, b: 2 } }
    const obj2 = { input: { b: 3, c: 4 } }

    expect(merge(obj1, obj2)).toEqual({ input: { a: 1, b: 3, c: 4 } })
  })
})

describe('rename', () => {
  test('replaces keys in a simple object', () => {
    const obj = { a: 1, b: 2 }
    const result = rename(obj, 'a', 'x')

    expect(result).toEqual({ x: 1, b: 2 })
    expect(obj).toEqual({ a: 1, b: 2 }) // Ensure original object is unchanged
  })

  test('replaces nested keys in an object', () => {
    const obj = { a: 1, b: { a: 2, c: 3 } }
    const result = rename(obj, 'a', 'x')

    expect(result).toEqual({ x: 1, b: { x: 2, c: 3 } })
    expect(obj).toEqual({ a: 1, b: { a: 2, c: 3 } }) // Original unchanged
  })

  test('replaces keys in an array of objects', () => {
    const obj = [{ a: 1 }, { b: 2, a: 3 }]
    const result = rename(obj, 'a', 'x')

    expect(result).toEqual([{ x: 1 }, { b: 2, x: 3 }])
    expect(obj).toEqual([{ a: 1 }, { b: 2, a: 3 }]) // Original unchanged
  })

  test('does not affect non-object or non-array types', () => {
    const num = 42
    const result = rename(num, 'a', 'x')

    expect(result).toBe(42)
  })

  test('works with deeply nested structures', () => {
    const obj = { a: { b: { c: { a: 4 } } }, a: 5 }
    const result = rename(obj, 'a', 'x')

    expect(result).toEqual({ x: { b: { c: { x: 4 } } }, x: 5 })
    expect(obj).toEqual({ a: { b: { c: { a: 4 } } }, a: 5 }) // Original unchanged
  })
})

describe('revalue', () => {
  test('replaces values in a simple object', () => {
    const obj = { a: 1, b: 2 }
    const result = revalue(obj, 1, 'one')

    expect(result).toEqual({ a: 'one', b: 2 })
    expect(obj).toEqual({ a: 1, b: 2 }) // Ensure original object is unchanged
  })

  test('replaces nested values in an object', () => {
    const obj = { a: 1, b: { a: 2, c: 3 } }
    const result = revalue(obj, 2, 'two')

    expect(result).toEqual({ a: 1, b: { a: 'two', c: 3 } })
    expect(obj).toEqual({ a: 1, b: { a: 2, c: 3 } }) // Original unchanged
  })

  test('replaces values in an array of objects', () => {
    const obj = [{ a: 1 }, { b: 2, a: 3 }]
    const result = revalue(obj, 3, 'three')

    expect(result).toEqual([{ a: 1 }, { b: 2, a: 'three' }])
    expect(obj).toEqual([{ a: 1 }, { b: 2, a: 3 }]) // Original unchanged
  })

  test('replaces values in arrays', () => {
    const arr = [1, 2, 3, 1]
    const result = revalue(arr, 1, 'one')

    expect(result).toEqual(['one', 2, 3, 'one'])
    expect(arr).toEqual([1, 2, 3, 1]) // Original unchanged
  })

  test('handles non-object or non-array inputs', () => {
    const num = 42
    const result = revalue(num, 42, 'forty-two')

    expect(result).toBe('forty-two')
  })

  test('works with deeply nested structures', () => {
    const obj = { a: { b: { c: { d: 4 } } }, e: 4 }
    const result = revalue(obj, 4, 'four')

    expect(result).toEqual({ a: { b: { c: { d: 'four' } } }, e: 'four' })
    expect(obj).toEqual({ a: { b: { c: { d: 4 } } }, e: 4 }) // Original unchanged
  })
})

describe('find', () => {
  test('returns empty array when obj is null', () => {
    expect(find(null, 'key')).toEqual([])
  })

  test('returns empty array when obj is not an object', () => {
    expect(find('string', 'key')).toEqual([])
    expect(find(123, 'key')).toEqual([])
    expect(find(true, 'key')).toEqual([])
    expect(find(undefined, 'key')).toEqual([])
  })

  test('finds values by exact key match', () => {
    const obj = {
      name: 'John',
      info: { age: 30, name: 'John Doe' },
      hobbies: ['reading', { name: 'sports', type: 'outdoor' }],
    }

    expect(find(obj, 'name')).toEqual(['John', 'John Doe', 'sports'])
  })

  test('works with arrays', () => {
    const arr = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2', details: { name: 'Details' } },
    ]

    expect(find(arr, 'name')).toEqual(['Item 1', 'Item 2', 'Details'])
  })

  test('works with function predicate', () => {
    const obj = {
      firstName: 'John',
      lastName: 'Doe',
      user: {
        firstName: 'Jane',
        lastName: 'Smith',
      },
    }

    expect(find(obj, (key) => key.includes('Name'))).toEqual([
      'John',
      'Doe',
      'Jane',
      'Smith',
    ])
    expect(find(obj, (key) => key === 'firstName')).toEqual(['John', 'Jane'])
  })

  test('handles deep nesting', () => {
    const deepObj = {
      level1: {
        level2: {
          level3: {
            id: 'deep',
            items: [
              { id: 1, name: 'Item 1' },
              { id: 2, name: 'Item 2' },
            ],
          },
        },
      },
    }

    expect(find(deepObj, 'id')).toEqual(['deep', 1, 2])
    expect(find(deepObj, 'name')).toEqual(['Item 1', 'Item 2'])
  })
})

describe('object replace function', () => {
  test('replaces values that match the tester function', () => {
    const obj = {
      name: 'John',
      age: 30,
      address: {
        city: 'New York',
        zip: 10001,
      },
    }

    const result = replace(
      obj,
      (value) => typeof value === 'number',
      (value) => value * 2
    )

    expect(result).toEqual({
      name: 'John',
      age: 60,
      address: {
        city: 'New York',
        zip: 20002,
      },
    })
  })

  test('works with arrays', () => {
    const obj = {
      names: ['John', 'Jane'],
      scores: [10, 20, 30],
    }

    const result = replace(
      obj,
      (value) => Array.isArray(value),
      (value) => value.length
    )

    expect(result).toEqual({
      names: 2,
      scores: 3,
    })
  })

  test('replaces array items that match the tester', () => {
    const obj = {
      items: [{ $marker: 'value1' }, { $marker: 'value2' }, { normal: 'data' }],
    }

    const result = replace(
      obj,
      (value) =>
        typeof value === 'object' && value !== null && '$marker' in value,
      (value) => value.$marker.toUpperCase()
    )

    expect(result).toEqual({
      items: ['VALUE1', 'VALUE2', { normal: 'data' }],
    })
  })

  test('replaces mixed static and dynamic markers in arrays', () => {
    // @note this tests the use case for ability template path arrays

    const obj = {
      path: [
        { $static: '/v1/assets/' },
        { $field: { name: 'crypto', type: 'string' } },
      ],
    }

    let result = replace(
      obj,
      (value) =>
        typeof value === 'object' && value !== null && '$static' in value,
      (value) => value.$static
    )

    result = replace(
      result,
      (value) =>
        typeof value === 'object' && value !== null && '$field' in value,
      (value) => `[${value.$field.name}]`
    )

    expect(result).toEqual({
      path: ['/v1/assets/', '[crypto]'],
    })
  })

  test('replaces top-level array items', () => {
    const arr = [{ $replace: 'a' }, { $replace: 'b' }, 'keep']

    const result = replace(
      arr,
      (value) =>
        typeof value === 'object' && value !== null && '$replace' in value,
      (value) => value.$replace
    )

    expect(result).toEqual(['a', 'b', 'keep'])
  })

  test('provides correct index as key for array items', () => {
    const arr = [{ $test: 'first' }, { $test: 'second' }]
    const keys = []

    replace(
      arr,
      (value, key) => {
        if (typeof value === 'object' && value !== null && '$test' in value) {
          keys.push(key)
        }

        return false
      },
      () => null
    )

    expect(keys).toEqual(['0', '1'])
  })

  test('returns original value for non-objects', () => {
    const str = 'test'
    const num = 42
    const bool = true
    const nil = null

    expect(
      replace(
        str,
        () => true,
        () => 'replaced'
      )
    ).toBe(str)
    expect(
      replace(
        num,
        () => true,
        () => 'replaced'
      )
    ).toBe(num)
    expect(
      replace(
        bool,
        () => true,
        () => 'replaced'
      )
    ).toBe(bool)
    expect(
      replace(
        nil,
        () => true,
        () => 'replaced'
      )
    ).toBe(nil)
  })

  test('uses keys in tester function', () => {
    const obj = {
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
    }

    const result = replace(
      obj,
      (_, key) => key.includes('Name'),
      (value) => value.toUpperCase()
    )

    expect(result).toEqual({
      firstName: 'JOHN',
      lastName: 'DOE',
      age: 30,
    })
  })

  test('uses object reference in tester and replacer functions', () => {
    const obj = {
      a: 1,
      b: 2,
      c: 3,
    }

    const result = replace(
      obj,
      (value, key, original) => value === Math.max(...Object.values(original)),
      (value) => value * 10
    )

    expect(result).toEqual({
      a: 1,
      b: 2,
      c: 30,
    })
  })

  test('handles nested objects properly', () => {
    const obj = {
      user: {
        profile: {
          name: 'John',
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        posts: [
          { id: 1, title: 'Hello' },
          { id: 2, title: 'World' },
        ],
      },
    }

    const result = replace(
      obj,
      (value) => typeof value === 'string',
      (value) => value.toUpperCase()
    )

    expect(result).toEqual({
      user: {
        profile: {
          name: 'JOHN',
          settings: {
            theme: 'DARK',
            notifications: true,
          },
        },
        posts: [
          { id: 1, title: 'HELLO' },
          { id: 2, title: 'WORLD' },
        ],
      },
    })
  })
})

describe('resolveMarkers', () => {
  test('handles null and undefined inputs', () => {
    const transformations = {
      $test: () => 'transformed',
    }

    expect(resolveMarkers(null, transformations)).toBe(null)
    expect(resolveMarkers(undefined, transformations)).toBe(undefined)
  })

  test('handles primitive values', () => {
    const transformations = {
      $test: () => 'transformed',
    }

    expect(resolveMarkers('string', transformations)).toBe('string')
    expect(resolveMarkers(42, transformations)).toBe(42)
    expect(resolveMarkers(true, transformations)).toBe(true)
  })

  test('handles empty objects and arrays', () => {
    const transformations = {
      $test: () => 'transformed',
    }

    expect(resolveMarkers({}, transformations)).toEqual({})
    expect(resolveMarkers([], transformations)).toEqual([])
  })

  test('applies simple transformation with transformation marker', () => {
    const transformations = {
      $epochToDateTime: (sourceValue) => {
        if (typeof sourceValue === 'number') {
          return new Date(sourceValue * 1000).toISOString()
        }

        return sourceValue
      },
    }

    const input = {
      timestamp: { $epochToDateTime: 1609459200 },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      timestamp: '2021-01-01T00:00:00.000Z',
    })
  })

  test('preserves original object structure when no transformations apply', () => {
    const transformations = {
      $transform: () => 'transformed',
    }

    const input = {
      name: 'John',
      age: 30,
      address: {
        city: 'New York',
        zip: 10001,
      },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual(input)
    expect(result).not.toBe(input) // Should be a new object
  })

  test('handles nested transformations', () => {
    const transformations = {
      $double: (value) => value * 2,
      $uppercase: (value) => value.toUpperCase(),
    }

    const input = {
      user: {
        name: { $uppercase: 'john' },
        score: { $double: 50 },
      },
      numbers: [{ value: { $double: 10 } }, { value: { $double: 20 } }],
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      user: {
        name: 'JOHN',
        score: 100,
      },
      numbers: [{ value: 20 }, { value: 40 }],
    })
  })

  test('applies only first matching transformation when multiple markers present', () => {
    const transformations = {
      $first: () => 'first',
      $second: () => 'second',
    }

    const input = {
      value: { $first: 'test', $second: 'test' },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      value: 'first',
    })
  })

  test('passes additional context to transformation function', () => {
    const transformations = {
      $contextAware: (sourceValue, markerObj, parentObj) => {
        return `${sourceValue}-${markerObj.extra}-${parentObj.context}`
      },
    }

    const input = {
      context: 'parent',
      data: {
        $contextAware: 'value',
        extra: 'info',
      },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      context: 'parent',
      data: 'value-info-parent',
    })
  })

  test('handles arrays containing objects with transformations', () => {
    const transformations = {
      $add: (value) => value + 10,
    }

    const input = [{ num: { $add: 5 } }, { num: { $add: 15 } }, 'string', 42]

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual([{ num: 15 }, { num: 25 }, 'string', 42])
  })

  test('handles deeply nested structures', () => {
    const transformations = {
      $reverse: (value) => value.split('').reverse().join(''),
    }

    const input = {
      level1: {
        level2: {
          level3: {
            text: { $reverse: 'hello' },
          },
        },
      },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            text: 'olleh',
          },
        },
      },
    })
  })

  test('handles transformation function that returns complex objects', () => {
    const transformations = {
      $expand: (value) => ({
        original: value,
        modified: value.toUpperCase(),
        length: value.length,
      }),
    }

    const input = {
      text: { $expand: 'hello' },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      text: {
        original: 'hello',
        modified: 'HELLO',
        length: 5,
      },
    })
  })

  test('preserves objects without transformation markers', () => {
    const transformations = {
      $test: () => 'transformed',
    }

    const input = {
      normal: {
        data: 'value',
        nested: {
          more: 'data',
        },
      },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual(input)
  })

  test('handles mixed content with and without transformations', () => {
    const transformations = {
      $multiply: (value) => value * 3,
    }

    const input = {
      transformed: { $multiply: 10 },
      normal: 'unchanged',
      nested: {
        also_transformed: { $multiply: 5 },
        regular: 'data',
      },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      transformed: 30,
      normal: 'unchanged',
      nested: {
        also_transformed: 15,
        regular: 'data',
      },
    })
  })

  test('handles epoch timestamp transformation with various formats', () => {
    const transformations = {
      $epochToDateTime: (sourceValue) => {
        if (typeof sourceValue === 'number') {
          return new Date(sourceValue * 1000).toISOString()
        } else if (typeof sourceValue === 'string') {
          const timestamp = parseFloat(sourceValue)

          if (!isNaN(timestamp)) {
            return new Date(timestamp * 1000).toISOString()
          }
        }

        return sourceValue // Keep original if not a valid timestamp
      },
    }

    const input = {
      numericTimestamp: { $epochToDateTime: 1609459200 },
      stringTimestamp: { $epochToDateTime: '1609459200' },
      invalidTimestamp: { $epochToDateTime: 'invalid' },
      nullTimestamp: { $epochToDateTime: null },
    }

    const result = resolveMarkers(input, transformations)

    expect(result).toEqual({
      numericTimestamp: '2021-01-01T00:00:00.000Z',
      stringTimestamp: '2021-01-01T00:00:00.000Z',
      invalidTimestamp: 'invalid',
      nullTimestamp: null,
    })
  })
})

describe('omitNullExcept', () => {
  it('drops nulls except on the listed keys', () => {
    expect(
      omitNullExcept({ a: null, b: null, c: 1, d: undefined }, ['b'])
    ).toEqual({ b: null, c: 1, d: undefined })
  })

  it('is a plain null omit when no keys are listed', () => {
    expect(omitNullExcept({ a: null, c: 1 }, [])).toEqual({ c: 1 })
  })
})
