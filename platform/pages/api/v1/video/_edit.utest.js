/* eslint-disable @typescript-eslint/no-require-imports */
import { baseLanguageModel, videoModels } from '@/config/models'

import handler from './edit'

jest.mock('@/config/models', () => {
  const actual = jest.requireActual('@/config/models')

  return {
    ...actual,
    __esModule: true,
    videoModels: {
      ...actual.videoModels,
      'veo-3.1': {
        provider: 'google',
        family: 'google',
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
    string: jest.fn(() => ({
      required: jest.fn(() => ({})),
      optional: jest.fn(() => ({})),
    })),
    number: jest.fn(() => ({
      optional: jest.fn(() => ({})),
    })),
    array: jest.fn(() => ({
      items: jest.fn(() => ({
        max: jest.fn(() => ({
          required: jest.fn(() => ({})),
          optional: jest.fn(() => ({})),
        })),
      })),
    })),
  }

  return {
    __esModule: true,
    default: schema,
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/schemas/videoModel', () => ({}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/video', () => ({
  editVideo: jest.fn(),
}))

// @note we deliberately do NOT mock @/lib/usage.model so that the real Usage
// class runs end-to-end. We mock only the downstream recorders so we can assert
// on the final payloads that would reach the database.
jest.mock('@/lib/usage.record', () => ({
  recordVideoUsage: jest.fn(),
  recordLanguageTokenUsage: jest.fn(),
}))

const { editVideo } = require('@/lib/video')
const {
  recordVideoUsage,
  recordLanguageTokenUsage,
} = require('@/lib/usage.record')

describe('POST /api/v1/video/edit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('records the calibrated CHATBOTKIT_BASE_TOKEN debit with an output line item for veo-3.1', async () => {
    const ratio = videoModels['veo-3.1'].pricing.outputTokenRatio
    const expectedDebit = Math.round(3 * ratio)

    editVideo.mockResolvedValue({
      urls: ['https://cdn.example/extended.mp4'],
      usage: { model: 'veo-3.1', inputTokens: 0, outputTokens: 3 },
    })

    const stream = { abortSignal: { aborted: false }, result: jest.fn() }
    const session = { user: { id: 'user-1' } }
    const body = {
      model: 'veo-3.1',
      prompt: 'extend',
      videos: ['https://source.example/clip.mp4'],
    }

    await handler({}, stream, session, body)

    expect(editVideo).toHaveBeenCalledWith(
      'extend',
      ['https://source.example/clip.mp4'],
      {
        model: 'veo-3.1',
        frames: undefined,
        audios: undefined,
        n: undefined,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        user: 'user-1',
        signal: stream.abortSignal,
      }
    )

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: session.user,
      count: expectedDebit,
      model: baseLanguageModel,
      meta: {
        reason: 'video/edit',
        lineItems: [
          {
            tokens: 3,
            model: 'veo-3.1',
            type: 'output',
            debit: expectedDebit,
            ratio,
          },
        ],
      },
    })

    expect(recordVideoUsage).toHaveBeenCalledWith({
      user: session.user,
      count: 1,
      model: 'veo-3.1',
      meta: { reason: 'video/edit' },
    })

    expect(stream.result).toHaveBeenCalledWith({
      urls: ['https://cdn.example/extended.mp4'],
      usage: { model: 'veo-3.1', inputTokens: 0, outputTokens: 3 },
    })
  })

  it('records both input and output line items when both are non-zero', async () => {
    const inputRatio = videoModels['veo-3.1'].pricing.inputTokenRatio
    const outputRatio = videoModels['veo-3.1'].pricing.outputTokenRatio
    const expectedInputDebit = Math.round(2 * inputRatio)
    const expectedOutputDebit = Math.round(4 * outputRatio)
    const expectedTotalDebit = expectedInputDebit + expectedOutputDebit

    editVideo.mockResolvedValue({
      urls: ['https://cdn.example/extended.mp4'],
      usage: { model: 'veo-3.1', inputTokens: 2, outputTokens: 4 },
    })

    const stream = { abortSignal: { aborted: false }, result: jest.fn() }
    const session = { user: { id: 'user-1' } }
    const body = {
      model: 'veo-3.1',
      prompt: 'extend',
      videos: ['https://source.example/clip.mp4'],
    }

    await handler({}, stream, session, body)

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: session.user,
      count: expectedTotalDebit,
      model: baseLanguageModel,
      meta: {
        reason: 'video/edit',
        lineItems: [
          {
            tokens: 2,
            model: 'veo-3.1',
            type: 'input',
            debit: expectedInputDebit,
            ratio: inputRatio,
          },
          {
            tokens: 4,
            model: 'veo-3.1',
            type: 'output',
            debit: expectedOutputDebit,
            ratio: outputRatio,
          },
        ],
      },
    })
  })

  it('records only an output line item when no source video is provided', async () => {
    const ratio = videoModels['veo-3.1'].pricing.outputTokenRatio
    const expectedDebit = Math.round(2 * ratio)

    editVideo.mockResolvedValue({
      urls: ['https://cdn.example/animated.mp4'],
      usage: { model: 'veo-3.1', inputTokens: 0, outputTokens: 2 },
    })

    const stream = { abortSignal: { aborted: false }, result: jest.fn() }
    const session = { user: { id: 'user-1' } }
    const body = {
      model: 'veo-3.1',
      prompt: 'animate the frame',
      frames: ['https://source.example/start.png'],
    }

    await handler({}, stream, session, body)

    expect(editVideo).toHaveBeenCalledWith('animate the frame', [], {
      model: 'veo-3.1',
      frames: ['https://source.example/start.png'],
      audios: undefined,
      n: undefined,
      aspectRatio: undefined,
      resolution: undefined,
      duration: undefined,
      fps: undefined,
      seed: undefined,
      user: 'user-1',
      signal: stream.abortSignal,
    })

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: session.user,
      count: expectedDebit,
      model: baseLanguageModel,
      meta: {
        reason: 'video/edit',
        lineItems: [
          {
            tokens: 2,
            model: 'veo-3.1',
            type: 'output',
            debit: expectedDebit,
            ratio,
          },
        ],
      },
    })
  })
})
