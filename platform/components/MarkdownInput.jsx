'use client'

import { useEffect, useMemo, useRef } from 'react'

import TextareaHighlighter from '@/components/TextareaHighlighter'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'

import useControllableInput from '@/hooks/useControllableInput'
import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'
import useTabIndent from '@/hooks/useTabIndent'

import clsx from 'clsx'

/**
 * Markdown syntax patterns for the highlighter overlay. Each regex has exactly
 * one named capture group; the highlighter worker turns it into a
 * `<mark class="<group>">` span (the first regex to match a fragment wins, so
 * order from most specific / whole-line to inline).
 *
 * @note markers may only recolor / add a background - never change font weight
 * or size - because the overlay must stay glyph-aligned with the monospace
 * textarea above it.
 */
const MARKDOWN_KEYWORDS = [
  // headings: # .. ######
  /^(?<heading>#{1,6}\s.*)$/gim,
  // blockquotes: > quoted
  /^(?<blockquote>\s*>\s.*)$/gim,
  // horizontal rules: --- *** ___
  /^(?<hr>\s*(?:-{3,}|\*{3,}|_{3,})\s*)$/gim,
  // task checkboxes: - [ ] / - [x]
  /^\s*(?:[-*+])\s+(?<checkbox>\[[ xX]\])/gim,
  // inline code: `code`
  /(?<code>`[^`\n]+`)/g,
  // links: [text](url)
  /(?<link>\[[^\]\n]+\]\([^)\n]+\))/gi,
]

/**
 * A lightweight markdown editor: a monospace textarea with a live
 * syntax-highlight overlay and tab-to-indent, plus a token count. It is the
 * clean core of `BackstoryInput` without the prompt-specific extras (magic,
 * zoom, fields, quick-edit, widget functions).
 *
 * Controlled (`value` + `setValue`/`onChange`) or uncontrolled (`defaultValue`).
 * Extra props (placeholder, name, disabled, rows, ...) pass through to the
 * textarea.
 */
export default function MarkdownInput({
  defaultValue = '',
  value: _value,
  setValue: _setValue,
  onChange: _onChange,

  className,
  wrapperClassName,
  containerClassName,

  disabled = false,

  children,

  ...props
}) {
  const containerRef = useRef()

  const [value, onChange] = useControllableInput({
    defaultValue,
    value: _value,
    setValue: _setValue,
    onChange: _onChange,
  })

  const [textarea] = useDOMQuerySelector(':scope .markdown-input-textarea', {
    parent: containerRef.current,
    waitForElements: true,
  })

  const { handleKeyDown, selection } = useTabIndent(onChange)

  useEffect(() => {
    if (!textarea) {
      return
    }

    textarea.selectionStart = selection.start
    textarea.selectionEnd = selection.end
  }, [selection, textarea])

  const keywords = useMemo(() => MARKDOWN_KEYWORDS, [])

  return (
    <div
      // `isolate` keeps the internal z-10/z-20 overlay layering to itself so it
      // never stacks above app menus / dropdowns outside the component.
      className={clsx('relative isolate', containerClassName)}
      ref={containerRef}
    >
      <TextareaHighlighter
        key="markdown-highlighter"
        className={clsx(
          'markdown-highlighter',
          'z-10', // behind the textarea
          'auto-text-black', // base text colour (mirrors BackstoryInput)
          // @note colour / background only - no font-weight or size changes,
          // or the overlay drifts out of alignment with the textarea. Palette
          // mirrors BackstoryInput: muted gray for structure, green for checks.
          // A bare <mark> defaults to a yellow highlight - reset it so marks
          // that only recolour text (blockquote, link) don't leak yellow.
          '[&_mark]:bg-transparent',
          '[&_mark.heading]:auto-bg-gray-100 [&_mark.heading]:auto-text-gray-600',
          '[&_mark.blockquote]:auto-text-gray-500',
          '[&_mark.hr]:auto-bg-gray-100 [&_mark.hr]:auto-text-gray-500',
          '[&_mark.checkbox]:text-green-600 dark:[&_mark.checkbox]:text-green-500',
          '[&_mark.code]:auto-bg-gray-100 [&_mark.code]:auto-text-black',
          '[&_mark.link]:auto-text-gray-600 [&_mark.link]:underline'
        )}
        keywords={keywords}
        textarea={textarea}
        value={value}
        top={false}
      />
      <TokenAutoTextarea
        key="markdown-textarea"
        spellCheck={false}
        hideZero={true}
        {...props}
        className={clsx(
          'markdown-input-textarea',
          'font-mono',
          '!text-transparent !bg-transparent caret-black dark:caret-white',
          // borderless by design - the highlighter overlay sits behind, a border
          // would frame nothing. Strip the native textarea border + focus ring.
          '!border-0 !outline-none !shadow-none !ring-0 focus:!outline-none focus:!ring-0',
          'relative z-20', // above the highlighter
          className
        )}
        wrapperClassName={wrapperClassName}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        {children}
      </TokenAutoTextarea>
    </div>
  )
}
