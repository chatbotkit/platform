import * as cloudflare from '@/lib/model.provider.cloudflare'
import {
  createChatCompletion,
  createImage,
  createVideo,
  getLanguageModel,
} from '@/lib/model.provider.cloudflare.adaptor'
import {
  parseAndRevealImageModel,
  parseAndRevealLanguageModel,
  parseAndRevealVideoModel,
} from '@/lib/model.utils'

jest.mock('@/lib/model.provider.cloudflare', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
  createImage: jest.fn(),
  editImage: jest.fn(),
  createVideo: jest.fn(),
  editVideo: jest.fn(),
}))

jest.mock('@/lib/model.utils', () => ({
  modelRequiresUserTurnAsLastMessage: jest.fn(() => false),
  modelRequiresUserTurnBeforeToolCall: jest.fn(() => false),
  parseAndRevealLanguageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
  parseAndRevealImageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
  parseAndRevealVideoModel: jest.fn(() => {
    throw new Error('model not found')
  }),
}))

describe('cloudflare.adaptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses providerModel for language models when present', () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { providerModel: 'openai/gpt-4.1' },
    })

    expect(getLanguageModel({ model: 'cloudflare-gpt-4.1' })).toBe(
      'openai/gpt-4.1'
    )
  })

  it('passes providerOptions as OpenAI-compatible extra options', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: {
        providerModel: 'openai/gpt-4.1',
        providerOptions: { gateway: { id: 'main' } },
      },
    })
    cloudflare.createChatCompletion.mockResolvedValue({ completion: 'ok' })

    await createChatCompletion({
      model: 'cloudflare-gpt-4.1',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    expect(cloudflare.createChatCompletion).toHaveBeenCalledWith({
      model: 'openai/gpt-4.1',
      messages: [{ role: 'user', content: 'Hi' }],
      extra: {
        providerOptions: {
          gateway: { id: 'main' },
        },
      },
    })
  })

  it('uses providerModel and providerOptions for image generation', async () => {
    parseAndRevealImageModel.mockReturnValue({
      config: {
        providerModel: 'openai/gpt-image-2',
        providerOptions: { quality: 'high' },
      },
    })
    cloudflare.createImage.mockResolvedValue({
      urls: ['https://example.com/image.png'],
      usage: { model: 'openai/gpt-image-2', inputTokens: 0, outputTokens: 1 },
    })

    await createImage({
      model: 'cloudflare-gpt-image-2',
      prompt: 'draw',
    })

    expect(cloudflare.createImage).toHaveBeenCalledWith({
      model: 'openai/gpt-image-2',
      prompt: 'draw',
      modelOptions: {
        quality: 'high',
      },
    })
  })

  it('uses providerModel and providerOptions for video generation', async () => {
    parseAndRevealVideoModel.mockReturnValue({
      config: {
        providerModel: 'google/veo-3.1',
        providerOptions: { gateway: { id: 'video' } },
      },
    })
    cloudflare.createVideo.mockResolvedValue({
      urls: ['https://example.com/video.mp4'],
      usage: { model: 'google/veo-3.1', inputTokens: 0, outputTokens: 8 },
    })

    await createVideo({
      model: 'cloudflare-veo-3.1',
      prompt: 'move',
      duration: 8,
    })

    expect(cloudflare.createVideo).toHaveBeenCalledWith({
      model: 'google/veo-3.1',
      prompt: 'move',
      duration: 8,
      modelOptions: {
        gateway: { id: 'video' },
      },
    })
  })
})
