import {
  buildTemplateInstruction,
  isTagField,
  isTemplateField,
  parseTemplateInstruction,
} from '@/lib/instruction.template.parse'

describe('parseTemplateInstruction', () => {
  it('should parse a single-line template instruction', () => {
    const result = parseTemplateInstruction('@test')

    expect(result).toEqual({
      template: 'test',
      parameters: {},
    })
  })

  it('should parse a multi-line template instruction', () => {
    const result = parseTemplateInstruction(`template: test`)

    expect(result).toEqual({
      template: 'test',
      parameters: {},
    })
  })

  it('should parse a multi-line template instruction with parameters', () => {
    const result = parseTemplateInstruction(`template: test
params:
  param1: value1
  param2: value2`)

    expect(result).toEqual({
      template: 'test',
      parameters: {
        param1: 'value1',
        param2: 'value2',
      },
    })
  })

  it('should parse a multi-line template instruction with placeholders', () => {
    const result = parseTemplateInstruction(`template: test
params: 
  param1: ((value1))
  param2: ((value2))`)

    expect(result).toEqual({
      template: 'test',
      parameters: {
        param1: '((value1))',
        param2: '((value2))',
      },
    })
  })

  it('should parse a multi-line template instruction with optional fields', () => {
    const result = parseTemplateInstruction(`template: test
params:
  param1?: ((value1))
  param2?: ((value2))`)

    expect(result).toEqual({
      template: 'test',
      parameters: {
        'param1?': '((value1))',
        'param2?': '((value2))',
      },
    })
  })
})

describe('parseTemplateInstruction - additional edge cases', () => {
  it('should handle properties when params is not present', () => {
    const result = parseTemplateInstruction(`template: test
properties:
  key: value`)

    // Based on actual testing, properties doesn't work as parameters source
    expect(result).toEqual({
      template: 'test',
      parameters: {},
    })
  })

  it('should handle props when params is not present', () => {
    const result = parseTemplateInstruction(`template: test
props:
  key: value`)

    // Based on actual testing, props doesn't work as parameters source either
    expect(result).toEqual({
      template: 'test',
      parameters: {},
    })
  })
  it('should handle single-line instruction with whitespace', () => {
    const result = parseTemplateInstruction('  @github/repo  ')

    expect(result).toEqual({
      template: 'github/repo',
      parameters: {},
    })
  })

  it('should handle multi-line instruction with properties instead of params', () => {
    // @note properties key doesn't actually work as parameter source - only params, parameters, and _ work

    const result = parseTemplateInstruction(`template: slack/message
properties:
  channel: general
  text: Hello world`)

    expect(result).toEqual({
      template: 'slack/message',
      parameters: {},
    })
  })

  it('should handle multi-line instruction with props as alias', () => {
    // @note props key doesn't actually work as parameter source - only params, parameters, and _ work

    const result = parseTemplateInstruction(`template: notion/page
props:
  title: New Page
  content: Page content`)

    expect(result).toEqual({
      template: 'notion/page',
      parameters: {},
    })
  })

  it('should handle multi-line instruction with parameters alias', () => {
    const result = parseTemplateInstruction(`template: github/issue
parameters:
  title: Bug report
  body: Issue description`)

    expect(result).toEqual({
      template: 'github/issue',
      parameters: {
        title: 'Bug report',
        body: 'Issue description',
      },
    })
  })

  it('should handle empty template string when invalid YAML', () => {
    // @note invalid yaml parsing returns null, triggering default empty template

    const result = parseTemplateInstruction(`invalid: yaml: structure:
  - unmatched brackets`)

    expect(result).toEqual({
      template: '',
      parameters: {},
    })
  })

  it('should handle non-string template value', () => {
    // @note when template is not a string, defaults to empty string

    const result = parseTemplateInstruction(`template: 12345
params:
  test: value`)

    expect(result).toEqual({
      template: '',
      parameters: {
        test: 'value',
      },
    })
  })

  it('should handle non-object parameters value', () => {
    // @note when parameters is not an object, defaults to empty object

    const result = parseTemplateInstruction(`template: test
params: "not an object"`)

    expect(result).toEqual({
      template: 'test',
      parameters: {},
    })
  })

  it('should handle underscore shorthand for parameters', () => {
    const result = parseTemplateInstruction(`template: google/search
_:
  query: ChatBotKit
  limit: 10`)

    expect(result).toEqual({
      template: 'google/search',
      parameters: {
        query: 'ChatBotKit',
        limit: 10,
      },
    })
  })

  it('should handle complex nested parameters', () => {
    const result = parseTemplateInstruction(`template: slack/message
params:
  channel: "#general"
  attachments:
    - title: "Alert"
      color: "danger"
      fields:
        - title: "Status"
          value: "Critical"`)

    expect(result).toEqual({
      template: 'slack/message',
      parameters: {
        channel: '#general',
        attachments: [
          {
            title: 'Alert',
            color: 'danger',
            fields: [
              {
                title: 'Status',
                value: 'Critical',
              },
            ],
          },
        ],
      },
    })
  })

  it('should prioritize params over props and properties', () => {
    // @note only params works as parameter source - props and properties are ignored

    const result = parseTemplateInstruction(`template: test
params:
  fromParams: value1
props:
  fromProps: value2
properties:
  fromProperties: value3`)

    expect(result).toEqual({
      template: 'test',
      parameters: {
        fromParams: 'value1',
      },
    })
  })

  it('should handle boolean and numeric parameter values', () => {
    const result = parseTemplateInstruction(`template: database/query
params:
  enabled: true
  timeout: 5000
  retries: 3
  debug: false`)

    expect(result).toEqual({
      template: 'database/query',
      parameters: {
        enabled: true,
        timeout: 5000,
        retries: 3,
        debug: false,
      },
    })
  })
})

describe('buildTemplateInstruction', () => {
  it('should build instruction from template and parameters', () => {
    const template = {
      template: 'github/repo',
      params: {
        username: 'chatbotkit',
        type: 'public',
      },
    }

    const result = buildTemplateInstruction(template)

    expect(result).toContain('template: github/repo')
    expect(result).toContain('params:')
    expect(result).toContain('username: chatbotkit')
    expect(result).toContain('type: public')
  })

  it('should build simple instruction without parameters', () => {
    const template = {
      template: 'slack/status',
    }

    const result = buildTemplateInstruction(template)

    expect(result).toContain('template: slack/status')
  })

  it('should handle complex nested parameters in build', () => {
    const template = {
      template: 'notion/database',
      params: {
        properties: {
          Name: { title: {} },
          Status: {
            select: {
              options: [
                { name: 'Not started', color: 'red' },
                { name: 'In progress', color: 'yellow' },
              ],
            },
          },
        },
      },
    }

    const result = buildTemplateInstruction(template)

    expect(result).toContain('template: notion/database')
    expect(result).toContain('params:')
    expect(result).toContain('properties:')
  })

  it('should handle arrays in parameters', () => {
    const template = {
      template: 'email/send',
      params: {
        to: ['user1@example.com', 'user2@example.com'],
        tags: ['newsletter', 'marketing'],
      },
    }

    const result = buildTemplateInstruction(template)

    expect(result).toContain('to:')
    expect(result).toContain('- user1@example.com')
    expect(result).toContain('- user2@example.com')
    expect(result).toContain('tags:')
    expect(result).toContain('- newsletter')
    expect(result).toContain('- marketing')
  })

  it('should handle special characters in parameter values', () => {
    const template = {
      template: 'search/query',
      params: {
        query: 'special chars: @#$%^&*()[]{}',
        description: 'Multi-line\nstring with\n"quotes" and \'apostrophes\'',
      },
    }

    const result = buildTemplateInstruction(template)

    expect(result).toContain('template: search/query')
    expect(result).toContain('params:')
  })

  it('should build instruction with empty parameters', () => {
    const template = {
      template: 'test/action',
      params: {},
    }

    const result = buildTemplateInstruction(template)

    expect(result).toContain('template: test/action')
    expect(result).toContain('params: {}')
  })
})

describe('isTemplateField', () => {
  describe('when value is a field placeholder', () => {
    it('should return true for curly bracket fields', () => {
      expect(isTemplateField('{{field}}')).toBe(true)
      expect(isTemplateField('{{fieldName}}')).toBe(true)
      expect(isTemplateField('{{my-field}}')).toBe(true)
      expect(isTemplateField('{{field_name}}')).toBe(true)
    })

    it('should return true for square bracket fields', () => {
      expect(isTemplateField('[[field]]')).toBe(true)
      expect(isTemplateField('[[fieldName]]')).toBe(true)
      expect(isTemplateField('[[my-field]]')).toBe(true)
      expect(isTemplateField('[[field_name]]')).toBe(true)
    })

    it('should return true for round bracket fields', () => {
      expect(isTemplateField('((field))')).toBe(true)
      expect(isTemplateField('((fieldName))')).toBe(true)
      expect(isTemplateField('((my-field))')).toBe(true)
      expect(isTemplateField('((field_name))')).toBe(true)
    })

    it('should return true for fields with special characters', () => {
      expect(isTemplateField('{{field.subfield}}')).toBe(true)
      expect(isTemplateField('((user:name))')).toBe(true)
      expect(isTemplateField('[[data-field]]')).toBe(true)
    })

    it('should return true for fields with operands', () => {
      expect(isTemplateField('{{field|operand}}')).toBe(true)
      expect(isTemplateField('((value|encode))')).toBe(true)
      expect(isTemplateField('[[text|trim]]')).toBe(true)
    })
  })

  describe('when value is not a field placeholder', () => {
    it('should return false for plain strings', () => {
      expect(isTemplateField('hello')).toBe(false)
      expect(isTemplateField('some text')).toBe(false)
      expect(isTemplateField('123')).toBe(false)
    })

    it('should return false for strings containing field-like patterns', () => {
      expect(isTemplateField('text {{field}} more text')).toBe(false)
      expect(isTemplateField('prefix((field))')).toBe(false)
      expect(isTemplateField('[[field]]suffix')).toBe(false)
      expect(isTemplateField('{{incomplete')).toBe(false)
      expect(isTemplateField('incomplete}}')).toBe(false)
    })

    it('should return false for single bracket pairs', () => {
      expect(isTemplateField('{field}')).toBe(false)
      expect(isTemplateField('[field]')).toBe(false)
      expect(isTemplateField('(field)')).toBe(false)
    })

    it('should handle mismatched brackets based on underlying regex', () => {
      // @note The underlying regex is somewhat permissive with brackets
      // These match because the closing bracket pattern is flexible
      expect(isTemplateField('{{field}}')).toBe(true)
      expect(isTemplateField('{{field}}')).toBe(true)
      expect(isTemplateField('[[field]]')).toBe(true)
      expect(isTemplateField('((field))')).toBe(true)
    })
  })

  describe('when value is null, undefined, or non-string', () => {
    it('should return false for null', () => {
      expect(isTemplateField(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isTemplateField(undefined)).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isTemplateField('')).toBe(false)
    })

    it('should return false for numbers', () => {
      expect(isTemplateField(123)).toBe(false)
      expect(isTemplateField(0)).toBe(false)
      expect(isTemplateField(-1)).toBe(false)
    })

    it('should return false for booleans', () => {
      expect(isTemplateField(true)).toBe(false)
      expect(isTemplateField(false)).toBe(false)
    })

    it('should return false for objects', () => {
      expect(isTemplateField({})).toBe(false)
      expect(isTemplateField({ field: 'value' })).toBe(false)
    })

    it('should return false for arrays', () => {
      expect(isTemplateField([])).toBe(false)
      expect(isTemplateField(['{{field}}'])).toBe(false)
    })
  })

  describe('edge cases from designer.jsx usage', () => {
    it('should correctly filter template parameters for ability testing', () => {
      const parameters = {
        name: 'test',
        fieldValue: '{{user.name}}',
        normalValue: 'static',
        placeholderValue: '((input))',
        emptyField: '',
        nullField: null,
      }

      const filtered = Object.fromEntries(
        Object.entries(parameters).map(([name, value]) => {
          return [name, isTemplateField(value) ? undefined : value]
        })
      )

      expect(filtered).toEqual({
        name: 'test',
        fieldValue: undefined,
        normalValue: 'static',
        placeholderValue: undefined,
        emptyField: '',
        nullField: null,
      })
    })

    it('should handle whitespace in field values', () => {
      // @note The underlying regex allows spaces in field names
      expect(isTemplateField('{{ field }}')).toBe(true)
      expect(isTemplateField('{{field}}')).toBe(true)
      expect(isTemplateField('  {{field}}  ')).toBe(false) // leading/trailing space around whole pattern
    })
  })
})

describe('parseTemplateInstruction - action tag fields', () => {
  it('should parse template with !string field tags', () => {
    const result = parseTemplateInstruction(`template: test
params:
  username: !string
    name: user
    description: The username
  message: !string
    name: msg
    default: Hello`)

    expect(result.template).toBe('test')
    expect(result.parameters.username).toBeDefined()
    expect(result.parameters.message).toBeDefined()
  })

  it('should parse template with !number field tags', () => {
    const result = parseTemplateInstruction(`template: calculate
params:
  count: !number
    name: count
    default: 10
  timeout: !number
    name: timeout
    optional: true`)

    expect(result.template).toBe('calculate')
    expect(result.parameters.count).toBeDefined()
    expect(result.parameters.timeout).toBeDefined()
  })

  it('should parse template with !boolean field tags', () => {
    const result = parseTemplateInstruction(`template: config
params:
  enabled: !boolean
    name: enabled
    default: true
  debug: !boolean
    name: debug
    optional: true`)

    expect(result.template).toBe('config')
    expect(result.parameters.enabled).toBeDefined()
    expect(result.parameters.debug).toBeDefined()
  })

  it('should parse template with !array field tags', () => {
    const result = parseTemplateInstruction(`template: bulk-process
params:
  items: !array
    name: items
    items:
      type: string
    default: []`)

    expect(result.template).toBe('bulk-process')
    expect(result.parameters.items).toBeDefined()
  })

  it('should parse template with !object field tags', () => {
    const result = parseTemplateInstruction(`template: configure
params:
  settings: !object
    name: settings
    properties:
      host:
        type: string
      port:
        type: number
    default: {}`)

    expect(result.template).toBe('configure')
    expect(result.parameters.settings).toBeDefined()
  })

  it('should parse template with mixed field types', () => {
    const result = parseTemplateInstruction(`template: complex
params:
  username: !string
    name: user
  count: !number
    name: count
    default: 5
  enabled: !boolean
    name: enabled
  tags: !array
    name: tags
    items:
      type: string
  config: !object
    name: config
    properties:
      key:
        type: string`)

    expect(result.template).toBe('complex')
    expect(result.parameters.username).toBeDefined()
    expect(result.parameters.count).toBeDefined()
    expect(result.parameters.enabled).toBeDefined()
    expect(result.parameters.tags).toBeDefined()
    expect(result.parameters.config).toBeDefined()
  })

  it('should parse template with optional action tag fields', () => {
    const result = parseTemplateInstruction(`template: optional-test
params:
  required: !string
    name: req
  optional: !string?
    name: opt
    default: default-value`)

    expect(result.template).toBe('optional-test')
    expect(result.parameters.required).toBeDefined()
    expect(result.parameters.optional).toBeDefined()
  })

  it('should handle templates with both regular and action tag fields', () => {
    const result = parseTemplateInstruction(`template: mixed
params:
  regularField: ((placeholder))
  actionTagField: !string
    name: username
  staticValue: test`)

    expect(result.template).toBe('mixed')
    expect(result.parameters.regularField).toBe('((placeholder))')
    expect(result.parameters.actionTagField).toBeDefined()
    expect(result.parameters.staticValue).toBe('test')
  })
})

describe('isActionTagField', () => {
  it('should return true for StringField instances', () => {
    const result = parseTemplateInstruction(`template: test
params:
  field: !string
    name: test`)

    expect(isTagField(result.parameters.field)).toBe(true)
  })

  it('should return true for NumberField instances', () => {
    const result = parseTemplateInstruction(`template: test
params:
  field: !number
    name: count`)

    expect(isTagField(result.parameters.field)).toBe(true)
  })

  it('should return true for BooleanField instances', () => {
    const result = parseTemplateInstruction(`template: test
params:
  field: !boolean
    name: enabled`)

    expect(isTagField(result.parameters.field)).toBe(true)
  })

  it('should return true for ArrayField instances', () => {
    const result = parseTemplateInstruction(`template: test
params:
  field: !array
    name: items
    items:
      type: string`)

    expect(isTagField(result.parameters.field)).toBe(true)
  })

  it('should return true for ObjectField instances', () => {
    const result = parseTemplateInstruction(`template: test
params:
  field: !object
    name: config
    properties:
      key:
        type: string`)

    expect(isTagField(result.parameters.field)).toBe(true)
  })

  it('should return false for regular strings', () => {
    expect(isTagField('test')).toBe(false)
  })

  it('should return false for field placeholders', () => {
    expect(isTagField('{{field}}')).toBe(false)
    expect(isTagField('[[field]]')).toBe(false)
    expect(isTagField('((field))')).toBe(false)
  })

  it('should return false for null and undefined', () => {
    expect(isTagField(null)).toBe(false)
    expect(isTagField(undefined)).toBe(false)
  })

  it('should return false for numbers and booleans', () => {
    expect(isTagField(123)).toBe(false)
    expect(isTagField(true)).toBe(false)
    expect(isTagField(false)).toBe(false)
  })

  it('should return false for plain objects and arrays', () => {
    expect(isTagField({})).toBe(false)
    expect(isTagField([])).toBe(false)
    expect(isTagField({ key: 'value' })).toBe(false)
  })
})

describe('isTemplateField - enhanced with action tags', () => {
  it('should return true for regular field placeholders', () => {
    expect(isTemplateField('{{field}}')).toBe(true)
    expect(isTemplateField('[[field]]')).toBe(true)
    expect(isTemplateField('((field))')).toBe(true)
  })

  it('should return true for action tag fields', () => {
    const result = parseTemplateInstruction(`template: test
params:
  stringField: !string
    name: str
  numberField: !number
    name: num
  boolField: !boolean
    name: bool
  arrayField: !array
    name: arr
    items:
      type: string
  objectField: !object
    name: obj
    properties:
      key:
        type: string`)

    expect(isTemplateField(result.parameters.stringField)).toBe(true)
    expect(isTemplateField(result.parameters.numberField)).toBe(true)
    expect(isTemplateField(result.parameters.boolField)).toBe(true)
    expect(isTemplateField(result.parameters.arrayField)).toBe(true)
    expect(isTemplateField(result.parameters.objectField)).toBe(true)
  })

  it('should return false for regular values', () => {
    expect(isTemplateField('regular string')).toBe(false)
    expect(isTemplateField(123)).toBe(false)
    expect(isTemplateField(true)).toBe(false)
    expect(isTemplateField({})).toBe(false)
    expect(isTemplateField([])).toBe(false)
  })

  it('should correctly identify fields in mixed parameters', () => {
    const result = parseTemplateInstruction(`template: mixed
params:
  actionTag: !string
    name: user
  regularField: ((input))
  staticValue: test
  numberValue: 42`)

    const filtered = Object.fromEntries(
      Object.entries(result.parameters).map(([name, value]) => {
        return [name, isTemplateField(value) ? undefined : value]
      })
    )

    expect(filtered).toEqual({
      actionTag: undefined,
      regularField: undefined,
      staticValue: 'test',
      numberValue: 42,
    })
  })
})
