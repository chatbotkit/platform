import _fetch from '@/lib/fetch'
import { UserInputError } from '@/lib/error'
import { createVideo, editVideo } from '@/lib/model.provider.vercel'

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

function mockVideoResponse(count = 1) {
  return {
    ok: true,
    body: (async function* () {
      yield new TextEncoder().encode(
        `data: ${JSON.stringify({
          type: 'result',
          videos: Array.from({ length: count }, () => ({
            type: 'base64',
            mediaType: 'video/mp4',
            data: 'AA==',
          })),
        })}\n\n`
      )
    })(),
  }
}

function mockVideoErrorResponse(event) {
  return {
    ok: true,
    body: (async function* () {
      yield new TextEncoder().encode(
        `data: ${JSON.stringify({
          type: 'error',
          ...event,
        })}\n\n`
      )
    })(),
  }
}

describe('editVideo', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.VERCEL_MODELS_API_KEY = 'test-vercel-key'

    // @ts-ignore
    _fetch.mockResolvedValue(mockVideoResponse())
  })

  it('must report generated seconds as output tokens', async () => {
    const result = await editVideo({
      prompt: 'animate this',
      videos: [],
      frames: ['data:image/png;base64,image-data'],
      model: 'bytedance/seedance-2.0-fast',
      duration: 5,
    })

    expect(result.usage).toEqual({
      model: 'bytedance/seedance-2.0-fast',
      inputTokens: 0,
      outputTokens: 5,
    })
  })

  it('must serialize data URL frames as gateway media objects', async () => {
    await editVideo({
      prompt: 'animate this',
      videos: [],
      frames: ['data:image/png;base64,image-data'],
      model: 'bytedance/seedance-2.0-fast',
      duration: 5,
    })

    expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        image: {
          type: 'file',
          mediaType: 'image/png',
          data: 'image-data',
        },
      })
    )
  })

  it('must serialize URL frames as gateway media objects', async () => {
    await editVideo({
      prompt: 'animate this',
      videos: [],
      frames: ['https://example.com/start.png'],
      model: 'bytedance/seedance-2.0-fast',
      duration: 5,
    })

    expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        image: {
          type: 'url',
          url: 'https://example.com/start.png',
        },
      })
    )
  })

  it('must expose real-person image rejections as user input errors', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue(
      mockVideoErrorResponse({
        message:
          'The request failed because the input image may contain real person.',
      })
    )

    await expect(
      editVideo({
        prompt: 'animate this',
        videos: [],
        frames: ['data:image/png;base64,image-data'],
        model: 'bytedance/seedance-2.0-fast',
        duration: 5,
      })
    ).rejects.toBeInstanceOf(UserInputError)
  })

  it('must expose 4xx video event errors with their upstream status', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue(
      mockVideoErrorResponse({
        message: 'Video generation has a quota of 4 requests per minute.',
        statusCode: 429,
      })
    )

    await expect(
      editVideo({
        prompt: 'animate this',
        videos: [],
        frames: ['data:image/png;base64,image-data'],
        model: 'bytedance/seedance-2.0-fast',
        duration: 5,
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: '429',
      })
    )
  })
})

describe('createVideo', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.VERCEL_MODELS_API_KEY = 'test-vercel-key'

    // @ts-ignore
    _fetch.mockResolvedValue(mockVideoResponse(2))
  })

  it('must report generated seconds for all returned videos as output tokens', async () => {
    const result = await createVideo({
      prompt: 'make this move',
      model: 'google/veo-3.1-generate-001',
      duration: 8,
    })

    expect(result.usage).toEqual({
      model: 'google/veo-3.1-generate-001',
      inputTokens: 0,
      outputTokens: 16,
    })
  })
})
