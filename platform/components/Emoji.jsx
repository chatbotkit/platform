import { Children, useEffect, useState } from 'react'

import { getEmojiCodePoint } from '@/lib/emoji'

import clsx from 'clsx'

/**
 * Renders an emoji, switching to CDN images when the user agent is an iOS
 * device where color emojis are not supported.
 *
 * @note to prevent React hydration errors, we use a hasMounted state to ensure
 * the first render matches what the server would produce (plain text emojis).
 * Only after mounting do we check for iOS and potentially switch to CDN images.
 */
export default function Emoji({ className, children, ...props }) {
  const [hasMounted, setHasMounted] = useState(false)
  const [useCDN, setUseCDN] = useState(false)

  useEffect(() => {
    setHasMounted(true)

    const ua = navigator.userAgent

    if (!!ua.match(/iPad/i) || !!ua.match(/iPhone/i)) {
      setUseCDN(true)
    }
  }, [])

  // @note during SSR and initial hydration, always render plain text to match
  // the server-rendered content and avoid hydration mismatch errors
  const shouldUseCDN = hasMounted && useCDN

  return (
    <span
      {...props}
      className={clsx('emoji inline-block space-x-[0.5em]', className)}
    >
      {shouldUseCDN
        ? Children.toArray(children)
            .filter((child) => typeof child === 'string')
            .flatMap((child) => child.split(/\s+/g))
            .map((c) => getEmojiCodePoint(c))
            .filter((c) => !!c)
            .map((c) => c.toString(16))
            .map((c) => {
              return (
                <img
                  key={c}
                  className="inline-block !w-[1em] !h-[1em] !max-w-[1em] !max-h-[1em] !m-0 !p-0"
                  src={`https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/${c}.svg`}
                  alt="emoji" // @todo get the emoji name
                />
              )
            })
        : children}
    </span>
  )
}
