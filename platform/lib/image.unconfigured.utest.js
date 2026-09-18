import { createImage, editImage } from '@/lib/image'
import { createImage as createOpenAIImage } from '@/lib/model.provider.openai'

jest.mock('@/config/models', () => ({
  ...jest.requireActual('@/config/models'),
  __esModule: true,
  imageModels: {},
  defaultImageModel: 'gpt-image-2',
}))

jest.mock('@/lib/storage', () => ({ getObject: jest.fn(), putObject: jest.fn() }))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: () => 'https://example.com',
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

// @note a deployment serves image models only when a provider key is set, so
// an empty catalogue is the normal state of a fresh install
describe('image on a deployment that serves no image model', () => {
  const expected = {
    message: 'No image model is configured on this deployment',
    code: 'BAD_REQUEST',
  }

  it.each([[undefined], ['gpt-image-2'], ['anything']])(
    'createImage answers a bad request rather than an internal error for model %s',
    async (model) => {
      await expect(createImage('a cat', { model })).rejects.toMatchObject(
        expected
      )

      expect(createOpenAIImage).not.toHaveBeenCalled()
    }
  )

  it('editImage answers a bad request rather than an internal error', async () => {
    await expect(
      editImage('a cat', [new Blob(['x'])], {})
    ).rejects.toMatchObject(expected)
  })
})
