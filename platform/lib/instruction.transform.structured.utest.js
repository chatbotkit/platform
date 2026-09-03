/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { extractDataFromInput } from '@/lib/extract.data'
import { transformStructuredInstruction } from '@/lib/instruction.transform.structured'
import { Usage } from '@/lib/usage.model'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

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

/**
 * Helper function to create a Usage instance with pre-added tokens
 *
 * @param {number} tokens - number of tokens to add
 * @param {string} model - model name for the tokens
 * @returns {Usage} - Usage instance with tokens added
 */
function createUsageWithTokens(tokens, model) {
  const usage = new Usage()

  if (tokens > 0) {
    usage.addTokens(tokens, model)
  }

  return usage
}

beforeEach(() => {
  mockReset(prisma)

  // @note reset extractDataFromInput to clear any queued mockResolvedValueOnce calls
  jest.mocked(extractDataFromInput).mockReset()
  jest.mocked(extractDataFromInput).mockResolvedValue({
    data: null,
    usage: new Usage(),
  })
})

describe('transformStructuredInstruction', () => {
  describe('basic field substitution', () => {
    it('should substitute instruction with all fields provided', async () => {
      const instruction = `!fetch
url: !string
  name: query
  required: true`

      const input = JSON.stringify({ query: 'test search' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      // @note field tags are replaced with their values
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "test search"')
      expect(result.usage.tokensUsed).toBe(0)
      expect(result.usage.modelUsed).toBe('base')
    })

    it('should handle multiple fields in input', async () => {
      const instruction = `!fetch
url: !string
  name: query
  required: true
query:
  limit: !number
    name: limit
    default: 10`

      const input = JSON.stringify({ query: 'test', limit: 25 })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "test"')
      expect(result.text).toContain('limit: 25')
      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should handle boolean fields in input', async () => {
      const instruction = `!fetch
url: /api/status
options:
  debug: !boolean
    name: enabled
    required: true`

      const input = JSON.stringify({ enabled: true })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('debug: true')
    })
  })

  describe('default values', () => {
    it('should apply default values when field is missing', async () => {
      const instruction = `!fetch
url: /api/search
query:
  limit: !number
    name: limit
    default: 10`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('limit: 10')
      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should apply default values for string fields', async () => {
      const instruction = `!fetch
url: /api/status
query:
  status: !string
    name: status
    default: active`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('status: "active"')
    })

    it('should apply default values for boolean fields', async () => {
      const instruction = `!fetch
url: /api/status
options:
  debug: !boolean
    name: enabled
    default: true`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('debug: true')
    })

    it('should not override provided values with defaults', async () => {
      const instruction = `!fetch
url: /api/search
query:
  limit: !number
    name: limit
    default: 10`

      const input = JSON.stringify({ limit: 50 })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('limit: 50')
    })

    it('should not override false boolean with default', async () => {
      const instruction = `!fetch
url: /api/status
options:
  debug: !boolean
    name: enabled
    default: true`

      const input = JSON.stringify({ enabled: false })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('debug: false')
    })

    it('should not override zero with default', async () => {
      const instruction = `!fetch
url: /api/search
query:
  count: !number
    name: count
    default: 10`

      const input = JSON.stringify({ count: 0 })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('count: 0')
    })

    it('should handle multiple defaults', async () => {
      const instruction = `!fetch
url: /api/search
query:
  page: !number
    name: page
    default: 1
  limit: !number
    name: limit
    default: 20
  sortBy: !string
    name: sortBy
    default: date`

      const input = JSON.stringify({ limit: 50 })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('page: 1')
      expect(result.text).toContain('limit: 50')
      expect(result.text).toContain('sortBy: "date"')
    })

    it('should NOT call LLM when required field has default', async () => {
      jest.mocked(extractDataFromInput).mockClear()

      const instruction = `!fetch
url: /api/status
query:
  status: !string
    name: status
    required: true
    default: active`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(extractDataFromInput).not.toHaveBeenCalled()
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('status: "active"')
      expect(result.usage.tokensUsed).toBe(0)
    })
  })

  describe('LLM extraction for missing required fields', () => {
    it('should throw LLM when required field is missing, has no default and no input provided', async () => {
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { query: 'extracted query' },
        usage: createUsageWithTokens(100, 'base'),
      })

      const instruction = `!fetch
url: !string
  name: query
  required: true
  description: the search query`

      const input = JSON.stringify({})

      await expect(
        transformStructuredInstruction(instruction, input, {
          userId: 'test',
        })
      ).rejects.toThrow()
    })

    it('should call LLM when required field is missing and has no default', async () => {
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { query: 'extracted query' },
        usage: createUsageWithTokens(100, 'base'),
      })

      const instruction = `!fetch
url: !string
  name: query
  required: true
  description: the search query`

      const input = JSON.stringify({ test: '123' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(extractDataFromInput).toHaveBeenCalledTimes(1)
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "extracted query"')
      // @note Usage class converts tokens using model ratios
      expect(result.usage.tokensUsed).toBeGreaterThan(0)
    })

    it('should call LLM only for fields without defaults', async () => {
      jest.mocked(extractDataFromInput).mockClear()
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { query: 'extracted value' },
        usage: createUsageWithTokens(50, 'base'),
      })

      const instruction = `!fetch
url: !string
  name: query
  required: true
query:
  limit: !number
    name: limit
    required: true
    default: 10`

      const input = 'The url is http://example.com!'

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(extractDataFromInput).toHaveBeenCalledTimes(1)

      const callArgs = jest.mocked(extractDataFromInput).mock.calls[0]

      expect(callArgs[1]).toHaveProperty('properties.query')
      expect(callArgs[1]).not.toHaveProperty('properties.limit')
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "extracted value"')
      expect(result.text).toContain('limit: 10')
    })

    it('should NOT call LLM when all required fields have defaults', async () => {
      jest.mocked(extractDataFromInput).mockClear()

      const instruction = `!fetch
url: !string
  name: field1
  required: true
  default: default1
query:
  field2: !number
    name: field2
    required: true
    default: 42`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(extractDataFromInput).not.toHaveBeenCalled()
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "default1"')
      expect(result.text).toContain('field2: 42')
      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should NOT call LLM when all required fields are provided in input', async () => {
      jest.mocked(extractDataFromInput).mockClear()

      const instruction = `!fetch
url: !string
  name: query
  required: true
query:
  limit: !number
    name: limit
    required: true`

      const input = JSON.stringify({ query: 'test', limit: 10 })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(extractDataFromInput).not.toHaveBeenCalled()
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "test"')
      expect(result.text).toContain('limit: 10')
      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should handle LLM extraction returning null data', async () => {
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: null,
        usage: createUsageWithTokens(50, 'base'),
      })

      const instruction = `!fetch
url: !string
  name: query
  required: true`

      const input = JSON.stringify({ required: 'to trigger LLM' }) // @note without some basic input the LLM won't be called

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      // @note structured instructions substitute empty string when field has no value
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url:')
      expect(result.usage.tokensUsed).toBeGreaterThan(0)
    })

    it('should include field descriptions in LLM extraction data', async () => {
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { query: 'test' },
        usage: createUsageWithTokens(50, 'base'),
      })

      const instruction = `!fetch
url: !string
  name: query
  required: true
  description: the search query to use`

      const input = JSON.stringify({ required: 'to trigger LLM' }) // @note without some basic input the LLM won't be called

      await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      const callArgs = jest.mocked(extractDataFromInput).mock.calls[0]

      expect(callArgs[1]).toMatchObject({
        type: 'object',
        properties: {
          query: {
            description: 'the search query to use',
            type: 'string',
          },
        },
        required: ['query'],
      })
    })

    it('should build array-type schema for !array fields in LLM extraction', async () => {
      // @note this was a bug where the schema type was hardcoded to 'string'
      // for all fields, causing the LLM to return a string instead of an array
      // for !array fields
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { images: ['https://example.com/img.jpg'] },
        usage: createUsageWithTokens(50, 'base'),
      })

      // @note uses 'name: images' (the correct behavior after the processValue fix)
      const instruction = `!image.edit
prompt: !string
  name: prompt
  description: the prompt to use for image generation
images: !array
  name: images
  optional: false
  items:
    name: image_url
    description: the URL of the image to edit
model: test-model`

      // @note provide prompt so only images is the missing required field
      const input = JSON.stringify({ prompt: 'dress the lion in a suit' })

      await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      const callArgs = jest.mocked(extractDataFromInput).mock.calls[0]

      // @note schema for array fields should use type 'array' with string
      // items, not 'string'
      expect(callArgs[1]).toMatchObject({
        type: 'object',
        properties: {
          images: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['images'],
      })
    })
  })

  describe('options.substitutions', () => {
    it('should apply substitutions to fields', async () => {
      const instruction = `!fetch
url: !string
  name: query
  required: true`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: { query: 'substituted query' },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "substituted query"')
    })

    it('should override input values with substitutions', async () => {
      const instruction = `!fetch
url: !string
  name: query
  required: true`

      const input = JSON.stringify({ query: 'from input' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: { query: 'from substitutions' },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "from substitutions"')
    })

    it('should override defaults with substitutions', async () => {
      const instruction = `!fetch
url: /api/status
query:
  status: !string
    name: status
    default: inactive`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: { status: 'active' },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('status: "active"')
    })

    it('should substitute special fields via substitutions option', async () => {
      // @note special fields (matching isSpecialField) are passed as referenceValues
      // to substituteFields - this tests CONVERSATION_ID, USER_ID etc.
      const instruction = `!fetch
method: POST
url: /api/webhook
body:
  conversationId: !reference CONVERSATION_ID
  userId: !reference USER_ID
  message: !string
    name: message
    default: Hello`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-123',
          USER_ID: 'user-456',
        },
      })

      // @note special fields should be substituted via referenceValues (3rd param)
      expect(result.text).toContain('conversationId: "conv-123"')
      expect(result.text).toContain('userId: "user-456"')
    })

    it('should not substitute special fields from regular input', async () => {
      // @note special fields can only be substituted via substitutions option
      const instruction = `!fetch
method: POST
url: /api/webhook
body:
  conversationId: !reference CONVERSATION_ID`

      // @note passing CONVERSATION_ID in regular input should NOT substitute the reference
      const input = JSON.stringify({ CONVERSATION_ID: 'from-input' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      // @note without substitutions, reference should remain as placeholder
      expect(result.text).toContain('conversationId: "${CONVERSATION_ID}"')
    })

    it('should handle both special and non-special substitutions', async () => {
      // @note substitutions may contain both regular field values and special field values
      const instruction = `!fetch
method: POST
url: /api/webhook
body:
  query: !string
    name: query
    default: default-query
  userId: !reference USER_ID`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          query: 'substituted-query',
          USER_ID: 'user-456',
        },
      })

      // @note non-special field should be substituted normally (via inputFields)
      expect(result.text).toContain('query: "substituted-query"')
      // @note special field should be substituted via referenceValues
      expect(result.text).toContain('userId: "user-456"')
    })

    it('should apply multiple substitutions', async () => {
      const instruction = `!fetch
url: !string
  name: query
query:
  limit: !number
    name: limit`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: { query: 'test', limit: 100 },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "test"')
      expect(result.text).toContain('limit: 100')
    })

    it('should handle empty substitutions object', async () => {
      const instruction = `!fetch
url: !string
  name: query
  default: default value`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: {},
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "default value"')
    })
  })

  describe('input parsing', () => {
    it('should handle empty input string', async () => {
      const instruction = `!fetch
url: !string
  name: query
  default: fallback`

      const input = ''

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "fallback"')
    })

    it('should handle null-ish input', async () => {
      const instruction = `!fetch
url: !string
  name: query
  default: fallback`

      const input = 'null'

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "fallback"')
    })

    it('should handle non-object JSON input', async () => {
      const instruction = `!fetch
url: !string
  name: query
  default: fallback`

      const input = '"string value"'

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "fallback"')
    })

    it('should handle array JSON input', async () => {
      const instruction = `!fetch
url: !string
  name: query
  default: fallback`

      const input = '["item1", "item2"]'

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "fallback"')
    })

    it('should handle invalid JSON input gracefully', async () => {
      const instruction = `!fetch
url: !string
  name: query
  default: fallback`

      const input = 'invalid json {'

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "fallback"')
    })
  })

  describe('edge cases', () => {
    it('should handle instruction with no fields', async () => {
      const instruction = `!fetch
method: GET
url: /api/status`

      const input = JSON.stringify({ extra: 'ignored' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      // @note action at root level returns action components directly
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('method: "GET"')
      expect(result.text).toContain('url: "/api/status"')
      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should return null for non-action-tag instruction', async () => {
      // @note structured instructions without action tags return null
      const instruction = `query: !string
  name: query`

      const input = JSON.stringify({
        query: 'test',
        extraField: 'extra value',
        anotherExtra: 123,
      })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result).toBeNull()
    })

    it('should handle top-level fields in fetch action', async () => {
      // @note extractFields now extracts nested fields too
      const instruction = `!fetch
url: !string
  name: query
  required: true
query:
  status: !string
    name: status
    default: all`

      const input = JSON.stringify({ query: 'test search' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('url: "test search"')
      expect(result.text).toContain('status: "all"')
    })

    it('should extract fields from nested !fetch body', async () => {
      // @note extractFields now supports nested field extraction
      const instruction = `!fetch
method: POST
url: /api/search
body:
  query: !string
    name: query
    required: true`

      const input = JSON.stringify({ query: 'test search' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      // @note action at root level returns action components directly
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('query: "test search"')
      // @note fields were found, so no LLM extraction needed
      expect(extractDataFromInput).not.toHaveBeenCalled()
    })
  })

  describe('real-world scenarios with action tags', () => {
    // @note structured instructions must use action tags at the root level

    it('should handle fetch with calendar booking fields', async () => {
      const instruction = `!fetch
method: POST
url: /api/calendar/events
body:
  calendarId: !string
    name: calendarId
    required: true
  summary: !string
    name: summary
    required: true
  startTime: !string
    name: startTime
    required: true
  duration: !number
    name: duration
    default: 60
  attendees: !string
    name: attendees`

      const input = JSON.stringify({
        calendarId: 'cal-123',
        summary: 'Team Meeting',
        startTime: '2024-01-15T10:00:00Z',
        attendees: 'user@example.com',
      })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('calendarId: "cal-123"')
      expect(result.text).toContain('summary: "Team Meeting"')
      expect(result.text).toContain('startTime: "2024-01-15T10:00:00Z"')
      expect(result.text).toContain('duration: 60')
      expect(result.text).toContain('attendees: "user@example.com"')
      expect(extractDataFromInput).not.toHaveBeenCalled()
      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should handle search with LLM extraction for missing query', async () => {
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { query: 'cats' },
        usage: createUsageWithTokens(75, 'base'),
      })

      const instruction = `!fetch
url: /api/search
query:
  q: !string
    name: query
    required: true
    description: the search term
  limit: !number
    name: limit
    default: 20`

      const input = 'I want to find cats'

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('q: "cats"')
      expect(result.text).toContain('limit: 20')
      expect(result.usage.tokensUsed).toBeGreaterThan(0)
    })

    it('should handle skillset install action', async () => {
      const instruction = `!skillset.install
skillsetId: !string
  name: skillsetId
  required: true
  description: the skillset ID to install`

      const input = JSON.stringify({ skillsetId: 'google-calendar' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('skillset')
      expect(result.params).toEqual({ install: true })
      expect(result.text).toContain('skillsetId: "google-calendar"')
    })

    it('should handle webhook with context substitutions', async () => {
      // @note substitutions are applied AFTER missing field detection
      // so if required fields are missing from input, LLM is called first
      // then substitutions override the result
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { conversationId: 'extracted-conv', userId: 'extracted-user' },
        usage: createUsageWithTokens(50, 'base'),
      })

      const instruction = `!fetch
method: POST
url: /api/webhook
body:
  conversationId: !string
    name: conversationId
    required: true
  userId: !string
    name: userId
    required: true
  message: !string
    name: message
    required: true`

      const input = JSON.stringify({ message: 'Hello!' })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          conversationId: 'conv-123',
          userId: 'user-456',
        },
      })

      // @note substitutions override the LLM-extracted values
      expect(result.action).toBe('fetch')
      expect(result.text).toContain('conversationId: "conv-123"')
      expect(result.text).toContain('userId: "user-456"')
      expect(result.text).toContain('message: "Hello!"')
      // @note LLM was called because fields were missing from input
      expect(extractDataFromInput).not.toHaveBeenCalled()
    })
  })

  describe('usage tracking', () => {
    it('should track LLM usage when extraction is called', async () => {
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { query: 'test' },
        usage: createUsageWithTokens(200, 'base'),
      })

      const instruction = `!fetch
url: !string
  name: query
  required: true`

      const input = JSON.stringify({ someInput: 'trigger LLM' }) // @note without some basic input the LLM won't be called

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.usage.tokensUsed).toBeGreaterThan(0)
      expect(result.usage.modelUsed).toBe('base')
    })

    it('should return zero tokens when no LLM is called', async () => {
      const instruction = `!fetch
url: !string
  name: query
  default: fallback`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.usage.tokensUsed).toBe(0)
      expect(result.usage.modelUsed).toBe('base')
    })

    it('should accumulate usage from multiple extraction calls', async () => {
      // @note currently the implementation only makes one extraction call
      // but this test documents the expected behavior

      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: { field1: 'value1', field2: 'value2' },
        usage: createUsageWithTokens(150, 'base'),
      })

      const instruction = `!fetch
url: !string
  name: field1
  required: true
query:
  field2: !string
    name: field2
    required: true`

      const input = JSON.stringify({ someInput: 'trigger LLM' }) // @note without some basic input the LLM won't be called

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.action).toBe('fetch')
      expect(result.usage.tokensUsed).toBeGreaterThan(0)
    })
  })

  describe('options.templateParams', () => {
    // @note options.templateParams allows template-resolved values to be passed
    // into structured instruction transformation. These values come from template
    // parameter resolution and override input values but can be overridden by
    // engine-level substitutions.

    it('should substitute field from templateParams when input not provided', async () => {
      const instruction = `!fetch
method: GET
url: /api/search
query:
  q: !string
    name: query
    required: true`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'template-resolved-query',
        },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('q: "template-resolved-query"')
    })

    it('should override input values with templateParams', async () => {
      const instruction = `!fetch
method: GET
url: /api/search
query:
  q: !string
    name: query
    required: true`

      const input = JSON.stringify({
        query: 'input-query',
      })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'template-override-query',
        },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('q: "template-override-query"')
      expect(result.text).not.toContain('input-query')
    })

    it('should allow substitutions to override templateParams', async () => {
      const instruction = `!fetch
method: GET
url: /api/search
query:
  q: !string
    name: query
    required: true`

      const input = JSON.stringify({
        query: 'input-query',
      })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'template-query',
        },
        substitutions: {
          query: 'substitution-query',
        },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('q: "substitution-query"')
      expect(result.text).not.toContain('template-query')
      expect(result.text).not.toContain('input-query')
    })

    it('should not affect special fields via templateParams', async () => {
      const instruction = `!fetch
method: POST
url: /api/data
headers:
  X-Conversation-Id: !reference CONVERSATION_ID
body:
  query: !string
    name: query
    required: true`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'test-query',
          CONVERSATION_ID: 'should-not-be-used',
        },
      })

      expect(result.action).toBe('fetch')
      expect(result.text).toContain('query: "test-query"')
      // @note special fields should not be affected by templateParams
      // they remain as placeholders for engine-level substitution
      expect(result.text).toContain('${CONVERSATION_ID}')
      expect(result.text).not.toContain('should-not-be-used')
    })

    it('should handle precedence: input < templateParams < substitutions', async () => {
      // @note this test verifies the full precedence chain

      const instruction = `!fetch
method: GET
url: /api/data
body:
  field1: !string
    name: field1
    required: true
  field2: !string
    name: field2
    required: true
  field3: !string
    name: field3
    required: true`

      const input = JSON.stringify({
        field1: 'from-input',
        field2: 'from-input',
        field3: 'from-input',
      })

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          field2: 'from-template',
          field3: 'from-template',
        },
        substitutions: {
          field3: 'from-substitutions',
        },
      })

      expect(result.action).toBe('fetch')
      // @note field1 only in input -> from input
      expect(result.text).toContain('field1: "from-input"')
      // @note field2 in input and templateParams -> from templateParams
      expect(result.text).toContain('field2: "from-template"')
      // @note field3 in all three -> from substitutions (highest priority)
      expect(result.text).toContain('field3: "from-substitutions"')
    })

    it('should handle empty templateParams object', async () => {
      const instruction = `!fetch
method: GET
url: /api/search
query:
  q: !string
    name: query
    default: default-search`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        templateParams: {},
      })

      expect(result.action).toBe('fetch')
      // @note empty templateParams should have no effect, default should be used
      expect(result.text).toContain('q: "default-search"')
    })

    it('should handle undefined templateParams', async () => {
      const instruction = `!fetch
method: GET
url: /api/search
query:
  q: !string
    name: query
    default: default-search`

      const input = JSON.stringify({})

      const result = await transformStructuredInstruction(instruction, input, {
        userId: 'test',
        templateParams: undefined,
      })

      expect(result.action).toBe('fetch')
      // @note undefined templateParams should have no effect
      expect(result.text).toContain('q: "default-search"')
    })
  })
})
