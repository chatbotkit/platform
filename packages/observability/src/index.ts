import type {
  CaptureContext,
  Observability,
  Span,
  SpanOptions,
} from '@chatbotkit-dev/observability-spec'

export type * from '@chatbotkit-dev/observability-spec'

// @note the community implementation reports to the console, and only when
// DEBUG is set. A deployment without an error tracker should still be able to
// see its own errors, and should not be made to run somebody else's service in
// order to boot.
//
// This mirrors what the platform already did when its Sentry feature flag was
// off, so behaviour is unchanged for anyone who was not using Sentry.

function debugging(): boolean {
  return !!process.env.DEBUG
}

export async function captureException(
  error: unknown,
  context?: CaptureContext
): Promise<void> {
  // eslint-disable-next-line no-console
  console.error('[observability] exception', error, context ?? '')
}

export function captureMessage(
  message: string,
  context?: CaptureContext
): void {
  // eslint-disable-next-line no-console
  console.warn('[observability] message', message, context ?? '')
}

export function setTag(name: string, value: string): void {
  if (debugging()) {
    // eslint-disable-next-line no-console
    console.log(`[observability] tag ${name}=${value}`)
  }
}

export function startSpan({ name, op }: SpanOptions): Span {
  if (!debugging()) {
    return {
      setAttribute(): void {
        // pass
      },

      finish(): void {
        // pass
      },
    }
  }

  const started = Date.now()

  return {
    setAttribute(attribute: string, value: unknown): void {
      // eslint-disable-next-line no-console
      console.log(`[observability] span "${name}" ${attribute}:`, value)
    },

    finish(): void {
      // eslint-disable-next-line no-console
      console.log(
        `[observability] span "${name}"${op ? ` (${op})` : ''} took ${
          Date.now() - started
        }ms`
      )
    },
  }
}

export function getTracePropagationData(): Record<string, string> {
  return {}
}

export async function captureFrameworkError(context: unknown): Promise<void> {
  await captureException(context)
}

/**
 * @note nothing to configure.
 */
export async function assertConfigured(): Promise<void> {
  // pass
}

const observability: Observability = {
  captureException,
  captureMessage,
  setTag,
  startSpan,
  getTracePropagationData,
  captureFrameworkError,
  assertConfigured,
}

export default observability
