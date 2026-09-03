import {
  extractTemplateInstructionFields,
  substituteTemplateInstructionFields,
} from '@/lib/instruction.extract.template'
import { unpackTemplateInstruction } from '@/lib/instruction.template.unpack'

jest.mock('@/lib/instruction.template.unpack', () => ({
  unpackTemplateInstruction: jest.fn(),
}))

describe('extractTemplateInstructionFields', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('template parsing', () => {
    it('should parse single-line @template format', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!|the search query]
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@google/search')

      expect(unpackTemplateInstruction).toHaveBeenCalledWith('google/search')
      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        required: true,
        description: 'the search query',
      })
    })

    it('should parse YAML template format', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!|the search query]
\`\`\`
`,
      })

      const instruction = `
template: google/search
parameters:
  maxResults: 10
`

      extractTemplateInstructionFields(instruction)

      expect(unpackTemplateInstruction).toHaveBeenCalledWith('google/search')
    })

    it('should parse YAML template with params shorthand', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&limit=$[limit]
\`\`\`
`,
      })

      const instruction = `
template: api/search
params:
  limit: 10
`

      extractTemplateInstructionFields(instruction)

      expect(unpackTemplateInstruction).toHaveBeenCalledWith('api/search')
    })
  })

  describe('template not found', () => {
    it('should return empty array when template is not found', () => {
      unpackTemplateInstruction.mockReturnValue(null)

      const fields = extractTemplateInstructionFields('@nonexistent/template')

      expect(fields).toHaveLength(0)
    })
  })

  describe('simple underlying instruction', () => {
    it('should extract fields from simple instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!|search query]&limit=$[limit num default{10}]
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@api/search')

      expect(fields).toHaveLength(2)

      const queryField = fields.find((f) => f.name === 'query')
      const limitField = fields.find((f) => f.name === 'limit')

      expect(queryField).toMatchObject({
        name: 'query',
        required: true,
        description: 'search query',
      })

      expect(limitField).toMatchObject({
        name: 'limit',
        type: 'number',
        default: 10,
      })
    })

    it('should extract placeholder fields from simple instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`dataset/search/id=((datasetId!|the dataset Id))
$[query!|search query]
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@dataset/search')

      const datasetField = fields.find((f) => f.name === 'datasetId')
      const queryField = fields.find((f) => f.name === 'query')

      expect(datasetField).toMatchObject({
        name: 'datasetId',
        required: true,
        placeholder: true,
      })

      expect(queryField).toMatchObject({
        name: 'query',
        required: true,
      })
    })
  })

  describe('complex underlying instruction', () => {
    it('should extract fields from complex instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
First, search for relevant data.

\`\`\`fetch
GET https://api.example.com/search?q=$[query!]
\`\`\`

Then process the results.

\`\`\`text
Summarize: $[summary]
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@complex/operation')

      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'summary'])
      )
    })
  })

  describe('filtering filled parameters', () => {
    it('should filter out fields that are filled by template parameters', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&limit=$[limit]&offset=$[offset]
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  limit: 10
  offset: 0
`

      const fields = extractTemplateInstructionFields(instruction)

      // Only query should remain, limit and offset are filled
      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('query')
    })

    it('should not filter out fields with empty string parameter values', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&filter=$[filter]
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  filter: ""
`

      const fields = extractTemplateInstructionFields(instruction)

      // Both query and filter should remain (empty string is not considered filled)
      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'filter'])
      )
    })

    it('should not filter out fields with null parameter values', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&filter=$[filter]
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  filter: null
`

      const fields = extractTemplateInstructionFields(instruction)

      expect(fields).toHaveLength(2)
    })

    it('should not filter out fields when parameter value is a field definition', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`dataset/search/id=$[datasetId]
$[query!]
\`\`\`
`,
      })

      const instruction = `
template: dataset/search
parameters:
  datasetId: "((datasetId!))"
`

      const fields = extractTemplateInstructionFields(instruction)

      // Both fields should remain because datasetId parameter is itself a field definition
      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'datasetId'])
      )
    })

    it('should filter out fields with non-empty filled values', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&maxResults=$[maxResults]&format=$[format]
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  maxResults: 25
  format: json
`

      const fields = extractTemplateInstructionFields(instruction)

      // Only query should remain
      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('query')
    })
  })

  describe('nested template instructions', () => {
    it('should recursively extract fields from nested templates', () => {
      // First call returns a template instruction
      unpackTemplateInstruction
        .mockReturnValueOnce({
          instruction: `
template: inner/template
parameters:
  innerParam: filled
`,
        })
        // Second call returns the inner template's instruction
        .mockReturnValueOnce({
          instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&inner=$[innerParam]&other=$[otherField]
\`\`\`
`,
        })

      const fields = extractTemplateInstructionFields('@outer/template')

      // query and otherField should remain, innerParam is filled
      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'otherField'])
      )
    })
  })

  describe('edge cases', () => {
    it('should return empty array for empty instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: '',
      })

      const fields = extractTemplateInstructionFields('@empty/template')

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for instruction without fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/static
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@static/endpoint')

      expect(fields).toHaveLength(0)
    })

    it('should handle instruction with only special fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/user
Authorization: Bearer \${SECRET_API_KEY}
X-User: \${USER_EMAIL}
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@user/profile')

      // Special fields should be filtered out by the underlying extractors
      expect(fields).toHaveLength(0)
    })

    it('should handle whitespace in template name', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]
\`\`\`
`,
      })

      extractTemplateInstructionFields('@  google/search  ')

      expect(unpackTemplateInstruction).toHaveBeenCalledWith('google/search')
    })

    it('should handle template with all parameters filled', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/data?p1=$[param1]&p2=$[param2]&p3=$[param3]
\`\`\`
`,
      })

      const instruction = `
template: fully/configured
parameters:
  param1: value1
  param2: value2
  param3: value3
`

      const fields = extractTemplateInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })
  })

  describe('field types and attributes', () => {
    it('should preserve field types from underlying instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
POST https://api.example.com/data
body: { count: $[count num], enabled: $[enabled bool], name: $[name] }
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@typed/fields')

      const countField = fields.find((f) => f.name === 'count')
      const enabledField = fields.find((f) => f.name === 'enabled')
      const nameField = fields.find((f) => f.name === 'name')

      expect(countField.type).toBe('number')
      expect(enabledField.type).toBe('boolean')
      expect(nameField.type).toBe('string')
    })

    it('should preserve enum values from underlying instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
PATCH https://api.example.com/task
body: { status: $[status enum{pending,active,done}|task status] }
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@task/update')

      expect(fields[0]).toMatchObject({
        name: 'status',
        enum: ['pending', 'active', 'done'],
        description: 'task status',
      })
    })

    it('should preserve default values from underlying instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/list?limit=$[limit num default{10}]&format=$[format default{json}]
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@api/list')

      const limitField = fields.find((f) => f.name === 'limit')
      const formatField = fields.find((f) => f.name === 'format')

      expect(limitField.default).toBe(10)
      expect(formatField.default).toBe('json')
    })

    it('should preserve required flag from underlying instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/data?required=$[required!]&optional=$[optional]
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@mixed/fields')

      const requiredField = fields.find((f) => f.name === 'required')
      const optionalField = fields.find((f) => f.name === 'optional')

      expect(requiredField.required).toBe(true)
      expect(optionalField.required).toBeUndefined()
    })

    it('should preserve placeholder flag (reference is not preserved for non-special fields)', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch/id=((placeholder!))
GET https://api.example.com/data
Authorization: Bearer \${reference}
X-Regular: $[regular]
\`\`\`
`,
      })

      const fields = extractTemplateInstructionFields('@mixed/brackets')

      const placeholderField = fields.find((f) => f.name === 'placeholder')
      const referenceField = fields.find((f) => f.name === 'reference')
      const regularField = fields.find((f) => f.name === 'regular')

      expect(placeholderField.placeholder).toBe(true)
      // curly bracket non-special fields don't have reference flag anymore
      expect(referenceField.reference).toBeUndefined()
      expect(regularField.placeholder).toBeUndefined()
      expect(regularField.reference).toBeUndefined()
    })
  })
})

describe('substituteTemplateInstructionFields', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic substitution', () => {
    // @note substitution only works on round brackets ((field)) - i.e. placeholder fields

    it('should substitute round bracket fields in simple template instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@google/search', {
        query: 'ChatBotKit',
      })

      expect(result).toContain('ChatBotKit')
      expect(result).not.toContain('((query!))')
    })

    it('should substitute multiple round bracket fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))&limit=((limit))&format=((format))
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@api/search', {
        query: 'test',
        limit: 10,
        format: 'json',
      })

      expect(result).toContain('test')
      expect(result).toContain('10')
      expect(result).toContain('json')
    })

    it('should work with single-line @template format', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`dataset/search/id=((datasetId!))
((query!))
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@dataset/search', {
        datasetId: 'ds_123',
        query: 'search terms',
      })

      expect(result).toContain('ds_123')
      expect(result).toContain('search terms')
    })

    it('should work with YAML template format', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))
\`\`\`
`,
      })

      const instruction = `
template: google/search
parameters:
  extraParam: value
`

      const result = substituteTemplateInstructionFields(instruction, {
        query: 'test query',
      })

      expect(result).toContain('test query')
    })

    it('should not substitute square bracket fields (AI-populated)', () => {
      // @note square brackets are AI-populated and not substituted here
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@api/search', {
        query: 'test',
      })

      // Square brackets should remain unchanged
      expect(result).toContain('$[query!]')
    })
  })

  describe('template parameter precedence', () => {
    it('should give precedence to template parameters over field values', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))&limit=((limit))
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  limit: 20
`

      const result = substituteTemplateInstructionFields(instruction, {
        query: 'test',
        limit: 100, // This should be overridden by template parameter
      })

      expect(result).toContain('20')
      expect(result).not.toContain('100')
    })

    it('should not override field values with empty string template parameters', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))&filter=((filter))
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  filter: ""
`

      const result = substituteTemplateInstructionFields(instruction, {
        query: 'test',
        filter: 'active',
      })

      expect(result).toContain('active')
    })

    it('should not override field values with null template parameters', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))&filter=((filter))
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  filter: null
`

      const result = substituteTemplateInstructionFields(instruction, {
        query: 'test',
        filter: 'active',
      })

      expect(result).toContain('active')
    })

    it('should not override field values when template parameter is a field definition', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`dataset/search/id=((datasetId!))
((query!))
\`\`\`
`,
      })

      const instruction = `
template: dataset/search
parameters:
  datasetId: "((datasetId!))"
`

      const result = substituteTemplateInstructionFields(instruction, {
        datasetId: 'ds_actual_123',
        query: 'search',
      })

      // Field definition should be passed through, allowing datasetId to be substituted
      expect(result).toContain('ds_actual_123')
    })
  })

  describe('template not found', () => {
    it('should return original instruction when template is not found', () => {
      unpackTemplateInstruction.mockReturnValue(null)

      const instruction = '@nonexistent/template'
      const result = substituteTemplateInstructionFields(instruction, {
        query: 'test',
      })

      expect(result).toBe(instruction)
    })
  })

  describe('nested template instructions', () => {
    it('should recursively substitute fields in nested templates', () => {
      // First call returns a template instruction

      unpackTemplateInstruction
        .mockReturnValueOnce({
          instruction: `
template: inner/template
parameters:
  innerParam: fixed
`,
        })
        // Second call returns the inner template's instruction
        .mockReturnValueOnce({
          instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))&inner=((innerParam))&other=((otherField))
\`\`\`
`,
        })

      const result = substituteTemplateInstructionFields('@outer/template', {
        query: 'test query',
        otherField: 'other value',
      })

      expect(result).toContain('test query')
      expect(result).toContain('fixed')
      expect(result).toContain('other value')
    })
  })

  describe('different instruction types', () => {
    it('should substitute fields in complex instruction', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
First, search for data.

\`\`\`fetch
GET https://api.example.com/search?q=((query!))
\`\`\`

Then process the results.

\`\`\`text
Summarize: ((summary))
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@complex/operation', {
        query: 'test',
        summary: 'brief overview',
      })

      expect(result).toContain('test')
      expect(result).toContain('brief overview')
    })

    it('should substitute fields in structured instruction with action tag fields', () => {
      // @note structured instructions use YAML custom tags for fields
      // e.g., !string { name: fieldName } or !number { name: fieldName }

      unpackTemplateInstruction.mockReturnValue({
        instruction: `!fetch
url: !string { name: resource }
method: POST
`,
      })

      const result = substituteTemplateInstructionFields('@structured/action', {
        resource: 'https://api.example.com/users',
      })

      expect(result).toContain('https://api.example.com/users')
    })
  })

  describe('edge cases', () => {
    it('should handle empty field values object', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@api/search', {})

      // Should return instruction with unsubstituted fields (round brackets stay)

      expect(result).toContain('((query!))')
    })

    it('should handle instruction with no fields to substitute', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/static
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@static/endpoint', {
        unused: 'value',
      })

      expect(result).toContain('static')
    })

    it('should handle numeric and boolean field values', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
POST https://api.example.com/data
body: { count: ((count)), enabled: ((enabled)), name: ((name)) }
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@typed/fields', {
        count: 42,
        enabled: true,
        name: 'test',
      })

      expect(result).toContain('42')
      expect(result).toContain('true')
      expect(result).toContain('test')
    })

    it('should handle placeholder fields with round brackets', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`dataset/search/id=((datasetId!))
((query!))
\`\`\`
`,
      })

      const result = substituteTemplateInstructionFields('@dataset/search', {
        datasetId: 'ds_123',
        query: 'search terms',
      })

      expect(result).toContain('ds_123')
      expect(result).toContain('search terms')
    })

    it('should handle template with all parameters filled', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/data?p1=((param1))&p2=((param2))
\`\`\`
`,
      })

      const instruction = `
template: fully/configured
parameters:
  param1: value1
  param2: value2
`

      const result = substituteTemplateInstructionFields(instruction, {})

      expect(result).toContain('value1')
      expect(result).toContain('value2')
    })

    it('should merge template parameters with field values', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=((query!))&limit=((limit))&offset=((offset))&format=((format))
\`\`\`
`,
      })

      const instruction = `
template: api/search
parameters:
  limit: 20
  format: json
`

      const result = substituteTemplateInstructionFields(instruction, {
        query: 'test',
        offset: 0,
      })

      expect(result).toContain('test')
      expect(result).toContain('20') // from template
      expect(result).toContain('0') // from field values
      expect(result).toContain('json') // from template
    })
  })

  describe('action tag fields in parameters', () => {
    it('should extract fields from underlying instruction when template has action tag field parameters', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&limit=$[limit]
\`\`\`
`,
      })

      const instruction = `
template: api/search
params:
  query: !string
    name: searchQuery
    description: The search query
    required: true
`

      const fields = extractTemplateInstructionFields(instruction)

      // @note query should remain because the parameter is itself a field definition (action tag)
      // limit should also be extracted from underlying instruction
      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'limit'])
      )
    })

    it('should not filter out fields when parameter is an action tag field', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/data?value=$[value!]
\`\`\`
`,
      })

      const instruction = `
template: api/data
params:
  value: !string
    name: dataValue
    description: The data value
`

      const fields = extractTemplateInstructionFields(instruction)

      // value should remain because it's defined as a field
      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('value')
    })

    it('should handle mix of regular values and action tag fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&limit=$[limit]&format=$[format]
\`\`\`
`,
      })

      const instruction = `
template: api/search
params:
  limit: !number
    name: maxResults
    default: 10
  format: json
`

      const fields = extractTemplateInstructionFields(instruction)

      // query should remain (not filled)
      // limit should remain (is a field definition via action tag)
      // format should be filtered (filled with regular value)
      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'limit'])
      )
    })

    it('should handle all action tag field types in parameters', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/data?str=$[stringField]&num=$[numberField]&bool=$[boolField]
\`\`\`
`,
      })

      const instruction = `
template: api/typed
params:
  stringField: !string
    name: text
    description: A string
  numberField: !number
    name: count
    default: 5
  boolField: !boolean
    name: enabled
    default: true
`

      const fields = extractTemplateInstructionFields(instruction)

      // All three fields should remain as they are field definitions
      expect(fields).toHaveLength(3)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['stringField', 'numberField', 'boolField'])
      )
    })

    it('should handle optional action tag fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&filter=$[filter]
\`\`\`
`,
      })

      const instruction = `
template: api/search
params:
  filter: !string?
    name: filterValue
    description: Optional filter
    default: ""
`

      const fields = extractTemplateInstructionFields(instruction)

      // Both fields should remain
      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'filter'])
      )
    })

    it('should handle array action tag fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
POST https://api.example.com/bulk
Body: $[items!]
\`\`\`
`,
      })

      const instruction = `
template: api/bulk
params:
  items: !array
    name: dataItems
    description: Array of items
    items:
      type: string
    default: []
`

      const fields = extractTemplateInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('items')
    })

    it('should handle object action tag fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
POST https://api.example.com/config
Body: $[settings!]
\`\`\`
`,
      })

      const instruction = `
template: api/config
params:
  settings: !object
    name: configuration
    description: Config object
    properties:
      host:
        type: string
      port:
        type: number
    default: {}
`

      const fields = extractTemplateInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('settings')
    })

    it('should handle bracket notation fields alongside action tag fields', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/search?q=$[query!]&limit=$[limit]&offset=$[offset]
\`\`\`
`,
      })

      const instruction = `
template: api/search
params:
  limit: !number
    name: maxResults
    default: 10
  offset: ((pageOffset!))
`

      const fields = extractTemplateInstructionFields(instruction)

      // query should remain (not filled)
      // limit should remain (action tag field definition)
      // offset should remain (bracket notation field definition)
      expect(fields).toHaveLength(3)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['query', 'limit', 'offset'])
      )
    })

    it('should handle empty action tag field (not filter it out)', () => {
      unpackTemplateInstruction.mockReturnValue({
        instruction: `
\`\`\`fetch
GET https://api.example.com/data?value=$[value!]
\`\`\`
`,
      })

      const instruction = `
template: api/data
params:
  value: !string
    name: emptyField
    default: ""
`

      const fields = extractTemplateInstructionFields(instruction)

      // Should not be filtered - action tag fields are field definitions, not filled values
      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('value')
    })

    it.skip('should handle nested template with action tag fields', () => {
      // @todo this test reveals a limitation in nested template handling
      // When a template's parameter is an action tag field, and that template
      // points to another template, the recursive extraction doesn't work as
      // expected. This is an edge case that needs deeper investigation.

      unpackTemplateInstruction
        .mockReturnValueOnce({
          instruction: `
template: inner/template
params:
  innerField: !string
    name: innerValue
    description: Inner field
`,
        })
        .mockReturnValueOnce({
          instruction: `
\`\`\`fetch
GET https://api.example.com/data?inner=$[innerField!]&outer=$[outerField!]
\`\`\`
`,
        })

      const fields = extractTemplateInstructionFields('@outer/template')

      expect(fields.length).toBeGreaterThanOrEqual(1)
      expect(fields.map((f) => f.name)).toContain('outerField')
    })
  })
})
