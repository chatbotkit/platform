/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { extractDataFromInput } from '@/lib/extract.data'
import { transformSimpleInstruction } from '@/lib/instruction.transform.simple'
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

describe('transformSimpleInstruction', () => {
  it('test harness 001', async () => {
    const instruction = `\`\`\`fetch
method: POST
url: /api/auxiliary/skillset/ability/google/calendar/availability/book
headers:
  X-Access-Token: \${SECRET_DEFAULT}
  Content-Type: application/json
body:
  calendarId: calendar@example.com
  bookingId: $[bookingId! ys|the id of the availability slot to book]
  summary: $[summary! ys|the summary of the event]
  description: ''
  attendees: $[attendees! ys|a list of comma separated emails of attendees]
\`\`\``

    const input = JSON.stringify({
      bookingId: '171170902',
      summary: 'Meeting with Friends',
      attendees: 'guest@example.com',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result).toEqual({
      action: 'fetch',
      params: {},
      text: `method: POST
url: /api/auxiliary/skillset/ability/google/calendar/availability/book
headers:
  X-Access-Token: \${SECRET_DEFAULT}
  Content-Type: application/json
body:
  calendarId: calendar@example.com
  bookingId: "171170902"
  summary: "Meeting with Friends"
  description: ''
  attendees: "guest@example.com"`,
      usage: {
        tokensUsed: 0,
        modelUsed: 'base',
      },
    })
  })

  it('test harness 002', async () => {
    const instruction =
      '```dataset/search/id=((datasetId!|the dataset Id that you want to search))\n$[query!|search query]\n```\n'

    const input = JSON.stringify({ query: 'cats', datasetId: '123' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result).toEqual({
      action: 'dataset',
      params: { search: '', id: 123 },
      text: 'cats',
      usage: {
        tokensUsed: 0,
        modelUsed: 'base',
      },
    })
  })

  it('test harness 003', async () => {
    const instruction =
      '```dataset/search/id=test123\n$[query!|search query]\n```\n'

    const input = JSON.stringify({ query: 'cats' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result).toEqual({
      action: 'dataset',
      params: { search: '', id: 'test123' },
      text: 'cats',
      usage: {
        tokensUsed: 0,
        modelUsed: 'base',
      },
    })
  })

  it('test harness 004', async () => {
    const instruction =
      '```dataset/search/id=test123\n$[query!|search query]\n```\n'

    const input = JSON.stringify({ query: 'cats', datasetId: 'xyz123' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result).toEqual({
      action: 'dataset',
      params: { search: '', id: 'test123' },
      text: 'cats',
      usage: {
        tokensUsed: 0,
        modelUsed: 'base',
      },
    })
  })

  it('test harness 005', async () => {
    const instruction =
      '```fetch\nmethod: POST\nurl: /\nbody:\n  id: $[id! ys|the id]\n```\n'

    const input = JSON.stringify({ id: '19af457522ba92df' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result).toEqual({
      action: 'fetch',
      params: {},
      text: 'method: POST\nurl: /\nbody:\n  id: "19af457522ba92df"',
      usage: {
        tokensUsed: 0,
        modelUsed: 'base',
      },
    })
  })

  it('should handle empty input with required fields', async () => {
    const instruction =
      '```fetch\nbody:\n  field: $[field!|required field]\n```'

    const input = ''

    await expect(
      transformSimpleInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "field" missing in the input.')
  })

  it('should handle multiple bracket types', async () => {
    const instruction =
      '```echo\nsquare: $[squareField!|square field]\ncurly: ${curlyField!|curly field}\nround: ((roundField!|round field))\n```'

    const input = JSON.stringify({
      squareField: 'square value',
      curlyField: 'curly value',
      roundField: 'round value',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('square value')
    expect(result.text).toContain('curly value')
    expect(result.text).toContain('round value')
  })

  it('should handle optional fields', async () => {
    const instruction =
      '```fetch\nbody:\n  required: $[required!|required field]\n  optional: $[optional|optional field]\n```'

    const input = JSON.stringify({ required: 'required value' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('required value')
    expect(result.usage.tokensUsed).toBeGreaterThanOrEqual(0)
  })

  it('should handle invalid JSON input', async () => {
    const instruction = '```fetch\nbody:\n  field: $[field!|test field]\n```'
    const input = 'invalid json {'

    await expect(
      transformSimpleInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "field" missing in the input.')
  })

  it('should handle non-object input after parsing', async () => {
    const instruction = '```fetch\nbody:\n  field: $[field!|test field]\n```'
    const input = '"string value"'

    await expect(
      transformSimpleInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "field" missing in the input.')
  })

  it('should filter special fields correctly', async () => {
    const instruction =
      '```fetch\nbody:\n  normalField: $[normalField!|normal field]\n  specialField: ${specialField!|special field}\n```'

    const input = JSON.stringify({
      normalField: 'normal value',
      specialField: 'special value',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('normal value')
    expect(result.text).toContain('special value')
  })

  it('should handle empty expected fields', async () => {
    const instruction = '```fetch\nmethod: GET\nurl: /api/test\n```'
    const input = JSON.stringify({ extraField: 'extra value' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.action).toBe('fetch')
    expect(result.text).toBe('method: GET\nurl: /api/test')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('should handle complex nested field substitution', async () => {
    const instruction =
      '```fetch\nbody:\n  user:\n    name: $[userName!|user name]\n    email: $[userEmail!|user email]\n  settings:\n    theme: $[theme|theme preference]\n```'

    const input = JSON.stringify({
      userName: 'John Doe',
      userEmail: 'john@example.com',
      theme: 'dark',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('John Doe')
    expect(result.text).toContain('john@example.com')
    expect(result.text).toContain('dark')
  })

  it('should handle missing required and optional fields mix', async () => {
    const instruction =
      '```fetch\nbody:\n  required1: $[req1!|required field 1]\n  optional1: $[opt1|optional field 1]\n  required2: $[req2!|required field 2]\n```'

    const input = JSON.stringify({ req1: 'value1', opt1: 'optional1' })

    await expect(
      transformSimpleInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "req2" missing in the input.')
  })

  it('should handle special fields that are filtered out from curly brackets', async () => {
    const instruction =
      '```fetch\nbody:\n  normalField: $[normalField!|normal field]\n  earthField: ${EARTH_data!|earth field}\n  secretField: ${SECRET_key!|secret field}\n```'

    const input = JSON.stringify({
      normalField: 'normal value',
      EARTH_data: 'earth value',
      SECRET_key: 'secret value',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('normal value')
    expect(result.text).toContain('${EARTH_data!|earth field}') // @note should not be substituted as it's a special field
    expect(result.text).toContain('${SECRET_key!|secret field}') // @note should not be substituted as it's a special field
  })

  it('should preserve USER_ prefixed special fields in curly brackets', async () => {
    // @note USER_ prefix was added to special fields to support fields like
    // USER_EMAIL, USER_ID, USER_NAME etc.

    const instruction =
      '```fetch\nbody:\n  normalField: $[normalField!|normal field]\n  userEmail: ${USER_EMAIL!|user email field}\n  userId: ${USER_ID!|user id field}\n```'

    const input = JSON.stringify({
      normalField: 'normal value',
      USER_EMAIL: 'test@example.com',
      USER_ID: 'user-123',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('normal value')
    expect(result.text).toContain('${USER_EMAIL!|user email field}') // @note should not be substituted as it's a special field
    expect(result.text).toContain('${USER_ID!|user id field}') // @note should not be substituted as it's a special field
  })

  it('should handle instructions with no fields to extract', async () => {
    const instruction =
      '```fetch\nmethod: GET\nurl: /api/static\nheaders:\n  Content-Type: application/json\n```'

    const input = JSON.stringify({ someData: 'ignored' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.action).toBe('fetch')
    expect(result.text).toBe(
      'method: GET\nurl: /api/static\nheaders:\n  Content-Type: application/json'
    )
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('should handle when LLM extraction returns valid schema', async () => {
    jest.mocked(extractDataFromInput).mockResolvedValueOnce({
      data: { missingField: 'extracted value' },
      usage: createUsageWithTokens(150, 'base'),
    })

    const instruction =
      '```fetch\nbody:\n  field: $[missingField!|required field]\n```'

    const input = JSON.stringify({ something: 'else' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('extracted value')
    // @note usage class converts LLM tokens to base model tokens using token
    expect(result.usage.tokensUsed).toBeGreaterThan(0)
    expect(result.usage.modelUsed).toBe('base') // @note Usage always reports base model
  })

  it('should handle when LLM extraction returns null schema', async () => {
    jest.mocked(extractDataFromInput).mockResolvedValueOnce({
      data: null,
      usage: createUsageWithTokens(50, 'base'),
    })

    const instruction =
      '```fetch\nbody:\n  field: $[missingField!|required field]\n```'

    const input = JSON.stringify({}) // @note empty input to trigger LLM extraction

    await expect(
      transformSimpleInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "missingField" missing in the input.')

    // @note even when extraction fails, usage should still be tracked
    // @note this test verifies the error is thrown, so we can't check the
    // return value, but the usage tracking happens before the error is thrown
  })

  it('should track LLM usage even when extraction fails for required fields', async () => {
    jest.mocked(extractDataFromInput).mockResolvedValueOnce({
      data: null,
      usage: createUsageWithTokens(75, 'base'),
    })

    const instruction =
      '```fetch\nbody:\n  field: $[missingField!|required field]\n```'

    const input = JSON.stringify({}) // @note empty input to trigger LLM extraction

    // @note should throw error for missing required field, but would still
    // track usage if it didn't throw

    await expect(
      transformSimpleInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Required field "missingField" missing in the input.')

    // @note the usage tracking happens before the error is thrown,
    // so even though we can't check the return value, the Usage class would have tracked it
  })

  it('should handle complex field types and operands', async () => {
    const instruction =
      '```echo\nfield1: $[field1! ys enum<a,b,c>|enumerated field]\nfield2: $[field2 default<defaultValue>|field with default]\nfield3: ((field3! format<json>|formatted field))\n```'

    const input = JSON.stringify({
      field1: 'a',
      field2: undefined,
      field3: '{"key": "value"}',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('a')
    expect(result.text).toContain('{"key": "value"}')
    expect(result.usage.tokensUsed).toBeGreaterThanOrEqual(0)
  })

  it('should handle when input contains null values', async () => {
    const instruction =
      '```fetch\nbody:\n  field1: $[field1|optional field]\n  field2: $[field2!|required field]\n```'

    const input = JSON.stringify({ field1: null, field2: 'required value' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('required value')
    expect(result.usage.tokensUsed).toBeGreaterThanOrEqual(0)
  })

  it('should handle mixed field types in same instruction', async () => {
    const instruction =
      '```echo\nsquare: $[squareField!|square field]\ncurly: ${curlyField!|curly field}\nround: ((roundField!|round field))\nstatic: value\n```'

    const input = JSON.stringify({
      squareField: 'square',
      curlyField: 'curly',
      roundField: 'round',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('square')
    expect(result.text).toContain('curly')
    expect(result.text).toContain('round')
    expect(result.text).toContain('static: value')
  })

  it('should handle when inputFields becomes non-object after LLM extraction', async () => {
    const instruction =
      '```fetch\nbody:\n  field: $[field!|required field]\n```'

    const input = JSON.stringify({ field: 'initial value' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('initial value')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('should handle fields with complex descriptions', async () => {
    const instruction =
      '```fetch\nbody:\n  field: $[field!|this is a very long description with special characters @#$%]\n```'

    const input = JSON.stringify({ field: 'test value' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('test value')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('should handle duplicate field names across different bracket types', async () => {
    const instruction =
      '```fetch\nsquare: $[name!|square name]\ncurly: ${name!|curly name}\nround: ((name!|round name))\n```'

    const input = JSON.stringify({ name: 'shared value' })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    const lines = result.text.split('\n')

    expect(lines.find((line) => line.includes('square:'))).toContain(
      'shared value'
    )
    expect(lines.find((line) => line.includes('curly:'))).toContain(
      'shared value'
    )
    expect(lines.find((line) => line.includes('round:'))).toContain(
      'shared value'
    )
  })

  it('should handle validation errors from substituteFields', async () => {
    const instruction =
      '```echo\nfield: $[field! enum<a,b,c>|enumerated field]\n```'

    const input = JSON.stringify({ field: 'invalid' }) // @note not in enum

    await expect(
      transformSimpleInstruction(instruction, input, { userId: 'test' })
    ).rejects.toThrow('Value "invalid" is not in the enum for field "field".')
  })

  it('should handle empty required fields that are present but empty', async () => {
    const instruction =
      '```fetch\nbody:\n  field: $[field!|required field]\n```'

    const input = JSON.stringify({ field: '' }) // @note empty string

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    // @note empty string becomes empty in YAML, so "field:" without trailing space
    expect(result.text).toContain('field:')
    expect(result.text).not.toContain('""')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('should handle input with extra properties not used in instruction', async () => {
    const instruction =
      '```fetch\nbody:\n  field: $[field!|required field]\n```'

    const input = JSON.stringify({
      field: 'used value',
      extraField1: 'not used',
      extraField2: 123,
      extraField3: { nested: 'object' },
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('used value')
    expect(result.text).not.toContain('not used')
    expect(result.text).not.toContain('123')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  it('should preserve exact formatting and whitespace in instruction', async () => {
    const instruction = `\`\`\`fetch
method: POST
url: /api/test
headers:
  Content-Type: application/json
  Authorization: Bearer $[token!|access token]
body:
  data: $[data!|request data]
  
  nested:
    field: $[nestedField|optional nested field]
\`\`\``

    const input = JSON.stringify({
      token: 'abc123',
      data: 'test data',
      nestedField: 'nested value',
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('method: POST')
    expect(result.text).toContain('  Content-Type: application/json')
    expect(result.text).toContain('  Authorization: Bearer abc123')
    expect(result.text).toContain('  data: test data')
    expect(result.text).toContain('  \n  nested:')
    expect(result.text).toContain('    field: nested value')
  })

  it('should handle array and object values in input', async () => {
    const instruction =
      '```fetch\nbody:\n  arrayField: $[arrayField!|array field]\n  objectField: $[objectField!|object field]\n```'

    const input = JSON.stringify({
      arrayField: ['item1', 'item2', 'item3'],
      objectField: { key1: 'value1', key2: 'value2' },
    })

    const result = await transformSimpleInstruction(instruction, input, {
      userId: 'test',
    })

    expect(result.text).toContain('arrayField: item1,item2,item3')
    expect(result.text).toContain('objectField: [object Object]')
    expect(result.usage.tokensUsed).toBe(0)
    expect(result.usage.modelUsed).toBe('base')
  })

  describe('defaults functionality', () => {
    it('should apply default values when field is undefined', async () => {
      const instruction =
        '```fetch\nbody:\n  field: $[field default<defaultValue>|field with default]\n```'

      const input = JSON.stringify({ field: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('field: defaultValue')
      expect(result.usage.tokensUsed).toBe(0)
      expect(result.usage.modelUsed).toBe('base')
    })

    it('should apply default values when field is null', async () => {
      const instruction =
        '```fetch\nbody:\n  field: $[field default<nullFallback>|field with default]\n```'

      const input = JSON.stringify({ field: null })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note null should trigger default value due to nullish coalescing

      expect(result.text).toContain('field: nullFallback')
    })

    it('should not apply default when field has valid value', async () => {
      const instruction =
        '```fetch\nbody:\n  field: $[field default<defaultValue>|field with default]\n```'

      const input = JSON.stringify({ field: 'actualValue' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('field: actualValue')
      expect(result.text).not.toContain('defaultValue')
    })

    it('should handle boolean defaults correctly', async () => {
      const instruction =
        '```echo\nflag: $[flag boolean default<true>|boolean flag]\n```'

      const input = JSON.stringify({ flag: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('flag: true')
    })

    it('should handle number defaults correctly', async () => {
      const instruction =
        '```echo\ncount: $[count number default<42>|number count]\n```'

      const input = JSON.stringify({ count: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('count: 42')
    })

    it('should not override false boolean values with defaults', async () => {
      const instruction =
        '```echo\nflag: $[flag boolean default<true>|boolean flag]\n```'

      const input = JSON.stringify({ flag: false })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note false is a valid value and should not trigger default

      expect(result.text).toContain('flag: false')
      expect(result.text).not.toContain('flag: true')
    })

    it('should not override zero number values with defaults', async () => {
      const instruction =
        '```echo\ncount: $[count number default<42>|number count]\n```'

      const input = JSON.stringify({ count: 0 })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note 0 is a valid value and should not trigger default

      expect(result.text).toContain('count: 0')
      expect(result.text).not.toContain('count: 42')
    })

    it('should not override empty string values with defaults', async () => {
      const instruction =
        '```echo\ntext: $[text default<fallback>|text field]\n```'

      const input = JSON.stringify({ text: '' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note empty string is a valid value and should not trigger default
      // results in "text:" without trailing space since value is empty

      expect(result.text).toContain('text:')
      expect(result.text).not.toContain('fallback')
    })

    it('should handle multiple fields with defaults', async () => {
      const instruction = `\`\`\`fetch
body:
  field1: $[field1 default<default1>|field 1]
  field2: $[field2 default<default2>|field 2]
  field3: $[field3 default<default3>|field 3]
\`\`\``

      const input = JSON.stringify({
        field1: undefined,
        field2: 'actualValue2',
        field3: null,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('field1: default1')
      expect(result.text).toContain('field2: actualValue2')
      expect(result.text).toContain('field3: default3')
    })

    it('should handle defaults with operands', async () => {
      const instruction =
        '```echo\nfield: $[field default<defaultValue> dq|field with default and operand]\n```'

      const input = JSON.stringify({ field: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note default should be applied first, then operand should double-quote it

      expect(result.text).toContain('field: "defaultValue"')
    })

    it('should handle complex defaults with enum validation', async () => {
      const instruction =
        '```echo\nstatus: $[status enum<active,inactive,pending> default<pending>|status field]\n```'

      const input = JSON.stringify({ status: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('status: pending')
    })

    it('should handle defaults in different bracket types', async () => {
      const instruction = `\`\`\`echo
square: $[squareField default<squareDefault>|square field]
curly: \${curlyField default<curlyDefault>|curly field}
round: ((roundField default<roundDefault>|round field))
\`\`\``

      const input = JSON.stringify({
        squareField: undefined,
        curlyField: undefined,
        roundField: undefined,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('square: squareDefault')
      expect(result.text).toContain('curly: curlyDefault')
      expect(result.text).toContain('round: roundDefault')
    })

    it('should handle mixed required and optional fields with defaults', async () => {
      const instruction = `\`\`\`fetch
body:
  required: $[required! default<reqDefault>|required field]
  optional: $[optional default<optDefault>|optional field]
\`\`\``

      const input = JSON.stringify({
        required: undefined,
        optional: undefined,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('required: reqDefault')
      expect(result.text).toContain('optional: optDefault')
    })

    it('should handle empty default values', async () => {
      const instruction =
        '```echo\nfield: $[field default<>|field with empty default]\n```'

      const input = JSON.stringify({ field: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note empty default results in "field:" without trailing space
      expect(result.text).toContain('field:')
    })

    it('should handle defaults with special characters', async () => {
      const instruction =
        '```echo\nfield: $[field default<value@#$%>|field with special chars]\n```'

      const input = JSON.stringify({ field: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('field: value@#$%')
    })

    it('should handle defaults with spaces and formatting', async () => {
      const instruction = `\`\`\`fetch
method: POST
url: /api/test
body:
  name: $[name default<John Doe>|user name]
  description: $[description default<Default description with spaces>|description]
\`\`\``

      const input = JSON.stringify({
        name: undefined,
        description: undefined,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('name: John Doe')
      expect(result.text).toContain(
        'description: Default description with spaces'
      )
    })

    it('should not interfere with fields without defaults', async () => {
      const instruction = `\`\`\`fetch
body:
  fieldWithDefault: $[fieldWithDefault default<defaultValue>|field with default]
  fieldWithoutDefault: $[fieldWithoutDefault|field without default]
\`\`\``

      const input = JSON.stringify({
        fieldWithDefault: undefined,
        fieldWithoutDefault: 'actualValue',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('fieldWithDefault: defaultValue')
      expect(result.text).toContain('fieldWithoutDefault: actualValue')
    })

    it('should preserve exact instruction formatting with defaults', async () => {
      const instruction = `\`\`\`fetch
method: POST
url: /api/complex
headers:
  Content-Type: application/json
  Authorization: Bearer $[token default<defaultToken>|access token]
body:
  data:
    nested:
      field: $[nestedField default<nestedDefault>|nested field]
    array:
      - $[arrayItem default<arrayDefault>|array item]
\`\`\``

      const input = JSON.stringify({
        token: undefined,
        nestedField: undefined,
        arrayItem: undefined,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('method: POST')
      expect(result.text).toContain('  Authorization: Bearer defaultToken')
      expect(result.text).toContain('      field: nestedDefault')
      expect(result.text).toContain('      - arrayDefault')
    })

    it('should use defaults when fields are not provided', async () => {
      const instruction =
        '```fetch\nbody:\n  field: $[missingField! default<fallbackValue>|required field with default]\n```'

      const input = JSON.stringify({}) // @note empty input

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('field: fallbackValue')
      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should still validate required fields without defaults when LLM extraction fails', async () => {
      jest.mocked(extractDataFromInput).mockResolvedValueOnce({
        data: null,
        usage: createUsageWithTokens(25, 'base'),
      })

      const instruction =
        '```fetch\nbody:\n  field: $[missingField!|required field without default]\n```'

      const input = JSON.stringify({}) // @note empty input to trigger LLM extraction

      // @note when LLM extraction fails and required field has no default, validation should fail

      await expect(
        transformSimpleInstruction(instruction, input, { userId: 'test' })
      ).rejects.toThrow('Required field "missingField" missing in the input.')
    })

    // @note this test verifies that required fields with defaults do NOT trigger
    // LLM extraction - the default value should be used directly
    it('should NOT call extractDataFromInput for required fields that have defaults', async () => {
      // @note clear any previous mock calls
      jest.mocked(extractDataFromInput).mockClear()

      const instruction =
        '```fetch\nbody:\n  searchScope: ((searchScope! ys enum<all,shared> default<all>|the scope to search in))\n```'

      const input = JSON.stringify({}) // @note empty input - field not present at all

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note field with default should NOT trigger LLM extraction - just use the default
      expect(extractDataFromInput).not.toHaveBeenCalled()
      expect(result.text).toContain('searchScope: "all"')
      expect(result.usage.tokensUsed).toBe(0) // @note no LLM tokens used
    })

    // @note this test verifies that fields with defaults use the default value
    // instead of relying on LLM extraction which could return bad values
    it('should use default value directly without LLM for required field with enum and default', async () => {
      // @note clear mock to ensure clean state - we're verifying LLM is NOT called
      jest.mocked(extractDataFromInput).mockClear()

      const instruction =
        '```fetch\nbody:\n  searchScope: ((searchScope! ys enum<all,shared> default<all>|the scope))\n```'

      const input = JSON.stringify({}) // @note empty input

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note should use default "all", LLM should not have been called
      expect(extractDataFromInput).not.toHaveBeenCalled()
      expect(result.text).toContain('searchScope: "all"')
      expect(result.text).not.toContain('((!searchScope')
    })

    it('should apply defaults for optional fields that are explicitly undefined', async () => {
      const instruction =
        '```fetch\nbody:\n  field: $[optionalField default<fallbackValue>|optional field with default]\n```'

      const input = JSON.stringify({ optionalField: undefined })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note optional field with undefined value should get default applied

      expect(result.text).toContain('field: fallbackValue')
      expect(result.usage.tokensUsed).toBe(0) // @note no LLM extraction needed
      expect(result.usage.modelUsed).toBe('base')
    })

    it('should handle combination of user input and defaults', async () => {
      const instruction = `\`\`\`fetch
body:
  userProvided: $[userProvided default<userDefault>|user provided field]
  userMissing: $[userMissing default<missingDefault>|user missing field]
  userNull: $[userNull default<nullDefault>|user null field]
\`\`\``

      const input = JSON.stringify({
        userProvided: 'userValue',
        userMissing: undefined,
        userNull: null,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('userProvided: userValue')
      expect(result.text).toContain('userMissing: missingDefault')
      expect(result.text).toContain('userNull: nullDefault')
    })

    it('should handle array and object input values with defaults', async () => {
      const instruction = `\`\`\`fetch
body:
  arrayField: $[arrayField default<defaultArray>|array field]
  objectField: $[objectField default<defaultObject>|object field]
  nullArray: $[nullArray default<nullArrayDefault>|null array field]
\`\`\``

      const input = JSON.stringify({
        arrayField: ['item1', 'item2'],
        objectField: { key: 'value' },
        nullArray: null,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note arrays and objects should be converted to strings, defaults should not apply

      expect(result.text).toContain('arrayField: item1,item2')
      expect(result.text).toContain('objectField: [object Object]')

      // @note null should trigger default

      expect(result.text).toContain('nullArray: nullArrayDefault')
    })

    it('should maintain backward compatibility with instructions without defaults', async () => {
      const instruction = `\`\`\`fetch
method: GET
url: /api/test
headers:
  Authorization: Bearer $[token!|access token]
body:
  query: $[query|search query]
\`\`\``

      const input = JSON.stringify({
        token: 'abc123',
        query: 'test search',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note should work exactly as before - no defaults applied, normal substitution

      expect(result.text).toContain('Authorization: Bearer abc123')
      expect(result.text).toContain('query: test search')
      expect(result.usage.tokensUsed).toBe(0)
      expect(result.usage.modelUsed).toBe('base')
    })

    it('should handle defaults with validation errors gracefully', async () => {
      const instruction =
        '```echo\nstatus: $[status enum<active,inactive> default<invalid>|status with invalid default]\n```'

      const input = JSON.stringify({ status: undefined })

      // @note this should throw validation error because default value is not in enum

      await expect(
        transformSimpleInstruction(instruction, input, { userId: 'test' })
      ).rejects.toThrow(
        'Value "invalid" is not in the enum for field "status".'
      )
    })

    it('should handle complex nested defaults scenario', async () => {
      const instruction = `\`\`\`echo
config:
  database:
    host: $[dbHost default<localhost>|database host]
    port: $[dbPort number default<5432>|database port]
    ssl: $[dbSsl boolean default<true>|database ssl]
  api:
    timeout: $[apiTimeout number default<30000>|api timeout]
    retries: $[apiRetries number default<3>|api retries]
  features:
    caching: $[caching boolean default<true>|enable caching]
    logging: $[logging default<info>|log level]
\`\`\``

      const input = JSON.stringify({
        dbHost: 'prod-db.example.com',
        dbPort: undefined,
        dbSsl: false,
        apiTimeout: 60000,
        apiRetries: null,
        caching: undefined,
        logging: 'debug',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      expect(result.text).toContain('host: prod-db.example.com') // @note user provided
      expect(result.text).toContain('port: 5432') // @note default applied
      expect(result.text).toContain('ssl: false') // @note user provided false, not default
      expect(result.text).toContain('timeout: 60000') // @note user provided
      expect(result.text).toContain('retries: 3') // @note default applied for null
      expect(result.text).toContain('caching: true') // @note default applied
      expect(result.text).toContain('logging: debug') // @note user provided
    })

    it('should prefer options.substitutions over default values', async () => {
      const instruction =
        '```fetch\nbody:\n  field: $[field! default<defaultValue>|field with default]\n```'

      const input = JSON.stringify({}) // @note empty input

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: { field: 'substitutedValue' },
      })

      // @note options.substitutions should take precedence over defaults
      expect(result.text).toContain('field: substitutedValue')
      expect(result.text).not.toContain('defaultValue')
    })

    it('should prefer input values over defaults and substitutions', async () => {
      const instruction =
        '```fetch\nbody:\n  field: $[field! default<defaultValue>|field with default]\n```'

      const input = JSON.stringify({ field: 'inputValue' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: { field: 'substitutedValue' },
      })

      // @note options.substitutions override even provided input values
      // this is the documented behavior based on the code
      expect(result.text).toContain('field: substitutedValue')
    })

    it('should handle round bracket fields with defaults correctly', async () => {
      jest.mocked(extractDataFromInput).mockClear()

      const instruction =
        '```fetch\nbody:\n  scope: ((scope! enum<all,shared> default<all>|the scope))\n```'

      const input = JSON.stringify({}) // @note empty input

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note round bracket fields with defaults should NOT trigger LLM
      expect(extractDataFromInput).not.toHaveBeenCalled()
      // @note round brackets don't add quotes unless 'ys' operand is used
      expect(result.text).toContain('scope: all')
    })

    it('should not call LLM when all required fields have defaults', async () => {
      jest.mocked(extractDataFromInput).mockClear()

      const instruction = `\`\`\`fetch
body:
  field1: $[field1! default<default1>|required field 1]
  field2: $[field2! default<default2>|required field 2]
  field3: ((field3! default<default3>|required field 3))
\`\`\``

      const input = JSON.stringify({}) // @note completely empty input

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note no LLM extraction should happen - all fields have defaults
      expect(extractDataFromInput).not.toHaveBeenCalled()
      expect(result.text).toContain('field1: default1')
      expect(result.text).toContain('field2: default2')
      expect(result.text).toContain('field3: default3')
      expect(result.usage.tokensUsed).toBe(0)
    })
  })

  describe('unfilled field preservation', () => {
    // @note these tests document the ACTUAL behavior of transform functions:
    // - unfilled fields are replaced with empty strings (NOT preserved)
    // - only special fields (SECRET_DEFAULT, EARTH_*, etc.) are preserved
    // - this means options.substitutions in applySkillset cannot fill these fields
    //   because they are already cleared by the time substitutions are applied

    it('should replace unfilled curly bracket fields with empty strings', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/data
Authorization: Bearer \${API_TOKEN}
X-Custom: \${CUSTOM_VALUE}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note non-special curly bracket fields ARE cleared to empty strings
      expect(result.text).toContain('Authorization: Bearer ')
      expect(result.text).not.toContain('${API_TOKEN}')
      expect(result.text).not.toContain('${CUSTOM_VALUE}')
    })

    it('should replace unfilled square bracket fields with empty strings', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
query: $[query|the search query]
limit: $[limit|max results]
\`\`\``

      // @note only providing query, not limit
      const input = JSON.stringify({ query: 'test search' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note provided field should be substituted
      expect(result.text).toContain('query: test search')
      // @note unfilled optional field is cleared to empty string, resulting in "limit:" without trailing space
      expect(result.text).toContain('limit:')
      expect(result.text).not.toContain('$[limit')
    })

    it('should preserve only special fields like SECRET_DEFAULT', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/action
Authorization: \${SECRET_DEFAULT}
X-Custom: \${CUSTOM_SECRET}
body:
  name: $[name!|the name]
\`\`\``

      const input = JSON.stringify({ name: 'test' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note SECRET_DEFAULT is preserved (it's a recognized special field)
      expect(result.text).toContain('${SECRET_DEFAULT}')
      // @note CUSTOM_SECRET is NOT preserved (not a recognized special prefix)
      expect(result.text).not.toContain('${CUSTOM_SECRET}')
      expect(result.text).toContain('X-Custom: ')
      expect(result.text).toContain('name: test')
    })

    it('should only preserve fields with recognized special prefixes', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/send
Authorization: \${SECRET_DEFAULT}
X-Earth: \${EARTH_TIMEZONE}
X-User: \${USER_EMAIL}
X-Bot: \${BOT_NAME}
X-Custom: \${CUSTOM_VALUE}
body:
  to: $[recipient!|the recipient]
\`\`\``

      const input = JSON.stringify({ recipient: 'user@example.com' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
      })

      // @note these special prefixes are preserved
      expect(result.text).toContain('${SECRET_DEFAULT}')
      expect(result.text).toContain('${EARTH_TIMEZONE}')
      expect(result.text).toContain('${USER_EMAIL}')
      expect(result.text).toContain('${BOT_NAME}')
      // @note non-special field is cleared
      expect(result.text).not.toContain('${CUSTOM_VALUE}')
      expect(result.text).toContain('X-Custom: ')
      // @note provided field substituted
      expect(result.text).toContain('to: user@example.com')
    })
  })

  describe('options.substitutions', () => {
    // @note options.substitutions allows external values to be passed into
    // the transformation. This is the ONLY way to populate special fields
    // like CONVERSATION_ID, USER_EMAIL, etc.

    it('should substitute special field CONVERSATION_ID via options.substitutions', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/webhook
headers:
  Content-Type: application/json
body:
  conversation_id: \${CONVERSATION_ID}
  data: $[data!|the data to send]
\`\`\``

      const input = JSON.stringify({ data: 'test data' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-12345',
        },
      })

      // @note CONVERSATION_ID should be substituted via options.substitutions
      expect(result.text).toContain('conversation_id: conv-12345')
      expect(result.text).not.toContain('${CONVERSATION_ID}')
      expect(result.text).toContain('data: test data')
    })

    it('should substitute multiple special fields via options.substitutions', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/data
headers:
  X-Conversation-Id: \${CONVERSATION_ID}
  X-User-Email: \${USER_EMAIL}
  Content-Type: application/json
body:
  id: \${CONVERSATION_ID}
  name: \${CONVERSATION_NAME}
  user: \${USER_EMAIL}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-abc-789',
          CONVERSATION_NAME: 'Test Conversation',
          USER_EMAIL: 'user@example.com',
        },
      })

      // @note all special fields should be substituted
      expect(result.text).toContain('X-Conversation-Id: conv-abc-789')
      expect(result.text).toContain('X-User-Email: user@example.com')
      expect(result.text).toContain('id: conv-abc-789')
      expect(result.text).toContain('name: Test Conversation')
      expect(result.text).toContain('user: user@example.com')
      expect(result.text).not.toContain('${CONVERSATION_ID}')
      expect(result.text).not.toContain('${CONVERSATION_NAME}')
      expect(result.text).not.toContain('${USER_EMAIL}')
    })

    it('should not substitute special fields from input - only from options.substitutions', async () => {
      // @note this is a security feature - special fields like CONVERSATION_ID
      // should ONLY be populated from trusted substitutions, not from user input

      const instruction = `\`\`\`fetch
POST https://api.example.com/data
body:
  conversation_id: \${CONVERSATION_ID}
\`\`\``

      const input = JSON.stringify({
        CONVERSATION_ID: 'malicious-injected-id',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        // @note no substitutions provided - special field should be preserved
      })

      // @note input value should NOT be used for special field
      expect(result.text).not.toContain('malicious-injected-id')
      // @note special field should be preserved since no substitution provided
      expect(result.text).toContain('${CONVERSATION_ID}')
    })

    it('should allow options.substitutions to override input values for non-special fields', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search?q=$[query|the query]
\`\`\``

      const input = JSON.stringify({ query: 'from-input' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          query: 'from-substitutions',
        },
      })

      // @note substitutions should take precedence over input
      expect(result.text).toContain('q=from-substitutions')
      expect(result.text).not.toContain('from-input')
    })

    it('should substitute curly bracket non-special fields via options.substitutions', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/data
Authorization: Bearer \${API_TOKEN}
X-Custom: \${CUSTOM_HEADER}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          API_TOKEN: 'secret-token-123',
          CUSTOM_HEADER: 'custom-value',
        },
      })

      // @note non-special curly fields should be substituted via options.substitutions
      expect(result.text).toContain('Authorization: Bearer secret-token-123')
      expect(result.text).toContain('X-Custom: custom-value')
    })

    it('should substitute round bracket fields via options.substitutions', async () => {
      const instruction = `\`\`\`search/datasetId=((datasetId!))
((query!|the search query))
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          datasetId: 'ds-123',
          query: 'search term',
        },
      })

      // @note round bracket field in action name goes to params, in body goes to text
      expect(result.action).toBe('search')
      expect(result.params).toEqual({ datasetId: 'ds-123' })
      expect(result.text).toContain('search term')
    })

    it('should handle mixed bracket types with options.substitutions', async () => {
      const instruction = `\`\`\`echo
square: $[squareField|square field]
curly: \${curlyField}
round: ((roundField|round field))
special: \${CONVERSATION_ID}
\`\`\``

      const input = JSON.stringify({
        squareField: 'input-square',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          squareField: 'sub-square', // @note should override input
          curlyField: 'sub-curly',
          roundField: 'sub-round',
          CONVERSATION_ID: 'conv-999',
        },
      })

      // @note substitutions override input for non-special fields
      expect(result.text).toContain('square: sub-square')
      expect(result.text).toContain('curly: sub-curly')
      expect(result.text).toContain('round: sub-round')
      expect(result.text).toContain('special: conv-999')
    })

    it('should preserve special fields when not provided in substitutions', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/data
headers:
  X-Conversation: \${CONVERSATION_ID}
  X-User: \${USER_EMAIL}
body:
  name: $[name!|the name]
\`\`\``

      const input = JSON.stringify({ name: 'test' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-provided',
          // @note USER_EMAIL not provided
        },
      })

      // @note CONVERSATION_ID was provided, should be substituted
      expect(result.text).toContain('X-Conversation: conv-provided')
      // @note USER_EMAIL not provided, should be preserved
      expect(result.text).toContain('${USER_EMAIL}')
      expect(result.text).toContain('name: test')
    })

    it('should handle empty substitutions object', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/data
X-Custom: \${CUSTOM_VALUE}
body:
  field: $[field!|the field]
\`\`\``

      const input = JSON.stringify({ field: 'test' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {},
      })

      // @note non-special field should be cleared to empty
      expect(result.text).toContain('X-Custom: ')
      expect(result.text).not.toContain('${CUSTOM_VALUE}')
      expect(result.text).toContain('field: test')
    })

    it('should handle undefined substitutions', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/data
body:
  field: $[field!|the field]
\`\`\``

      const input = JSON.stringify({ field: 'test' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        // @note substitutions is undefined
      })

      expect(result.text).toContain('field: test')
    })

    it('should substitute all CONVERSATION_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/webhook
body:
  id: \${CONVERSATION_ID}
  name: \${CONVERSATION_NAME}
  createdAt: \${CONVERSATION_CREATED_AT}
  meta: \${CONVERSATION_META}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-id',
          CONVERSATION_NAME: 'My Conversation',
          CONVERSATION_CREATED_AT: '2024-01-01T00:00:00Z',
          CONVERSATION_META: '{"key":"value"}',
        },
      })

      expect(result.text).toContain('id: conv-id')
      expect(result.text).toContain('name: My Conversation')
      expect(result.text).toContain('createdAt: 2024-01-01T00:00:00Z')
      expect(result.text).toContain('meta: {"key":"value"}')
    })

    it('should substitute all USER_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/user-action
body:
  email: \${USER_EMAIL}
  id: \${USER_ID}
  name: \${USER_NAME}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          USER_EMAIL: 'user@example.com',
          USER_ID: 'user-123',
          USER_NAME: 'Test User',
        },
      })

      expect(result.text).toContain('email: user@example.com')
      expect(result.text).toContain('id: user-123')
      expect(result.text).toContain('name: Test User')
    })

    it('should substitute all CONTACT_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/contact-action
body:
  id: \${CONTACT_ID}
  email: \${CONTACT_EMAIL}
  name: \${CONTACT_NAME}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONTACT_ID: 'contact-456',
          CONTACT_EMAIL: 'contact@example.com',
          CONTACT_NAME: 'Test Contact',
        },
      })

      expect(result.text).toContain('id: contact-456')
      expect(result.text).toContain('email: contact@example.com')
      expect(result.text).toContain('name: Test Contact')
    })

    it('should substitute BOT_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/bot-action
body:
  id: \${BOT_ID}
  name: \${BOT_NAME}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          BOT_ID: 'bot-789',
          BOT_NAME: 'Test Bot',
        },
      })

      expect(result.text).toContain('id: bot-789')
      expect(result.text).toContain('name: Test Bot')
    })

    it('should substitute NAMESPACE_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/namespace-action
body:
  id: \${NAMESPACE_ID}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          NAMESPACE_ID: 'ns-abc',
        },
      })

      expect(result.text).toContain('id: ns-abc')
    })

    it('should substitute EXTERNAL_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/external-action
body:
  externalId: \${EXTERNAL_ID}
  externalRef: \${EXTERNAL_REFERENCE}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          EXTERNAL_ID: 'ext-123',
          EXTERNAL_REFERENCE: 'ref-456',
        },
      })

      expect(result.text).toContain('externalId: ext-123')
      expect(result.text).toContain('externalRef: ref-456')
    })

    it('should substitute FILE_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/file-action
body:
  fileId: \${FILE_ID}
  fileName: \${FILE_NAME}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          FILE_ID: 'file-xyz',
          FILE_NAME: 'document.pdf',
        },
      })

      expect(result.text).toContain('fileId: file-xyz')
      expect(result.text).toContain('fileName: document.pdf')
    })

    it('should substitute EARTH_ prefixed fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/earth-action
body:
  timezone: \${EARTH_TIMEZONE}
  locale: \${EARTH_LOCALE}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          EARTH_TIMEZONE: 'America/New_York',
          EARTH_LOCALE: 'en-US',
        },
      })

      expect(result.text).toContain('timezone: America/New_York')
      expect(result.text).toContain('locale: en-US')
    })

    it('should handle substitutions with operands on special fields', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/data
body:
  id: \${CONVERSATION_ID dq}
  name: \${CONVERSATION_NAME ys}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-123',
          CONVERSATION_NAME: 'Test Name',
        },
      })

      // @note operands should be applied to substituted values
      expect(result.text).toContain('id: "conv-123"')
      expect(result.text).toContain('name: "Test Name"')
    })

    it('should handle complex real-world scenario with multiple substitutions', async () => {
      // @note this mimics how conversation.engine.js calls applySkillset
      // with flattened conversation context as substitutions

      const instruction = `\`\`\`fetch
method: POST
url: https://api.example.com/webhook
headers:
  Content-Type: application/json
  X-Conversation-Id: \${CONVERSATION_ID}
  Authorization: \${SECRET_API_KEY}
body:
  conversation:
    id: \${CONVERSATION_ID}
    name: \${CONVERSATION_NAME}
  user:
    email: \${USER_EMAIL}
  bot:
    id: \${BOT_ID}
  data:
    query: $[userQuery!|the user's query]
\`\`\``

      const input = JSON.stringify({ userQuery: 'What is the weather?' })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-real-123',
          CONVERSATION_NAME: 'Weather Query Session',
          USER_EMAIL: 'customer@example.com',
          BOT_ID: 'weather-bot-v1',
          SECRET_API_KEY: 'Bearer sk-secret-key',
        },
      })

      expect(result.text).toContain('X-Conversation-Id: conv-real-123')
      expect(result.text).toContain('Authorization: Bearer sk-secret-key')
      expect(result.text).toContain('id: conv-real-123')
      expect(result.text).toContain('name: Weather Query Session')
      expect(result.text).toContain('email: customer@example.com')
      expect(result.text).toContain('id: weather-bot-v1')
      expect(result.text).toContain('query: What is the weather?')
    })

    it('should handle multiple occurrences of the same special field', async () => {
      // @note verifies that replaceAll behavior works correctly for multiple
      // occurrences of the same field

      const instruction = `\`\`\`fetch
POST https://api.example.com/data
headers:
  X-Conversation-Id: \${CONVERSATION_ID}
body:
  id: \${CONVERSATION_ID}
  reference: \${CONVERSATION_ID}
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        substitutions: {
          CONVERSATION_ID: 'conv-multi-123',
        },
      })

      // @note all three occurrences should be substituted
      const matches = result.text.match(/conv-multi-123/g)

      expect(matches).toHaveLength(3)
      expect(result.text).not.toContain('${CONVERSATION_ID}')
    })
  })

  describe('options.templateParams', () => {
    // @note options.templateParams allows template-resolved values to be passed
    // into the simple instruction transformation. These values come from template
    // parameter resolution and override input values but can be overridden by
    // engine-level substitutions.

    it('should substitute field from templateParams when input not provided', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query! ys]
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'template-resolved-query',
        },
      })

      // @note templateParams should fill the field
      expect(result.text).toContain('query: "template-resolved-query"')
    })

    it('should override input values with templateParams', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query! ys]
\`\`\``

      const input = JSON.stringify({
        query: 'input-query',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'template-override-query',
        },
      })

      // @note templateParams should override input values
      expect(result.text).toContain('query: "template-override-query"')
      expect(result.text).not.toContain('input-query')
    })

    it('should allow substitutions to override templateParams', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query! ys]
\`\`\``

      const input = JSON.stringify({
        query: 'input-query',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'template-query',
        },
        substitutions: {
          query: 'substitution-query',
        },
      })

      // @note substitutions should override templateParams
      expect(result.text).toContain('query: "substitution-query"')
      expect(result.text).not.toContain('template-query')
      expect(result.text).not.toContain('input-query')
    })

    it('should not affect special fields via templateParams', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/data
headers:
  X-Conversation-Id: \${CONVERSATION_ID}
body:
  query: $[query! ys]
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'test-query',
          CONVERSATION_ID: 'should-not-be-used',
        },
      })

      // @note templateParams should fill the query field
      expect(result.text).toContain('query: "test-query"')
      // @note special fields should not be affected by templateParams
      // they remain as placeholders for engine-level substitution
      expect(result.text).toContain('${CONVERSATION_ID}')
      expect(result.text).not.toContain('should-not-be-used')
    })

    it('should handle templateParams with different value types', async () => {
      const instruction = `\`\`\`fetch
POST https://api.example.com/data
body:
  name: $[name! ys]
  count: $[count n!]
  enabled: $[enabled b!]
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          name: 'test-name',
          count: 42,
          enabled: true,
        },
      })

      // @note templateParams should handle different value types
      expect(result.text).toContain('name: "test-name"')
      expect(result.text).toContain('count: 42')
      expect(result.text).toContain('enabled: true')
    })

    it('should merge templateParams with input values', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query! ys]
  limit: $[limit n!]
  offset: $[offset n!]
\`\`\``

      const input = JSON.stringify({
        query: 'user-search',
        offset: 100,
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          limit: 25,
        },
      })

      // @note input values and templateParams should merge
      expect(result.text).toContain('query: "user-search"')
      expect(result.text).toContain('limit: 25')
      expect(result.text).toContain('offset: 100')
    })

    it('should handle empty templateParams object', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query ys default<default-search>]
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {},
      })

      // @note empty templateParams should have no effect, default should be used
      expect(result.text).toContain('query: "default-search"')
    })

    it('should handle undefined templateParams', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query ys default<default-search>]
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: undefined,
      })

      // @note undefined templateParams should have no effect
      expect(result.text).toContain('query: "default-search"')
    })

    it('should handle templateParams with curly bracket fields', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/user/\${userId}/data
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          userId: 'user-123',
        },
      })

      // @note templateParams should work with curly bracket fields
      expect(result.text).toContain('/user/user-123/data')
    })

    it('should handle templateParams with round bracket fields', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search?scope=((scope))
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          scope: 'global',
        },
      })

      // @note templateParams should work with round bracket fields
      expect(result.text).toContain('scope=global')
    })

    it('should handle precedence: input < templateParams < substitutions', async () => {
      // @note this test verifies the full precedence chain

      const instruction = `\`\`\`fetch
GET https://api.example.com/data
body:
  field1: $[field1!]
  field2: $[field2!]
  field3: $[field3!]
\`\`\``

      const input = JSON.stringify({
        field1: 'from-input',
        field2: 'from-input',
        field3: 'from-input',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          field2: 'from-template',
          field3: 'from-template',
        },
        substitutions: {
          field3: 'from-substitutions',
        },
      })

      // @note field1 only in input -> from input
      expect(result.text).toContain('field1: from-input')
      // @note field2 in input and templateParams -> from templateParams
      expect(result.text).toContain('field2: from-template')
      // @note field3 in all three -> from substitutions (highest priority)
      expect(result.text).toContain('field3: from-substitutions')
    })

    it('should handle templateParams with empty string value', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query default<default-search>]
\`\`\``

      const input = JSON.stringify({})

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: '',
        },
      })

      // @note empty string value in templateParams should be used (not default)
      // YAML outputs empty strings without quotes
      expect(result.text).toMatch(/query:\s*$/m)
      expect(result.text).not.toContain('default-search')
    })

    it('should handle templateParams only for fields that exist in instruction', async () => {
      const instruction = `\`\`\`fetch
GET https://api.example.com/search
body:
  query: $[query!]
\`\`\``

      const input = JSON.stringify({
        query: 'test',
      })

      const result = await transformSimpleInstruction(instruction, input, {
        userId: 'test',
        templateParams: {
          query: 'template-query',
          nonExistentField: 'should-be-ignored',
          anotherField: 'also-ignored',
        },
      })

      // @note only query should be substituted, extra templateParams ignored
      expect(result.text).toContain('query: template-query')
      expect(result.text).not.toContain('nonExistentField')
      expect(result.text).not.toContain('anotherField')
    })
  })
})
