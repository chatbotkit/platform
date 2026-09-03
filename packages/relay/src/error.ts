import type { RelayErrorCode, RelayErrorLike } from '@chatbotkit-dev/relay-spec'

/**
 * @note the contract brands errors structurally rather than exporting a base
 * class - see `RelayErrorLike` for why - so every implementation declares its
 * own. This is the whole of it.
 */
export class RelayError extends Error implements RelayErrorLike {
  readonly relay = true as const

  readonly code: RelayErrorCode

  readonly detail?: string

  constructor(
    code: RelayErrorCode,
    message: string,
    options?: { detail?: string; cause?: unknown }
  ) {
    super(message)

    this.name = 'RelayError'
    this.code = code
    this.detail = options?.detail

    // @note assigned rather than passed to `super`, because the two-argument
    // `Error` constructor is ES2022 and these packages compile against ES2021

    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}
