import {
  extractImagesFromMarkdown,
  extractLinksFromMarkdown,
  extractUrlsFromMarkdown,
} from './extract'

describe('extractUrlsFromMarkdown', () => {
  test('extracts URLs from anchor links', () => {
    const markdown = `
# Test Anchor Links

[Google](https://www.google.com)
[GitHub](https://github.com)
`

    const expectedUrls = ['https://www.google.com', 'https://github.com']

    const result = extractUrlsFromMarkdown(markdown)

    expect(result).toEqual(expectedUrls)
  })

  test('extracts URLs from plain text', () => {
    const markdown = `
# Test Plain Text URLs

This is a link: https://www.example.com, and here is another one: http://example.org.
`

    const expectedUrls = ['https://www.example.com', 'http://example.org']

    const result = extractUrlsFromMarkdown(markdown)

    expect(result).toEqual(expectedUrls)
  })

  test('ignores non-fully qualified URLs in plain text', () => {
    const markdown = `
# Test Non-Qualified URLs

This is not a full URL: www.example.com, and this one as well: example.org.
`

    const expectedUrls = []

    const result = extractUrlsFromMarkdown(markdown)

    expect(result).toEqual(expectedUrls)
  })

  test('ignores non-fully qualified URLs in anchor links', () => {
    const markdown = `
# Test Non-Qualified Anchor Links

[Example](www.example.com)
[Example](example.org)
`

    const expectedUrls = []

    const result = extractUrlsFromMarkdown(markdown)

    expect(result).toEqual(expectedUrls)
  })

  test('handles mixed content', () => {
    const markdown = `
# Test Mixed Content

[Google](https://www.google.com) with some text URL: https://example.com.
Non-qualified: example.com.
[Partial](www.partial.com) and a real one: https://real-url.com.
`

    const expectedUrls = [
      'https://www.google.com',
      'https://example.com',
      'https://real-url.com',
    ]

    const result = extractUrlsFromMarkdown(markdown)

    expect(result).toEqual(expectedUrls)
  })

  test('returns an empty array when no URLs are found', () => {
    const markdown = `
# Test No URLs

This markdown contains no URLs, just plain text.
`

    const expectedUrls = []

    const result = extractUrlsFromMarkdown(markdown)

    expect(result).toEqual(expectedUrls)
  })

  test('extracts URLs from multiple lines', () => {
    const markdown = `
# Test Multiple Lines

Here is a URL: https://first.com.

Another URL on a new line: http://second.org.
`

    const expectedUrls = ['https://first.com', 'http://second.org']

    const result = extractUrlsFromMarkdown(markdown)

    expect(result).toEqual(expectedUrls)
  })
})

describe('extractLinksFromMarkdown', () => {
  test('extracts links from anchor links', () => {
    const markdown = `
# Test Anchor Links

[Google](https://www.google.com)
[GitHub](https://github.com)
`

    const expectedLinks = [
      { title: 'Google', url: 'https://www.google.com', start: 22, end: 54 },
      { title: 'GitHub', url: 'https://github.com', start: 55, end: 83 },
    ]

    const result = extractLinksFromMarkdown(markdown)

    expect(result).toEqual(expectedLinks)
  })
})

describe('extractImagesFromMarkdown', () => {
  test('extracts images from widget', () => {
    const markdown = `![barIcon](https://cdn.prod.website-files.com/6762ce4922698f9d6a7b1114/6762d94f023919cf07b93fc8_QuenchFavIcon32.png#barIcon)

![banner](https://cdn.prod.website-files.com/6762ce4922698f9d6a7b1114/679113f05db1edeb3599969a_Thumbnail%20(1).png#banner)

Search and get verified answers from your internal tools. Centralize resources, reduce onboarding time and keep teams aligned with up-to-date information.

[Question 1]() [Question 2]() [Question 3]()`

    const expectedImages = [
      {
        title: 'barIcon',
        url: 'https://cdn.prod.website-files.com/6762ce4922698f9d6a7b1114/6762d94f023919cf07b93fc8_QuenchFavIcon32.png#barIcon',
        start: 0,
        end: 124,
      },
      {
        title: 'banner',
        url: 'https://cdn.prod.website-files.com/6762ce4922698f9d6a7b1114/679113f05db1edeb3599969a_Thumbnail%20(1).png#banner',
        start: 126,
        end: 248,
      },
    ]

    const result = extractImagesFromMarkdown(markdown)

    expect(result).toEqual(expectedImages)
  })
})
