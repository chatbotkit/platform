/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './download'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/video', () => ({
  retrieveVideo: jest.fn(),
}))

jest.mock('@/lib/mime', () => ({
  typeToExtension: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  notFound: () => ({ status: 404 }),
  send: (data, headers) => ({ status: 200, body: data, headers }),
}))

const { retrieveVideo } = require('@/lib/video')
const { typeToExtension } = require('@/lib/mime')

describe('GET /api/v1/video/[videoId]/download', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should serve video bytes from bucket-backed storage', async () => {
    const binaryData = Buffer.from('binary video data')

    retrieveVideo.mockResolvedValue({
      data: binaryData,
      type: 'video/mp4',
    })
    typeToExtension.mockReturnValue('mp4')

    const req = {
      query: { videoId: 'vid123' },
    }

    const result = await handler(req)

    expect(result.status).toBe(200)
    expect(result.body).toBe(binaryData)
    expect(result.headers).toEqual({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="video.mp4"',
    })
    expect(retrieveVideo).toHaveBeenCalledWith('vid123')
  })

  it('should return 404 when video is missing', async () => {
    retrieveVideo.mockResolvedValue(null)

    const req = {
      query: { videoId: 'nonexistent' },
    }

    const result = await handler(req)

    expect(result).toEqual({ status: 404 })
  })
})
