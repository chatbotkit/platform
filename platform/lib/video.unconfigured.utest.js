import { createVideo as createVercelVideo } from '@/lib/model.provider.vercel.adaptor'
import { createVideo, editVideo } from '@/lib/video'

jest.mock('@/config/models', () => ({
  ...jest.requireActual('@/config/models'),
  __esModule: true,
  videoModels: {},
  defaultVideoModel: 'veo-3.1',
}))

jest.mock('@/lib/storage', () => ({ getObject: jest.fn(), putObject: jest.fn() }))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: () => 'https://example.com',
}))

jest.mock('@/lib/model.provider.vercel.adaptor', () => ({
  createVideo: jest.fn(),
  editVideo: jest.fn(),
}))

// @note a deployment serves video models only when a provider key is set, so
// an empty catalogue is the normal state of a fresh install
describe('video on a deployment that serves no video model', () => {
  const expected = {
    message: 'No video model is configured on this deployment',
    code: 'BAD_REQUEST',
  }

  it.each([[undefined], ['veo-3.1'], ['anything']])(
    'createVideo answers a bad request rather than an internal error for model %s',
    async (model) => {
      await expect(createVideo('a cat', { model })).rejects.toMatchObject(
        expected
      )

      expect(createVercelVideo).not.toHaveBeenCalled()
    }
  )

  it('editVideo answers a bad request rather than an internal error', async () => {
    await expect(
      editVideo('a cat', ['https://example.com/source.mp4'], {})
    ).rejects.toMatchObject(expected)
  })
})
