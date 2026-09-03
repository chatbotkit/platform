import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import DynamicIcon from '@/components/DynamicIcon'

import useDashboardWidgetSend from '@/hooks/useDashboardWidgetSend'
import useRouter from '@/hooks/useRouter'

import clsx from 'clsx'

/**
 * Dashboard quick-open palette.
 *
 * Open with Ctrl/Cmd+P/K. Type to filter known dashboard pages. Press Enter
 * with no matching page to send the text to the dashboard assistant widget.
 */
export default function DashboardCommandPalette({ items = [] }) {
  const [open, setOpen] = useState(false)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef(null)
  const itemRefs = useRef([])

  const router = useRouter()

  const { send, instance } = useDashboardWidgetSend()

  // @note queue a single pending message so early palette submits still reach
  // the assistant once the widget instance becomes available
  const pendingMessageRef = useRef(null)

  useEffect(() => {
    if (!instance || !pendingMessageRef.current) {
      return
    }

    send(pendingMessageRef.current, { respond: true })

    pendingMessageRef.current = null
  }, [instance, send])

  useEffect(() => {
    function onKeyDown(event) {
      const isMac = navigator.platform.match('Mac')
      const hasModifier = isMac ? event.metaKey : event.ctrlKey

      if (hasModifier && (event.key === 'p' || event.key === 'k')) {
        event.preventDefault()
        event.stopPropagation()

        setOpen((value) => !value)

        return
      }

      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    setQuery('')
    setSelectedIndex(0)

    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const rawQuery = query.trim()

  const filteredItems = useMemo(() => {
    if (!open) {
      return []
    }

    if (!rawQuery) {
      return items
    }

    const lowerQuery = rawQuery.toLowerCase()

    return items.filter(
      ({ label, description, group, href, keywords = [] }) => {
        return (
          label.toLowerCase().includes(lowerQuery) ||
          (description || '').toLowerCase().includes(lowerQuery) ||
          (group || '').toLowerCase().includes(lowerQuery) ||
          (href || '').toLowerCase().includes(lowerQuery) ||
          keywords.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
        )
      }
    )
  }, [open, rawQuery, items])

  const clampedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredItems.length - 1)
  )

  function navigateTo(item) {
    if (!item?.href) {
      return
    }

    if (item.external || item.target === '_blank') {
      window.open(item.href, item.target || '_blank')
    } else {
      router.push(item.href)
    }

    setOpen(false)
  }

  function handleSelect(index) {
    const item = filteredItems[index]

    if (!item) {
      return
    }

    navigateTo(item)
  }

  function handleSubmit() {
    if (filteredItems.length > 0) {
      handleSelect(clampedIndex)

      return
    }

    const text = rawQuery.trim()

    if (!text) {
      setOpen(false)

      return
    }

    if (instance) {
      send(text, { respond: true })
    } else {
      pendingMessageRef.current = text
    }

    setOpen(false)
  }

  function handleKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()

        setSelectedIndex((index) =>
          Math.min(index + 1, filteredItems.length - 1)
        )

        itemRefs.current[
          Math.min(clampedIndex + 1, filteredItems.length - 1)
        ]?.scrollIntoView?.({ block: 'nearest' })

        break

      case 'ArrowUp':
        event.preventDefault()

        setSelectedIndex((index) => Math.max(index - 1, 0))

        itemRefs.current[Math.max(clampedIndex - 1, 0)]?.scrollIntoView?.({
          block: 'nearest',
        })

        break

      case 'Enter':
        event.preventDefault()

        handleSubmit()

        break

      case 'Escape':
        setOpen(false)

        break
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false)
        }
      }}
    >
      <div className="w-full max-w-xl mx-4 rounded-xl border auto-border-200 auto-bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="auto-text-gray-400 text-sm select-none flex-shrink-0">
            #
          </span>
          <input
            ref={inputRef}
            className="flex-1 none-input text-sm auto-text-gray-900 placeholder:text-gray-400"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Filter pages, or type a message for the assistant..."
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border auto-border-200 rounded auto-text-gray-400 select-none">
            esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto overscroll-contain">
          {filteredItems.length > 0 ? (
            <div className="py-1">
              {filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  ref={(element) => {
                    itemRefs.current[index] = element
                  }}
                  type="button"
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    index === clampedIndex
                      ? 'auto-bg-gray-100'
                      : 'hover:auto-bg-gray-100'
                  )}
                  onClick={() => handleSelect(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <DynamicIcon
                    className="w-6 h-6 flex-shrink-0 text-[1.5rem] auto-text-gray-400"
                    icon={item.icon || '@heroicons/cube-transparent'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium auto-text-gray-900 truncate">
                      {item.label}
                    </div>
                    {item.description ? (
                      <div className="text-xs auto-text-gray-500 truncate">
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                  {item.group ? (
                    <span className="tag flex-shrink-0">{item.group}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : rawQuery ? (
            <div className="px-3 py-4 text-sm auto-text-gray-500">
              No matching pages.{' '}
              <span className="auto-text-gray-400">
                Press Enter to send &ldquo;{rawQuery}&rdquo; to the assistant.
              </span>
            </div>
          ) : (
            <div className="px-3 py-3 text-xs auto-text-gray-400 space-y-1 select-none">
              <div>Type to filter dashboard pages</div>
              <div>Press Enter with no match to message the assistant</div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
