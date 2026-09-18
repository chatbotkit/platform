import _fetch from '@/lib/fetch'
import { decide } from '@/lib/model.provider.vercel'
import { throwOpenAIError } from '@/lib/model.provider.openai'

jest.mock('@/lib/fetch', () => {
  const actual = jest.fn()

  // @ts-ignore
  actual.withRetry = jest.fn((fn) => fn)
  // @ts-ignore
  actual.withTimeout = jest.fn((fn) => fn)
  // @ts-ignore
  actual.withBodyTimeout = jest.fn((fn) => fn)

  return {
    __esModule: true,
    default: actual,
    // @ts-ignore
    withRetry: actual.withRetry,
    // @ts-ignore
    withTimeout: actual.withTimeout,
    // @ts-ignore
    withBodyTimeout: actual.withBodyTimeout,
  }
})

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: () => ({}),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
  throwOpenAIError: jest.fn(),
}))

const state = [{ role: 'user', content: 'I was charged twice' }]

const questions = {
  refunded: { type: 'boolean', instructions: 'Was a refund issued?' },
  topic: {
    type: 'choice',
    instructions: 'What is the topic?',
    criteria: { billing: 'payments', technical: 'bugs' },
  },
}

const answers = {
  refunded: { type: 'boolean', probability: 0.02 },
  topic: {
    type: 'choice',
    choice: 'billing',
    probabilities: { billing: 0.99, technical: 0.01 },
  },
}

describe('decide', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.VERCEL_MODELS_API_KEY = 'test-vercel-key'

    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        answers,
        usage: { inputTokens: 283, outputTokens: 21 },
      }),
    })
  })

  it('must target the gateway decision-model protocol with the model id header', async () => {
    await decide({ state, questions, model: 'typesafe-ai/jev' })

    // @ts-ignore
    const [url, init] = _fetch.mock.calls[0]

    expect(url).toBe('https://ai-gateway.vercel.sh/v4/ai/evaluation-model')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer test-vercel-key',
        'ai-evaluation-model-specification-version': '4',
        'ai-model-id': 'typesafe-ai/jev',
      })
    )
  })

  it('must send the state and questions unserialised, and provider options only when set', async () => {
    await decide({ state, questions, model: 'typesafe-ai/jev' })

    // @ts-ignore
    expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual({
      state,
      questions,
    })

    await decide({
      state,
      questions,
      model: 'typesafe-ai/jev',
      modelOptions: { gateway: { only: ['typesafe-ai'] } },
    })

    // @ts-ignore
    expect(JSON.parse(_fetch.mock.calls[1][1].body)).toEqual({
      state,
      questions,
      providerOptions: { gateway: { only: ['typesafe-ai'] } },
    })
  })

  it('must return the answers and the reported token usage', async () => {
    const result = await decide({ state, questions, model: 'typesafe-ai/jev' })

    expect(result).toEqual({
      answers,
      usage: { model: 'typesafe-ai/jev', inputTokens: 283, outputTokens: 21 },
    })
  })

  it('must default the usage to zero when the gateway reports none', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({ ok: true, json: async () => ({ answers }) })

    const result = await decide({ state, questions, model: 'typesafe-ai/jev' })

    expect(result.usage).toEqual({
      model: 'typesafe-ai/jev',
      inputTokens: 0,
      outputTokens: 0,
    })
  })

  it('must surface gateway failures through the provider error path', async () => {
    const response = { ok: false, status: 400 }

    // @ts-ignore
    _fetch.mockResolvedValue(response)

    await decide({ state, questions, model: 'typesafe-ai/jev' })

    expect(throwOpenAIError).toHaveBeenCalledWith(response, {
      errorPrefix: 'VR_',
    })
  })
})
