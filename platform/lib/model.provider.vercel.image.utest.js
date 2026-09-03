import _fetch from '@/lib/fetch'
import { createImage, editImage } from '@/lib/model.provider.vercel'

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

describe('createImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.VERCEL_MODELS_API_KEY = 'test-vercel-key'
  })

  it('must keep only the first url from each returned pair', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-1-a' },
                },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-1-b' },
                },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-2-a' },
                },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-2-b' },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      }),
    })

    const result = await createImage({
      prompt: 'draw two houses',
      model: 'google/imagen-4',
    })

    expect(result).toEqual({
      urls: [
        'data:image/png;base64,image-1-a',
        'data:image/png;base64,image-2-a',
      ],
      usage: {
        model: 'google/imagen-4',
        inputTokens: 0,
        outputTokens: 2,
      },
    })
  })

  it('must fall back to message images when content has no image urls', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'no images here',
              images: [
                {
                  image_url: { url: 'data:image/png;base64,fallback-image' },
                },
              ],
            },
          },
        ],
        usage: {},
      }),
    })

    const result = await createImage({
      prompt: 'draw a tree',
      model: 'google/imagen-4',
    })

    expect(result.urls).toEqual(['data:image/png;base64,fallback-image'])
  })

  it('must propagate providerOptions to the fetch body', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-1-a' },
                },
              ],
            },
          },
        ],
        usage: {},
      }),
    })

    await createImage({
      prompt: 'draw a tree',
      model: 'google/gemini-3.1-flash-image-preview',
      modelOptions: {
        gateway: {
          order: ['vertex'],
        },
      },
    })

    expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        providerOptions: {
          gateway: {
            order: ['vertex'],
          },
        },
      })
    )
  })

  // @note models the gateway types as `image` (the xAI Imagine family) have no
  // chat surface - a chat completion is rejected with a ModelTypeMismatchError -
  // so they are driven through the image generation API instead.
  describe('image generation api', () => {
    it('must post to the image generation endpoint and rebuild a data url', async () => {
      // @ts-ignore
      _fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          created: 1787258350,
          data: [{ b64_json: '/9j/base64-jpeg-payload' }],
          usage: { total_tokens: 0 },
        }),
      })

      const result = await createImage({
        prompt: 'draw a tree',
        model: 'spacexai/grok-imagine-image-2.0',
        providerApi: 'image',
      })

      expect(_fetch.mock.calls[0][0]).toBe(
        'https://ai-gateway.vercel.sh/v1/images/generations'
      )

      expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual(
        expect.objectContaining({
          model: 'spacexai/grok-imagine-image-2.0',
          prompt: 'draw a tree',
          n: 1,
        })
      )

      expect(result).toEqual({
        urls: ['data:image/jpeg;base64,/9j/base64-jpeg-payload'],
        usage: {
          model: 'spacexai/grok-imagine-image-2.0',
          inputTokens: 0,
          outputTokens: 1,
        },
      })
    })

    it('must prefer an upstream url over the base64 payload', async () => {
      // @ts-ignore
      _fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ url: 'https://example.com/image.jpg', b64_json: '/9j/x' }],
        }),
      })

      const result = await createImage({
        prompt: 'draw a tree',
        model: 'spacexai/grok-imagine-image-2.0',
        providerApi: 'image',
      })

      expect(result.urls).toEqual(['https://example.com/image.jpg'])
    })

    it('must reject an edit for a model that can only generate', async () => {
      await expect(
        editImage({
          prompt: 'make it blue',
          images: [],
          model: 'spacexai/grok-imagine-image-2.0',
          providerApi: 'image',
        })
      ).rejects.toThrow(/cannot edit/)

      expect(_fetch).not.toHaveBeenCalled()
    })
  })

})

describe('editImage', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.VERCEL_MODELS_API_KEY = 'test-vercel-key'
  })

  it('must keep only the first url from each returned pair', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-1-a' },
                },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-1-b' },
                },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-2-a' },
                },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-2-b' },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      }),
    })

    const result = await editImage({
      prompt: 'edit two houses',
      images: [new Blob(['image'], { type: 'image/png' })],
      model: 'google/imagen-4',
    })

    expect(result).toEqual({
      urls: [
        'data:image/png;base64,image-1-a',
        'data:image/png;base64,image-2-a',
      ],
      usage: {
        model: 'google/imagen-4',
        inputTokens: 1,
        outputTokens: 2,
      },
    })
  })

  it('must propagate providerOptions to the fetch body', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,image-1-a' },
                },
              ],
            },
          },
        ],
        usage: {},
      }),
    })

    await editImage({
      prompt: 'edit the tree',
      images: [new Blob(['image'], { type: 'image/png' })],
      model: 'google/gemini-3.1-flash-image-preview',
      modelOptions: {
        gateway: {
          order: ['vertex'],
        },
      },
    })

    expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        providerOptions: {
          gateway: {
            order: ['vertex'],
          },
        },
      })
    )
  })
})
