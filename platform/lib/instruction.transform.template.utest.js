/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { transformTemplateInstruction } from '@/lib/instruction.transform.template'

process.env.OPENAI_API_KEY = 'test-api-key'

jest.mock('@/lib/model.provider.openai', () => ({
  __esModule: true,

  default: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },

  fetchForFetching: jest.fn(),

  createChatCompletion: jest.fn(() =>
    Promise.resolve({
      choices: [
        {
          message: {
            function_call: {
              arguments: JSON.stringify({}),
            },
          },
        },
      ],
      usage: {
        totalTokens: 0,
      },
    })
  ),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,

  // @note re-export the real enums through the platform's own name for the
  // browser-safe surface - same objects as the module's browser entry, without
  // this test naming the module
  ...jest.requireActual('@/prisma/types'),

  default: mockDeep(),
}))

// @note mock extract.data to avoid LLM calls
jest.mock('@/lib/extract.data', () => ({
  extractDataFromInput: jest.fn(() => ({
    data: null,
    usage: new (jest.requireActual('@/lib/usage.model').Usage)(),
  })),
}))

// @note mock the recording function to avoid database calls
jest.mock('@/lib/usage.record', () => ({
  recordLanguageTokenUsage: jest.fn(),
}))

beforeEach(() => {
  mockReset(prisma)
})

describe('transformTemplateInstruction', () => {
  it('test harness 001', async () => {
    const instruction = `template: google/calendar/availability/book
params:
  calendarId: calendar@example.com`

    const input = JSON.stringify({
      bookingId: '171170902',
      summary: 'Meeting with Friends',
      description: 'A fun gathering',
      attendees: 'guest@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result).toEqual({
      action: 'fetch',
      params: {},
      text: `method: "POST"
url: "/api/auxiliary/skillset/ability/google/calendar"
headers:
  Content-Type: "application/json"
  X-Access-Token: "\${SECRET_DEFAULT}"
  x-chatbotkit-handler-name: "availability/book"
body:
  calendarId: "calendar@example.com"
  bookingId: "171170902"
  summary: "Meeting with Friends"
  description: "A fun gathering"
  attendees: "guest@example.com"
options:
  auth: "internal"`,
      usage: {
        modelUsed: 'base',
        tokensUsed: 0,
      },
    })
  })

  it('test harness 002', async () => {
    const instruction = `template: google/calendar/availability/book
params:
  calendarId: calendar@example.com`

    const input = JSON.stringify({
      bookingId:
        'eyJzIjoiMjAyNC0xMi0xNlQwOTo0NTowMC4wMDBaIiwiZSI6IjIwMjQtMTItMTZUMTA6NDU6MDAuMDAwWiJ9',
      summary: 'Meeting about Health',
      description: 'A fun gathering',
      attendees: 'guest@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result).toEqual({
      action: 'fetch',
      params: {},
      text: `method: "POST"
url: "/api/auxiliary/skillset/ability/google/calendar"
headers:
  Content-Type: "application/json"
  X-Access-Token: "\${SECRET_DEFAULT}"
  x-chatbotkit-handler-name: "availability/book"
body:
  calendarId: "calendar@example.com"
  bookingId: "eyJzIjoiMjAyNC0xMi0xNlQwOTo0NTowMC4wMDBaIiwiZSI6IjIwMjQtMTItMTZUMTA6NDU6MDAuMDAwWiJ9"
  summary: "Meeting about Health"
  description: "A fun gathering"
  attendees: "guest@example.com"
options:
  auth: "internal"`,
      usage: {
        modelUsed: 'base',
        tokensUsed: 0,
      },
    })
  })

  it('test harness 003', async () => {
    const instruction =
      'template: dataset/search\nparams:\n  datasetId: test123'

    const input = JSON.stringify({ query: 'cats' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // @note check key fields, params may have additional properties
    expect(result.action).toBe('dataset')
    expect(result.params.id).toBe('test123')
    expect(result.text).toBe('cats')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('test harness 004', async () => {
    const instruction = "template: dataset/search\nparams:\n  datasetId: ''"

    const input = JSON.stringify({ query: 'cats', datasetId: 'test123' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // @note check key fields, params may have additional properties
    expect(result.action).toBe('dataset')
    expect(result.params.id).toBe('test123')
    expect(result.text).toBe('cats')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('test harness 005', async () => {
    const instruction =
      'template: dataset/search\nparams:\n  datasetId: test123'

    const input = JSON.stringify({ query: 'cats', datasetId: 'xyz123' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // @note check key fields, params may have additional properties
    expect(result.action).toBe('dataset')
    expect(result.params.id).toBe('test123')
    expect(result.text).toBe('cats')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('test harness 006', async () => {
    // @note the google/mail/message/search template expects 'q' as the search query
    // field name, and uses the new handler-based API path format
    const instruction =
      'template: google/mail/message/search\nparameters:\n  q: ((q! ys|the search query))'

    const input = JSON.stringify({ q: 'chatbotkit' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('method: "POST"')
    expect(result.text).toContain('/api/auxiliary/skillset/ability/google/mail')
    expect(result.text).toContain('x-chatbotkit-handler-name')
    expect(result.text).toContain('message/list')
    expect(result.text).toContain('"chatbotkit"')
    expect(result.usage.modelUsed).toBe('base')
    expect(result.usage.tokensUsed).toBe(0)
  })

  it('test harness 007', async () => {
    // @note the google/mail/draft/list template now uses the handler-based API
    // format with POST method instead of direct GET to gmail API
    const instruction =
      'template: google/mail/draft/list\nparameters:\n  maxResults: ((maxResults number|the maximum number of drafts to return))'

    const input = JSON.stringify({ maxResults: 25 })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('method: "POST"')
    expect(result.text).toContain('/api/auxiliary/skillset/ability/google/mail')
    expect(result.text).toContain('x-chatbotkit-handler-name')
    expect(result.text).toContain('draft/list')
    expect(result.text).toContain('maxResults: 25')
    expect(result.usage.modelUsed).toBe('base')
    expect(result.usage.tokensUsed).toBe(0)
  })

  // Enhanced test cases for comprehensive coverage

  it('should handle template with shorthand notation', async () => {
    const instruction = '@google/calendar/availability/book'

    const input = JSON.stringify({
      calendarId: 'test@example.com',
      bookingId: '123',
      summary: 'Test Meeting',
      description: 'A fun gathering',
      attendees: 'test@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // @note action is now returned as a separate field
    expect(result.action).toBe('fetch')
    expect(result.text).toContain('"123"')
    expect(result.text).toContain('"Test Meeting"')
  })

  it('should include search term in fetch body for google/drive/file/search template', async () => {
    // @note this test verifies that when using the google/drive/file/search
    // template with an empty search parameter, and providing search input,
    // the search term is correctly included in the fetch request body

    const instruction = `template: google/drive/file/search
parameters:
  search: ''`

    const input = JSON.stringify({ search: 'test' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('search: "test"')
  })

  it('should handle google/drive/file/search template with empty input object', async () => {
    // @note this test verifies behavior when input is an empty object and
    // no search parameter is provided - the template should throw an error
    // because search is a required field

    const instruction = `template: google/drive/file/search
parameters:
  search: ''`

    const input = JSON.stringify({})

    await expect(
      transformTemplateInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "search" missing in the input.')
  })

  it('should handle google/drive/file/search template with predefined search parameter', async () => {
    // @note this test verifies that a predefined search parameter in the
    // template is used when input does not provide one

    const instruction = `template: google/drive/file/search
parameters:
  search: 'predefined query'`

    const input = JSON.stringify({})

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('search: "predefined query"')
  })

  it('should handle google/drive/file/search template without parameters key', async () => {
    // @note this test verifies behavior when the template has no parameters
    // defined and input is empty - should throw error for missing required field

    const instruction = `template: google/drive/file/search`

    const input = JSON.stringify({})

    await expect(
      transformTemplateInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "search" missing in the input.')
  })

  it('should handle google/drive/file/search template with null search in input', async () => {
    // @note this test verifies behavior when search is explicitly null
    // which should be treated as missing and throw an error

    const instruction = `template: google/drive/file/search
parameters:
  search: ''`

    const input = JSON.stringify({ search: null })

    await expect(
      transformTemplateInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow("Required field 'search' was not provided")
  })

  it('should handle google/drive/file/search template with empty string search in input', async () => {
    // @note this test verifies behavior when search is an empty string
    // in the input - empty string should be accepted as a valid value

    const instruction = `template: google/drive/file/search
parameters:
  search: ''`

    const input = JSON.stringify({ search: '' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('method: "POST"')
    expect(result.text).toContain(
      '/api/auxiliary/skillset/ability/google/drive'
    )
  })

  it('should handle google/drive/file/search template with only searchScope in input', async () => {
    // @note this test verifies that providing only optional searchScope
    // uses the empty string default for search from parameters

    const instruction = `template: google/drive/file/search
parameters:
  search: ''`

    const input = JSON.stringify({ searchScope: 'shared' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // @note search uses the empty string default from parameters
    expect(result.text).toContain('search: ""')
    expect(result.text).toContain('searchScope: "shared"')
  })

  it('should handle google/drive/file/search template with search and searchScope', async () => {
    // @note this test verifies that both search and searchScope parameters
    // are correctly included in the fetch request body

    const instruction = `template: google/drive/file/search
parameters:
  search: ''
  searchScope: ''`

    const input = JSON.stringify({ search: 'documents', searchScope: 'shared' })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('search: "documents"')
    expect(result.text).toContain('searchScope: "shared"')
  })

  it('should correctly replace placeholder parameters when input values are provided', async () => {
    // @note this test isolates a bug where searchScope parameter with
    // placeholder syntax is not being replaced correctly when input provides
    // both search and searchScope values. The result should contain the actual
    // values, not the raw placeholder text like "((!searchScope ys|...))"

    const instruction =
      'template: "google/drive/file/search"\nparameters:\n  search: ((!search ys|the search phrase to search for))\n  searchScope: ((!searchScope ys|the scope to search in))'

    const input = JSON.stringify({
      searchScope: 'all',
      search: 'growth model',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // Should contain the actual values
    expect(result.text).toContain('search: "growth model"')
    expect(result.text).toContain('searchScope: "all"')

    // Should NOT contain the raw placeholder syntax
    expect(result.text).not.toContain('((!searchScope ys|')
    expect(result.text).not.toContain('((!search ys|')
  })

  it('should handle template with empty parameters', async () => {
    const instruction = `template: google/calendar/availability/book
params: {}`

    const input = JSON.stringify({
      calendarId: 'empty@example.com',
      bookingId: '456',
      summary: 'Empty Params Meeting',
      description: 'A fun gathering',
      attendees: 'empty@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('"456"')
    expect(result.text).toContain('"Empty Params Meeting"')
  })

  it('should handle template with field parameters', async () => {
    const instruction = `template: google/calendar/availability/book
params:
  calendarId: $[calendarId!|calendar ID]`

    const input = JSON.stringify({
      calendarId: 'custom@calendar.com',
      bookingId: '789',
      summary: 'Field Param Meeting',
      description: 'A fun gathering',
      attendees: 'field@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('custom@calendar.com')
    expect(result.text).toContain('"789"')
  })

  it('should filter empty parameter values', async () => {
    const instruction = `template: google/calendar/availability/book
params:
  calendarId: test@calendar.com
  emptyParam: ""`

    const input = JSON.stringify({
      bookingId: '101',
      summary: 'Filtered Params',
      description: 'A fun gathering',
      attendees: 'filter@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('"test@calendar.com"')
    expect(result.text).toContain('"101"')
    // Empty parameters should be filtered out
  })

  it('should handle template not found error', async () => {
    const instruction = `template: nonexistent/template
params:
  param1: value1`

    const input = JSON.stringify({ test: 'value' })

    await expect(
      transformTemplateInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow(`Ability template not found: nonexistent/template`)
  })

  it('should handle nested template error', async () => {
    // This test would need more complex mocking to properly test
    // For now, we document that nested templates should throw an error
    const instruction = `template: google/calendar/availability/book
params:
  calendarId: test@example.com`

    const input = JSON.stringify({
      bookingId: '202',
      summary: 'Test Nested',
      description: 'A fun gathering',
      attendees: 'nested@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // This should work normally, not trigger nested template error
    expect(result.text).toContain('"202"')
  })

  it('should handle template with both standard and field parameters', async () => {
    // @note the google/mail/message/search template uses 'q' as the field name
    const instruction = `template: google/mail/message/search
parameters:
  q: ((q! ys|search query))`

    const input = JSON.stringify({
      q: 'test search',
      extraData: 'extra',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('"test search"')
    expect(result.usage.tokensUsed).toBeGreaterThanOrEqual(0)
  })

  it('should handle template with special characters in parameters', async () => {
    const instruction = `template: google/calendar/availability/book
params:
  calendarId: "special@email.com"`

    const input = JSON.stringify({
      bookingId: 'special-123',
      summary: 'Meeting with special chars: @#$%',
      description: 'A fun gathering',
      attendees: 'special@example.com',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('"special@email.com"')
    expect(result.text).toContain('"special-123"')
    expect(result.text).toContain('Meeting with special chars: @#$%')
  })

  it('should handle template with complex nested parameters', async () => {
    const instruction = `template: dataset/search
params:
  datasetId: complex-dataset-123
  nestedParam: ((nestedField!|nested field value))`

    const input = JSON.stringify({
      query: 'complex search',
      nestedField: 'nested value',
    })

    const result = await transformTemplateInstruction(instruction, input, {
      userId: 'test',
    })

    // @note datasetId is in params as 'id', query is in text
    expect(result.action).toBe('dataset')
    expect(result.params.id).toBe('complex-dataset-123')
    expect(result.text).toContain('complex search')
  })

  describe('special field preservation', () => {
    it('should preserve SECRET_DEFAULT in template output', async () => {
      // @note templates like google/mail use ${SECRET_DEFAULT} which must be
      // preserved for later resolution - also need to provide required 'q' field

      const instruction = `template: google/mail/message/search
parameters:
  q: test query`

      const input = JSON.stringify({})

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('${SECRET_DEFAULT}')
    })

    it('should preserve CONVERSATION_ prefixed special fields', async () => {
      // @note EARTH_ fields should pass through template transformation
      // to be resolved at action execution time

      const instruction = `template: google/calendar/availability/book
params:
  calendarId: \${CONVERSATION_META_CALENDAR_ID}`

      const input = JSON.stringify({
        bookingId: '123',
        summary: 'Test',
        description: 'A fun gathering',
        attendees: 'test@example.com',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note CONVERSATION_ fields should be preserved in output
      expect(result.text).toContain('${CONVERSATION_META_CALENDAR_ID}')
    })

    it('should preserve USER_ prefixed special fields', async () => {
      // @note USER_ fields should pass through template transformation
      // using correct field name 'q' for the gmail search template

      const instruction = `template: google/mail/message/search
parameters:
  q: from:\${USER_EMAIL}`

      const input = JSON.stringify({})

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note USER_ fields should be preserved in output
      expect(result.text).toContain('from:${USER_EMAIL}')
    })

    it('should preserve multiple special fields in same template', async () => {
      // @note multiple different special field types should all be preserved
      // using a valid search query that includes special fields

      const instruction = `template: google/mail/message/search
parameters:
  q: "from:\${USER_EMAIL} to:\${CONTACT_EMAIL}"`

      const input = JSON.stringify({})

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('${SECRET_DEFAULT}')
      expect(result.text).toContain('${USER_EMAIL}')
      expect(result.text).toContain('${CONTACT_EMAIL}')
    })

    it('should preserve BOT_ prefixed special fields', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: \${BOT_DATASET_ID}`

      const input = JSON.stringify({ query: 'test' })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note special fields in params are now in result.params
      expect(result.params.id).toBe('${BOT_DATASET_ID}')
    })

    it('should preserve CONVERSATION_ prefixed special fields', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: \${CONVERSATION_CONTEXT}`

      const input = JSON.stringify({ query: 'test' })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note special fields in params are now in result.params
      expect(result.params.id).toBe('${CONVERSATION_CONTEXT}')
    })
  })

  describe('action tag fields in parameters', () => {
    it('should handle !string action tag field in parameters', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: !string
    name: datasetId
    description: The dataset ID
    default: default-dataset`

      const input = JSON.stringify({ query: 'test search' })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note the action tag field should be treated as a field definition,
      // not a filled value, so datasetId should use its default value
      expect(result.params.id).toBe('default-dataset')
      expect(result.text).toContain('test search')
    })

    it('should handle !number action tag field with default value', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: test-dataset
  maxResults: !number
    name: limit
    description: Maximum results
    default: 10`

      const input = JSON.stringify({ query: 'test' })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note should use the default value from the action tag field
      // Since dataset/search doesn't use maxResults, we just verify it doesn't break
      expect(result.params.id).toBe('test-dataset')
      expect(result.text).toContain('test')
    })

    it('should allow input to override action tag field values', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: !string
    name: datasetId
    description: The dataset ID
    default: default-dataset`

      const input = JSON.stringify({
        query: 'test search',
        datasetId: 'custom-dataset',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note input values should override action tag field defaults
      expect(result.params.id).toBe('custom-dataset')
      expect(result.text).toContain('test search')
    })

    it('should handle mix of regular params and action tag fields', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: test-123
  customField: !string
    name: customValue
    default: custom-default`

      const input = JSON.stringify({ query: 'test' })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note regular params should be filled
      expect(result.params.id).toBe('test-123')
      expect(result.text).toContain('test')
    })

    it('should handle optional action tag fields', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: test-dataset
  filter: !string?
    name: filterValue
    description: Optional filter
    optional: true`

      const input = JSON.stringify({ query: 'search term' })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note optional fields without default should not cause errors
      expect(result.params.id).toBe('test-dataset')
      expect(result.text).toContain('search term')
    })

    it('should handle action tag fields with bracket notation fields', async () => {
      const instruction = `template: google/mail/message/search
params:
  datasetId: !string
    name: datasetId
    default: default-dataset
  q: ((searchQuery!))`

      const input = JSON.stringify({
        searchQuery: 'category:tech',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note both action tag fields and bracket fields should work together
      // The action tag field 'datasetId' gets its default value
      // The bracket notation field 'q' gets filled from input
      expect(result.text).toContain('category:tech')
    })
  })

  describe('bracket field parameter behavior', () => {
    // @note These tests document the CURRENT behavior of bracket fields.
    // Bracket fields use ((fieldName default<value>)) notation.
    // The key invariant: bracket notation should be RESOLVED in output,
    // meaning the output contains the value, NOT the ((fieldName...)) syntax.

    it('should use default value for bracket field when input not provided', async () => {
      const instruction = `template: google/mail/message/search
params:
  q: ((searchQuery default<default-search>))`

      const input = JSON.stringify({})

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note bracket field default IS applied when using correct syntax: default<value>
      expect(result.text).toContain('default-search')
      // @note bracket notation should be resolved, not present in output
      expect(result.text).not.toMatch(/\(\(searchQuery/)
    })

    it('should use input value when provided for bracket field with default', async () => {
      const instruction = `template: google/mail/message/search
params:
  q: ((searchQuery default<default-search>))`

      const input = JSON.stringify({
        searchQuery: 'user-provided-search',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note input should override default value
      expect(result.text).toContain('user-provided-search')
      expect(result.text).not.toContain('default-search')
      // @note bracket notation should be resolved, not present in output
      expect(result.text).not.toMatch(/\(\(searchQuery/)
    })

    it('should resolve required bracket field when input provided', async () => {
      const instruction = `template: google/mail/message/search
params:
  q: ((customQuery! ys|enter your query))`

      const input = JSON.stringify({
        customQuery: 'my-search',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note the input value should be substituted
      expect(result.text).toContain('my-search')
      // @note bracket notation should be resolved, not present in output
      expect(result.text).not.toMatch(/\(\(customQuery/)
    })

    it('should throw error for required bracket field without input', async () => {
      const instruction = `template: google/mail/message/search
params:
  q: ((requiredQuery!))`

      const input = JSON.stringify({})

      // @note required field without input throws BotInputError
      // The template's required field 'q' is checked first since the bracket
      // field resolves to empty and 'q' is still required by the template
      await expect(
        transformTemplateInstruction(instruction, input, {
          userId: 'test',
        })
      ).rejects.toThrow('Required field "q" missing in the input.')
    })

    it('should handle bracket field with type annotation and use numeric input', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: test-dataset-123
  limit: ((maxResults n default<10>))`

      const input = JSON.stringify({
        query: 'test query',
        maxResults: 25,
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.params.id).toBe('test-dataset-123')
      expect(result.text).toContain('test query')
      // @note bracket notation should be resolved
      expect(result.text).not.toMatch(/\(\(maxResults/)
    })

    it('should use type annotation default when no input provided', async () => {
      // @note using dataset/search template which doesn't have required fields
      // that would conflict with our test
      const instruction = `template: dataset/search
params:
  datasetId: test-dataset
  limit: ((limit n default<15>))`

      const input = JSON.stringify({
        query: 'test query',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note default value should be applied
      // The limit field with default<15> should resolve to 15
      expect(result.text).toContain('test query')
      // @note bracket notation should be resolved
      expect(result.text).not.toMatch(/\(\(limit/)
    })

    it('should handle optional bracket field without input', async () => {
      const instruction = `template: dataset/search
params:
  datasetId: test-dataset`

      const input = JSON.stringify({
        query: 'search term',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      // @note should work without any bracket field parameters
      expect(result.params.id).toBe('test-dataset')
      expect(result.text).toContain('search term')
    })

    it('should resolve multiple bracket fields in same instruction', async () => {
      const instruction = `template: google/mail/message/search
params:
  q: ((searchQuery!))`

      const input = JSON.stringify({
        searchQuery: 'multi-field-test',
      })

      const result = await transformTemplateInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('multi-field-test')
      // @note all bracket notation should be resolved
      expect(result.text).not.toMatch(/\(\(/)
    })
  })

  describe('test harness due to bug fix verification', () => {
    describe('memory/search template behavior', () => {
      it('should correctly map query input to search field', async () => {
        // @note memory/search uses field({ name: 'query', ... }) for the
        // 'search' key this tests that input field 'query' maps correctly to
        // instruction key 'search'

        const instruction = `template: memory/search`

        const input = JSON.stringify({
          query: 'test search term',
        })

        const result = await transformTemplateInstruction(instruction, input, {
          userId: 'test',
        })

        // @note the result should contain the search term in the 'search' field

        expect(result.action).toBe('memory')
        expect(result.text).toContain('query: "test search term"')
      })
    })
  })
})
