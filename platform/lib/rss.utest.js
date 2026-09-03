import { getEnclosure } from '@/lib/rss'

jest.mock('@/lib/url', () => ({
  url: jest.fn((pathname, baseUrl) => `${baseUrl}${pathname}`),
}))

describe('getEnclosure', () => {
  const mockSiteUrl = 'https://example.com'

  beforeEach(() => {
    process.env.SITE_URL = mockSiteUrl
  })

  afterEach(() => {
    delete process.env.SITE_URL
  })

  describe('preview enclosure', () => {
    it('should create enclosure from preview object', () => {
      const item = {
        preview: {
          pathname: '/path/to/preview.mp4',
          type: 'video/mp4',
        },
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        enclosure: {
          _attrs: {
            url: `${mockSiteUrl}/path/to/preview.mp4`,
            type: 'video/mp4',
          },
        },
      })
    })

    it('should prioritize preview over file', () => {
      const item = {
        preview: {
          pathname: '/preview.mp4',
          type: 'video/mp4',
        },
        file: {
          pathname: '/file.pdf',
          type: 'application/pdf',
        },
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.url).toContain('preview.mp4')
    })

    it('should prioritize preview over image', () => {
      const item = {
        preview: {
          pathname: '/preview.mp4',
          type: 'video/mp4',
        },
        image: 'https://example.com/image.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.url).toContain('preview.mp4')
    })
  })

  describe('file enclosure', () => {
    it('should create enclosure from file object', () => {
      const item = {
        file: {
          pathname: '/path/to/document.pdf',
          type: 'application/pdf',
        },
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        enclosure: {
          _attrs: {
            url: `${mockSiteUrl}/path/to/document.pdf`,
            type: 'application/pdf',
          },
        },
      })
    })

    it('should prioritize file over image', () => {
      const item = {
        file: {
          pathname: '/document.pdf',
          type: 'application/pdf',
        },
        image: 'https://example.com/image.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.url).toContain('document.pdf')
    })
  })

  describe('image enclosure', () => {
    it('should create enclosure from image URL', () => {
      const item = {
        image: 'https://example.com/image.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        enclosure: {
          _attrs: {
            url: 'https://example.com/image.png',
            type: 'image/png',
          },
        },
      })
    })

    it('should create enclosure from card URL', () => {
      const item = {
        card: 'https://example.com/card.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        enclosure: {
          _attrs: {
            url: 'https://example.com/card.png',
            type: 'image/png',
          },
        },
      })
    })

    it('should create enclosure from thumbnail URL', () => {
      const item = {
        thumbnail: 'https://example.com/thumb.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        enclosure: {
          _attrs: {
            url: 'https://example.com/thumb.png',
            type: 'image/png',
          },
        },
      })
    })

    it('should prioritize image over card and thumbnail', () => {
      const item = {
        image: 'https://example.com/image.png',
        card: 'https://example.com/card.png',
        thumbnail: 'https://example.com/thumb.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.url).toBe(
        'https://example.com/image.png'
      )
    })

    it('should use card if image is not present', () => {
      const item = {
        card: 'https://example.com/card.png',
        thumbnail: 'https://example.com/thumb.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.url).toBe(
        'https://example.com/card.png'
      )
    })

    it('should use thumbnail if image and card are not present', () => {
      const item = {
        thumbnail: 'https://example.com/thumb.png',
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.url).toBe(
        'https://example.com/thumb.png'
      )
    })
  })

  describe('edge cases', () => {
    it('should return empty array for empty item', () => {
      const item = {}

      const result = getEnclosure(item)

      expect(result).toEqual([])
    })

    it('should return empty array for null values', () => {
      const item = {
        preview: null,
        file: null,
        image: null,
        card: null,
        thumbnail: null,
      }

      const result = getEnclosure(item)

      expect(result).toEqual([])
    })

    it('should return empty array for undefined values', () => {
      const item = {
        preview: undefined,
        file: undefined,
        image: undefined,
      }

      const result = getEnclosure(item)

      expect(result).toEqual([])
    })

    it('should handle falsy values correctly', () => {
      const item = {
        preview: false,
        file: 0,
        image: '',
      }

      const result = getEnclosure(item)

      expect(result).toEqual([])
    })

    it('should handle preview without type', () => {
      const item = {
        preview: {
          pathname: '/preview.mp4',
          type: undefined,
        },
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.type).toBeUndefined()
    })

    it('should handle file without type', () => {
      const item = {
        file: {
          pathname: '/file.pdf',
          type: null,
        },
      }

      const result = getEnclosure(item)

      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.type).toBeNull()
    })
  })

  describe('multiple media types', () => {
    it('should handle all media types present with correct priority', () => {
      const item = {
        preview: {
          pathname: '/preview.mp4',
          type: 'video/mp4',
        },
        file: {
          pathname: '/file.pdf',
          type: 'application/pdf',
        },
        image: 'https://example.com/image.png',
        card: 'https://example.com/card.png',
        thumbnail: 'https://example.com/thumb.png',
      }

      const result = getEnclosure(item)

      // Should only return preview (highest priority)
      expect(result).toHaveLength(1)
      expect(result[0].enclosure._attrs.url).toContain('preview.mp4')
    })
  })

  describe('return value structure', () => {
    it('should always return an array', () => {
      expect(Array.isArray(getEnclosure({}))).toBe(true)
      expect(
        Array.isArray(getEnclosure({ image: 'https://example.com/image.png' }))
      ).toBe(true)
    })

    it('should return array with correct structure', () => {
      const item = {
        image: 'https://example.com/image.png',
      }

      const result = getEnclosure(item)

      expect(result[0]).toHaveProperty('enclosure')
      expect(result[0].enclosure).toHaveProperty('_attrs')
      expect(result[0].enclosure._attrs).toHaveProperty('url')
      expect(result[0].enclosure._attrs).toHaveProperty('type')
    })
  })
})
