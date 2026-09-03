import { useCallback, useLayoutEffect, useState } from 'react'

type ClientRect = Record<keyof Omit<DOMRect, 'toJSON'>, number>

function roundValues(rect: ClientRect): ClientRect {
  const roundedRect = { ...rect }

  // @note rounding prevents subpixel differences that cause unnecessary
  // re-renders

  for (const key of Object.keys(roundedRect) as Array<keyof ClientRect>) {
    roundedRect[key] = Math.round(roundedRect[key])
  }

  return roundedRect
}

function shallowDiff(
  prev: ClientRect | undefined,
  next: ClientRect | undefined
): boolean {
  if (prev != null && next != null) {
    for (const key of Object.keys(next) as Array<keyof ClientRect>) {
      if (prev[key] !== next[key]) {
        return true
      }
    }

    return false
  }

  return prev !== next
}

type TextSelectionState = {
  clientRect?: ClientRect
  isCollapsed?: boolean
  textContent?: string
}

const defaultState: TextSelectionState = {}

export default function useTextSelection(target?: HTMLElement | string) {
  const [selectionState, setSelectionState] =
    useState<TextSelectionState>(defaultState)

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()

    if (!selection?.rangeCount) {
      setSelectionState(defaultState)

      return
    }

    const range = selection.getRangeAt(0)

    const thisTarget =
      typeof target === 'string'
        ? Array.from(document.querySelectorAll(target))
        : target
        ? [target]
        : []

    // @note check if selection is within the target element before proceeding

    if (
      target &&
      !thisTarget.some(
        (t) =>
          t.contains(range.commonAncestorContainer) ||
          t === range.commonAncestorContainer
      )
    ) {
      setSelectionState(defaultState)

      return
    }

    // @note for targeted selections, double-check that both start and end
    // containers are within target

    if (target) {
      const startContainer = range.startContainer
      const endContainer = range.endContainer

      const startInTarget = thisTarget.some(
        (t) => t.contains(startContainer) || t === startContainer
      )
      const endInTarget = thisTarget.some(
        (t) => t.contains(endContainer) || t === endContainer
      )

      if (!startInTarget || !endInTarget) {
        setSelectionState(defaultState)

        return
      }
    }

    const newState: TextSelectionState = {}

    // @note cloning contents prevents mutation of the actual selection

    const contents = range.cloneContents()

    if (contents.textContent) {
      newState.textContent = contents.textContent
    }

    // @note getClientRects can return empty for collapsed selections

    const rects = range.getClientRects()

    let newRect: ClientRect

    if (rects.length === 0 && range.commonAncestorContainer) {
      // @note fallback to common ancestor bounds when no client rects available

      const element =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement)
          : range.commonAncestorContainer.parentElement

      if (element) {
        newRect = roundValues(element.getBoundingClientRect().toJSON())
      } else {
        setSelectionState(defaultState)

        return
      }
    } else {
      if (rects.length < 1) {
        setSelectionState(defaultState)

        return
      }

      newRect = roundValues(rects[0].toJSON())
    }

    // @note only update client rect if it actually changed to prevent
    // unnecessary re-renders

    if (shallowDiff(selectionState.clientRect, newRect)) {
      newState.clientRect = newRect
    } else {
      newState.clientRect = selectionState.clientRect
    }

    newState.isCollapsed = range.collapsed

    setSelectionState(newState)
  }, [target, selectionState.clientRect])

  useLayoutEffect(() => {
    // @note selectionchange fires on document - not individual elements

    document.addEventListener('selectionchange', handleSelectionChange)

    // @note keyboard events can affect selection without triggering selectionchange

    document.addEventListener('keydown', handleSelectionChange)
    document.addEventListener('keyup', handleSelectionChange)

    // @note window resize can change selection coordinates

    window.addEventListener('resize', handleSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('keydown', handleSelectionChange)
      document.removeEventListener('keyup', handleSelectionChange)
      window.removeEventListener('resize', handleSelectionChange)
    }
  }, [handleSelectionChange])

  return {
    clientRect: selectionState.clientRect,
    isCollapsed: selectionState.isCollapsed,
    textContent: selectionState.textContent,
  }
}
