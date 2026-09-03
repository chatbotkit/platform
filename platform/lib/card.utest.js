/* eslint-disable @typescript-eslint/no-require-imports */
import { generateCard, generateContentCard } from './card'

jest.mock('@/public/fonts/inter/400.ttf', () => ({
  __esModule: true,
  default: { data: new Uint8Array([1, 2, 3]) },
}))

jest.mock('@/public/fonts/inter/700.ttf', () => ({
  __esModule: true,
  default: { data: new Uint8Array([4, 5, 6]) },
}))

jest.mock('@/public/fonts/inter/900.ttf', () => ({
  __esModule: true,
  default: { data: new Uint8Array([7, 8, 9]) },
}))

jest.mock('@/lib/b64', () => ({
  encode: jest.fn((str) => Buffer.from(str).toString('base64')),
}))

jest.mock('@/lib/emoji', () => ({
  getEmojiCodePoint: jest.fn((emoji) => {
    const codePoints = { '😀': 0x1f600, '👍': 0x1f44d, '🎉': 0x1f389 }

    return codePoints[emoji] || 0x1f600
  }),
}))

jest.mock('@/lib/fetch', () =>
  jest.fn((url) => {
    if (url.includes('twemoji')) {
      return Promise.resolve({
        text: () => Promise.resolve('<svg>mock emoji svg</svg>'),
      })
    }

    return Promise.reject(new Error('Not found'))
  })
)

jest.mock('@/lib/satori', () => ({
  generateImage: jest.fn(async (element, options) => {
    return Buffer.from('mock-image-data')
  }),
}))

const { encode: encodeB64 } = require('@/lib/b64')
const { getEmojiCodePoint } = require('@/lib/emoji')
const fetch = require('@/lib/fetch')
const { generateImage } = require('@/lib/satori')

describe('card', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateCard', () => {
    it('should generate card with provided element', async () => {
      const element = <div>Test Card</div>

      const result = await generateCard(element)

      expect(result).toEqual(Buffer.from('mock-image-data'))
      expect(generateImage).toHaveBeenCalledWith(
        element,
        expect.objectContaining({
          width: 1200,
          height: 630,
        })
      )
    })

    it('should configure three Inter font weights', async () => {
      const element = <div>Test</div>

      await generateCard(element)

      const options = generateImage.mock.calls[0][1]

      expect(options.fonts).toHaveLength(3)
      expect(options.fonts[0].name).toBe('Inter')
      expect(options.fonts[0].weight).toBe(400)
      expect(options.fonts[1].weight).toBe(700)
      expect(options.fonts[2].weight).toBe(900)
    })

    it('should load emoji assets via loadAdditionalAsset', async () => {
      const element = <div>Test</div>

      await generateCard(element)

      const options = generateImage.mock.calls[0][1]

      expect(options.loadAdditionalAsset).toBeDefined()
    })

    it('should handle emoji asset loading', async () => {
      const element = <div>Test</div>

      await generateCard(element)

      const options = generateImage.mock.calls[0][1]
      const result = await options.loadAdditionalAsset('emoji', '😀')

      expect(getEmojiCodePoint).toHaveBeenCalledWith('😀')
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('1f600.svg'))
      expect(encodeB64).toHaveBeenCalledWith('<svg>mock emoji svg</svg>')
      expect(result).toContain('data:image/svg+xml;base64,')
    })

    it('should handle different emoji codepoints', async () => {
      const element = <div>Test</div>

      await generateCard(element)

      const options = generateImage.mock.calls[0][1]

      await options.loadAdditionalAsset('emoji', '👍')
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('1f44d.svg'))

      await options.loadAdditionalAsset('emoji', '🎉')
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('1f389.svg'))
    })

    it('should return empty array for non-emoji asset codes', async () => {
      const element = <div>Test</div>

      await generateCard(element)

      const options = generateImage.mock.calls[0][1]
      const result = await options.loadAdditionalAsset('image', 'test.png')

      expect(result).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should handle complex JSX elements', async () => {
      const element = (
        <div style={{ background: 'blue' }}>
          <h1>Title</h1>
          <p>Content</p>
        </div>
      )

      const result = await generateCard(element)

      expect(result).toEqual(Buffer.from('mock-image-data'))
      expect(generateImage).toHaveBeenCalledWith(element, expect.any(Object))
    })
  })

  describe('generateContentCard', () => {
    it('should generate content card with category and title', async () => {
      const result = await generateContentCard({
        category: 'Tutorial',
        title: 'Getting Started',
      })

      expect(result).toEqual(Buffer.from('mock-image-data'))
      expect(generateImage).toHaveBeenCalled()
    })

    it('should include category in generated card', async () => {
      await generateContentCard({
        category: 'Documentation',
        title: 'API Reference',
      })

      const element = generateImage.mock.calls[0][0]
      const elementString = JSON.stringify(element)

      expect(elementString).toContain('Documentation')
    })

    it('should include title in generated card', async () => {
      await generateContentCard({
        category: 'Guide',
        title: 'Advanced Topics',
      })

      const element = generateImage.mock.calls[0][0]
      const elementString = JSON.stringify(element)

      expect(elementString).toContain('Advanced Topics')
    })

    it('should use 1200x630 dimensions', async () => {
      await generateContentCard({
        category: 'Blog',
        title: 'New Features',
      })

      const options = generateImage.mock.calls[0][1]

      expect(options.width).toBe(1200)
      expect(options.height).toBe(630)
    })

    it('should handle empty category', async () => {
      const result = await generateContentCard({
        category: '',
        title: 'Test Title',
      })

      expect(result).toEqual(Buffer.from('mock-image-data'))
      expect(generateImage).toHaveBeenCalled()
    })

    it('should handle empty title', async () => {
      const result = await generateContentCard({
        category: 'Test Category',
        title: '',
      })

      expect(result).toEqual(Buffer.from('mock-image-data'))
      expect(generateImage).toHaveBeenCalled()
    })

    it('should handle long titles', async () => {
      const longTitle = 'This is a very long title that exceeds normal length'

      const result = await generateContentCard({
        category: 'Article',
        title: longTitle,
      })

      expect(result).toEqual(Buffer.from('mock-image-data'))

      const element = generateImage.mock.calls[0][0]
      const elementString = JSON.stringify(element)

      expect(elementString).toContain(longTitle)
    })

    it('should handle special characters in category and title', async () => {
      const result = await generateContentCard({
        category: 'Q&A / FAQ',
        title: "What's New in 2024?",
      })

      expect(result).toEqual(Buffer.from('mock-image-data'))

      const element = generateImage.mock.calls[0][0]
      const elementString = JSON.stringify(element)

      expect(elementString).toContain('Q&A / FAQ')
      expect(elementString).toContain("What's New in 2024?")
    })

    it('should generate card with proper structure', async () => {
      await generateContentCard({
        category: 'Test',
        title: 'Test Title',
      })

      const element = generateImage.mock.calls[0][0]

      expect(element.type).toBe('div')
      expect(element.props.style).toMatchObject({
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      })
    })
  })
})
