import { useEffect, useState } from 'react'

import useScrollHeight from '@/hooks/useAggressiveScrollHeight'

export default function useScrollSaveRestore(ref, key, disabled) {
  const [ushDisabled, setUSHDisabled] = useState(disabled)

  const height = useScrollHeight(ref, disabled || ushDisabled)

  const hasHeight = height > 0

  useEffect(() => {
    if (disabled) {
      return
    }

    if (!ref.current) {
      return
    }

    if (!hasHeight) {
      return
    }

    function restoreScrollPosition() {
      setUSHDisabled(true)

      if (!ref.current) {
        return
      }

      let scrollPosition

      try {
        scrollPosition = sessionStorage.getItem(key)
      } catch {
        // sessionStorage may be inaccessible in cross-origin iframes
        // (e.g., widget embedded on third-party sites with storage restrictions)
        return
      }

      if (scrollPosition) {
        const value =
          scrollPosition === 'full'
            ? ref.current.scrollHeight
            : parseInt(scrollPosition) || 0

        if (!value) {
          return
        }

        if (ref.current.scrollTop !== value) {
          ref.current.scrollTop = value
        }
      }
    }

    function saveScrollPosition() {
      if (!ref.current) {
        return
      }

      let scrollPosition = ref.current.scrollTop

      const maxScroll = ref.current.scrollHeight - ref.current.clientHeight

      if (scrollPosition === maxScroll) {
        scrollPosition = 'full'
      }

      try {
        sessionStorage.setItem(key, scrollPosition.toString())
      } catch {
        // sessionStorage may be inaccessible in cross-origin iframes
        // (e.g., widget embedded on third-party sites with storage restrictions)
      }
    }

    if (document.readyState === 'complete') {
      restoreScrollPosition()
    }

    window.addEventListener('load', restoreScrollPosition)
    window.addEventListener('beforeunload', saveScrollPosition)

    return () => {
      window.removeEventListener('load', restoreScrollPosition)
      window.removeEventListener('beforeunload', saveScrollPosition)
    }
  }, [disabled, ref, key, hasHeight])
}
