/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import {
  PADDING_RATIO,
  bodySchema,
  default as handler,
} from '@/pages/api/v1/text/complete'

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@chatbotkit-dev/gpt', () => ({
  getTextTokensLength: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createTextCompletion: jest.fn(),
  getOpenAIError: jest.fn((e) => e.message || 'openai error'),
}))

jest.mock('@/lib/error', () => ({
  logError: jest.fn(),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn(),
  },
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  genericError: (msg) => ({ status: 500, body: msg }),
}))

jest.mock('@/schemas/languageModel', () => ({
  __esModule: true,
  openaiLanguageModel: jest
    .requireActual('@/lib/joi.schema')
    .default.string()
    .optional(),
  default: jest.requireActual('@/lib/joi.schema').default.string().optional(),
}))

const { getTextTokensLength } = require('@chatbotkit-dev/gpt')

const {
  createTextCompletion,
  getOpenAIError,
} = require('@/lib/model.provider.openai')

const { logError } = require('@/lib/error')

const { Usage } = require('@/lib/usage.model')

const req = {}

const session = { user: { id: 'user_1' } }

const testLanguageModel =
  'custom/name=text-complete/provider=openai/credentials=sk-test'

describe('PADDING_RATIO', () => {
  it('equals 0.9', () => {
    expect(PADDING_RATIO).toBe(0.9)
  })
})

describe('bodySchema', () => {
  it('accepts a valid prompt', async () => {
    const result = await bodySchema.validateAsync({ prompt: 'hello' })

    expect(result.prompt).toBe('hello')
  })

  it('applies default stop tokens when stop not provided', async () => {
    const result = await bodySchema.validateAsync({ prompt: 'test' })

    expect(result.stop).toEqual(['<|endoftext|>'])
  })

  it('accepts custom stop tokens', async () => {
    const result = await bodySchema.validateAsync({
      prompt: 'test',
      stop: ['END', 'STOP'],
    })

    expect(result.stop).toEqual(['END', 'STOP'])
  })

  it('accepts body without prompt', async () => {
    const result = await bodySchema.validateAsync({})

    expect(result.prompt).toBeUndefined()
  })
})

describe('handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty completion for empty prompt', async () => {
    const response = await handler(req, session, { prompt: '' })

    expect(response.status).toBe(200)
    expect(response.body.completion).toBe('')
    expect(createTextCompletion).not.toHaveBeenCalled()
  })

  it('returns empty completion for missing prompt', async () => {
    const response = await handler(req, session, {})

    expect(response.status).toBe(200)
    expect(response.body.completion).toBe('')
    expect(createTextCompletion).not.toHaveBeenCalled()
  })

  it('passes completion result on success', async () => {
    getTextTokensLength.mockReturnValue(100)
    createTextCompletion.mockResolvedValue({
      completion: 'hello world',
      usage: { totalTokens: 150 },
    })

    const response = await handler(req, session, {
      prompt: 'say hello',
      model: testLanguageModel,
    })

    expect(response.status).toBe(200)
    expect(response.body.completion).toBe('hello world')
  })

  it('applies PADDING_RATIO to maxTokens calculation', async () => {
    getTextTokensLength.mockReturnValue(200)
    createTextCompletion.mockResolvedValue({
      completion: 'result',
      usage: { totalTokens: 250 },
    })

    await handler(req, session, {
      prompt: 'test prompt',
      model: testLanguageModel,
    })

    const callArgs = createTextCompletion.mock.calls[0][0]
    const modelMaxTokens = callArgs.maxTokens / PADDING_RATIO + 200

    expect(callArgs.maxTokens).toBe(
      Math.round((modelMaxTokens - 200) * PADDING_RATIO)
    )
  })

  it('records usage after successful completion', async () => {
    getTextTokensLength.mockReturnValue(10)
    createTextCompletion.mockResolvedValue({
      completion: 'done',
      usage: { totalTokens: 50 },
    })

    await handler(req, session, {
      prompt: 'hello',
      model: testLanguageModel,
    })

    expect(Usage.createAndRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        user: session.user,
        token: 50,
        meta: { reason: 'text/complete' },
      })
    )
  })

  it('returns generic error when createTextCompletion throws', async () => {
    getTextTokensLength.mockReturnValue(10)

    const error = new Error('OpenAI error')

    createTextCompletion.mockRejectedValue(error)
    getOpenAIError.mockReturnValue('openai error message')

    const response = await handler(req, session, {
      prompt: 'test',
      model: testLanguageModel,
    })

    expect(logError).toHaveBeenCalledWith(error)
    expect(response.status).toBe(500)
    expect(Usage.createAndRecord).not.toHaveBeenCalled()
  })

  it('passes user id to createTextCompletion', async () => {
    getTextTokensLength.mockReturnValue(5)
    createTextCompletion.mockResolvedValue({
      completion: 'ok',
      usage: { totalTokens: 20 },
    })

    await handler(
      req,
      { user: { id: 'user_abc' } },
      { prompt: 'hi', model: testLanguageModel }
    )

    expect(createTextCompletion.mock.calls[0][0].user).toBe('user_abc')
  })

  it('passes stop tokens to createTextCompletion', async () => {
    getTextTokensLength.mockReturnValue(5)
    createTextCompletion.mockResolvedValue({
      completion: 'ok',
      usage: { totalTokens: 20 },
    })

    const customStop = ['STOP', 'END']

    await handler(req, session, {
      prompt: 'test',
      model: testLanguageModel,
      stop: customStop,
    })

    expect(createTextCompletion.mock.calls[0][0].stop).toEqual(customStop)
  })
})
