// @note the contract for error reporting and tracing. Implementations decide
// where the data goes, whether that is a vendor, the console, or nowhere.
//
// The platform must never import an observability vendor directly. A self
// hosted deployment should not have to run somebody else's error tracker, and
// should not carry its SDK in order to boot.

/**
 * A unit of work being measured.
 *
 * @note this shape predates the package: `createSpan` in the platform's debug
 * module already returned it, with a console based fallback when no vendor was
 * configured. It is reproduced here rather than redesigned.
 */
export interface Span {
  setAttribute(name: string, value: unknown): void
  finish(): void
}

export interface SpanOptions {
  name: string
  op?: string
}

/**
 * Context accompanying a captured exception. Deliberately loose: what a
 * particular reporter can carry is its own business.
 */
export type CaptureContext = Record<string, unknown>

export interface Observability {
  /**
   * Reports an error. Must never throw: a failure to report is not a reason to
   * fail the operation being reported on.
   */
  captureException(error: unknown, context?: CaptureContext): Promise<void>

  /**
   * Reports something noteworthy that is not an error, such as an observation
   * about unexpected but handled input.
   */
  captureMessage(message: string, context?: CaptureContext): void

  /**
   * Attaches a tag to subsequent reports from this context.
   */
  setTag(name: string, value: string): void

  /**
   * Starts a span that the caller finishes explicitly.
   */
  startSpan(options: SpanOptions): Span

  /**
   * Headers propagating the current trace to a downstream request or document.
   *
   * @note returns an empty object when the implementation does not trace.
   */
  getTracePropagationData(): Record<string, string>

  /**
   * Reports an error surfaced by the web framework's own error boundary.
   *
   * @note kept separate from `captureException` because a framework hands over
   * its own context object, and because a reporter may need to flush before a
   * serverless invocation ends.
   */
  captureFrameworkError(context: unknown): Promise<void>

  /**
   * Throws when this implementation is not usable with the current
   * configuration. See packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
