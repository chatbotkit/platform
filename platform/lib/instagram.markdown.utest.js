import { markdownToMessages } from '@/lib/instagram.markdown'

describe('markdownToMessages', () => {
  describe('Basic Text Conversion', () => {
    it('converts simple text to a message', async () => {
      const markdown = 'This is a simple message.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is a simple message.',
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
          },
        },
        {
          type: 'text',
          text: {
            body: 'Second paragraph.',
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
        { type: 'text', text: { body: 'Alpha beta' } },
        { type: 'text', text: { body: 'gamma delta' } },
        { type: 'text', text: { body: 'epsilon zeta' } },
      ])
    })
  })

  describe('Text Formatting', () => {
    it('converts strong text to Instagram formatted bold text', async () => {
      const markdown = 'This is **bold** text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is *bold* text.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('converts emphasis text to Instagram formatted italic text', async () => {
      const markdown = 'This is *italic* text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is _italic_ text.',
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
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles multiple formatting types in one message', async () => {
      const markdown = 'Text with **bold**, *italic*, and `code`.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Text with *bold*, _italic_, and `code`.',
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
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('processes code blocks with language specification', async () => {
      const markdown = '```javascript\nconst x = 42;\n```'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toContain('const x = 42;')
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
  })

  describe('Complex Combinations', () => {
    it('handles mixed content types in order', async () => {
      const markdown = `Some text with **bold** and [link](https://example.com).

\`\`\`
code block
\`\`\`

![image](https://example.com/image.png)`

      const result = await markdownToMessages(markdown)

      expect(result.length).toBeGreaterThan(2)

      const messageTypes = result.map((msg) => msg.type)

      expect(messageTypes).toContain('text')
      expect(messageTypes).toContain('image')
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
      expect(result[1].type).toBe('text') // code block
      expect(result[2].type).toBe('text')
      expect(result[2].text.body).toBe('Second paragraph.')
      expect(result[3].type).toBe('image')
    })
  })

  describe('Edge Cases', () => {
    it('handles special characters and unicode', async () => {
      const markdown =
        '🚀 Test with emojis 🎉 and ñiño characters **bold** text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: '🚀 Test with emojis 🎉 and ñiño characters *bold* text.',
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
        '`inline code without closing',
        '[broken link](',
        '![broken image](',
      ]

      for (const input of malformedInputs) {
        const result = await markdownToMessages(input)

        expect(Array.isArray(result)).toBe(true)
      }
    })
  })

  it('must handle hard line breaks', async () => {
    const messages = await markdownToMessages('first line\\\nsecond line')

    expect(messages).toEqual([
      {
        type: 'text',
        text: { body: 'first line\nsecond line' },
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

  it('handles headings as bold text', async () => {
    const messages = await markdownToMessages('# Main Title\n## Subtitle')

    expect(messages).toEqual([
      {
        type: 'text',
        text: { body: '*Main Title*' },
      },
      {
        type: 'text',
        text: { body: '*Subtitle*' },
      },
    ])
  })

  it('handles unordered lists with bullet formatting', async () => {
    const messages = await markdownToMessages('- Item 1\n- Item 2\n- Item 3')

    expect(messages).toEqual([
      {
        type: 'text',
        text: { body: '- Item 1\n- Item 2\n- Item 3' },
      },
    ])
  })

  it('handles numbered lists with index formatting', async () => {
    const messages = await markdownToMessages('1. First\n2. Second\n3. Third')

    expect(messages).toEqual([
      {
        type: 'text',
        text: { body: '1. First\n2. Second\n3. Third' },
      },
    ])
  })

  it('handles blockquotes with > prefix', async () => {
    const messages = await markdownToMessages(
      '> This is a quote\n> with multiple lines'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: { body: '> This is a quote\n> with multiple lines' },
      },
    ])
  })

  it('handles lists with inline formatting', async () => {
    const messages = await markdownToMessages(
      '- **bold**\n- _italic_\n- `code`'
    )

    expect(messages).toHaveLength(1)
    expect(messages[0].text.body).toBe('- *bold*\n- _italic_\n- `code`')
  })

  it('handles multi-paragraph blockquote', async () => {
    const messages = await markdownToMessages(
      '> Paragraph one\n>\n> Paragraph two'
    )

    expect(messages).toHaveLength(1)
    expect(messages[0].text.body).toBe('> Paragraph one\n> Paragraph two')
  })

  it('must handle thematic breaks', async () => {
    const messages = await markdownToMessages('Before\n\n---\n\nAfter')

    expect(messages).toEqual([
      { type: 'text', text: { body: 'Before' } },
      { type: 'text', text: { body: '---' } },
      { type: 'text', text: { body: 'After' } },
    ])
  })
})
