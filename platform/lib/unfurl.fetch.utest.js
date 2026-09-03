import { unfurl } from '@/lib/unfurl.fetch'

// @note we don't mock metascraper since it's the core functionality being tested
// and we want to verify that our configuration works correctly

jest.retryTimes(3)

describe('unfurl.fetch', () => {
  describe('unfurl', () => {
    describe('basic metadata extraction', () => {
      it('should extract title from HTML', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Test Page Title</title>
            </head>
            <body>
              <h1>Content</h1>
            </body>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.title).toBe('Test Page Title')
      })

      it('should extract description from meta tags', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="description" content="This is a test description" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.description).toBe('This is a test description')
      })

      it('should extract image from meta tags', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:image" content="https://example.com/image.jpg" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.image).toBe('https://example.com/image.jpg')
      })

      it('should extract author information', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="author" content="John Doe" />
              <title>Article Title</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com/article',
          html,
        })

        expect(result.author).toBe('John Doe')
      })

      it('should extract publisher information', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:site_name" content="Example Publisher" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.publisher).toBe('Example Publisher')
      })

      it('should extract date information', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="article:published_time" content="2024-01-15T10:00:00Z" />
              <title>Article</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com/article',
          html,
        })

        expect(result.date).toBeDefined()
      })
    })

    describe('Open Graph metadata', () => {
      it('should extract Open Graph title', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:title" content="OG Title" />
              <title>Regular Title</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        // OG title should take precedence
        expect(result.title).toBe('OG Title')
      })

      it('should extract Open Graph description', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:description" content="OG Description" />
              <meta name="description" content="Regular Description" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.description).toBe('OG Description')
      })

      it('should extract Open Graph URL', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:url" content="https://example.com/canonical" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com/page',
          html,
        })

        expect(result.url).toBe('https://example.com/canonical')
      })
    })

    describe('Twitter Card metadata', () => {
      it('should extract Twitter card data', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content="Twitter Title" />
              <meta name="twitter:description" content="Twitter Description" />
              <meta name="twitter:image" content="https://example.com/twitter-image.jpg" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.title).toBe('Twitter Title')
        expect(result.description).toBe('Twitter Description')
        expect(result.image).toBe('https://example.com/twitter-image.jpg')
      })
    })

    describe('favicon and logo extraction', () => {
      it('should extract favicon', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="icon" href="/favicon.ico" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.logo).toBeDefined()
      })

      it('should extract logo from meta tags', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:logo" content="https://example.com/logo.png" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.logo).toBe('https://example.com/logo.png')
      })
    })

    describe('language detection', () => {
      it('should detect language from HTML lang attribute', async () => {
        const html = `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.lang).toBe('en')
      })

      it('should detect language from og:locale meta tag', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:locale" content="es_ES" />
              <title>Test</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        // metascraper-lang extracts from og:locale and returns the language code
        expect(result.lang).toBe('es')
      })
    })

    describe('platform-specific metadata', () => {
      it('should extract YouTube metadata', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:site_name" content="YouTube" />
              <meta property="og:url" content="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
              <title>YouTube Video Title</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          html,
        })

        expect(result.title).toBe('YouTube Video Title')
        expect(result.publisher).toBe('YouTube')
      })

      it('should extract Instagram metadata', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:site_name" content="Instagram" />
              <title>Instagram Post</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://www.instagram.com/p/test',
          html,
        })

        expect(result.publisher).toBe('Instagram')
      })

      it('should extract Amazon product metadata', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="title" content="Product Name" />
              <title>Amazon.com: Product Name</title>
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://www.amazon.com/product/test',
          html,
        })

        expect(result.title).toContain('Product Name')
      })
    })

    describe('edge cases', () => {
      it('should handle minimal HTML', async () => {
        const html = '<html><head><title>Minimal</title></head></html>'

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.title).toBe('Minimal')
      })

      it('should handle HTML without metadata', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <body>
              <p>Content only, no metadata</p>
            </body>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        // Should return an object even with minimal metadata
        expect(result).toBeDefined()
        expect(typeof result).toBe('object')
      })

      it('should handle empty HTML', async () => {
        const html = ''

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result).toBeDefined()
      })

      it('should handle malformed HTML', async () => {
        const html = '<html><head><title>Unclosed tags<body>Content'

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        // metascraper should handle malformed HTML gracefully
        expect(result).toBeDefined()
      })

      it('should handle very long HTML content', async () => {
        const longContent = 'A'.repeat(100000)
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Long Content</title>
            </head>
            <body>
              <p>${longContent}</p>
            </body>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.title).toBe('Long Content')
      })

      it('should handle special characters in metadata', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Test & Example - "Quotes" 'Apostrophes'</title>
              <meta name="description" content="Description with <tags> & entities" />
            </head>
          </html>
        `

        const result = await unfurl({
          url: 'https://example.com',
          html,
        })

        expect(result.title).toContain('&')
        expect(result.title).toContain('-')
      })

      it('should handle URL parameter in unfurl', async () => {
        const html = '<html><head><title>Test</title></head></html>'

        const result = await unfurl({
          url: 'https://example.com/page?param=value',
          html,
        })

        expect(result.url).toBeDefined()
      })

      it('should handle URLs with unusual but valid formats', async () => {
        const html = '<html><head><title>Test</title></head></html>'

        // metascraper requires valid URLs, but handles various valid URL formats
        const result = await unfurl({
          url: 'https://localhost:3000/path',
          html,
        })

        expect(result).toBeDefined()
        expect(result.title).toBe('Test')
      })
    })
  })
})
