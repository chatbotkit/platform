import { compile } from 'html-to-text'

export const DEFAULT_SELECTORS = ['article', 'main', 'body']

export function html2text(
  html: string,
  options?: {
    url?: string
    selectors?: string | string[]
    includeDataUrls?: boolean
  }
): string {
  const { url, selectors, includeDataUrls = false } = options || {}

  let preferredSelectors: string[] = []

  // add the selectors
  {
    let theseSelectors

    if (typeof selectors === 'string') {
      theseSelectors = selectors
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i)
    } else if (Array.isArray(selectors)) {
      theseSelectors = selectors
    }

    theseSelectors = theseSelectors
      ?.map((selector) => selector.trim())
      .filter(Boolean)
      .filter((selector) => !selector.startsWith('@'))

    if (theseSelectors && theseSelectors.length) {
      preferredSelectors.unshift(...theseSelectors)
    } else {
      preferredSelectors.unshift(...DEFAULT_SELECTORS)
    }
  }

  // normalize selectors
  {
    preferredSelectors = Array.from(
      new Set(
        preferredSelectors.map((selector) => selector.trim()).filter(Boolean)
      )
    )
  }

  // skip helper

  function getSkipTagSelectorFor(
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValue?: any
  ): {
    selector: string
    format: 'skip'
  }[] {
    return selectors?.includes(`@skiptag-${type}`)
      ? [{ selector: type, format: 'skip' }]
      : defaultValue
      ? [defaultValue]
      : []
  }

  // convert

  const convert = compile({
    wordwrap: false,

    baseElements: {
      selectors: preferredSelectors,

      returnDomByDefault: false,
    },

    selectors: [
      // data urls
      ...(includeDataUrls
        ? []
        : [
            { selector: '[href^="data:"]', format: 'skip' },
            { selector: '[src^="data:"]', format: 'skip' },
          ]),
      // links
      ...getSkipTagSelectorFor('a', {
        selector: 'a',
        options: {
          ignoreHref: false,
          noAnchorUrl: true,
          hideLinkHrefIfSameAsText: true,
          baseUrl: url,
        },
      }),
      // media
      ...getSkipTagSelectorFor('img'),
      ...getSkipTagSelectorFor('audio'),
      ...getSkipTagSelectorFor('video'),
      { selector: 'object', format: 'skip' },
      { selector: 'canvas', format: 'skip' },
      // visual
      ...getSkipTagSelectorFor('hr'),
      // navigation
      { selector: 'nav', format: 'skip' },
      { selector: 'header', format: 'skip' },
      { selector: 'footer', format: 'skip' },
      // roles
      { selector: '[role="alert"]', format: 'skip' },
      { selector: '[role="alertdialog"]', format: 'skip' },
      { selector: '[role="application"]', format: 'skip' },
      { selector: '[role="banner"]', format: 'skip' },
      { selector: '[role="button"]', format: 'skip' },
      { selector: '[role="checkbox"]', format: 'skip' },
      { selector: '[role="combobox"]', format: 'skip' },
      { selector: '[role="command"]', format: 'skip' },
      { selector: '[role="dialog"]', format: 'skip' },
      { selector: '[role="form"]', format: 'skip' },
      { selector: '[role="input"]', format: 'skip' },
      { selector: '[role="menu"]', format: 'skip' },
      { selector: '[role="navigation"]', format: 'skip' },
      { selector: '[role="radio"]', format: 'skip' },
      { selector: '[role="radiogroup"]', format: 'skip' },
      { selector: '[role="range"]', format: 'skip' },
      { selector: '[role="scrollbar"]', format: 'skip' },
      { selector: '[role="search"]', format: 'skip' },
      { selector: '[role="searchbox"]', format: 'skip' },
      { selector: '[role="slider"]', format: 'skip' },
      { selector: '[role="spinbutton"]', format: 'skip' },
      { selector: '[role="status"]', format: 'skip' },
      { selector: '[role="suggestion"]', format: 'skip' },
      { selector: '[role="switch"]', format: 'skip' },
      // @note disabled because these could be useful content
      // { selector: '[role="tab"]', format: 'skip' },
      // { selector: '[role="tabpanel"]', format: 'skip' },
      { selector: '[role="textbox"]', format: 'skip' },
      { selector: '[role="timer"]', format: 'skip' },
      { selector: '[role="toolbar"]', format: 'skip' },
      { selector: '[role="tooltip"]', format: 'skip' },
      { selector: '[role="widget"]', format: 'skip' },
      // interaction
      { selector: 'form', format: 'skip' },
      { selector: 'button', format: 'skip' },
      { selector: 'input', format: 'skip' },
      { selector: 'textarea', format: 'skip' },
      { selector: 'dialog', format: 'skip' },
      // frames
      { selector: 'iframe', format: 'skip' },
      { selector: 'frame', format: 'skip' },
      { selector: 'frameset', format: 'skip' },
      // functional
      { selector: 'meta', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'noscript', format: 'skip' },
      // other
      // @note disabled because these are sometimes causing issues
      // @todo perhaps we should first try with these and if empty response try without them
      // { selector: '[class*="header"]', format: 'skip' },
      // { selector: '[class*="footer"]', format: 'skip' },
      // { selector: '[class*="menu"]', format: 'skip' },
      // { selector: '[class*="breadcrumbs"]', format: 'skip' },
    ],
  })

  let text = convert(html)

  // remove double new lines

  text = text.replace(/\n+/g, '\n')

  // remove double spaces

  text = text.replace(/\s+/g, ' ')

  return text
}

export function stripHtml(html: string): string {
  return html2text(`<main>${html}</main>`, { selectors: ['main'] })
}

export function validateSelectors(selectors: string | string[]): {
  valid: boolean
  message?: string
} {
  try {
    html2text('<body></body>', { selectors })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)

    return { valid: false, message: errorMessage.trim() }
  }

  return { valid: true }
}
