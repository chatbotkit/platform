import { markdownToMessages } from '@/lib/googlechat.markdown'

describe('markdownToMessages', () => {
  describe('Basic Text Conversion', () => {
    it('converts simple text to a message', async () => {
      const messages = await markdownToMessages('hello world')

      expect(messages).toEqual([{ type: 'text', text: 'hello world' }])
    })

    it('handles empty string input', async () => {
      const messages = await markdownToMessages('')

      expect(messages).toEqual([])
    })

    it('handles whitespace-only input', async () => {
      const messages = await markdownToMessages('   ')

      expect(messages).toEqual([])
    })

    it('combines multiple paragraphs into separate messages', async () => {
      const messages = await markdownToMessages('first\n\nsecond')

      expect(messages).toEqual([
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ])
    })
  })

  describe('Formatting', () => {
    it('converts bold text with asterisks', async () => {
      const messages = await markdownToMessages('This is **bold** text.')

      expect(messages).toEqual([{ type: 'text', text: 'This is *bold* text.' }])
    })

    it('converts italic text with underscores', async () => {
      const messages = await markdownToMessages('This is *italic* text.')

      expect(messages).toEqual([
        { type: 'text', text: 'This is _italic_ text.' },
      ])
    })

    it('handles strikethrough text as plain text (no GFM plugin)', async () => {
      const messages = await markdownToMessages('This is ~~deleted~~ text.')

      expect(messages).toEqual([
        { type: 'text', text: 'This is ~~deleted~~ text.' },
      ])
    })

    it('converts inline code', async () => {
      const messages = await markdownToMessages('Run `npm install` now.')

      expect(messages).toEqual([
        { type: 'text', text: 'Run `npm install` now.' },
      ])
    })

    it('handles nested formatting', async () => {
      const messages = await markdownToMessages(
        'This is **bold and *italic***.'
      )

      expect(messages).toEqual([
        { type: 'text', text: 'This is *bold and _italic_*.' },
      ])
    })
  })

  describe('Headings', () => {
    it('converts headings to bold text', async () => {
      const messages = await markdownToMessages('# Main Title')

      expect(messages).toEqual([{ type: 'text', text: '*Main Title*' }])
    })

    it('converts h2 headings to bold text', async () => {
      const messages = await markdownToMessages('## Section Title')

      expect(messages).toEqual([{ type: 'text', text: '*Section Title*' }])
    })

    it('converts headings with inline formatting', async () => {
      const messages = await markdownToMessages('# Title with `code`')

      expect(messages).toEqual([{ type: 'text', text: '*Title with `code`*' }])
    })
  })

  describe('Code Blocks', () => {
    it('converts fenced code blocks', async () => {
      const messages = await markdownToMessages('```\nconst x = 1\n```')

      expect(messages).toEqual([
        { type: 'text', text: '```\nconst x = 1\n```' },
      ])
    })

    it('converts code blocks with language specification', async () => {
      const messages = await markdownToMessages(
        '```javascript\nconst x = 1\n```'
      )

      expect(messages).toEqual([
        { type: 'text', text: '```\nconst x = 1\n```' },
      ])
    })
  })

  describe('Links', () => {
    it('converts links to text with URL in parentheses', async () => {
      const messages = await markdownToMessages(
        'Read [the docs](https://example.com/docs) now.'
      )

      expect(messages).toEqual([
        { type: 'text', text: 'Read the docs (https://example.com/docs) now.' },
      ])
    })

    it('handles links without text', async () => {
      const messages = await markdownToMessages('[](https://example.com)')

      expect(messages).toEqual([{ type: 'text', text: 'https://example.com' }])
    })

    it('handles multiple links in one paragraph', async () => {
      const messages = await markdownToMessages(
        'Visit [one](http://one.com) and [two](http://two.com).'
      )

      expect(messages).toEqual([
        {
          type: 'text',
          text: 'Visit one (http://one.com) and two (http://two.com).',
        },
      ])
    })

    it('handles reference-style links', async () => {
      const messages = await markdownToMessages(
        'See [the guide][guide] for details.\n\n[guide]: https://example.com/guide'
      )

      expect(messages).toEqual([
        {
          type: 'text',
          text: 'See the guide (https://example.com/guide) for details.',
        },
      ])
    })

    it('handles reference-style links with bold text', async () => {
      const messages = await markdownToMessages(
        'Read [**important docs**][docs] now.\n\n[docs]: https://example.com'
      )

      expect(messages).toEqual([
        {
          type: 'text',
          text: 'Read *important docs* (https://example.com) now.',
        },
      ])
    })
  })

  describe('Images', () => {
    it('converts images to image messages', async () => {
      const messages = await markdownToMessages(
        '![alt text](https://example.com/image.png)'
      )

      expect(messages).toEqual([
        { type: 'image', image: 'https://example.com/image.png' },
      ])
    })

    it('ignores non-http images', async () => {
      const messages = await markdownToMessages(
        '![alt](data:image/png;base64,abc)'
      )

      expect(messages).toEqual([])
    })

    it('handles mixed text and images', async () => {
      const messages = await markdownToMessages(
        'Check this out:\n\n![cat](https://example.com/cat.png)\n\nNice!'
      )

      expect(messages).toEqual([
        { type: 'text', text: 'Check this out:' },
        { type: 'image', image: 'https://example.com/cat.png' },
        { type: 'text', text: 'Nice!' },
      ])
    })

    it('handles reference-style images', async () => {
      const messages = await markdownToMessages(
        '![screenshot][img]\n\n[img]: https://example.com/screenshot.png'
      )

      expect(messages).toEqual([
        { type: 'image', image: 'https://example.com/screenshot.png' },
      ])
    })

    it('ignores reference-style images with non-http URLs', async () => {
      const messages = await markdownToMessages(
        '![pic][img]\n\n[img]: data:image/png;base64,abc'
      )

      expect(messages).toEqual([])
    })
  })

  describe('Lists', () => {
    it('converts bullet lists', async () => {
      const messages = await markdownToMessages('- first\n- second\n- third')

      expect(messages).toEqual([
        { type: 'text', text: '- first\n- second\n- third' },
      ])
    })

    it('converts ordered lists', async () => {
      const messages = await markdownToMessages('1. first\n2. second\n3. third')

      expect(messages).toEqual([
        { type: 'text', text: '1. first\n2. second\n3. third' },
      ])
    })

    it('converts list items with formatting', async () => {
      const messages = await markdownToMessages(
        '- **bold item**\n- *italic item*'
      )

      expect(messages).toEqual([
        { type: 'text', text: '- *bold item*\n- _italic item_' },
      ])
    })

    it('converts list items with links', async () => {
      const messages = await markdownToMessages(
        '- [link one](http://one.com)\n- [link two](http://two.com)'
      )

      expect(messages).toEqual([
        {
          type: 'text',
          text: '- link one (http://one.com)\n- link two (http://two.com)',
        },
      ])
    })

    it('handles list items with images', async () => {
      const messages = await markdownToMessages(
        '- text item\n- ![img](https://example.com/img.png)'
      )

      expect(messages).toEqual([
        { type: 'text', text: '- text item' },
        { type: 'image', image: 'https://example.com/img.png' },
      ])
    })
  })

  describe('Blockquotes', () => {
    it('converts blockquotes with > prefix', async () => {
      const messages = await markdownToMessages('> quoted text')

      expect(messages).toEqual([{ type: 'text', text: '> quoted text' }])
    })

    it('converts multiline blockquotes', async () => {
      const messages = await markdownToMessages('> first line\n> second line')

      expect(messages).toEqual([
        { type: 'text', text: '> first line\n> second line' },
      ])
    })

    it('converts blockquotes with formatting', async () => {
      const messages = await markdownToMessages('> This is **bold** in a quote')

      expect(messages).toEqual([
        { type: 'text', text: '> This is *bold* in a quote' },
      ])
    })

    it('converts blockquotes with links', async () => {
      const messages = await markdownToMessages(
        '> See [docs](https://example.com) here.'
      )

      expect(messages).toEqual([
        { type: 'text', text: '> See docs (https://example.com) here.' },
      ])
    })

    it('separates multiple paragraphs in blockquotes', async () => {
      const messages = await markdownToMessages(
        '> First paragraph.\n>\n> Second paragraph.'
      )

      expect(messages).toEqual([
        {
          type: 'text',
          text: '> First paragraph.\n> Second paragraph.',
        },
      ])
    })
  })

  describe('Thematic Breaks', () => {
    it('converts horizontal rules', async () => {
      const messages = await markdownToMessages('above\n\n---\n\nbelow')

      expect(messages).toEqual([
        { type: 'text', text: 'above' },
        { type: 'text', text: '---' },
        { type: 'text', text: 'below' },
      ])
    })
  })

  describe('Hard Line Breaks', () => {
    it('converts backslash line breaks to newlines', async () => {
      const messages = await markdownToMessages('first line\\\nsecond line')

      expect(messages).toEqual([
        { type: 'text', text: 'first line\nsecond line' },
      ])
    })

    it('preserves line breaks inside blockquotes', async () => {
      const messages = await markdownToMessages('> first line\\\n> second line')

      expect(messages).toEqual([
        { type: 'text', text: '> first line\n> second line' },
      ])
    })
  })

  describe('Message Splitting', () => {
    it('splits oversized text messages', async () => {
      const messages = await markdownToMessages(
        'Alpha beta gamma delta epsilon zeta',
        12
      )

      expect(messages).toEqual([
        { type: 'text', text: 'Alpha beta' },
        { type: 'text', text: 'gamma delta' },
        { type: 'text', text: 'epsilon zeta' },
      ])
    })

    it('does not split short messages', async () => {
      const messages = await markdownToMessages('short', 100)

      expect(messages).toEqual([{ type: 'text', text: 'short' }])
    })
  })

  describe('Complex Content', () => {
    it('handles mixed markdown content', async () => {
      const markdown = [
        '# Welcome',
        '',
        'Here is some **important** info.',
        '',
        '- Item one',
        '- Item two',
        '',
        '> A wise quote',
        '',
        'Visit [our site](https://example.com).',
      ].join('\n')

      const messages = await markdownToMessages(markdown)

      expect(messages).toEqual([
        { type: 'text', text: '*Welcome*' },
        { type: 'text', text: 'Here is some *important* info.' },
        { type: 'text', text: '- Item one\n- Item two' },
        { type: 'text', text: '> A wise quote' },
        { type: 'text', text: 'Visit our site (https://example.com).' },
      ])
    })
  })
})
