import memcache from '@/lib/memcache'
import {
  CHUNK_TTL_SECONDS,
  DEFAULT_CHUNK_SIZE,
  LARGE_RESPONSE_TOKEN_THRESHOLD,
  PREVIEW_MAX_LENGTH,
  deleteChunk,
  getChunk,
  getChunkContent,
  splitIntoChunks,
  storeChunkedResponse,
} from '@/lib/skillset.chunk'

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
  },
}))

describe('skillset.chunk', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constants', () => {
    it('should export LARGE_RESPONSE_TOKEN_THRESHOLD as 10000', () => {
      expect(LARGE_RESPONSE_TOKEN_THRESHOLD).toBe(10_000)
    })

    it('should export CHUNK_TTL_SECONDS', () => {
      expect(CHUNK_TTL_SECONDS).toBeGreaterThan(0)
    })

    it('should export DEFAULT_CHUNK_SIZE', () => {
      expect(DEFAULT_CHUNK_SIZE).toBe(8_000)
    })

    it('should export PREVIEW_MAX_LENGTH', () => {
      expect(PREVIEW_MAX_LENGTH).toBe(500)
    })
  })

  describe('splitIntoChunks', () => {
    it('should return single chunk for content smaller than chunk size', () => {
      const content = 'Hello, world!'
      const chunks = splitIntoChunks(content, 100)

      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe(content)
    })

    it('should split content into multiple chunks', () => {
      const content = 'ABCDEFGHIJ'
      const chunks = splitIntoChunks(content, 3)

      expect(chunks).toHaveLength(4)
      expect(chunks[0]).toBe('ABC')
      expect(chunks[1]).toBe('DEF')
      expect(chunks[2]).toBe('GHI')
      expect(chunks[3]).toBe('J')
    })

    it('should handle exact chunk size boundaries', () => {
      const content = 'ABCDEF'
      const chunks = splitIntoChunks(content, 3)

      expect(chunks).toHaveLength(2)
      expect(chunks[0]).toBe('ABC')
      expect(chunks[1]).toBe('DEF')
    })

    it('should handle empty content', () => {
      const chunks = splitIntoChunks('', 100)

      expect(chunks).toHaveLength(0)
    })

    it('should use default chunk size when not specified', () => {
      // @note create content larger than default chunk size
      const content = 'A'.repeat(DEFAULT_CHUNK_SIZE + 100)
      const chunks = splitIntoChunks(content)

      expect(chunks).toHaveLength(2)
      expect(chunks[0].length).toBe(DEFAULT_CHUNK_SIZE)
      expect(chunks[1].length).toBe(100)
    })
  })

  describe('storeChunkedResponse', () => {
    it('should store chunks in Redis and return metadata', async () => {
      const content = 'A'.repeat(1000)
      const metadata = await storeChunkedResponse(content, { chunkSize: 400 })

      expect(metadata.isChunked).toBe(true)
      expect(metadata.totalChunks).toBe(3)
      expect(metadata.totalLength).toBe(1000)
      expect(metadata.preview).toBe('A'.repeat(500) + '...')
      expect(metadata.chunks).toHaveLength(3)

      // @note verify Redis was called for each chunk
      expect(memcache.set).toHaveBeenCalledTimes(3)
    })

    it('should generate correct preview for short content', async () => {
      const content = 'Short content'
      const metadata = await storeChunkedResponse(content, { chunkSize: 5 })

      expect(metadata.preview).toBe('Short content')
      expect(metadata.preview).not.toContain('...')
    })

    it('should truncate preview for long content', async () => {
      const content = 'A'.repeat(600)
      const metadata = await storeChunkedResponse(content, { chunkSize: 300 })

      expect(metadata.preview.length).toBe(PREVIEW_MAX_LENGTH + 3) // +3 for "..."
      expect(metadata.preview.endsWith('...')).toBe(true)
    })

    it('should use custom TTL when provided', async () => {
      const content = 'Test content'
      const customTTL = 3600

      await storeChunkedResponse(content, { chunkSize: 5, ttl: customTTL })

      expect(memcache.set).toHaveBeenCalled()

      const setCall = memcache.set.mock.calls[0]

      expect(setCall[2]).toEqual({ ex: customTTL })
    })

    it('should assign unique IDs to each chunk', async () => {
      const content = 'A'.repeat(100)
      const metadata = await storeChunkedResponse(content, { chunkSize: 30 })

      const chunkIds = metadata.chunks.map((c) => c.id)
      const uniqueIds = new Set(chunkIds)

      expect(uniqueIds.size).toBe(chunkIds.length)
    })

    it('should include correct index for each chunk', async () => {
      const content = 'A'.repeat(100)
      const metadata = await storeChunkedResponse(content, { chunkSize: 30 })

      metadata.chunks.forEach((chunk, index) => {
        expect(chunk.index).toBe(index)
      })
    })

    it('should include length for each chunk', async () => {
      const content = 'A'.repeat(100)
      const metadata = await storeChunkedResponse(content, { chunkSize: 30 })

      expect(metadata.chunks[0].length).toBe(30)
      expect(metadata.chunks[1].length).toBe(30)
      expect(metadata.chunks[2].length).toBe(30)
      expect(metadata.chunks[3].length).toBe(10) // last chunk
    })
  })

  describe('getChunk', () => {
    it('should return stored chunk when found', async () => {
      const mockChunk = {
        id: 'test-chunk-id',
        index: 0,
        total: 3,
        content: 'Test content',
        createdAt: new Date().toISOString(),
      }

      memcache.get.mockResolvedValue(mockChunk)

      const result = await getChunk('test-chunk-id')

      expect(result).toEqual(mockChunk)
      expect(memcache.get).toHaveBeenCalledWith('skillset:chunk:test-chunk-id')
    })

    it('should return null when chunk not found', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await getChunk('non-existent-id')

      expect(result).toBeNull()
    })
  })

  describe('getChunkContent', () => {
    it('should return content when chunk exists', async () => {
      const mockChunk = {
        id: 'test-id',
        index: 0,
        total: 1,
        content: 'Test content here',
        createdAt: new Date().toISOString(),
      }

      memcache.get.mockResolvedValue(mockChunk)

      const result = await getChunkContent('test-id')

      expect(result).toBe('Test content here')
    })

    it('should return null when chunk not found', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await getChunkContent('non-existent-id')

      expect(result).toBeNull()
    })
  })

  describe('deleteChunk', () => {
    it('should delete chunk from Redis', async () => {
      await deleteChunk('chunk-to-delete')

      expect(memcache.del).toHaveBeenCalledWith('skillset:chunk:chunk-to-delete')
    })
  })

  describe('edge cases and boundary conditions', () => {
    it('should handle very large content', async () => {
      // @note test handling of content that exceeds typical LLM response size
      const largeContent = 'x'.repeat(1_000_000)
      const metadata = await storeChunkedResponse(largeContent, {
        chunkSize: 10000,
      })

      expect(metadata.isChunked).toBe(true)
      expect(metadata.totalLength).toBe(1_000_000)
      expect(metadata.totalChunks).toBe(100)
    })

    it('should handle unicode content correctly', async () => {
      const unicodeContent = '你好世界'.repeat(250)
      const metadata = await storeChunkedResponse(unicodeContent, {
        chunkSize: 1000,
      })

      expect(metadata.isChunked).toBe(true)
      expect(metadata.totalLength).toBeGreaterThan(0)
    })

    it('should handle content with newlines and special chars', async () => {
      const content = 'line1\nline2\r\nline3\ttab\x00null'.repeat(100)
      const chunks = splitIntoChunks(content, 500)

      expect(chunks.join('')).toBe(content)
    })

    it('should handle single-byte chunk size (stress test)', () => {
      const content = 'hello'
      const chunks = splitIntoChunks(content, 1)

      expect(chunks.length).toBe(5)
      expect(chunks).toEqual(['h', 'e', 'l', 'l', 'o'])
    })

    it('should preserve exact content boundaries when recombining chunks', () => {
      const original = 'The quick brown fox jumps over the lazy dog'.repeat(100)
      const chunks = splitIntoChunks(original, 300)
      const recombined = chunks.join('')

      expect(recombined).toBe(original)
      expect(recombined.length).toBe(original.length)
    })

    it('should handle chunk size equal to content size', () => {
      const content = 'exact'
      const chunks = splitIntoChunks(content, 5)

      expect(chunks.length).toBe(1)
      expect(chunks[0]).toBe(content)
    })

    it('should handle chunk size larger than content', () => {
      const content = 'small'
      const chunks = splitIntoChunks(content, 10000)

      expect(chunks.length).toBe(1)
      expect(chunks[0]).toBe(content)
    })
  })

  describe('metadata completeness and correctness', () => {
    it('should sum chunk lengths equal to total response length', async () => {
      const content = 'test content '.repeat(500)
      const metadata = await storeChunkedResponse(content, {
        chunkSize: 1000,
      })

      const summedLength = metadata.chunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      )

      expect(summedLength).toBe(metadata.totalLength)
    })

    it('should have preview within expected bounds', async () => {
      const content = 'x'.repeat(10000)
      const metadata = await storeChunkedResponse(content, {
        chunkSize: 1000,
      })

      expect(metadata.preview.length).toBeLessThanOrEqual(
        PREVIEW_MAX_LENGTH + 3
      )

      if (content.length > PREVIEW_MAX_LENGTH) {
        expect(metadata.preview.endsWith('...')).toBe(true)
      }
    })

    it('should mark metadata as chunked when needed', async () => {
      const smallContent = 'tiny'
      const smallMetadata = await storeChunkedResponse(smallContent, {
        chunkSize: 100,
      })

      expect(smallMetadata.isChunked).toBe(true)

      const largeContent = 'x'.repeat(50000)
      const largeMetadata = await storeChunkedResponse(largeContent, {
        chunkSize: 1000,
      })

      expect(largeMetadata.isChunked).toBe(true)
    })
  })

  describe('Redis interaction correctness', () => {
    it('should call memcache.set with proper key format', async () => {
      const content = 'test'

      await storeChunkedResponse(content, { chunkSize: 100 })

      memcache.set.mock.calls.forEach(([key]) => {
        expect(key).toMatch(/^skillset:chunk:.+$/)
      })
    })

    it('should include chunk data structure in memcache.set calls', async () => {
      const content = 'test'

      await storeChunkedResponse(content, { chunkSize: 100 })

      memcache.set.mock.calls.forEach(([, chunkData]) => {
        expect(chunkData).toHaveProperty('id')
        expect(chunkData).toHaveProperty('index')
        expect(chunkData).toHaveProperty('total')
        expect(chunkData).toHaveProperty('content')
        expect(chunkData).toHaveProperty('createdAt')
      })
    })

    it('should use default TTL when not specified', async () => {
      const content = 'test'

      await storeChunkedResponse(content, { chunkSize: 100 })

      memcache.set.mock.calls.forEach(([, , options]) => {
        expect(options.ex).toBe(CHUNK_TTL_SECONDS)
      })
    })
  })

  describe('chunk retrieval edge cases', () => {
    it('should handle missing chunk content field gracefully', async () => {
      const malformedChunk = {
        id: 'test',
        index: 0,
        total: 1,
        createdAt: new Date().toISOString(),
        // content is missing
      }

      memcache.get.mockResolvedValue(malformedChunk)

      const result = await getChunkContent('test')

      expect(result).toBeNull()
    })

    it('should handle empty string as valid chunk content', async () => {
      const chunk = {
        id: 'test',
        index: 0,
        total: 1,
        content: '',
        createdAt: new Date().toISOString(),
      }

      memcache.get.mockResolvedValue(chunk)

      const result = await getChunkContent('test')

      expect(result).toBe('')
    })

    it('should distinguish between null, undefined, and missing fields', async () => {
      const chunkWithNull = {
        id: 'test',
        index: 0,
        total: 1,
        content: null,
        createdAt: new Date().toISOString(),
      }

      memcache.get.mockResolvedValue(chunkWithNull)

      const result = await getChunkContent('test')

      expect(result).toBeNull()
    })
  })
})
