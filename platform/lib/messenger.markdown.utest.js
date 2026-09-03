import { markdownToMessages } from '@/lib/messenger.markdown'

describe('markdownToMessages', () => {
  describe('Basic Text Conversion', () => {
    it('converts simple text to a messenger message', async () => {
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

    it('handles empty string gracefully', async () => {
      const markdown = ''
      const expected = []

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles whitespace-only text', async () => {
      const markdown = '   \n\t  '
      const expected = []

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('trims whitespace from text', async () => {
      const markdown = '  Hello world  '

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Hello world',
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
    it('converts strong/bold text to messenger formatted bold text', async () => {
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

    it('converts emphasis/italic text to messenger formatted italic text', async () => {
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

    it('does not convert strikethrough (not supported without GFM)', async () => {
      const markdown = 'This is ~~strikethrough~~ text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'This is ~~strikethrough~~ text.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles nested formatting correctly', async () => {
      const markdown = 'Text with **bold _italic_ combination**'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Text with *bold _italic_ combination*',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles multiple formatting types in same paragraph', async () => {
      const markdown = 'Mix of **bold**, *italic*, and ~~strikethrough~~.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Mix of *bold*, _italic_, and ~~strikethrough~~.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  describe('Code Handling', () => {
    it('converts inline code correctly', async () => {
      const markdown = 'Use the `console.log()` function.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Use the `console.log()` function.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('converts code blocks to separate messages', async () => {
      const markdown =
        'Here is some code:\n\n```javascript\nconsole.log("Hello")\n```'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Here is some code:',
          },
        },
        {
          type: 'text',
          text: {
            body: '```\nconsole.log("Hello")\n```',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles code blocks without language specification', async () => {
      const markdown = '```\nplain code\n```'

      const expected = [
        {
          type: 'text',
          text: {
            body: '```\nplain code\n```',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles multiple inline code snippets', async () => {
      const markdown = 'Use `var x = 1` and then `console.log(x)`.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Use `var x = 1` and then `console.log(x)`.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('maps buttons code block to messenger quick replies', async () => {
      const markdown = '```buttons\n- caption: "Option One"\n- caption: "Option Two"\n```'

      const expected = [
        {
          type: 'quickReplies',
          text: {
            body: 'Choose an option:',
          },
          quickReplies: [
            {
              content_type: 'text',
              title: 'Option One',
              payload: 'Option One',
            },
            {
              content_type: 'text',
              title: 'Option Two',
              payload: 'Option Two',
            },
          ],
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('ignores buttons with href when mapping messenger quick replies', async () => {
      const markdown =
        '```buttons\n- caption: "Send Status"\n- caption: "Open Dashboard"\n  href: "https://example.com"\n```'

      const expected = [
        {
          type: 'quickReplies',
          text: {
            body: 'Choose an option:',
          },
          quickReplies: [
            {
              content_type: 'text',
              title: 'Send Status',
              payload: 'Send Status',
            },
          ],
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  describe('Link Handling', () => {
    it('handles simple links correctly', async () => {
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
      const markdown = 'Visit [](http://example.com) for more info.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Visit http://example.com for more info.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles multiple links in same paragraph', async () => {
      const markdown =
        'Visit [Google](https://google.com) and [GitHub](https://github.com).'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Visit Google (https://google.com) and GitHub (https://github.com).',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles links with formatted text', async () => {
      const markdown = 'Check out [**bold link**](http://example.com)!'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Check out *bold link* (http://example.com)!',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles empty URL gracefully', async () => {
      const markdown = 'Check out [this link]().'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Check out this link ().',
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

  // IMAGE HANDLING
  describe('Image Handling', () => {
    it('processes images with alt text correctly', async () => {
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

    it('processes images with title attribute', async () => {
      const markdown = '![](http://example.com/image.png "Image Title")'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'http://example.com/image.png',
            caption: 'Image Title',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('processes images without alt text using default caption', async () => {
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

    it('ignores images with non-http URLs', async () => {
      const markdown = '![local image](./local-image.png)'
      const expected = []

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles HTTPS URLs correctly', async () => {
      const markdown = '![secure image](https://example.com/image.png)'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'https://example.com/image.png',
            caption: 'secure image',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('prioritizes alt text over title when both are present', async () => {
      const markdown = '![Alt Text](http://example.com/image.png "Title Text")'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'http://example.com/image.png',
            caption: 'Alt Text',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('maps video assets to video messages', async () => {
      const markdown = '![clip](https://example.com/video.mp4)'

      const expected = [
        {
          type: 'video',
          video: {
            link: 'https://example.com/video.mp4',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('maps audio assets to audio messages', async () => {
      const markdown = '![podcast](https://example.com/episode.mp3)'

      const expected = [
        {
          type: 'audio',
          audio: {
            link: 'https://example.com/episode.mp3',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('maps document assets to file messages', async () => {
      const markdown = '![brochure](https://example.com/brochure.pdf)'

      const expected = [
        {
          type: 'file',
          file: {
            link: 'https://example.com/brochure.pdf',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  describe('Multiple Paragraphs', () => {
    it('converts multiple paragraphs into separate messages', async () => {
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

    it('handles paragraphs with mixed content', async () => {
      const markdown =
        'First **bold** paragraph.\n\nSecond [link](http://example.com) paragraph.'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'First *bold* paragraph.',
          },
        },
        {
          type: 'text',
          text: {
            body: 'Second link (http://example.com) paragraph.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles empty paragraphs correctly', async () => {
      const markdown = 'First paragraph.\n\n\n\nSecond paragraph.'

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
  })

  describe('Complex Combinations', () => {
    it('handles mixed content types correctly', async () => {
      const markdown = `# Header

Some text with **bold** and [link](https://example.com).

\`\`\`
code block
\`\`\`

![image](https://example.com/image.png)

Final paragraph with \`inline code\`.`

      const expected = [
        {
          type: 'text',
          text: {
            body: '*Header*',
          },
        },
        {
          type: 'text',
          text: {
            body: 'Some text with *bold* and link (https://example.com).',
          },
        },
        {
          type: 'text',
          text: {
            body: '```\ncode block\n```',
          },
        },
        {
          type: 'image',
          image: {
            link: 'https://example.com/image.png',
            caption: 'image',
          },
        },
        {
          type: 'text',
          text: {
            body: 'Final paragraph with `inline code`.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles text with images and links together', async () => {
      const markdown =
        'Check out this [website](http://example.com) and this ![image](https://example.com/pic.jpg).'

      const expected = [
        {
          type: 'image',
          image: {
            link: 'https://example.com/pic.jpg',
            caption: 'image',
          },
        },
        {
          type: 'text',
          text: {
            body: 'Check out this website (http://example.com) and this .',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  // EDGE CASES AND ERROR HANDLING
  describe('Edge Cases and Error Handling', () => {
    it('handles null input gracefully', async () => {
      const result = await markdownToMessages(null)

      expect(result).toEqual([])
    })

    it('handles undefined input gracefully', async () => {
      const result = await markdownToMessages(undefined)

      expect(result).toEqual([])
    })

    it('handles malformed markdown gracefully', async () => {
      const markdown = '**unclosed bold and [unclosed link'

      const expected = [
        {
          type: 'text',
          text: {
            body: '**unclosed bold and [unclosed link',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles special characters correctly', async () => {
      const markdown = 'Text with émojis 🚀 and special chars: @#$%^&*()'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Text with émojis 🚀 and special chars: @#$%^&*()',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles very long text correctly', async () => {
      const longText = 'a'.repeat(1000)
      const markdown = `Long text: ${longText}`

      const expected = [
        {
          type: 'text',
          text: {
            body: `Long text: ${longText}`,
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles line breaks within paragraphs', async () => {
      const markdown = 'Line one\nLine two in same paragraph'

      const expected = [
        {
          type: 'text',
          text: {
            body: 'Line one\nLine two in same paragraph',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })
  })

  describe('Unsupported Elements', () => {
    it('renders headers as bold text', async () => {
      const markdown = '# Header\n\nSome text.'

      const expected = [
        {
          type: 'text',
          text: {
            body: '*Header*',
          },
        },
        {
          type: 'text',
          text: {
            body: 'Some text.',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles unordered lists with bullet formatting', async () => {
      const markdown = `- Item 1
- Item 2
- Item 3`

      const expected = [
        {
          type: 'text',
          text: {
            body: '- Item 1\n- Item 2\n- Item 3',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles numbered lists with index formatting', async () => {
      const markdown = `1. First item
2. Second item
3. Third item`

      const expected = [
        {
          type: 'text',
          text: {
            body: '1. First item\n2. Second item\n3. Third item',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles blockquotes with > prefix', async () => {
      const markdown = '> This is a quote\n> with multiple lines'

      const expected = [
        {
          type: 'text',
          text: {
            body: '> This is a quote\n> with multiple lines',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles headings as bold text', async () => {
      const markdown = '# Main Title\n## Subtitle'

      const expected = [
        {
          type: 'text',
          text: {
            body: '*Main Title*',
          },
        },
        {
          type: 'text',
          text: {
            body: '*Subtitle*',
          },
        },
      ]

      await expect(markdownToMessages(markdown)).resolves.toEqual(expected)
    })

    it('handles lists with inline formatting', async () => {
      const markdown = '- **bold**\n- _italic_\n- `code`'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text.body).toBe('- *bold*\n- _italic_\n- `code`')
    })

    it('handles multi-paragraph blockquote', async () => {
      const markdown = '> Paragraph one\n>\n> Paragraph two'

      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].text.body).toBe('> Paragraph one\n> Paragraph two')
    })

    it('handles tables by extracting text content', async () => {
      const markdown = `| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |`

      // Tables should be handled by the default case
      const result = await markdownToMessages(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.body).toContain('Column 1')
      expect(result[0].text.body).toContain('Value 1')
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

  it('must handle thematic breaks', async () => {
    const messages = await markdownToMessages('Before\n\n---\n\nAfter')

    expect(messages).toEqual([
      { type: 'text', text: { body: 'Before' } },
      { type: 'text', text: { body: '---' } },
      { type: 'text', text: { body: 'After' } },
    ])
  })
})
