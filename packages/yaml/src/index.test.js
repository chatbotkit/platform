import { isParsable, parse, stringify, tryParse, tryStringify } from './index'

describe('yaml library', () => {
  describe('parse', () => {
    describe('valid inputs', () => {
      it('should parse simple key-value YAML', () => {
        const yaml = 'name: John'
        const result = parse(yaml)

        expect(result).toEqual({ name: 'John' })
      })

      it('should parse nested objects', () => {
        const yaml = `
user:
  name: John
  age: 30
  address:
    city: NYC
    zip: 10001
`
        const result = parse(yaml)

        expect(result).toEqual({
          user: {
            name: 'John',
            age: 30,
            address: {
              city: 'NYC',
              zip: 10001,
            },
          },
        })
      })

      it('should parse arrays', () => {
        const yaml = `
items:
  - apple
  - banana
  - orange
`
        const result = parse(yaml)

        expect(result).toEqual({
          items: ['apple', 'banana', 'orange'],
        })
      })

      it('should parse boolean values', () => {
        const yaml = `
enabled: true
disabled: false
`
        const result = parse(yaml)

        expect(result).toEqual({
          enabled: true,
          disabled: false,
        })
      })

      it('should parse null values', () => {
        const yaml = `
value: null
empty: ~
`
        const result = parse(yaml)

        expect(result).toEqual({
          value: null,
          empty: null,
        })
      })

      it('should parse numeric values', () => {
        const yaml = `
integer: 42
float: 3.14
negative: -10
scientific: 1e6
`
        const result = parse(yaml)

        expect(result).toEqual({
          integer: 42,
          float: 3.14,
          negative: -10,
          scientific: 1000000,
        })
      })

      it('should parse multiline strings', () => {
        const yaml = `
description: |
  This is a multiline
  string that preserves
  line breaks
`
        const result = parse(yaml)

        expect(result.description).toBe(
          'This is a multiline\nstring that preserves\nline breaks\n'
        )
      })

      it('should parse quoted strings', () => {
        const yaml = `
single: 'single quoted'
double: "double quoted"
special: "string with \\"quotes\\""
`
        const result = parse(yaml)

        expect(result).toEqual({
          single: 'single quoted',
          double: 'double quoted',
          special: 'string with "quotes"',
        })
      })

      it('should handle YAML with comments', () => {
        const yaml = `
# This is a comment
name: John  # inline comment
age: 30
`
        const result = parse(yaml)

        expect(result).toEqual({
          name: 'John',
          age: 30,
        })
      })

      it('should parse empty YAML as undefined', () => {
        const result = parse('')

        expect(result).toBeUndefined()
      })

      it('should parse whitespace-only YAML as null', () => {
        const result = parse('   \n  \t  ')

        expect(result).toBeNull()
      })
    })

    describe('invalid inputs', () => {
      it('should NOT throw on malformed YAML that js-yaml can parse', () => {
        // @note js-yaml is more permissive than expected - this actually parses

        const yaml = `
name: John
  invalid indentation
age: 30
`
        const result = parse(yaml)

        expect(result).toEqual({
          name: 'John invalid indentation',
          age: 30,
        })
      })

      it('should throw on invalid syntax', () => {
        const invalidYaml = 'name: [unclosed array'

        expect(() => parse(invalidYaml)).toThrow()
      })

      it('should throw on duplicate keys in strict mode', () => {
        const duplicateKeys = `
name: John
name: Jane
`

        expect(() => parse(duplicateKeys)).toThrow()
      })

      it('should handle non-string input by converting to string first', () => {
        // @note js-yaml converts non-strings to strings before parsing
        expect(() => parse(null)).not.toThrow()
        expect(() => parse(undefined)).not.toThrow()
        expect(() => parse(123)).not.toThrow()
        expect(() => parse({})).not.toThrow()
      })
    })

    describe('security concerns', () => {
      it('SECURITY - should NOT execute JavaScript code in YAML', () => {
        // @note This tests a critical security vulnerability - js-yaml.load()
        // can execute code - we're using console.log to verify no execution
        // occurs
        // eslint-disable-next-line no-console
        const originalLog = console.log

        const logSpy = jest.fn()

        // eslint-disable-next-line no-console
        console.log = logSpy

        try {
          const maliciousYaml = `
!!js/function "function() { console.log('SECURITY_BREACH'); return 'hacked'; }"
`
          // this should throw an error since js-yaml.load() is dangerous

          expect(() => parse(maliciousYaml)).toThrow()

          // verify no code was executed

          expect(logSpy).not.toHaveBeenCalledWith('SECURITY_BREACH')
        } finally {
          // eslint-disable-next-line no-console
          console.log = originalLog
        }
      })

      it('SECURITY - should handle potentially dangerous constructor calls', () => {
        const maliciousYaml = `
constructor:
  prototype:
    isAdmin: true
`
        const result = parse(maliciousYaml)

        // Should parse as regular data, not affect prototypes
        expect(result).toEqual({
          constructor: {
            prototype: {
              isAdmin: true,
            },
          },
        })

        // Verify it didn't pollute global prototypes
        expect({}.isAdmin).toBeUndefined()
      })

      it('SECURITY - should handle extremely deep nesting without stack overflow', () => {
        // Create deeply nested YAML (but not excessively deep to avoid test timeouts)
        let deepYaml = 'level0:'

        for (let i = 1; i < 100; i++) {
          deepYaml += `\n${'  '.repeat(i)}level${i}:`
        }

        deepYaml += `\n${'  '.repeat(100)}value: deep`

        // @note the property under test is that hostile depth cannot crash the
        // process. Parsing successfully satisfies it, and so does js-yaml's
        // own controlled maxDepth rejection (added in 4.1.1) - the assertion
        // accepts either, because which one happens depends on the resolved
        // js-yaml version.
        try {
          parse(deepYaml)
        } catch (error) {
          expect(error.name).toBe('YAMLException')
          expect(error.message).toMatch(/maxDepth/)
        }
      })

      it('SECURITY - should handle very large arrays without memory exhaustion', () => {
        const largeArray = 'items:\n' + '  - item\n'.repeat(1000)

        const result = parse(largeArray)

        expect(Array.isArray(result.items)).toBe(true)
        expect(result.items).toHaveLength(1000)
        expect(result.items[0]).toBe('item')
      })

      it('SECURITY - should handle YAML with binary data indicators but throw on unsupported tags', () => {
        const binaryYaml = `
data: !!binary |
  R0lGODlhDAAMAIQAAP//9/X17unp5WZmZgAAAOfn515eXvPz7Y6OjuDg4J+fn5
  OTk6enp56enmlpaWNjY6Ojo4SEhP/++f/++f/++f/++f/++f/++f/++f/++f/+
  +f/++f/++f/++f/++f/++SH+Dk1hZGUgd2l0aCBHSU1QACwAAAAADAAMAAAFLC
`
        // @note js-yaml throws on !!binary tag by default

        expect(() => parse(binaryYaml)).toThrow()
      })

      it('SECURITY - should handle anchor and alias references safely', () => {
        const yamlWithAnchors = `
default: &default
  timeout: 30
  retries: 3

development:
  <<: *default
  debug: true

production:
  <<: *default
  debug: false
`
        const result = parse(yamlWithAnchors)

        expect(result).toEqual({
          default: {
            timeout: 30,
            retries: 3,
          },
          development: {
            timeout: 30,
            retries: 3,
            debug: true,
          },
          production: {
            timeout: 30,
            retries: 3,
            debug: false,
          },
        })
      })

      it('SECURITY - should handle potentially dangerous tag types by throwing errors', () => {
        // Test various potentially dangerous YAML tags - should throw errors
        const dangerousYaml = `
# These should throw errors since they use unsupported tags
regex: !!js/regexp /test/gi
func: !!js/undefined ""
`

        // Should throw error on unsupported js tags
        expect(() => parse(dangerousYaml)).toThrow()
      })
    })

    describe('edge cases', () => {
      it('should handle unicode characters', () => {
        const unicodeYaml = `
emoji: 🚀
chinese: 你好
japanese: こんにちは
arabic: مرحبا
`
        const result = parse(unicodeYaml)

        expect(result).toEqual({
          emoji: '🚀',
          chinese: '你好',
          japanese: 'こんにちは',
          arabic: 'مرحبا',
        })
      })

      it('should handle special characters in keys', () => {
        const specialKeys = `
"key with spaces": value1
"key-with-dashes": value2
"key.with.dots": value3
"key:with:colons": value4
`
        const result = parse(specialKeys)

        expect(result).toEqual({
          'key with spaces': 'value1',
          'key-with-dashes': 'value2',
          'key.with.dots': 'value3',
          'key:with:colons': 'value4',
        })
      })

      it('should handle very long strings', () => {
        const longValue = 'x'.repeat(10000)
        const yaml = `longString: "${longValue}"`

        const result = parse(yaml)

        expect(result.longString).toBe(longValue)
      })

      it('should handle timestamp-like strings', () => {
        const timestampYaml = `
date1: 2023-01-01
date2: "2023-01-01T10:00:00Z"
time: 14:30:15
`
        const result = parse(timestampYaml)

        // js-yaml may parse these as Date objects or strings

        expect(result.date1).toBeDefined()
        expect(result.date2).toBe('2023-01-01T10:00:00Z')
        expect(result.time).toBeDefined()
      })
    })
  })

  describe('tryParse', () => {
    it('should return parsed result for valid YAML', () => {
      const yaml = 'name: John'
      const result = tryParse(yaml)

      expect(result).toEqual({ name: 'John' })
    })

    it('should return null for invalid YAML', () => {
      const invalidYaml = 'name: [unclosed array'
      const result = tryParse(invalidYaml)

      expect(result).toBeNull()
    })

    it('should handle non-string input by converting to string', () => {
      // @note js-yaml converts inputs to string before parsing

      expect(tryParse(null)).toBeNull()
      expect(tryParse(undefined)).toBe('undefined')
      expect(tryParse(123)).toEqual(123)
      expect(tryParse({})).toEqual(['object Object'])
    })

    it('SECURITY - should handle malicious YAML safely', () => {
      const maliciousYaml = `
!!js/function "function() { throw new Error('exploit'); }"
`
      const result = tryParse(maliciousYaml)

      // should return null, not throw or execute code

      expect(result).toBeNull()
    })

    it('should return parsed result for complex valid YAML', () => {
      const complexYaml = `
user:
  name: John
  hobbies:
    - reading
    - coding
  settings:
    theme: dark
`
      const result = tryParse(complexYaml)

      expect(result).toEqual({
        user: {
          name: 'John',
          hobbies: ['reading', 'coding'],
          settings: {
            theme: 'dark',
          },
        },
      })
    })
  })

  describe('stringify', () => {
    describe('valid inputs', () => {
      it('should stringify simple objects', () => {
        const obj = { name: 'John', age: 30 }
        const result = stringify(obj)

        expect(result).toContain('name: John')
        expect(result).toContain('age: 30')
        expect(typeof result).toBe('string')
      })

      it('should stringify nested objects', () => {
        const obj = {
          user: {
            name: 'John',
            address: {
              city: 'NYC',
            },
          },
        }
        const result = stringify(obj)

        expect(result).toContain('user:')
        expect(result).toContain('name: John')
        expect(result).toContain('address:')
        expect(result).toContain('city: NYC')
      })

      it('should stringify arrays', () => {
        const obj = { items: ['apple', 'banana', 'orange'] }
        const result = stringify(obj)

        expect(result).toContain('items:')
        expect(result).toContain('- apple')
        expect(result).toContain('- banana')
        expect(result).toContain('- orange')
      })

      it('should stringify boolean and null values', () => {
        const obj = {
          enabled: true,
          disabled: false,
          empty: null,
          undefined: undefined,
        }
        const result = stringify(obj)

        expect(result).toContain('enabled: true')
        expect(result).toContain('disabled: false')
        expect(result).toContain('empty: null')
      })

      it('should stringify numbers', () => {
        const obj = {
          integer: 42,
          float: 3.14,
          negative: -10,
          zero: 0,
        }
        const result = stringify(obj)

        expect(result).toContain('integer: 42')
        expect(result).toContain('float: 3.14')
        expect(result).toContain('negative: -10')
        expect(result).toContain('zero: 0')
      })

      it('should handle strings with special characters', () => {
        const obj = {
          simple: 'hello',
          withSpaces: 'hello world',
          withQuotes: 'say "hello"',
          withNewlines: 'line1\nline2',
        }
        const result = stringify(obj)

        expect(result).toContain('simple: hello')
        expect(result).toContain('withSpaces: hello world')
        expect(result).toContain('withQuotes:')
        expect(result).toContain('withNewlines:')
      })

      it('should handle unicode characters', () => {
        const obj = {
          emoji: '🚀',
          chinese: '你好',
          japanese: 'こんにちは',
        }
        const result = stringify(obj)

        expect(result).toContain('emoji: 🚀')
        expect(result).toContain('chinese: 你好')
        expect(result).toContain('japanese: こんにちは')
      })
    })

    describe('options handling', () => {
      it('should use default lineWidth when no options provided', () => {
        const obj = { key: 'value' }
        const result = stringify(obj)

        expect(typeof result).toBe('string')
        expect(result).toContain('key: value')
      })

      it('should respect lineWidth option', () => {
        const obj = {
          longKey:
            'this is a very long string that might wrap depending on line width settings and formatting preferences',
        }

        const resultShort = stringify(obj, { lineWidth: 20 })
        const resultLong = stringify(obj, { lineWidth: 200 })

        expect(typeof resultShort).toBe('string')
        expect(typeof resultLong).toBe('string')

        // both should contain the key-value pair

        expect(resultShort).toContain('longKey:')
        expect(resultLong).toContain('longKey:')
      })

      it('should handle lineWidth -1 (no wrapping)', () => {
        const obj = {
          veryLongKey: 'x'.repeat(1000),
        }
        const result = stringify(obj, { lineWidth: -1 })

        expect(typeof result).toBe('string')
        expect(result).toContain('veryLongKey:')
      })

      it('should handle undefined options', () => {
        const obj = { key: 'value' }
        const result = stringify(obj, undefined)

        expect(typeof result).toBe('string')
        expect(result).toContain('key: value')
      })

      it('should handle empty options object', () => {
        const obj = { key: 'value' }
        const result = stringify(obj, {})

        expect(typeof result).toBe('string')
        expect(result).toContain('key: value')
      })
    })

    describe('edge cases', () => {
      it('should stringify empty object', () => {
        const result = stringify({})

        expect(result).toBe('{}\n')
      })

      it('should stringify empty array', () => {
        const result = stringify([])

        expect(result).toBe('[]\n')
      })

      it('should stringify primitive values', () => {
        expect(stringify('hello')).toBe('hello\n')
        expect(stringify(42)).toBe('42\n')
        expect(stringify(true)).toBe('true\n')
        expect(stringify(null)).toBe('null\n')
      })

      it('should handle circular references by creating YAML anchors', () => {
        const obj = { name: 'test' }

        obj.self = obj // create circular reference

        // @note js-yaml handles circular references using YAML anchors/aliases

        const result = stringify(obj)

        expect(result).toContain('&ref_0')
        expect(result).toContain('*ref_0')
        expect(result).toContain('name: test')
      })

      it('should handle very deep objects', () => {
        let deep = { value: 'deep' }

        for (let i = 0; i < 50; i++) {
          deep = { level: deep }
        }

        const result = stringify(deep)

        expect(typeof result).toBe('string')
        expect(result).toContain('value: deep')
      })

      it('should handle objects with Date objects', () => {
        const obj = {
          created: new Date('2023-01-01T00:00:00Z'),
          name: 'test',
        }
        const result = stringify(obj)

        expect(typeof result).toBe('string')
        expect(result).toContain('name: test')
        expect(result).toContain('created:')
      })

      it('should throw on objects with functions', () => {
        const obj = {
          name: 'test',
          fn: function () {
            return 'hello'
          },
          arrow: () => 'world',
        }

        // @note js-yaml throws on functions - they cannot be serialized to YAML

        expect(() => stringify(obj)).toThrow()
      })
    })

    describe('invalid inputs', () => {
      it('should NOT throw on undefined input', () => {
        // @note js-yaml stringify handles undefined by returning empty string

        const result = stringify(undefined)

        expect(result).toBe('')
      })

      it('should handle symbol values', () => {
        const obj = {
          name: 'test',
          sym: Symbol('test'),
        }

        expect(() => stringify(obj)).toThrow()
      })
    })
  })

  describe('tryStringify', () => {
    it('should return YAML string for valid input', () => {
      const obj = { name: 'John', age: 30 }
      const result = tryStringify(obj)

      expect(typeof result).toBe('string')
      expect(result).toContain('name: John')
      expect(result).toContain('age: 30')
    })

    it('should handle circular references by using YAML anchors', () => {
      const circular = { name: 'test' }

      circular.self = circular

      const result = tryStringify(circular)

      // @note js-yaml creates anchors for circular references

      expect(result).toContain('&ref_0')
      expect(result).toContain('*ref_0')
      expect(result).toContain('name: test')
    })

    it('should return empty string for undefined', () => {
      const result = tryStringify(undefined)

      expect(result).toBe('')
    })

    it('should return empty string for functions', () => {
      const obj = {
        name: 'test',
        fn: function () {
          return 'hello'
        },
      }

      const result = tryStringify(obj)

      expect(result).toBe('')
    })

    it('should handle options parameter', () => {
      const obj = { key: 'value' }
      const result = tryStringify(obj, { lineWidth: 50 })

      expect(typeof result).toBe('string')
      expect(result).toContain('key: value')
    })

    it('should return empty string for symbols', () => {
      const obj = {
        name: 'test',
        sym: Symbol('test'),
      }
      const result = tryStringify(obj)

      expect(result).toBe('')
    })

    it('should handle complex valid objects', () => {
      const obj = {
        user: {
          name: 'John',
          hobbies: ['reading', 'coding'],
          active: true,
        },
      }
      const result = tryStringify(obj)

      expect(typeof result).toBe('string')
      expect(result).toContain('name: John')
      expect(result).toContain('- reading')
      expect(result).toContain('active: true')
    })

    it('should pass through options correctly', () => {
      const obj = { test: 'value' }

      // test with different lineWidth options

      const result1 = tryStringify(obj, { lineWidth: 10 })
      const result2 = tryStringify(obj, { lineWidth: 100 })

      expect(typeof result1).toBe('string')
      expect(typeof result2).toBe('string')
      expect(result1).toContain('test: value')
      expect(result2).toContain('test: value')
    })
  })

  describe('isParsable', () => {
    it('should return true for valid YAML', () => {
      expect(isParsable('name: John')).toBe(true)
      expect(isParsable('age: 30')).toBe(true)
      expect(isParsable('')).toBe(true) // empty string is valid YAML
      expect(isParsable('   ')).toBe(true) // whitespace is valid YAML
    })

    it('should return true for complex valid YAML', () => {
      const complexYaml = `
user:
  name: John
  hobbies:
    - reading
    - coding
  settings:
    theme: dark
    enabled: true
`

      expect(isParsable(complexYaml)).toBe(true)
    })

    it('should return true for most inputs due to js-yaml flexibility', () => {
      expect(isParsable('name: [unclosed array')).toBe(false)
      expect(isParsable('invalid: }')).toBe(false)

      // @note js-yaml is more permissive than expected
      expect(isParsable('name:\n  invalid indentation')).toBe(true)
    })

    it('should return true for non-string input due to js-yaml conversion', () => {
      // @note js-yaml converts inputs to string before parsing
      expect(isParsable(null)).toBe(true)
      expect(isParsable(undefined)).toBe(true)
      expect(isParsable(123)).toBe(true)
      expect(isParsable({})).toBe(true)
      expect(isParsable([])).toBe(true)
    })

    it('SECURITY - should return false for potentially malicious YAML', () => {
      const maliciousYaml = `
!!js/function "function() { return 'exploit'; }"
`

      expect(isParsable(maliciousYaml)).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isParsable('null')).toBe(true)
      expect(isParsable('true')).toBe(true)
      expect(isParsable('false')).toBe(true)
      expect(isParsable('42')).toBe(true)
      expect(isParsable('3.14')).toBe(true)
      expect(isParsable('"quoted string"')).toBe(true)
    })

    it('should return true for YAML with comments', () => {
      const yamlWithComments = `
# This is a comment
name: John  # inline comment
age: 30
`

      expect(isParsable(yamlWithComments)).toBe(true)
    })

    it('should handle unicode content', () => {
      expect(isParsable('emoji: 🚀')).toBe(true)
      expect(isParsable('chinese: 你好')).toBe(true)
    })

    it('should return true for multiline strings', () => {
      const multilineYaml = `
description: |
  This is a multiline
  string that spans
  multiple lines
`

      expect(isParsable(multilineYaml)).toBe(true)
    })
  })

  describe('integration tests', () => {
    it('should round-trip simple objects correctly', () => {
      const original = {
        name: 'John',
        age: 30,
        active: true,
        tags: ['user', 'admin'],
        settings: {
          theme: 'dark',
          notifications: true,
        },
      }

      const yaml = stringify(original)
      const parsed = parse(yaml)

      expect(parsed).toEqual(original)
    })

    it('should handle the complete workflow with tryParse and tryStringify', () => {
      const original = { test: 'value', number: 42 }

      const yaml = tryStringify(original)

      expect(yaml).not.toBe('')

      const parsed = tryParse(yaml)

      expect(parsed).toEqual(original)

      expect(isParsable(yaml)).toBe(true)
    })

    it('should preserve data types through round-trip', () => {
      const original = {
        string: 'hello',
        number: 42,
        float: 3.14,
        boolean: true,
        nullValue: null,
        array: [1, 2, 3],
        nested: {
          key: 'value',
        },
      }

      const yaml = stringify(original)
      const parsed = parse(yaml)

      expect(parsed.string).toBe('hello')
      expect(parsed.number).toBe(42)
      expect(parsed.float).toBe(3.14)
      expect(parsed.boolean).toBe(true)
      expect(parsed.nullValue).toBeNull()
      expect(parsed.array).toEqual([1, 2, 3])
      expect(parsed.nested).toEqual({ key: 'value' })
    })

    it('should handle error cases consistently across functions', () => {
      const invalidYaml = 'name: [unclosed'

      // parse should throw

      expect(() => parse(invalidYaml)).toThrow()

      // tryParse should return null

      expect(tryParse(invalidYaml)).toBeNull()

      // isParsable should return false

      expect(isParsable(invalidYaml)).toBe(false)
    })

    it('SECURITY - should handle security concerns consistently', () => {
      const maliciousYaml = `!!js/function "function() { return 'hack'; }"`

      // all functions should handle this safely

      expect(() => parse(maliciousYaml)).toThrow()
      expect(tryParse(maliciousYaml)).toBeNull()
      expect(isParsable(maliciousYaml)).toBe(false)
    })
  })

  describe('performance and resource usage', () => {
    it('should handle moderately large objects efficiently', () => {
      // create an object with 1000 properties

      const largeObj = {}

      for (let i = 0; i < 1000; i++) {
        largeObj[`key${i}`] = `value${i}`
      }

      const startTime = Date.now()
      const yaml = stringify(largeObj)
      const parsed = parse(yaml)
      const endTime = Date.now()

      expect(parsed).toEqual(largeObj)
      expect(endTime - startTime).toBeLessThan(1000) // should complete within 1 second
    })

    it('should handle arrays with many elements', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `item${i}`,
      }))
      const obj = { items: largeArray }

      const yaml = stringify(obj)
      const parsed = parse(yaml)

      expect(parsed.items).toHaveLength(1000)
      expect(parsed.items[0]).toEqual({ id: 0, name: 'item0' })
      expect(parsed.items[999]).toEqual({ id: 999, name: 'item999' })
    })

    it('should handle deeply nested structures within reason', () => {
      // create a 20-level deep nested structure

      let nested = { value: 'deep' }

      for (let i = 0; i < 20; i++) {
        nested = { [`level${i}`]: nested }
      }

      const yaml = stringify(nested)
      const parsed = parse(yaml)

      // navigate to the deep value

      let current = parsed

      for (let i = 19; i >= 0; i--) {
        current = current[`level${i}`]
      }

      expect(current.value).toBe('deep')
    })
  })
})
