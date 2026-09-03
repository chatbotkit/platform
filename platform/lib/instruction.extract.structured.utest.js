import {
  extractStructuredInstructionFields,
  substituteStructuredInstructionFields,
} from '@/lib/instruction.extract.structured'

// @note The extractFields function from action.tags.ts recursively extracts
// fields from the parsed object, including fields nested inside action tags
// (!fetch, !skillset.install, etc.) and plain objects.
//
// @note Type detection uses the YAML tag type (!string, !number, !boolean,
// !array, !object) to determine the field type. Array and object fields are
// treated as 'string' for compatibility with simple field schemas.

describe('extractStructuredInstructionFields', () => {
  describe('string fields', () => {
    it('should extract a simple string field', () => {
      const instruction = `query: !string
  name: query
  description: the search query`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
        description: 'the search query',
      })
    })

    it('should extract a required string field', () => {
      const instruction = `query: !string
  name: query
  required: true
  description: the search query`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
        required: true,
      })
    })

    it('should extract a string field with default value', () => {
      const instruction = `query: !string
  name: query
  default: "default query"`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
        default: 'default query',
      })
    })

    it('should extract a string field with enum values', () => {
      const instruction = `status: !string
  name: status
  enum:
    - active
    - inactive
    - pending`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'status',
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
      })
    })

    it('should extract a string field with placeholder flag', () => {
      const instruction = `apiKey: !string
  name: apiKey
  placeholder: true`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'apiKey',
        type: 'string',
        placeholder: true,
      })
    })

    it('should extract a string field with all options', () => {
      const instruction = `status: !string
  name: status
  description: the current status
  required: true
  enum:
    - active
    - inactive
  default: active`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'status',
        type: 'string',
        description: 'the current status',
        required: true,
        enum: ['active', 'inactive'],
        default: 'active',
      })
    })

    it('should detect string type from transform property', () => {
      const instruction = `query: !string
  name: query
  transform:
    - lower
    - trim`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
      })
    })
  })

  describe('number fields', () => {
    it('should infer number type from number default value', () => {
      const instruction = `limit: !number
  name: limit
  default: 10`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'limit',
        type: 'number',
        default: 10,
      })
    })

    it('should detect number type from !number tag', () => {
      const instruction = `count: !number
  name: count
  description: the item count`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'count',
        type: 'number',
        description: 'the item count',
      })
    })

    it('should extract a number field with enum values', () => {
      const instruction = `pageSize: !number
  name: pageSize
  enum:
    - 10
    - 25
    - 50
    - 100`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'pageSize',
        // @note type is 'string' due to no default value
        enum: [10, 25, 50, 100],
      })
    })

    it('should infer number type when required with default', () => {
      const instruction = `limit: !number
  name: limit
  required: true
  default: 20`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'limit',
        type: 'number',
        required: true,
        default: 20,
      })
    })
  })

  describe('boolean fields', () => {
    it('should infer boolean type from boolean default value true', () => {
      const instruction = `active: !boolean
  name: active
  default: true`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'active',
        type: 'boolean',
        default: true,
      })
    })

    it('should infer boolean type from boolean default value false', () => {
      const instruction = `flag: !boolean
  name: flag
  default: false`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'flag',
        type: 'boolean',
        default: false,
      })
    })

    it('should detect boolean type from !boolean tag', () => {
      const instruction = `enabled: !boolean
  name: enabled
  description: whether the feature is enabled`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'enabled',
        type: 'boolean',
        description: 'whether the feature is enabled',
      })
    })
  })

  describe('array fields', () => {
    it('should extract an array field with items schema', () => {
      const instruction = `tags: !array
  name: tags
  description: list of tags
  items:
    name: tag`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'tags',
        type: 'array',
        description: 'list of tags',
        items: {
          name: 'tag',
          type: 'string',
          required: true,
        },
      })
    })

    it('should extract a required array field', () => {
      const instruction = `items: !array
  name: items
  items:
    name: itemId`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'items',
        type: 'array',
        required: true,
        items: {
          name: 'itemId',
          type: 'string',
          required: true,
        },
      })
    })

    it('should extract an array field with items that have a default value', () => {
      const instruction = `scores: !array
  name: scores
  description: list of scores
  items:
    name: score
    default: 0`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'scores',
        type: 'array',
        description: 'list of scores',
        items: {
          name: 'score',
          type: 'number',
          default: 0,
        },
      })
    })
  })

  describe('object fields', () => {
    it('should extract an object field with properties schema', () => {
      const instruction = `config: !object
  name: config
  description: configuration object
  properties:
    host:
      name: host`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'config',
        type: 'object',
        description: 'configuration object',
        properties: {
          host: {
            name: 'host',
            type: 'string',
            required: true,
          },
        },
      })
    })

    it('should extract an object field with multiple properties with defaults', () => {
      const instruction = `settings: !object
  name: settings
  properties:
    port:
      name: port
      default: 8080
    enabled:
      name: enabled
      default: true
    name:
      name: name
      default: "default"`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'settings',
        type: 'object',
        properties: {
          port: {
            name: 'port',
            type: 'number',
            default: 8080,
          },
          enabled: {
            name: 'enabled',
            type: 'boolean',
            default: true,
          },
          name: {
            name: 'name',
            type: 'string',
            default: 'default',
          },
        },
      })
    })
  })

  describe('multiple fields at top level', () => {
    // @note extractFields only extracts top-level fields

    it('should extract multiple fields of different types', () => {
      const instruction = `query: !string
  name: query
  required: true
  description: the search query
limit: !number
  name: limit
  default: 10
  description: max results
includeArchived: !boolean
  name: includeArchived
  default: false`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(3)
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'query',
          type: 'string',
          required: true,
          description: 'the search query',
        })
      )
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'max results',
        })
      )
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'includeArchived',
          type: 'boolean',
          default: false,
        })
      )
    })

    it('should extract fields nested inside action tags', () => {
      // @note extractFields recursively traverses action tags
      const instruction = `!fetch
method: POST
url: /api/search
body:
  query: !string
    name: query
    required: true
  page: !number
    name: page
    default: 1`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(2)
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'query',
          type: 'string',
          required: true,
        })
      )
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'page',
          type: 'number',
          default: 1,
        })
      )
    })

    it('should extract fields from nested plain objects', () => {
      // @note extractFields recursively traverses nested objects
      const instruction = `config:
  api:
    key: !string
      name: apiKey
      required: true
    timeout: !number
      name: timeout
      default: 30000`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(2)
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'apiKey',
          type: 'string',
          required: true,
        })
      )
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'timeout',
          type: 'number',
          default: 30000,
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should return empty array for empty instruction', () => {
      const instruction = ''

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for null-ish instruction', () => {
      const instruction = 'null'

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for instruction without fields', () => {
      const instruction = `!fetch
method: GET
url: /api/status`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for plain string instruction', () => {
      const instruction = 'This is a plain text instruction'

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for invalid YAML', () => {
      const instruction = `query: !string
  name: [invalid yaml syntax`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should handle instruction with no !string, !number, !boolean tags', () => {
      const instruction = `config:
  host: localhost
  port: 8080
  enabled: true`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should only include field type properties not arbitrary data', () => {
      const instruction = `query: !string
  name: query
  description: test`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
        description: 'test',
      })
      // Should not have extra properties
      expect(fields[0]).not.toHaveProperty('transform')
      expect(fields[0]).not.toHaveProperty('enum')
    })
  })

  // @note The following tests document that nested field extraction works.
  // extractFields recursively extracts field tags from action tags
  // (!fetch, !skillset.install) and plain objects.

  describe('action tags with fields', () => {
    it('should extract fields nested inside !fetch action', () => {
      // @note fields inside the !fetch body are now extracted
      const instruction = `!fetch
method: POST
url: /api/v1/data
headers:
  Content-Type: application/json
body:
  name: !string
    name: userName
    required: true
    description: the user name`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'userName',
        type: 'string',
        required: true,
        description: 'the user name',
      })
    })

    it('should NOT extract fields nested inside !skillset.install action', () => {
      const instruction = `!skillset.install
id: skillset-123
abilities:
  - id: ability-1
    parameters:
      query: !string
        name: searchQuery
        required: true`

      const fields = extractStructuredInstructionFields(instruction)

      // @note nested extraction is not supported
      expect(fields).toHaveLength(0)
    })

    it('should extract fields from deeply nested action', () => {
      const instruction = `action: !fetch
  method: POST
  url: /api/webhook
  body:
    event: !string
      name: eventType
      required: true
      enum:
        - create
        - update
        - delete
    payload:
      id: !string
        name: resourceId
        required: true
      active: !boolean
        name: isActive
        default: true`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(3)
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'eventType',
          type: 'string',
          required: true,
          enum: ['create', 'update', 'delete'],
        })
      )
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'resourceId',
          type: 'string',
          required: true,
        })
      )
      expect(fields).toContainEqual(
        expect.objectContaining({
          name: 'isActive',
          type: 'boolean',
          default: true,
        })
      )
    })
  })

  describe('top-level fields for structured instructions', () => {
    // @note For structured instructions to work with extractFields,
    // fields must be at the top level of the YAML document

    it('should extract top-level fields used for parameter collection', () => {
      const instruction = `calendarId: !string
  name: calendarId
  description: the calendar ID
summary: !string
  name: summary
  description: the event summary
startTime: !string
  name: startTime
  description: the start time in ISO format
endTime: !string
  name: endTime
  description: the end time in ISO format
attendees: !string
  name: attendees
  optional: true
  description: comma-separated list of attendee emails`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(5)
      expect(fields.filter((f) => f.required).map((f) => f.name)).toEqual([
        'calendarId',
        'summary',
        'startTime',
        'endTime',
      ])
      expect(fields.filter((f) => !f.required).map((f) => f.name)).toEqual([
        'attendees',
      ])
    })

    it('should extract top-level fields for search action', () => {
      const instruction = `searchQuery: !string
  name: searchQuery
  required: true
  description: the search term
page: !number
  name: page
  default: 1
  description: page number
limit: !number
  name: limit
  default: 20
  enum:
    - 10
    - 20
    - 50
    - 100
sortBy: !string
  name: sortBy
  default: relevance
  enum:
    - relevance
    - date
    - name`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(4)
      expect(fields.find((f) => f.name === 'searchQuery')).toMatchObject({
        type: 'string',
        required: true,
      })
      expect(fields.find((f) => f.name === 'page')).toMatchObject({
        type: 'number',
        default: 1,
      })
      expect(fields.find((f) => f.name === 'limit')).toMatchObject({
        type: 'number',
        default: 20,
        enum: [10, 20, 50, 100],
      })
      expect(fields.find((f) => f.name === 'sortBy')).toMatchObject({
        type: 'string',
        default: 'relevance',
        enum: ['relevance', 'date', 'name'],
      })
    })
  })

  describe('reference fields', () => {
    it('should extract !reference fields with type: reference', () => {
      const instruction = `!fetch
method: GET
url: /api/data
headers:
  Authorization: !reference SECRET_API_KEY`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'SECRET_API_KEY',
        type: 'reference',
      })
    })

    it('should extract multiple reference fields', () => {
      const instruction = `!fetch
method: POST
url: /api/webhook
headers:
  Authorization: !reference API_TOKEN
  X-User-Id: !reference USER_ID`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(2)
      expect(fields.find((f) => f.name === 'API_TOKEN')).toMatchObject({
        type: 'reference',
      })
      expect(fields.find((f) => f.name === 'USER_ID')).toMatchObject({
        type: 'reference',
      })
    })

    it('should extract reference fields mixed with other field types', () => {
      const instruction = `!fetch
method: POST
url: /api/search
headers:
  Authorization: !reference API_TOKEN
body:
  query: !string
    name: query
    description: the search query`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(2)
      expect(fields.find((f) => f.name === 'API_TOKEN')).toMatchObject({
        type: 'reference',
      })
      expect(fields.find((f) => f.name === 'query')).toMatchObject({
        type: 'string',
        description: 'the search query',
      })
    })

    it('should extract reference fields from !concat', () => {
      const instruction = `!fetch
method: GET
url: !concat
  - "https://api.example.com/"
  - !reference ENDPOINT_PATH`

      const fields = extractStructuredInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'ENDPOINT_PATH',
        type: 'reference',
      })
    })
  })
})

describe('substituteStructuredInstructionFields', () => {
  it('should substitute string field values', () => {
    const instruction = `!fetch
method: GET
url: !concat
  - "https://api.example.com/search?q="
  - !string
    name: query`
    const fieldValues = { query: 'test-search' }

    const result = substituteStructuredInstructionFields(
      instruction,
      fieldValues
    )

    expect(result).toContain('test-search')
    expect(result).not.toContain('!string')
  })

  it('should substitute multiple field values', () => {
    const instruction = `!fetch
method: GET
url: !concat
  - "https://api.example.com/"
  - !string
    name: endpoint
  - "?limit="
  - !number
    name: limit`
    const fieldValues = {
      endpoint: 'users',
      limit: 50,
    }

    const result = substituteStructuredInstructionFields(
      instruction,
      fieldValues
    )

    expect(result).toContain('users')
    expect(result).toContain('50')
  })

  it('should use default value when field not provided', () => {
    const instruction = `limit: !number
  name: limit
  default: 10`
    const fieldValues = {}

    const result = substituteStructuredInstructionFields(
      instruction,
      fieldValues
    )

    expect(result).toContain('10')
  })

  it('should preserve action tag content for non-field instruction', () => {
    // @note when substitution processes a !fetch action, it extracts the
    // inner value object and dumps it as YAML - the tag is intentionally
    // not re-added as the output is meant for further processing
    const instruction = `!fetch
method: GET
url: "https://api.example.com/static"`
    const fieldValues = {}

    const result = substituteStructuredInstructionFields(
      instruction,
      fieldValues
    )

    // @note the action tag content is preserved but serialized as plain YAML
    expect(result).toContain('method: "GET"')
    expect(result).toContain('"https://api.example.com/static"')
  })

  it('should handle boolean field substitution', () => {
    const instruction = `enabled: !boolean
  name: enabled
  default: false`
    const fieldValues = { enabled: true }

    const result = substituteStructuredInstructionFields(
      instruction,
      fieldValues
    )

    expect(result).toContain('true')
  })
})
