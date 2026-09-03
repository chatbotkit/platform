import { blobToDataUrl } from '@/lib/dataurl.blob'
import { fetchDataUrl } from '@/lib/dataurl.fetch'
import fetch from '@/lib/fetch'

jest.mock('@/lib/fetch')
jest.mock('@/lib/dataurl.blob')

describe('fetchDataUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful requests', () => {
    it('should fetch URL and convert to data URL', async () => {
      const mockBlob = new Blob(['test data'], { type: 'text/plain' })
      const mockDataUrl = 'data:text/plain;base64,dGVzdCBkYXRh'

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      const result = await fetchDataUrl('https://example.com/test.txt')

      expect(fetch).toHaveBeenCalledWith('https://example.com/test.txt', undefined)
      expect(blobToDataUrl).toHaveBeenCalledWith(mockBlob)
      expect(result).toBe(mockDataUrl)
    })

    it('should handle image URLs', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/png' })
      const mockDataUrl = 'data:image/png;base64,ZmFrZSBpbWFnZSBkYXRh'

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      const result = await fetchDataUrl('https://example.com/image.png')

      expect(result).toBe(mockDataUrl)
    })

    it('should handle JSON URLs', async () => {
      const mockBlob = new Blob(['{"key":"value"}'], {
        type: 'application/json',
      })
      const mockDataUrl = 'data:application/json;base64,eyJrZXkiOiJ2YWx1ZSJ9'

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      const result = await fetchDataUrl('https://example.com/data.json')

      expect(result).toBe(mockDataUrl)
    })
  })

  describe('error handling', () => {
    it('should return null when response is not ok', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        blob: jest.fn(),
      })

      const result = await fetchDataUrl('https://example.com/missing.txt')

      expect(result).toBeNull()
      expect(blobToDataUrl).not.toHaveBeenCalled()
    })

    it('should return null for 404 errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        blob: jest.fn(),
      })

      const result = await fetchDataUrl('https://example.com/not-found')

      expect(result).toBeNull()
    })

    it('should return null for 500 errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        blob: jest.fn(),
      })

      const result = await fetchDataUrl('https://example.com/error')

      expect(result).toBeNull()
    })

    it('should propagate fetch errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'))

      await expect(
        fetchDataUrl('https://example.com/test.txt')
      ).rejects.toThrow('Network error')
    })

    it('should propagate blob conversion errors', async () => {
      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockRejectedValue(new Error('Blob error')),
      })

      await expect(
        fetchDataUrl('https://example.com/test.txt')
      ).rejects.toThrow('Blob error')
    })

    it('should propagate blobToDataUrl errors', async () => {
      const mockBlob = new Blob(['test'])

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockRejectedValue(new Error('Conversion error'))

      await expect(
        fetchDataUrl('https://example.com/test.txt')
      ).rejects.toThrow('Conversion error')
    })
  })

  describe('edge cases', () => {
    it('should handle empty blobs', async () => {
      const mockBlob = new Blob([], { type: 'text/plain' })
      const mockDataUrl = 'data:text/plain;base64,'

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      const result = await fetchDataUrl('https://example.com/empty.txt')

      expect(result).toBe(mockDataUrl)
    })

    it('should handle large blobs', async () => {
      const largeData = 'x'.repeat(1000000)
      const mockBlob = new Blob([largeData], { type: 'text/plain' })
      const mockDataUrl = 'data:text/plain;base64,eHh4eC4uLg=='

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      const result = await fetchDataUrl('https://example.com/large.txt')

      expect(result).toBe(mockDataUrl)
    })

    it('should handle URLs with query parameters', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/plain' })
      const mockDataUrl = 'data:text/plain;base64,dGVzdA=='

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      const result = await fetchDataUrl('https://example.com/file?param=value')

      expect(fetch).toHaveBeenCalledWith('https://example.com/file?param=value', undefined)
      expect(result).toBe(mockDataUrl)
    })

    it('should handle URLs with fragments', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/plain' })
      const mockDataUrl = 'data:text/plain;base64,dGVzdA=='

      fetch.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      const result = await fetchDataUrl('https://example.com/file#section')

      expect(fetch).toHaveBeenCalledWith('https://example.com/file#section', undefined)
      expect(result).toBe(mockDataUrl)
    })
  })

  describe('blob conversion flow', () => {
    it('should call blob() on response before converting', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/plain' })
      const mockDataUrl = 'data:text/plain;base64,dGVzdA=='
      const blobFn = jest.fn().mockResolvedValue(mockBlob)

      fetch.mockResolvedValue({
        ok: true,
        blob: blobFn,
      })

      blobToDataUrl.mockResolvedValue(mockDataUrl)

      await fetchDataUrl('https://example.com/test.txt')

      expect(blobFn).toHaveBeenCalledTimes(1)
      expect(blobToDataUrl).toHaveBeenCalledWith(mockBlob)
    })
  })
})
