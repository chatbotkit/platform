import { editVideo as editVercelVideo } from '@/lib/model.provider.vercel.adaptor'
import { editVideo } from '@/lib/video'

// @note a deployment that does not serve grok-imagine-video, the preferred
// edit model
jest.mock('@/config/models', () => ({
  ...jest.requireActual('@/config/models'),
  __esModule: true,
  videoModels: {
    'gateway-video': {
      provider: 'vercel',
      pricing: { tokenRatio: 1 },
      duration: 8,
      availableDurations: [8],
      availableAspectRatios: ['16:9'],
    },
  },
  defaultVideoModel: 'gateway-video',
}))

jest.mock('@/lib/storage', () => ({ getObject: jest.fn(), putObject: jest.fn() }))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: () => 'https://example.com',
}))

jest.mock('@/lib/model.provider.vercel.adaptor', () => ({
  createVideo: jest.fn(),
  editVideo: jest.fn(),
}))

describe('editVideo default model', () => {
  it('falls back to the catalogue default when the preferred edit model is not served', async () => {
    editVercelVideo.mockResolvedValue({
      urls: [],
      usage: { model: 'gateway-video', inputTokens: 1, outputTokens: 1 },
    })

    await editVideo('a cat', ['https://example.com/source.mp4'], {})

    expect(editVercelVideo).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gateway-video' })
    )
  })
})
