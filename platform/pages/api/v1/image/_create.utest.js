/* eslint-disable @typescript-eslint/no-require-imports */
import { baseLanguageModel, imageModels } from '@/config/models'

import handler from './create'

jest.mock('@/config/models', () => {
  const actual = jest.requireActual('@/config/models')

  return {
    ...actual,
    __esModule: true,
    imageModels: {
      ...actual.imageModels,
      'gpt-image-1.5': {
        provider: 'openai',
        family: 'openai',
        pricing: {
          tokenRatio: 1,
          inputTokenRatio: 2,
          outputTokenRatio: 3,
        },
      },
    },
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const schema = {
    object: jest.fn(() => ({})),
    string: jest.fn(() => ({ required: jest.fn(() => ({})) })),
  }

  return {
    __esModule: true,
    default: schema,
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/schemas/imageModel', () => ({}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/image', () => ({
  createImage: jest.fn(),
}))

// @note we deliberately do NOT mock @/lib/usage.model so that the real Usage
// class runs end-to-end. We mock only the downstream recorders so we can assert
// on the final payloads that would reach the database.
jest.mock('@/lib/usage.record', () => ({
  recordImageUsage: jest.fn(),
  recordLanguageTokenUsage: jest.fn(),
}))

const { createImage } = require('@/lib/image')
const {
  recordImageUsage,
  recordLanguageTokenUsage,
} = require('@/lib/usage.record')

describe('POST /api/v1/image/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('records the calibrated CHATBOTKIT_BASE_TOKEN debit with input and output line items for gpt-image-1.5', async () => {
    const inputRatio = imageModels['gpt-image-1.5'].pricing.inputTokenRatio
    const outputRatio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio
    const expectedInputDebit = Math.round(20 * inputRatio)
    const expectedOutputDebit = Math.round(30 * outputRatio)
    const expectedTotalDebit = expectedInputDebit + expectedOutputDebit

    createImage.mockResolvedValue({
      urls: ['https://cdn.example/image.png'],
      usage: {
        model: 'gpt-image-1.5',
        inputTokens: 20,
        outputTokens: 30,
      },
    })

    const stream = {
      abortSignal: { aborted: false },
      result: jest.fn(),
    }
    const session = { user: { id: 'user-1' } }
    const body = { model: 'gpt-image-1.5', prompt: 'draw a cat' }

    await handler({}, stream, session, body)

    expect(createImage).toHaveBeenCalledWith('draw a cat', {
      model: 'gpt-image-1.5',
      user: 'user-1',
      signal: stream.abortSignal,
    })

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: session.user,
      count: expectedTotalDebit,
      model: baseLanguageModel,
      meta: {
        reason: 'image/create',
        lineItems: [
          {
            tokens: 20,
            model: 'gpt-image-1.5',
            type: 'input',
            debit: expectedInputDebit,
            ratio: inputRatio,
          },
          {
            tokens: 30,
            model: 'gpt-image-1.5',
            type: 'output',
            debit: expectedOutputDebit,
            ratio: outputRatio,
          },
        ],
      },
    })

    expect(recordImageUsage).toHaveBeenCalledWith({
      user: session.user,
      count: 1,
      model: 'gpt-image-1.5',
      meta: { reason: 'image/create' },
    })

    expect(stream.result).toHaveBeenCalledWith({
      urls: ['https://cdn.example/image.png'],
      usage: {
        model: 'gpt-image-1.5',
        inputTokens: 20,
        outputTokens: 30,
      },
    })
  })

  it('records only an output line item when there are no input tokens', async () => {
    const outputRatio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio
    const expectedDebit = Math.round(40 * outputRatio)

    createImage.mockResolvedValue({
      urls: ['https://cdn.example/image.png'],
      usage: {
        model: 'gpt-image-1.5',
        inputTokens: 0,
        outputTokens: 40,
      },
    })

    const stream = { abortSignal: { aborted: false }, result: jest.fn() }
    const session = { user: { id: 'user-1' } }
    const body = { model: 'gpt-image-1.5', prompt: 'draw a cat' }

    await handler({}, stream, session, body)

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: session.user,
      count: expectedDebit,
      model: baseLanguageModel,
      meta: {
        reason: 'image/create',
        lineItems: [
          {
            tokens: 40,
            model: 'gpt-image-1.5',
            type: 'output',
            debit: expectedDebit,
            ratio: outputRatio,
          },
        ],
      },
    })
  })
})
