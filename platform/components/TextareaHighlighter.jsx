import { useCallback, useEffect, useRef, useState } from 'react'

import clsx from 'clsx'

function copyScroll(source, target) {
  target.scrollTop = source.scrollTop
  target.scrollLeft = source.scrollLeft
}

function copyStyles(source, target) {
  const essentialProps = [
    'width',
    'height',
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'fontSize',
    'fontFamily',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'textAlign',
    'whiteSpace',
    'wordBreak',
    'wordWrap',
    'overflowWrap',
    'scrollPadding',
    'scrollPaddingTop',
    'scrollPaddingBottom',
    'boxSizing',
    'borderWidth',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
  ]

  const sourceStyle = window.getComputedStyle(source)

  let cssText = ''

  for (const prop of essentialProps) {
    const kebabCase = prop.replace(
      /[A-Z]/g,
      (match) => `-${match.toLowerCase()}`
    )

    cssText += `${kebabCase}:${sourceStyle.getPropertyValue(kebabCase)};`
  }

  if (target && target.style) {
    target.style.cssText = cssText
  }
}

export default function TextareaHighlighter({
  keywords,

  top = true, // the highlighter covers the textarea (true) or is behind it (false)

  textarea,

  value: externalValue,

  className,

  ...props
}) {
  const [value, setValue] = useState('')

  const [html, setHtml] = useState('')

  const ref = useRef()

  useEffect(() => {
    if (!textarea) {
      return
    }

    copyScroll(textarea, ref.current)
  }, [textarea, html])

  const sync = useCallback((textarea) => {
    copyStyles(textarea, ref.current)

    setValue(textarea.value)

    // @note a bit of a hack but we need to make sure we capture all the
    // styles from the textarea - without this sometimes the field does not
    // take the full height of the textarea
    {
      setTimeout(() => {
        copyStyles(textarea, ref.current)
      }, 1)

      requestAnimationFrame(() => {
        copyStyles(textarea, ref.current)
      })
    }
  }, [])

  // @note programmatic value changes (a controlled `value` swap, e.g. an
  // editor switching files) fire none of the DOM events listened to below, so
  // consumers pass the controlled `value` and we re-sync when it changes. The
  // DOM is committed before effects run, so `textarea.value` is fresh here.
  useEffect(() => {
    if (!textarea || externalValue === undefined) {
      return
    }

    sync(textarea)
  }, [externalValue, textarea, sync])

  useEffect(() => {
    if (!textarea) {
      return
    }

    sync(textarea)

    function handleInput() {
      sync(textarea)
    }

    function handleScroll() {
      copyScroll(textarea, ref.current)
    }

    function handleResize() {
      sync(textarea)
    }

    textarea.addEventListener('scroll', handleScroll, { passive: true }) // @note passive listener improves scroll performance by not blocking the main thread
    textarea.addEventListener('input', handleInput)
    textarea.addEventListener('keyup', handleInput)
    textarea.addEventListener('paste', handleInput)
    textarea.addEventListener('cut', handleInput)
    textarea.addEventListener('focus', handleInput)
    textarea.addEventListener('blur', handleInput)

    window.addEventListener('resize', handleResize)

    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })

    resizeObserver.observe(textarea)

    return () => {
      textarea.removeEventListener('scroll', handleScroll)
      textarea.removeEventListener('input', handleInput)
      textarea.removeEventListener('keyup', handleInput)
      textarea.removeEventListener('paste', handleInput)
      textarea.removeEventListener('cut', handleInput)
      textarea.removeEventListener('focus', handleInput)
      textarea.removeEventListener('blur', handleInput)

      window.removeEventListener('resize', handleResize)

      resizeObserver.disconnect()
    }
  }, [textarea, sync])

  const [worker, setWorker] = useState()

  {
    useEffect(() => {
      if (typeof Worker === 'function') {
        const newWorker = new Worker(
          new URL('../workers/highlighter.worker.js', import.meta.url)
        )

        setWorker(newWorker)

        function handleMessage(event) {
          setHtml(event.data)
        }

        newWorker.addEventListener('message', handleMessage)

        return () => {
          newWorker.removeEventListener('message', handleMessage)

          newWorker.terminate()
        }
      }
    }, [])
  }

  useEffect(() => {
    if (!worker) {
      return
    }

    let processedValue = value

    if (processedValue.endsWith('\n')) {
      processedValue = processedValue.replace(/\n$/, '\n\n')
    }

    const normalizedKeywords = keywords || []

    worker.postMessage({
      value: processedValue,
      keywords: normalizedKeywords,
    })
  }, [value, keywords, worker])

  return (
    <div
      {...props}
      className={clsx(
        'absolute top-0 bottom-0 left-0 right-0 z-10 !pointer-events-none !overflow-hidden',
        className
      )}
    >
      <div
        className={clsx(
          '!pointer-events-none !overflow-hidden !bg-transparent !border-transparent !outline-transparent !shadow-none !ring-0',
          {
            '!text-transparent': top,
          }
        )}
        ref={ref}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
