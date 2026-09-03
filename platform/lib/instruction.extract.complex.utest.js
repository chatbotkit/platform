import { extractComplexInstructionFields } from '@/lib/instruction.extract.complex'

describe('extractComplexInstructionFields', () => {
  describe('square bracket fields', () => {
    it('should extract $[field] format', () => {
      const instruction = `
        Some descriptive text about the operation.

        \`\`\`fetch
        GET https://api.example.com/search?q=$[query]
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        type: 'string',
      })
    })

    it('should extract required square bracket fields', () => {
      const instruction = `
        First, search the database.

        \`\`\`search
        $[query!|the search query]
        \`\`\`

        Then process the results.
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'query',
        required: true,
        description: 'the search query',
      })
    })
  })

  describe('curly bracket fields', () => {
    it('should extract ${field} format', () => {
      const instruction = `
        Authenticate and fetch data.

        \`\`\`fetch
        GET https://api.example.com/data
        Authorization: Bearer \${API_TOKEN}
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'API_TOKEN',
        type: 'string',
      })
    })

    it('should filter out special prefixed fields', () => {
      const instruction = `
        Send email with user context.

        \`\`\`email/to=\${recipient}/replyTo=\${USER_EMAIL}
        Subject: Hello
        Body: Message from \${SECRET_KEY}
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('recipient')
      expect(fields[0].type).toBe('string')
    })
  })

  describe('round bracket fields', () => {
    it('should extract ((field)) format with placeholder flag', () => {
      const instruction = `
        Search using provided dataset.

        \`\`\`search/datasetId=((datasetId!))
        Find relevant documents
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(1)
      expect(fields[0]).toMatchObject({
        name: 'datasetId',
        required: true,
        placeholder: true,
      })
    })
  })

  describe('mixed bracket types in complex instruction', () => {
    it('should extract all bracket types with correct flags', () => {
      const instruction = `
        First, retrieve the user's calendar events.

        \`\`\`fetch
        GET https://api.calendar.com/events?start=$[startDate]&end=$[endDate]
        Authorization: Bearer \${CALENDAR_TOKEN}
        \`\`\`

        Then send recommendations via email.

        \`\`\`email/to=((recipientEmail!))/replyTo=\${USER_EMAIL}
        Subject: Meeting Time Recommendations

        $[meetingRecommendations]
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      // USER_EMAIL is special (USER_ prefix), should be filtered
      expect(fields.find((f) => f.name === 'USER_EMAIL')).toBeUndefined()

      // Regular fields should be present
      const startDate = fields.find((f) => f.name === 'startDate')
      const endDate = fields.find((f) => f.name === 'endDate')
      const calendarToken = fields.find((f) => f.name === 'CALENDAR_TOKEN')
      const recipientEmail = fields.find((f) => f.name === 'recipientEmail')
      const recommendations = fields.find(
        (f) => f.name === 'meetingRecommendations'
      )

      expect(startDate).toMatchObject({ name: 'startDate' })
      expect(startDate.placeholder).toBeUndefined()
      expect(startDate.reference).toBeUndefined()

      expect(endDate).toMatchObject({ name: 'endDate' })

      expect(calendarToken).toMatchObject({
        name: 'CALENDAR_TOKEN',
      })
      expect(calendarToken.placeholder).toBeUndefined()
      expect(calendarToken.reference).toBeUndefined()

      expect(recipientEmail).toMatchObject({
        name: 'recipientEmail',
        required: true,
        placeholder: true,
      })
      expect(recipientEmail.reference).toBeUndefined()

      expect(recommendations).toMatchObject({ name: 'meetingRecommendations' })
    })
  })

  describe('field type inference', () => {
    it('should infer boolean type from operand', () => {
      const instruction = `
        Toggle feature flag.

        \`\`\`fetch
        POST /api/features
        body: { enabled: $[enabled bool|whether to enable] }
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'enabled',
        type: 'boolean',
        description: 'whether to enable',
      })
    })

    it('should infer number type from operand', () => {
      const instruction = `
        Paginate results.

        \`\`\`fetch
        GET /api/items?limit=$[limit num default{10}|max items to return]
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'limit',
        type: 'number',
        default: 10,
        description: 'max items to return',
      })
    })
  })

  describe('field enum values', () => {
    it('should extract enum values from operand', () => {
      const instruction = `
        Filter by status.

        \`\`\`fetch
        GET /api/tasks?status=$[status enum{pending,active,done}|task status]
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields[0]).toMatchObject({
        name: 'status',
        enum: ['pending', 'active', 'done'],
        description: 'task status',
      })
    })
  })

  describe('edge cases', () => {
    it('should return empty array for instruction without fields', () => {
      const instruction = `
        This is a complex instruction with text but no fields.

        \`\`\`fetch
        GET https://api.example.com/static
        \`\`\`

        Just static content.
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for empty instruction', () => {
      const fields = extractComplexInstructionFields('')

      expect(fields).toHaveLength(0)
    })

    it('should return empty array for instruction with only special fields', () => {
      const instruction = `
        Use secrets only.

        \`\`\`fetch
        GET /api
        Authorization: Bearer \${SECRET_KEY}
        X-User: \${USER_EMAIL}
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(0)
    })

    it('should handle multiple action blocks', () => {
      const instruction = `
        Step 1: Fetch data

        \`\`\`fetch
        GET /api/data?id=$[dataId!]
        \`\`\`

        Step 2: Process data

        \`\`\`text
        Summarize: $[summary]
        \`\`\`

        Step 3: Send result

        \`\`\`email/to=$[recipient!]
        Subject: Results
        \`\`\`
      `

      const fields = extractComplexInstructionFields(instruction)

      expect(fields).toHaveLength(3)
      expect(fields.map((f) => f.name)).toEqual(
        expect.arrayContaining(['dataId', 'summary', 'recipient'])
      )
    })
  })
})
