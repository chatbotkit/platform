/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { baseLanguageModel, imageModels } from '@/config/models'

import handler from './edit'

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
    string: jest.fn(() => ({
      required: jest.fn(() => ({})),
      optional: jest.fn(() => ({})),
    })),
    array: jest.fn(() => ({
      items: jest.fn(() => ({
        max: jest.fn(() => ({ required: jest.fn(() => ({})) })),
      })),
    })),
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

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/egress.fetch', () => jest.fn())

jest.mock('@/lib/image', () => ({
  editImage: jest.fn(),
}))

// @note we deliberately do NOT mock @/lib/usage.model so that the real Usage
// class runs end-to-end. We mock only the downstream recorders so we can assert
// on the final payloads that would reach the database.
jest.mock('@/lib/usage.record', () => ({
  recordImageUsage: jest.fn(),
  recordLanguageTokenUsage: jest.fn(),
}))

const fetch = require('@/lib/egress.fetch')
const { editImage } = require('@/lib/image')
const {
  recordImageUsage,
  recordLanguageTokenUsage,
} = require('@/lib/usage.record')

describe('POST /api/v1/image/edit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches input images and mask, then edits and records the calibrated CHATBOTKIT_BASE_TOKEN debit with input and output line items', async () => {
    const imageBlobA = new Blob(['a'], { type: 'image/png' })
    const imageBlobB = new Blob(['b'], { type: 'image/png' })
    const maskBlob = new Blob(['m'], { type: 'image/png' })

    fetch
      .mockResolvedValueOnce({ ok: true, blob: async () => imageBlobA })
      .mockResolvedValueOnce({ ok: true, blob: async () => imageBlobB })
      .mockResolvedValueOnce({ ok: true, blob: async () => maskBlob })

    editImage.mockResolvedValue({
      urls: ['https://cdn.example/edited.png'],
      usage: {
        model: 'gpt-image-1.5',
        inputTokens: 2,
        outputTokens: 3,
      },
    })

    const stream = {
      abortSignal: { aborted: false },
      result: jest.fn(),
    }
    const session = { user: { id: 'user-1' } }
    const body = {
      model: 'gpt-image-1.5',
      prompt: 'replace sky',
      images: ['https://a.png', 'https://b.png'],
      mask: 'https://mask.png',
    }

    const inputRatio = imageModels['gpt-image-1.5'].pricing.inputTokenRatio
    const outputRatio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio
    const expectedInputDebit = Math.round(2 * inputRatio)
    const expectedOutputDebit = Math.round(3 * outputRatio)
    const expectedTotalDebit = expectedInputDebit + expectedOutputDebit

    await handler({}, stream, session, body)

    expect(editImage).toHaveBeenCalledWith(
      'replace sky',
      [imageBlobA, imageBlobB],
      {
        mask: maskBlob,
        model: 'gpt-image-1.5',
        user: 'user-1',
        signal: stream.abortSignal,
      }
    )

    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: session.user,
      count: expectedTotalDebit,
      model: baseLanguageModel,
      meta: {
        reason: 'image/edit',
        lineItems: [
          {
            tokens: 2,
            model: 'gpt-image-1.5',
            type: 'input',
            debit: expectedInputDebit,
            ratio: inputRatio,
          },
          {
            tokens: 3,
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
      meta: { reason: 'image/edit' },
    })

    expect(stream.result).toHaveBeenCalledWith({
      urls: ['https://cdn.example/edited.png'],
      usage: {
        model: 'gpt-image-1.5',
        inputTokens: 2,
        outputTokens: 3,
      },
    })
  })

  it('throws when one of source images cannot be fetched', async () => {
    fetch.mockResolvedValueOnce({ ok: false })

    const stream = {
      abortSignal: { aborted: false },
      result: jest.fn(),
    }
    const session = { user: { id: 'user-1' } }
    const body = {
      model: 'gpt-image-1.5',
      prompt: 'replace sky',
      images: ['https://broken.png'],
    }

    await expect(handler({}, stream, session, body)).rejects.toThrow(
      'Failed to fetch image from https://broken.png'
    )
    expect(editImage).not.toHaveBeenCalled()
  })

  it('refuses a private-IP literal source image before any connection is attempted', async () => {
    let captured

    fetch.mockImplementation((...args) =>
      jest
        .requireActual('@/lib/egress.fetch')
        .default(...args)
        .catch((e) => {
          captured = e

          throw e
        })
    )

    const stream = {
      abortSignal: { aborted: false },
      result: jest.fn(),
    }
    const session = { user: { id: 'user-1' } }
    const body = {
      model: 'gpt-image-1.5',
      prompt: 'replace sky',
      images: ['http://127.0.0.1/image.png'],
    }

    await expect(handler({}, stream, session, body)).rejects.toThrow()

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1/image.png')
    expect(String(captured?.cause?.message)).toMatch(
      /egress to 127\.0\.0\.1 is not allowed: not a public address/
    )
    expect(editImage).not.toHaveBeenCalled()
  })
})
