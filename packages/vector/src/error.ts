import type {
  VectorErrorCode,
  VectorErrorLike,
} from '@chatbotkit-dev/vector-spec'

/**
 * @note the contract brands errors structurally rather than exporting a base
 * class - see `VectorErrorLike` for why - so every implementation declares its
 * own. This is the whole of it.
 */
export class VectorError extends Error implements VectorErrorLike {
  readonly vector = true as const

  readonly code: VectorErrorCode

  readonly detail?: string

  constructor(
    code: VectorErrorCode,
    message: string,
    options?: { detail?: string; cause?: unknown }
  ) {
    super(message)

    this.name = 'VectorError'
    this.code = code
    this.detail = options?.detail

    // @note assigned rather than passed to `super`, because the two-argument
    // `Error` constructor is ES2022 and these packages compile against ES2021

    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

export function toVectorError(
  error: unknown,
  fallback: VectorErrorCode
): VectorError {
  if (error instanceof VectorError) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)

  return new VectorError(fallback, message, { detail: message, cause: error })
}
