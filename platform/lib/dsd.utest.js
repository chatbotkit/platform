import { chunkFile, chunkText, chunkUrl } from '@/lib/dsd'
import * as dsd2 from '@/lib/dsd2'

// @note dsd.js is now a thin wrapper around dsd2.js - the archived Python
// service at deafening-scary-death.fly.dev has been removed entirely

jest.mock('@/lib/dsd2', () => ({
  chunkText: jest.fn().mockImplementation((text, options = {}) => {
    const hasSeparators =
      options.separators &&
      text.text &&
      text.text.includes(options.separators[0])

    const numChunks = hasSeparators ? 3 : 1

    const items = Array.from({ length: numChunks }, (_, i) => ({
      text: `Mocked chunk text ${i + 1}`,
      meta: { chunk: i + 1 },
    }))

    return Promise.resolve({
      items,
      request: {
        size: options.size || 512,
        overlap: options.overlap || 16,
      },
    })
  }),

  chunkUrl: jest.fn().mockImplementation((url, options = {}) => {
    return Promise.resolve({
      items: [
        {
          text: 'Mocked URL content',
          meta: { chunk: 1, url: url.href },
        },
      ],
      request: {
        size: options.size || 512,
        overlap: options.overlap || 16,
      },
    })
  }),

  chunkFile: jest.fn().mockImplementation((blob, options = {}) => {
    return Promise.resolve({
      items: [
        {
          text: 'Mocked file content',
          meta: { chunk: 1, type: blob.type },
        },
      ],
      request: {
        size: options.size || 512,
        overlap: options.overlap || 16,
      },
    })
  }),
}))

describe('chunkText', () => {
  it('should chunk text successfully with valid parameters', async () => {
    const options = { text: 'example text', type: 'text/plain' }

    const result = await chunkText(options)

    expect(result).toHaveProperty('items')
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('should chunk text by using separators', async () => {
    const options = {
      text: ['test001', '---', 'test002', '---', 'test003'].join('\n'),
      type: 'text/plain',
      separators: ['---'],
      size: 50,
      overlap: 1,
      defaults: false,
    }

    const result = await chunkText(options)

    expect(result).toHaveProperty('items')
    expect(result.items.length).toBeGreaterThan(1)
  })
})

describe('chunkUrl', () => {
  it('should fetch and chunk text from a URL successfully', async () => {
    const options = {
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    }

    const result = await chunkUrl(options)

    expect(result).toHaveProperty('items')
    expect(result.items.length).toBeGreaterThan(0)
  })
})

describe('chunkFile', () => {
  it('should upload a text/plain file and chunk its content', async () => {
    const blob = new Blob(['example text'], { type: 'text/plain' })

    const options = {}

    const result = await chunkFile(blob, options)

    expect(result).toHaveProperty('items')
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('should upload a text/markdown and chunk its content', async () => {
    const blob = new Blob(['example text'], { type: 'text/markdown' })

    const options = {}

    const result = await chunkFile(blob, options)

    expect(result).toHaveProperty('items')
    expect(result.items.length).toBeGreaterThan(0)
  })
})

describe('dsd2 delegation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('chunkText', () => {
    it('should delegate to dsd2.js', async () => {
      const mockResult = {
        items: [{ text: 'example text', meta: {} }],
        request: { size: 512, overlap: 16 },
      }

      dsd2.chunkText.mockResolvedValue(mockResult)

      const options = { text: 'example text', type: 'text/plain' }
      const result = await chunkText(options)

      expect(result).toEqual(mockResult)
      expect(dsd2.chunkText).toHaveBeenCalledWith(
        { text: 'example text', type: 'text/plain' },
        {}
      )
    })

    it('should pass chunk options to dsd2.js correctly', async () => {
      const mockResult = {
        items: [{ text: 'example text', meta: {} }],
        request: { size: 256, overlap: 8 },
      }

      dsd2.chunkText.mockResolvedValue(mockResult)

      const options = {
        text: 'example text',
        type: 'text/plain',
        size: 256,
        overlap: 8,
        separators: ['---'],
      }

      await chunkText(options)

      expect(dsd2.chunkText).toHaveBeenCalledWith(
        { text: 'example text', type: 'text/plain' },
        { size: 256, overlap: 8, separators: ['---'] }
      )
    })
  })

  describe('chunkUrl', () => {
    it('should delegate to dsd2.js', async () => {
      const mockResult = {
        items: [{ text: 'PDF content', meta: {} }],
        request: { size: 512, overlap: 16 },
      }

      dsd2.chunkUrl.mockResolvedValue(mockResult)

      const options = { url: 'https://example.com/document.pdf' }
      const result = await chunkUrl(options)

      expect(result).toEqual(mockResult)
      expect(dsd2.chunkUrl).toHaveBeenCalledWith(
        new URL('https://example.com/document.pdf'),
        {}
      )
    })

    it('should transform URL string to URL object for dsd2.js', async () => {
      const mockResult = {
        items: [{ text: 'PDF content', meta: {} }],
        request: { size: 512, overlap: 16 },
      }

      dsd2.chunkUrl.mockResolvedValue(mockResult)

      const options = {
        url: 'https://example.com/document.pdf',
        size: 1024,
        overlap: 32,
      }

      await chunkUrl(options)

      expect(dsd2.chunkUrl).toHaveBeenCalledWith(
        new URL('https://example.com/document.pdf'),
        { size: 1024, overlap: 32 }
      )
    })
  })

  describe('chunkFile', () => {
    it('should delegate to dsd2.js', async () => {
      const mockResult = {
        items: [{ text: 'file content', meta: {} }],
        request: { size: 512, overlap: 16 },
      }

      dsd2.chunkFile.mockResolvedValue(mockResult)

      const blob = new Blob(['example content'], { type: 'text/plain' })
      const options = { size: 256 }
      const result = await chunkFile(blob, options)

      expect(result).toEqual(mockResult)
      expect(dsd2.chunkFile).toHaveBeenCalledWith(blob, options)
    })

    it('should pass same parameters to dsd2.js without transformation', async () => {
      const mockResult = {
        items: [{ text: 'file content', meta: {} }],
        request: { size: 256 },
      }

      dsd2.chunkFile.mockResolvedValue(mockResult)

      const blob = new Blob(['example content'], { type: 'text/markdown' })
      const options = { size: 256, overlap: 8 }

      await chunkFile(blob, options)

      expect(dsd2.chunkFile).toHaveBeenCalledWith(blob, options)
    })
  })

  describe('error propagation', () => {
    it('should propagate dsd2.js errors', async () => {
      const dsd2Error = new Error('dsd2.js processing failed')

      dsd2.chunkText.mockRejectedValue(dsd2Error)

      const options = { text: 'example text', type: 'text/plain' }

      await expect(chunkText(options)).rejects.toThrow(
        'dsd2.js processing failed'
      )
    })
  })
})
