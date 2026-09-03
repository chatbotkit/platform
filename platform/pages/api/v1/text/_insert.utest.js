/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import {
  PADDING_RATIO,
  bodySchema,
  default as handler,
} from '@/pages/api/v1/text/insert'

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
  'custom/name=text-instruct/provider=openai/credentials=sk-test'

describe('PADDING_RATIO', () => {
  it('equals 0.9', () => {
    expect(PADDING_RATIO).toBe(0.9)
  })
})

describe('bodySchema', () => {
  it('accepts a valid prompt and suffix', async () => {
    const result = await bodySchema.validateAsync({
      prompt: 'hello',
      suffix: 'world',
    })

    expect(result.prompt).toBe('hello')
    expect(result.suffix).toBe('world')
  })

  it('applies default stop tokens when stop not provided', async () => {
    const result = await bodySchema.validateAsync({
      prompt: 'test',
      suffix: 'end',
    })

    expect(result.stop).toEqual(['<|endoftext|>'])
  })

  it('accepts custom stop tokens', async () => {
    const result = await bodySchema.validateAsync({
      prompt: 'p',
      suffix: 's',
      stop: ['DONE'],
    })

    expect(result.stop).toEqual(['DONE'])
  })
})

describe('handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty completion when prompt is missing', async () => {
    const response = await handler(req, session, { suffix: 'world' })

    expect(response.status).toBe(200)
    expect(response.body.completion).toBe('')
    expect(createTextCompletion).not.toHaveBeenCalled()
  })

  it('returns empty completion when suffix is missing', async () => {
    const response = await handler(req, session, { prompt: 'hello' })

    expect(response.status).toBe(200)
    expect(response.body.completion).toBe('')
    expect(createTextCompletion).not.toHaveBeenCalled()
  })

  it('returns empty completion when both prompt and suffix are missing', async () => {
    const response = await handler(req, session, {})

    expect(response.status).toBe(200)
    expect(response.body.completion).toBe('')
    expect(createTextCompletion).not.toHaveBeenCalled()
  })

  it('passes completion result on success', async () => {
    getTextTokensLength.mockReturnValue(50)
    createTextCompletion.mockResolvedValue({
      completion: 'inserted text',
      usage: { totalTokens: 100 },
    })

    const response = await handler(req, session, {
      prompt: 'beginning',
      suffix: 'ending',
      model: testLanguageModel,
    })

    expect(response.status).toBe(200)
    expect(response.body.completion).toBe('inserted text')
  })

  it('counts tokens from combined prompt and suffix', async () => {
    getTextTokensLength.mockReturnValue(80)
    createTextCompletion.mockResolvedValue({
      completion: 'ok',
      usage: { totalTokens: 120 },
    })

    await handler(req, session, {
      prompt: 'start',
      suffix: 'end',
      model: testLanguageModel,
    })

    expect(getTextTokensLength.mock.calls[0][0]).toBe('startend')
  })

  it('applies PADDING_RATIO to maxTokens calculation', async () => {
    getTextTokensLength.mockReturnValue(300)
    createTextCompletion.mockResolvedValue({
      completion: 'result',
      usage: { totalTokens: 350 },
    })

    await handler(req, session, {
      prompt: 'a',
      suffix: 'b',
      model: testLanguageModel,
    })

    const callArgs = createTextCompletion.mock.calls[0][0]
    const modelMaxTokens = callArgs.maxTokens / PADDING_RATIO + 300

    expect(callArgs.maxTokens).toBe(
      Math.round((modelMaxTokens - 300) * PADDING_RATIO)
    )
  })

  it('passes suffix to createTextCompletion', async () => {
    getTextTokensLength.mockReturnValue(10)
    createTextCompletion.mockResolvedValue({
      completion: 'ok',
      usage: { totalTokens: 20 },
    })

    await handler(req, session, {
      prompt: 'hello ',
      suffix: ' world',
      model: testLanguageModel,
    })

    expect(createTextCompletion.mock.calls[0][0].suffix).toBe(' world')
  })

  it('records usage with reason text/insert after success', async () => {
    getTextTokensLength.mockReturnValue(10)
    createTextCompletion.mockResolvedValue({
      completion: 'done',
      usage: { totalTokens: 40 },
    })

    await handler(req, session, {
      prompt: 'p',
      suffix: 's',
      model: testLanguageModel,
    })

    expect(Usage.createAndRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        user: session.user,
        token: 40,
        meta: { reason: 'text/insert' },
      })
    )
  })

  it('returns generic error when createTextCompletion throws', async () => {
    getTextTokensLength.mockReturnValue(10)

    const error = new Error('provider failure')

    createTextCompletion.mockRejectedValue(error)
    getOpenAIError.mockReturnValue('provider failure')

    const response = await handler(req, session, {
      prompt: 'p',
      suffix: 's',
      model: testLanguageModel,
    })

    expect(logError).toHaveBeenCalledWith(error)
    expect(response.status).toBe(500)
    expect(Usage.createAndRecord).not.toHaveBeenCalled()
  })
})
