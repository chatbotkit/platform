import { markdownToMessages } from '@/lib/telegram.markdown'

describe('markdownToMessages', () => {
  it('must return an array of messages', async () => {
    const messages = await markdownToMessages('hi there')

    expect(messages).toEqual([{ type: 'text', text: 'hi there' }])
  })

  it('must correctly escape dot', async () => {
    const messages = await markdownToMessages('hi there.')

    expect(messages).toEqual([{ type: 'text', text: 'hi there\\.' }])
  })

  it('must correctly escape multiple dots', async () => {
    const messages = await markdownToMessages('hi there...')

    expect(messages).toEqual([{ type: 'text', text: 'hi there\\.\\.\\.' }])
  })

  it('test harness 001', async () => {
    const messages = await markdownToMessages(
      "I'm still unable to access your calendar because we're missing a necessary secret value. Please visit https://chatbotkit.com/secret/cm4movs8p08ct12hsy975s4vs to provide the required information. Once this is set up, I can help you list your calendar events. Let me know if you have any questions or need further assistance!"
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: "I'm still unable to access your calendar because we're missing a necessary secret value\\. Please visit https://chatbotkit\\.com/secret/cm4movs8p08ct12hsy975s4vs to provide the required information\\. Once this is set up, I can help you list your calendar events\\. Let me know if you have any questions or need further assistance\\!",
      },
    ])
  })

  it('must preserve link text in markdown links', async () => {
    const messages = await markdownToMessages(
      'Read [the docs](https://chatbotkit.com/docs) now'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: 'Read [the docs](https://chatbotkit.com/docs) now',
      },
    ])
  })

  it('must convert headings to bold telegram messages', async () => {
    const messages = await markdownToMessages('# Release Notes')

    expect(messages).toEqual([{ type: 'text', text: '*Release Notes*' }])
  })

  it('must convert bullet lists to telegram bullet messages', async () => {
    const messages = await markdownToMessages('- first\n- second')

    expect(messages).toEqual([
      {
        type: 'text',
        text: '• first\n• second',
      },
    ])
  })

  it('must convert ordered lists to telegram numbered messages', async () => {
    const messages = await markdownToMessages('1. first\n2. second')

    expect(messages).toEqual([
      {
        type: 'text',
        text: '1\\. first\n2\\. second',
      },
    ])
  })

  it('must convert blockquotes to telegram blockquote messages', async () => {
    const messages = await markdownToMessages('> quoted text')

    expect(messages).toEqual([{ type: 'text', text: '> quoted text' }])
  })

  it('must convert multiline blockquotes line-by-line', async () => {
    const messages = await markdownToMessages('> first line\n> second line')

    expect(messages).toEqual([
      { type: 'text', text: '> first line\n> second line' },
    ])
  })

  it('must preserve list images as image messages', async () => {
    const messages = await markdownToMessages(
      '- first\n- ![cat](https://example.com/cat.png)'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: '• first',
      },
      {
        type: 'image',
        image: 'https://example.com/cat.png',
      },
    ])
  })

  it('must split oversized text messages to fit the configured maximum length', async () => {
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

  it('must escape backslashes in text', async () => {
    const messages = await markdownToMessages('path\\to\\file')

    expect(messages).toEqual([{ type: 'text', text: 'path\\\\to\\\\file' }])
  })

  it('must render code blocks inside blockquotes', async () => {
    const messages = await markdownToMessages(
      '> Here is code: `console.log("hi")`'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: '> Here is code: `console\\.log\\("hi"\\)`',
      },
    ])
  })

  it('must render fenced code blocks inside blockquotes', async () => {
    const messages = await markdownToMessages('> ```js\n> const x = 1\n> ```')

    expect(messages).toEqual([
      {
        type: 'text',
        text: '> ```js\n> const x \\= 1\n> ```',
      },
    ])
  })

  it('must render code in list items', async () => {
    const messages = await markdownToMessages('- run `npm install`')

    expect(messages).toEqual([{ type: 'text', text: '• run `npm install`' }])
  })

  it('must handle reference-style links', async () => {
    const messages = await markdownToMessages(
      'Read [the docs][docs] for more info.\n\n[docs]: https://chatbotkit.com/docs'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: 'Read [the docs](https://chatbotkit.com/docs) for more info\\.',
      },
    ])
  })

  it('must handle reference-style links in blockquotes', async () => {
    const messages = await markdownToMessages(
      '> See [the guide][guide] here.\n\n[guide]: https://example.com/guide'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: '> See [the guide](https://example.com/guide) here\\.',
      },
    ])
  })

  it('must handle reference-style links in list items', async () => {
    const messages = await markdownToMessages(
      '- Check [docs][d]\n\n[d]: https://example.com'
    )

    expect(messages).toEqual([
      { type: 'text', text: '• Check [docs](https://example.com)' },
    ])
  })

  it('must handle hard line breaks', async () => {
    const messages = await markdownToMessages('first line\\\nsecond line')

    expect(messages).toEqual([
      { type: 'text', text: 'first line\nsecond line' },
    ])
  })

  it('must handle reference-style images', async () => {
    const messages = await markdownToMessages(
      '![screenshot][img]\n\n[img]: https://example.com/screenshot.png'
    )

    expect(messages).toEqual([
      { type: 'image', image: 'https://example.com/screenshot.png' },
    ])
  })

  it('must separate multiple paragraphs in blockquotes', async () => {
    const messages = await markdownToMessages(
      '> First paragraph.\n>\n> Second paragraph.'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: '> First paragraph\\.\n> Second paragraph\\.',
      },
    ])
  })
  it('must handle thematic breaks', async () => {
    const messages = await markdownToMessages('Before\n\n---\n\nAfter')

    expect(messages).toEqual([
      { type: 'text', text: 'Before' },
      { type: 'text', text: '\\-\\-\\-' },
      { type: 'text', text: 'After' },
    ])
  })

  it('must convert markdown image with video URL to telegram video message', async () => {
    const messages = await markdownToMessages(
      '![clip](https://example.com/clip.mp4)'
    )

    expect(messages).toEqual([
      { type: 'video', video: 'https://example.com/clip.mp4' },
    ])
  })

  it('must convert reference-style video URL to telegram video message', async () => {
    const messages = await markdownToMessages(
      '![clip][video]\n\n[video]: https://example.com/clip.webm'
    )

    expect(messages).toEqual([
      { type: 'video', video: 'https://example.com/clip.webm' },
    ])
  })

  it('must convert markdown image with audio URL to telegram audio message', async () => {
    const messages = await markdownToMessages(
      '![voice](https://example.com/voice.mp3)'
    )

    expect(messages).toEqual([
      { type: 'audio', audio: 'https://example.com/voice.mp3' },
    ])
  })

  it('must convert reference-style audio URL to telegram audio message', async () => {
    const messages = await markdownToMessages(
      '![voice][audio]\n\n[audio]: https://example.com/voice.m4a'
    )

    expect(messages).toEqual([
      { type: 'audio', audio: 'https://example.com/voice.m4a' },
    ])
  })

  it('must convert voice-note alt text with audio URL to telegram voice message', async () => {
    const messages = await markdownToMessages(
      '![voice note](https://example.com/reply.ogg)'
    )

    expect(messages).toEqual([
      { type: 'voice', voice: 'https://example.com/reply.ogg' },
    ])
  })

  it('must convert voicenote alt text with reference audio URL to telegram voice message', async () => {
    const messages = await markdownToMessages(
      '![voicenote][voice]\n\n[voice]: https://example.com/reply.opus'
    )

    expect(messages).toEqual([
      { type: 'voice', voice: 'https://example.com/reply.opus' },
    ])
  })

  it('must convert gfm task lists to checkbox-prefixed telegram messages', async () => {
    const messages = await markdownToMessages('- [x] shipped\n- [ ] pending')

    expect(messages).toEqual([
      {
        type: 'text',
        text: '✅ shipped\n⬜ pending',
      },
    ])
  })

  it('must convert gfm tables to telegram text messages', async () => {
    const messages = await markdownToMessages(
      '| Name | Status |\n| ---- | ------ |\n| Bot A | live |\n| Bot B | draft |'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: '*Name* \\| *Status*\nBot A \\| live\nBot B \\| draft',
      },
    ])
  })

  it('must convert markdown image with document URL to telegram file message', async () => {
    const messages = await markdownToMessages(
      '![report](https://example.com/report.pdf)'
    )

    expect(messages).toEqual([
      { type: 'file', file: 'https://example.com/report.pdf' },
    ])
  })

  it('must convert reference-style document URL to telegram file message', async () => {
    const messages = await markdownToMessages(
      '![report][doc]\n\n[doc]: https://example.com/report.docx'
    )

    expect(messages).toEqual([
      { type: 'file', file: 'https://example.com/report.docx' },
    ])
  })
})
