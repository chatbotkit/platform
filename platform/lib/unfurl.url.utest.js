import { extractUrls } from '@/lib/unfurl.url'

describe('extractUrls', () => {
  describe('markdown format URLs', () => {
    it('should extract URL from markdown link', () => {
      const text = 'Check out [this article](https://example.com/article)'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/article'])
    })

    it('should extract URL from markdown link with query parameters', () => {
      const text =
        'See [documentation](https://example.com/docs?section=api&version=2)'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/docs?section=api&version=2'])
    })

    it('should extract URL from markdown link with fragment', () => {
      const text = 'Read [section 5](https://example.com/page#section-5)'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/page#section-5'])
    })

    it('should handle markdown link with special characters in URL', () => {
      const text =
        'Check [this](https://example.com/path/to/page?query=value&other=123#anchor)'

      const result = extractUrls(text)

      expect(result).toEqual([
        'https://example.com/path/to/page?query=value&other=123#anchor',
      ])
    })
  })

  describe('plain text URLs', () => {
    it('should extract plain text URL', () => {
      const text = 'Visit https://example.com for more info'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com'])
    })

    it('should extract plain text URL with path', () => {
      const text = 'Check out https://example.com/blog/post-title'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/blog/post-title'])
    })

    it('should extract plain text URL with query parameters', () => {
      const text = 'See https://example.com/search?q=test&page=1'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/search?q=test&page=1'])
    })

    it('should extract plain text URL with fragment', () => {
      const text = 'Jump to https://example.com/page#section'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/page#section'])
    })

    it('should extract URL with dashes (GFM does not support underscores in domains)', () => {
      const text = 'Visit https://my-example-site.com/my_path/to-page'

      const result = extractUrls(text)

      expect(result).toEqual(['https://my-example-site.com/my_path/to-page'])
    })

    it('should extract URL with brackets in path', () => {
      const text = 'See https://example.com/path[123]/item{456}'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/path[123]/item{456}'])
    })
  })

  describe('HTTP vs HTTPS', () => {
    it('should extract http URL', () => {
      const text = 'Visit http://example.com'

      const result = extractUrls(text)

      expect(result).toEqual(['http://example.com'])
    })

    it('should extract https URL', () => {
      const text = 'Visit https://example.com'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com'])
    })
  })

  describe('markdown images exclusion', () => {
    it('should NOT extract URL from markdown image', () => {
      const text = 'See this image ![alt text](https://example.com/image.jpg)'

      const result = extractUrls(text)

      // @note should return empty array, not the image URL

      expect(result).toEqual([])
    })

    it('should extract plain text URL after markdown image', () => {
      const text =
        'Image: ![alt](https://example.com/img.jpg) and link: https://example.com/page'

      const result = extractUrls(text)

      // @note should match the plain text URL, not the image

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should extract markdown link but not markdown image', () => {
      const text =
        'Image ![logo](https://example.com/logo.png) and [link](https://example.com/page)'

      const result = extractUrls(text)

      // @note should match the link, not the image

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should handle multiple markdown images and extract first link', () => {
      const text =
        '![img1](https://example.com/img1.jpg) text ![img2](https://example.com/img2.jpg) [link](https://example.com/page)'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/page'])
    })
  })

  describe('fenced code blocks exclusion', () => {
    it('should NOT extract URL from inside fenced code block', () => {
      const text =
        'Some text\n```\nhttps://example.com/code-url\n```\nMore text'

      const result = extractUrls(text)

      // @note should return empty array, not the URL from code block

      expect(result).toEqual([])
    })

    it('should extract plain text URL outside fenced code block', () => {
      const text =
        'Visit https://example.com/page\n```\nhttps://example.com/code-url\n```'

      const result = extractUrls(text)

      // @note should match the URL outside the code block

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should handle fenced code block with language specifier', () => {
      const text =
        'Check this:\n```javascript\nconst url = "https://example.com/api"\n```\nVisit https://example.com/page'

      const result = extractUrls(text)

      // @note should match the URL outside the code block

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should handle multiple fenced code blocks', () => {
      const text =
        '```\nhttps://example.com/code1\n```\nSee [link](https://example.com/page)\n```\nhttps://example.com/code2\n```'

      const result = extractUrls(text)

      // @note should only match the markdown link

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should handle markdown link in code block', () => {
      const text =
        '```\n[link](https://example.com/code-link)\n```\nReal [link](https://example.com/page)'

      const result = extractUrls(text)

      // @note should only match the link outside the code block

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should handle inline code separately from fenced blocks', () => {
      const text =
        'Code `https://example.com/inline` and real https://example.com/page'

      const result = extractUrls(text)

      // @note remark properly handles inline code - URLs inside inline code are excluded
      // URLs outside code are extracted

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should handle empty fenced code blocks', () => {
      const text = '```\n```\nVisit https://example.com/page'

      const result = extractUrls(text)

      expect(result).toEqual(['https://example.com/page'])
    })

    it('should handle fenced code block at start of text', () => {
      const text = '```\nhttps://example.com/code\n```'

      const result = extractUrls(text)

      expect(result).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('should return empty array for empty string', () => {
      const result = extractUrls('')

      expect(result).toEqual([])
    })

    it('should return empty array for null', () => {
      const result = extractUrls(null)

      expect(result).toEqual([])
    })

    it('should return empty array for undefined', () => {
      const result = extractUrls(undefined)

      expect(result).toEqual([])
    })

    it('should return empty array for text without URLs', () => {
      const text = 'This is just plain text without any links'

      const result = extractUrls(text)

      expect(result).toEqual([])
    })

    it('should extract all URLs including both markdown and plain text', () => {
      const text =
        'Check [link](https://example.com/markdown) and https://example.com/plain'

      const result = extractUrls(text)

      // @note with remark parser, all URLs are extracted

      expect(result).toEqual([
        'https://example.com/markdown',
        'https://example.com/plain',
      ])
    })
  })
})
