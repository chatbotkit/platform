import { useEffect, useRef, useState } from 'react'

import clsx from 'clsx'

export default function PortalTarget({ id, children, singleChild }) {
  const [hasChildren, setHasChildren] = useState(false)

  const ref = useRef()

  useEffect(() => {
    const target = ref.current

    if (!target) {
      return
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          setHasChildren(target.hasChildNodes())
        }
      })
    })

    observer.observe(target, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return (
    <>
      <div
        id={id}
        ref={ref}
        className={clsx({
          // Ensure that only one child is rendered at the time.

          '[&>*]:hidden [&>*:last-child]:!block': singleChild,
        })}
      />
      {hasChildren ? null : children}
    </>
  )
}
