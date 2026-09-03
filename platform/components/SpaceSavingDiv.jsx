import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

/**
 * A div that saves space (i.e. it hides itself) when it has no text content.
 *
 * @todo investigate if this implementation is correct or even fast enough to be
 * used when displaying lots of items
 *
 * @todo add an option if we should trim
 */
export function SpaceSavingDiv(
  {
    defaultHasContent,

    className,

    disabled,

    ...props
  },
  forwardedRef
) {
  const localRef = useRef(null)

  useImperativeHandle(forwardedRef, () => localRef.current)

  const [hasContent, setHasContent] = useState(defaultHasContent)

  useEffect(() => {
    if (disabled) {
      return
    }

    const observer = new MutationObserver(() => {
      const hasContent = localRef.current?.textContent

      setHasContent(hasContent)
    })

    observer.observe(localRef.current, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [disabled])

  return (
    <div
      {...props}
      ref={localRef}
      className={clsx(className, {
        hidden: !hasContent,
      })}
    />
  )
}

export default forwardRef(SpaceSavingDiv)
