import { useCallback, useEffect, useState } from 'react'

import DynamicIcon from '@/components/DynamicIcon'

import clsx from 'clsx'

/**
 * A countdown timer that doubles as a refresh button.
 *
 * Displays a countdown in seconds until the next refresh. On hover, transforms
 * into a reload button. Clicking triggers an immediate refresh and resets the
 * countdown.
 *
 * @param {Object} props
 * @param {number} props.interval - Refresh interval in seconds (0 to disable)
 * @param {() => void | Promise<void>} props.onRefresh - Callback when refresh is triggered
 * @param {boolean} [props.loading] - Whether a refresh is currently in progress
 * @param {string} [props.className] - Additional CSS classes
 *
 * @example
 * ```jsx
 * <RefreshTimer
 *   interval={30}
 *   onRefresh={() => loadData()}
 *   loading={isLoading}
 * />
 * ```
 */
export default function RefreshTimer({
  interval,
  onRefresh,
  loading = false,
  className,
}) {
  const [countdown, setCountdown] = useState(interval > 0 ? interval : null)

  // Reset countdown when interval changes
  useEffect(() => {
    if (interval > 0) {
      setCountdown(interval)
    } else {
      setCountdown(null)
    }
  }, [interval])

  // Countdown timer - decrements every second
  useEffect(() => {
    if (interval <= 0) {
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return 0
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [interval])

  // @note trigger refresh when countdown reaches 0, outside the state updater
  // to avoid calling parent setState during render
  useEffect(() => {
    if (countdown === 0) {
      onRefresh?.()
      setCountdown(interval)
    }
  }, [countdown, interval, onRefresh])

  // Handle manual refresh click
  const handleClick = useCallback(() => {
    if (loading) {
      return
    }

    onRefresh?.()
    setCountdown(interval)
  }, [interval, loading, onRefresh])

  // Don't render if interval is disabled
  if (interval <= 0 || countdown === null) {
    return null
  }

  return (
    <button
      type="button"
      className={clsx(
        'group',
        'flex items-center justify-center',
        'text-[9px] tabular-nums',
        'size-4',
        'rounded',
        'transition-all duration-150',
        {
          // Urgency colors based on countdown
          'text-amber-600 dark:text-amber-400': countdown > 5,
          'text-orange-600 dark:text-orange-400':
            countdown <= 5 && countdown > 2,
          'text-red-500 dark:text-red-400': countdown <= 2,

          // Loading state
          'opacity-50 cursor-wait': loading,
          'cursor-pointer': !loading,
        },
        className
      )}
      onClick={handleClick}
      disabled={loading}
      title={`Refreshing in ${countdown} seconds`}
    >
      {loading ? (
        <DynamicIcon
          className="w-3 h-3 animate-spin"
          icon="@lucide/loader-circle#filter=#d97706"
        />
      ) : (
        <>
          {/* Countdown - hidden on hover */}
          <span className="group-hover:hidden">{countdown}s</span>
          {/* Refresh icon - shown on hover */}
          <DynamicIcon
            className="w-3 h-3 hidden group-hover:block"
            icon="@lucide/rotate-cw#filter=#d97706"
          />
        </>
      )}
    </button>
  )
}
