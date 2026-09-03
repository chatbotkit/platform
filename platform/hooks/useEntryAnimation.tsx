import { useEffect, useState } from 'react'

interface UseEntryAnimationProps {
  /** CSS class to apply before the animation enters */
  beforeEnter?: string
  /** CSS class to apply after the animation enters */
  afterEnter?: string
  /** Callback function invoked when the animation completes */
  onEnter?: () => void
  /** Delay in milliseconds before triggering the animation */
  delay?: number
  /** When true, disables the animation and returns empty string */
  disabled?: boolean
  /** Dependency value that resets the animation when changed */
  dependsOn?: unknown
}

/**
 * Hook for managing entry animations with configurable delay and callbacks.
 *
 * Returns a CSS class string that transitions from `beforeEnter` to `afterEnter`
 * after the specified delay. Useful for fade-in, slide-in, and other entry effects.
 */
export default function useEntryAnimation({
  beforeEnter = '',
  afterEnter = '',

  onEnter,

  delay = 100,

  disabled,

  dependsOn,
}: UseEntryAnimationProps): string {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)

    if (disabled) {
      return
    }

    const timer = setTimeout(() => {
      setVisible(true)

      if (onEnter) {
        onEnter()
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, onEnter, dependsOn, disabled])

  if (disabled) {
    return ''
  }

  return visible ? afterEnter : beforeEnter
}
