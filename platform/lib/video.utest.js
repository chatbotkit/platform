/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('@/config/models', () => {
  const actual = jest.requireActual('@/config/models')

  return {
    ...actual,
    __esModule: true,
    videoModels: {
      ...actual.videoModels,
      'veo-3.1': {
        provider: 'vercel',
        duration: 8,
        availableDurations: [4, 6, 8],
        availableAspectRatios: ['16:9', '9:16'],
      },
    },
  }
})

jest.mock('@/lib/storage', () => ({
  getObject: jest.fn(),
  putObject: jest.fn(),
}))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: () => 'https://example.com',
}))

jest.mock('@/lib/model.provider.vercel.adaptor', () => ({
  createVideo: jest.fn(),
  editVideo: jest.fn(),
}))

const { createVideo, editVideo, retrieveVideo } = require('./video')
const {
  createVideo: createVercelVideo,
  editVideo: editVercelVideo,
} = require('@/lib/model.provider.vercel.adaptor')
const { getObject } = require('@/lib/storage')

describe('video', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createVideo', () => {
    it('should reject unsupported aspect ratios before calling the provider', async () => {
      await expect(
        createVideo('make a video', {
          model: 'veo-3.1',
          aspectRatio: '1:1',
        })
      ).rejects.toThrow('Unsupported aspect ratio')

      expect(createVercelVideo).not.toHaveBeenCalled()
    })

    it('should reject unsupported durations before calling the provider', async () => {
      await expect(
        createVideo('make a video', {
          model: 'veo-3.1',
          duration: 15,
        })
      ).rejects.toThrow('Unsupported duration')

      expect(createVercelVideo).not.toHaveBeenCalled()
    })
  })

  // @note retrieveVideo reads the stored object through the storage contract's
  // body rather than an AWS stream. Nothing covered it before, which made it
  // the one place in the object storage migration where a rewritten read could
  // have failed silently.

  describe('retrieveVideo', () => {
    it('returns the bytes and content type', async () => {
      const bytes = new TextEncoder().encode('video-bytes')

      getObject.mockResolvedValue({
        body: { arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer) },
        contentType: 'video/mp4',
      })

      const result = await retrieveVideo('video-123')

      expect(getObject).toHaveBeenCalledWith('video', expect.any(String))
      expect(result.type).toBe('video/mp4')
      expect(new TextDecoder().decode(result.data)).toBe('video-bytes')
    })

    it('returns a Uint8Array, not a raw ArrayBuffer', async () => {
      getObject.mockResolvedValue({
        body: {
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
        },
        contentType: 'video/mp4',
      })

      // @note callers write this straight to a response body, where an
      // ArrayBuffer would serialise as an empty object rather than bytes
      expect((await retrieveVideo('video-123')).data).toBeInstanceOf(Uint8Array)
    })

    it('defaults the content type when the store does not report one', async () => {
      getObject.mockResolvedValue({
        body: { arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1)) },
      })

      expect((await retrieveVideo('video-123')).type).toBe(
        'application/octet-stream'
      )
    })

    it('returns null when the object has no body', async () => {
      getObject.mockResolvedValue({ body: undefined, contentType: 'video/mp4' })

      expect(await retrieveVideo('video-123')).toBeNull()
    })

    it('returns null rather than throwing when the object is missing', async () => {
      getObject.mockRejectedValue(new Error('NoSuchKey'))

      expect(await retrieveVideo('missing')).toBeNull()
    })
  })

  describe('editVideo', () => {
    it('should allow frame-only edits', async () => {
      editVercelVideo.mockResolvedValue({
        urls: ['data:video/mp4;base64,AA=='],
        usage: {
          model: 'veo-3.1',
          inputTokens: 0,
          outputTokens: 1,
        },
      })

      const result = await editVideo('animate this', [], {
        model: 'veo-3.1',
        frames: ['https://source.example/start.png'],
      })

      expect(editVercelVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'animate this',
          videos: [],
          frames: ['https://source.example/start.png'],
        })
      )
      expect(result.urls).toHaveLength(1)
      expect(result.urls[0]).toContain('https://example.com/api/v1/video/')
    })

    it('should reject edits without any media', async () => {
      await expect(
        editVideo('animate this', [], {
          model: 'veo-3.1',
        })
      ).rejects.toThrow('At least one video, frame, or audio is required')

      expect(editVercelVideo).not.toHaveBeenCalled()
    })
  })
})
