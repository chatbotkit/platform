'use client'

import dynamic from 'next/dynamic'
import { memo, useMemo, useState } from 'react'
import { LuBrain, LuChevronDown } from 'react-icons/lu'

import useIncrementIndexAfterDelay from '@/hooks/useIncrementIndexAfterDelay'

import clsx from 'clsx'

// @note keep markdown rendering out of the initial chat reasoning module graph
// because eager loading this path can trigger vague dev-time invalid element
// failures during app startup
const Safedown = dynamic(() => import('@/components/Safedown'), {
  ssr: false,
})

export function ChatReasoning({
  reasoning,

  working,

  className,

  children,

  ...props
}) {
  const [open, setOpen] = useState(false)

  const segments = useMemo(() => {
    if (!working) {
      return []
    }

    const text = reasoning?.trim?.() || ''

    if (!text) {
      return []
    }

    const lines = text
      .split(/\r?\n+/)
      .map((s) => s.replace(/^\s*\d+\.\s*/, ''))
      .map((s) => s.replace(/^\s*\*\s*/, ''))
      .map((s) => s.replace(/^\s*-\s*/, ''))
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length > 1) {
      return lines
    }

    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
      .map((s) => s.trim())
      .filter(Boolean)

    return sentences
  }, [reasoning, working])

  const segmentIndex = useIncrementIndexAfterDelay(
    segments.length, // @note off by plus one to reach "thinking longer" state
    500,
    !working // @note only increment if working
  )

  const indicatorText = useMemo(() => {
    if (!working) {
      return 'Thought for a moment'
    }

    return segmentIndex < segments.length
      ? segments[segmentIndex]
      : 'Thinking longer for a better answer...'
  }, [working, segments, segmentIndex])

  return (
    <div
      {...props}
      className={clsx(
        'relative',

        'group',

        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prevOpen) => !prevOpen)}
        className="flex items-center gap-2 py-1 relative"
      >
        <div className="group relative size-4">
          <LuChevronDown
            className={clsx(
              'absolute size-4 text-gray-500 group-hover:opacity-100 opacity-0 transition-all duration-200',
              { '-rotate-90': !open }
            )}
          />
          <LuBrain className="absolute size-4 text-gray-500 group-hover:opacity-0 opacity-100 transition-all duration-200" />
        </div>
        <p
          aria-live="polite"
          className={clsx(
            'text-base auto-text-gray-500 not-italic max-w-[20rem] truncate',
            {
              'shimmer-subtle': working,
            }
          )}
        >
          {indicatorText}
        </p>
      </button>
      <div
        className={clsx(
          'overflow-hidden',
          'transition-all duration-300',
          '[interpolate-size:allow-keywords]',
          {
            'h-auto': !!open,
            'gradient-mask-b-20 h-[0rem]': !open,
          }
        )}
      >
        <Safedown
          className={clsx(
            'prose-sm dark:prose-invert pl-4 border-l ml-2 auto-border-gray-200 auto-text-gray-500',

            '[&_a[href$="#action"]]:!no-underline [&_a[href$="#action"]]:pointer-events-none [&_a[href$="#action"]]:cursor-crosshair [&_a[href$="#action"]]:px-2 [&_a[href$="#action"]]:inline-flex [&_a[href$="#action"]]:items-center [&_a[href$="#action"]]:auto-bg-gray-200 [&_a[href$="#action"]]:auto-text-gray-800 [&_a[href$="#action"]]:rounded-lg [&_a[href$="#action"]]:[font-size:0.8em]'
          )}
        >
          {reasoning}
        </Safedown>
      </div>
      {children}
    </div>
  )
}

ChatReasoning.Memo = memo(ChatReasoning)

export default ChatReasoning
