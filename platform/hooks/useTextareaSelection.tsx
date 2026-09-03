import { useCallback, useEffect, useState } from 'react'

type ClientRect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
  x: number
  y: number
}

type TextareaSelectionState = {
  clientRect?: ClientRect
  textContent?: string
  selectionStart?: number
  selectionEnd?: number
  isCollapsed?: boolean
}

const defaultState: TextareaSelectionState = {}

/**
 * Hook to track text selection in a textarea element.
 *
 * @note Unlike useTextSelection which tracks DOM selection, this hook
 * specifically handles textarea selection using selectionStart/selectionEnd.
 *
 * @param textarea - The textarea element to track selection in
 * @returns The current selection state including text content and position
 */
export default function useTextareaSelection(
  textarea?: HTMLTextAreaElement | null
) {
  const [selectionState, setSelectionState] =
    useState<TextareaSelectionState>(defaultState)

  const getSelectionRect = useCallback(
    (
      textarea: HTMLTextAreaElement,
      selectionStart: number,
      selectionEnd: number
    ): ClientRect | undefined => {
      // @note create a hidden mirror element to calculate selection position
      // this is necessary because textarea selection doesn't expose clientRect

      const mirror = document.createElement('div')

      const textareaStyle = window.getComputedStyle(textarea)

      // @note copy essential styles to mirror for accurate positioning
      const stylesToCopy = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'letterSpacing',
        'lineHeight',
        'textTransform',
        'wordSpacing',
        'textIndent',
        'whiteSpace',
        'wordWrap',
        'overflowWrap',
        'padding',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'borderWidth',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'boxSizing',
        'width',
      ]

      for (const style of stylesToCopy) {
        mirror.style.setProperty(
          style.replace(/([A-Z])/g, '-$1').toLowerCase(),
          textareaStyle.getPropertyValue(
            style.replace(/([A-Z])/g, '-$1').toLowerCase()
          )
        )
      }

      mirror.style.position = 'absolute'
      mirror.style.visibility = 'hidden'
      mirror.style.whiteSpace = 'pre-wrap'
      mirror.style.wordWrap = 'break-word'
      mirror.style.overflow = 'hidden'
      mirror.style.height = 'auto'

      const text = textarea.value
      const beforeText = text.substring(0, selectionStart)
      const selectedText = text.substring(selectionStart, selectionEnd)

      // @note create span elements to locate the selection position
      const beforeSpan = document.createElement('span')

      beforeSpan.textContent = beforeText

      const selectionSpan = document.createElement('span')

      selectionSpan.textContent = selectedText || '\u00a0' // use non-breaking space if empty

      mirror.appendChild(beforeSpan)
      mirror.appendChild(selectionSpan)

      document.body.appendChild(mirror)

      const textareaRect = textarea.getBoundingClientRect()
      const selectionRect = selectionSpan.getBoundingClientRect()
      const mirrorRect = mirror.getBoundingClientRect()

      // @note calculate the actual position accounting for scroll offset
      const scrollTop = textarea.scrollTop
      const scrollLeft = textarea.scrollLeft

      const top =
        textareaRect.top + (selectionRect.top - mirrorRect.top) - scrollTop
      const left =
        textareaRect.left + (selectionRect.left - mirrorRect.left) - scrollLeft
      const width = selectionRect.width
      const height = selectionRect.height

      document.body.removeChild(mirror)

      return {
        top: Math.round(top),
        left: Math.round(left),
        right: Math.round(left + width),
        bottom: Math.round(top + height),
        width: Math.round(width),
        height: Math.round(height),
        x: Math.round(left),
        y: Math.round(top),
      }
    },
    []
  )

  const handleSelectionChange = useCallback(() => {
    if (!textarea) {
      setSelectionState(defaultState)

      return
    }

    const { selectionStart, selectionEnd, value } = textarea

    // @note check if there's no selection or cursor is just placed (collapsed)
    const isCollapsed = selectionStart === selectionEnd
    const selectedText = value.substring(selectionStart, selectionEnd)

    if (isCollapsed || !selectedText) {
      setSelectionState({
        selectionStart,
        selectionEnd,
        isCollapsed: true,
        textContent: '',
      })

      return
    }

    const clientRect = getSelectionRect(textarea, selectionStart, selectionEnd)

    setSelectionState({
      clientRect,
      textContent: selectedText,
      selectionStart,
      selectionEnd,
      isCollapsed: false,
    })
  }, [textarea, getSelectionRect])

  useEffect(() => {
    if (!textarea) {
      return
    }

    // @note listen to various events that might change selection
    textarea.addEventListener('select', handleSelectionChange)
    textarea.addEventListener('mouseup', handleSelectionChange)
    textarea.addEventListener('keyup', handleSelectionChange)
    textarea.addEventListener('focus', handleSelectionChange)
    textarea.addEventListener('blur', handleSelectionChange)

    // @note also listen to document selection change for better coverage
    document.addEventListener('selectionchange', handleSelectionChange)

    // @note window resize can change selection coordinates
    window.addEventListener('resize', handleSelectionChange)

    // @note initial check
    handleSelectionChange()

    return () => {
      textarea.removeEventListener('select', handleSelectionChange)
      textarea.removeEventListener('mouseup', handleSelectionChange)
      textarea.removeEventListener('keyup', handleSelectionChange)
      textarea.removeEventListener('focus', handleSelectionChange)
      textarea.removeEventListener('blur', handleSelectionChange)

      document.removeEventListener('selectionchange', handleSelectionChange)

      window.removeEventListener('resize', handleSelectionChange)
    }
  }, [textarea, handleSelectionChange])

  return {
    clientRect: selectionState.clientRect,
    textContent: selectionState.textContent,
    selectionStart: selectionState.selectionStart,
    selectionEnd: selectionState.selectionEnd,
    isCollapsed: selectionState.isCollapsed,
  }
}
