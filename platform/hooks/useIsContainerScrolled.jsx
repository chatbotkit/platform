import { useCallback, useEffect, useState } from 'react'

export default function useIsScrolled(
  ref,
  {
    anchor = 'top',
    threshold = 0,
    interval = 0,
    delay = 0,
    defaultValue = false,
  } = {}
) {
  const [isScrolled, setIsScrolled] = useState(defaultValue)

  const update = useCallback(() => {
    const current = ref?.current

    if (!current) {
      return
    }

    if (anchor === 'top') {
      // @note handle negative scrollTop (rubber-banding) as being at top

      setIsScrolled(Math.abs(Math.max(0, current.scrollTop)) <= threshold)
    } else {
      // @note handle negative distance (over-scroll past bottom) as being at
      // bottom

      const distance =
        current.scrollHeight - current.scrollTop - current.clientHeight

      setIsScrolled(
        Math.abs(Math.max(0, distance)) <= Math.max(threshold, 2) // @todo 2px to cover for rounding errors
      )
    }
  }, [anchor, threshold, ref])

  useEffect(() => {
    const current = ref?.current

    if (!current) {
      return
    }

    function handler() {
      if (delay) {
        setTimeout(() => {
          update()
        }, delay)
      } else {
        update()
      }
    }

    current.addEventListener('scroll', handler)

    return () => {
      current.removeEventListener('scroll', handler)
    }
  }, [ref, update, delay])

  useEffect(() => {
    const current = ref?.current

    if (!current) {
      return
    }

    function handler() {
      if (delay) {
        setTimeout(() => {
          update()
        }, delay)
      } else {
        update()
      }
    }

    const observer = new ResizeObserver(handler)

    observer.observe(current)

    return () => {
      observer.unobserve(current)
    }
  }, [ref, update, delay])

  useEffect(() => {
    const current = ref?.current

    if (!current) {
      return
    }

    if (!interval) {
      return
    }

    const int = setInterval(() => {
      update()
    }, interval)

    return () => {
      clearInterval(int)
    }
  }, [ref, interval, update])

  useEffect(() => {
    const timer = setTimeout(() => {
      update()
    }, 0)

    return () => {
      clearTimeout(timer)
    }
  }, [update])

  return isScrolled
}
