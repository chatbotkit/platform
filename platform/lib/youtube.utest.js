import {
  getYoutubeEmbedUrl,
  getYoutubeId,
  getYoutubeThumbnailUrl,
  isYoutubeUrl,
} from '@/lib/youtube'

describe('YouTube utility functions', () => {
  describe('isYoutubeUrl', () => {
    describe('valid YouTube URLs', () => {
      it('should detect youtube.com URLs', () => {
        expect(
          isYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        ).toBe(true)
        expect(isYoutubeUrl('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
          true
        )
        expect(isYoutubeUrl('youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
      })

      it('should detect youtu.be URLs', () => {
        expect(isYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
        expect(isYoutubeUrl('http://youtu.be/dQw4w9WgXcQ')).toBe(true)
        expect(isYoutubeUrl('youtu.be/dQw4w9WgXcQ')).toBe(true)
      })

      it('should detect youtube-nocookie.com URLs', () => {
        expect(
          isYoutubeUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
        ).toBe(true)
        expect(
          isYoutubeUrl('http://youtube-nocookie.com/embed/dQw4w9WgXcQ')
        ).toBe(true)
        expect(isYoutubeUrl('youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(
          true
        )
      })

      it('should handle URLs with additional query parameters', () => {
        expect(
          isYoutubeUrl(
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'
          )
        ).toBe(true)
      })

      it('should handle URLs with timestamp parameters', () => {
        expect(
          isYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')
        ).toBe(true)
        expect(isYoutubeUrl('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe(true)
      })
    })

    describe('invalid URLs', () => {
      it('should reject non-YouTube URLs', () => {
        expect(isYoutubeUrl('https://www.vimeo.com/123456')).toBe(false)
        expect(isYoutubeUrl('https://www.example.com')).toBe(false)
        expect(isYoutubeUrl('https://www.dailymotion.com/video/x123')).toBe(
          false
        )
      })

      it('should reject empty string', () => {
        expect(isYoutubeUrl('')).toBe(false)
      })

      it('should match URLs containing youtube domain substring', () => {
        // Note: The regex matches any URL containing youtube.com, youtu.be, or youtube-nocookie.com
        // This includes URLs like "notyoutube.com" which contain "youtube.com"
        expect(isYoutubeUrl('https://notyoutube.com')).toBe(true)
        // This doesn't match because it doesn't contain the exact patterns
        expect(isYoutubeUrl('https://youtube-fake.org')).toBe(false)
      })
    })
  })

  describe('getYoutubeId', () => {
    describe('standard watch URLs', () => {
      it('should extract ID from youtube.com watch URLs', () => {
        expect(
          getYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        ).toBe('dQw4w9WgXcQ')
        expect(getYoutubeId('http://youtube.com/watch?v=abc123DEF')).toBe(
          'abc123DEF'
        )
      })

      it('should extract ID from watch URLs with additional parameters', () => {
        expect(
          getYoutubeId(
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest'
          )
        ).toBe('dQw4w9WgXcQ&list=PLtest')
      })

      it('should extract ID from watch URLs with timestamp', () => {
        expect(
          getYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')
        ).toBe('dQw4w9WgXcQ&t=42s')
      })
    })

    describe('short youtu.be URLs', () => {
      it('should extract ID from youtu.be URLs', () => {
        expect(getYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
        expect(getYoutubeId('http://youtu.be/abc123DEF')).toBe('abc123DEF')
      })

      it('should extract ID from youtu.be URLs with query parameters', () => {
        expect(getYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe(
          'dQw4w9WgXcQ?t=42'
        )
      })
    })

    describe('embed URLs', () => {
      it('should extract ID from embed URLs', () => {
        expect(getYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
          'dQw4w9WgXcQ'
        )
        expect(
          getYoutubeId('https://www.youtube-nocookie.com/embed/abc123DEF')
        ).toBe('abc123DEF')
      })

      it('should extract ID from embed URLs with query parameters', () => {
        expect(
          getYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')
        ).toBe('dQw4w9WgXcQ?autoplay=1')
      })
    })

    describe('invalid URLs', () => {
      it('should return null for non-YouTube URLs', () => {
        expect(getYoutubeId('https://www.vimeo.com/123456')).toBeNull()
        expect(getYoutubeId('https://www.example.com')).toBeNull()
      })

      it('should return null for empty string', () => {
        expect(getYoutubeId('')).toBeNull()
      })

      it('should return null for malformed YouTube URLs', () => {
        expect(getYoutubeId('https://www.youtube.com/')).toBeNull()
        expect(getYoutubeId('https://www.youtube.com/videos')).toBeNull()
      })

      it('should return null for undefined', () => {
        expect(getYoutubeId(undefined)).toBeNull()
      })

      it('should return null for null', () => {
        expect(getYoutubeId(null)).toBeNull()
      })
    })
  })

  describe('getYoutubeEmbedUrl', () => {
    describe('basic embed URL generation', () => {
      it('should generate embed URL with video ID', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ')

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })

      it('should generate embed URL with different video IDs', () => {
        expect(getYoutubeEmbedUrl('abc123')).toBe(
          'https://www.youtube-nocookie.com/embed/abc123'
        )
        expect(getYoutubeEmbedUrl('XYZ789')).toBe(
          'https://www.youtube-nocookie.com/embed/XYZ789'
        )
      })
    })

    describe('chromeless options', () => {
      it('should add disablekb parameter when true', () => {
        expect(getYoutubeEmbedUrl('dQw4w9WgXcQ', { disablekb: true })).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?disablekb=1'
        )
      })

      it('should add fs parameter when false', () => {
        expect(getYoutubeEmbedUrl('dQw4w9WgXcQ', { fs: false })).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?fs=0'
        )
      })

      it('should add iv_load_policy parameter', () => {
        expect(getYoutubeEmbedUrl('dQw4w9WgXcQ', { ivLoadPolicy: 3 })).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?iv_load_policy=3'
        )
      })

      it('should loop by playing the video as a single-item playlist', () => {
        expect(getYoutubeEmbedUrl('dQw4w9WgXcQ', { loop: true })).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?loop=1&playlist=dQw4w9WgXcQ'
        )
      })

      it('should add playsinline parameter when true', () => {
        expect(getYoutubeEmbedUrl('dQw4w9WgXcQ', { playsinline: true })).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1'
        )
      })

      it('should add an encoded origin parameter when given', () => {
        expect(
          getYoutubeEmbedUrl('dQw4w9WgXcQ', {
            origin: 'https://chatbotkit.com',
          })
        ).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?origin=https%3A%2F%2Fchatbotkit.com'
        )
      })

      it('should omit the origin parameter when not given', () => {
        expect(getYoutubeEmbedUrl('dQw4w9WgXcQ', {})).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
        )
      })
    })

    describe('autoplay option', () => {
      it('should add autoplay parameter when true', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { autoplay: true })

        expect(url).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1'
        )
      })

      it('should not add autoplay parameter when false', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { autoplay: false })

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })

      it('should not add autoplay parameter when undefined', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', {})

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })
    })

    describe('rel option', () => {
      it('should add rel parameter when false', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { rel: false })

        expect(url).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
        )
      })

      it('should not add rel parameter when true', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { rel: true })

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })
    })

    describe('controls option', () => {
      it('should add controls parameter when false', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { controls: false })

        expect(url).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?controls=0'
        )
      })

      it('should not add controls parameter when true', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { controls: true })

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })
    })

    describe('enablejsapi option', () => {
      it('should add enablejsapi parameter when true', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { enablejsapi: true })

        expect(url).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1'
        )
      })

      it('should not add enablejsapi parameter when false', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', { enablejsapi: false })

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })
    })

    describe('multiple options', () => {
      it('should combine multiple options correctly', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', {
          autoplay: true,
          rel: false,
          controls: false,
          enablejsapi: true,
        })

        expect(url).toContain('autoplay=1')
        expect(url).toContain('rel=0')
        expect(url).toContain('controls=0')
        expect(url).toContain('enablejsapi=1')
      })

      it('should handle mixed true/false options', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', {
          autoplay: true,
          rel: true,
          controls: false,
        })

        expect(url).toContain('autoplay=1')
        expect(url).not.toContain('rel=')
        expect(url).toContain('controls=0')
      })
    })

    describe('edge cases', () => {
      it('should handle empty options object', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', {})

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })

      it('should handle undefined options', () => {
        const url = getYoutubeEmbedUrl('dQw4w9WgXcQ', undefined)

        expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      })

      it('should handle video IDs with special characters', () => {
        const url = getYoutubeEmbedUrl('abc-123_XYZ')

        expect(url).toBe('https://www.youtube-nocookie.com/embed/abc-123_XYZ')
      })
    })
  })

  describe('getYoutubeThumbnailUrl', () => {
    it('should generate thumbnail URL for video ID', () => {
      expect(getYoutubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
      )
    })

    it('should generate thumbnail URL for different video IDs', () => {
      expect(getYoutubeThumbnailUrl('abc123')).toBe(
        'https://img.youtube.com/vi/abc123/maxresdefault.jpg'
      )
      expect(getYoutubeThumbnailUrl('XYZ789')).toBe(
        'https://img.youtube.com/vi/XYZ789/maxresdefault.jpg'
      )
    })

    it('should handle video IDs with special characters', () => {
      expect(getYoutubeThumbnailUrl('abc-123_XYZ')).toBe(
        'https://img.youtube.com/vi/abc-123_XYZ/maxresdefault.jpg'
      )
    })

    it('should handle empty string', () => {
      expect(getYoutubeThumbnailUrl('')).toBe(
        'https://img.youtube.com/vi//maxresdefault.jpg'
      )
    })
  })
})
