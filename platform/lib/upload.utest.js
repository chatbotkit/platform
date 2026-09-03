import { getUploadFile } from '@/lib/upload'

jest.mock('@/lib/response', () => ({
  throwBadRequest: jest.fn(() => {
    throw new Error('Bad Request')
  }),
}))

// Helper to create a mock FormData with a get method
function createMockFormData(fileOrNull) {
  return {
    get: jest.fn().mockReturnValue(fileOrNull),
  }
}

// Helper to create a mock file object
function createMockFile(content, name, type) {
  return {
    name,
    type,
    size: content.length,
    lastModified: Date.now(),
    content,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
    text: async () => content,
    stream: () => {
      throw new Error('Not implemented')
    },
    slice: () => {
      throw new Error('Not implemented')
    },
  }
}

describe('Upload Utilities', () => {
  describe('getUploadFile', () => {
    it('should extract file from valid FormData', async () => {
      const mockFile = createMockFile('test content', 'test.txt', 'text/plain')
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
      expect(result.name).toBe('test.txt')
      expect(result.type).toBe('text/plain')
    })

    it('should extract file with different name and type', async () => {
      const mockFile = createMockFile('image data', 'photo.jpg', 'image/jpeg')
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
      expect(result.name).toBe('photo.jpg')
      expect(result.type).toBe('image/jpeg')
    })

    it('should throw error when file field is missing', async () => {
      const mockFormData = createMockFormData(null)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      await expect(getUploadFile(mockRequest)).rejects.toThrow('Bad Request')
    })

    it('should throw error when file field is string', async () => {
      const mockFormData = createMockFormData('not a file object')

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      await expect(getUploadFile(mockRequest)).rejects.toThrow('Bad Request')
    })

    it('should throw error when file field is null', async () => {
      const mockFormData = createMockFormData(null)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      await expect(getUploadFile(mockRequest)).rejects.toThrow('Bad Request')
    })

    it('should handle file with empty content', async () => {
      const mockFile = createMockFile('', 'empty.txt', 'text/plain')
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
      expect(result.name).toBe('empty.txt')
      expect(result.size).toBe(0)
    })

    it('should handle file with large content', async () => {
      const largeContent = new Array(1000).fill('x').join('')
      const mockFile = createMockFile(largeContent, 'large.txt', 'text/plain')
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
      expect(result.name).toBe('large.txt')
      expect(result.size).toBeGreaterThan(0)
    })

    it('should handle file with special characters in name', async () => {
      const mockFile = createMockFile(
        'content',
        'file-with-special_chars.txt',
        'text/plain'
      )
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
      expect(result.name).toBe('file-with-special_chars.txt')
    })

    it('should handle PDF file upload', async () => {
      const mockFile = createMockFile(
        'pdf content',
        'document.pdf',
        'application/pdf'
      )
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
      expect(result.type).toBe('application/pdf')
    })

    it('should ignore other form fields', async () => {
      const mockFile = createMockFile('content', 'test.txt', 'text/plain')
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
    })

    it('should handle async formData extraction', async () => {
      const mockFile = createMockFile(
        'async content',
        'async.txt',
        'text/plain'
      )
      const mockFormData = createMockFormData(mockFile)

      const mockRequest = {
        formData: jest
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(() => resolve(mockFormData), 10)
              )
          ),
      }

      const result = await getUploadFile(mockRequest)

      expect(result).toBe(mockFile)
    })
  })
})
