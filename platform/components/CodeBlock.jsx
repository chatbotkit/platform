'use client'

import { memo, useEffect, useLayoutEffect, useState } from 'react'
import { MdCopyAll } from 'react-icons/md'

import { ShikiStreamHighlighter, getHighlighter } from '@/lib/highlighter'
import toast from '@/lib/toast'

import NoSsr from '@/components/NoSsr'

import useTheme from '@/hooks/useTheme'

import clsx from 'clsx'

function resolveLanguage(language, children) {
  if (language === 'plain') {
    switch (true) {
      case children?.startsWith?.('GET'):
      case children?.startsWith?.('POST'):
      case children?.startsWith?.('PUT'):
      case children?.startsWith?.('DELETE'):
      case children?.startsWith?.('HTTP/1.1'):
        return 'http'
    }
  }

  return language
}

export function CodeBlockInternal({
  className,

  language,

  copy = true,

  showLineNumbers = false,

  actions,

  children,
}) {
  const { theme } = useTheme()

  const [html, setHtml] = useState('')

  const [streamer, setStreamer] = useState(null)

  const resolvedLanguage = resolveLanguage(language, children)

  const lang = resolvedLanguage || 'text'

  // Async one-time setup per language/theme: loads the highlighter and
  // language grammar then creates the ShikiStreamHighlighter. Subsequent
  // content updates are handled synchronously in useLayoutEffect below.

  // @note we deliberately do NOT reset `streamer`/`html` here. Clearing them
  // dropped the rendered block back to the unstyled plain-text fallback on
  // every re-run of this effect (e.g. a theme change, or a re-mount of the
  // surrounding markdown), which read as a constant "refreshing" flicker. The
  // previously highlighted output stays on screen until the replacement
  // highlighter produces new HTML in the layout effect below.

  useEffect(() => {
    let cancelled = false

    async function setup() {
      const highlighter = await getHighlighter()

      if (cancelled) {
        return
      }

      if (!highlighter.getLoadedLanguages().includes(lang)) {
        try {
          await highlighter.loadLanguage(lang)
        } catch {
          // @note fall back to plain text if the language grammar is unavailable
        }
      }

      if (cancelled) {
        return
      }

      const loadedLang = highlighter.getLoadedLanguages().includes(lang)
        ? lang
        : 'text'

      setStreamer(
        new ShikiStreamHighlighter(highlighter, {
          lang: loadedLang,
          theme: theme || 'light',
        })
      )
    }

    setup()

    return () => {
      cancelled = true
    }
  }, [lang, theme])

  // Synchronous highlight before the browser paints so every streamed token
  // produces immediately highlighted output with no visible plain-text frame.

  useLayoutEffect(() => {
    if (!streamer || !children) {
      setHtml('')

      return
    }

    setHtml(streamer.update(children))
  }, [children, streamer])

  async function handleCopy() {
    try {
      await window.navigator?.clipboard?.writeText(children)

      toast.success('Code copied to your clipboard')
    } catch {
      // @note clipboard API may be blocked by permissions policy

      toast.error('Failed to copy code to clipboard')
    }
  }

  return (
    <div
      className={clsx(
        'codeblock',

        showLineNumbers && 'with-line-numbers',

        'relative',
        'rounded-xl overflow-hidden',
        'not-prose',
        'flex flex-col',

        className
      )}
    >
      <div
        className={clsx(
          'flex-1 overflow-auto auto-bg-gray-50 subtle-scrollbar',
          '[&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:!bg-inherit [&_.line]:whitespace-pre-wrap [&_.line]:break-words'
        )}
      >
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="p-4 text-gray-300 !m-0">
            <code>{children}</code>
          </pre>
        )}
      </div>
      <div className="absolute top-2 right-2 flex flex-row gap-2">
        {actions}
        {copy ? (
          <MdCopyAll
            className="cursor-pointer rounded-xl auto-text-gray-400 hover:auto-text-gray-800 w-4 h-4 transition-all"
            onClick={handleCopy}
          />
        ) : null}
      </div>
    </div>
  )
}

// @note memoized because the markdown renderer re-parses the whole document and
// rebuilds the entire element tree on every render. While a reply streams in,
// that is once per token, so an untouched code block earlier in the message
// would re-render for every token appended after it. Every prop that reaches
// here is value-comparable (`language`/`children`/`className` are strings), so
// a shallow compare reliably short-circuits blocks whose source has not moved.
export default memo(function CodeBlock(props) {
  return (
    <NoSsr>
      <CodeBlockInternal {...props} />
    </NoSsr>
  )
})
