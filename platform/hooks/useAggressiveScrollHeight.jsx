import { useEffect, useState } from 'react'

export default function useAggressiveScrollHeight(ref, disabled) {
  const [height, setHeight] = useState('auto')

  useEffect(() => {
    if (disabled) {
      return
    }

    if (!ref.current) {
      return
    }

    function updateHeight() {
      if (!ref.current) {
        // @note the reason we want to return when ref.current is falsy is
        // because this code can be subject to race conditions where the
        // component is unmounted before the effect is run

        return
      }

      setHeight(ref.current.scrollHeight)
    }

    updateHeight()

    const resizeObserver = new ResizeObserver(() => {
      updateHeight()
    })

    resizeObserver.observe(ref.current)

    const mutationObserver = new MutationObserver(updateHeight)

    mutationObserver.observe(ref.current, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    window.addEventListener('resize', updateHeight)

    return () => {
      resizeObserver.disconnect()

      mutationObserver.disconnect()

      window.removeEventListener('resize', updateHeight)
    }
  }, [disabled, ref])

  return height
}
