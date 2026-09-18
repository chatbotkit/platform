import { editImage } from '@/lib/image'
import { editImage as editOpenAIImage } from '@/lib/model.provider.openai'
import { editImage as editVercelImage } from '@/lib/model.provider.vercel.adaptor'

// @note a deployment with only a Vercel key: gpt-image-1, the preferred edit
// model, is not served
jest.mock('@/config/models', () => ({
  ...jest.requireActual('@/config/models'),
  __esModule: true,
  imageModels: {
    'gateway-image': { provider: 'vercel', pricing: { tokenRatio: 1 } },
  },
  defaultImageModel: 'gateway-image',
}))

jest.mock('@/lib/storage', () => ({ getObject: jest.fn(), putObject: jest.fn() }))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: () => 'https://example.com',
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

jest.mock('@/lib/model.provider.vercel.adaptor', () => ({
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

describe('editImage default model', () => {
  it('falls back to the catalogue default when the preferred edit model is not served', async () => {
    editVercelImage.mockResolvedValue({
      urls: [],
      usage: { model: 'gateway-image', inputTokens: 1, outputTokens: 1 },
    })

    await editImage('a cat', [new Blob(['x'])], {})

    expect(editVercelImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gateway-image' })
    )
    expect(editOpenAIImage).not.toHaveBeenCalled()
  })
})
