import { encodeUint8Array } from '@/lib/b64'
import { blobToDataUrl } from '@/lib/dataurl.blob'

jest.mock('@/lib/b64', () => ({
  encodeUint8Array: jest.fn((buffer) => {
    // Mock implementation that returns base64-like string
    // In real implementation, this would do actual base64 encoding
    const uint8 = new Uint8Array(buffer)

    if (uint8.length === 0) {
      return ''
    }

    // Simple mock that returns a predictable string based on content
    return Buffer.from(uint8).toString('base64')
  }),
}))

describe('dataurl blob utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('blobToDataUrl', () => {
    describe('basic functionality', () => {
      it('should convert simple text blob to data URL', async () => {
        const blob = new Blob(['hello world'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
        expect(encodeUint8Array).toHaveBeenCalled()
      })

      it('should convert JSON blob to data URL', async () => {
        const jsonData = JSON.stringify({ key: 'value' })
        const blob = new Blob([jsonData], { type: 'application/json' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:application\/json;base64,/)
        expect(encodeUint8Array).toHaveBeenCalled()
      })

      it('should convert image blob to data URL', async () => {
        const blob = new Blob(['fake image data'], { type: 'image/png' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:image\/png;base64,/)
        expect(encodeUint8Array).toHaveBeenCalled()
      })

      it('should convert HTML blob to data URL', async () => {
        const html = '<html><body>Test</body></html>'
        const blob = new Blob([html], { type: 'text/html' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/html;base64,/)
      })

      it('should convert CSS blob to data URL', async () => {
        const css = 'body { color: red; }'
        const blob = new Blob([css], { type: 'text/css' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/css;base64,/)
      })
    })

    describe('content type handling', () => {
      it('should use blob type as content type', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toContain('data:text/plain;base64,')
      })

      it('should use default content type for blob without type', async () => {
        const blob = new Blob(['test'])
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:application\/octet-stream;base64,/)
      })

      it('should use default content type for empty string type', async () => {
        const blob = new Blob(['test'], { type: '' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:application\/octet-stream;base64,/)
      })

      it('should preserve specific MIME types', async () => {
        const mimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'video/mp4',
          'audio/mpeg',
        ]

        for (const mimeType of mimeTypes) {
          const blob = new Blob(['test'], { type: mimeType })
          const result = await blobToDataUrl(blob)

          expect(result).toContain(`data:${mimeType};base64,`)
        }
      })

      it('should handle complex MIME types with parameters', async () => {
        const blob = new Blob(['test'], { type: 'text/plain; charset=utf-8' })
        const result = await blobToDataUrl(blob)

        expect(result).toContain('data:text/plain; charset=utf-8;base64,')
      })
    })

    describe('edge cases', () => {
      it('should handle empty blob', async () => {
        const blob = new Blob([])
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:application\/octet-stream;base64,/)
        expect(encodeUint8Array).toHaveBeenCalled()
      })

      it('should handle empty blob with type', async () => {
        const blob = new Blob([], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
      })

      it('should handle blob with whitespace', async () => {
        const blob = new Blob(['   '], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
        expect(result.length).toBeGreaterThan('data:text/plain;base64,'.length)
      })

      it('should handle blob with newlines', async () => {
        const blob = new Blob(['line1\nline2\nline3'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
      })

      it('should handle blob with special characters', async () => {
        const blob = new Blob(['@#$%^&*()'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
      })

      it('should handle blob with unicode characters', async () => {
        const blob = new Blob(['こんにちは世界'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
      })

      it('should handle blob with emoji', async () => {
        const blob = new Blob(['🚀 🌟 ✨'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
      })
    })

    describe('data URL format', () => {
      it('should return string type', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(typeof result).toBe('string')
      })

      it('should start with "data:" protocol', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:/)
      })

      it('should include base64 encoding indicator', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toContain(';base64,')
      })

      it('should have three main parts separated correctly', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        const parts = result.split(';base64,')

        expect(parts).toHaveLength(2)
        expect(parts[0]).toMatch(/^data:/)
        expect(parts[1]).toBeTruthy()
      })

      it('should produce valid data URL format', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        // Valid data URL format: data:[<mediatype>][;base64],<data>
        expect(result).toMatch(/^data:[^;]+;base64,.+/)
      })
    })

    describe('arrayBuffer integration', () => {
      it('should call blob.arrayBuffer()', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const arrayBufferSpy = jest.spyOn(blob, 'arrayBuffer')

        await blobToDataUrl(blob)

        expect(arrayBufferSpy).toHaveBeenCalled()
      })

      it('should process blob data through arrayBuffer', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        // Verify that encodeUint8Array was called and result contains base64 data
        expect(encodeUint8Array).toHaveBeenCalledTimes(1)
        expect(result).toMatch(/^data:text\/plain;base64,.+/)
      })

      it('should handle large blobs', async () => {
        const largeContent = 'x'.repeat(10000)
        const blob = new Blob([largeContent], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
        expect(result.length).toBeGreaterThan(100)
      })
    })

    describe('base64 encoding integration', () => {
      it('should call encodeUint8Array during conversion', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(encodeUint8Array).toHaveBeenCalledTimes(1)
        // Verify the function is called and produces valid output
        expect(result.split(';base64,')[1]).toBeTruthy()
      })

      it('should include encoded result in data URL', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        const base64Part = result.split(';base64,')[1]

        expect(base64Part).toBeTruthy()
        expect(base64Part.length).toBeGreaterThan(0)
      })

      it('should handle binary data encoding', async () => {
        const binaryData = new Uint8Array([0, 1, 2, 3, 4, 5])
        const blob = new Blob([binaryData], {
          type: 'application/octet-stream',
        })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:application\/octet-stream;base64,/)
      })
    })

    describe('async behavior', () => {
      it('should return a promise', () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = blobToDataUrl(blob)

        expect(result).toBeInstanceOf(Promise)
      })

      it('should resolve with string', async () => {
        const blob = new Blob(['test'], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(typeof result).toBe('string')
      })

      it('should handle multiple concurrent calls', async () => {
        const blob1 = new Blob(['test1'], { type: 'text/plain' })
        const blob2 = new Blob(['test2'], { type: 'image/png' })
        const blob3 = new Blob(['test3'], { type: 'application/json' })

        const [result1, result2, result3] = await Promise.all([
          blobToDataUrl(blob1),
          blobToDataUrl(blob2),
          blobToDataUrl(blob3),
        ])

        expect(result1).toContain('text/plain')
        expect(result2).toContain('image/png')
        expect(result3).toContain('application/json')
      })

      it('should handle sequential calls', async () => {
        const blob1 = new Blob(['test1'], { type: 'text/plain' })
        const blob2 = new Blob(['test2'], { type: 'image/png' })

        const result1 = await blobToDataUrl(blob1)
        const result2 = await blobToDataUrl(blob2)

        expect(result1).toContain('text/plain')
        expect(result2).toContain('image/png')
      })
    })

    describe('real-world scenarios', () => {
      it('should convert text file blob', async () => {
        const textContent = 'This is a text file content.'
        const blob = new Blob([textContent], { type: 'text/plain' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/plain;base64,/)
      })

      it('should convert CSV blob', async () => {
        const csvContent = 'name,age,city\nJohn,30,NYC\nJane,25,LA'
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:text\/csv;base64,/)
      })

      it('should convert XML blob', async () => {
        const xmlContent = '<?xml version="1.0"?><root><item>test</item></root>'
        const blob = new Blob([xmlContent], { type: 'application/xml' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:application\/xml;base64,/)
      })

      it('should handle image upload simulation', async () => {
        const fakeImageData = new Uint8Array([137, 80, 78, 71]) // PNG header
        const blob = new Blob([fakeImageData], { type: 'image/png' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:image\/png;base64,/)
      })

      it('should handle document upload simulation', async () => {
        const fakeDocData = 'PDF document content'
        const blob = new Blob([fakeDocData], { type: 'application/pdf' })
        const result = await blobToDataUrl(blob)

        expect(result).toMatch(/^data:application\/pdf;base64,/)
      })
    })
  })
})
