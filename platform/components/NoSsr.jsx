'use client'

import { useEffect, useState } from 'react'

/**
 * Render children on the client only.
 *
 * @note this previously used `next/dynamic(() => …, { ssr: false })`, but in the
 * App Router an `ssr: false` dynamic aborts its Suspense boundary during server
 * rendering, which React reports as "The server could not finish this Suspense
 * boundary … Switched to client rendering." That fired on every SSR pass that
 * reached a `NoSsr` (e.g. via CodeBlock/ObjectView). A mount guard achieves the
 * same "client-only" behaviour without ever suspending: it renders `null` on
 * the server and on the first client render (so there is no hydration
 * mismatch), then the children once mounted.
 */
export default function NoSsr({ children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <>{children}</>
}
