import { deflate, gzip, inflate, ungzip } from '@/lib/zlib'

describe('zlib', () => {
  describe('exports', () => {
    it('should export gzip function', () => {
      expect(typeof gzip).toBe('function')
    })

    it('should export ungzip function', () => {
      expect(typeof ungzip).toBe('function')
    })

    it('should export inflate function', () => {
      expect(typeof inflate).toBe('function')
    })

    it('should export deflate function', () => {
      expect(typeof deflate).toBe('function')
    })
  })

  describe('gzip and ungzip', () => {
    it('should compress and decompress data', () => {
      const original = 'Hello, World!'
      const compressed = gzip(original)
      const decompressed = ungzip(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should handle empty string', () => {
      const original = ''
      const compressed = gzip(original)
      const decompressed = ungzip(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should handle unicode characters', () => {
      const original = 'Hello 世界 🌍'
      const compressed = gzip(original)
      const decompressed = ungzip(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should reduce size for repetitive data', () => {
      const original = 'a'.repeat(1000)
      const compressed = gzip(original)

      expect(compressed.length).toBeLessThan(original.length)
    })

    it('should handle binary data', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255])
      const compressed = gzip(original)
      const decompressed = ungzip(compressed)

      expect(Array.from(decompressed)).toEqual(Array.from(original))
    })
  })

  describe('deflate and inflate', () => {
    it('should compress and decompress data', () => {
      const original = 'Test data for deflate/inflate'
      const compressed = deflate(original)
      const decompressed = inflate(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should handle empty string', () => {
      const original = ''
      const compressed = deflate(original)
      const decompressed = inflate(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should handle unicode characters', () => {
      const original = 'Deflate 测试 🎉'
      const compressed = deflate(original)
      const decompressed = inflate(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should reduce size for repetitive data', () => {
      const original = 'b'.repeat(1000)
      const compressed = deflate(original)

      expect(compressed.length).toBeLessThan(original.length)
    })

    it('should handle binary data', () => {
      const original = new Uint8Array([10, 20, 30, 40, 50])
      const compressed = deflate(original)
      const decompressed = inflate(compressed)

      expect(Array.from(decompressed)).toEqual(Array.from(original))
    })
  })

  describe('compression comparison', () => {
    it('should produce different results for gzip vs deflate', () => {
      const original = 'Compare compression methods'
      const gzipped = gzip(original)
      const deflated = deflate(original)

      expect(Array.from(gzipped)).not.toEqual(Array.from(deflated))
    })

    it('should decompress correctly regardless of method', () => {
      const original = 'Cross-method test'
      const gzipped = gzip(original)
      const deflated = deflate(original)

      const ungzipped = ungzip(gzipped)
      const inflated = inflate(deflated)

      expect(Buffer.from(ungzipped).toString()).toBe(original)
      expect(Buffer.from(inflated).toString()).toBe(original)
    })
  })

  describe('edge cases', () => {
    it('should handle very long strings', () => {
      const original = 'x'.repeat(10000)
      const compressed = gzip(original)
      const decompressed = ungzip(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should handle special characters', () => {
      const original = '\n\t\r\0'
      const compressed = gzip(original)
      const decompressed = ungzip(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
    })

    it('should handle JSON data', () => {
      const original = JSON.stringify({
        key: 'value',
        nested: { arr: [1, 2, 3] },
      })
      const compressed = gzip(original)
      const decompressed = ungzip(compressed)

      expect(Buffer.from(decompressed).toString()).toBe(original)
      expect(JSON.parse(Buffer.from(decompressed).toString())).toEqual(
        JSON.parse(original)
      )
    })
  })
})
