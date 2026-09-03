import {
  PORTRAIT_HEIGHT,
  PORTRAIT_QUALITY,
  PORTRAIT_WIDTH,
  SUPPORTED_IMAGE_TYPES,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_WIDTH,
  createPortrait,
  createThumbnail,
  getOutputMimeType,
  isSupportedImageType,
  resizeImage,
} from '@/lib/image.transform'

import { Jimp } from 'jimp'

// @note create a factory function for mock images
const createMockImage = () => ({
  width: 1000,
  height: 800,
  resize: jest.fn().mockReturnThis(),
  crop: jest.fn().mockReturnThis(),
  getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
})

// Mock jimp
jest.mock('jimp', () => ({
  Jimp: {
    fromBuffer: jest.fn(),
  },
}))

describe('image.transform', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // @note reset the mock implementation before each test
    Jimp.fromBuffer.mockResolvedValue(createMockImage())
  })

  describe('constants', () => {
    it('should have correct thumbnail dimensions', () => {
      expect(THUMBNAIL_WIDTH).toBe(400)
      expect(THUMBNAIL_HEIGHT).toBe(400)
      expect(THUMBNAIL_QUALITY).toBe(80)
    })

    it('should have correct portrait dimensions', () => {
      expect(PORTRAIT_WIDTH).toBe(450)
      expect(PORTRAIT_HEIGHT).toBe(720)
      expect(PORTRAIT_QUALITY).toBe(80)
    })

    it('should have supported image types', () => {
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg')
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/png')
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/gif')
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/bmp')
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/tiff')
    })
  })

  describe('isSupportedImageType', () => {
    it('should return true for supported MIME types', () => {
      expect(isSupportedImageType('image/jpeg')).toBe(true)
      expect(isSupportedImageType('image/jpg')).toBe(true)
      expect(isSupportedImageType('image/png')).toBe(true)
      expect(isSupportedImageType('image/gif')).toBe(true)
      expect(isSupportedImageType('image/bmp')).toBe(true)
      expect(isSupportedImageType('image/tiff')).toBe(true)
    })

    it('should return false for unsupported MIME types', () => {
      expect(isSupportedImageType('image/webp')).toBe(false)
      expect(isSupportedImageType('image/svg+xml')).toBe(false)
      expect(isSupportedImageType('application/pdf')).toBe(false)
      expect(isSupportedImageType('text/plain')).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(isSupportedImageType('IMAGE/JPEG')).toBe(true)
      expect(isSupportedImageType('Image/Png')).toBe(true)
    })
  })

  describe('getOutputMimeType', () => {
    it('should return image/png for PNG input', () => {
      expect(getOutputMimeType('image/png')).toBe('image/png')
    })

    it('should return image/png for GIF input', () => {
      expect(getOutputMimeType('image/gif')).toBe('image/png')
    })

    it('should return image/jpeg for JPEG input', () => {
      expect(getOutputMimeType('image/jpeg')).toBe('image/jpeg')
      expect(getOutputMimeType('image/jpg')).toBe('image/jpeg')
    })

    it('should return image/jpeg for BMP input', () => {
      expect(getOutputMimeType('image/bmp')).toBe('image/jpeg')
    })

    it('should return image/jpeg for TIFF input', () => {
      expect(getOutputMimeType('image/tiff')).toBe('image/jpeg')
    })

    it('should be case-insensitive', () => {
      expect(getOutputMimeType('IMAGE/PNG')).toBe('image/png')
      expect(getOutputMimeType('IMAGE/JPEG')).toBe('image/jpeg')
    })
  })

  describe('createThumbnail', () => {
    const mockBuffer = Buffer.from('test-image-data')

    it('should create a thumbnail with default options', async () => {
      const result = await createThumbnail(mockBuffer)

      expect(Jimp.fromBuffer).toHaveBeenCalled()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.mimeType).toBe('image/jpeg')
    })

    it('should return PNG mimeType for PNG input', async () => {
      const result = await createThumbnail(mockBuffer, {
        contentType: 'image/png',
      })

      expect(result.mimeType).toBe('image/png')
    })

    it('should use default thumbnail dimensions', async () => {
      await createThumbnail(mockBuffer)

      const mockImage = await Jimp.fromBuffer(mockBuffer)

      expect(mockImage.getBuffer).toHaveBeenCalledWith('image/jpeg', {
        quality: 80,
      })
    })

    it('should accept custom dimensions', async () => {
      await createThumbnail(mockBuffer, {
        width: 200,
        height: 200,
        quality: 90,
      })

      const mockImage = await Jimp.fromBuffer(mockBuffer)

      expect(mockImage.getBuffer).toHaveBeenCalledWith('image/jpeg', {
        quality: 90,
      })
    })

    it('should resize landscape image by height first', async () => {
      // Mock a landscape image (wider than tall)
      const mockLandscapeImage = {
        width: 1600,
        height: 900, // 16:9 aspect ratio
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockLandscapeImage)

      await createThumbnail(mockBuffer)

      // For 400x400 target (1:1), landscape image should resize by height
      expect(mockLandscapeImage.resize).toHaveBeenCalledWith({ h: 400 })
    })

    it('should resize portrait image by width first', async () => {
      // Mock a portrait image (taller than wide)
      const mockPortraitImage = {
        width: 600,
        height: 800,
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockPortraitImage)

      await createThumbnail(mockBuffer)

      // Portrait image should resize by width
      expect(mockPortraitImage.resize).toHaveBeenCalledWith({ w: 400 })
    })
  })

  describe('createPortrait', () => {
    const mockBuffer = Buffer.from('test-image-data')

    it('should create a portrait with default options', async () => {
      const result = await createPortrait(mockBuffer)

      expect(Jimp.fromBuffer).toHaveBeenCalled()
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.mimeType).toBe('image/jpeg')
    })

    it('should return PNG mimeType for PNG input', async () => {
      const result = await createPortrait(mockBuffer, {
        contentType: 'image/png',
      })

      expect(result.mimeType).toBe('image/png')
    })

    it('should use default portrait dimensions and quality', async () => {
      await createPortrait(mockBuffer)

      const mockImage = await Jimp.fromBuffer(mockBuffer)

      expect(mockImage.getBuffer).toHaveBeenCalledWith('image/jpeg', {
        quality: 80,
      })
    })

    it('should accept custom dimensions', async () => {
      await createPortrait(mockBuffer, {
        width: 300,
        height: 400,
        quality: 95,
      })

      const mockImage = await Jimp.fromBuffer(mockBuffer)

      expect(mockImage.getBuffer).toHaveBeenCalledWith('image/jpeg', {
        quality: 95,
      })
    })
  })

  describe('resizeImage', () => {
    const mockBuffer = Buffer.from('test-image-data')

    it('should resize with width only', async () => {
      const mockImage = {
        width: 1000,
        height: 800,
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockImage)

      await resizeImage(mockBuffer, { width: 500 })

      expect(mockImage.resize).toHaveBeenCalledWith({ w: 500 })
    })

    it('should resize with height only', async () => {
      const mockImage = {
        width: 1000,
        height: 800,
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockImage)

      await resizeImage(mockBuffer, { height: 400 })

      expect(mockImage.resize).toHaveBeenCalledWith({ h: 400 })
    })

    it('should resize with both dimensions in contain mode', async () => {
      const mockImage = {
        width: 1000,
        height: 800,
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockImage)

      await resizeImage(mockBuffer, { width: 500, height: 400, fit: 'contain' })

      expect(mockImage.resize).toHaveBeenCalledWith({ w: 500, h: 400 })
    })

    it('should resize and crop with cover mode', async () => {
      const mockImage = {
        width: 1000,
        height: 800,
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockImage)

      await resizeImage(mockBuffer, { width: 500, height: 400, fit: 'cover' })

      expect(mockImage.resize).toHaveBeenCalled()
      expect(mockImage.crop).toHaveBeenCalled()
    })

    it('should use default quality of 80', async () => {
      const mockImage = {
        width: 1000,
        height: 800,
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockImage)

      await resizeImage(mockBuffer, { width: 500 })

      expect(mockImage.getBuffer).toHaveBeenCalledWith('image/jpeg', {
        quality: 80,
      })
    })

    it('should accept custom quality', async () => {
      const mockImage = {
        width: 1000,
        height: 800,
        resize: jest.fn().mockReturnThis(),
        crop: jest.fn().mockReturnThis(),
        getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-jpeg-data')),
      }

      Jimp.fromBuffer.mockResolvedValueOnce(mockImage)

      await resizeImage(mockBuffer, { width: 500, quality: 60 })

      expect(mockImage.getBuffer).toHaveBeenCalledWith('image/jpeg', {
        quality: 60,
      })
    })
  })
})
