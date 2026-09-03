import {
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  chunkFile,
  chunkText,
  chunkUrl,
  isSupportedContentType,
} from './dsd2'

jest.mock('@chatbotkit-dev/file/support', () => ({
  getSupportedContentTypes: jest.fn(),
}))

jest.mock('@/lib/dataurl.blob', () => ({
  blobToDataUrl: jest.fn(),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  withRetry: jest.fn((fn) => fn),
  withTimeout: jest.fn((fn) => fn),
  withBodyTimeout: jest.fn((fn) => fn),
}))

jest.mock('@/lib/host', () => ({
  getLocalAPIHostURL: jest.fn((path) => `http://localhost${path}`),
}))

jest.mock('@/lib/error', () => ({
  UserInputError: class UserInputError extends Error {
    constructor(message) {
      super(message)
      this.name = 'UserInputError'
    }
  },
}))

jest.mock('@/lib/temp.file', () => ({
  uploadTempBlob: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextUser: jest.fn(() => ({ id: 'context-user-id' })),
}))

jest.mock('@/lib/session.temp', () => ({
  getTemporaryUserToken: jest.fn(async (userId) => `temp-token-${userId}`),
}))

describe('dsd2', () => {
  let mockFetch
  let mockGetSupportedContentTypes
  let mockBlobToDataUrl
  let mockUploadTempBlob

  beforeEach(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mockFetch = require('@/lib/fetch').default
    mockGetSupportedContentTypes =
      require('@chatbotkit-dev/file/support').getSupportedContentTypes
    mockBlobToDataUrl = require('@/lib/dataurl.blob').blobToDataUrl
    mockUploadTempBlob = require('@/lib/temp.file').uploadTempBlob

    jest.clearAllMocks()
    mockGetSupportedContentTypes.mockReturnValue([
      'text/plain',
      'application/pdf',
      'text/markdown',
    ])
    /* eslint-enable @typescript-eslint/no-require-imports */
  })

  describe('constants', () => {
    it('should export DEFAULT_CHUNK_SIZE', () => {
      expect(DEFAULT_CHUNK_SIZE).toBe(512)
    })

    it('should export DEFAULT_CHUNK_OVERLAP', () => {
      expect(DEFAULT_CHUNK_OVERLAP).toBe(16)
    })
  })

  describe('chunkText', () => {
    beforeEach(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      mockBlobToDataUrl.mockResolvedValue('data:text/plain;base64,dGVzdA==')
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          items: [{ text: 'chunk1', meta: {} }],
          request: {},
        }),
      })
    })

    it('should chunk text with default options', async () => {
      const text = { text: 'test content', type: 'text/plain' }

      const result = await chunkText(text)

      expect(result).toEqual({
        items: [{ text: 'chunk1', meta: {} }],
        request: {},
      })
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/auxiliary/dataset/chunk',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer temp-token-context-user-id',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: 'data:text/plain;base64,dGVzdA==',
            size: DEFAULT_CHUNK_SIZE,
            overlap: DEFAULT_CHUNK_OVERLAP,
            separators: undefined,
            model: undefined,
          }),
        }
      )
    })

    it('should chunk text with custom options', async () => {
      const text = { text: 'test content', type: 'text/plain' }
      const options = {
        size: 1024,
        overlap: 32,
        separators: ['\n\n', '\n'],
        model: 'gpt-4',
      }

      await chunkText(text, options)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            file: 'data:text/plain;base64,dGVzdA==',
            size: 1024,
            overlap: 32,
            separators: ['\n\n', '\n'],
            model: 'gpt-4',
          }),
        })
      )
    })

    it('should authenticate with a token for an explicit userId', async () => {
      const { getTemporaryUserToken } = require('@/lib/session.temp')

      await chunkText(
        { text: 'test content', type: 'text/plain' },
        { userId: 'explicit-user-id' }
      )

      expect(getTemporaryUserToken).toHaveBeenCalledWith('explicit-user-id', {
        durationInSeconds: expect.any(Number),
      })
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/auxiliary/dataset/chunk',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer temp-token-explicit-user-id',
          }),
        })
      )
    })

    it('should refuse to call the chunker without an acting user', async () => {
      const { getContextUser } = require('@/lib/context.store')

      getContextUser.mockReturnValueOnce(null)

      await expect(
        chunkText({ text: 'test content', type: 'text/plain' })
      ).rejects.toThrow('Unable to determine the acting user')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should throw error for empty text', async () => {
      const text = { text: '', type: 'text/plain' }

      await expect(chunkText(text)).rejects.toThrow(
        'blob size must be greater than 0'
      )
    })

    it('should throw error for missing type', async () => {
      const text = { text: 'test content', type: '' }

      await expect(chunkText(text)).rejects.toThrow('blob type must be set')
    })

    it('should throw error for unsupported content type', async () => {
      const text = { text: 'test content', type: 'image/png' }

      await expect(chunkText(text)).rejects.toThrow(
        'Unsupported content type image/png'
      )
    })

    it('should handle API error response', async () => {
      const text = { text: 'test content', type: 'text/plain' }

      mockFetch.mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Something went wrong',
            code: 'BAD_REQUEST',
          })
        ),
      })

      await expect(chunkText(text)).rejects.toThrow('Something went wrong')
    })

    it('should handle non-JSON API error response', async () => {
      const text = { text: 'test content', type: 'text/plain' }

      mockFetch.mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Server error'),
      })

      await expect(chunkText(text)).rejects.toThrow('Server error')
    })

    it('should cap size and overlap at MAX_SAFE_INTEGER', async () => {
      const text = { text: 'test content', type: 'text/plain' }
      const options = {
        size: Number.MAX_SAFE_INTEGER + 1000,
        overlap: Number.MAX_SAFE_INTEGER + 1000,
      }

      await chunkText(text, options)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)

      expect(callBody.size).toBe(Number.MAX_SAFE_INTEGER)
      expect(callBody.overlap).toBe(Number.MAX_SAFE_INTEGER)
    })
    /* eslint-enable @typescript-eslint/no-require-imports */
  })

  describe('chunkUrl', () => {
    beforeEach(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          items: [{ text: 'chunk1', meta: {} }],
          request: {},
        }),
      })
    })

    it('should chunk URL with default options', async () => {
      const url = new URL('https://example.com/document')

      const result = await chunkUrl(url)

      expect(result).toEqual({
        items: [{ text: 'chunk1', meta: {} }],
        request: {},
      })
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/auxiliary/dataset/chunk',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer temp-token-context-user-id',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: 'https://example.com/document',
            size: DEFAULT_CHUNK_SIZE,
            overlap: DEFAULT_CHUNK_OVERLAP,
            separators: undefined,
            model: undefined,
          }),
        }
      )
    })

    it('should chunk URL with custom options', async () => {
      const url = new URL('https://example.com/document')
      const options = {
        size: 2048,
        overlap: 64,
        separators: ['\n'],
        model: 'gpt-3.5-turbo',
      }

      await chunkUrl(url, options)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            file: 'https://example.com/document',
            size: 2048,
            overlap: 64,
            separators: ['\n'],
            model: 'gpt-3.5-turbo',
          }),
        })
      )
    })

    it('should handle API error response', async () => {
      const url = new URL('https://example.com/document')

      mockFetch.mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('API Error'),
      })

      await expect(chunkUrl(url)).rejects.toThrow('API Error')
    })

    it('should surface an unsupported content type as a UserInputError', async () => {
      const { UserInputError } = require('@/lib/error')

      const url = new URL('https://example.com/document')

      mockFetch.mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Unsupported content type text/yaml',
            code: 'BAD_REQUEST',
          })
        ),
      })

      await expect(chunkUrl(url)).rejects.toBeInstanceOf(UserInputError)
      await expect(chunkUrl(url)).rejects.toThrow(
        'Unsupported content type text/yaml'
      )
    })

    it('should surface a non-user bad-request as a plain APIError', async () => {
      const { UserInputError } = require('@/lib/error')

      const url = new URL('https://example.com/document')

      mockFetch.mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Something else went wrong',
            code: 'BAD_REQUEST',
          })
        ),
      })

      await expect(chunkUrl(url)).rejects.not.toBeInstanceOf(UserInputError)
      await expect(chunkUrl(url)).rejects.toThrow('Something else went wrong')
    })
    /* eslint-enable @typescript-eslint/no-require-imports */
  })

  describe('chunkFile', () => {
    beforeEach(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      mockUploadTempBlob.mockResolvedValue(
        new URL('https://temp.example.com/file123')
      )
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          items: [{ text: 'chunk1', meta: {} }],
          request: {},
        }),
      })
    })

    it('should chunk file with default options', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })

      const result = await chunkFile(blob)

      expect(mockUploadTempBlob).toHaveBeenCalledWith(blob, {
        maxSize: Infinity,
      })
      expect(result).toEqual({
        items: [{ text: 'chunk1', meta: {} }],
        request: {},
      })
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost/api/auxiliary/dataset/chunk',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer temp-token-context-user-id',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: 'https://temp.example.com/file123',
            size: DEFAULT_CHUNK_SIZE,
            overlap: DEFAULT_CHUNK_OVERLAP,
            separators: undefined,
            model: undefined,
          }),
        }
      )
    })

    it('should chunk file with custom options', async () => {
      const blob = new Blob(['test content'], { type: 'application/pdf' })
      const options = {
        size: 256,
        overlap: 8,
        separators: ['.'],
        model: 'custom-model',
      }

      await chunkFile(blob, options)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            file: 'https://temp.example.com/file123',
            size: 256,
            overlap: 8,
            separators: ['.'],
            model: 'custom-model',
          }),
        })
      )
    })

    it('should throw error for empty blob', async () => {
      const blob = new Blob([], { type: 'text/plain' })

      await expect(chunkFile(blob)).rejects.toThrow(
        'blob size must be greater than 0'
      )
    })

    it('should throw error for missing blob type', async () => {
      const blob = new Blob(['content'])

      await expect(chunkFile(blob)).rejects.toThrow('blob type must be set')
    })

    it('should throw error for unsupported content type', async () => {
      const blob = new Blob(['content'], { type: 'video/mp4' })

      await expect(chunkFile(blob)).rejects.toThrow(
        'Unsupported content type video/mp4'
      )
    })

    it('should handle upload failure', async () => {
      const blob = new Blob(['content'], { type: 'text/plain' })

      mockUploadTempBlob.mockRejectedValue(new Error('Upload failed'))

      await expect(chunkFile(blob)).rejects.toThrow('Upload failed')
    })

    it('should handle API error response', async () => {
      const blob = new Blob(['content'], { type: 'text/plain' })

      mockFetch.mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'file not found',
            code: 'BAD_REQUEST',
          })
        ),
      })

      await expect(chunkFile(blob)).rejects.toThrow('file not found')
    })
    /* eslint-enable @typescript-eslint/no-require-imports */
  })

  describe('isSupportedContentType', () => {
    it('should return true for supported content types', () => {
      expect(isSupportedContentType('text/plain')).toBe(true)
      expect(isSupportedContentType('application/pdf')).toBe(true)
      expect(isSupportedContentType('text/markdown')).toBe(true)
    })

    it('should return false for unsupported content types', () => {
      expect(isSupportedContentType('image/png')).toBe(false)
      expect(isSupportedContentType('video/mp4')).toBe(false)
      expect(isSupportedContentType('audio/mp3')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(isSupportedContentType('')).toBe(false)
    })

    it('should call getSupportedContentTypes with experimental flag', () => {
      isSupportedContentType('text/plain')

      expect(mockGetSupportedContentTypes).toHaveBeenCalledWith({
        experimental: true,
      })
    })
  })
})
