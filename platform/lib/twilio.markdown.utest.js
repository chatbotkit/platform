import { markdownToMessages } from '@/lib/twilio.markdown'

describe('markdownToMessages', () => {
  it('must return an array of messages', async () => {
    const messages = await markdownToMessages('hi there')

    expect(messages).toEqual([{ type: 'text', text: 'hi there' }])
  })

  it('test harness 001', async () => {
    const messages = await markdownToMessages(
      'Here is a list of items:\n\n- Item 1\n- Item 2\n- Item 3'
    )

    expect(messages).toEqual([
      { type: 'text', text: 'Here is a list of items:' },
      { type: 'text', text: '- Item 1\n- Item 2\n- Item 3' },
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

  it('must preserve link display text', async () => {
    const messages = await markdownToMessages(
      'Read [the docs](https://chatbotkit.com/docs) now'
    )

    expect(messages).toEqual([
      {
        type: 'text',
        text: 'Read the docs (https://chatbotkit.com/docs) now',
      },
    ])
  })

  it('must handle reference-style links', async () => {
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

  it('must handle headings', async () => {
    const messages = await markdownToMessages('# Main Title\n\n## Subtitle')

    expect(messages).toEqual([
      { type: 'text', text: 'Main Title' },
      { type: 'text', text: 'Subtitle' },
    ])
  })

  it('must handle numbered lists', async () => {
    const messages = await markdownToMessages('1. First\n2. Second\n3. Third')

    expect(messages).toEqual([
      { type: 'text', text: '1. First\n2. Second\n3. Third' },
    ])
  })

  it('must handle blockquotes', async () => {
    const messages = await markdownToMessages(
      '> This is a quote\n> with two lines'
    )

    expect(messages).toEqual([
      { type: 'text', text: '> This is a quote\n> with two lines' },
    ])
  })

  it('must handle thematic breaks', async () => {
    const messages = await markdownToMessages('Before\n\n---\n\nAfter')

    expect(messages).toEqual([
      { type: 'text', text: 'Before' },
      { type: 'text', text: '---' },
      { type: 'text', text: 'After' },
    ])
  })
})
