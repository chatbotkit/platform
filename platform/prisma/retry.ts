import debug from '@/lib/debug'

import { Prisma } from '@prisma/client/extension'

/**
 * Configuration options for the retry extension.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   *
   * @default 5
   */
  maxRetries?: number

  /**
   * Initial delay in milliseconds before the first retry.
   *
   * @default 100
   */
  initialDelay?: number

  /**
   * Maximum delay in milliseconds between retries.
   *
   * @default 5000
   */
  maxDelay?: number

  /**
   * Multiplier for exponential backoff.
   *
   * @default 2
   */
  backoffMultiplier?: number

  /**
   * Whether to add random jitter to prevent thundering herd.
   *
   * @default true
   */
  jitter?: boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  jitter: true,
}

/**
 * Prisma error codes that are safe to retry.
 *
 * @see https://www.prisma.io/docs/reference/api-reference/error-reference
 * @see https://www.prisma.io/docs/accelerate/troubleshoot
 */
const RETRYABLE_ERROR_CODES = new Set([
  // Prisma Accelerate errors
  'P6000', // Unknown server error
  'P6002', // Unable to start transaction
  'P6004', // Query timeout (frequent)
  'P6008', // Connection pool timeout
  'P6009', // Response size exceeded

  // Prisma Client errors
  'P1001', // Can't reach database server
  'P1002', // Database server timeout
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection (frequent)
  'P2024', // Timed out fetching from connection pool (frequent)
])

/**
 * Error messages that indicate a retryable condition.
 */
const RETRYABLE_ERROR_PATTERNS = [
  /unable to connect to the accelerate api/i,
  /server has closed the connection/i, // (frequent)
  /can't reach database server/i,
  /connection.*reset/i,
  /connection.*refused/i,
  /timed out fetching.*connection pool/i, // (frequent)
  /econnreset/i,
  /etimedout/i,
  /socket hang up/i,
  /network error/i,
  /dns/i,
  /transaction.*rolled back/i, // Vitess/PlanetScale transient transaction abort
  /headers timeout/i, // undici HeadersTimeoutError (frequent, PlanetScale HTTP timeout)
  /body timeout/i, // undici BodyTimeoutError
  /connect timeout/i, // undici ConnectTimeoutError
  /code = unavailable/i, // Vitess/PlanetScale vttablet gRPC Unavailable (transient, canonically retryable)
  /connection timed out/i, // vttablet "read tcp ...: read: connection timed out" and similar socket timeouts
]

/**
 * Determines if an error is retryable based on error code or message patterns.
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const prismaError = error as {
    code?: string
    message?: string
    cause?: unknown
  }

  // Check Prisma error code
  if (prismaError.code && RETRYABLE_ERROR_CODES.has(prismaError.code)) {
    return true
  }

  // Check error message patterns
  if (prismaError.message) {
    if (
      RETRYABLE_ERROR_PATTERNS.some((pattern) =>
        pattern.test(prismaError.message || '')
      )
    ) {
      return true
    }
  }

  // Check cause recursively (e.g., TypeError: fetch failed caused by
  // HeadersTimeoutError)
  if (prismaError.cause) {
    return isRetryableError(prismaError.cause)
  }

  return false
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff
 * with optional jitter.
 */
function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const exponentialDelay =
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt)

  const cappedDelay = Math.min(exponentialDelay, options.maxDelay)

  if (options.jitter) {
    // Add random jitter between 0-25% of the delay to prevent thundering herd
    const jitterAmount = cappedDelay * 0.25 * Math.random()

    return Math.floor(cappedDelay + jitterAmount)
  }

  return cappedDelay
}

/**
 * Sleep for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Executes a function with retry logic for transient Prisma errors.
 */
async function executeWithRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  userOptions?: RetryOptions
): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...userOptions }

  let lastError: unknown

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      const isRetryable = isRetryableError(error)
      const hasRetriesLeft = attempt < options.maxRetries

      debug(`prisma operation failed`, {
        operation,
        attempt,
        maxRetries: options.maxRetries,
        isRetryable,
        hasRetriesLeft,
        errorCode: (error as { code?: string })?.code,
        errorMessage: (error as { message?: string })?.message?.slice(0, 200),
      }).log('prisma.retry')

      if (!isRetryable || !hasRetriesLeft) {
        throw error
      }

      const delay = calculateDelay(attempt, options)

      debug(`retrying prisma operation`, {
        operation,
        attempt: attempt + 1,
        delay,
      }).log('prisma.retry')

      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError
}

/**
 * Creates a Prisma extension that adds automatic retry logic for transient
 * errors such as connection issues, timeouts, and Accelerate API failures.
 *
 * @example
 * ```ts
 * const prisma = new PrismaClient()
 *   .$extends(withRetry({ maxRetries: 3 }))
 * ```
 */
export function withRetry(options?: RetryOptions) {
  debug(`creating retry extension`, { options }).log('prisma.retry')

  return Prisma.defineExtension({
    name: 'prisma-retry',

    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const operationName = `${model}.${operation}`

          return executeWithRetry(operationName, () => query(args), options)
        },
      },

      // Also handle raw queries
      async $queryRaw({ args, query }) {
        return executeWithRetry('$queryRaw', () => query(args), options)
      },

      async $executeRaw({ args, query }) {
        return executeWithRetry('$executeRaw', () => query(args), options)
      },
    },
  })
}

export default withRetry
