'use client'

import { useEffect } from 'react'

import {
  consumeStaleDeployment,
  isChunkLoadError,
  markStaleDeployment,
  recoverFromChunkError,
} from '@/lib/stale'

/**
 * Global guard for webpack chunk-loading failures.
 *
 * @note When a new version is deployed, tabs still running the previous build
 * request chunk filenames the CDN no longer serves. The App Router prefetches
 * routes aggressively (on `<Link>` hover/viewport), so the *most common* symptom
 * is a best-effort prefetch rejecting with `ChunkLoadError` as an unhandled
 * promise rejection - which is non-blocking for the user but was being reported
 * as a high-volume error and left the tab pinned to a dead deployment.
 *
 * Rather than reload immediately (which could interrupt someone mid-task), we:
 *
 *   1. Suppress the rejection so it does not surface as an uncaught error.
 *   2. Mark that this tab is now stale.
 *   3. Recover at a moment that cannot lose work - when the tab is backgrounded
 *      (`visibilitychange` -> hidden) - by reloading onto the current
 *      deployment. The user returns to a fresh build with no interruption.
 *
 * User-blocking chunk failures (a chunk needed to *render* the current view)
 * reach a React error boundary instead, which recovers immediately - see
 * `app/global-error.tsx` and `app/apps/error.tsx`.
 */
export default function ChunkErrorListener() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) {
        return
      }

      event.preventDefault()
      markStaleDeployment()
    }

    const onError = (event: ErrorEvent) => {
      if (!isChunkLoadError(event.error)) {
        return
      }

      event.preventDefault()
      markStaleDeployment()
    }

    const onVisibilityChange = () => {
      // recover while the tab is hidden so the reload is invisible to the user;
      // `recoverFromChunkError` is loop-safe and gives up if the chunk is
      // genuinely gone rather than merely stale.
      if (document.visibilityState === 'hidden' && consumeStaleDeployment()) {
        recoverFromChunkError()
      }
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onError)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onError)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
