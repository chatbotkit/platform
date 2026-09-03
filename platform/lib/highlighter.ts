import type { HighlighterGeneric } from 'shiki'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'

// --- static highlight ---

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | null =
  null

export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: [githubDark, githubLight],
        langs: [],
      })
    )
  }

  return highlighterPromise
}

export async function highlight({
  highlighter,
  code,
  lang,
  theme = 'dark',
}: {
  highlighter: HighlighterGeneric<string, string>
  code: string
  lang: string
  theme?: 'light' | 'dark'
}) {
  const loadedLangs = highlighter.getLoadedLanguages()

  if (!loadedLangs.includes(lang)) {
    try {
      await highlighter.loadLanguage(lang)
    } catch {
      lang = 'text'
    }
  }

  const html = highlighter.codeToHtml(code, {
    lang,
    theme: theme === 'light' ? 'github-light' : 'github-dark',
  })

  // @note strip shiki's inline background-color so our own CSS classes control the background
  return html.replace(/(<pre[^>]*)\s*style="[^"]*"/, '$1')
}

// --- streaming highlight ---

// @note types are derived from the highlighter instance rather than imported
// from @shikijs/core which is not a direct dependency

type HighlighterInstance = HighlighterGeneric<string, string>

type GrammarState = NonNullable<
  ReturnType<HighlighterInstance['codeToTokens']>['grammarState']
>

type ThemedToken = ReturnType<
  HighlighterInstance['codeToTokens']
>['tokens'][number][number]

interface StableLine {
  code: string
  tokens: ThemedToken[]
  html: string
  grammarState: GrammarState
}

// --- streaming highlight / internal ---

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderToken(token: ThemedToken): string {
  if (!token.color) {
    return escapeHtml(token.content)
  }

  let style = `color:${token.color}`

  if (token.fontStyle) {
    if (token.fontStyle & 1) {
      style += ';font-style:italic'
    }

    if (token.fontStyle & 2) {
      style += ';font-weight:bold'
    }

    if (token.fontStyle & 4) {
      style += ';text-decoration:underline'
    }
  }

  return `<span style="${style}">${escapeHtml(token.content)}</span>`
}

function renderLine(tokens: ThemedToken[]): string {
  return `<span class="line">${tokens.map(renderToken).join('')}</span>`
}

function renderToHtml(lineHtmls: string[], themeName: string): string {
  return `<pre class="shiki ${themeName}"><code>${lineHtmls.join('\n')}</code></pre>`
}

// --- streaming highlight / public ---

/**
 * Incrementally highlights streaming code by caching completed lines.
 *
 * Only the last (incomplete) line is re-tokenized on each update. All
 * previously completed lines are processed exactly once because shiki's
 * grammar state is threaded through so each line inherits the correct token
 * context from the line before it.
 *
 * Synchronous after construction - intended for use with React's
 * useLayoutEffect so updates appear before the browser paints.
 */
export class ShikiStreamHighlighter {
  private readonly highlighter: HighlighterGeneric<string, string>
  private readonly lang: string
  private readonly themeName: string
  private stableLines: StableLine[] = []

  constructor(
    highlighter: HighlighterGeneric<string, string>,
    options: { lang: string; theme: 'light' | 'dark' }
  ) {
    this.highlighter = highlighter
    this.lang = options.lang
    this.themeName = options.theme === 'light' ? 'github-light' : 'github-dark'
  }

  /**
   * Accepts the full accumulated code string and returns highlighted HTML.
   *
   * All lines except the last are considered stable - they are tokenized once
   * and cached. The last line is always re-tokenized since more tokens may
   * still arrive.
   */
  update(fullCode: string): string {
    const lines = fullCode.split('\n')
    const stableLineCode = lines.slice(0, -1)
    const unstableLineCode = lines[lines.length - 1]

    const limit = Math.min(this.stableLines.length, stableLineCode.length)

    let divergeAt = limit

    for (let i = 0; i < limit; i++) {
      if (this.stableLines[i].code !== stableLineCode[i]) {
        divergeAt = i

        break
      }
    }

    if (divergeAt < this.stableLines.length) {
      this.stableLines.length = divergeAt
    }

    let grammarState: GrammarState | undefined =
      divergeAt > 0 ? this.stableLines[divergeAt - 1].grammarState : undefined

    for (let i = divergeAt; i < stableLineCode.length; i++) {
      const result = this.tokenizeLine(stableLineCode[i], grammarState)

      grammarState = result.grammarState

      const tokens = result.tokens[0] ?? []

      this.stableLines.push({
        code: stableLineCode[i],
        tokens,
        html: renderLine(tokens),
        grammarState,
      })
    }

    const unstableResult = this.tokenizeLine(unstableLineCode, grammarState)
    const unstableTokens = unstableResult.tokens[0] ?? []

    const lineHtmls = this.stableLines.map((l) => l.html)

    lineHtmls.push(renderLine(unstableTokens))

    return renderToHtml(lineHtmls, this.themeName)
  }

  private tokenizeLine(code: string, grammarState: GrammarState | undefined) {
    const result = this.highlighter.codeToTokens(code, {
      lang: this.lang,
      theme: this.themeName,
      grammarState,
    })

    return { tokens: result.tokens, grammarState: result.grammarState! }
  }

  reset(): void {
    this.stableLines = []
  }
}
