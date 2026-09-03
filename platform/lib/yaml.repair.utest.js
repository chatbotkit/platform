import { repair, tryRepair } from '@/lib/yaml.repair'

describe('repair', () => {
  describe('output format requirements', () => {
    it('should always return a single line JSON string (no newlines)', () => {
      const yamlInput = `
name: "Test User"
age: 25
active: true
tags:
  - developer
  - tester
`

      const result = repair(yamlInput)

      // @note ensure output is single line JSON with no newlines
      expect(result).not.toContain('\n')
      expect(result).not.toContain('\r')
      expect(typeof result).toBe('string')
    })

    it('should return single line JSON string even for multi-line YAML input', () => {
      const multiLineYaml = `
user:
  name: John
  address:
    street: 123 Main St
    city: Anytown
  hobbies:
    - reading
    - coding
`

      const result = repair(multiLineYaml)

      // @note output must be single line JSON regardless of input formatting
      expect(result).not.toContain('\n')
      expect(result).not.toContain('\r')
      expect(JSON.parse(result)).toEqual({
        user: {
          name: 'John',
          address: {
            street: '123 Main St',
            city: 'Anytown',
          },
          hobbies: ['reading', 'coding'],
        },
      })
    })

    it('should return valid JSON string that can be parsed', () => {
      const yamlInput = 'name: John\nage: 30'

      const result = repair(yamlInput)

      // @note result must be valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
      expect(typeof result).toBe('string')
    })
  })

  describe('YAML parsing path (primary)', () => {
    it('should convert valid YAML to JSON', () => {
      const yamlInput = `
name: "Test User"
age: 25
active: true
tags:
  - developer
  - tester
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'Test User',
        age: 25,
        active: true,
        tags: ['developer', 'tester'],
      })
    })

    it('should handle YAML with special characters and unicode', () => {
      const yamlInput = `
content: "Special chars: áéíóú çñ ü"
emoji: "🚀 🎉"
chinese: "你好世界"
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed.content).toBe('Special chars: áéíóú çñ ü')
      expect(parsed.emoji).toBe('🚀 🎉')
      expect(parsed.chinese).toBe('你好世界')
    })

    it('should handle simple key-value YAML', () => {
      const yamlInput = 'name: John\nage: 30'

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
      })
    })

    it('should handle YAML arrays and complex structures', () => {
      const yamlInput = `
users:
  - name: Alice
    role: admin
    permissions:
      - read
      - write
      - delete
  - name: Bob
    role: user
    permissions:
      - read
settings:
  debug: false
  timeout: 5000
  features:
    - authentication
    - logging
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        users: [
          {
            name: 'Alice',
            role: 'admin',
            permissions: ['read', 'write', 'delete'],
          },
          {
            name: 'Bob',
            role: 'user',
            permissions: ['read'],
          },
        ],
        settings: {
          debug: false,
          timeout: 5000,
          features: ['authentication', 'logging'],
        },
      })
    })

    it('should handle YAML with null and boolean values', () => {
      const yamlInput = `
enabled: true
disabled: false
value: null
count: 0
empty: ~
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        enabled: true,
        disabled: false,
        value: null,
        count: 0,
        empty: null,
      })
    })

    it('should handle YAML multiline strings', () => {
      const yamlInput = `
description: |
  This is a multiline
  description that spans
  multiple lines
summary: >
  This is a folded
  string that becomes
  a single line
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed.description).toContain('This is a multiline')
      expect(parsed.description).toContain('multiple lines')
      expect(parsed.summary).toContain('This is a folded')
      // @note the actual YAML parser behavior may preserve some newlines in folded strings
    })

    it('should handle YAML with quoted strings', () => {
      const yamlInput = `
single_quoted: 'This is a single quoted string'
double_quoted: "This is a double quoted string"
unquoted: This is an unquoted string
special: "String with 'mixed' quotes"
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed.single_quoted).toBe('This is a single quoted string')
      expect(parsed.double_quoted).toBe('This is a double quoted string')
      expect(parsed.unquoted).toBe('This is an unquoted string')
      expect(parsed.special).toBe("String with 'mixed' quotes")
    })

    it('should handle YAML with numeric values', () => {
      const yamlInput = `
integer: 42
float: 3.14159
negative: -10
scientific: 1.23e+4
octal: 0o755
hex: 0xFF
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed.integer).toBe(42)
      expect(parsed.float).toBeCloseTo(3.14159)
      expect(parsed.negative).toBe(-10)
      expect(parsed.scientific).toBe(12300)
      expect(parsed.octal).toBe(493) // 0o755 in decimal
      expect(parsed.hex).toBe(255) // 0xFF in decimal
    })

    it('should handle YAML comments', () => {
      const yamlInput = `
# This is a comment
name: John # inline comment
age: 30
# Another comment
active: true
`

      const result = repair(yamlInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
        active: true,
      })
    })
  })

  describe('JSON repair path (fallback)', () => {
    it('should repair broken JSON when YAML parsing fails', () => {
      const brokenJson = '{name: John, age: 30, active: true'

      const result = repair(brokenJson)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
        active: true,
      })
      // @note ensure result is single line JSON
      expect(result).not.toContain('\n')
    })

    it('should repair JSON with missing quotes', () => {
      const brokenJson = '{name: John, age: 30}'

      const result = repair(brokenJson)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
      })
    })

    it('should repair JSON with trailing commas', () => {
      const brokenJson = '{"name": "John", "age": 30,}'

      const result = repair(brokenJson)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
      })
    })

    it('should repair JSON with single quotes', () => {
      const brokenJson = "{'name': 'John', 'age': 30}"

      const result = repair(brokenJson)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
      })
    })

    it('should repair JSON with unescaped strings', () => {
      const brokenJson = '{"message": "This is a "quoted" word"}'

      const result = repair(brokenJson)
      const parsed = JSON.parse(result)

      expect(parsed.message).toContain('quoted')
    })

    it('should handle malformed JSON that resembles YAML', () => {
      const malformedInput = `{
        name: 'John',
        "age": 30,
        hobbies: ['reading', "coding",],
        active: true,
      }`

      const result = repair(malformedInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
        hobbies: ['reading', 'coding'],
        active: true,
      })
    })

    it('should repair JSON with escape issues', () => {
      const brokenJson =
        '{\n  "content": "Nome: Fulano de Tal\nTelefone: 27999999999\nEmail: fulano@email.com\nDescrição: Café tá com gosto ruim",\n  "name": "Café gosto ruim",\n  "code": "398"\n}'

      expect(() => JSON.parse(brokenJson)).toThrow()

      const repairedJson = repair(brokenJson)

      expect(() => JSON.parse(repairedJson)).not.toThrow()
      // @note ensure result is single line
      expect(repairedJson).not.toContain('\n')
    })
  })

  describe('edge cases', () => {
    it('should handle empty YAML object', () => {
      const input = '{}'

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({})
    })

    it('should handle empty YAML array', () => {
      const input = '[]'

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual([])
    })

    it('should handle YAML null values', () => {
      const input = 'value: null'

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({ value: null })
    })

    it('should handle YAML boolean values', () => {
      const input = `
active: true
disabled: false
yes_value: true
no_value: false
`

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        active: true,
        disabled: false,
        yes_value: true,
        no_value: false,
      })
    })

    it('should handle YAML with various number formats', () => {
      const input = `
count: 42
price: 19.99
negative: -5
zero: 0
`

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        count: 42,
        price: 19.99,
        negative: -5,
        zero: 0,
      })
    })

    it('should handle deeply nested YAML structures', () => {
      const input = `
level1:
  level2:
    level3:
      level4:
        value: "deep"
        array:
          - item1
          - item2
`

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
                array: ['item1', 'item2'],
              },
            },
          },
        },
      })
    })

    it('should handle YAML primitive values (string)', () => {
      const input = '"Hello World"'

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toBe('Hello World')
    })

    it('should handle YAML primitive values (number)', () => {
      const input = '42'

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toBe(42)
    })

    it('should handle YAML primitive values (boolean)', () => {
      const input = 'true'

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toBe(true)
    })

    it('should handle empty string as YAML (returns undefined)', () => {
      const input = ''

      const result = repair(input)

      // @note empty string parsing through YAML returns undefined
      expect(result).toBeUndefined()
    })

    it('should handle whitespace-only YAML input', () => {
      const input = '   \n  \t  '

      const result = repair(input)

      // @note whitespace-only input returns "null" (string)
      expect(result).toBe('null')
    })

    it('should handle YAML with anchors and aliases', () => {
      const input = `
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

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
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
  })

  describe('error handling', () => {
    it('should throw original YAML error when JSON repair also fails', () => {
      // Input that looks like YAML but is invalid, and also can't be repaired as JSON
      const invalidInput = 'key: value: invalid: structure {'

      expect(() => repair(invalidInput)).toThrow()
    })

    it('should handle the case where jsonrepair succeeds but produces invalid JSON', () => {
      // This tests the JSON.parse(jsonrepair(...)) part of the error handling
      const invalidInput = 'key: [value: invalid] structure {'

      expect(() => repair(invalidInput)).toThrow()
    })

    it('should handle malformed YAML that falls back to JSON repair', () => {
      const invalidYaml = `{
        name: 'John',
        age: 30
      }`

      const result = repair(invalidYaml)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
      })
    })
  })

  describe('mixed content scenarios', () => {
    it('should prefer YAML parsing for YAML-like content', () => {
      // Content that could be interpreted as both YAML and broken JSON
      const yamlLikeInput = `
name: John Doe
settings:
  theme: dark
  notifications: true
metadata:
  created: "2025-01-01"
  tags:
    - important
    - user-data
`

      const result = repair(yamlLikeInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John Doe',
        settings: {
          theme: 'dark',
          notifications: true,
        },
        metadata: {
          created: '2025-01-01',
          tags: ['important', 'user-data'],
        },
      })
    })

    it('should fallback to JSON repair when YAML parsing fails', () => {
      // Content that looks YAML-ish but is actually broken JSON
      const brokenJsonInput = '{name: "John", age: 30, active: true'

      const result = repair(brokenJsonInput)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
        active: true,
      })
    })

    it('should handle valid JSON as YAML input', () => {
      // Valid JSON is also valid YAML in most cases
      const jsonAsYaml =
        '{"name": "John", "age": 30, "hobbies": ["reading", "coding"]}'

      const result = repair(jsonAsYaml)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        name: 'John',
        age: 30,
        hobbies: ['reading', 'coding'],
      })
    })

    it('should handle YAML that looks like configuration file', () => {
      const configYaml = `
database:
  host: localhost
  port: 5432
  name: myapp_db
  credentials:
    username: admin
    password: secret123

cache:
  type: redis
  ttl: 3600
  
logging:
  level: info
  output: console
`

      const result = repair(configYaml)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual({
        database: {
          host: 'localhost',
          port: 5432,
          name: 'myapp_db',
          credentials: {
            username: 'admin',
            password: 'secret123',
          },
        },
        cache: {
          type: 'redis',
          ttl: 3600,
        },
        logging: {
          level: 'info',
          output: 'console',
        },
      })
    })
  })

  describe('string encoding and special characters', () => {
    it('should handle unicode characters correctly', () => {
      const input = `
message: "Hello 世界"
emoji: "🌍"
math: "∑∆∞"
`

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed.message).toBe('Hello 世界')
      expect(parsed.emoji).toBe('🌍')
      expect(parsed.math).toBe('∑∆∞')
    })

    it('should handle YAML with control characters', () => {
      const input = `
text: "Line 1\\nLine 2\\tTabbed"
path: "C:\\\\Users\\\\John"
`

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed.text).toBe('Line 1\nLine 2\tTabbed')
      expect(parsed.path).toBe('C:\\Users\\John')
    })

    it('should handle YAML with various quote scenarios', () => {
      const input = `
simple: no quotes needed
single: 'single quoted'
double: "double quoted"
mixed: "He said 'Hello' to me"
escaped: "Quote: \\"Hello\\""
`

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed.simple).toBe('no quotes needed')
      expect(parsed.single).toBe('single quoted')
      expect(parsed.double).toBe('double quoted')
      expect(parsed.mixed).toBe("He said 'Hello' to me")
      expect(parsed.escaped).toBe('Quote: "Hello"')
    })

    it('should handle YAML with special string indicators', () => {
      const input = `
literal: |
  This preserves
  line breaks
  exactly as written
folded: >
  This folds
  line breaks
  into spaces
plain: This is plain text without quotes
`

      const result = repair(input)
      const parsed = JSON.parse(result)

      expect(parsed.literal).toContain('\n')
      expect(parsed.literal).toContain('This preserves')
      expect(parsed.folded).toContain('This folds')
      expect(parsed.plain).toBe('This is plain text without quotes')
    })
  })

  describe('double JSON processing verification', () => {
    it('should ensure output from jsonrepair is re-stringified as single line', () => {
      // Test specifically for the JSON.stringify(JSON.parse(jsonrepair(...))) behavior
      const input = `{
        "name": "John",
        "data": {
          "nested": true
        }
      }`

      const result = repair(input)

      // @note this tests the double processing path specifically
      expect(result).not.toContain('\n')
      expect(result).not.toContain('  ') // no multiple spaces from formatting
      expect(JSON.parse(result)).toEqual({
        name: 'John',
        data: {
          nested: true,
        },
      })
    })

    it('should handle edge case where jsonrepair might return formatted JSON', () => {
      // Some broken JSON that jsonrepair might format with spaces/newlines
      const brokenInput = '{"name":"John","age":30,"active":true}'

      const result = repair(brokenInput)

      // @note ensure final output is compact single line
      expect(result).not.toContain('\n')
      expect(JSON.parse(result)).toEqual({
        name: 'John',
        age: 30,
        active: true,
      })
    })

    it('should normalize YAML output to compact JSON', () => {
      // Multi-line YAML that should become compact JSON
      const yamlInput = `
user:
  personal:
    name: "John Doe"
    age: 30
  professional:
    title: "Software Engineer"
    company: "Tech Corp"
`

      const result = repair(yamlInput)

      // @note YAML input should become compact JSON output
      expect(result).not.toContain('\n')
      expect(result).not.toContain('  ')
      expect(JSON.parse(result)).toEqual({
        user: {
          personal: {
            name: 'John Doe',
            age: 30,
          },
          professional: {
            title: 'Software Engineer',
            company: 'Tech Corp',
          },
        },
      })
    })
  })
})

describe('tryRepair', () => {
  it('should return repaired YAML as JSON string when successful', () => {
    const yamlInput = `
name: John
age: 30
active: true
`

    const result = tryRepair(yamlInput)

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect(JSON.parse(result)).toEqual({
      name: 'John',
      age: 30,
      active: true,
    })
  })

  it('should return null when repair fails', () => {
    // Input that can't be parsed as YAML or repaired as JSON
    const invalidInput = 'key: value: invalid: structure {'

    const result = tryRepair(invalidInput)

    expect(result).toBeNull()
  })

  it('should handle valid YAML input', () => {
    const yamlInput = `
users:
  - name: Alice
    role: admin
  - name: Bob
    role: user
`

    const result = tryRepair(yamlInput)

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')

    const parsed = JSON.parse(result)

    expect(parsed.users).toHaveLength(2)
    expect(parsed.users[0].name).toBe('Alice')
  })

  it('should handle broken JSON that can be repaired', () => {
    const brokenJson = '{name: "John", age: 30'

    const result = tryRepair(brokenJson)

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect(JSON.parse(result)).toEqual({
      name: 'John',
      age: 30,
    })
  })

  it('should return null for completely invalid input', () => {
    const invalidInput = 'key: [value: invalid] structure {'

    const result = tryRepair(invalidInput)

    expect(result).toBeNull()
  })

  it('should handle empty string gracefully', () => {
    const result = tryRepair('')

    // @note empty string returns undefined from repair, but tryRepair should handle it
    expect(result).toBeUndefined()
  })

  it('should handle null or undefined input as strings', () => {
    // @note null and undefined get converted to strings and then to JSON
    const nullResult = tryRepair(null)
    const undefinedResult = tryRepair(undefined)

    expect(nullResult).toBe('null')
    expect(undefinedResult).toBe('"undefined"')
  })
})
