/* eslint-disable @typescript-eslint/no-require-imports */
import { ShikiStreamHighlighter, highlight } from './highlighter'

describe('getHighlighter', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('creates and memoizes a single highlighter instance', async () => {
    const mockHighlighter = { codeToHtml: jest.fn() }
    const createHighlighter = jest.fn().mockResolvedValue(mockHighlighter)

    jest.doMock('shiki', () => ({ createHighlighter }))

    const { getHighlighter: getTestHighlighter } = require('./highlighter')

    const first = getTestHighlighter()
    const second = getTestHighlighter()

    expect(first).toBe(second)
    await expect(first).resolves.toBe(mockHighlighter)
    expect(createHighlighter).toHaveBeenCalledTimes(1)
    expect(createHighlighter).toHaveBeenCalledWith({
      themes: [expect.anything(), expect.anything()],
      langs: [],
    })
  })
})

describe('highlight', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses provided language when already loaded and light theme mapping', async () => {
    const highlighter = {
      getLoadedLanguages: jest.fn(() => ['javascript']),
      loadLanguage: jest.fn(),
      codeToHtml: jest.fn(
        () =>
          '<pre class="shiki" style="background-color:#fff"><code>console.log(1)</code></pre>'
      ),
    }

    const html = await highlight({
      highlighter,
      code: 'console.log(1)',
      lang: 'javascript',
      theme: 'light',
    })

    expect(highlighter.loadLanguage).not.toHaveBeenCalled()
    expect(highlighter.codeToHtml).toHaveBeenCalledWith('console.log(1)', {
      lang: 'javascript',
      theme: 'github-light',
    })
    expect(html).toMatch(
      /<pre class="shiki"\s*><code>console\.log\(1\)<\/code><\/pre>/
    )
    expect(html).not.toContain('style=')
  })

  it('falls back to text language when language loading fails', async () => {
    const highlighter = {
      getLoadedLanguages: jest.fn(() => []),
      loadLanguage: jest.fn().mockRejectedValue(new Error('unsupported')),
      codeToHtml: jest.fn(
        () => '<pre style="background-color:#000"><code>x</code></pre>'
      ),
    }

    await highlight({
      highlighter,
      code: 'x',
      lang: 'unknown-lang',
    })

    expect(highlighter.loadLanguage).toHaveBeenCalledWith('unknown-lang')
    expect(highlighter.codeToHtml).toHaveBeenCalledWith('x', {
      lang: 'text',
      theme: 'github-dark',
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToken(content, color, fontStyle) {
  const token = { content, offset: 0 }

  if (color !== undefined) {
    token.color = color
  }

  if (fontStyle !== undefined) {
    token.fontStyle = fontStyle
  }

  return token
}

function makeHighlighter(perLineTokens) {
  // perLineTokens: array of arrays of ThemedToken, one inner array per call
  let call = 0

  return {
    codeToTokens: jest.fn((code, options) => {
      const tokens = perLineTokens[call] ?? [[makeToken(code, '#fff')]]
      const grammarState = { state: call }

      call += 1

      return { tokens, grammarState }
    }),
  }
}

// ---------------------------------------------------------------------------
// ShikiStreamHighlighter
// ---------------------------------------------------------------------------

describe('ShikiStreamHighlighter', () => {
  describe('output shape', () => {
    it('wraps output in a pre.shiki element with the theme class', () => {
      const h = makeHighlighter([[[makeToken('x', '#fff')]]])
      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      const html = streamer.update('x')

      expect(html).toMatch(/^<pre class="shiki github-dark">/)
      expect(html).toContain('<code>')
      expect(html).toContain('<span class="line">')
    })

    it('uses github-light theme class for light theme', () => {
      const h = makeHighlighter([[[makeToken('x', '#000')]]])
      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'light',
      })

      expect(streamer.update('x')).toMatch(/shiki github-light/)
    })

    it('strips any inline style attribute from the pre tag itself', () => {
      const h = {
        codeToTokens: jest.fn(() => ({
          tokens: [[makeToken('x', '#fff')]],
          grammarState: {},
        })),
      }

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      expect(streamer.update('x')).not.toMatch(/<pre[^>]*\bstyle=/)
    })
  })

  describe('stable-line caching', () => {
    it('tokenizes completed lines exactly once across multiple updates', () => {
      const h = makeHighlighter([
        [[makeToken('line1', '#fff')]],
        [[makeToken('line2', '#fff')]],
        [[makeToken('partial', '#fff')]],
        [[makeToken('partial more', '#fff')]],
      ])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'js',
        theme: 'dark',
      })

      // First update: "line1\npartial" - line1 is stable, partial is unstable
      streamer.update('line1\npartial')

      expect(h.codeToTokens).toHaveBeenCalledTimes(2)
      expect(h.codeToTokens).toHaveBeenNthCalledWith(
        1,
        'line1',
        expect.anything()
      )
      expect(h.codeToTokens).toHaveBeenNthCalledWith(
        2,
        'partial',
        expect.anything()
      )

      h.codeToTokens.mockClear()

      // Second update: "line1\npartial more" - line1 still cached, only unstable re-tokenized
      streamer.update('line1\npartial more')

      expect(h.codeToTokens).toHaveBeenCalledTimes(1)
      expect(h.codeToTokens).toHaveBeenCalledWith(
        'partial more',
        expect.anything()
      )
    })

    it('tokenizes new stable lines as they complete', () => {
      const h = makeHighlighter([
        [[makeToken('a', '#fff')]],
        [[makeToken('b_partial', '#fff')]],
        [[makeToken('b', '#fff')]],
        [[makeToken('c_partial', '#fff')]],
      ])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'js',
        theme: 'dark',
      })

      streamer.update('a\nb_partial')

      h.codeToTokens.mockClear()

      // b is now complete, c_partial is the new unstable line
      streamer.update('a\nb\nc_partial')

      // Only 'b' (newly stable) and 'c_partial' (unstable) should be tokenized
      expect(h.codeToTokens).toHaveBeenCalledTimes(2)
      expect(h.codeToTokens).toHaveBeenNthCalledWith(1, 'b', expect.anything())
      expect(h.codeToTokens).toHaveBeenNthCalledWith(
        2,
        'c_partial',
        expect.anything()
      )
    })
  })

  describe('grammar state threading', () => {
    it('passes the previous line grammar state to the next line', () => {
      const grammarState0 = { state: 'initial' }
      const grammarState1 = { state: 'after-line1' }

      let call = 0
      const codeToTokens = jest.fn(() => {
        const gs = call === 0 ? grammarState1 : { state: 'after-line2' }

        call += 1

        return { tokens: [[makeToken('x', '#fff')]], grammarState: gs }
      })

      const streamer = new ShikiStreamHighlighter(
        { codeToTokens },
        { lang: 'js', theme: 'dark' }
      )

      streamer.update('line1\npartial')

      expect(codeToTokens).toHaveBeenNthCalledWith(
        1,
        'line1',
        expect.objectContaining({ grammarState: undefined })
      )
      expect(codeToTokens).toHaveBeenNthCalledWith(
        2,
        'partial',
        expect.objectContaining({ grammarState: grammarState1 })
      )
    })
  })

  describe('diverge and invalidate', () => {
    it('re-tokenizes from the divergence point when a preceding line changes', () => {
      const h = makeHighlighter([
        [[makeToken('original', '#fff')]],
        [[makeToken('unstable', '#fff')]],
        [[makeToken('changed', '#fff')]],
        [[makeToken('unstable2', '#fff')]],
      ])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'js',
        theme: 'dark',
      })

      streamer.update('original\nunstable')

      h.codeToTokens.mockClear()

      // The first stable line changed - full re-tokenize from the beginning
      streamer.update('changed\nunstable2')

      expect(h.codeToTokens).toHaveBeenCalledTimes(2)
      expect(h.codeToTokens).toHaveBeenNthCalledWith(
        1,
        'changed',
        expect.anything()
      )
    })
  })

  describe('reset', () => {
    it('clears cached stable lines so the next update re-tokenizes everything', () => {
      const h = makeHighlighter([
        [[makeToken('a', '#fff')]],
        [[makeToken('partial', '#fff')]],
        [[makeToken('a', '#fff')]],
        [[makeToken('partial', '#fff')]],
      ])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'js',
        theme: 'dark',
      })

      streamer.update('a\npartial')

      h.codeToTokens.mockClear()

      streamer.reset()
      streamer.update('a\npartial')

      // Both lines re-tokenized after reset
      expect(h.codeToTokens).toHaveBeenCalledTimes(2)
    })
  })

  describe('HTML rendering', () => {
    it('escapes < > & in code content', () => {
      const h = makeHighlighter([[[makeToken('<script>&</script>', '#fff')]]])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      const html = streamer.update('<script>&</script>')

      expect(html).toContain('&lt;script&gt;&amp;&lt;/script&gt;')
      expect(html).not.toContain('<script>')
    })

    it('renders italic font style', () => {
      const h = makeHighlighter([[[makeToken('em', '#fff', 1 /* italic */)]]])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      expect(streamer.update('em')).toContain('font-style:italic')
    })

    it('renders bold font style', () => {
      const h = makeHighlighter([[[makeToken('strong', '#fff', 2 /* bold */)]]])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      expect(streamer.update('strong')).toContain('font-weight:bold')
    })

    it('renders underline font style', () => {
      const h = makeHighlighter([[[makeToken('u', '#fff', 4 /* underline */)]]])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      expect(streamer.update('u')).toContain('text-decoration:underline')
    })

    it('renders tokens without color as plain escaped text', () => {
      const h = makeHighlighter([[[makeToken('plain text', undefined)]]])

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      const html = streamer.update('plain text')

      expect(html).toContain('plain text')
      expect(html).not.toContain('<span style=')
    })

    it('renders multi-line code with one span.line per line', () => {
      const h = {
        codeToTokens: jest
          .fn()
          .mockReturnValueOnce({
            tokens: [[makeToken('line1', '#fff')]],
            grammarState: {},
          })
          .mockReturnValueOnce({
            tokens: [[makeToken('line2', '#fff')]],
            grammarState: {},
          }),
      }

      const streamer = new ShikiStreamHighlighter(h, {
        lang: 'text',
        theme: 'dark',
      })

      const html = streamer.update('line1\nline2')

      const matches = html.match(/<span class="line">/g)

      expect(matches).toHaveLength(2)
    })
  })
})
