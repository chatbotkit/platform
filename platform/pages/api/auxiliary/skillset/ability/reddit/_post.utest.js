/* eslint-disable @typescript-eslint/no-require-imports */
import handlers, {
  POST_GALLERY_CREATE_HANDLER_NAME,
  POST_IMAGE_CREATE_HANDLER_NAME,
  POST_VIDEO_CREATE_HANDLER_NAME,
  postGalleryCreateSchema,
  postImageCreateSchema,
  postVideoCreateSchema,
} from '@/pages/api/auxiliary/skillset/ability/reddit/post'

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlersMap) => {
    // @note return an object with the handler functions for direct testing
    const result = {}

    for (const [name, handler] of Object.entries(handlersMap)) {
      // @note every auxiliary route is authenticated; bind a mock session so
      // the tests keep calling the inner function as (parameters, headers)
      result[name] = (parameters, headers) =>
        handler.fn({ user: { id: 'test-user-id' } }, parameters, headers)
    }

    return result
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`API Error: ${response.status}`))
  )

  return {
    __esModule: true,
    default: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

const mockCall = require('@/lib/call').default

// --- Response factories ---

const mediaFetchResponse = (type) => ({
  ok: true,
  blob: jest.fn().mockResolvedValue(new Blob(['data'], { type })),
})

const leaseResponse = ({
  assetId = 'asset-1',
  action = '//bucket.s3.amazonaws.com',
  key = 'media/asset-1.bin',
} = {}) => ({
  ok: true,
  json: jest.fn().mockResolvedValue({
    args: {
      action,
      fields: [
        { name: 'key', value: key },
        { name: 'x-amz-signature', value: 'signature' },
      ],
    },
    asset: { asset_id: assetId },
  }),
})

const s3UploadResponse = (location) => ({
  ok: true,
  headers: new Headers(location ? { location } : {}),
})

const submitResponse = ({
  data = {
    url: 'https://www.reddit.com/r/test/comments/abc/title/',
    id: 'abc',
    name: 't3_abc',
  },
  errors = [],
} = {}) => ({
  ok: true,
  json: jest.fn().mockResolvedValue({ json: { errors, data } }),
})

/**
 * Route the mocked `call` by URL so concurrent uploads (gallery / video) stay
 * deterministic regardless of resolution order. Media fetches infer their
 * content type from the file extension so video vs image validation can be
 * exercised.
 */
const routeCall = ({ location = 'https://bucket.s3.amazonaws.com/media/asset-1.bin', submit } = {}) =>
  mockCall.mockImplementation(async (url) => {
    const target = String(url)

    if (target.endsWith('/api/media/asset.json')) {
      return leaseResponse()
    }

    if (target.includes('s3.amazonaws.com')) {
      return s3UploadResponse(location)
    }

    if (
      target.endsWith('/api/submit') ||
      target.endsWith('/api/submit_gallery_post.json')
    ) {
      return submit ? submit() : submitResponse()
    }

    // @note anything else is the upstream media fetch

    return mediaFetchResponse(
      /\.(mp4|mov|webm)$/i.test(target) ? 'video/mp4' : 'image/png'
    )
  })

const findCall = (predicate) =>
  mockCall.mock.calls.find(([url]) => predicate(String(url)))

describe('Reddit Post Handlers', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()

    mockCall.mockReset()
  })

  describe('Handler Names', () => {
    it('should export correct handler names', () => {
      expect(POST_IMAGE_CREATE_HANDLER_NAME).toBe('post/image/create')
      expect(POST_GALLERY_CREATE_HANDLER_NAME).toBe('post/gallery/create')
      expect(POST_VIDEO_CREATE_HANDLER_NAME).toBe('post/video/create')
    })

    it('should register all handlers', () => {
      expect(handlers).toHaveProperty(POST_IMAGE_CREATE_HANDLER_NAME)
      expect(handlers).toHaveProperty(POST_GALLERY_CREATE_HANDLER_NAME)
      expect(handlers).toHaveProperty(POST_VIDEO_CREATE_HANDLER_NAME)
    })
  })

  describe('Schemas', () => {
    describe('postImageCreateSchema', () => {
      it('should accept valid parameters and default flags', () => {
        const result = postImageCreateSchema.safeParse({
          subreddit: 'test',
          title: 'Hello',
          imageUrl: 'https://example.com/cat.png',
        })

        expect(result.success).toBe(true)
        expect(result.data.nsfw).toBe(false)
        expect(result.data.spoiler).toBe(false)
      })

      it('should reject missing required fields', () => {
        const result = postImageCreateSchema.safeParse({ subreddit: 'test' })

        expect(result.success).toBe(false)
      })
    })

    describe('postGalleryCreateSchema', () => {
      it('should accept valid parameters', () => {
        const result = postGalleryCreateSchema.safeParse({
          subreddit: 'test',
          title: 'Gallery',
          imageUrls: 'https://example.com/a.png https://example.com/b.png',
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing imageUrls', () => {
        const result = postGalleryCreateSchema.safeParse({
          subreddit: 'test',
          title: 'Gallery',
        })

        expect(result.success).toBe(false)
      })
    })

    describe('postVideoCreateSchema', () => {
      it('should accept valid parameters', () => {
        const result = postVideoCreateSchema.safeParse({
          subreddit: 'test',
          title: 'Clip',
          videoUrl: 'https://example.com/clip.mp4',
          posterImageUrl: 'https://example.com/poster.png',
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing posterImageUrl', () => {
        const result = postVideoCreateSchema.safeParse({
          subreddit: 'test',
          title: 'Clip',
          videoUrl: 'https://example.com/clip.mp4',
        })

        expect(result.success).toBe(false)
      })
    })
  })

  describe('Authentication', () => {
    it('should throw when access token is missing', async () => {
      const headersWithoutToken = new Headers()

      await expect(
        handlers[POST_IMAGE_CREATE_HANDLER_NAME](
          postImageCreateSchema.parse({
            subreddit: 'test',
            title: 'Hello',
            imageUrl: 'https://example.com/cat.png',
          }),
          headersWithoutToken
        )
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('post/image/create', () => {
    const params = () =>
      postImageCreateSchema.parse({
        subreddit: 'test',
        title: 'Hello',
        imageUrl: 'https://example.com/cat.png',
      })

    it('should upload the image and submit the post', async () => {
      routeCall()

      const result = await handlers[POST_IMAGE_CREATE_HANDLER_NAME](
        params(),
        mockHeaders
      )

      expect(result).toEqual({
        id: 'abc',
        name: 't3_abc',
        url: 'https://www.reddit.com/r/test/comments/abc/title/',
      })

      // @note a lease was requested and the bytes uploaded to S3

      expect(
        findCall((url) => url.endsWith('/api/media/asset.json'))
      ).toBeDefined()
      expect(findCall((url) => url.includes('s3.amazonaws.com'))).toBeDefined()

      // @note the submit uses kind=image and references the uploaded media URL

      const submitCall = findCall((url) => url.endsWith('/api/submit'))

      expect(submitCall).toBeDefined()
      expect(submitCall[1].body).toContain('kind=image')
      expect(submitCall[1].body).toContain(
        encodeURIComponent('https://bucket.s3.amazonaws.com/media/asset-1.bin')
      )
      expect(submitCall[1].headers.Authorization).toBe('Bearer test-token')
    })

    it('should not attach the Reddit token to the S3 upload', async () => {
      routeCall()

      await handlers[POST_IMAGE_CREATE_HANDLER_NAME](params(), mockHeaders)

      const uploadCall = findCall((url) => url.includes('s3.amazonaws.com'))

      expect(uploadCall[1].headers).toBeUndefined()
    })

    it('should fall back to action and key when S3 omits a location', async () => {
      routeCall({ location: undefined })

      await handlers[POST_IMAGE_CREATE_HANDLER_NAME](params(), mockHeaders)

      const submitCall = findCall((url) => url.endsWith('/api/submit'))

      expect(submitCall[1].body).toContain(
        encodeURIComponent('https://bucket.s3.amazonaws.com/media/asset-1.bin')
      )
    })

    it('should reject a URL that is not an image', async () => {
      mockCall.mockImplementation(async (url) => {
        if (String(url).includes('example.com')) {
          return mediaFetchResponse('text/html')
        }

        return leaseResponse()
      })

      await expect(
        handlers[POST_IMAGE_CREATE_HANDLER_NAME](params(), mockHeaders)
      ).rejects.toThrow(/does not point to an image/)
    })

    it('should surface Reddit submit errors', async () => {
      routeCall({
        submit: () =>
          submitResponse({
            errors: [['SUBREDDIT_NOEXIST', 'that subreddit does not exist', 'sr']],
          }),
      })

      await expect(
        handlers[POST_IMAGE_CREATE_HANDLER_NAME](params(), mockHeaders)
      ).rejects.toThrow(/that subreddit does not exist/)
    })

    it('should throw when the lease request fails', async () => {
      mockCall.mockImplementation(async (url) => {
        const target = String(url)

        if (target.endsWith('/api/media/asset.json')) {
          return { ok: false, status: 403 }
        }

        return mediaFetchResponse('image/png')
      })

      await expect(
        handlers[POST_IMAGE_CREATE_HANDLER_NAME](params(), mockHeaders)
      ).rejects.toThrow('API Error: 403')
    })
  })

  describe('post/gallery/create', () => {
    const params = (imageUrls) =>
      postGalleryCreateSchema.parse({
        subreddit: 'test',
        title: 'Gallery',
        imageUrls,
      })

    it('should upload each image and submit a gallery', async () => {
      routeCall()

      const result = await handlers[POST_GALLERY_CREATE_HANDLER_NAME](
        params('https://example.com/a.png https://example.com/b.png'),
        mockHeaders
      )

      expect(result.id).toBe('abc')

      const submitCall = findCall((url) =>
        url.endsWith('/api/submit_gallery_post.json')
      )

      expect(submitCall).toBeDefined()
      expect(submitCall[1].headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(submitCall[1].body)

      expect(body.items).toHaveLength(2)
      expect(body.items[0]).toHaveProperty('media_id')
      expect(body.sr).toBe('test')
    })

    it('should reject a gallery with fewer than two images', async () => {
      routeCall()

      await expect(
        handlers[POST_GALLERY_CREATE_HANDLER_NAME](
          params('https://example.com/only.png'),
          mockHeaders
        )
      ).rejects.toThrow(/at least two image URLs/)
    })

    it('should reject a gallery with more than twenty images', async () => {
      routeCall()

      const urls = Array.from(
        { length: 21 },
        (_, index) => `https://example.com/${index}.png`
      ).join(' ')

      await expect(
        handlers[POST_GALLERY_CREATE_HANDLER_NAME](params(urls), mockHeaders)
      ).rejects.toThrow(/at most 20 images/)
    })
  })

  describe('post/video/create', () => {
    const params = () =>
      postVideoCreateSchema.parse({
        subreddit: 'test',
        title: 'Clip',
        videoUrl: 'https://example.com/clip.mp4',
        posterImageUrl: 'https://example.com/poster.png',
      })

    it('should upload the video and poster and submit', async () => {
      routeCall()

      const result = await handlers[POST_VIDEO_CREATE_HANDLER_NAME](
        params(),
        mockHeaders
      )

      expect(result.id).toBe('abc')

      const submitCall = findCall((url) => url.endsWith('/api/submit'))

      expect(submitCall).toBeDefined()
      expect(submitCall[1].body).toContain('kind=video')
      expect(submitCall[1].body).toContain('video_poster_url')
    })

    it('should reject when the video URL is not a video', async () => {
      // @note both URLs resolve to images, so the video upload should fail

      mockCall.mockImplementation(async (url) => {
        const target = String(url)

        if (target.endsWith('/api/media/asset.json')) {
          return leaseResponse()
        }

        if (target.includes('s3.amazonaws.com')) {
          return s3UploadResponse('https://bucket.s3.amazonaws.com/x.bin')
        }

        return mediaFetchResponse('image/png')
      })

      await expect(
        handlers[POST_VIDEO_CREATE_HANDLER_NAME](
          postVideoCreateSchema.parse({
            subreddit: 'test',
            title: 'Clip',
            videoUrl: 'https://example.com/not-a-video.png',
            posterImageUrl: 'https://example.com/poster.png',
          }),
          mockHeaders
        )
      ).rejects.toThrow(/does not point to a video/)
    })
  })
})
