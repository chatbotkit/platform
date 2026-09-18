import _fetch from '@/lib/fetch'
import { throwOpenAIError } from '@/lib/model.provider.openai'
import { decide } from '@/lib/model.provider.openrouter'

jest.mock('@/lib/fetch', () => {
  const actual = jest.fn()

  return {
    __esModule: true,
    default: actual,
    withRetry: jest.fn((fn) => fn),
    withTimeout: jest.fn((fn) => fn),
  }
})

jest.mock('@/config/site', () => ({
  siteUrl: 'https://site.example',
  siteHostname: 'site.example',
}))

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: () => ({}),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
  throwOpenAIError: jest.fn(),
}))

const questions = {
  urgent: { type: 'boolean', instructions: 'Does this convey urgency?' },
  department: {
    type: 'choice',
    instructions: 'Which team should handle this',
    criteria: { billing: 'payments', technical: null },
  },
}

describe('decide', () => {
  const original = process.env.OPENROUTER_MODELS_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()

    process.env.OPENROUTER_MODELS_API_KEY = 'test-openrouter-key'

    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'typesafe/jev-1.13',
        answers: {
          urgent: { type: 'noul', noul: 0.93 },
          department: {
            type: 'choice',
            choice: 'billing',
            confidence: 0.6,
            probabilities: { billing: 0.84, technical: 0.16 },
          },
        },
        usage: { input_tokens: 312, output_tokens: 48, cost: 0.00001 },
      }),
    })
  })

  afterAll(() => {
    if (original === undefined) {
      delete process.env.OPENROUTER_MODELS_API_KEY
    } else {
      process.env.OPENROUTER_MODELS_API_KEY = original
    }
  })

  it('must post noul questions to the alpha decisions endpoint', async () => {
    await decide({
      state: [{ role: 'user', content: 'help asap' }],
      questions,
      model: '~typesafe/jev-latest',
    })

    // @ts-ignore
    const [url, init] = _fetch.mock.calls[0]

    expect(url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(init.headers.Authorization).toBe('Bearer test-openrouter-key')
    expect(JSON.parse(init.body)).toEqual({
      model: '~typesafe/jev-latest',
      state: [{ role: 'user', content: 'help asap' }],
      questions: {
        urgent: { type: 'noul', instructions: 'Does this convey urgency?' },
        department: questions.department,
      },
    })
  })

  it('must not request zero data retention, which the only provider cannot route', async () => {
    await decide({ state: 's', questions, model: '~typesafe/jev-latest' })

    // @ts-ignore
    const body = JSON.parse(_fetch.mock.calls[0][1].body)

    expect(body.provider).toBeUndefined()
    expect(body.zdr).toBeUndefined()
  })

  it('must carry catalogue provider options as routing preferences', async () => {
    await decide({
      state: 's',
      questions,
      model: '~typesafe/jev-latest',
      modelOptions: { data_collection: 'deny' },
    })

    // @ts-ignore
    expect(JSON.parse(_fetch.mock.calls[0][1].body).provider).toEqual({
      data_collection: 'deny',
    })
  })

  it('must return platform answers and camel-cased usage', async () => {
    const result = await decide({
      state: 's',
      questions,
      model: '~typesafe/jev-latest',
    })

    expect(result).toEqual({
      answers: {
        urgent: { type: 'boolean', probability: 0.93 },
        department: {
          type: 'choice',
          choice: 'billing',
          probabilities: { billing: 0.84, technical: 0.16 },
        },
      },
      usage: {
        model: '~typesafe/jev-latest',
        inputTokens: 312,
        outputTokens: 48,
      },
    })
  })

  it('must surface provider failures through the provider error path', async () => {
    const response = { ok: false, status: 402 }

    // @ts-ignore
    _fetch.mockResolvedValue(response)

    await decide({ state: 's', questions, model: '~typesafe/jev-latest' })

    expect(throwOpenAIError).toHaveBeenCalledWith(response, {
      errorPrefix: 'OR_',
    })
  })
})
