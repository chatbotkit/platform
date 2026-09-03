import { renderToStaticMarkup as render } from 'react-dom/server'

import { siteUrl } from '@/config/site'

import EmailAction from './EmailAction'

describe('EmailAction', () => {
  it('should render with input text', async () => {
    const input = 'This is a test email action content.'

    const html = await render(<EmailAction input={input} />)

    expect(html).toContain(input)
    expect(html).toContain(`Sent from ChatBotKit`)
    expect(html).toContain(siteUrl)
  })

  it('should render with input and preview', async () => {
    const input = 'Hello, this is the email content.'
    const preview = 'Email preview text'

    const html = await render(<EmailAction input={input} preview={preview} />)

    expect(html).toContain(input)
    expect(html).toContain(`Sent from ChatBotKit`)
  })

  it('should handle markdown in input', async () => {
    const input =
      '**Bold text** and *italic text* and [link](https://example.com)'

    const html = await render(<EmailAction input={input} />)

    expect(html).toContain(`Sent from ChatBotKit`)
  })

  it('should render with empty input', async () => {
    const html = await render(<EmailAction input="" />)

    expect(html).toContain(`Sent from ChatBotKit`)
    expect(html).toContain(siteUrl)
  })

  it('should render with multiline input', async () => {
    const input = `Line 1
Line 2
Line 3`

    const html = await render(<EmailAction input={input} />)

    expect(html).toContain(`Sent from ChatBotKit`)
  })

  it('should render without preview prop', async () => {
    const input = 'Test content without preview'

    const html = await render(<EmailAction input={input} />)

    expect(html).toContain(input)
    expect(html).toContain(`Sent from ChatBotKit`)
  })

  it('should handle special characters in input', async () => {
    const input = 'Special chars: <>&"\'\\n\\t'

    const html = await render(<EmailAction input={input} />)

    expect(html).toContain(`Sent from ChatBotKit`)
  })

  it('should have correct static properties', () => {
    expect(EmailAction.subject).toBe('Email Action')
    expect(EmailAction.PreviewProps).toBeDefined()
    expect(EmailAction.PreviewProps).toHaveProperty('input')
    expect(EmailAction.PreviewProps.input).toBe(
      'I need some support. Can you help me?'
    )
  })

  it('should render ChatBotKit link correctly', async () => {
    const html = await render(<EmailAction input="Test input" />)

    expect(html).toContain(siteUrl)
    expect(html).toContain('target="_blank"')
  })

  it('should handle missing input prop', async () => {
    const html = await render(<EmailAction input="" />)

    expect(html).toContain(`Sent from ChatBotKit`)
  })
})
