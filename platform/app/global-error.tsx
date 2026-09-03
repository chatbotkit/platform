'use client'

import { useEffect } from 'react'

import type { Metadata } from 'next'
import NextError from 'next/error'

import observability from '@chatbotkit-dev/observability'

import { isChunkLoadError, recoverFromChunkError } from '@/lib/stale'

export function generateMetadata(): Metadata {
  return {
    other: {
      ...observability.getTracePropagationData(),
    },
  }
}

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  // @note when the root render is broken by a stale chunk, reload onto the
  // current deployment rather than report because the
  // app has already crashed so a reload loses nothing. `recoverFromChunkError`
  // is loop-safe; once it returns 'exhausted' the chunk is genuinely missing
  // (a broken deploy), which is a real error and falls through to reporting +
  // the error page below.
  const recovering =
    isChunkLoadError(error) && recoverFromChunkError() === 'recovering'

  useEffect(() => {
    if (recovering) {
      return
    }

    if (isChunkLoadError(error)) {
      // @note we got here despite recovery, so reloading did not fix it - the
      // chunk is genuinely gone and a deploy has stranded users on a dead build.
      // That is rare and actionable, unlike the self-healing chunk-loading regression
      // noise, so report it under its own fingerprint. The synthetic message
      // deliberately avoids the "Loading chunk … failed" wording so it bypasses
      // the chunk-error `ignoreErrors` filter; the original is kept in `extra`.
      void observability.captureException(
        new Error('Unrecoverable chunk load failure (deploy skew)'),
        {
          fingerprint: ['chunk-load-error-unrecoverable'],
          extra: { originalMessage: error.message },
        }
      )

      return
    }

    void observability.captureException(error, {
      // @note record the React `error.digest` so a swallowed server-render
      // error caught here can be correlated with the matching server-side issue
      // reported by `onRequestError`, which carries the same digest.
      tags: { digest: error.digest },
      // @note when a digest is present, group by it so distinct root causes
      // split into separate issues instead of collapsing into one bucket.
      // Without a digest, keep Sentry's default grouping.
      fingerprint: error.digest
        ? ['global-error', error.digest]
        : ['{{ default }}'],
    })
  }, [error, recovering])

  return (
    <html>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
