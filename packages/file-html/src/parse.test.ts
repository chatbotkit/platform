import { html2text, validateSelectors } from './parse'

describe('html2text', () => {
  it('must correctly get the text from html', () => {
    expect(html2text('<body><div>test</div></body>')).toEqual('test')
  })

  it('must correctly get non-empty text from html with selectors', () => {
    expect(
      html2text('<body><main>main</main><footer>footer</footer></body>', {
        selectors: 'main',
      })
    ).toEqual('main')
  })

  it('must correctly get empty text from html with selectors', () => {
    expect(
      html2text('<body><main>main</main><footer>footer</footer></body>', {
        selectors: 'article',
      })
    ).toEqual('')
  })

  it('must correctly get empty text from html with non-existing selectors', () => {
    expect(
      html2text('<body><main>main</main><footer>footer</footer></body>', {
        selectors: 'skip',
      })
    ).toEqual('')
  })

  it('must correctly get text but also skip some elements such as nav', () => {
    expect(
      html2text(
        '<body><nav>nav</nav><main>main</main><footer>footer</footer></body>'
      )
    ).toEqual('main')
  })

  it('must correctly get text but also skip element that have role of navigation', () => {
    expect(
      html2text(
        '<body><div role="navigation">nav</div><main>main</main><footer>footer</footer></body>'
      )
    ).toEqual('main')
  })

  it('must be able to preserve image urls', () => {
    expect(
      html2text(
        '<body><img src="https://example.com/image.png" alt="image" /></body>'
      )
    ).toEqual('image [https://example.com/image.png]')
  })

  describe('data url handling', () => {
    it('must skip data urls in links by default', () => {
      expect(
        html2text(
          '<body><a href="data:text/plain;base64,SGVsbG8=">click here</a></body>'
        )
      ).toEqual('')
    })

    it('must skip data urls in images by default', () => {
      expect(
        html2text(
          '<body><img src="data:image/png;base64,iVBORw0KGgo=" alt="inline image" /></body>'
        )
      ).toEqual('')
    })

    it('must include data urls when includeDataUrls is true', () => {
      expect(
        html2text(
          '<body><a href="data:text/plain;base64,SGVsbG8=">click here</a></body>',
          { includeDataUrls: true }
        )
      ).toEqual('click here [data:text/plain;base64,SGVsbG8=]')
    })

    it('must include data urls in images when includeDataUrls is true', () => {
      expect(
        html2text(
          '<body><img src="data:image/png;base64,iVBORw0KGgo=" alt="inline image" /></body>',
          { includeDataUrls: true }
        )
      ).toEqual('inline image [data:image/png;base64,iVBORw0KGgo=]')
    })
  })

  it.skip('must be able to preserve video urls', () => {
    expect(
      html2text(
        '<body><video><source src="https://example.com/video.mp4" /></video></body>'
      )
    ).toEqual('video [https://example.com/video.mp4]')
  })

  // @note we have turn off this because it could be causing issues

  it.skip('must correctly skip footer classes', () => {
    expect(
      html2text(
        '<body><div class="footer">footer</div><main>main</main><footer>footer</footer></body>'
      )
    ).toEqual('main')
  })

  it('test harness 001', () => {
    const html = `<body><p>Launched in 2023, <a href='/us/mcluck-social-casino' class='' target='' >McLuck</a> is a new sweeps cash casino that has taken the US by storm.</p></body>`

    const expected = `Launched in 2023, McLuck [https://casinos.com/us/mcluck-social-casino] is a new sweeps cash casino that has taken the US by storm.`

    const result = html2text(html, {
      url: 'https://casinos.com/',
    })

    expect(result).toEqual(expected)
  })
})

describe('validateSelectors', () => {
  it('must correctly validate selectors', () => {
    expect(validateSelectors('html, body')).toEqual({ valid: true })
    expect(validateSelectors('html, body, jsonl')).toEqual({ valid: true })
    expect(validateSelectors('body div')).toEqual({
      valid: false,
      message: 'Unsupported selector kind: combinator',
    })
  })
})
