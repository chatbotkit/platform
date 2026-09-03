import {
  extractSimpleInstructionFields,
  substituteSimpleInstructionFields,
} from '@/lib/instruction.extract.simple'

describe('extractSimpleInstructionFields', () => {
  describe('square bracket fields', () => {
    it('should extract $[field] format', () => {
      const instruction = 'Hello $[name], welcome!'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'name',
        type: 'string',
      })
      expect(fields[0].required).toBeUndefined()
    })

    it('should extract [[field]] format', () => {
      const instruction = 'Hello [[name]], welcome!'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'name',
        type: 'string',
      })
    })

    it('should extract required square bracket fields', () => {
      const instruction = 'Query: $[query!]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
        required: true,
      })
    })

    it('should extract field with description', () => {
      const instruction = '$[query!|the search query]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
        required: true,
        description: 'the search query',
      })
    })

    it('should not set placeholder or reference for square brackets', () => {
      const instruction = '$[query!]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0].placeholder).toBeUndefined()
      expect(fields[0].reference).toBeUndefined()
    })
  })

  describe('curly bracket fields', () => {
    it('should extract ${field} format', () => {
      const instruction = 'Token: ${API_TOKEN}'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'API_TOKEN',
        type: 'string',
      })
      // curly bracket fields don't get reference flag - only special fields would, but those are filtered out
      expect(fields[0].reference).toBeUndefined()
    })

    it('should extract {{field}} format', () => {
      const instruction = 'Token: {{API_TOKEN}}'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'API_TOKEN',
      })
      expect(fields[0].reference).toBeUndefined()
    })

    it('should filter out SECRET_ prefixed fields', () => {
      const instruction = 'Token: ${SECRET_API_KEY}, User: ${username}'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('username')
      expect(fields[0].reference).toBeUndefined()
    })

    it('should filter out USER_ prefixed fields', () => {
      const instruction = 'Email: ${USER_EMAIL}, Name: ${displayName}'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('displayName')
    })

    it('should filter out all special prefixed fields', () => {
      const instruction = `
        Secret: \${SECRET_KEY}
        User: \${USER_EMAIL}
        Earth: \${EARTH_LOCATION}
        Bot: \${BOT_ID}
        Conv: \${CONVERSATION_ID}
        Contact: \${CONTACT_ID}
        NS: \${NAMESPACE_ID}
        Ext: \${EXTERNAL_ID}
        File: \${FILE_ID}
        Regular: \${regularField}
      `

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('regularField')
      expect(fields[0].reference).toBeUndefined()
    })
  })

  describe('round bracket fields', () => {
    it('should extract ((field)) format with placeholder flag', () => {
      const instruction = 'Dataset: ((datasetId))'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'datasetId',
        type: 'string',
        placeholder: true,
      })
    })

    it('should extract required round bracket fields', () => {
      const instruction = '((datasetId!))'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'datasetId',
        required: true,
        placeholder: true,
      })
    })

    it('should extract round bracket field with description', () => {
      const instruction = '((searchQuery|what to search for))'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'searchQuery',
        description: 'what to search for',
        placeholder: true,
      })
    })

    it('should not set reference flag for round brackets', () => {
      const instruction = '((datasetId))'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0].reference).toBeUndefined()
    })
  })

  describe('field type inference', () => {
    it('should infer boolean type from operand', () => {
      const instruction = '$[enabled bool|whether enabled]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'enabled',
        type: 'boolean',
        description: 'whether enabled',
      })
    })

    it('should infer number type from operand', () => {
      const instruction = '$[count num|the count]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'count',
        type: 'number',
        description: 'the count',
      })
    })

    it('should default to string type', () => {
      const instruction = '$[name]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0].type).toBe('string')
    })
  })

  describe('field default values', () => {
    it('should extract default value from operand', () => {
      const instruction = '$[limit default{10}|the limit]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'limit',
        default: '10',
      })
    })

    it('should extract number default with proper type', () => {
      const instruction = '$[limit num default{10}|the limit]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'limit',
        type: 'number',
        default: 10,
      })
    })

    it('should extract boolean default with proper type', () => {
      const instruction = '$[enabled bool default{true}]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'enabled',
        type: 'boolean',
        default: true,
      })
    })
  })

  describe('field enum values', () => {
    it('should extract enum values from operand', () => {
      const instruction = '$[status enum{pending,active,done}|the status]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'status',
        enum: ['pending', 'active', 'done'],
        description: 'the status',
      })
    })

    it('should extract number enum values', () => {
      const instruction = '$[priority num enum{1,2,3}|priority level]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'priority',
        type: 'number',
        enum: [1, 2, 3],
      })
    })
  })

  describe('field min and max values', () => {
    it('should extract min value from operand', () => {
      const instruction = '$[age num min<18>|the age]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'age',
        type: 'number',
        min: 18,
        description: 'the age',
      })
    })

    it('should extract max value from operand', () => {
      const instruction = '$[rating num max<5>|the rating]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'rating',
        type: 'number',
        max: 5,
        description: 'the rating',
      })
    })

    it('should extract both min and max from operand', () => {
      const instruction = '$[score num min<0> max<100>|the score]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'score',
        type: 'number',
        min: 0,
        max: 100,
        description: 'the score',
      })
    })

    it('should handle min and max with other operands', () => {
      const instruction = '$[limit! num min<1> max<50> default<10>|max results]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'limit',
        type: 'number',
        required: true,
        min: 1,
        max: 50,
        default: 10,
        description: 'max results',
      })
    })

    it('should handle negative min values', () => {
      const instruction = '$[temperature num min<-50> max<50>|temperature]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'temperature',
        type: 'number',
        min: -50,
        max: 50,
      })
    })

    it('should handle decimal min and max values', () => {
      const instruction = '$[percentage num min<0.0> max<1.0>|the percentage]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'percentage',
        type: 'number',
        min: 0.0,
        max: 1.0,
      })
    })
  })

  describe('mixed bracket types', () => {
    it('should extract all bracket types with correct flags', () => {
      const instruction = `
        \`\`\`fetch
        GET https://api.example.com/search?q=$[query! euc|search query]
        Authorization: Bearer \${API_TOKEN}
        X-Dataset: ((datasetId!))
        \`\`\`
      `

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(3)

      const squareField = fields.find((f) => f.name === 'query')
      const curlyField = fields.find((f) => f.name === 'API_TOKEN')
      const roundField = fields.find((f) => f.name === 'datasetId')

      expect(squareField).toMatchObject({
        name: 'query',
        required: true,
      })
      expect(squareField.placeholder).toBeUndefined()
      expect(squareField.reference).toBeUndefined()

      expect(curlyField).toMatchObject({
        name: 'API_TOKEN',
      })
      expect(curlyField.placeholder).toBeUndefined()
      expect(curlyField.reference).toBeUndefined()

      expect(roundField).toMatchObject({
        name: 'datasetId',
        required: true,
        placeholder: true,
      })
      expect(roundField.reference).toBeUndefined()
    })

    it('should handle instruction with special and regular curly fields', () => {
      const instruction = `
        \`\`\`email/to=((recipientEmail!))/replyTo=\${USER_EMAIL}
        Subject: $[subject ys|email subject line]

        $[emailBody ys|the content of the email]
        \`\`\`
      `

      const fields = extractSimpleInstructionFields(instruction)

      // USER_EMAIL should be filtered out
      expect(fields.find((f) => f.name === 'USER_EMAIL')).toBeUndefined()

      // Other fields should be present
      const recipientField = fields.find((f) => f.name === 'recipientEmail')
      const subjectField = fields.find((f) => f.name === 'subject')
      const bodyField = fields.find((f) => f.name === 'emailBody')

      expect(recipientField).toMatchObject({
        name: 'recipientEmail',
        required: true,
        placeholder: true,
      })

      expect(subjectField).toMatchObject({
        name: 'subject',
        description: 'email subject line',
      })

      expect(bodyField).toMatchObject({
        name: 'emailBody',
        description: 'the content of the email',
      })
    })
  })

  describe('local field extraction', () => {
    it('should set local flag when operand contains "local"', () => {
      const instruction = '$[internalId local]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'internalId',
        local: true,
      })
    })

    it('should not set local flag for regular fields', () => {
      const instruction = '$[normalField]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].local).toBeUndefined()
    })

    it('should handle local with other operands', () => {
      const instruction = '$[config local string default{value}]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'config',
        type: 'string',
        local: true,
        default: 'value',
      })
    })

    it('should be case-insensitive for local keyword', () => {
      const instruction = '$[field1 LOCAL] $[field2 Local]'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(2)
      expect(fields[0].local).toBe(true)
      expect(fields[1].local).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should return empty array for instruction without fields', () => {
      const instruction = 'Hello world, this is a simple text.'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for empty instruction', () => {
      const instruction = ''

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for instruction with only special fields', () => {
      const instruction = 'User: ${USER_EMAIL}, Secret: ${SECRET_KEY}'

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should handle multiline instruction', () => {
      const instruction = `
        Line 1: $[field1]
        Line 2: $[field2]
        Line 3: $[field3]
      `

      const fields = extractSimpleInstructionFields(instruction)

      expect(fields).toHaveLength(3)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['field1', 'field2', 'field3'])
      )
    })
  })
})

describe('substituteSimpleInstructionFields', () => {
  it('should substitute round bracket field values', () => {
    const instruction = 'Dataset: ((datasetId))'
    const fieldValues = { datasetId: 'test-dataset-123' }

    const result = substituteSimpleInstructionFields(instruction, fieldValues)

    expect(result).toBe('Dataset: test-dataset-123')
  })

  it('should substitute multiple field values', () => {
    const instruction = 'Query: ((query)) in dataset ((datasetId))'
    const fieldValues = {
      query: 'search term',
      datasetId: 'my-dataset',
    }

    const result = substituteSimpleInstructionFields(instruction, fieldValues)

    expect(result).toBe('Query: search term in dataset my-dataset')
  })

  it('should handle field with required modifier', () => {
    const instruction = '((datasetId!))'
    const fieldValues = { datasetId: 'ds-123' }

    const result = substituteSimpleInstructionFields(instruction, fieldValues)

    expect(result).toBe('ds-123')
  })

  it('should handle field with description', () => {
    const instruction = '((searchQuery|what to search for))'
    const fieldValues = { searchQuery: 'hello world' }

    const result = substituteSimpleInstructionFields(instruction, fieldValues)

    expect(result).toBe('hello world')
  })

  it('should keep field with default when value not provided', () => {
    // @note defaults are applied only when the value is explicitly empty
    // not when the field is completely missing from fieldValues
    const instruction = '((limit default{10}))'
    const fieldValues = {}

    const result = substituteSimpleInstructionFields(instruction, fieldValues)

    // @note the field stays in place when no value provided - this is by design
    // so that subsequent substitution passes can still use the default
    expect(result).toBe('((limit default{10}))')
  })

  it('should return instruction unchanged when no fields to substitute', () => {
    const instruction = 'Hello world'
    const fieldValues = {}

    const result = substituteSimpleInstructionFields(instruction, fieldValues)

    expect(result).toBe('Hello world')
  })

  it('should handle empty field values', () => {
    const instruction = 'Query: ((query))'
    const fieldValues = { query: '' }

    const result = substituteSimpleInstructionFields(instruction, fieldValues)

    expect(result).toBe('Query: ')
  })
})
