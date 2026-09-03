import { isBinary, isText } from '@/lib/binary'

describe('binary utilities', () => {
  describe('isText', () => {
    it('should detect text from utf8 string buffer', () => {
      const textBuffer = new TextEncoder().encode('Hello, World!')

      expect(isText(textBuffer)).toBe(true)
    })

    it('should detect text from simple ascii string', () => {
      const textBuffer = new TextEncoder().encode('Simple ASCII text')

      expect(isText(textBuffer)).toBe(true)
    })

    it('should detect text from unicode string', () => {
      const textBuffer = new TextEncoder().encode('Hello 世界 🌍')

      expect(isText(textBuffer)).toBe(true)
    })

    it('should handle ArrayBuffer input', () => {
      const textBuffer = new TextEncoder().encode('Test string')
      const arrayBuffer = textBuffer.buffer

      expect(isText(arrayBuffer)).toBe(true)
    })

    it('should return false for binary data', () => {
      // Create binary data (random bytes that won't be valid UTF-8)
      const binaryBuffer = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0xfb])

      expect(isText(binaryBuffer)).toBe(false)
    })

    it('should handle empty buffer', () => {
      const emptyBuffer = new Uint8Array([])

      expect(isText(emptyBuffer)).toBe(true)
    })

    it('should handle null bytes mixed with text', () => {
      const bufferWithNulls = new Uint8Array([72, 101, 108, 108, 111, 0, 0])

      expect(isText(bufferWithNulls)).toBe(false)
    })
  })

  describe('isBinary', () => {
    it('should detect binary data', () => {
      const binaryBuffer = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0xfb])

      expect(isBinary(binaryBuffer)).toBe(true)
    })

    it('should return false for text data', () => {
      const textBuffer = new TextEncoder().encode('Hello, World!')

      expect(isBinary(textBuffer)).toBe(false)
    })

    it('should handle ArrayBuffer input', () => {
      const binaryData = new Uint8Array([0xff, 0xfe, 0xfd])
      const arrayBuffer = binaryData.buffer

      expect(isBinary(arrayBuffer)).toBe(true)
    })

    it('should detect jpeg signature as binary', () => {
      // JPEG file signature
      const jpegSignature = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

      expect(isBinary(jpegSignature)).toBe(true)
    })

    it('should detect png signature as binary', () => {
      // PNG file signature
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ])

      expect(isBinary(pngSignature)).toBe(true)
    })

    it('should handle empty buffer as text (not binary)', () => {
      const emptyBuffer = new Uint8Array([])

      expect(isBinary(emptyBuffer)).toBe(false)
    })
  })

  describe('isText and isBinary consistency', () => {
    it('should be complementary for text data', () => {
      const textBuffer = new TextEncoder().encode('Test')

      expect(isText(textBuffer)).toBe(!isBinary(textBuffer))
    })

    it('should be complementary for binary data', () => {
      const binaryBuffer = new Uint8Array([0xff, 0xfe])

      expect(isText(binaryBuffer)).toBe(!isBinary(binaryBuffer))
    })

    it('should be complementary for ArrayBuffer', () => {
      const data = new TextEncoder().encode('Hello')
      const arrayBuffer = data.buffer

      expect(isText(arrayBuffer)).toBe(!isBinary(arrayBuffer))
    })
  })
})
