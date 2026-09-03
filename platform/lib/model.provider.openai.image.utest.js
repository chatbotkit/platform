/* eslint-disable @typescript-eslint/no-require-imports */
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

jest.mock('@/lib/system.metrics', () => ({
  reportTokenUsage: jest.fn(),
}))

describe('model.provider.openai image support', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    process.env.OPENAI_API_KEY = 'test-openai-key'
  })

  it('should preserve gpt-image-2 for image generation', async () => {
    const fetch = require('@/lib/fetch').default
    const { createImage } = require('@/lib/model.provider.openai')

    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ url: 'https://openai.com/generated.png' }],
        usage: {
          input_tokens_details: {
            text_tokens: 12,
            image_tokens: 0,
          },
          output_tokens: 34,
        },
      }),
    })

    const result = await createImage({
      prompt: 'draw a lighthouse',
      model: 'gpt-image-2',
      size: '1536x1024',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
      })
    )

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        prompt: 'draw a lighthouse',
        model: 'gpt-image-2',
        output_format: 'png',
        size: '1536x1024',
      })
    )

    expect(result).toEqual({
      urls: ['https://openai.com/generated.png'],
      usage: {
        model: 'gpt-image-2',
        inputTokens: 0,
        outputTokens: 1,
      },
    })
  })

  it('should preserve gpt-image-2 for image editing', async () => {
    const fetch = require('@/lib/fetch').default
    const { editImage } = require('@/lib/model.provider.openai')

    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ url: 'https://openai.com/edited.png' }],
        usage: {
          input_tokens_details: {
            text_tokens: 7,
            image_tokens: 22,
          },
          output_tokens: 19,
        },
      }),
    })

    const result = await editImage({
      prompt: 'add fog',
      images: [new Blob(['image'], { type: 'image/png' })],
      model: 'gpt-image-2',
      size: '1024x1536',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/edits',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    )

    const form = fetch.mock.calls[0][1].body

    expect(form.get('model')).toBe('gpt-image-2')
    expect(form.get('size')).toBe('1024x1536')
    expect(form.get('output_format')).toBe('png')
    expect(form.get('response_format')).toBeNull()

    expect(result).toEqual({
      urls: ['https://openai.com/edited.png'],
      usage: {
        model: 'gpt-image-2',
        inputTokens: 1,
        outputTokens: 1,
      },
    })
  })
})
