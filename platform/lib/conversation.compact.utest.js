/* eslint-disable @typescript-eslint/no-require-imports */
import { COMPACT_SCHEMA, compactMessages } from '@/lib/conversation.compact'

jest.mock('@/lib/extract.data', () => ({
  extractData: jest.fn(),
}))

const { extractData } = require('@/lib/extract.data')

const USER = { id: 'user-1' }
const OPTIONS = { user: USER, usageReferences: { conversationId: 'conv-1' } }

const MESSAGES = [
  { type: 'human', text: 'Hello' },
  { type: 'bot', text: 'Hi there' },
]

describe('COMPACT_SCHEMA', () => {
  it('should be a valid JSON schema object with a required summary field', () => {
    expect(COMPACT_SCHEMA.type).toBe('object')
    expect(COMPACT_SCHEMA.properties).toHaveProperty('summary')
    expect(COMPACT_SCHEMA.required).toContain('summary')
  })
})

describe('compactMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return a null summary when messages array is empty', async () => {
    const result = await compactMessages([], OPTIONS)

    expect(result.summary).toBeNull()
    expect(extractData).not.toHaveBeenCalled()
  })

  it('should call extractData with messages and COMPACT_SCHEMA', async () => {
    extractData.mockResolvedValue({ data: { summary: 'A summary' } })

    await compactMessages(MESSAGES, OPTIONS)

    expect(extractData).toHaveBeenCalledWith(MESSAGES, COMPACT_SCHEMA, OPTIONS)
  })

  it('should return the trimmed summary string on success', async () => {
    extractData.mockResolvedValue({ data: { summary: '  A summary  ' } })

    const result = await compactMessages(MESSAGES, OPTIONS)

    expect(result.summary).toBe('A summary')
  })

  it('should forward the usage from extractData', async () => {
    const usage = { token: 123 }

    extractData.mockResolvedValue({ data: { summary: 'A summary' }, usage })

    const result = await compactMessages(MESSAGES, OPTIONS)

    expect(result.usage).toBe(usage)
  })

  it('should return a null summary when data is null', async () => {
    extractData.mockResolvedValue({ data: null })

    const result = await compactMessages(MESSAGES, OPTIONS)

    expect(result.summary).toBeNull()
  })

  it('should return a null summary when summary is missing from data', async () => {
    extractData.mockResolvedValue({ data: {} })

    const result = await compactMessages(MESSAGES, OPTIONS)

    expect(result.summary).toBeNull()
  })

  it('should return a null summary when summary is an empty string after trimming', async () => {
    extractData.mockResolvedValue({ data: { summary: '   ' } })

    const result = await compactMessages(MESSAGES, OPTIONS)

    expect(result.summary).toBeNull()
  })

  it('should return a null summary when summary is not a string', async () => {
    extractData.mockResolvedValue({ data: { summary: 42 } })

    const result = await compactMessages(MESSAGES, OPTIONS)

    expect(result.summary).toBeNull()
  })

  it('should forward options to extractData', async () => {
    extractData.mockResolvedValue({ data: { summary: 'summary' } })

    const options = { user: { id: 'u-2' }, usageReferences: { botId: 'b-1' } }

    await compactMessages(MESSAGES, options)

    expect(extractData).toHaveBeenCalledWith(MESSAGES, COMPACT_SCHEMA, options)
  })
})
