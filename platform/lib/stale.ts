/**
 * Detection and recovery helpers for webpack "ChunkLoadError" failures.
 *
 * @note Background: the App Router lazy-loads
 * content-hashed JS chunks (e.g. `/_next/static/chunks/86957.<hash>.js`). When a
 * new version is deployed, a browser tab that is still running the previous
 * build references chunk filenames that the CDN no longer serves. The fetch then
 * 404s or hangs until `output.chunkLoadTimeout` elapses, and webpack rejects with
 * a `ChunkLoadError`. Most of these surface as unhandled promise rejections from
 * best-effort `<Link>` prefetches (non-blocking), but some block a render.
 *
 * This module centralises the two behaviours we want, so the global listener and
 * the React error boundaries share exactly one implementation:
 *
 *   1. `isChunkLoadError` - reliably recognise the failure across the various
 *      shapes it arrives in (Error instance, rejection reason, plain string).
 *   2. `recoverFromChunkError` - move the tab onto the current deployment by
 *      reloading, while guarding against reload loops when the chunk is *truly*
 *      gone (a genuinely broken deploy) rather than merely stale.
 */

const STALE_DEPLOYMENT_KEY = 'cbk.chunk-error.stale-deployment'
const RECOVERY_STATE_KEY = 'cbk.chunk-error.recovery'

/**
 * Maximum number of automatic reloads we will perform within
 * {@link RECOVERY_WINDOW_MS}. Two attempts tolerate a deployment that rolls out
 * *during* the first reload, while still giving up quickly enough that a chunk
 * which is permanently missing surfaces a real error instead of looping.
 */
export const MAX_RECOVERY_ATTEMPTS = 2

/**
 * Sliding window for the reload budget. Recovery attempts older than this are
 * forgotten, so a chunk error from a *future* deployment always starts with a
 * fresh budget rather than inheriting an exhausted one.
 */
export const RECOVERY_WINDOW_MS = 30_000

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading( CSS)? chunk [\w-]+ failed|Failed to fetch dynamically imported module/i

/**
 * Recognise a webpack chunk-loading failure regardless of how it reaches us.
 *
 * Rejection reasons are not always `Error` instances - they can be plain strings
 * or objects - so we probe `name`, `message`, and the raw value.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) {
    return false
  }

  if (typeof error === 'string') {
    return CHUNK_ERROR_PATTERN.test(error)
  }

  if (typeof error === 'object') {
    const { name, message } = error as { name?: unknown; message?: unknown }

    if (name === 'ChunkLoadError') {
      return true
    }

    if (typeof message === 'string' && CHUNK_ERROR_PATTERN.test(message)) {
      return true
    }
  }

  return false
}

function getSessionStorage(): Storage | null {
  try {
    // @note access can throw in private-mode/sandboxed contexts; treat any
    // failure as "no storage available" and fall back to always-recover.
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

type RecoveryState = {
  attempts: number
  firstAt: number
}

function readRecoveryState(storage: Storage | null): RecoveryState | null {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(RECOVERY_STATE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<RecoveryState>

    if (
      typeof parsed?.attempts === 'number' &&
      typeof parsed?.firstAt === 'number'
    ) {
      return { attempts: parsed.attempts, firstAt: parsed.firstAt }
    }
  } catch {
    // ignore malformed state
  }

  return null
}

/**
 * Mark that this tab has observed a chunk failure and is therefore pinned to a
 * deployment whose assets are no longer being served. Used by non-blocking
 * detections (prefetch rejections) to defer recovery to a moment that will not
 * interrupt the user - see {@link consumeStaleDeployment}.
 */
export function markStaleDeployment(): void {
  getSessionStorage()?.setItem(STALE_DEPLOYMENT_KEY, '1')
}

/**
 * Return whether a stale deployment has been marked, clearing the flag so each
 * mark triggers at most one recovery attempt.
 */
export function consumeStaleDeployment(): boolean {
  const storage = getSessionStorage()

  if (!storage) {
    return false
  }

  const marked = storage.getItem(STALE_DEPLOYMENT_KEY) === '1'

  if (marked) {
    storage.removeItem(STALE_DEPLOYMENT_KEY)
  }

  return marked
}

/**
 * Reload the page to pick up the current deployment, unless we have already
 * exhausted the reload budget within the sliding window (which indicates the
 * chunk is genuinely missing, not merely stale).
 *
 * @param reload - injectable for testing; defaults to a full-document reload.
 * @param now - injectable clock for testing.
 * @returns `'recovering'` when a reload was triggered, `'exhausted'` when the
 *   budget is spent and the caller should surface a real error instead.
 */
export function recoverFromChunkError({
  reload = () => window.location.reload(),
  now = Date.now(),
}: {
  reload?: () => void
  now?: number
} = {}): 'recovering' | 'exhausted' {
  const storage = getSessionStorage()
  const previous = readRecoveryState(storage)

  const withinWindow =
    previous !== null && now - previous.firstAt <= RECOVERY_WINDOW_MS

  if (withinWindow && previous.attempts >= MAX_RECOVERY_ATTEMPTS) {
    return 'exhausted'
  }

  const next: RecoveryState = withinWindow
    ? { attempts: previous.attempts + 1, firstAt: previous.firstAt }
    : { attempts: 1, firstAt: now }

  try {
    storage?.setItem(RECOVERY_STATE_KEY, JSON.stringify(next))
  } catch {
    // ignore storage write failures - we still attempt the reload below
  }

  reload()

  return 'recovering'
}
