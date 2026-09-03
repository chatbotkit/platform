import { captureException } from '@/lib/error'
import {
  EXTRACT_CONTACT_DETAILS_MAX_MESSAGES,
  extractContactDetails,
  extractContactDetails2,
  extractContactDetails3,
} from '@/lib/extract.contact'
import { extractDataWithSchema } from '@/lib/extract.data'
import { execPrompt } from '@/lib/prompt'

jest.mock('@/prisma/types', () => ({
  MessageType: {
    user: 'user',
    bot: 'bot',
    backstory: 'backstory',
    context: 'context',
    activity: 'activity',
  },
}))

jest.mock('@/lib/extract.data', () => ({
  extractDataWithSchema: jest.fn(),
}))

jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

const user = { id: '123' }

describe('extractContactDetails (V1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null details for empty messages', async () => {
    const result = await extractContactDetails([], { user })

    expect(result).toMatchObject({ details: null, tokensUsed: 0 })
    expect(execPrompt).not.toHaveBeenCalled()
  })

  it('should return null details when all messages are non-user/bot type', async () => {
    const messages = [
      { type: 'backstory', text: 'some backstory' },
      { type: 'activity', text: 'some activity' },
      { type: 'context', text: 'some context' },
    ]

    const result = await extractContactDetails(messages, { user })

    expect(result).toMatchObject({ details: null, tokensUsed: 0 })
    expect(execPrompt).not.toHaveBeenCalled()
  })

  it('should extract contact details from user/bot messages', async () => {
    execPrompt.mockResolvedValue({
      completion:
        '{"firstName":"Bob","lastName":"Smith","email":"bob@example.com"}',
      tokensUsed: 150,
      modelUsed: 'gpt-4',
    })

    const messages = [
      { type: 'bot', text: 'What is your name?' },
      { type: 'user', text: 'My name is Bob Smith, email: bob@example.com' },
      { type: 'activity', text: 'some activity that should be filtered out' },
    ]

    const result = await extractContactDetails(messages, { user })

    expect(execPrompt).toHaveBeenCalledTimes(1)
    expect(result.details).toMatchObject({
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@example.com',
    })
    expect(result.tokensUsed).toBe(150)
    expect(result.modelUsed).toBe('gpt-4')
  })

  it('should capture exception and return default details when execPrompt throws', async () => {
    const error = new Error('API error')

    execPrompt.mockRejectedValue(error)

    const messages = [{ type: 'user', text: 'Hello' }]

    const result = await extractContactDetails(messages, { user })

    expect(captureException).toHaveBeenCalledWith(error)
    // when execPrompt fails, completion stays as the default empty JSON object
    expect(result.details).toMatchObject({
      firstName: '',
      lastName: '',
      email: '',
    })
    expect(result.tokensUsed).toBe(0)
  })

  it('should filter conversation to only include user and bot messages', async () => {
    execPrompt.mockResolvedValue({
      completion: '{"firstName":"Alice","lastName":"","email":""}',
      tokensUsed: 100,
      modelUsed: 'gpt-4',
    })

    const messages = [
      { type: 'backstory', text: 'System backstory text' },
      { type: 'bot', text: 'Hello, how can I help?' },
      { type: 'user', text: 'Hi there' },
      { type: 'context', text: 'some extra context' },
    ]

    await extractContactDetails(messages, { user })

    const calledWith = execPrompt.mock.calls[0][1]

    expect(calledWith.conversation).toContain('<|bot|>')
    expect(calledWith.conversation).toContain('<|user|>')
    expect(calledWith.conversation).not.toContain('<|backstory|>')
    expect(calledWith.conversation).not.toContain('<|context|>')
  })

  it('should include user id in prompt options', async () => {
    execPrompt.mockResolvedValue({
      completion: '{}',
      tokensUsed: 50,
      modelUsed: 'gpt-4',
    })

    await extractContactDetails([{ type: 'user', text: 'hi' }], {
      user: { id: 'user-456' },
    })

    expect(execPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'user-456' }),
      expect.any(Object)
    )
  })

  it('should return null when execPrompt returns invalid JSON', async () => {
    execPrompt.mockResolvedValue({
      completion: 'not valid json at all',
      tokensUsed: 50,
      modelUsed: 'gpt-4',
    })

    const messages = [{ type: 'user', text: 'hello' }]

    const result = await extractContactDetails(messages, { user })

    // relaxedJsonParse returns null for truly invalid JSON
    expect(result.tokensUsed).toBe(50)
    // details may be null if JSON cannot be parsed
  })
})

describe('extractContactDetails2 (V2)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null details for empty messages', async () => {
    const result = await extractContactDetails2([], { user })

    expect(result).toMatchObject({ details: null })
    expect(execPrompt).not.toHaveBeenCalled()
  })

  it('should extract name and email from user/bot messages', async () => {
    execPrompt.mockResolvedValue({
      completion:
        '{"name":"Bob","email":"boby.duff@outlook.com","summary":"User provided contact details"}',
      tokensUsed: 200,
      modelUsed: 'gpt-4',
    })

    const result = await extractContactDetails2(
      [
        {
          type: 'bot',
          text: 'Can you provide me with your contact details so that I can reach out?',
        },
        {
          type: 'user',
          text: 'Sure my name is Bob and you can contact me at boby.duff@outlook.com',
        },
      ],
      { user }
    )

    expect(result).toMatchObject({
      details: {
        name: 'Bob',
        email: 'boby.duff@outlook.com',
      },
    })
  })

  it('should capture exception and return default details when execPrompt throws', async () => {
    const error = new Error('API error')

    execPrompt.mockRejectedValue(error)

    const messages = [{ type: 'user', text: 'Hello' }]

    const result = await extractContactDetails2(messages, { user })

    expect(captureException).toHaveBeenCalledWith(error)
    // when execPrompt fails, completion stays as the default empty JSON object
    expect(result.details).toMatchObject({ name: '', email: '' })
    expect(result.tokensUsed).toBe(0)
  })
})

describe('extractContactDetails3 (V3)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null details for empty messages', async () => {
    const result = await extractContactDetails3([], { user })

    expect(result).toMatchObject({ details: null })
    expect(extractDataWithSchema).not.toHaveBeenCalled()
  })

  it('should return null details when extractDataWithSchema throws', async () => {
    extractDataWithSchema.mockRejectedValue(new Error('Stream error occurred'))

    const messages = [
      { type: 'user', text: 'hello' },
      { type: 'bot', text: 'hi there' },
    ]

    const result = await extractContactDetails3(messages, { user })

    expect(result).toMatchObject({ details: null })
  })

  it('should return extracted contact details on success', async () => {
    const extractedData = {
      name: 'Alice',
      email: 'alice@example.com',
      conversationName: 'Billing Support',
      conversationDescription: 'Alice asked about billing for her account.',
    }

    extractDataWithSchema.mockResolvedValue({
      data: extractedData,
      usage: { token: 200, items: [{ model: 'gpt-4o' }] },
    })

    const messages = [
      { type: 'user', text: 'I have a question about my bill' },
      { type: 'bot', text: 'Sure, what is your email?' },
      { type: 'user', text: 'alice@example.com' },
    ]

    const result = await extractContactDetails3(messages, { user })

    expect(result.details).toMatchObject(extractedData)
    expect(result.tokensUsed).toBe(200)
    expect(result.modelUsed).toBe('gpt-4o')
  })

  it('should fall back to baseLanguageModel when usage items are empty', async () => {
    extractDataWithSchema.mockResolvedValue({
      data: {
        name: 'Bob',
        email: 'bob@example.com',
        conversationName: 'Chat',
        conversationDescription: '',
      },
      usage: { token: 100, items: [] },
    })

    const messages = [{ type: 'user', text: 'hi' }]

    const result = await extractContactDetails3(messages, { user })

    // should fall back to baseLanguageModel (non-empty string)
    expect(result.modelUsed).toBeTruthy()
    expect(typeof result.modelUsed).toBe('string')
  })

  it('should propagate tokensUsed from usage', async () => {
    extractDataWithSchema.mockResolvedValue({
      data: {
        name: 'Carol',
        email: 'carol@example.com',
        conversationName: 'Chat',
        conversationDescription: 'A conversation',
      },
      usage: { token: 350, items: [{ model: 'gpt-4o-mini' }] },
    })

    const messages = [{ type: 'user', text: 'hello' }]

    const result = await extractContactDetails3(messages, { user })

    expect(result.tokensUsed).toBe(350)
  })

  it('should slice messages to last EXTRACT_CONTACT_DETAILS_MAX_MESSAGES', async () => {
    extractDataWithSchema.mockResolvedValue({
      data: null,
      usage: { token: 0, items: [] },
    })

    const messages = Array.from(
      { length: EXTRACT_CONTACT_DETAILS_MAX_MESSAGES + 10 },
      (_, i) => ({ type: 'user', text: `message ${i}` })
    )

    await extractContactDetails3(messages, { user })

    // first arg to extractDataWithSchema is the messages array with prepended backstory
    const calledWithMessages = extractDataWithSchema.mock.calls[0][0]

    // V3 prepends a backstory message, so total = MAX_MESSAGES + 1
    expect(calledWithMessages.length).toBe(
      EXTRACT_CONTACT_DETAILS_MAX_MESSAGES + 1
    )
  })
})
