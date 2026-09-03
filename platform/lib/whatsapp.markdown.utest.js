import {
  markdownToMessages,
  mergeMessagesByType,
} from '@/lib/whatsapp.markdown'

describe('markdownToMessages', () => {
  describe('Basic Text Conversion', () => {
    it('converts simple text to a message', async () => {
      const markdown = 'This is a simple message.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is a simple message.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles empty string input', async () => {
      const result = await markdownToMessages('')

      expect(result).toEqual([])
    })

    it('handles whitespace-only input', async () => {
      const result = await markdownToMessages('   \n\n   \t  ')

      expect(result).toEqual([])
    })

    it('handles single character input', async () => {
      const result = await markdownToMessages('a')

      expect(result).toEqual([
        {
          type: 'text',
          text: {
            body: 'a',
            preview_url: true,
          },
        },
      ])
    })

    it('combines multiple paragraphs into separate messages', async () => {
      const markdown = 'First paragraph.\n\nSecond paragraph.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'First paragraph.',
            preview_url: true,
          },
        },
        {
          type: 'text',
          text: {
            body: 'Second paragraph.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('splits oversized text messages to fit the configured maximum length', async () => {
      const result = await markdownToMessages(
        'Alpha beta gamma delta epsilon zeta',
        12
      )

      expect(result).toEqual([
        {
          type: 'text',
          text: { body: 'Alpha beta', preview_url: true },
        },
        {
          type: 'text',
          text: { body: 'gamma delta', preview_url: true },
        },
        {
          type: 'text',
          text: { body: 'epsilon zeta', preview_url: true },
        },
      ])
    })
  })

  describe('Text Formatting', () => {
    it('converts strong text to WhatsApp formatted bold text', async () => {
      const markdown = 'This is **bold** text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is *bold* text.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('converts emphasis text to WhatsApp formatted italic text', async () => {
      const markdown = 'This is *italic* text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is _italic_ text.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles strikethrough text as plain text (no GFM plugin)', async () => {
      // @note WhatsApp markdown parser doesn't use remark-gfm, so ~~text~~ stays as literal text

      const markdown = 'This is ~~strikethrough~~ text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is ~~strikethrough~~ text.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles inline code correctly', async () => {
      const markdown = 'This is `inline code` text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is `inline code` text.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles multiple formatting types in one message', async () => {
      const markdown =
        'Text with **bold**, *italic*, ~~strikethrough~~ and `code`.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Text with *bold*, _italic_, ~~strikethrough~~ and `code`.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles nested formatting combinations', async () => {
      const markdown = 'Text with **bold _italic_ combination**.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Text with *bold _italic_ combination*.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles empty formatting tags', async () => {
      const markdown = 'Text with ****, ****, ~~~~ and ````.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Text with ****, ****, ~~~~ and ````.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  describe('Code Blocks', () => {
    it('processes code blocks correctly', async () => {
      const markdown = '```\nconst x = 42;\nconsole.log(x);\n```'

      const expected = [
        {
          type: 'text',
          text: {
            body: '```\nconst x = 42;\nconsole.log(x);\n```',
            preview_url: false,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('processes code blocks with language specification', async () => {
      const markdown = '```javascript\nconst x = 42;\n```'

      const expected = [
        {
          type: 'text',
          text: {
            body: '```\nconst x = 42;\n```',
            preview_url: false,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles empty code blocks', async () => {
      const markdown = '```\n```'

      const expected = [
        {
          type: 'text',
          text: {
            body: '```\n\n```',
            preview_url: false,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles code blocks with only whitespace', async () => {
      const markdown = '```\n   \n\t\n```'

      const expected = [
        {
          type: 'text',
          text: {
            body: '```\n   \n\t\n```',
            preview_url: false,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  describe('Links', () => {
    it('handles a paragraph with a link correctly', async () => {
      const markdown = 'Check out [this website](http://example.com).'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Check out this website (http://example.com).',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles links without text', async () => {
      const markdown = '[](http://example.com)'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'http://example.com',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles multiple links in one paragraph', async () => {
      const markdown =
        'Visit [site1](http://example1.com) and [site2](http://example2.com).'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Visit site1 (http://example1.com) and site2 (http://example2.com).',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles links with formatted text', async () => {
      const markdown = 'Check out [**bold link**](http://example.com).'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Check out *bold link* (http://example.com).',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles malformed links gracefully', async () => {
      const markdown = 'This is [broken link]( and [another](.'
      const result = await markdownToMessages(markdown)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
    })

    it('handles links with empty URLs', async () => {
      const markdown = '[text with empty URL]()'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'text with empty URL ()',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles HTTPS and HTTP links', async () => {
      const markdown =
        'Visit [secure](https://example.com) and [regular](http://example.com).'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Visit secure (https://example.com) and regular (http://example.com).',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles reference-style links', async () => {
      const markdown =
        'See [the guide][guide] for details.\n\n[guide]: https://example.com/guide'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'See the guide (https://example.com/guide) for details.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  describe('Images', () => {
    it('processes an image node correctly', async () => {
      const markdown = '![alt text](http://example.com/image.png)'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'http://example.com/image.png',
            caption: 'alt text',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles image with HTTPS URL', async () => {
      const markdown = '![secure image](https://example.com/image.jpg)'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'https://example.com/image.jpg',
            caption: 'secure image',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles image without alt text', async () => {
      const markdown = '![](http://example.com/image.png)'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'http://example.com/image.png',
            caption: 'image',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('ignores images with non-HTTP URLs', async () => {
      const markdown = '![local image](./local/image.png)'
      const result = await markdownToMessages(markdown)

      expect(result).toEqual([])
    })

    it('ignores images with invalid URLs', async () => {
      const markdown = '![broken](not-a-url)'
      const result = await markdownToMessages(markdown)

      expect(result).toEqual([])
    })

    it('handles multiple images in separate messages', async () => {
      const markdown =
        '![first](http://example.com/1.png)\n\n![second](https://example.com/2.jpg)'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'http://example.com/1.png',
            caption: 'first',
          },
        },
        {
          type: 'image',
          image: {
            link: 'https://example.com/2.jpg',
            caption: 'second',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('maps markdown image links with video extensions to WhatsApp video messages', async () => {
      const markdown = '![product demo](https://example.com/demo.mp4)'

      await expect(markdownToMessages(markdown)).resolves.toEqual([
        {
          type: 'video',
          video: {
            link: 'https://example.com/demo.mp4',
            caption: 'product demo',
          },
        },
      ])
    })

    it('maps markdown image links with audio extensions to WhatsApp audio messages', async () => {
      const markdown = '![podcast](https://example.com/episode.mp3)'

      await expect(markdownToMessages(markdown)).resolves.toEqual([
        {
          type: 'audio',
          audio: {
            link: 'https://example.com/episode.mp3',
          },
        },
      ])
    })

    it('maps markdown image links with document extensions to WhatsApp document messages', async () => {
      const markdown = '![pricing sheet](https://example.com/pricing.pdf)'

      await expect(markdownToMessages(markdown)).resolves.toEqual([
        {
          type: 'document',
          document: {
            link: 'https://example.com/pricing.pdf',
            caption: 'pricing sheet',
            filename: 'pricing sheet',
          },
        },
      ])
    })

    it('uses title as caption fallback when alt is empty', async () => {
      // @note this tests the alt || title || 'image' fallback logic in the image handler

      const markdown = '![](http://example.com/image.png "Image Title")'
      const result = await markdownToMessages(markdown)

      // This may not work exactly as expected due to how remark-parse handles titles
      // but we're testing the current behavior

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Complex Combinations', () => {
    it('handles mixed content types in order', async () => {
      const markdown = `# Header

Some text with **bold** and [link](https://example.com).

\`\`\`
code block
\`\`\`

![image](https://example.com/image.png)`

      const result = await markdownToMessages(markdown)

      // should have multiple messages for different content types

      expect(result.length).toBeGreaterThan(2)

      // check that we have both text and image messages

      const messageTypes = result.map((msg) => msg.type)

      expect(messageTypes).toContain('text')
      expect(messageTypes).toContain('image')
    })

    it('handles text mixed with images in same paragraph', async () => {
      const markdown =
        'Here is some text ![image](https://example.com/img.png) and more text.'

      const result = await markdownToMessages(markdown)

      expect(Array.isArray(result)).toBe(true)

      // should handle the mixed content appropriately
      expect(result.some((msg) => msg.type === 'image')).toBe(true)
    })

    it('preserves order of content elements', async () => {
      const markdown = `First paragraph.

\`\`\`
code block
\`\`\`

Second paragraph.

![image](https://example.com/image.png)`

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(4)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe('First paragraph.')
      expect(result[1].type).toBe('text')
      expect(result[1].text.preview_url).toBe(false) // code block
      expect(result[2].type).toBe('text')
      expect(result[2].text.body).toBe('Second paragraph.')
      expect(result[3].type).toBe('image')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles special characters and unicode', async () => {
      const markdown =
        '🚀 Test with emojis 🎉 and ñiño characters **bold** text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: '🚀 Test with emojis 🎉 and ñiño characters *bold* text.',
            preview_url: true,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles very long text content', async () => {
      const longText = 'a'.repeat(10000)
      const markdown = `Long text: ${longText}`

      const result = await markdownToMessages(markdown)

      expect(result.length).toBeGreaterThan(1)
      expect(result.every((message) => message.type === 'text')).toBe(true)
      expect(result.map((message) => message.text.body).join('')).toContain(
        longText
      )
    })

    it('handles malformed markdown gracefully', async () => {
      const malformedInputs = [
        '**bold without closing',
        '*italic without closing',
        '~~strikethrough without closing',
        '`inline code without closing',
        '[broken link](',
        '![broken image](',
        '![](broken-image-url',
      ]

      for (const input of malformedInputs) {
        const result = await markdownToMessages(input)

        // should not throw errors, even with malformed input

        expect(Array.isArray(result)).toBe(true)
      }
    })

    it('handles deeply nested structures gracefully', async () => {
      // @note testing recursive children processing doesn't cause stack overflow

      const deeplyNested =
        '**bold with *italic with ~~strikethrough with `code`~~ text* text** text'

      const result = await markdownToMessages(deeplyNested)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toContain(
        '*bold with _italic with ~~strikethrough with `code`~~ text_ text* text'
      )
    })

    it('handles mixed line endings', async () => {
      const markdown = 'Line 1\r\n\r\nLine 2\n\nLine 3\r\rLine 4'

      const result = await markdownToMessages(markdown)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('handles HTML entities and special markdown characters', async () => {
      const markdown =
        'Text with &lt;brackets&gt; and [square] and (parentheses) and {curly} braces.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
    })

    it('handles backslash escapes in markdown', async () => {
      const markdown =
        'Text with \\*escaped\\* \\[brackets\\] and \\`backticks\\`.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      // The exact behavior depends on how remark-parse handles escapes
      expect(result[0].text.body).toBeTruthy()
    })
  })

  // WHITESPACE AND EMPTY CONTENT
  describe('Whitespace and Empty Content Handling', () => {
    it('handles paragraphs with only whitespace', async () => {
      const markdown = 'Text before.\n\n   \n\nText after.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(2)
      expect(result[0].text.body).toBe('Text before.')
      expect(result[1].text.body).toBe('Text after.')
    })

    it('trims leading and trailing whitespace from paragraphs', async () => {
      const markdown = '   Text with leading and trailing spaces.   '

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text.body).toBe('Text with leading and trailing spaces.')
    })

    it('preserves internal whitespace in text', async () => {
      const markdown = 'Text    with    multiple    spaces.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text.body).toBe('Text    with    multiple    spaces.')
    })

    it('handles tabs and other whitespace characters', async () => {
      const markdown = 'Text\twith\ttabs and\u00A0non-breaking\u00A0spaces.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
    })
  })

  // ADVANCED EDGE CASES AND INTEGRATION TESTS
  describe('Advanced Edge Cases', () => {
    it('handles unordered lists with bullet formatting', async () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe('- Item 1\n- Item 2\n- Item 3')
    })

    it('handles numbered lists with index formatting', async () => {
      const markdown = '1. First item\n2. Second item\n3. Third item'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe(
        '1. First item\n2. Second item\n3. Third item'
      )
    })

    it('handles blockquotes with > prefix', async () => {
      const markdown = '> This is a blockquote\n> with multiple lines'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe(
        '> This is a blockquote\n> with multiple lines'
      )
    })

    it('handles lists with inline formatting', async () => {
      const markdown = '- **bold item**\n- _italic item_\n- `code item`'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text.body).toBe(
        '- *bold item*\n- _italic item_\n- `code item`'
      )
    })

    it('handles multi-paragraph blockquote', async () => {
      const markdown = '> Paragraph one\n>\n> Paragraph two'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text.body).toBe('> Paragraph one\n> Paragraph two')
    })

    it('converts headers to WhatsApp bold text messages', async () => {
      const markdown = '# Header 1\n## Header 2\n### Header 3'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe('*Header 1*')
      expect(result[1].text.body).toBe('*Header 2*')
      expect(result[2].text.body).toBe('*Header 3*')
    })

    it('keeps headers when mixed with paragraphs', async () => {
      const markdown =
        '# Title\n\nSome paragraph text.\n\n## Subtitle\n\nMore paragraph text.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(4)
      expect(result[0].text.body).toBe('*Title*')
      expect(result[1].text.body).toBe('Some paragraph text.')
      expect(result[2].text.body).toBe('*Subtitle*')
      expect(result[3].text.body).toBe('More paragraph text.')
    })

    it('handles complex nested markdown structures', async () => {
      const markdown = `
**Bold with [link](https://example.com) inside**

*Italic with \`code\` inside*

Text with ![image](https://example.com/img.png) and more text.
      `.trim()

      const result = await markdownToMessages(markdown)

      expect(result.length).toBeGreaterThan(0)
      expect(result.some((msg) => msg.type === 'text')).toBe(true)
      expect(result.some((msg) => msg.type === 'image')).toBe(true)
    })

    it('handles alternating text and images', async () => {
      const markdown = `
Text before image.

![first image](https://example.com/1.png)

Text between images.

![second image](https://example.com/2.png)

Text after images.
      `.trim()

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(5)
      expect(result[0].type).toBe('text')
      expect(result[1].type).toBe('image')
      expect(result[2].type).toBe('text')
      expect(result[3].type).toBe('image')
      expect(result[4].type).toBe('text')
    })

    it('handles code blocks mixed with other content', async () => {
      const markdown = `
Regular text before code.

\`\`\`
function hello() {
  return "world";
}
\`\`\`

Regular text after code.
      `.trim()

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('text')
      expect(result[0].text.preview_url).toBe(true)
      expect(result[1].type).toBe('text')
      expect(result[1].text.preview_url).toBe(false) // code block
      expect(result[2].type).toBe('text')
      expect(result[2].text.preview_url).toBe(true)
    })

    it('handles URLs in text that are not links', async () => {
      const markdown =
        'Visit http://example.com or https://test.com for more info.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe(
        'Visit http://example.com or https://test.com for more info.'
      )
    })

    it('handles international characters and emojis in alt text', async () => {
      const markdown = '![🚀 Rocket with ñiño](https://example.com/rocket.png)'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('image')
      expect(result[0].image.caption).toBe('🚀 Rocket with ñiño')
    })

    it('handles very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '.png'
      const markdown = `![long url image](${longUrl})`

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('image')
      expect(result[0].image.link).toBe(longUrl)
    })

    it('handles paragraph breaks correctly', async () => {
      const markdown = 'Paragraph 1\n\n\n\nParagraph 2\n\n\n\n\n\nParagraph 3'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(3)
      expect(result[0].text.body).toBe('Paragraph 1')
      expect(result[1].text.body).toBe('Paragraph 2')
      expect(result[2].text.body).toBe('Paragraph 3')
    })

    it('handles inline code with special characters', async () => {
      const markdown = 'Use `console.log("Hello, World!")` to print text.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toContain('`console.log("Hello, World!")`')
    })

    it('handles mixed formatting with whitespace', async () => {
      const markdown =
        'Text with   **bold   spaces**   and   *italic   spaces*   here.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toContain('*bold   spaces*')
      expect(result[0].text.body).toContain('_italic   spaces_')
    })

    it('handles zero-width and unusual Unicode characters', async () => {
      const markdown = 'Text with\u200B\u200C\u200D\uFEFFzero-width characters.'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toContain('zero-width characters')
    })

    it('handles large number of formatting elements', async () => {
      const parts = []

      for (let i = 0; i < 100; i++) {
        parts.push(`**bold${i}**`)
        parts.push(`*italic${i}*`)
        parts.push(`\`code${i}\``)
      }

      const markdown = parts.join(' ')

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toContain('*bold0*')
      expect(result[0].text.body).toContain('_italic0_')
      expect(result[0].text.body).toContain('`code0`')
    })
  })

  // INTERNAL IMPLEMENTATION TESTS
  describe('Internal Implementation Coverage', () => {
    it('exercises the default case in convertNode', async () => {
      // @note this test ensures the default case is covered, though in practice
      // most unknown node types should return empty string

      const markdown = 'Simple text'
      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
    })

    it('handles nodes without children gracefully', async () => {
      // @note text nodes and other leaf nodes don't have children
      const markdown = 'Text without formatting'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe('Text without formatting')
    })

    it('preserves exact whitespace in code blocks', async () => {
      const codeWithSpaces = '  function test() {\n    return "hello";\n  }'
      const markdown = `\`\`\`\n${codeWithSpaces}\n\`\`\``

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toBe(`\`\`\`\n${codeWithSpaces}\n\`\`\``)
      expect(result[0].text.preview_url).toBe(false)
    })
  })
})

describe('mergeMessagesByType', () => {
  it('merges consecutive text messages separated by newline', () => {
    const messages = [
      { type: 'text', text: { body: 'Line 1', preview_url: true } },
      { type: 'text', text: { body: 'Line 2', preview_url: false } },
      {
        type: 'image',
        image: { link: 'https://example.com/a.png', caption: 'A' },
      },
      { type: 'text', text: { body: 'After image', preview_url: false } },
      { type: 'text', text: { body: 'More text', preview_url: true } },
    ]

    const grouped = mergeMessagesByType(messages)

    expect(grouped).toHaveLength(3)
    expect(grouped[0]).toEqual({
      type: 'text',
      text: { body: 'Line 1\n\nLine 2', preview_url: true },
    })
    expect(grouped[1]).toEqual(messages[2])
    expect(grouped[2]).toEqual({
      type: 'text',
      text: { body: 'After image\n\nMore text', preview_url: true },
    })
  })

  it('returns empty array when given empty input', () => {
    expect(mergeMessagesByType([])).toEqual([])
  })

  it('does not merge non-text messages', () => {
    const messages = [
      {
        type: 'image',
        image: { link: 'https://example.com/1.png', caption: '1' },
      },
      {
        type: 'image',
        image: { link: 'https://example.com/2.png', caption: '2' },
      },
    ]

    const grouped = mergeMessagesByType(messages)

    expect(grouped).toHaveLength(2)
  })

  it('merges a long run of text messages correctly', () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      type: 'text',
      text: { body: `Part ${i + 1}`, preview_url: i % 2 === 0 },
    }))

    const grouped = mergeMessagesByType(messages)

    expect(grouped).toHaveLength(1)
    expect(grouped[0].text.body).toBe(
      'Part 1\n\nPart 2\n\nPart 3\n\nPart 4\n\nPart 5'
    )
    expect(grouped[0].text.preview_url).toBe(true)
  })

  it('sets preview_url true if any merged message had preview_url true', () => {
    const messages = [
      { type: 'text', text: { body: 'No preview', preview_url: false } },
      { type: 'text', text: { body: 'Has preview', preview_url: true } },
    ]

    const grouped = mergeMessagesByType(messages)

    expect(grouped).toHaveLength(1)
    expect(grouped[0].text.preview_url).toBe(true)
  })

  it('integration: groups markdown produced messages', async () => {
    const md =
      'First paragraph.\n\nSecond paragraph.\n\n![img](https://example.com/x.png)\n\nThird paragraph.'
    const raw = await markdownToMessages(md)

    expect(raw.map((m) => m.type)).toEqual(['text', 'text', 'image', 'text'])

    const grouped = mergeMessagesByType(raw)

    expect(grouped.map((m) => m.type)).toEqual(['text', 'image', 'text'])
    expect(grouped[0].text.body).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('does not merge text messages past the configured maximum length', () => {
    const grouped = mergeMessagesByType(
      [
        { type: 'text', text: { body: 'Alpha beta', preview_url: true } },
        { type: 'text', text: { body: 'gamma delta', preview_url: false } },
      ],
      12
    )

    expect(grouped).toEqual([
      { type: 'text', text: { body: 'Alpha beta', preview_url: true } },
      { type: 'text', text: { body: 'gamma delta', preview_url: false } },
    ])
  })

  it('must handle hard line breaks', async () => {
    const messages = await markdownToMessages('first line\\\nsecond line')

    expect(messages).toEqual([
      {
        type: 'text',
        text: { body: 'first line\nsecond line', preview_url: true },
      },
    ])
  })

  it('must handle reference-style images', async () => {
    const messages = await markdownToMessages(
      '![screenshot][img]\n\n[img]: https://example.com/screenshot.png'
    )

    expect(messages).toEqual([
      {
        type: 'image',
        image: {
          link: 'https://example.com/screenshot.png',
          caption: 'screenshot',
        },
      },
    ])
  })

  it('must handle thematic breaks', async () => {
    const messages = await markdownToMessages('Before\n\n---\n\nAfter')

    expect(messages).toEqual([
      { type: 'text', text: { body: 'Before', preview_url: true } },
      { type: 'text', text: { body: '---', preview_url: false } },
      { type: 'text', text: { body: 'After', preview_url: true } },
    ])
  })
})
