/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './download'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/image', () => ({
  retrieveImage: jest.fn(),
}))

jest.mock('@/lib/mime', () => ({
  typeToExtension: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  notFound: () => ({ status: 404 }),
  send: (data, headers) => ({ status: 200, body: data, headers }),
}))

const { retrieveImage } = require('@/lib/image')
const { typeToExtension } = require('@/lib/mime')

describe('GET /api/v1/image/[imageId]/download', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should serve image bytes from bucket-backed storage', async () => {
      const binaryData = Buffer.from('binary image data')

      retrieveImage.mockResolvedValue({
        data: binaryData,
        type: 'image/png',
      })
      typeToExtension.mockReturnValue('png')

      const req = {
        query: { imageId: 'img123' },
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.body).toBe(binaryData)
      expect(result.headers).toEqual({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="image.png"',
      })
      expect(retrieveImage).toHaveBeenCalledWith('img123')
    })

    it('should serve different stored image types', async () => {
      const binaryData = Buffer.from('binary image data')

      retrieveImage.mockResolvedValue({
        data: binaryData,
        type: 'image/png',
      })
      typeToExtension.mockReturnValue('png')

      const req = {
        query: { imageId: 'img123' },
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(typeToExtension).toHaveBeenCalledWith('image/png')
    })
  })

  describe('edge cases', () => {
    it('should return 404 when image is missing', async () => {
      retrieveImage.mockResolvedValue(null)

      const req = {
        query: { imageId: 'nonexistent' },
      }

      const result = await handler(req)

      expect(result).toEqual({ status: 404 })
    })
  })

  describe('content type handling', () => {
    it('should handle different image types correctly', async () => {
      const testCases = [
        { type: 'image/gif', ext: 'gif' },
        { type: 'image/webp', ext: 'webp' },
        { type: 'image/svg+xml', ext: 'svg' },
      ]

      for (const { type, ext } of testCases) {
        jest.clearAllMocks()

        const binaryData = Buffer.from('image data')

        retrieveImage.mockResolvedValue({
          data: binaryData,
          type,
        })
        typeToExtension.mockReturnValue(ext)

        const req = {
          query: { imageId: 'test' },
        }

        const result = await handler(req)

        expect(result.status).toBe(200)
        expect(typeToExtension).toHaveBeenCalledWith(type)
      }
    })
  })
})
