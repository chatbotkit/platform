/* eslint-disable @typescript-eslint/no-require-imports */
import {
  ACTION_CLASSES,
  ACTION_TAGS_SCHEMA,
  Concat,
  FetchAction,
  McpInstallAction,
  ObjectField,
  PackInstallAction,
  SkillsetInstallAction,
  TimeNowAction,
  extractFields,
  isActionTag,
  parse,
  substituteAndTransform,
  substituteFields,
  tryParse,
} from '@/lib/action.tags'

import yaml from 'js-yaml'

describe('action.tags', () => {
  describe('field tags', () => {
    describe('!string', () => {
      it('should parse a basic string field', () => {
        const input = `
field: !string
  name: username
  description: The username
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field).toBeDefined()
        expect(result.field.value.name).toBe('username')
        expect(result.field.value.description).toBe('The username')
      })

      it('should parse a string field with enum and default', () => {
        const input = `
field: !string
  name: color
  enum:
    - red
    - green
    - blue
  default: red
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('color')
        expect(result.field.value.enum).toEqual(['red', 'green', 'blue'])
        expect(result.field.value.default).toBe('red')
      })

      it('should parse a string field with transforms', () => {
        const input = `
field: !string
  name: slug
  transform:
    - lower
    - trim
    - urlencode
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.transform).toEqual([
          'lower',
          'trim',
          'urlencode',
        ])
      })

      it('should reject invalid transform values', () => {
        const input = `
field: !string
  name: test
  transform:
    - invalid_transform
`

        expect(() => yaml.load(input, { schema: ACTION_TAGS_SCHEMA })).toThrow()
      })

      it('should have optional: false by default (required)', () => {
        const input = `
field: !string
  name: email
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('email')
        expect(result.field.value.optional).toBe(false)
      })

      it('should parse a string field with optional: true', () => {
        const input = `
field: !string
  name: email
  optional: true
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('email')
        expect(result.field.value.optional).toBe(true)
      })

      it('should parse an optional string field with !string? syntax', () => {
        const input = `
field: !string?
  name: email
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('email')
        expect(result.field.value.optional).toBe(true)
      })
    })

    describe('!number', () => {
      it('should parse a basic number field', () => {
        const input = `
field: !number
  name: age
  description: User age
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('age')
        expect(result.field.value.description).toBe('User age')
      })

      it('should parse a number field with enum and default', () => {
        const input = `
field: !number
  name: priority
  enum:
    - 1
    - 2
    - 3
  default: 2
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.enum).toEqual([1, 2, 3])
        expect(result.field.value.default).toBe(2)
      })

      it('should have optional: false by default (required)', () => {
        const input = `
field: !number
  name: quantity
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('quantity')
        expect(result.field.value.optional).toBe(false)
      })

      it('should parse a number field with optional: true', () => {
        const input = `
field: !number
  name: quantity
  optional: true
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('quantity')
        expect(result.field.value.optional).toBe(true)
      })

      it('should parse an optional number field with !number? syntax', () => {
        const input = `
field: !number?
  name: quantity
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('quantity')
        expect(result.field.value.optional).toBe(true)
      })
    })

    describe('!boolean', () => {
      it('should parse a basic boolean field', () => {
        const input = `
field: !boolean
  name: active
  description: Whether the user is active
  default: true
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('active')
        expect(result.field.value.default).toBe(true)
      })

      it('should have optional: false by default (required)', () => {
        const input = `
field: !boolean
  name: confirmed
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('confirmed')
        expect(result.field.value.optional).toBe(false)
      })

      it('should parse a boolean field with optional: true', () => {
        const input = `
field: !boolean
  name: confirmed
  optional: true
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('confirmed')
        expect(result.field.value.optional).toBe(true)
      })

      it('should parse an optional boolean field with !boolean? syntax', () => {
        const input = `
field: !boolean?
  name: confirmed
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('confirmed')
        expect(result.field.value.optional).toBe(true)
      })
    })

    describe('!array', () => {
      it('should parse an array field with string items', () => {
        const input = `
field: !array
  name: tags
  items:
    name: tag
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('tags')
        expect(result.field.value.items.name).toBe('tag')
      })

      it('should substitute array field when field name matches fieldValues key', () => {
        const input = `
field: !array
  name: images
  items:
    name: image_url
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })
        const value = result.field.substitute({
          images: [
            'https://example.com/img1.jpg',
            'https://example.com/img2.jpg',
          ],
        })

        expect(value).toEqual([
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
        ])
      })

      it('should fail to substitute array when field name differs from fieldValues key', () => {
        // @note this documents the mismatch bug: if ArrayField has name 'items' but
        // the user provides values under 'images', substitution throws
        const input = `
field: !array
  name: items
  items:
    name: image_url
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(() =>
          result.field.substitute({ images: ['https://example.com/img.jpg'] })
        ).toThrow("Required field 'items' was not provided")
      })
    })

    describe('!object', () => {
      it('should parse an object field with properties', () => {
        const input = `
field: !object
  name: address
  properties:
    street:
      name: street
    city:
      name: city
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.field.value.name).toBe('address')
        expect(result.field.value.properties.street.name).toBe('street')
        expect(result.field.value.properties.city.name).toBe('city')
      })
    })
  })

  describe('utility tags', () => {
    describe('!concat', () => {
      it('should parse a concat sequence with strings', () => {
        const input = `
url: !concat
  - "https://api.example.com/"
  - "users/"
  - "123"
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.url).toBeInstanceOf(Concat)
        expect(result.url.value).toEqual([
          'https://api.example.com/',
          'users/',
          '123',
        ])
      })

      it('should parse a concat sequence with mixed types', () => {
        const input = `
value: !concat
  - "count: "
  - 42
  - " active: "
  - true
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.value).toBeInstanceOf(Concat)
        expect(result.value.value).toEqual(['count: ', 42, ' active: ', true])
      })

      it('should parse a concat sequence with field references', () => {
        const input = `
url: !concat
  - "https://api.example.com/users/"
  - !string
    name: userId
    description: The user ID
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.url).toBeInstanceOf(Concat)
        expect(result.url.value[0]).toBe('https://api.example.com/users/')
        expect(result.url.value[1].value.name).toBe('userId')
      })

      it('should parse a concat sequence with !reference', () => {
        const input = `
url: !concat
  - "https://api.example.com/"
  - !reference endpoint
  - "/"
  - !reference resourceId
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.url).toBeInstanceOf(Concat)
        expect(result.url.value[0]).toBe('https://api.example.com/')
        expect(result.url.value[1].name).toBe('endpoint')
        expect(result.url.value[2]).toBe('/')
        expect(result.url.value[3].name).toBe('resourceId')
      })

      it('should substitute !reference in concat with provided values', () => {
        const input = `
url: !concat
  - "https://api.example.com/"
  - !reference endpoint
  - "/"
  - !reference resourceId
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        // @note references are passed as the second argument, separate from field values
        const substituted = result.url.substitute(
          {},
          {
            endpoint: 'users',
            resourceId: '123',
          }
        )

        expect(substituted).toBe('https://api.example.com/users/123')
      })

      it('should convert unresolved !reference to placeholder in concat', () => {
        const input = `
url: !concat
  - "https://api.example.com/"
  - !reference endpoint
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        const substituted = result.url.substitute({}, {})

        expect(substituted).toBe('https://api.example.com/${endpoint}')
      })
    })

    describe('!reference', () => {
      it('should parse a basic reference', () => {
        const input = `
ref: !reference myValue
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.ref.name).toBe('myValue')
      })

      it('should parse multiple references', () => {
        const input = `
first: !reference valueA
second: !reference valueB
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.first.name).toBe('valueA')
        expect(result.second.name).toBe('valueB')
      })

      it('should substitute reference with provided value', () => {
        const input = `
ref: !reference userId
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        const substituted = result.ref.substitute({ userId: '12345' })

        expect(substituted).toBe('12345')
      })

      it('should substitute reference with complex value', () => {
        const input = `
ref: !reference config
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        const substituted = result.ref.substitute({
          config: { host: 'localhost', port: 8080 },
        })

        expect(substituted).toEqual({ host: 'localhost', port: 8080 })
      })

      it('should return placeholder when reference value is not provided', () => {
        const input = `
ref: !reference missingValue
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        const substituted = result.ref.substitute({})

        expect(substituted).toBe('${missingValue}')
      })

      it('should convert reference to placeholder format', () => {
        const input = `
ref: !reference myValue
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.ref.toPlaceholder()).toBe('${myValue}')
      })

      it('should handle reference with hyphenated names', () => {
        const input = `
ref: !reference my-value-name
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.ref.name).toBe('my-value-name')

        const substituted = result.ref.substitute({
          'my-value-name': 'resolved',
        })

        expect(substituted).toBe('resolved')
      })

      it('should handle reference with underscored names', () => {
        const input = `
ref: !reference my_value_name
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.ref.name).toBe('my_value_name')
      })
    })
  })

  describe('action tags', () => {
    describe('!fetch', () => {
      it('should parse a basic GET request', () => {
        const input = `
action: !fetch
  url: https://api.example.com/users
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(FetchAction)
        expect(result.action.value.url).toBe('https://api.example.com/users')
      })

      it('should parse a POST request with body', () => {
        const input = `
action: !fetch
  method: POST
  url: https://api.example.com/users
  headers:
    Content-Type: application/json
  body:
    name: John Doe
    email: john@example.com
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.method).toBe('POST')
        expect(result.action.value.headers['Content-Type']).toBe(
          'application/json'
        )
        expect(result.action.value.body.name).toBe('John Doe')
      })

      it('should parse a request with query parameters', () => {
        const input = `
action: !fetch
  url: https://api.example.com/search
  query:
    q: test
    limit: 10
    active: true
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.query.q).toBe('test')
        expect(result.action.value.query.limit).toBe(10)
        expect(result.action.value.query.active).toBe(true)
      })

      it('should parse a request with path segments', () => {
        const input = `
action: !fetch
  url: https://api.example.com
  path:
    - /users
    - /123
    - /profile
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.path).toEqual(['/users', '/123', '/profile'])
      })

      it('should parse a request with options', () => {
        const input = `
action: !fetch
  url: https://api.example.com/data
  options:
    text: true
    format: json
    jsonpath: "$.results[*]"
    rerank: "query text"
    debug: true
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.options.text).toBe(true)
        expect(result.action.value.options.format).toBe('json')
        expect(result.action.value.options.jsonpath).toBe('$.results[*]')
        expect(result.action.value.options.rerank).toBe('query text')
        expect(result.action.value.options.debug).toBe(true)
      })

      it('should parse a request with error detection options', () => {
        const input = `
action: !fetch
  url: https://api.example.com/data
  options:
    error:
      jsonpath: "$.error"
      jmespath: "error_message"
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.options.error.jsonpath).toBe('$.error')
        expect(result.action.value.options.error.jmespath).toBe('error_message')
      })

      it('should parse a fetch action with dynamic URL using !concat', () => {
        const input = `
action: !fetch
  url: !concat
    - "https://api.example.com/users/"
    - !string
      name: userId
      description: The user ID
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(FetchAction)
        expect(result.action.value.url).toBeInstanceOf(Concat)
        expect(result.action.value.url.value[0]).toBe(
          'https://api.example.com/users/'
        )
        expect(result.action.value.url.value[1].value.name).toBe('userId')
      })

      it('should parse a fetch action with dynamic URL using !string field', () => {
        const input = `
action: !fetch
  url: !string
    name: apiEndpoint
    description: The API endpoint URL
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(FetchAction)
        expect(result.action.value.url.value.name).toBe('apiEndpoint')
      })

      it('should parse a fetch action with dynamic header values', () => {
        const input = `
action: !fetch
  url: https://api.example.com
  headers:
    Authorization: !concat
      - "Bearer "
      - !string
        name: token
        description: The API token
    X-Custom: !string
      name: customValue
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(FetchAction)
        expect(result.action.value.headers.Authorization).toBeInstanceOf(Concat)
        expect(result.action.value.headers['X-Custom'].value.name).toBe(
          'customValue'
        )
      })

      it('should parse a fetch action with dynamic query parameters', () => {
        const input = `
action: !fetch
  url: https://api.example.com/search
  query:
    q: !string
      name: searchQuery
      description: The search query
    limit: !number
      name: resultLimit
      default: 10
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(FetchAction)
        expect(result.action.value.query.q.value.name).toBe('searchQuery')
        expect(result.action.value.query.limit.value.name).toBe('resultLimit')
        expect(result.action.value.query.limit.value.default).toBe(10)
      })

      it('should parse a fetch action with dynamic body fields', () => {
        const input = `
action: !fetch
  method: POST
  url: https://api.example.com/users
  body:
    name: !string
      name: userName
    email: !string
      name: userEmail
    age: !number?
      name: userAge
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(FetchAction)
        expect(result.action.value.body.name.value.name).toBe('userName')
        expect(result.action.value.body.name.value.optional).toBe(false)
        expect(result.action.value.body.email.value.optional).toBe(false)
        expect(result.action.value.body.age.value.name).toBe('userAge')
        expect(result.action.value.body.age.value.optional).toBe(true)
      })
    })

    describe('!pack.install', () => {
      it('should parse a pack install action with string abilities', () => {
        const input = `
action: !pack.install
  abilities:
    - fetch-data
    - transform-data
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(PackInstallAction)
        expect(result.action.value.abilities).toEqual([
          'fetch-data',
          'transform-data',
        ])
      })

      it('should parse a pack install action with inline abilities', () => {
        const input = `
action: !pack.install
  abilities:
    - name: custom-ability
      description: A custom ability
      instruction: Do something custom
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.abilities[0].name).toBe('custom-ability')
        expect(result.action.value.abilities[0].description).toBe(
          'A custom ability'
        )
        expect(result.action.value.abilities[0].instruction).toBe(
          'Do something custom'
        )
      })

      it('should parse a pack install action with mixed abilities', () => {
        const input = `
action: !pack.install
  abilities:
    - fetch-data
    - name: inline-ability
      description: Inline ability description
      instruction: Do inline things
    - transform-data
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.abilities).toHaveLength(3)
        expect(result.action.value.abilities[0]).toBe('fetch-data')
        expect(result.action.value.abilities[1].name).toBe('inline-ability')
        expect(result.action.value.abilities[2]).toBe('transform-data')
      })

      it('should parse a pack install action with prefix', () => {
        const input = `
action: !pack.install
  abilities:
    - fetch-data
  prefix: myPrefix
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(PackInstallAction)
        expect(result.action.value.abilities).toEqual(['fetch-data'])
        expect(result.action.value.prefix).toBe('myPrefix')
      })
    })

    describe('!skillset.install', () => {
      it('should parse a skillset install action', () => {
        const input = `
action: !skillset.install
  skillsetId: my-skillset-id
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(SkillsetInstallAction)
        expect(result.action.value.skillsetId).toBe('my-skillset-id')
      })

      it('should parse a skillset install action with prefix', () => {
        const input = `
action: !skillset.install
  skillsetId: my-skillset-id
  prefix: custom-prefix
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.skillsetId).toBe('my-skillset-id')
        expect(result.action.value.prefix).toBe('custom-prefix')
      })
    })

    describe('!mcp.install', () => {
      it('should parse a basic mcp install action', () => {
        const input = `
action: !mcp.install
  url: https://mcp.example.com/server
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action).toBeInstanceOf(McpInstallAction)
        expect(result.action.value.url).toBe('https://mcp.example.com/server')
      })

      it('should parse an mcp install action with headers', () => {
        const input = `
action: !mcp.install
  url: https://mcp.example.com/server
  headers:
    Authorization: Bearer token123
    X-Custom-Header: custom-value
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.headers.Authorization).toBe(
          'Bearer token123'
        )
        expect(result.action.value.headers['X-Custom-Header']).toBe(
          'custom-value'
        )
      })

      it('should parse an mcp install action with tools as array', () => {
        const input = `
action: !mcp.install
  url: https://mcp.example.com/server
  tools:
    - tool1
    - tool2
    - tool3
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.tools).toEqual(['tool1', 'tool2', 'tool3'])
      })

      it('should parse an mcp install action with tools as string', () => {
        const input = `
action: !mcp.install
  url: https://mcp.example.com/server
  tools: tool1,tool2,tool3
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.tools).toBe('tool1,tool2,tool3')
      })

      it('should parse an mcp install action with prefix', () => {
        const input = `
action: !mcp.install
  url: https://mcp.example.com/server
  prefix: mcp-tools
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.prefix).toBe('mcp-tools')
      })
    })
  })

  describe('complex scenarios', () => {
    it('should parse a document with multiple field types', () => {
      const input = `
fields:
  name: !string
    name: name
    description: User name
  age: !number?
    name: age
    default: 18
  active: !boolean
    name: active
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.fields.name.value.name).toBe('name')
      expect(result.fields.name.value.optional).toBe(false)
      expect(result.fields.age.value.default).toBe(18)
      expect(result.fields.age.value.optional).toBe(true)
      expect(result.fields.active.value.optional).toBe(false)
    })

    it('should parse nested objects with field tags', () => {
      const input = `
config:
  request:
    url: !concat
      - "https://api.example.com/"
      - !string
        name: endpoint
    method: GET
  params:
    search: !string
      name: query
      description: Search query
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.config.request.url).toBeInstanceOf(Concat)
      expect(result.config.request.method).toBe('GET')
      expect(result.config.params.search.value.name).toBe('query')
      expect(result.config.params.search.value.optional).toBe(false)
    })

    it('should handle multiline strings in field descriptions', () => {
      const input = `
field: !string
  name: notes
  description: |
    This is a multiline description.
    It spans multiple lines.
    And has various details.
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.field.value.description).toContain(
        'This is a multiline description.'
      )
      expect(result.field.value.description).toContain('It spans multiple')
    })
  })

  describe('serialization (round-trip)', () => {
    it('should round-trip a string field', () => {
      const input = `
field: !string
  name: test
  description: Test field
`
      const parsed = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })
      const serialized = yaml.dump(parsed, { schema: ACTION_TAGS_SCHEMA })
      const reparsed = yaml.load(serialized, { schema: ACTION_TAGS_SCHEMA })

      expect(reparsed.field.value.name).toBe('test')
      expect(reparsed.field.value.description).toBe('Test field')
    })

    it('should round-trip a fetch action', () => {
      const input = `
action: !fetch
  method: POST
  url: https://api.example.com/data
  headers:
    Content-Type: application/json
`
      const parsed = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })
      const serialized = yaml.dump(parsed, { schema: ACTION_TAGS_SCHEMA })
      const reparsed = yaml.load(serialized, { schema: ACTION_TAGS_SCHEMA })

      expect(reparsed.action.value.method).toBe('POST')
      expect(reparsed.action.value.url).toBe('https://api.example.com/data')
    })
  })

  describe('error handling', () => {
    it('should reject a string field without name', () => {
      const input = `
field: !string
  description: No name field
`

      expect(() => yaml.load(input, { schema: ACTION_TAGS_SCHEMA })).toThrow()
    })

    it('should reject a fetch action without url', () => {
      const input = `
action: !fetch
  method: GET
`

      expect(() => yaml.load(input, { schema: ACTION_TAGS_SCHEMA })).toThrow()
    })

    it('should reject a pack.install action without abilities', () => {
      const input = `
action: !pack.install
  prefix: some-prefix
`

      expect(() => yaml.load(input, { schema: ACTION_TAGS_SCHEMA })).toThrow()
    })

    it('should reject an mcp.install action without url', () => {
      const input = `
action: !mcp.install
  prefix: some-prefix
`

      expect(() => yaml.load(input, { schema: ACTION_TAGS_SCHEMA })).toThrow()
    })

    // @note URL format validation is not enforced at parse time since the URL
    // can be dynamic (e.g., !string { name: urlField }). Validation happens at
    // execution time when the dynamic values are resolved.

    it('should reject a skillset.install action without skillsetId', () => {
      const input = `
action: !skillset.install
  prefix: some-prefix
`

      expect(() => yaml.load(input, { schema: ACTION_TAGS_SCHEMA })).toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle empty enum arrays', () => {
      const input = `
field: !string
  name: test
  enum: []
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.field.value.enum).toEqual([])
    })

    it('should handle special characters in string values', () => {
      const input = `
field: !string
  name: query
  default: "hello & world <test>"
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.field.value.default).toBe('hello & world <test>')
    })

    it('should handle URL with query parameters in fetch', () => {
      const input = `
action: !fetch
  url: "https://api.example.com/search?q=test&limit=10"
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.action.value.url).toBe(
        'https://api.example.com/search?q=test&limit=10'
      )
    })

    it('should handle numeric header values', () => {
      const input = `
action: !fetch
  url: https://api.example.com
  headers:
    X-Request-Id: 12345
    X-Retry-Count: 3
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.action.value.headers['X-Request-Id']).toBe(12345)
      expect(result.action.value.headers['X-Retry-Count']).toBe(3)
    })

    it('should handle boolean header values', () => {
      const input = `
action: !fetch
  url: https://api.example.com
  headers:
    X-Debug: true
    X-Cache: false
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.action.value.headers['X-Debug']).toBe(true)
      expect(result.action.value.headers['X-Cache']).toBe(false)
    })

    it('should handle fetch body as string', () => {
      const input = `
action: !fetch
  method: POST
  url: https://api.example.com/data
  body: "raw string body content"
`
      const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

      expect(result.action.value.body).toBe('raw string body content')
    })

    it('should handle fetch with all HTTP methods', () => {
      const methods = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'OPTIONS',
      ]

      for (const method of methods) {
        const input = `
action: !fetch
  method: ${method}
  url: https://api.example.com
`
        const result = yaml.load(input, { schema: ACTION_TAGS_SCHEMA })

        expect(result.action.value.method).toBe(method)
      }
    })
  })

  describe('parse functions', () => {
    describe('parse', () => {
      it('should parse valid YAML with action tags', () => {
        const input = `
action: !fetch
  url: https://api.example.com
`
        const result = parse(input)

        expect(result.action).toBeInstanceOf(FetchAction)
        expect(result.action.value.url).toBe('https://api.example.com')
      })

      it('should throw on invalid YAML', () => {
        const input = `
action: !fetch
  url
  invalid: yaml: syntax
`

        expect(() => parse(input)).toThrow()
      })

      it('should throw on invalid action tag schema', () => {
        const input = `
action: !fetch
  method: INVALID_METHOD
  url: https://api.example.com
`

        expect(() => parse(input)).toThrow()
      })

      it('should parse valid time action tags', () => {
        const nowInput = `
action: !time.now
  timezone: UTC
  format: iso
`

        const nowResult = parse(nowInput)

        expect(nowResult.action).toBeInstanceOf(TimeNowAction)
        expect(nowResult.action.value.timezone).toBe('UTC')
        expect(nowResult.action.value.format).toBe('iso')
      })
    })

    describe('tryParse', () => {
      it('should return parsed result for valid YAML', () => {
        const input = `
field: !string
  name: testField
`
        const result = tryParse(input)

        expect(result).not.toBeNull()
        expect(result.field.value.name).toBe('testField')
      })

      it('should return null for invalid YAML', () => {
        const input = `
action: !fetch
  url
  invalid: yaml: syntax
`
        const result = tryParse(input)

        expect(result).toBeNull()
      })

      it('should return null for invalid schema', () => {
        const input = `
action: !string
  invalidProperty: true
`
        const result = tryParse(input)

        expect(result).toBeNull()
      })
    })

    describe('extractFields', () => {
      it('should extract string fields from parsed YAML', () => {
        const input = `
username: !string?
  name: username
  description: The username
email: !string
  name: email
`
        const fields = extractFields(input)

        expect(fields).toHaveLength(2)
        expect(fields[0].name).toBe('username')
        expect(fields[0].optional).toBe(true)
        expect(fields[1].name).toBe('email')
        expect(fields[1].optional).toBe(false)
      })

      it('should extract number fields', () => {
        const input = `
age: !number
  name: age
  default: 18
count: !number
  name: count
  required: true
`
        const fields = extractFields(input)

        expect(fields).toHaveLength(2)
        expect(fields[0].name).toBe('age')
        expect(fields[0].default).toBe(18)
        expect(fields[1].name).toBe('count')
      })

      it('should extract boolean fields', () => {
        const input = `
active: !boolean
  name: active
  default: true
enabled: !boolean
  name: enabled
`
        const fields = extractFields(input)

        expect(fields).toHaveLength(2)
        expect(fields[0].name).toBe('active')
        expect(fields[0].default).toBe(true)
      })

      it('should extract array fields', () => {
        const input = `
tags: !array
  name: tags
  items:
    name: tag
`
        const fields = extractFields(input)

        expect(fields).toHaveLength(1)
        expect(fields[0].name).toBe('tags')
      })

      it('should extract object fields', () => {
        const input = `
config: !object
  name: config
  properties:
    key:
      name: key
`
        const fields = extractFields(input)

        expect(fields).toHaveLength(1)
        expect(fields[0].name).toBe('config')
      })

      it('should extract mixed field types', () => {
        const input = `
name: !string
  name: name
age: !number
  name: age
active: !boolean
  name: active
`
        const fields = extractFields(input)

        expect(fields).toHaveLength(3)
        expect(fields.map((f) => f.name)).toEqual(['name', 'age', 'active'])
      })

      it('should return empty array for invalid YAML', () => {
        const input = `invalid: yaml: syntax`
        const fields = extractFields(input)

        expect(fields).toEqual([])
      })

      it('should return empty array for non-object result', () => {
        const input = `just a plain string`
        const fields = extractFields(input)

        expect(fields).toEqual([])
      })

      it('should return empty array for null input result', () => {
        const input = `null`
        const fields = extractFields(input)

        expect(fields).toEqual([])
      })

      it('should skip non-field values', () => {
        const input = `
name: !string
  name: name
regularValue: "just a string"
number: 42
`
        const fields = extractFields(input)

        expect(fields).toHaveLength(1)
        expect(fields[0].name).toBe('name')
      })

      it('should extract fields from nested action tags', () => {
        const input = `
action: !fetch
  url: !string
    name: apiUrl
`
        const fields = extractFields(input)

        // @note extractFields recursively traverses action tags to find fields
        expect(fields).toHaveLength(1)
        expect(fields[0].name).toBe('apiUrl')
      })
    })

    // @note toTextAction tests removed - method was deprecated in favor of toActionResult

    describe('toActionResult', () => {
      it('BotBackstoryWriteAction should use content key in YAML to avoid routing segment collision', () => {
        // @note regression for payload keys that collide with routing segments
        // The operation 'backstory/write' is split into segment params:
        //   params['backstory'] = true, params['write'] = true
        // If the payload field were also named 'backstory', getConfig would merge
        // params['backstory'] = true on top of the YAML-parsed string, causing
        // "Expected string, received boolean at backstory".
        //
        // Fix: payload field is named 'content' (same convention as spaceStorageWriteSchema)
        // so params['backstory'] = true does not collide with the actual data field.
        const { BotBackstoryWriteAction } = require('@/lib/action.tags')

        const action = new BotBackstoryWriteAction({
          content: 'You are a helpful assistant.',
        })

        const result = action.toActionResult()

        // Routing segment params are present (intentional - used by dispatch)
        expect(result.params['backstory/write']).toBe(true)
        expect(result.params['backstory']).toBe(true)
        expect(result.params['write']).toBe(true)

        // YAML text uses 'content:' - no collision with params['backstory'] = true
        expect(result.text).toContain('content:')
        expect(result.text).not.toContain('backstory:')
      })
    })

    describe('action substitute', () => {
      it('should substitute string fields in FetchTag', () => {
        const input = `
action: !fetch
  url: !string
    name: apiUrl
`
        const result = parse(input)
        const substituted = result.action.substitute({
          apiUrl: 'https://substituted.api.com',
        })

        expect(substituted).toBeInstanceOf(FetchAction)
        expect(substituted.value.url).toBe('https://substituted.api.com')
      })

      it('should substitute multiple fields in FetchTag body', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/search
  body:
    query: !string
      name: searchQuery
    limit: !number
      name: searchLimit
      default: 10
`
        const result = parse(input)
        const substituted = result.action.substitute({
          searchQuery: 'cats and dogs',
          searchLimit: 25,
        })

        expect(substituted.value.body.query).toBe('cats and dogs')
        expect(substituted.value.body.limit).toBe(25)
      })

      it('should use default values when field not provided', () => {
        const input = `
action: !fetch
  url: /api/items
  query:
    limit: !number
      name: limit
      default: 50
`
        const result = parse(input)
        const substituted = result.action.substitute({})

        expect(substituted.value.query.limit).toBe(50)
      })

      it('should substitute fields in PackInstallTag', () => {
        const input = `
action: !pack.install
  abilities:
    - !string
      name: abilityName
`
        const result = parse(input)
        const substituted = result.action.substitute({
          abilityName: 'search-docs',
        })

        expect(substituted).toBeInstanceOf(PackInstallAction)
        expect(substituted.value.abilities[0]).toBe('search-docs')
      })

      it('should substitute fields in SkillsetInstallTag', () => {
        const input = `
action: !skillset.install
  skillsetId: !string
    name: skillset
  prefix: !string
    name: skillsetPrefix
    default: default
`
        const result = parse(input)
        const substituted = result.action.substitute({
          skillset: 'google-calendar',
          skillsetPrefix: 'gcal',
        })

        expect(substituted).toBeInstanceOf(SkillsetInstallAction)
        expect(substituted.value.skillsetId).toBe('google-calendar')
        expect(substituted.value.prefix).toBe('gcal')
      })

      it('should substitute fields in McpInstallTag', () => {
        const input = `
action: !mcp.install
  url: !string
    name: mcpUrl
  prefix: !string
    name: mcpPrefix
`
        const result = parse(input)
        const substituted = result.action.substitute({
          mcpUrl: 'https://mcp.example.com',
          mcpPrefix: 'mcp1',
        })

        expect(substituted).toBeInstanceOf(McpInstallAction)
        expect(substituted.value.url).toBe('https://mcp.example.com')
        expect(substituted.value.prefix).toBe('mcp1')
      })

      it('should preserve static values during substitution', () => {
        const input = `
action: !fetch
  method: GET
  url: !string
    name: endpoint
  headers:
    Authorization: Bearer static-token
`
        const result = parse(input)
        const substituted = result.action.substitute({
          endpoint: '/api/users',
        })

        expect(substituted.value.method).toBe('GET')
        expect(substituted.value.url).toBe('/api/users')
        expect(substituted.value.headers.Authorization).toBe(
          'Bearer static-token'
        )
      })

      it('should substitute object headers and top-level authorization in FetchTag', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  headers: !object
    name: headers
    optional: true
    properties: {}
  authorization: !reference SECRET_DEFAULT
  body:
    name: !string
      name: userName
`
        const result = parse(input)
        const substituted = result.action.substitute({
          headers: {
            'Content-Type': 'application/json',
            'X-Trace-ID': 'trace-123',
          },
          userName: 'Ada',
        })

        expect(substituted).toBeInstanceOf(FetchAction)
        expect(substituted.value.headers).toEqual({
          'Content-Type': 'application/json',
          'X-Trace-ID': 'trace-123',
        })
        expect(substituted.value.contentType).toBeUndefined()
        expect(substituted.value.authorization).toBe('${SECRET_DEFAULT}')
        expect(substituted.value.body.name).toBe('Ada')
      })

      it('should substitute !array values in !image.edit using the field name', () => {
        // @note ArrayField.substitute(fieldValues) looks up fieldValues[field.name]
        // the field name must match the key used in fieldValues for substitution to work
        const input = `!image.edit
prompt: !string
  name: prompt
images: !array
  name: images
  optional: false
  items:
    name: image_url
model: test-model
`
        const result = substituteAndTransform(input, {
          prompt: 'dress the lion',
          images: ['https://example.com/lion.jpg'],
        })

        expect(result).not.toBeNull()
        expect(result.action).toBe('image')
        expect(result.text).toContain('https://example.com/lion.jpg')
      })

      it('should throw when !array field name differs from fieldValues key in !image.edit', () => {
        // @note this documents the bug where ability.template.ts processValue() generates
        // ArrayField with name: 'items' (default) instead of the YAML key ('images'),
        // causing substitute() to look for fieldValues['items'] but user provides
        // fieldValues['images']
        const input = `!image.edit
prompt: !string
  name: prompt
images: !array
  name: items
  optional: false
  items:
    name: image_url
model: test-model
`

        expect(() =>
          substituteAndTransform(input, {
            prompt: 'dress the lion',
            images: ['https://example.com/lion.jpg'],
          })
        ).toThrow("Required field 'items' was not provided")
      })

      it('should handle concat tags during substitution', () => {
        const input = `
action: !fetch
  url: !concat
    - /api/
    - !string
        name: resource
    - /
    - !string
        name: id
`
        const result = parse(input)
        const substituted = result.action.substitute({
          resource: 'users',
          id: '123',
        })

        expect(substituted.value.url).toBe('/api/users/123')
      })

      it('should preserve ObjectField in !task.list meta after parsing', () => {
        const input = `!task.list
'@scope': user
botId: !string
  name: botId
  description: bot ID
  optional: false
meta: !object
  name: meta
  description: optional metadata filter
  optional: true
  properties: {}
`
        const result = tryParse(input)

        expect(result).not.toBeNull()
        expect(result.value.meta).toBeInstanceOf(ObjectField)
      })

      it('should omit optional !object meta from !task.list when not provided', () => {
        const input = `!task.list
'@scope': user
botId: !string
  name: botId
  description: bot ID
  optional: false
meta: !object
  name: meta
  description: optional metadata filter
  optional: true
  properties: {}
`
        const result = substituteAndTransform(input, { botId: 'bot-123' }, {})

        expect(result).not.toBeNull()
        expect(result.action).toBe('task')
        expect(result.params).toEqual({ list: true })
        expect(result.text).not.toContain('name:')
        expect(result.text).not.toContain('description:')
        expect(result.text).not.toContain('properties')
        expect(result.text).toContain('bot-123')
      })

      it('should pass through !object meta value in !task.list when provided', () => {
        const input = `!task.list
'@scope': user
botId: !string
  name: botId
  description: bot ID
  optional: false
meta: !object
  name: meta
  description: optional metadata filter
  optional: true
  properties: {}
`
        const result = substituteAndTransform(
          input,
          { botId: 'bot-123', meta: { status: 'completed' } },
          {}
        )

        expect(result).not.toBeNull()
        expect(result.text).toContain('completed')
        expect(result.text).not.toContain('description:')
      })

      it('should omit optional !object meta from !task.create when not provided', () => {
        const input = `!task.create
'@scope': user
name: !string
  name: name
  description: task name
  optional: false
meta: !object
  name: meta
  description: optional metadata
  optional: true
  properties: {}
`
        const result = substituteAndTransform(input, { name: 'my-task' }, {})

        expect(result).not.toBeNull()
        expect(result.action).toBe('task')
        expect(result.params).toEqual({ create: true })
        expect(result.text).not.toContain('properties')
      })
    })

    describe('field substitute', () => {
      it('should substitute StringField with provided value', () => {
        const input = `
field: !string
  name: testField
  default: fallback
`
        const result = parse(input)
        const value = result.field.substitute({ testField: 'provided value' })

        expect(value).toBe('provided value')
      })

      it('should return default when field not provided', () => {
        const input = `
field: !string
  name: testField
  default: fallback
`
        const result = parse(input)
        const value = result.field.substitute({})

        expect(value).toBe('fallback')
      })

      it('should throw error when required field not provided and has no default', () => {
        const input = `
field: !string
  name: testField
`
        const result = parse(input)

        expect(() => result.field.substitute({})).toThrow(
          "Required field 'testField' was not provided"
        )
      })

      it('should substitute NumberField with provided value', () => {
        const input = `
field: !number
  name: count
  default: 10
`
        const result = parse(input)
        const value = result.field.substitute({ count: 42 })

        expect(value).toBe(42)
      })

      it('should return number default when not provided', () => {
        const input = `
field: !number
  name: count
  default: 10
`
        const result = parse(input)
        const value = result.field.substitute({})

        expect(value).toBe(10)
      })

      it('should throw error when required number field not provided and has no default', () => {
        const input = `
field: !number
  name: count
`
        const result = parse(input)

        expect(() => result.field.substitute({})).toThrow(
          "Required field 'count' was not provided"
        )
      })

      it('should substitute BooleanField with provided value', () => {
        const input = `
field: !boolean
  name: enabled
  default: false
`
        const result = parse(input)
        const value = result.field.substitute({ enabled: true })

        expect(value).toBe(true)
      })

      it('should return boolean default when not provided', () => {
        const input = `
field: !boolean
  name: enabled
  default: true
`
        const result = parse(input)
        const value = result.field.substitute({})

        expect(value).toBe(true)
      })

      it('should throw error when required boolean field not provided and has no default', () => {
        const input = `
field: !boolean
  name: enabled
`
        const result = parse(input)

        expect(() => result.field.substitute({})).toThrow(
          "Required field 'enabled' was not provided"
        )
      })

      // @note tests for null value handling - null should be treated as "not provided"
      describe('null value handling', () => {
        it('should treat null as not provided for StringField and use default', () => {
          const input = `
field: !string
  name: testField
  default: fallback
`
          const result = parse(input)
          const value = result.field.substitute({ testField: null })

          expect(value).toBe('fallback')
        })

        it('should treat null as not provided for StringField and throw for required field', () => {
          const input = `
field: !string
  name: testField
`
          const result = parse(input)

          expect(() => result.field.substitute({ testField: null })).toThrow(
            "Required field 'testField' was not provided"
          )
        })

        it('should treat null as not provided for NumberField and use default', () => {
          const input = `
field: !number
  name: count
  default: 10
`
          const result = parse(input)
          const value = result.field.substitute({ count: null })

          expect(value).toBe(10)
        })

        it('should treat null as not provided for NumberField and throw for required field', () => {
          const input = `
field: !number
  name: count
`
          const result = parse(input)

          expect(() => result.field.substitute({ count: null })).toThrow(
            "Required field 'count' was not provided"
          )
        })

        it('should treat null as not provided for BooleanField and use default', () => {
          const input = `
field: !boolean
  name: enabled
  default: true
`
          const result = parse(input)
          const value = result.field.substitute({ enabled: null })

          expect(value).toBe(true)
        })

        it('should treat null as not provided for BooleanField and throw for required field', () => {
          const input = `
field: !boolean
  name: enabled
`
          const result = parse(input)

          expect(() => result.field.substitute({ enabled: null })).toThrow(
            "Required field 'enabled' was not provided"
          )
        })
      })
    })

    // @note substitute and toTextAction integration tests removed - toTextAction was deprecated

    describe('isActionTag', () => {
      it('should return true for FetchAction', () => {
        const input = `
action: !fetch
  url: https://api.example.com
`
        const result = parse(input)

        expect(isActionTag(result.action)).toBe(true)
      })

      it('should return true for PackInstallAction', () => {
        const input = `
action: !pack.install
  abilities:
    - ability1
`
        const result = parse(input)

        expect(isActionTag(result.action)).toBe(true)
      })

      it('should return true for SkillsetInstallAction', () => {
        const input = `
action: !skillset.install
  skillsetId: my-skillset
`
        const result = parse(input)

        expect(isActionTag(result.action)).toBe(true)
      })

      it('should return true for McpInstallAction', () => {
        const input = `
action: !mcp.install
  url: https://mcp.example.com
`
        const result = parse(input)

        expect(isActionTag(result.action)).toBe(true)
      })

      it('should return false for plain objects', () => {
        expect(isActionTag({ url: 'https://example.com' })).toBe(false)
      })

      it('should return false for strings', () => {
        expect(isActionTag('fetch')).toBe(false)
      })

      it('should return false for null', () => {
        expect(isActionTag(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isActionTag(undefined)).toBe(false)
      })

      it('should return false for Concat', () => {
        const input = `
value: !concat
  - "hello"
  - " world"
`
        const result = parse(input)

        expect(isActionTag(result.value)).toBe(false)
      })

      it('should return false for field tags', () => {
        const input = `
field: !string
  name: test
`
        const result = parse(input)

        expect(isActionTag(result.field)).toBe(false)
      })
    })

    describe('substituteFields', () => {
      it('should substitute fields in a simple YAML structure', () => {
        const input = `
name: !string
  name: userName
age: !number
  name: userAge
`
        const result = substituteFields(input, {
          userName: 'John',
          userAge: 30,
        })

        expect(result).toContain('name: "John"')
        expect(result).toContain('age: 30')
      })

      it('should return original input for invalid YAML', () => {
        const input = 'invalid: yaml: syntax'

        const result = substituteFields(input, { test: 'value' })

        expect(result).toBe(input)
      })

      it('should return plain YAML for FetchAction', () => {
        const input = `
!fetch
  url: !concat
    - https://api.example.com/
    - !string
        name: endpoint
`
        const result = substituteFields(input, { endpoint: 'users' })

        // @note substituteFields now returns plain YAML, not text action format
        expect(result).toContain('url: "https://api.example.com/users"')
        expect(result).not.toContain('```')
      })

      it('should return plain YAML for PackInstallAction', () => {
        const input = `
!pack.install
  abilities:
    - !string
      name: abilityName
`
        const result = substituteFields(input, {
          abilityName: 'search-docs',
        })

        // @note substituteFields now returns plain YAML, not text action format
        expect(result).toContain('search-docs')
        expect(result).not.toContain('```')
      })

      it('should return plain YAML for SkillsetInstallAction', () => {
        const input = `
!skillset.install
  skillsetId: !string
    name: skillset
`
        const result = substituteFields(input, { skillset: 'google-calendar' })

        // @note substituteFields now returns plain YAML, not text action format
        expect(result).toContain('skillsetId: "google-calendar"')
        expect(result).not.toContain('```')
      })

      it('should return plain YAML for McpInstallAction', () => {
        const input = `
!mcp.install
  url: !string
    name: mcpUrl
`
        const result = substituteFields(input, {
          mcpUrl: 'https://mcp.example.com',
        })

        // @note substituteFields now returns plain YAML, not text action format
        expect(result).toContain('url: "https://mcp.example.com"')
        expect(result).not.toContain('```')
      })

      it('should handle object with action tag as value', () => {
        const input = `
action: !fetch
  url: !string
    name: apiUrl
`
        const result = substituteFields(input, {
          apiUrl: 'https://api.example.com',
        })

        // @note substituteFields now returns plain YAML, not text action format
        expect(result).toContain('action:')
        expect(result).toContain('url: "https://api.example.com"')
        expect(result).not.toContain('```')
      })

      it('should use default values for missing fields', () => {
        const input = `
count: !number
  name: count
  default: 10
`
        const result = substituteFields(input, {})

        expect(result).toContain('count: 10')
      })

      it('should handle nested field substitution', () => {
        const input = `
config:
  host: !string
    name: host
  port: !number
    name: port
    default: 8080
`
        const result = substituteFields(input, { host: 'localhost' })

        expect(result).toContain('host: "localhost"')
        expect(result).toContain('port: 8080')
      })

      it('should handle concat substitution', () => {
        const input = `
url: !concat
  - https://
  - !string
      name: domain
  - /api
`
        const result = substituteFields(input, { domain: 'example.com' })

        expect(result).toContain('url: "https://example.com/api"')
      })

      it('should handle reference substitution with referenceValues', () => {
        const input = `
value: !reference configValue
`
        // @note references use the 3rd parameter, not fieldValues

        const result = substituteFields(input, {}, { configValue: 'resolved' })

        expect(result).toContain('value: "resolved"')
      })

      it('should convert unresolved reference to placeholder', () => {
        const input = `
value: !reference unresolvedRef
`
        const result = substituteFields(input, {}, {})

        expect(result).toContain('value: "${unresolvedRef}"')
      })

      it('should handle mixed fields and references', () => {
        const input = `
url: !concat
  - !string
      name: baseUrl
  - "/"
  - !reference resourcePath
`
        const result = substituteFields(
          input,
          { baseUrl: 'https://api.example.com' },
          { resourcePath: 'users/123' }
        )

        expect(result).toContain('url: "https://api.example.com/users/123"')
      })

      it('should keep fields and references separate', () => {
        const input = `
url: !concat
  - !string
      name: host
  - "/"
  - !reference path
`
        // @note passing 'path' as a field should not substitute the reference
        const result = substituteFields(
          input,
          { host: 'example.com', path: 'wrong' },
          {}
        )

        expect(result).toContain('url: "example.com/${path}"')
      })
    })

    describe('required and optional field behavior', () => {
      it('should throw error when required string field is not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
`
        const result = parse(input)

        expect(() => result.action.substitute({})).toThrow(
          "Required field 'userName' was not provided"
        )
      })

      it('should throw error when required number field is not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    age: !number
      name: userAge
`
        const result = parse(input)

        expect(() => result.action.substitute({})).toThrow(
          "Required field 'userAge' was not provided"
        )
      })

      it('should throw error when required boolean field is not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    active: !boolean
      name: isActive
`
        const result = parse(input)

        expect(() => result.action.substitute({})).toThrow(
          "Required field 'isActive' was not provided"
        )
      })

      it('should throw error when required array field is not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    tags: !array
      name: userTags
      items:
        name: tag
`
        const result = parse(input)

        expect(() => result.action.substitute({})).toThrow(
          "Required field 'userTags' was not provided"
        )
      })

      it('should throw error when required object field is not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    metadata: !object
      name: userMetadata
      properties:
        key:
          name: key
`
        const result = parse(input)

        expect(() => result.action.substitute({})).toThrow(
          "Required field 'userMetadata' was not provided"
        )
      })

      it('should omit optional string field when not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    nickname: !string?
      name: userNickname
`
        const result = parse(input)
        const substituted = result.action.substitute({ userName: 'John' })

        expect(substituted.value.body).toEqual({ name: 'John' })
        expect(substituted.value.body.nickname).toBeUndefined()
      })

      it('should omit optional number field when not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    age: !number?
      name: userAge
`
        const result = parse(input)
        const substituted = result.action.substitute({ userName: 'John' })

        expect(substituted.value.body).toEqual({ name: 'John' })
        expect(substituted.value.body.age).toBeUndefined()
      })

      it('should omit optional boolean field when not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    active: !boolean?
      name: isActive
`
        const result = parse(input)
        const substituted = result.action.substitute({ userName: 'John' })

        expect(substituted.value.body).toEqual({ name: 'John' })
        expect(substituted.value.body.active).toBeUndefined()
      })

      it('should use default for optional field when not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    active: !boolean?
      name: isActive
      default: true
`
        const result = parse(input)
        const substituted = result.action.substitute({ userName: 'John' })

        expect(substituted.value.body).toEqual({ name: 'John', active: true })
      })

      it('should use default for required field with default when not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    role: !string
      name: userRole
      default: guest
`
        const result = parse(input)
        const substituted = result.action.substitute({ userName: 'John' })

        expect(substituted.value.body).toEqual({ name: 'John', role: 'guest' })
      })

      it('should handle mixed required and optional fields', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    age: !number?
      name: userAge
    email: !string
      name: userEmail
    active: !boolean?
      name: isActive
      default: false
`
        const result = parse(input)
        const substituted = result.action.substitute({
          userName: 'John',
          userEmail: 'john@example.com',
        })

        expect(substituted.value.body).toEqual({
          name: 'John',
          email: 'john@example.com',
          active: false,
        })
      })

      it('should include optional field when value is provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    age: !number?
      name: userAge
`
        const result = parse(input)
        const substituted = result.action.substitute({
          userName: 'John',
          userAge: 30,
        })

        expect(substituted.value.body).toEqual({ name: 'John', age: 30 })
      })

      it('should omit optional array field when not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    tags: !array?
      name: userTags
      items:
        name: tag
`
        const result = parse(input)
        const substituted = result.action.substitute({ userName: 'John' })

        expect(substituted.value.body).toEqual({ name: 'John' })
        expect(substituted.value.body.tags).toBeUndefined()
      })

      it('should omit optional object field when not provided', () => {
        const input = `
action: !fetch
  method: POST
  url: /api/users
  body:
    name: !string
      name: userName
    metadata: !object?
      name: userMetadata
      properties:
        key:
          name: key
`
        const result = parse(input)
        const substituted = result.action.substitute({ userName: 'John' })

        expect(substituted.value.body).toEqual({ name: 'John' })
        expect(substituted.value.body.metadata).toBeUndefined()
      })
    })
  })

  /**
   * Action class registration verification tests.
   *
   * These tests ensure that all action classes in ACTION_CLASSES are properly
   * registered and have the required methods. This prevents the bug where
   * an action class is defined but not added to all required registries.
   */
  describe('action class registration verification', () => {
    describe('ACTION_CLASSES registry', () => {
      it('should contain at least one action class', () => {
        expect(ACTION_CLASSES.length).toBeGreaterThan(0)
      })

      it('should only contain classes that extend BaseAction', () => {
        for (const ActionClass of ACTION_CLASSES) {
          expect(typeof ActionClass).toBe('function')
          expect(ActionClass.name).toMatch(/Action$/)
        }
      })
    })

    describe('isActionTag integration', () => {
      // @note create minimal valid instances for each action class
      const createMinimalInstance = (ActionClass) => {
        const className = ActionClass.name

        // Provide minimal valid values for each action type
        switch (className) {
          case 'FetchAction':
            return new ActionClass({ url: 'https://example.com' })
          case 'SkillsetInstallAction':
            return new ActionClass({ skillsetId: 'test-id' })
          case 'SkillsetUninstallAction':
            return new ActionClass({ skillsetId: 'test-id' })
          case 'McpInstallAction':
            return new ActionClass({ mcpId: 'test-id' })
          case 'McpUninstallAction':
            return new ActionClass({ url: 'https://example.com' })
          case 'PackInstallAction':
            return new ActionClass({
              abilities: ['test-ability'],
            })
          case 'PackUninstallAction':
            return new ActionClass({
              abilities: ['test-ability'],
            })
          case 'TaskListAction':
            return new ActionClass({})
          case 'TaskFetchAction':
            return new ActionClass({ id: 'test-id' })
          case 'TaskCreateAction':
            return new ActionClass({ name: 'test', schedule: '* * * * *' })
          case 'TaskUpdateAction':
            return new ActionClass({ id: 'test-id' })
          case 'TaskDeleteAction':
            return new ActionClass({ id: 'test-id' })
          case 'TaskRunAction':
            return new ActionClass({ id: 'test-id' })
          case 'TimeNowAction':
            return new ActionClass({ timezone: 'UTC', format: 'iso' })
          case 'RatingListAction':
            return new ActionClass({ '@scope': 'user' })
          case 'RatingFetchAction':
            return new ActionClass({ '@scope': 'user', ratingId: 'test-id' })
          case 'RatingCreateAction':
            return new ActionClass({ '@scope': 'user', value: 5 })
          case 'RatingDeleteAction':
            return new ActionClass({ '@scope': 'user', ratingId: 'test-id' })
          case 'FileReadAction':
            return new ActionClass({ fileId: 'test-id' })
          case 'FileWriteAction':
            return new ActionClass({ fileId: 'test-id', contents: 'test' })
          case 'FilePrependAction':
            return new ActionClass({ fileId: 'test-id', contents: 'test' })
          case 'FileAppendAction':
            return new ActionClass({ fileId: 'test-id', contents: 'test' })
          case 'FileReplaceAction':
            return new ActionClass({
              fileId: 'test-id',
              search: 'a',
              replace: 'b',
            })
          case 'FileRwAction':
            return new ActionClass({ fileId: 'test-id', mode: 'read' })
          case 'MemoryListAction':
            return new ActionClass({})
          case 'MemorySearchAction':
            return new ActionClass({ query: 'test' })
          case 'MemoryCreateAction':
            return new ActionClass({ content: 'test' })
          case 'MemoryUpdateAction':
            return new ActionClass({ id: 'test-id' })
          case 'MemoryDeleteAction':
            return new ActionClass({ id: 'test-id' })
          case 'ConversationListAction':
            return new ActionClass({})
          case 'ConversationFetchAction':
            return new ActionClass({ id: 'test-id' })
          case 'ConversationSearchAction':
            return new ActionClass({ query: 'test' })
          case 'SpaceListAction':
            return new ActionClass({})
          case 'SpaceFetchAction':
            return new ActionClass({ id: 'test-id' })
          case 'SpaceCreateAction':
            return new ActionClass({ name: 'test' })
          case 'SpaceUpdateAction':
            return new ActionClass({ id: 'test-id' })
          case 'SpaceDeleteAction':
            return new ActionClass({ id: 'test-id' })
          case 'SpaceStorageListAction':
            return new ActionClass({})
          case 'SpaceStorageReadAction':
            return new ActionClass({ path: '/test' })
          case 'SpaceStorageWriteAction':
            return new ActionClass({ path: '/test', contents: 'test' })
          case 'SpaceStorageRwAction':
            return new ActionClass({ path: '/test', mode: 'read' })
          case 'SpaceStorageMoveAction':
            return new ActionClass({ sourcePath: '/a', destinationPath: '/b' })
          case 'SpaceStorageCopyAction':
            return new ActionClass({ sourcePath: '/a', destinationPath: '/b' })
          case 'SpaceStorageDeleteAction':
            return new ActionClass({ path: '/test' })
          case 'SpaceStorageSearchAction':
            return new ActionClass({ query: 'test' })
          case 'SpaceStorageImportAction':
            return new ActionClass({
              url: 'https://example.com',
              path: '/test',
            })
          case 'SpaceStorageLinkAction':
            return new ActionClass({ fileId: 'test-id', path: '/test' })
          case 'ShellExecAction':
            return new ActionClass({ cmd: 'echo test' })
          case 'ShellScriptAction':
            return new ActionClass({
              source: 'print(1)',
              runtime: 'python',
            })
          case 'ShellReadAction':
            return new ActionClass({ file: '/test' })
          case 'ShellWriteAction':
            return new ActionClass({ file: '/test', contents: 'test' })
          case 'ShellRwAction':
            return new ActionClass({ file: '/test', mode: 'read' })
          case 'ShellReplaceAction':
            return new ActionClass({
              file: '/test',
              search: 'a',
              replace: 'b',
            })
          case 'ShellEvalAction':
            return new ActionClass({ code: 'print(1)', runtime: 'python' })
          case 'ShellImportAction':
            return new ActionClass({
              url: 'https://example.com',
              path: '/test',
            })
          case 'ShellSkillsetInstallAction':
            return new ActionClass({ skillsetId: 'test-id' })
          case 'BlueprintResourceListAction':
            return new ActionClass({})
          case 'BlueprintNoteListAction':
            return new ActionClass({})
          case 'BlueprintBulletinListAction':
            return new ActionClass({})
          case 'BlueprintBulletinCreateAction':
            return new ActionClass({ text: 'test' })
          case 'BlueprintMetaFetchAction':
            return new ActionClass({})
          case 'AgentSpawnAction':
            return new ActionClass({ botId: 'test-id', task: 'test' })
          case 'AbortAction':
            return new ActionClass({})
          case 'TodoManageAction':
            return new ActionClass({ op: 'read' })
          case 'ListPushAction':
            return new ActionClass({ name: 'queue', item: 'test' })
          case 'ListPopAction':
            return new ActionClass({ name: 'queue' })
          case 'ListReadAction':
            return new ActionClass({ name: 'queue' })
          case 'ImageCreateAction':
            return new ActionClass({ prompt: 'test' })
          case 'ImageEditAction':
            return new ActionClass({ prompt: 'test', image: 'base64data' })
          case 'BotAskAction':
            return new ActionClass({ prompt: 'test prompt' })
          case 'BotCallAction':
            return new ActionClass({ prompt: 'test prompt' })
          case 'BotApplyAction':
            return new ActionClass({})
          case 'BotListAction':
            return new ActionClass({})
          case 'BotBackstoryReadAction':
            return new ActionClass({})
          case 'BotBackstoryWriteAction':
            return new ActionClass({ content: 'test' })
          case 'EchoAction':
            return new ActionClass({})
          default:
            throw new Error(`Unknown action class: ${className}`)
        }
      }

      it.each(ACTION_CLASSES.map((c) => [c.name, c]))(
        '%s should be recognized by isActionTag',
        (name, ActionClass) => {
          const instance = createMinimalInstance(ActionClass)

          expect(isActionTag(instance)).toBe(true)
        }
      )
    })

    describe('action class method requirements', () => {
      it.each(ACTION_CLASSES.map((c) => [c.name, c]))(
        '%s should have a substitute method',
        (name, ActionClass) => {
          expect(ActionClass.prototype.substitute).toBeDefined()
          expect(typeof ActionClass.prototype.substitute).toBe('function')
        }
      )

      it.each(ACTION_CLASSES.map((c) => [c.name, c]))(
        '%s should have a toActionResult method',
        (name, ActionClass) => {
          expect(ActionClass.prototype.toActionResult).toBeDefined()
          expect(typeof ActionClass.prototype.toActionResult).toBe('function')
        }
      )

      it.each(ACTION_CLASSES.map((c) => [c.name, c]))(
        '%s should have an action getter',
        (name, ActionClass) => {
          const descriptor = Object.getOwnPropertyDescriptor(
            ActionClass.prototype,
            'action'
          )

          expect(descriptor).toBeDefined()
          expect(typeof descriptor.get).toBe('function')
        }
      )
    })
  })
})
