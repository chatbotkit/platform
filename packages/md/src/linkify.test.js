import { linkifyMarkdown } from './linkify'

describe('linkifyMarkdown', () => {
  it('should replace a single keyword with a markdown link', () => {
    const content = 'This is a test sentence with the keyword.'
    const keyword = 'keyword'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      `This is a test sentence with the [${keyword}](${url}).`
    )
  })

  it('should replace multiple instances of the keyword with markdown links', () => {
    const content = 'This is a test sentence with multiple keywords.'
    const keyword = 'keywords'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      `This is a test sentence with multiple [${keyword}](${url}).`
    )
  })

  it('should not replace keywords that are already part of a markdown link', () => {
    const content =
      'This is a [test sentence](https://example.com) with the keyword.'

    const keyword = 'keyword'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      `This is a [test sentence](https://example.com) with the [${keyword}](${url}).`
    )
  })

  it('should not replace keywords that are part of a URL', () => {
    const content =
      'This is a test sentence with the keyword https://example.com.'

    const keyword = 'keyword'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      `This is a test sentence with the [${keyword}](${url}) https://example.com.`
    )
  })

  it('should not replace keywords that are part of another markdown link', () => {
    const content =
      'This is a [test sentence with the keyword](https://example.com).'

    const keyword = 'keyword'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      `This is a [test sentence with the ${keyword}](https://example.com).`
    )
  })

  it('should not replace keywords that are already linked', () => {
    const content =
      'This is a test sentence with the [models](https://existing-link.com).'

    const keyword = 'models'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      'This is a test sentence with the [models](https://existing-link.com).'
    )
  })

  it('should not replace keywords that appear inside a link URL', () => {
    const content =
      'This is a test sentence with the [keyword](https://example.com/keyword).'

    const keyword = 'keyword'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      'This is a test sentence with the [keyword](https://example.com/keyword).'
    )
  })

  it('should not replace keywords that appear inside code blocks', () => {
    const content = 'This is a test sentence with `keyword` inside code.'
    const keyword = 'keyword'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(
      'This is a test sentence with `keyword` inside code.'
    )
  })

  it('should skip lines with multi-line code blocks', () => {
    const content = `This is a test sentence.

\`\`\`
keyword
\`\`\`

This is another test sentence.`

    const keyword = 'keyword'
    const url = 'https://example.com'

    const result = linkifyMarkdown(content, keyword, url)

    expect(result).toEqual(content)
  })
})
