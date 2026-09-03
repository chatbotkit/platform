import { useCallback, useEffect, useMemo, useState } from 'react'

import { getRandomId } from '@/lib/string'
import toast from '@/lib/toast'

import AutoTextarea from '@/components/AutoTextarea'
import FloatingBox from '@/components/FloatingBox'
import { GlobalRootPortal } from '@/components/GlobalRoot'

import useFetch from '@/hooks/useFetch'
import useTextareaSelection from '@/hooks/useTextareaSelection'

import { SparklesIcon } from '@heroicons/react/24/outline'

function EditForm({ selectedText, fullText, onSubmit, onCancel }) {
  const [instruction, setInstruction] = useState('')

  const { fetch, loading } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleApply() {
    if (!instruction.trim()) {
      toast.error('Please enter an instruction', {
        duration: 3000,
        id: getRandomId(),
      })

      return
    }

    // @note format the prompt to instruct the AI to transform the selected text

    const prompt = `Transform the following text according to this instruction: "${instruction.trim()}"

Full document for context:
"""
${fullText}
"""

Text to transform (this is a selection from the document above):
"""
${selectedText}
"""

Respond ONLY with the transformed text, nothing else.`

    const { error, data } = await fetch('/api/v1/magic/@text/generate', {
      data: {
        text: prompt,
      },

      loadingMessage: 'Transforming text...',
    })

    if (!error && data?.text) {
      onSubmit(data.text.trim())
    }
  }

  return (
    <div
      className="flex flex-col gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-80"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <SparklesIcon className="w-4 h-4" />
        <span>Quick Edit</span>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Selected: &ldquo;
        {selectedText.length > 50
          ? selectedText.substring(0, 50) + '...'
          : selectedText}
        &rdquo;
      </div>

      <AutoTextarea
        className="default-input text-sm !min-h-[60px] !max-h-[120px]"
        placeholder="e.g. make it more professional, translate to Spanish, expand on this..."
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) {
            e.preventDefault()
            handleApply()
          }

          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        autoFocus
        disabled={loading}
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="default-button small"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="primary-button small"
          onClick={handleApply}
          disabled={loading || !instruction.trim()}
        >
          {loading ? 'Transforming...' : 'Apply'}
        </button>
      </div>
    </div>
  )
}

export default function TextareaQuickEditTools({
  textarea,
  value,
  setValue,
  disabled = false,
  delay = 500,
}) {
  const { clientRect, textContent, selectionStart, selectionEnd, isCollapsed } =
    useTextareaSelection(textarea)

  const [showTools, setShowTools] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formLocation, setFormLocation] = useState(null)

  // @note store the selection info when the form is opened
  const [savedSelection, setSavedSelection] = useState(null)

  // @note handle delay for showing tools
  useEffect(() => {
    // @note immediately hide tools when there's no valid selection
    if (!clientRect || isCollapsed || !textContent?.trim() || disabled) {
      setShowTools(false)

      return
    }

    // @note reset showTools to false first, then start delay timer
    setShowTools(false)

    if (delay > 0) {
      const timeoutId = setTimeout(() => {
        setShowTools(true)
      }, delay)

      return () => clearTimeout(timeoutId)
    } else {
      // @note show immediately if no delay
      setShowTools(true)
    }
  }, [clientRect, isCollapsed, textContent, delay, disabled])

  // listen for Cmd+I (or Ctrl+I) keyboard shortcut to open the form

  useEffect(() => {
    if (disabled || !textarea) {
      return
    }

    const handleKeyDown = (event) => {
      // check for Cmd+I (Mac) or Ctrl+I (Windows/Linux)

      if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
        // only open if there's a valid selection

        if (!isCollapsed && textContent && clientRect) {
          event.preventDefault()
          event.stopPropagation()

          // save the current selection for when we apply the change

          setSavedSelection({
            text: textContent,
            start: selectionStart,
            end: selectionEnd,
          })

          // use clientRect.left for better browser compatibility

          setFormLocation({
            x: clientRect.left + clientRect.width / 2,
            y: clientRect.bottom,
          })

          setShowForm(true)
          setShowTools(false)
        }
      }
    }

    textarea.addEventListener('keydown', handleKeyDown)

    return () => {
      textarea.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    disabled,
    textarea,
    isCollapsed,
    textContent,
    clientRect,
    selectionStart,
    selectionEnd,
  ])

  const handleOpenForm = useCallback(() => {
    if (!clientRect || !textContent) {
      return
    }

    // @note save the current selection for when we apply the change
    setSavedSelection({
      text: textContent,
      start: selectionStart,
      end: selectionEnd,
    })

    // @note use clientRect.left for better browser compatibility
    setFormLocation({
      x: clientRect.left + clientRect.width / 2,
      y: clientRect.bottom,
    })

    setShowForm(true)
    setShowTools(false)
  }, [clientRect, textContent, selectionStart, selectionEnd])

  const handleCloseForm = useCallback(() => {
    setShowForm(false)
    setFormLocation(null)
    setSavedSelection(null)
  }, [])

  const handleApplyChange = useCallback(
    (newText) => {
      if (!savedSelection || !value) {
        handleCloseForm()

        return
      }

      // @note replace the selected text with the new text
      const beforeText = value.substring(0, savedSelection.start)
      const afterText = value.substring(savedSelection.end)
      const newValue = beforeText + newText + afterText

      setValue(newValue)

      toast.success('Text updated successfully', {
        duration: 2000,
        id: getRandomId(),
      })

      handleCloseForm()

      // @note restore focus to textarea and set cursor position after the new text
      if (textarea) {
        setTimeout(() => {
          textarea.focus()

          const newCursorPosition = savedSelection.start + newText.length

          textarea.setSelectionRange(newCursorPosition, newCursorPosition)
        }, 0)
      }
    },
    [savedSelection, value, setValue, handleCloseForm, textarea]
  )

  // @note calculate positioning for the tool button
  const toolsStyle = useMemo(() => {
    if (!showTools || !clientRect || isCollapsed || !textContent?.trim()) {
      return { display: 'none' }
    }

    const viewportHeight = window.innerHeight
    const spaceAbove = clientRect.top
    const spaceBelow = viewportHeight - clientRect.bottom

    const offset = 8

    const style = {
      position: 'fixed',
      zIndex: 1000,
      pointerEvents: 'auto',
      left: clientRect.left + clientRect.width / 2,
      transform: 'translateX(-50%)',
    }

    // @note position above or below based on available space
    if (spaceAbove > spaceBelow) {
      style.bottom = viewportHeight - clientRect.top + offset
    } else {
      style.top = clientRect.bottom + offset
    }

    return style
  }, [clientRect, isCollapsed, textContent, showTools])

  // @note only render when there's valid text selection, delay has passed, and form is not open
  const showToolButton =
    showTools &&
    clientRect &&
    !isCollapsed &&
    textContent?.trim() &&
    !disabled &&
    !showForm

  return (
    <>
      {showToolButton && (
        <GlobalRootPortal>
          <div style={toolsStyle}>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onMouseDown={(event) => {
                // @note use mouseDown instead of click to prevent selection loss
                // when click starts, the textarea loses focus which clears selection
                // and causes the button to disappear before click completes
                event.preventDefault()
                event.stopPropagation()
                handleOpenForm()
              }}
            >
              <SparklesIcon className="w-4 h-4" />
              <span>Quick Edit</span>
            </button>
          </div>
        </GlobalRootPortal>
      )}
      {showForm && formLocation && savedSelection && (
        <GlobalRootPortal>
          <FloatingBox
            strategy="fixed"
            x={formLocation.x}
            y={formLocation.y}
            offset={8}
            allowedPlacements={['top', 'bottom']}
            transitionStyles="scale"
            onUnmount={handleCloseForm}
          >
            {({ close }) => (
              <EditForm
                selectedText={savedSelection.text}
                fullText={value}
                onSubmit={(newText) => {
                  handleApplyChange(newText)
                  close()
                }}
                onCancel={() => {
                  handleCloseForm()
                  close()
                }}
              />
            )}
          </FloatingBox>
        </GlobalRootPortal>
      )}
    </>
  )
}
