'use client'

import { useEffect } from 'react'

import { usePathname } from 'next/navigation'

import observability from '@chatbotkit-dev/observability'

import { isChunkLoadError, recoverFromChunkError } from '@/lib/stale'

/**
 * Segment error boundary for the entire `/apps` tree, including adhoc apps.
 *
 * @note When a Server Component in an app route (`/apps/<id>`) throws during
 * streaming SSR and there is no error boundary below the layout `<Suspense>`,
 * React aborts the boundary and the browser only ever sees the generic,
 * unactionable client error "The server could not finish this Suspense boundary
 * ... Switched to client rendering". That single issue
 * masks many distinct root causes with no digest, route, or stack.
 *
 * Catching the failure here instead lets us (a) tag the failing app route and
 * the React `error.digest`, and (b) fingerprint by digest so each underlying
 * error groups as its own issue and can be correlated with the matching
 * server-side issue reported by `onRequestError` (which shares the same digest).
 */
export default function AppsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()

  // @note a chunk needed to render this app route is missing because the tab is
  // running a superseded deployment. The user is
  // blocked, so reload onto the current deployment immediately rather than
  // report. `recoverFromChunkError` is loop-safe; once it returns 'exhausted'
  // the chunk is genuinely gone (a broken deploy) and we fall through to normal
  // reporting + the error UI below.
  const recovering =
    isChunkLoadError(error) && recoverFromChunkError() === 'recovering'

  useEffect(() => {
    if (recovering) {
      return
    }

    if (isChunkLoadError(error)) {
      // @note recovery (reload) did not fix it - the chunk is genuinely gone, so
      // a deploy stranded users on a dead build. Report under its own
      // fingerprint, distinct from the self-healing chunk-loading regression noise. The
      // synthetic message avoids the "Loading chunk … failed" wording so it
      // bypasses the chunk-error `ignoreErrors` filter.
      void observability.captureException(
        new Error('Unrecoverable chunk load failure (deploy skew)'),
        {
          tags: { route: 'apps', app_pathname: pathname },
          fingerprint: ['chunk-load-error-unrecoverable'],
          extra: { originalMessage: error.message },
        }
      )

      return
    }

    void observability.captureException(error, {
      tags: {
        route: 'apps',
        // the specific failing route, e.g. `/apps/b4d0c8f2` - this answers
        // "which app broke?" directly from the issue's tags
        app_pathname: pathname,
        digest: error.digest,
      },
      // @note when this is a swallowed server-render error (it has a digest),
      // group by that digest - a stable hash of the underlying error - so
      // distinct root causes split into separate issues instead of collapsing
      // into one. Without a digest, keep Sentry's default grouping.
      fingerprint: error.digest
        ? ['apps-render', error.digest]
        : ['{{ default }}'],
    })
  }, [error, pathname, recovering])

  if (recovering) {
    return null
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>

      <p className="max-w-md text-sm opacity-70">
        This app failed to load. Please try again.
      </p>

      <button
        type="button"
        // @note for a missing chunk, re-rendering the same tree (`reset`) would
        // just hit the same gap - a full reload fetches the current build.
        onClick={() =>
          isChunkLoadError(error) ? window.location.reload() : reset()
        }
        className="rounded-md border px-4 py-2 text-sm"
      >
        Try again
      </button>
    </div>
  )
}
