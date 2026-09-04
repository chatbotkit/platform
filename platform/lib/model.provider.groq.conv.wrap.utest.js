jest.mock('@/lib/model.provider.groq.adaptor', () => ({
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai.conv', () => ({
  completeChatConversation: jest.fn(),
  completeConversation: jest.fn(),
}))

async function* streamOf(items) {
  for (const item of items) {
    yield item
  }
}

async function collect(it) {
  const items = []

  for await (const item of it) {
    items.push(item)
  }

  return items
}

function botMessage(text) {
  return { type: 'message', data: { type: 'bot', text } }
}

describe('completeChatConversation (deepseek wrapper)', () => {
  let completeChatConversation
  let completeChatConversationCompatibleWithOpenAI

  beforeAll(async () => {
    // @note model names only exist in the catalogue when their provider key
    // is configured, and the catalogue is built at module load. The wrapper
    // keys on the name containing "deepseek", which the DeepSeek catalogue
    // supplies; groq itself lists no such model.
    process.env.GROQ_MODELS_API_KEY = 'test-key'
    process.env.DEEPSEEK_MODELS_API_KEY = 'test-key'

    jest.resetModules()
    ;({ completeChatConversation } = await import(
      '@/lib/model.provider.groq.conv'
    ))
    ;({
      completeChatConversation: completeChatConversationCompatibleWithOpenAI,
    } = await import('@/lib/model.provider.openai.conv'))
  })

  afterAll(() => {
    delete process.env.GROQ_MODELS_API_KEY
    delete process.env.DEEPSEEK_MODELS_API_KEY
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should strip a completed think block from bot messages', async () => {
    completeChatConversationCompatibleWithOpenAI.mockReturnValue(
      streamOf([
        botMessage('<think>some\nmulti-line\nreasoning</think>\n\nhello'),
      ])
    )

    const items = await collect(
      completeChatConversation({ model: 'deepseek-v4-pro', messages: [] })
    )

    expect(items).toEqual([botMessage('hello')])
  })

  it('should leave bot messages without a think block untouched', async () => {
    completeChatConversationCompatibleWithOpenAI.mockReturnValue(
      streamOf([
        botMessage('hello'),
        { type: 'message', data: { type: 'user', text: '<think>x</think>' } },
      ])
    )

    const items = await collect(
      completeChatConversation({ model: 'deepseek-v4-pro', messages: [] })
    )

    expect(items).toEqual([
      botMessage('hello'),
      { type: 'message', data: { type: 'user', text: '<think>x</think>' } },
    ])
  })

  it('should not backtrack exponentially on an unterminated think block', async () => {
    // @note the previous `(.|\s)*?` pattern was ambiguous on whitespace and
    // took time exponential in the number of spaces once the closing tag was
    // missing; sixty-four spaces would never finish
    const text = '<think>' + ' '.repeat(64) + 'still thinking'

    completeChatConversationCompatibleWithOpenAI.mockReturnValue(
      streamOf([botMessage(text)])
    )

    const started = Date.now()

    const items = await collect(
      completeChatConversation({ model: 'deepseek-v4-pro', messages: [] })
    )

    expect(Date.now() - started).toBeLessThan(1000)
    expect(items).toEqual([botMessage(text)])
  })

  it('should pass the stream through unchanged for non-deepseek models', async () => {
    const text = '<think>reasoning</think>\n\nhello'

    completeChatConversationCompatibleWithOpenAI.mockReturnValue(
      streamOf([botMessage(text)])
    )

    const items = await collect(
      completeChatConversation({ model: 'llama-3.3-70b', messages: [] })
    )

    expect(items).toEqual([botMessage(text)])
  })
})
