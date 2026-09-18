/* eslint-disable @typescript-eslint/no-require-imports */
import { baseLanguageModel, decisionModels } from '@/config/models'

import handler, { bodySchema } from './create'

jest.mock('@/config/models', () => {
  const actual = jest.requireActual('@/config/models')

  return {
    ...actual,
    __esModule: true,
    decisionModels: {
      jev: {
        provider: 'typesafe',
        pricing: { tokenRatio: 0.003, inputTokenRatio: 0.003, outputTokenRatio: 0 },
      },
    },
    defaultDecisionModel: 'jev',
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/decision.core', () => ({
  createDecision: jest.fn(),
}))

// @note the real Usage class runs end-to-end; only the downstream recorder is
// mocked so the final payload can be asserted.
jest.mock('@/lib/usage.record', () => ({
  recordLanguageTokenUsage: jest.fn(),
}))

const { createDecision } = require('@/lib/decision.core')
const { recordLanguageTokenUsage } = require('@/lib/usage.record')

const questions = {
  refunded: { type: 'boolean', instructions: 'Was a refund issued?' },
}

const answers = { refunded: { type: 'boolean', probability: 0.99 } }

describe('POST /api/v1/decision/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the answers and debits only the priced input side', async () => {
    const inputRatio = decisionModels.jev.pricing.inputTokenRatio
    const expectedDebit = Math.round(100000 * inputRatio)

    createDecision.mockResolvedValue({
      answers,
      usage: { model: 'jev', inputTokens: 100000, outputTokens: 21 },
    })

    const stream = { abortSignal: { aborted: false }, result: jest.fn() }
    const session = { user: { id: 'user-1' } }
    const body = { model: 'jev', state: 'a refund was issued', questions }

    await handler({}, stream, session, body)

    expect(createDecision).toHaveBeenCalledWith(
      'a refund was issued',
      questions,
      { model: 'jev', signal: stream.abortSignal }
    )

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: session.user,
      count: expectedDebit,
      model: baseLanguageModel,
      meta: {
        reason: 'decision/create',
        lineItems: [
          {
            tokens: 100000,
            model: 'jev',
            type: 'input',
            debit: expectedDebit,
            ratio: inputRatio,
          },
        ],
      },
      references: undefined,
    })

    expect(stream.result).toHaveBeenCalledWith({
      answers,
      usage: { model: 'jev', inputTokens: 100000, outputTokens: 21 },
    })
  })

  it('accounts for a call worth less than one base token', async () => {
    createDecision.mockResolvedValue({
      answers,
      usage: { model: 'jev', inputTokens: 120, outputTokens: 21 },
    })

    const stream = { abortSignal: { aborted: false }, result: jest.fn() }
    const session = { user: { id: 'user-1' } }

    await handler({}, stream, session, { state: 'text', questions })

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 1,
        meta: expect.objectContaining({
          lineItems: [
            expect.objectContaining({ tokens: 120, type: 'input', debit: 1 }),
          ],
        }),
      })
    )
  })

  describe('bodySchema', () => {
    it.each([
      ['a string state', { state: 'text', questions }],
      ['an object state', { state: { status: 'open' }, questions }],
      [
        'a message array state with choice and score questions',
        {
          model: 'jev',
          state: [{ role: 'user', content: 'hi' }],
          questions: {
            topic: {
              type: 'choice',
              instructions: 'Topic?',
              criteria: { billing: 'payments', technical: null },
            },
            quality: {
              type: 'score',
              instructions: 'Quality?',
              criteria: ['poor', 'fair', 'good'],
            },
            refunded: {
              type: 'boolean',
              instructions: 'Refunded?',
              criteria: { true: 'money was returned', false: null },
            },
          },
        },
      ],
    ])('accepts %s', (_name, body) => {
      expect(bodySchema.validate(body).error).toBeUndefined()
    })

    it.each([
      ['a missing state', { questions }],
      ['no questions', { state: 'text', questions: {} }],
      [
        'an unknown question type',
        { state: 'text', questions: { q: { type: 'text', instructions: 'x' } } },
      ],
      [
        'a question without instructions',
        { state: 'text', questions: { q: { type: 'boolean' } } },
      ],
      [
        'a choice question without criteria',
        { state: 'text', questions: { q: { type: 'choice', instructions: 'x' } } },
      ],
      [
        'a score question with a single label',
        {
          state: 'text',
          questions: {
            q: { type: 'score', instructions: 'x', criteria: ['only'] },
          },
        },
      ],
      [
        'boolean criteria that describe only one side',
        {
          state: 'text',
          questions: {
            q: { type: 'boolean', instructions: 'x', criteria: { true: 'yes' } },
          },
        },
      ],
      [
        'a score question with more than ten levels',
        {
          state: 'text',
          questions: {
            q: {
              type: 'score',
              instructions: 'x',
              criteria: Array.from({ length: 11 }, (_, i) => `level ${i}`),
            },
          },
        },
      ],
      [
        'array criteria on a boolean question',
        {
          state: 'text',
          questions: {
            q: { type: 'boolean', instructions: 'x', criteria: ['a', 'b'] },
          },
        },
      ],
      ['a model outside the decision catalogue', { model: 'gpt-image-2', state: 'text', questions }],
    ])('rejects %s', (_name, body) => {
      expect(bodySchema.validate(body).error).toBeDefined()
    })
  })
})
