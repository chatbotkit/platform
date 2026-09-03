// @note the image cases are gone with the image path. Nothing could reach it -
// no catalogue entry ever named `bedrock` as an image provider - so these were
// asserting on a branch production could not enter, which is what kept it
// looking alive. See the note in model.provider.bedrock.ts.

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: jest.fn(() => ({})),
}))

jest.mock('@/lib/debug', () => jest.fn())

jest.mock('@/lib/model.provider.openai', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
}))

describe('model.provider.bedrock', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.BEDROCK_MODELS_API_KEY = 'env-key'
    process.env.BEDROCK_API_URL = 'https://env-bedrock/v1/chat/completions'
  })

  async function importModule(store = {}) {
    const { getSafeModelStore } = await import('@/lib/model.context')

    getSafeModelStore.mockReturnValue(store)

    return import('./model.provider.bedrock')
  }

  it('should resolve api key from env when no store override exists', async () => {
    const bedrockProvider = await importModule({})

    expect(bedrockProvider.getBedrockAPIKey()).toBe('env-key')
  })

  it('should resolve api key from model store and log override usage', async () => {
    const debug = (await import('@/lib/debug')).default
    const bedrockProvider = await importModule({ bedrockKey: 'store-key' })

    expect(bedrockProvider.getBedrockAPIKey()).toBe('store-key')
    expect(debug).toHaveBeenCalledWith('using custom bedrock key')
  })

  it('should resolve api url with fallback to default', async () => {
    delete process.env.BEDROCK_API_URL

    const bedrockProvider = await importModule({})

    expect(bedrockProvider.getBedrockAPIUrl()).toBe(
      'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1/chat/completions'
    )
  })

  it('should resolve api url from store and log override usage', async () => {
    const debug = (await import('@/lib/debug')).default
    const bedrockProvider = await importModule({
      bedrockUrl: 'https://store-bedrock/v1/chat/completions',
    })

    expect(bedrockProvider.getBedrockAPIUrl()).toBe(
      'https://store-bedrock/v1/chat/completions'
    )
    expect(debug).toHaveBeenCalledWith('using custom bedrock url')
  })

  it('should delegate createChatCompletion with bedrock auth and prefix', async () => {
    const { createChatCompletion } = await import('@/lib/model.provider.openai')

    createChatCompletion.mockResolvedValue({ completion: 'ok' })

    const bedrockProvider = await importModule({})
    const options = { model: 'test-model', messages: [] }

    await bedrockProvider.createChatCompletion(options)

    expect(createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        messages: [],
        url: 'https://env-bedrock/v1/chat/completions',
        authorization: 'Bearer env-key',
        errorPrefix: 'BR_',
      })
    )
  })

  it('should delegate createChatCompletionStream with bedrock auth and prefix', async () => {
    const { createChatCompletionStream } = await import('@/lib/model.provider.openai')

    createChatCompletionStream.mockResolvedValue({})

    const bedrockProvider = await importModule({})
    const options = { model: 'test-model', messages: [] }

    await bedrockProvider.createChatCompletionStream(options)

    expect(createChatCompletionStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        messages: [],
        url: 'https://env-bedrock/v1/chat/completions',
        authorization: 'Bearer env-key',
        errorPrefix: 'BR_',
      })
    )
  })

})
