import type {
  ScreenshotErrorCode,
  ScreenshotErrorLike,
} from '@chatbotkit-dev/screenshot-spec'

/**
 * @note the contract brands errors structurally rather than exporting a base
 * class - see `ScreenshotErrorLike` for why - so every implementation declares
 * its own. This is the whole of it.
 */
export class ScreenshotError extends Error implements ScreenshotErrorLike {
  readonly screenshot = true as const

  readonly code: ScreenshotErrorCode

  readonly detail?: string

  constructor(
    code: ScreenshotErrorCode,
    message: string,
    options?: { detail?: string; cause?: unknown }
  ) {
    super(message)

    this.name = 'ScreenshotError'
    this.code = code
    this.detail = options?.detail

    // @note assigned rather than passed to `super`, because the two-argument
    // `Error` constructor is ES2022 and these packages compile against ES2021

    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}
