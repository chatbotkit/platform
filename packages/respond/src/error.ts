import type {
  RespondErrorCode,
  RespondErrorLike,
} from '@chatbotkit-dev/respond-spec'

/**
 * @note the contract brands errors structurally rather than exporting a base
 * class - see `RespondErrorLike` for why - so every implementation declares its
 * own. This is the whole of it.
 */
export class RespondError extends Error implements RespondErrorLike {
  readonly respond = true as const

  readonly code: RespondErrorCode

  readonly detail?: string

  constructor(
    code: RespondErrorCode,
    message: string,
    options?: { detail?: string; cause?: unknown }
  ) {
    super(message)

    this.name = 'RespondError'
    this.code = code
    this.detail = options?.detail

    // @note assigned rather than passed to `super`, because the two-argument
    // `Error` constructor is ES2022 and these packages compile against ES2021

    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}
