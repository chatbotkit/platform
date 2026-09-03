import { toHtml, toText } from './convert'

describe('toHtml', () => {
  it('must make html', async () => {
    expect(await toHtml('# hello')).toEqual(`<h1>hello</h1>`)
  })
})

describe('toText', () => {
  it('must strip bold formatting', () => {
    expect(toText('**bold** text')).toEqual('bold text')
  })

  it('must strip italic formatting', () => {
    expect(toText('_italic_ text')).toEqual('italic text')
  })

  it('must extract link text', () => {
    expect(toText('[link text](https://example.com)')).toEqual('link text')
  })

  it('must strip heading markers', () => {
    expect(toText('# Heading')).toEqual('Heading')
  })

  it('must handle complex markdown', () => {
    expect(toText('**bold** and _italic_ with [link](url)')).toEqual(
      'bold and italic with link'
    )
  })

  it('must handle empty input', () => {
    expect(toText('')).toEqual('')
  })

  it('must handle null/undefined input', () => {
    expect(toText(null)).toEqual('')
    expect(toText(undefined)).toEqual('')
  })

  it('must preserve plain text', () => {
    expect(toText('just plain text')).toEqual('just plain text')
  })
})
