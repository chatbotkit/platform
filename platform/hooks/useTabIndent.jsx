import { useState } from 'react'

const TAB_STRING = '  ' // 4 spaces

export default function useTabIndent(onChange) {
  const [selection, setSelection] = useState({ start: 0, end: 0 })

  function handleKeyDown(event) {
    if (event.key === 'Tab') {
      event.preventDefault()

      const textarea = event.target

      // Try to use document.execCommand to preserve undo/redo history. This
      // integrates properly with the browser's native undo stack. Note that
      // execCommand is deprecated but still widely supported.

      let success = false

      if (document.execCommand) {
        try {
          success = document.execCommand('insertText', false, TAB_STRING)
        } catch {
          success = false
        }
      }

      if (!success) {
        // Fallback for browsers that don't support execCommand or when it fails.

        const { selectionStart, selectionEnd, value } = textarea

        const newValue =
          value.substring(0, selectionStart) +
          TAB_STRING +
          value.substring(selectionEnd)

        const newPosition = selectionStart + TAB_STRING.length

        if (onChange) {
          onChange({
            target: {
              value: newValue,
            },
          })

          setSelection({
            start: newPosition,
            end: newPosition,
          })
        } else {
          textarea.value = newValue
          textarea.setSelectionRange(newPosition, newPosition)
        }
      }
    }
  }

  return { handleKeyDown, selection }
}
