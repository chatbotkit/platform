import {
  extractInstructionFields,
  extractInstructionFieldsByType,
  substituteInstructionFields,
  substituteInstructionFieldsByType,
} from '@/lib/instruction.field'

describe('extractInstructionFields', () => {
  describe('simple instruction detection', () => {
    it('should extract fields from simple instruction', () => {
      const instruction =
        '```fetch\n' +
        'GET https://api.example.com/search?q=$[query!|the search query]\n' +
        'Authorization: Bearer ${API_TOKEN}\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields).toHaveLength(2)

      const queryField = fields.find((f) => f.name === 'query')
      const tokenField = fields.find((f) => f.name === 'API_TOKEN')

      expect(queryField).toMatchObject({
        name: 'query',
        required: true,
        description: 'the search query',
      })

      expect(tokenField).toMatchObject({
        name: 'API_TOKEN',
      })
      // curly bracket non-special fields don't have reference flag anymore
      expect(tokenField.reference).toBeUndefined()
    })

    it('should extract placeholder fields from simple instruction', () => {
      const instruction =
        '```search/datasetId=((datasetId!))\n' +
        '$[query!|search query]\n' +
        '```'

      const fields = extractInstructionFields(instruction)

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

  describe('complex instruction detection', () => {
    it('should extract fields from complex instruction with text', () => {
      const instruction =
        'First, fetch the data from the API.\n\n' +
        '```fetch\n' +
        'GET https://api.example.com/data?id=$[dataId!]\n' +
        '```\n\n' +
        'Then summarize the results.\n\n' +
        '```text\n' +
        '$[summary]\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields).toHaveLength(2)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['dataId', 'summary'])
      )
    })

    it('should extract fields from complex instruction with multiple actions', () => {
      const instruction =
        '```fetch\n' +
        'GET /api/users\n' +
        '```\n\n' +
        '```email/to=$[recipient!]\n' +
        'Subject: $[subject]\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields).toHaveLength(2)

      const recipientField = fields.find((f) => f.name === 'recipient')
      const subjectField = fields.find((f) => f.name === 'subject')

      expect(recipientField).toMatchObject({
        name: 'recipient',
        required: true,
      })

      expect(subjectField).toMatchObject({
        name: 'subject',
      })
    })
  })

  describe('template instruction detection', () => {
    it('should extract fields from template instruction with shorthand notation', () => {
      const instruction = '@dataset/search'

      const fields = extractInstructionFields(instruction)

      // @note template unpacking returns dataset/search template which has fields

      expect(fields).toBeDefined()
      expect(Array.isArray(fields)).toBe(true)
    })

    it('should extract fields from template instruction with YAML format', () => {
      const instruction =
        'template: dataset/search\n' +
        'parameters:\n' +
        '  datasetId: test-dataset-123'

      const fields = extractInstructionFields(instruction)

      // @note the datasetId field should be filtered out since it's provided
      // by the template parameters

      expect(fields).toBeDefined()
      expect(Array.isArray(fields)).toBe(true)

      // datasetId should be filtered since it has a value
      expect(fields.find((f) => f.name === 'datasetId')).toBeUndefined()
    })
  })

  describe('special field filtering', () => {
    it('should filter out SECRET_ prefixed fields', () => {
      const instruction =
        '```fetch\n' +
        'GET /api\n' +
        'Authorization: Bearer ${SECRET_API_KEY}\n' +
        'X-Custom: ${customHeader}\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields.find((f) => f.name === 'SECRET_API_KEY')).toBeUndefined()
      expect(fields.find((f) => f.name === 'customHeader')).toBeDefined()
    })

    it('should filter out USER_ prefixed fields', () => {
      const instruction =
        '```email/to=$[recipient!]/replyTo=${USER_EMAIL}\n' +
        'Subject: Hello\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields.find((f) => f.name === 'USER_EMAIL')).toBeUndefined()
      expect(fields.find((f) => f.name === 'recipient')).toBeDefined()
    })

    it('should filter out all special prefixed fields', () => {
      const instruction =
        '```fetch\n' +
        'GET /api\n' +
        'X-Secret: ${SECRET_KEY}\n' +
        'X-User: ${USER_ID}\n' +
        'X-Earth: ${EARTH_LOCATION}\n' +
        'X-Bot: ${BOT_NAME}\n' +
        'X-Conv: ${CONVERSATION_ID}\n' +
        'X-Custom: ${customField}\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('customField')
      // curly bracket non-special fields don't have reference flag anymore
      expect(fields[0].reference).toBeUndefined()
    })
  })

  describe('field type inference', () => {
    it('should infer boolean type from operand', () => {
      const instruction =
        '```fetch\n' +
        'POST /api\n' +
        'body: { enabled: $[enabled bool|whether to enable] }\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'enabled',
        type: 'boolean',
        description: 'whether to enable',
      })
    })

    it('should infer number type from operand', () => {
      const instruction =
        '```fetch\n' + 'GET /api?limit=$[limit num|max results]\n' + '```'

      const fields = extractInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'limit',
        type: 'number',
        description: 'max results',
      })
    })
  })

  describe('field default values', () => {
    it('should extract default values', () => {
      const instruction =
        '```fetch\n' +
        'GET /api?limit=$[limit num default{10}|max results]\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'limit',
        type: 'number',
        default: 10,
      })
    })
  })

  describe('field enum values', () => {
    it('should extract enum values', () => {
      const instruction =
        '```fetch\n' +
        'GET /api?status=$[status enum{pending,active,done}|status filter]\n' +
        '```'

      const fields = extractInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'status',
        enum: ['pending', 'active', 'done'],
      })
    })
  })
})

describe('extractInstructionFieldsByType', () => {
  describe('explicit type: simple', () => {
    it('should extract fields using simple extraction', () => {
      const instruction = '```fetch\nGET /api?q=$[query!]\n```'

      const fields = extractInstructionFieldsByType(instruction, 'simple')

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        required: true,
      })
    })
  })

  describe('explicit type: complex', () => {
    it('should extract fields using complex extraction', () => {
      const instruction = '```fetch\nGET /api?q=$[query]\n```'

      const fields = extractInstructionFieldsByType(instruction, 'complex')

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
      })
    })
  })

  describe('explicit type: template', () => {
    it('should extract fields using template extraction', () => {
      const instruction = '@dataset/search'

      const fields = extractInstructionFieldsByType(instruction, 'template')

      expect(fields).toBeDefined()
      expect(Array.isArray(fields)).toBe(true)
    })
  })

  describe('explicit type: automatic', () => {
    it('should throw Not implemented for automatic type', () => {
      const instruction = 'any instruction'

      const fields = extractInstructionFieldsByType(instruction, 'automatic')

      expect(fields).toEqual([])
    })
  })
})

describe('substituteInstructionFields', () => {
  describe('simple instruction substitution', () => {
    it('should substitute fields in simple instruction', () => {
      const instruction =
        '```fetch\n' +
        'GET https://api.example.com/search?datasetId=((datasetId))\n' +
        '```'
      const fieldValues = { datasetId: 'test-dataset' }

      const result = substituteInstructionFields(instruction, fieldValues)

      expect(result).toContain('datasetId=test-dataset')
      expect(result).not.toContain('((datasetId))')
    })

    it('should handle multiple field values in simple instruction', () => {
      const instruction =
        '```fetch\n' +
        'GET /search?query=((query))&dataset=((datasetId))\n' +
        '```'
      const fieldValues = {
        query: 'hello',
        datasetId: 'my-dataset',
      }

      const result = substituteInstructionFields(instruction, fieldValues)

      expect(result).toContain('query=hello')
      expect(result).toContain('dataset=my-dataset')
    })
  })

  describe('structured instruction substitution', () => {
    it('should substitute fields in structured instruction', () => {
      const instruction = `!fetch
method: GET
url: !concat
  - "https://api.example.com/search?q="
  - !string
    name: query`
      const fieldValues = { query: 'test-query' }

      const result = substituteInstructionFields(instruction, fieldValues)

      expect(result).toContain('test-query')
      expect(result).not.toContain('!string')
    })
  })

  describe('complex instruction substitution', () => {
    it('should substitute fields in complex instruction', () => {
      const instruction =
        'First, fetch the data.\n\n' +
        '```fetch\n' +
        'GET https://api.example.com/data?id=((dataId))\n' +
        '```\n\n' +
        'Then process it.'
      const fieldValues = { dataId: 'data-123' }

      const result = substituteInstructionFields(instruction, fieldValues)

      expect(result).toContain('id=data-123')
      expect(result).not.toContain('((dataId))')
    })
  })
})

describe('substituteInstructionFieldsByType', () => {
  describe('explicit type: simple', () => {
    it('should substitute fields using simple substitution', () => {
      const instruction = 'Dataset: ((datasetId))'
      const fieldValues = { datasetId: 'ds-123' }

      const result = substituteInstructionFieldsByType(
        instruction,
        'simple',
        fieldValues
      )

      expect(result).toBe('Dataset: ds-123')
    })
  })

  describe('explicit type: structured', () => {
    it('should substitute fields using structured substitution', () => {
      const instruction = `limit: !number
  name: limit
  default: 10`
      const fieldValues = { limit: 50 }

      const result = substituteInstructionFieldsByType(
        instruction,
        'structured',
        fieldValues
      )

      expect(result).toContain('50')
    })
  })

  describe('explicit type: complex', () => {
    it('should substitute fields using complex substitution', () => {
      const instruction =
        'Step 1.\n\n```fetch\nGET /api?q=((query))\n```\n\nStep 2.'
      const fieldValues = { query: 'search-term' }

      const result = substituteInstructionFieldsByType(
        instruction,
        'complex',
        fieldValues
      )

      expect(result).toContain('q=search-term')
    })
  })

  describe('explicit type: automatic', () => {
    it('should return instruction unchanged for automatic type', () => {
      const instruction = 'any instruction'
      const fieldValues = { field: 'value' }

      const result = substituteInstructionFieldsByType(
        instruction,
        'automatic',
        fieldValues
      )

      expect(result).toBe(instruction)
    })
  })
})
