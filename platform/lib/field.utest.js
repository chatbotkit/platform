// @ts-check
import {
  BracketType,
  extractFields,
  getFieldFormatDefault,
  getFieldSanitizePattern,
  getFieldValueDefault,
  getFieldValueEnum,
  getFieldValueMax,
  getFieldValueMin,
  getFieldValueType,
  isField,
  isLocalField,
  operands,
  parseField,
  simplifyFields,
  stringifyField,
  substituteFields,
} from '@/lib/field'

describe('operands', () => {
  describe('euc', () => {
    it('should encode uri component', () => {
      expect(operands.euc('hello world')).toBe('hello%20world')
    })

    it('should return an empty string if input is undefined', () => {
      expect(operands.euc(undefined)).toBe('')
    })

    it('should handle null values', () => {
      expect(operands.euc(null)).toBe('')
    })

    it('should handle 0', () => {
      expect(operands.euc(0)).toBe('0')
    })

    it('should handle true and false', () => {
      expect(operands.euc(true)).toBe('true')
      expect(operands.euc(false)).toBe('false')
    })
  })

  describe('j', () => {
    it('should stringify json', () => {
      expect(operands.j('{"hello":"world"}')).toBe('{"hello":"world"}')
    })

    it('should fix broken json', () => {
      expect(operands.j('{"hello":"world"')).toBe('{"hello":"world"}')
    })
  })

  describe('js', () => {
    it('should stringify json', () => {
      expect(operands.js({ hello: 'world' })).toBe('{"hello":"world"}')
    })

    it('should return an empty string if input is undefined', () => {
      expect(operands.js(undefined)).toBe('""')
    })

    it('should handle null values', () => {
      expect(operands.js(null)).toBe('null')
    })

    it('should handle 0', () => {
      expect(operands.js(0)).toBe('0')
    })

    it('should handle true and false', () => {
      expect(operands.js(true)).toBe('true')
      expect(operands.js(false)).toBe('false')
    })
  })

  describe('ys', () => {
    it('should stringify yaml', () => {
      expect(operands.ys({ hello: 'world' })).toBe('{"hello":"world"}')
    })

    it('should return an empty string if input is undefined', () => {
      expect(operands.ys(undefined)).toBe('""')
    })

    it('should handle null values', () => {
      expect(operands.ys(null)).toBe('null')
    })

    it('should handle 0', () => {
      expect(operands.ys(0)).toBe('0')
    })

    it('should handle true and false', () => {
      expect(operands.ys(true)).toBe('true')
      expect(operands.ys(false)).toBe('false')
    })
  })

  describe('dq', () => {
    it('should add double quotes around input', () => {
      expect(operands.dq('hello')).toBe('"hello"')
    })

    it('should escape existing double quotes', () => {
      expect(operands.dq('hello "world"')).toBe('"hello \\"world\\""')
    })

    it('should return an empty string if input is undefined', () => {
      expect(operands.dq(undefined)).toBe('""')
    })

    it('should handle null values', () => {
      expect(operands.dq(null)).toBe('""')
    })

    it('should handle 0', () => {
      expect(operands.dq(0)).toBe('"0"')
    })

    it('should handle true and false', () => {
      expect(operands.dq(true)).toBe('"true"')
      expect(operands.dq(false)).toBe('"false"')
    })
  })

  describe('edq', () => {
    it('should escape double quotes', () => {
      expect(operands.edq('hello "world"')).toBe('hello \\"world\\"')
    })

    it('should return empty if input is undefined', () => {
      expect(operands.edq(undefined)).toBe('')
    })

    it('should handle null values', () => {
      expect(operands.edq(null)).toBe('')
    })

    it('should handle 0', () => {
      expect(operands.edq(0)).toBe('0')
    })

    it('should handle true and false', () => {
      expect(operands.edq(true)).toBe('true')
      expect(operands.edq(false)).toBe('false')
    })
  })

  describe('rn', () => {
    it('should remove new lines', () => {
      expect(operands.rn('hello\nworld')).toBe('hello world')
    })

    it('should return empty if input is undefined', () => {
      expect(operands.rn(undefined)).toBe('')
    })

    it('should handle null values', () => {
      expect(operands.rn(null)).toBe('')
    })

    it('should handle 0', () => {
      expect(operands.rn(0)).toBe('0')
    })

    it('should handle true and false', () => {
      expect(operands.rn(true)).toBe('true')
      expect(operands.rn(false)).toBe('false')
    })
  })

  describe('trim', () => {
    it('should trim whitespace from both ends', () => {
      expect(operands.trim('  hello world  ')).toBe('hello world')
    })

    it('should trim only leading whitespace', () => {
      expect(operands.trim('  hello world')).toBe('hello world')
    })

    it('should trim only trailing whitespace', () => {
      expect(operands.trim('hello world  ')).toBe('hello world')
    })

    it('should handle tabs and newlines', () => {
      expect(operands.trim('\t\n  hello world  \n\t')).toBe('hello world')
    })

    it('should return empty if input is undefined', () => {
      expect(operands.trim(undefined)).toBe('')
    })

    it('should handle null values', () => {
      expect(operands.trim(null)).toBe('')
    })

    it('should handle 0', () => {
      expect(operands.trim(0)).toBe('0')
    })

    it('should handle true and false', () => {
      expect(operands.trim(true)).toBe('true')
      expect(operands.trim(false)).toBe('false')
    })

    it('should handle strings that are only whitespace', () => {
      expect(operands.trim('   ')).toBe('')
    })

    it('should preserve internal whitespace', () => {
      expect(operands.trim('  hello   world  ')).toBe('hello   world')
    })
  })
})

describe('isField', () => {
  it('should return true for curly brackets', () => {
    const input = '${name}'

    const result = isField(input, { bracketType: 'curly' })

    expect(result).toBe(true)
  })

  it('should return true for square brackets', () => {
    const input = '$[name]'

    const result = isField(input, { bracketType: 'square' })

    expect(result).toBe(true)
  })

  it('should return true for round brackets', () => {
    const input = '((name))'

    const result = isField(input, { bracketType: 'round' })

    expect(result).toBe(true)
  })

  it.each(['${name}', '$[name]', '((name))'])(
    'should return true for all brackets',
    (input) => {
      const result = isField(input, { bracketType: 'all' })

      expect(result).toBe(true)
    }
  )

  it('should not match if field is in between a string', () => {
    const input = 'Hello ${name}, welcome to the city!'

    const result = isField(input, { bracketType: 'curly' })

    expect(result).toBe(false)
  })

  it('should return false for empty input', () => {
    const input = ''

    const result = isField(input, { bracketType: 'curly' })

    expect(result).toBe(false)
  })

  it('should return false for input without brackets', () => {
    const input = 'Hello, welcome to the city!'

    const result = isField(input, { bracketType: 'curly' })

    expect(result).toBe(false)
  })
})

describe('parseField', () => {
  it('must parse field correctly', () => {
    const input = 'name: User name'

    const expectedField = {
      type: BracketType.curly,
      exact: '{{name: User name}}',
      name: 'name',
      title: 'User name',
      description: 'User name',
      operand: null,
      required: false,
    }

    const result = parseField(input)

    expect(result).toEqual(expectedField)
  })

  it('must parse field that is wrapped', () => {
    const input = '${name|User name}'

    const expectedField = {
      type: BracketType.curly,
      exact: '${name|User name}',
      name: 'name',
      title: 'User name',
      description: 'User name',
      operand: null,
      required: false,
    }

    const result = parseField(input)

    expect(result).toEqual(expectedField)
  })
})

describe('extractFields', () => {
  it('should extract fields from input string', () => {
    const input = 'Hello ${name}, welcome to ${city}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name}',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${city}',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should extract fields with descriptions', () => {
    const input = 'Hello ${name: User name}, welcome to ${city: City name}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name: User name}',
        name: 'name',
        title: 'User name',
        description: 'User name',
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${city: City name}',
        name: 'city',
        title: 'City name',
        description: 'City name',
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('extract fields with operands that have round brackets within them', () => {
    const input =
      'Hello ${name: User name}, welcome to ((city default{London}))!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name: User name}',
        name: 'name',
        title: 'User name',
        description: 'User name',
        operand: null,
        required: false,
      },
      {
        type: BracketType.round,
        exact: '((city default{London}))',
        name: 'city',
        title: null,
        description: null,
        operand: 'default{London}',
        required: false,
      },
    ]

    const result = extractFields(input, { bracketType: 'all' })

    expect(result).toEqual(expectedFields)
  })

  it('should handle empty input', () => {
    const input = ''
    const expectedFields = []

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle input without fields', () => {
    const input = 'Hello, welcome to the city!'
    const expectedFields = []

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle input with bracket format', () => {
    const input = 'Hello [[name]], welcome to [[city]]!'

    const expectedFields = [
      {
        type: BracketType.square,
        exact: '[[name]]',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.square,
        exact: '[[city]]',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input, { bracketType: 'square' })

    expect(result).toEqual(expectedFields)
  })

  it('should handle fields that are defined multiple times', () => {
    const input = 'Hello ${name}, welcome to ${name|the user name}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name}',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${name|the user name}',
        name: 'name',
        title: 'the user name',
        description: 'the user name',
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('the name should not include ! in the name when used', () => {
    const input = 'Hello ${name!}, welcome to ${!city}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name!}',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: true,
      },
      {
        type: BracketType.curly,
        exact: '${!city}',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: true,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle unexpected spaces in the input', () => {
    const input = 'Hello ${name }, welcome to ${ city}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name }',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${ city}',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should extract operands from input string', () => {
    const input = 'Hello ${name! Test}, welcome to ${city eq}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name! Test}',
        name: 'name',
        title: null,
        description: null,
        operand: 'Test',
        required: true,
      },
      {
        type: BracketType.curly,
        exact: '${city eq}',
        name: 'city',
        title: null,
        description: null,
        operand: 'eq',
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('repeated fields should be returned', () => {
    const input = '$[test]$[test]'

    const expectedFields = [
      {
        type: BracketType.square,
        exact: '$[test]',
        name: 'test',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.square,
        exact: '$[test]',
        name: 'test',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input, { bracketType: 'square' })

    expect(result).toEqual(expectedFields)
  })

  it('should ignore malformed fields', () => {
    expect(extractFields('Hello ${name')).toEqual([])
    expect(extractFields('Hello $[name')).toEqual([])
    expect(extractFields('Hello ((name')).toEqual([])
  })

  // @todo this is currently not working as expected

  it.skip('should extract nested fields', () => {
    expect(extractFields('Hello ${${name}}')).toEqual([
      {
        type: BracketType.curly,
        exact: '${${name}}',
        name: '${name}',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ])
  })

  it('should extract overlapping fields', () => {
    const input = '${foo}${foo}'
    const fields = extractFields(input)

    expect(fields.length).toBe(2)
  })

  it('test harness 001', () => {
    const input =
      '$[sort_by! ys enum<updated_at,created_at,priority,status,ticket_type> default<created_at>|sort by field]'

    const expectedFields = [
      {
        type: BracketType.square,
        exact:
          '$[sort_by! ys enum<updated_at,created_at,priority,status,ticket_type> default<created_at>|sort by field]',
        name: 'sort_by',
        title: 'sort by field',
        description: 'sort by field',
        operand:
          'ys enum<updated_at,created_at,priority,status,ticket_type> default<created_at>',
        required: true,
      },
    ]

    const result = extractFields(input, { bracketType: 'square' })

    expect(result).toEqual(expectedFields)
  })

  it('should handle optional fields with ? marker - field name should not include ? in the name', () => {
    const input = 'Hello ${name?}, welcome to ${?city}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name?}',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${?city}',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle optional fields with ? marker in square brackets', () => {
    const input = 'Hello $[name?], welcome to $[?city]!'

    const expectedFields = [
      {
        type: BracketType.square,
        exact: '$[name?]',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.square,
        exact: '$[?city]',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input, { bracketType: 'square' })

    expect(result).toEqual(expectedFields)
  })

  it('should handle optional fields with ? marker in round brackets', () => {
    const input = 'Hello ((name?)), welcome to ((?city))!'

    const expectedFields = [
      {
        type: BracketType.round,
        exact: '((name?))',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.round,
        exact: '((?city))',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input, { bracketType: 'round' })

    expect(result).toEqual(expectedFields)
  })

  it('should handle mixed required (!) and optional (?) field markers', () => {
    const input = 'Hello ${name!}, welcome to ${city?} and ${!region}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name!}',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: true,
      },
      {
        type: BracketType.curly,
        exact: '${city?}',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${!region}',
        name: 'region',
        title: null,
        description: null,
        operand: null,
        required: true,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle optional fields with descriptions', () => {
    const input = 'Hello ${name?: User name}, welcome to ${city?| City name}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name?: User name}',
        name: 'name',
        title: 'User name',
        description: 'User name',
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${city?| City name}',
        name: 'city',
        title: 'City name',
        description: 'City name',
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle optional fields with operands', () => {
    const input = 'Hello ${name? Test}, welcome to ${city? eq}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${name? Test}',
        name: 'name',
        title: null,
        description: null,
        operand: 'Test',
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${city? eq}',
        name: 'city',
        title: null,
        description: null,
        operand: 'eq',
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle multiple ? markers in field name', () => {
    // @note multiple ? markers should be stripped just like multiple ! markers
    const input = 'Hello ${??name??}, welcome to ${city???}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${??name??}',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
      {
        type: BracketType.curly,
        exact: '${city???}',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: false,
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle mixed ! and ? markers correctly', () => {
    // @note when both ! and ? markers are present, ! takes precedence for required field determination
    const input = 'Hello ${!name?}, welcome to ${?city!}!'

    const expectedFields = [
      {
        type: BracketType.curly,
        exact: '${!name?}',
        name: 'name',
        title: null,
        description: null,
        operand: null,
        required: true, // Should be true because ! is present
      },
      {
        type: BracketType.curly,
        exact: '${?city!}',
        name: 'city',
        title: null,
        description: null,
        operand: null,
        required: true, // Should be true because ! is present
      },
    ]

    const result = extractFields(input)

    expect(result).toEqual(expectedFields)
  })

  it('should handle complex field with optional marker, operand and description', () => {
    const input =
      '$[sort_by? ys enum<updated_at,created_at,priority,status,ticket_type> default<created_at>|sort by field]'

    const expectedFields = [
      {
        type: BracketType.square,
        exact:
          '$[sort_by? ys enum<updated_at,created_at,priority,status,ticket_type> default<created_at>|sort by field]',
        name: 'sort_by',
        title: 'sort by field',
        description: 'sort by field',
        operand:
          'ys enum<updated_at,created_at,priority,status,ticket_type> default<created_at>',
        required: false,
      },
    ]

    const result = extractFields(input, { bracketType: 'square' })

    expect(result).toEqual(expectedFields)
  })
})

describe('substituteFields', () => {
  it('should substitute fields correctly', () => {
    const input = 'Hello ${name}, welcome to ${city}!'

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = 'Hello John, welcome to New York!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should not substitute fields that are not in the substitutions object', () => {
    const input = 'Hello ${name}, welcome to ${city}!'

    const substitutions = {
      name: 'John',
    }

    const expectedOutput = 'Hello John, welcome to ${city}!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should handle empty input', () => {
    const input = ''

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = ''
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should handle empty substitutions object', () => {
    const input = 'Hello ${name}, welcome to ${city}!'
    const substitutions = {}

    const expectedOutput = 'Hello ${name}, welcome to ${city}!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should handle input with fields and descriptions', () => {
    const input = 'Hello ${name: User name}, welcome to $[city|City name]!'

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = 'Hello John, welcome to New York!'

    const actualOutput = substituteFields(input, substitutions, {
      bracketType: 'all',
    })

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should replace fields that have a required modifier', () => {
    const input = 'Hello ${name!}, welcome to ${city}!'

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = 'Hello John, welcome to New York!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should replace fields that have an operand', () => {
    const input = 'Hello ${name! test}, welcome to ${city eq}!'

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = 'Hello John, welcome to New York!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should replace fields with dq operand', () => {
    const input = 'Hello ${name dq}, welcome to ${city}!'

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = 'Hello "John", welcome to New York!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should escape double quotes', () => {
    const input = 'Hello ${name edq}, welcome to ${city}!'

    const substitutions = {
      name: '"John"',
      city: 'New York',
    }

    const expectedOutput = 'Hello \\"John\\", welcome to New York!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should apply operand while handling extra spaces', () => {
    const input = 'Hello ${name   edq }, welcome to ${ city edq}!'

    const substitutions = {
      name: '"John"',
      city: '"New York"',
    }

    const expectedOutput = 'Hello \\"John\\", welcome to \\"New York\\"!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should be able to apply multiple operands', () => {
    const input = 'Hello ${name dq,euc}, welcome to ${city}!'

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = 'Hello %22John%22, welcome to New York!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should skip operand transformation if op is provided', () => {
    const input = 'Hello ${name dq,euc}, welcome to ${city}!'

    const substitutions = {
      name: 'John',
      city: 'New York',
    }

    const expectedOutput = 'Hello John, welcome to New York!'

    const actualOutput = substituteFields(input, substitutions, {
      op: (field) => field,
    })

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should produce empty strings if the substituted field is not found', () => {
    const input = 'Hello ${name ys}, welcome to ${city}!'

    const expectedOutput = 'Hello "", welcome to New York!'

    const actualOutput = substituteFields(input, {
      name: undefined,
      city: 'New York',
    })

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should leave empty space when the field is undefined', () => {
    const input = 'Hello ${name}, welcome to ${city}!'

    const expectedOutput = 'Hello , welcome to New York!'

    const actualOutput = substituteFields(input, {
      name: undefined,
      city: 'New York',
    })

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should double quote if the operand is not optional', () => {
    const input = 'Hello ${name dq}, welcome to ${city}!'

    const expectedOutput = 'Hello "", welcome to New York!'

    const actualOutput = substituteFields(input, {
      name: undefined,
      city: 'New York',
    })

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should not double quote if the operand is optional', () => {
    const input = 'Hello ${name dq?}, welcome to ${city}!'

    const expectedOutput = 'Hello , welcome to New York!'

    const actualOutput = substituteFields(input, {
      name: undefined,
      city: 'New York',
    })

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should handle substitutions that are functions', () => {
    const input = 'Hello ${name}, welcome to ${city}!'

    const substitutions = {
      name: () => 'John',
      city: () => 'New York',
    }

    const expectedOutput = 'Hello John, welcome to New York!'
    const actualOutput = substituteFields(input, substitutions)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should throw on required field missing with validate when field not in substitutions', () => {
    // @note field missing from substitutions entirely won't be processed, so no
    // error thrown

    expect(() =>
      substituteFields('Hello ${name!}', {}, { validate: true })
    ).not.toThrow()
  })

  it('should throw on required field missing with validate when field is undefined', () => {
    expect(() =>
      substituteFields(
        'Hello ${name!}',
        { name: undefined },
        { validate: true }
      )
    ).toThrow('Required field "name" missing in the input.')
  })

  it('should not throw on required field with defaults when value is undefined', () => {
    const input = 'Hello ${name! default<John>}'

    expect(
      substituteFields(
        input,
        { name: undefined },
        { validate: true, defaults: true }
      )
    ).toBe('Hello John')
  })

  it('should throw on enum validation', () => {
    const input = '${foo enum<a,b>}'

    expect(() =>
      substituteFields(input, { foo: 'c' }, { validate: true })
    ).toThrow()
  })

  it('should ignore unknown operand', () => {
    const input = 'Hello ${name unknownop}, welcome!'

    expect(substituteFields(input, { name: 'John' })).toBe(
      'Hello John, welcome!'
    )
  })

  it('should apply special operand enum', () => {
    const input = '${foo enum{a,b}}'

    expect(substituteFields(input, { foo: 'a' }, { validate: true })).toBe('a')
  })

  it('should apply default operand when defaults option is enabled', () => {
    const input = '${foo default<bar>}'

    expect(
      substituteFields(input, { foo: undefined }, { defaults: true })
    ).toBe('bar')
  })

  it('should not apply default operand when defaults option is disabled', () => {
    const input = '${foo default<bar>}'

    expect(substituteFields(input, { foo: undefined })).toBe('')
  })

  it('should prefer provided value over default when value is not undefined', () => {
    const input = '${foo default<bar>}'

    expect(substituteFields(input, { foo: 'baz' }, { defaults: true })).toBe(
      'baz'
    )
  })

  it('should apply default for missing field when field is undefined and defaults option is enabled', () => {
    const input = '${missing default<fallback>}'

    expect(
      substituteFields(input, { missing: undefined }, { defaults: true })
    ).toBe('fallback')
  })

  it('should not process field missing from substitutions object', () => {
    const input = '${missing default<fallback>}'

    // @note fields not in substitutions object are not processed

    expect(substituteFields(input, {}, { defaults: true })).toBe(
      '${missing default<fallback>}'
    )
  })

  it('should apply typed defaults correctly', () => {
    const input1 = '${num number default<42>}'
    const input2 = '${flag boolean default<true>}'
    const input3 = '${text string default<hello>}'

    expect(
      substituteFields(input1, { num: undefined }, { defaults: true })
    ).toBe('42')
    expect(
      substituteFields(input2, { flag: undefined }, { defaults: true })
    ).toBe('true')
    expect(
      substituteFields(input3, { text: undefined }, { defaults: true })
    ).toBe('hello')
  })

  it('should handle defaults with operands', () => {
    const input = '${name default<John> dq}'

    expect(
      substituteFields(input, { name: undefined }, { defaults: true })
    ).toBe('"John"')
  })

  it('should handle defaults with complex operands', () => {
    const input = '${config default<myconfig> js}'

    expect(
      substituteFields(input, { config: undefined }, { defaults: true })
    ).toBe('"myconfig"')
  })

  it('should handle defaults in square brackets', () => {
    const input = '$[option default<choice1>]'

    expect(
      substituteFields(
        input,
        { option: undefined },
        { bracketType: 'square', defaults: true }
      )
    ).toBe('choice1')
  })

  it('should handle defaults in round brackets', () => {
    const input = '((value default<test>))'

    expect(
      substituteFields(
        input,
        { value: undefined },
        { bracketType: 'round', defaults: true }
      )
    ).toBe('test')
  })

  it('should handle empty default value', () => {
    const input = '${empty default<>}'

    expect(
      substituteFields(input, { empty: undefined }, { defaults: true })
    ).toBe('')
  })

  it('should handle default with null value provided', () => {
    const input = '${nullable default<fallback>}'

    // @note null should trigger default since it's falsy and will be coalesced with ??

    expect(
      substituteFields(input, { nullable: null }, { defaults: true })
    ).toBe('fallback')
  })

  it('should handle default with false boolean value provided', () => {
    const input = '${flag boolean default<true>}'

    // @note false is a valid value and should not trigger default

    expect(substituteFields(input, { flag: false }, { defaults: true })).toBe(
      'false'
    )
  })

  it('should handle default with zero number value provided', () => {
    const input = '${count number default<10>}'

    // @note 0 is a valid value and should not trigger default

    expect(substituteFields(input, { count: 0 }, { defaults: true })).toBe('0')
  })

  it('should handle default with empty string value provided', () => {
    const input = '${text default<fallback>}'

    // @note empty string is a valid value and should not trigger default

    expect(substituteFields(input, { text: '' }, { defaults: true })).toBe('')
  })

  it('should apply special operand sanitize with regex pattern', () => {
    const input = '${field sanitize<test>}'

    expect(substituteFields(input, { field: 'hello test world' })).toBe(
      'hello  world'
    )
  })

  it('should handle sanitize operand with simple regex', () => {
    const input = '${text sanitize<[0-9]+>}'

    expect(substituteFields(input, { text: 'abc123def456ghi' })).toBe(
      'abcdefghi'
    )
  })

  it('should handle sanitize operand with word boundaries', () => {
    const input = '${field sanitize<\\btest\\b>}'

    expect(
      substituteFields(input, { field: 'this is a test and testing' })
    ).toBe('this is a  and testing')
  })

  // @note - this is not supported at the moment because | acts as a separator
  // for the field name and description
  it.skip('should handle sanitize operand with multiple pattern matches', () => {
    const input = '${field sanitize<foo|bar>}'

    expect(substituteFields(input, { field: 'foo baz bar qux foo' })).toBe(
      ' baz  qux '
    )
  })

  it('should handle sanitize operand with invalid regex gracefully', () => {
    const input = '${field sanitize<[invalid>}'

    expect(substituteFields(input, { field: 'hello world' })).toBe(
      'hello world'
    )
  })

  it('should handle sanitize operand with undefined/null values', () => {
    const input = '${field sanitize<\\d+>}'

    expect(substituteFields(input, { field: undefined })).toBe('')
    expect(substituteFields(input, { field: null })).toBe('')
  })

  it('should handle sanitize operand with empty string', () => {
    const input = '${field sanitize<\\s+>}'

    expect(substituteFields(input, { field: '' })).toBe('')
  })

  it('should handle sanitize operand with different bracket types', () => {
    const input1 = '${field sanitize<\\d+>}'
    const input2 = '${field sanitize[\\d+]}'
    const input3 = '${field sanitize(\\d+)}'

    const testValue = 'abc123def456'

    expect(substituteFields(input1, { field: testValue })).toBe('abcdef')
    expect(substituteFields(input2, { field: testValue })).toBe('abcdef')
    expect(substituteFields(input3, { field: testValue })).toBe('abcdef')
  })

  it('should handle sanitize operand combined with other operands', () => {
    const input = '${field sanitize<\\d+> dq}'

    expect(substituteFields(input, { field: 'test123value' })).toBe(
      '"testvalue"'
    )
  })

  it('should apply trim operand to remove whitespace', () => {
    const input = '${field trim}'

    expect(substituteFields(input, { field: '  hello world  ' })).toBe(
      'hello world'
    )
  })

  it('should apply trim operand with other operands', () => {
    const input = '${field trim dq}'

    expect(substituteFields(input, { field: '  test value  ' })).toBe(
      '"test value"'
    )
  })

  it('should apply sanitize and trim operands together', () => {
    const input = '${field sanitize<\\d+> trim dq}'

    expect(substituteFields(input, { field: '  test123value  ' })).toBe(
      '"testvalue"'
    )
  })

  it('should handle trim operand with undefined/null values', () => {
    const input = '${field trim}'

    expect(substituteFields(input, { field: undefined })).toBe('')
    expect(substituteFields(input, { field: null })).toBe('')
  })

  it('should handle optional trim operand', () => {
    const input = '${field ?trim}'

    expect(substituteFields(input, { field: '  test  ' })).toBe('test')
    expect(substituteFields(input, { field: '' })).toBe('')
    expect(substituteFields(input, { field: undefined })).toBe('')
  })

  describe('multiple occurrences', () => {
    it('should substitute all occurrences of the same field', () => {
      const input = 'Hello ${name}, your name is ${name}, welcome ${name}!'

      const substitutions = { name: 'John' }

      expect(substituteFields(input, substitutions)).toBe(
        'Hello John, your name is John, welcome John!'
      )
    })

    it('should substitute all occurrences of multiple different fields', () => {
      const input =
        '${greeting} ${name}! ${greeting} again ${name}! Bye ${name}.'

      const substitutions = { greeting: 'Hello', name: 'World' }

      expect(substituteFields(input, substitutions)).toBe(
        'Hello World! Hello again World! Bye World.'
      )
    })

    it('should substitute all occurrences in square brackets', () => {
      const input = 'id: $[userId], owner: $[userId], creator: $[userId]'

      const substitutions = { userId: 'user-123' }

      expect(
        substituteFields(input, substitutions, { bracketType: 'square' })
      ).toBe('id: user-123, owner: user-123, creator: user-123')
    })

    it('should substitute all occurrences in round brackets', () => {
      const input = 'first: ((param)), second: ((param)), third: ((param))'

      const substitutions = { param: 'value' }

      expect(
        substituteFields(input, substitutions, { bracketType: 'round' })
      ).toBe('first: value, second: value, third: value')
    })

    it('should substitute all occurrences across mixed bracket types', () => {
      const input = 'curly: ${field}, square: $[field], round: ((field))'

      const substitutions = { field: 'replaced' }

      expect(
        substituteFields(input, substitutions, { bracketType: 'all' })
      ).toBe('curly: replaced, square: replaced, round: replaced')
    })

    it('should substitute all occurrences with operands applied consistently', () => {
      const input = 'quoted: ${name dq}, raw: ${name}, again: ${name sq}'

      const substitutions = { name: 'test' }

      // @note each occurrence gets its own operand applied
      expect(substituteFields(input, substitutions)).toBe(
        `quoted: "test", raw: test, again: 'test'`
      )
    })

    it('should substitute all occurrences in complex YAML-like structure', () => {
      // @note this mimics real-world usage in fetch instructions where
      // CONVERSATION_ID might appear in headers and body

      const input = `url: https://api.example.com/data
method: POST
headers:
  X-Conversation-Id: \${CONVERSATION_ID}
  Content-Type: application/json
body:
  id: \${CONVERSATION_ID}
  name: \${CONVERSATION_NAME}`

      const substitutions = {
        CONVERSATION_ID: 'conv-123',
        CONVERSATION_NAME: 'Test Conversation',
      }

      const expected = `url: https://api.example.com/data
method: POST
headers:
  X-Conversation-Id: conv-123
  Content-Type: application/json
body:
  id: conv-123
  name: Test Conversation`

      expect(substituteFields(input, substitutions)).toBe(expected)
    })

    it('should handle adjacent duplicate fields', () => {
      const input = '${id}${id}${id}'

      expect(substituteFields(input, { id: 'X' })).toBe('XXX')
    })

    it('should handle fields that only differ by description', () => {
      // @note fields with same name but different descriptions should all be replaced
      const input =
        '${name|first name} and ${name|last name} and ${name|nickname}'

      expect(substituteFields(input, { name: 'John' })).toBe(
        'John and John and John'
      )
    })
  })
})

describe('simplifyFields', () => {
  it('should simplify fields correctly', () => {
    const input = 'This is a field ${name} and another field ${city|the city}.'

    const expectedOutput = 'This is a field {name} and another field {city}.'

    const actualOutput = simplifyFields(input)

    expect(actualOutput).toEqual(expectedOutput)
  })

  it('should return input if no fields', () => {
    expect(simplifyFields('no fields here')).toBe('no fields here')
  })

  it('should simplify all bracket types', () => {
    const input = 'A ${foo} B $[bar] C ((baz))'

    expect(simplifyFields(input, { bracketType: 'all' })).toBe(
      'A {foo} B {bar} C {baz}'
    )
  })
})

describe('stringifyField', () => {
  it('should stringify curly field', () => {
    expect(
      stringifyField({
        type: BracketType.curly,
        name: 'foo',
        required: false,
      })
    ).toBe('${foo}')
  })

  it('should stringify square field', () => {
    expect(
      stringifyField({
        type: BracketType.square,
        name: 'foo',
        required: false,
      })
    ).toBe('$[foo]')
  })

  it('should stringify round field', () => {
    expect(
      stringifyField({
        type: BracketType.round,
        name: 'foo',
        required: false,
      })
    ).toBe('((foo))')
  })

  it('should add required modifier', () => {
    expect(
      stringifyField({
        type: BracketType.curly,
        name: 'foo',
        required: true,
      })
    ).toBe('${!foo}')
  })

  it('should add operand', () => {
    expect(
      stringifyField({
        type: BracketType.curly,
        name: 'foo',
        operand: 'dq',
        required: false,
      })
    ).toBe('${foo dq}')
  })

  it('should add description', () => {
    expect(
      stringifyField({
        type: BracketType.curly,
        name: 'foo',
        description: 'desc',
        required: false,
      })
    ).toBe('${foo|desc}')
  })

  it('should add operand and description and required', () => {
    expect(
      stringifyField({
        type: BracketType.curly,
        name: 'foo',
        operand: 'dq',
        description: 'desc',
        required: true,
      })
    ).toBe('${!foo dq|desc}')
  })
})

describe('getFieldValueType', () => {
  it('should detect boolean', () => {
    expect(
      getFieldValueType({
        operand: 'boolean',
        name: '',
        type: BracketType.curly,
      })
    ).toBe('boolean')

    expect(
      getFieldValueType({ operand: 'bool', name: '', type: BracketType.curly })
    ).toBe('boolean')
  })

  it('should detect number', () => {
    expect(
      getFieldValueType({
        operand: 'number',
        name: '',
        type: BracketType.curly,
      })
    ).toBe('number')

    expect(
      getFieldValueType({ operand: 'num', name: '', type: BracketType.curly })
    ).toBe('number')
  })

  it('should default to string', () => {
    expect(
      getFieldValueType({ operand: '', name: '', type: BracketType.curly })
    ).toBe('string')

    expect(
      getFieldValueType({
        operand: undefined,
        name: '',
        type: BracketType.curly,
      })
    ).toBe('string')
  })
})

describe('getFieldValueEnum', () => {
  it('should parse string enum', () => {
    const field = { operand: 'enum{a,b,c}', name: '', type: BracketType.curly }

    expect(getFieldValueEnum(field)).toEqual(['a', 'b', 'c'])
  })

  it('should parse number enum', () => {
    const field = {
      operand: 'number enum{1,2,3}',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldValueEnum(field)).toEqual([1, 2, 3])
  })

  it('should parse boolean enum', () => {
    const field = {
      operand: 'boolean enum{true,false}',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldValueEnum(field)).toEqual([true, false])
  })

  it('should return undefined if no enum', () => {
    expect(
      getFieldValueEnum({ operand: '', name: '', type: BracketType.curly })
    ).toBeUndefined()
  })

  it('should ignore empty values', () => {
    const field = { operand: 'enum{a,,b}', name: '', type: BracketType.curly }

    expect(getFieldValueEnum(field)).toEqual(['a', 'b'])
  })
})

describe('getFieldValueDefault', () => {
  it('should parse string default', () => {
    const field = { operand: 'default<foo>', name: '', type: BracketType.curly }

    expect(getFieldValueDefault(field)).toBe('foo')
  })

  it('should parse number default', () => {
    const field = {
      operand: 'number default<42>',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldValueDefault(field)).toBe(42)
  })

  it('should parse boolean default', () => {
    const field = {
      operand: 'boolean default<true>',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldValueDefault(field)).toBe(true)
  })

  it('should return undefined if no default', () => {
    expect(
      getFieldValueDefault({ operand: '', name: '', type: BracketType.curly })
    ).toBeUndefined()
  })
})

describe('getFieldValueMin', () => {
  it('should parse min value with angle brackets', () => {
    const field = { operand: 'min<10>', name: '', type: BracketType.curly }

    expect(getFieldValueMin(field)).toBe(10)
  })

  it('should parse min value with curly braces', () => {
    const field = { operand: 'min{5}', name: '', type: BracketType.curly }

    expect(getFieldValueMin(field)).toBe(5)
  })

  it('should parse min value with square brackets', () => {
    const field = { operand: 'min[0]', name: '', type: BracketType.curly }

    expect(getFieldValueMin(field)).toBe(0)
  })

  it('should parse min value with parentheses', () => {
    const field = { operand: 'min(1)', name: '', type: BracketType.curly }

    expect(getFieldValueMin(field)).toBe(1)
  })

  it('should parse negative min value', () => {
    const field = { operand: 'min<-100>', name: '', type: BracketType.curly }

    expect(getFieldValueMin(field)).toBe(-100)
  })

  it('should parse decimal min value', () => {
    const field = { operand: 'min<0.5>', name: '', type: BracketType.curly }

    expect(getFieldValueMin(field)).toBe(0.5)
  })

  it('should handle min with other operands', () => {
    const field = {
      operand: 'number min<18> max<99>',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldValueMin(field)).toBe(18)
  })

  it('should return undefined if no min operand', () => {
    const field = { operand: 'number', name: '', type: BracketType.curly }

    expect(getFieldValueMin(field)).toBeUndefined()
  })

  it('should return undefined if operand is empty', () => {
    expect(
      getFieldValueMin({ operand: '', name: '', type: BracketType.curly })
    ).toBeUndefined()
  })
})

describe('getFieldValueMax', () => {
  it('should parse max value with angle brackets', () => {
    const field = { operand: 'max<100>', name: '', type: BracketType.curly }

    expect(getFieldValueMax(field)).toBe(100)
  })

  it('should parse max value with curly braces', () => {
    const field = { operand: 'max{50}', name: '', type: BracketType.curly }

    expect(getFieldValueMax(field)).toBe(50)
  })

  it('should parse max value with square brackets', () => {
    const field = { operand: 'max[999]', name: '', type: BracketType.curly }

    expect(getFieldValueMax(field)).toBe(999)
  })

  it('should parse max value with parentheses', () => {
    const field = { operand: 'max(10)', name: '', type: BracketType.curly }

    expect(getFieldValueMax(field)).toBe(10)
  })

  it('should parse negative max value', () => {
    const field = { operand: 'max<-1>', name: '', type: BracketType.curly }

    expect(getFieldValueMax(field)).toBe(-1)
  })

  it('should parse decimal max value', () => {
    const field = { operand: 'max<99.99>', name: '', type: BracketType.curly }

    expect(getFieldValueMax(field)).toBe(99.99)
  })

  it('should handle max with other operands', () => {
    const field = {
      operand: 'number min<18> max<99>',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldValueMax(field)).toBe(99)
  })

  it('should return undefined if no max operand', () => {
    const field = { operand: 'number', name: '', type: BracketType.curly }

    expect(getFieldValueMax(field)).toBeUndefined()
  })

  it('should return undefined if operand is empty', () => {
    expect(
      getFieldValueMax({ operand: '', name: '', type: BracketType.curly })
    ).toBeUndefined()
  })
})

describe('getFieldFormatDefault', () => {
  it('should parse format', () => {
    const field = {
      operand: 'format<YYYY-MM-DD>',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldFormatDefault(field)).toBe('YYYY-MM-DD')
  })

  it('should return undefined if no format', () => {
    expect(
      getFieldFormatDefault({ operand: '', name: '', type: BracketType.curly })
    ).toBeUndefined()
  })
})

describe('getFieldSanitizePattern', () => {
  it('should parse sanitize pattern with angle brackets', () => {
    const field = {
      operand: 'sanitize<\\b-?in:.*#?[-\\w]+\\b>',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldSanitizePattern(field)).toBe('\\b-?in:.*#?[-\\w]+\\b')
  })

  it('should parse sanitize pattern with curly braces', () => {
    const field = {
      operand: 'sanitize{\\d+}',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldSanitizePattern(field)).toBe('\\d+')
  })

  it('should parse sanitize pattern with square brackets', () => {
    const field = {
      operand: 'sanitize[foo|bar]',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldSanitizePattern(field)).toBe('foo|bar')
  })

  it('should parse sanitize pattern with parentheses', () => {
    const field = {
      operand: 'sanitize(\\s+)',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldSanitizePattern(field)).toBe('\\s+')
  })

  it('should handle multiple operands and find sanitize', () => {
    const field = {
      operand: 'string sanitize<\\d+> dq',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldSanitizePattern(field)).toBe('\\d+')
  })

  it('should return undefined if no sanitize operand', () => {
    const field = {
      operand: 'string dq',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldSanitizePattern(field)).toBeUndefined()
  })

  it('should return undefined if operand is empty', () => {
    const field = {
      operand: '',
      name: '',
      type: BracketType.curly,
    }

    expect(getFieldSanitizePattern(field)).toBeUndefined()
  })
})

describe('isLocalField', () => {
  it('should return true when operand contains "local"', () => {
    expect(isLocalField({ operand: 'local' })).toBe(true)
  })

  it('should return true when operand contains "local" with other operands', () => {
    expect(isLocalField({ operand: 'string local' })).toBe(true)
    expect(isLocalField({ operand: 'local default{test}' })).toBe(true)
  })

  it('should return false when operand does not contain "local"', () => {
    expect(isLocalField({ operand: 'string' })).toBe(false)
    expect(isLocalField({ operand: null })).toBe(false)
    expect(isLocalField({ operand: '' })).toBe(false)
    expect(isLocalField({})).toBe(false)
  })

  it('should be case-insensitive', () => {
    expect(isLocalField({ operand: 'LOCAL' })).toBe(true)
    expect(isLocalField({ operand: 'Local' })).toBe(true)
  })

  it('should not match partial words like "localize"', () => {
    expect(isLocalField({ operand: 'localize' })).toBe(false)
  })
})
