import _fetch from '@/lib/fetch'
import { getOpenAIError } from '@/lib/model.provider.openai'
import {
  decide,
  fromSystemOneAnswers,
  toSystemOneQuestions,
} from '@/lib/model.provider.typesafe'

jest.mock('@/lib/fetch', () => {
  const actual = jest.fn()

  return {
    __esModule: true,
    default: actual,
    withRetry: jest.fn((fn) => fn),
    withTimeout: jest.fn((fn) => fn),
  }
})

jest.mock('@/lib/model.provider.openai', () => ({
  getOpenAIError: jest.fn(
    (error) => new Error(String(error.response.data.error.message))
  ),
}))

const questions = {
  urgent: {
    type: 'boolean',
    instructions: 'Does this convey urgency?',
    criteria: { true: 'time-sensitive', false: null },
  },
  department: {
    type: 'choice',
    instructions: 'Which team should handle this',
    criteria: { billing: 'payments', technical: null },
  },
  frustration: {
    type: 'score',
    instructions: 'How frustrated the customer appears',
    criteria: ['calm', 'frustrated', 'angry'],
  },
}

const systemOneAnswers = {
  urgent: { type: 'noul', noul: 0.999 },
  department: {
    type: 'choice',
    choice: 'billing',
    probabilities: { billing: 0.84, technical: 0.16 },
    confidence: 0.596,
  },
  frustration: {
    type: 'score',
    score: 1.035,
    legend: { 0: 'calm', 1: 'frustrated', 2: 'angry' },
    probabilities: { 0: 0.1, 1: 0.7, 2: 0.2 },
    confidence: 0.842,
  },
}

describe('toSystemOneQuestions', () => {
  it('renames the boolean type to noul and carries everything else as is', () => {
    expect(toSystemOneQuestions(questions)).toEqual({
      urgent: { ...questions.urgent, type: 'noul' },
      department: questions.department,
      frustration: questions.frustration,
    })
  })
})

describe('fromSystemOneAnswers', () => {
  it('maps noul to a boolean probability and drops provider-only fields', () => {
    expect(fromSystemOneAnswers(systemOneAnswers)).toEqual({
      urgent: { type: 'boolean', probability: 0.999 },
      department: {
        type: 'choice',
        choice: 'billing',
        probabilities: { billing: 0.84, technical: 0.16 },
      },
      frustration: {
        type: 'score',
        score: 1.035,
        probabilities: { 0: 0.1, 1: 0.7, 2: 0.2 },
      },
    })
  })

  it('returns no answers when the provider sends none', () => {
    expect(fromSystemOneAnswers(undefined)).toEqual({})
  })

  it('refuses an answer type it does not know', () => {
    expect(() => fromSystemOneAnswers({ q: { type: 'text' } })).toThrow(
      'Unrecognized answer type text'
    )
  })
})

describe('decide', () => {
  const original = process.env.TYPESAFE_MODELS_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()

    process.env.TYPESAFE_MODELS_API_KEY = 'test-typesafe-key'

    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'jev-1.13.0',
        answers: systemOneAnswers,
        usage: { input_tokens: 312, output_tokens: 48 },
      }),
    })
  })

  afterAll(() => {
    if (original === undefined) {
      delete process.env.TYPESAFE_MODELS_API_KEY
    } else {
      process.env.TYPESAFE_MODELS_API_KEY = original
    }
  })

  it('must post the model, state and System One questions to the systemone endpoint', async () => {
    await decide({ state: 'help asap', questions, model: 'jev-latest' })

    // @ts-ignore
    const [url, init] = _fetch.mock.calls[0]

    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer test-typesafe-key')
    expect(JSON.parse(init.body)).toEqual({
      model: 'jev-latest',
      state: 'help asap',
      questions: toSystemOneQuestions(questions),
    })
  })

  it('must return platform answers and camel-cased usage', async () => {
    const result = await decide({
      state: 'help asap',
      questions,
      model: 'jev-latest',
    })

    expect(result.answers.urgent).toEqual({
      type: 'boolean',
      probability: 0.999,
    })
    expect(result.usage).toEqual({
      model: 'jev-latest',
      inputTokens: 312,
      outputTokens: 48,
    })
  })

  it('must fail with a configuration error when no key is set', async () => {
    delete process.env.TYPESAFE_MODELS_API_KEY

    await expect(
      decide({ state: 'help asap', questions, model: 'jev-latest' })
    ).rejects.toThrow()

    expect(_fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['an OpenAI-style body', { error: { message: 'criteria is required' } }, 'criteria is required'],
    ['a plain message', { message: 'state is too long' }, 'state is too long'],
    ['a string detail', { detail: 'unknown model' }, 'unknown model'],
    [
      'a structured detail',
      { detail: [{ loc: ['questions', 'q', 'criteria'], msg: 'too few levels' }] },
      '[{"loc":["questions","q","criteria"],"msg":"too few levels"}]',
    ],
  ])('must keep the reason the API gives in %s', async (_name, body, message) => {
    // @ts-ignore
    _fetch.mockResolvedValue({ ok: false, status: 422, json: async () => body })

    await expect(
      decide({ state: 'help asap', questions, model: 'jev-latest' })
    ).rejects.toThrow(message)

    expect(getOpenAIError).toHaveBeenCalledWith(
      { response: { status: 422, data: { error: { message } } } },
      { errorPrefix: 'TS_' }
    )
  })

  it('must fall back to the status when the body explains nothing', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: false,
      status: 529,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(
      decide({ state: 'help asap', questions, model: 'jev-latest' })
    ).rejects.toThrow()

    expect(getOpenAIError).toHaveBeenCalledWith(
      { response: { status: 529, data: { error: { message: undefined } } } },
      { errorPrefix: 'TS_' }
    )
  })
})
