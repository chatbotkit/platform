import debug from '@/lib/debug'
import { SystemError, UserConfigError } from '@/lib/error'

const CUSTOM_ENDPOINT_ERROR =
  'Custom endpoint requires custom credentials. Platform credentials cannot be used with a custom endpoint.'

/**
 * Treats blank / whitespace-only values as absent. A model store populated from
 * user input can carry `''` or `'   '` for an unset field; those must never be
 * mistaken for a real custom key or URL.
 */
function present(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value : undefined
}

/**
 * Resolves a model-provider API key, preferring the caller's
 * bring-your-own-key (BYOK) credential from the model store and falling back to
 * the platform key from the environment.
 *
 * The platform `envKey` is OPTIONAL on purpose. Several providers (OpenRouter,
 * Perplexity, DeepSeek, Groq, Mistral, Bedrock, Vertex) are BYOK-only and have
 * no platform key configured. Previously each getter read its platform key with
 * a required `z.string().parse(process.env)`, which threw a raw ZodError before
 * the BYOK store key was ever consulted - breaking BYOK entirely for those
 * providers and surfacing as an opaque crash in Sentry.
 * Resolving the store key first, and validating presence only afterwards, keeps
 * BYOK working without a platform key and yields a clean error otherwise.
 *
 * ## Custom-endpoint credential isolation (defense in depth)
 *
 * Platform credentials must NEVER be sent to a user-controlled endpoint. The
 * isolation here is deliberately layered and fails closed:
 *
 *  1. Blank normalization - a whitespace-only store key/URL counts as unset, so
 *     it can neither stand in for a real custom key nor silently disable the
 *     custom-URL checks below.
 *  2. Presence - when a custom URL is set, a custom key is REQUIRED; we never
 *     fall back to the platform key for a custom endpoint.
 *  3. Identity - a "custom" key that is byte-for-byte the platform key is
 *     rejected, so platform credentials cannot reach a custom URL by being
 *     pasted back in as the user's own key.
 *  4. Return-point invariant - the value returned for a custom endpoint is
 *     asserted to differ from the platform key; a `SystemError` (never silently)
 *     guards against a future refactor regressing into a leak.
 *
 * Crucially, "custom URL" means *any* store-provided URL. The checks key off the
 * mere presence of a user-controlled URL, not its value, so isolation holds even
 * when the custom URL is byte-for-byte the provider's official endpoint.
 *
 * @throws {UserConfigError} when neither a BYOK key nor a platform key is
 * available, or when a custom endpoint is configured without distinct custom
 * credentials.
 * @throws {SystemError} if the return-point isolation invariant is violated
 * (should be unreachable; present as a fail-closed backstop).
 */
export function resolveProviderCredential({
  label,
  storeKey,
  storeUrl,
  envKey,
}: {
  /** Human-readable provider name used in errors/logs, e.g. 'OpenRouter'. */
  label: string
  /** BYOK key from the model store, if the caller supplied one. */
  storeKey: string | undefined
  /** Custom endpoint from the model store, if the caller supplied one. */
  storeUrl: string | undefined
  /** Platform key from the environment. Absent for BYOK-only providers. */
  envKey: string | undefined
}): string {
  const customKey = present(storeKey)
  const customUrl = present(storeUrl)
  const platformKey = present(envKey)

  if (customUrl) {
    // Layer 2 (presence) + Layer 3 (identity): a custom endpoint requires a
    // custom key that is not the platform key. We never fall back to - or
    // otherwise resolve to - the platform key, even when `customUrl` equals the
    // provider's official endpoint.
    if (!customKey || customKey === platformKey) {
      throw new UserConfigError(CUSTOM_ENDPOINT_ERROR)
    }

    // Layer 4 (return-point invariant): by construction `customKey` is now both
    // defined and distinct from the platform key. Assert it at the point of use
    // so platform credentials can never be returned for a user-controlled URL.
    if (platformKey !== undefined && customKey === platformKey) {
      throw new SystemError(
        `${label} custom-endpoint credential isolation violated`,
        'CREDENTIAL_ISOLATION'
      )
    }

    debug(`using custom ${label.toLowerCase()} key`)

    return customKey
  }

  // No custom endpoint: prefer the user's BYOK key, then the platform key.
  const key = customKey || platformKey

  if (!key) {
    throw new UserConfigError(`${label} API key is not configured`)
  }

  if (customKey) {
    debug(`using custom ${label.toLowerCase()} key`)
  }

  return key
}
