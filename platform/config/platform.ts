import { z } from 'zod'

/**
 * Platform-wide limits.
 *
 * `maxTokensPerMonth` is a deploy-time cap on the total number of (calibrated
 * base) tokens the whole platform may consume within a billing period.
 * Platform-wide token usage is tracked in lockstep with per-user usage (see
 * `captureUsage` in `@/lib/usage.record`). Once usage reaches this value,
 * non-exempt requests are rejected with a 429 at the limit choke point (see
 * `assertPlatformOk` in `@/lib/limit.platform`).
 *
 * The cap is read from the PLATFORM_MAX_TOKENS_PER_MONTH environment variable
 * - a plain number, or `Infinity` to disable the cap - and falls back to an
 * unlimited community default. Hosted and resource-constrained
 * deployments set their own finite ceiling explicitly.
 *
 * `credentialCacheTtl` is how many seconds an API secret key or OAuth access
 * token lookup may be served from cache during authentication (see
 * `getSession` in `@/lib/session.get`). It is read from
 * PLATFORM_CREDENTIAL_CACHE_TTL and defaults to `0`: every request reads the
 * credential row, so revoking a key takes effect immediately. A deployment
 * whose API volume makes that read expensive can trade a bounded revocation
 * delay for fewer reads - a revoked credential keeps working for up to this
 * many seconds.
 */

const DEFAULT_MAX_TOKENS_PER_MONTH = Infinity

const DEFAULT_CREDENTIAL_CACHE_TTL = 0

const env = z
  .object({
    // @note a malformed value fails loudly rather than silently uncapping
    // (or zero-capping) the whole platform
    PLATFORM_MAX_TOKENS_PER_MONTH: z
      .union([
        z.literal('Infinity').transform(() => Infinity),
        z.coerce.number().positive(),
      ])
      .optional(),

    // @note a malformed value fails loudly rather than silently caching
    // credentials for an unintended window
    PLATFORM_CREDENTIAL_CACHE_TTL: z.coerce.number().int().nonnegative().optional(),
  })
  .parse({
    PLATFORM_MAX_TOKENS_PER_MONTH: process.env.PLATFORM_MAX_TOKENS_PER_MONTH,
    PLATFORM_CREDENTIAL_CACHE_TTL: process.env.PLATFORM_CREDENTIAL_CACHE_TTL,
  })

export const platform: {
  maxTokensPerMonth: number
  credentialCacheTtl: number
} = {
  /**
   * Maximum number of base tokens the platform may consume per billing period.
   * `Infinity` disables the cap.
   */
  maxTokensPerMonth:
    env.PLATFORM_MAX_TOKENS_PER_MONTH ?? DEFAULT_MAX_TOKENS_PER_MONTH,

  /**
   * Seconds a credential lookup may be served from cache during
   * authentication. `0` reads the row on every request.
   */
  credentialCacheTtl:
    env.PLATFORM_CREDENTIAL_CACHE_TTL ?? DEFAULT_CREDENTIAL_CACHE_TTL,
}

export default platform
