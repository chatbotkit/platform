/**
 * Credential output masking - the runtime half of the credential-output
 * policy. The classification of every credential column lives next door in
 * `credential.policy.ts`; this module carries the sentinel and the helpers the
 * fetch/list/update routes and the graph use to honour a `masked` entry.
 *
 * A masked credential is never echoed back. A read path returns
 * `MASK_SENTINEL` when the column holds a value and `null` when it does not,
 * so a client can tell "configured" from "unset" without ever seeing the
 * value. A write path that receives the sentinel treats it as "keep what is
 * stored" - the UI round-trips the fetched form back on save, and the
 * sentinel is what stops that round trip from overwriting the credential with
 * eight asterisks.
 */

import { getCredentialColumns } from '@/lib/credential.policy'

import type { CREDENTIAL_POLICY } from '@/lib/credential.policy'

export const MASK_SENTINEL = '********'

/**
 * Whether an incoming value is the mask sentinel (a client echoing back what
 * it fetched rather than supplying a new credential).
 */
export function isMaskSentinel(value: unknown): value is typeof MASK_SENTINEL {
  return value === MASK_SENTINEL
}

/**
 * Return a shallow copy of `row` with every listed field replaced by the
 * sentinel when set and `null` otherwise. Fields absent from the row are left
 * absent, so a route that did not select a column does not grow one.
 */
export function maskCredentials<T extends object, K extends keyof T>(
  row: T,
  fields: readonly K[]
): Omit<T, K> & Record<K, typeof MASK_SENTINEL | null> {
  const masked: Record<string, unknown> = { ...(row as Record<string, unknown>) }

  for (const field of fields) {
    if (!(field in masked)) {
      continue
    }

    masked[field as string] = masked[field as string] ? MASK_SENTINEL : null
  }

  return masked as Omit<T, K> & Record<K, typeof MASK_SENTINEL | null>
}

/**
 * `maskCredentials` driven by the policy table: every column of `model`
 * classified `masked` in `CREDENTIAL_POLICY` is replaced by the sentinel when
 * set and `null` otherwise. The one-liner a fetch/list route wants.
 */
export function maskModelCredentials<
  M extends keyof typeof CREDENTIAL_POLICY,
  T extends object,
>(model: M, row: T) {
  return maskCredentials(
    row,
    getCredentialColumns(model, 'masked') as unknown as readonly (keyof T)[]
  )
}

/**
 * Return a shallow copy of an update body with every listed field that carries
 * the sentinel set to `undefined`, which prisma reads as "do not touch this
 * column". Real values, `null` (clear) and `''` pass through untouched so each
 * route keeps its own clear/blank semantics.
 */
export function unmaskCredentials<T extends object, K extends keyof T>(
  body: T,
  fields: readonly K[]
): T {
  const unmasked: Record<string, unknown> = { ...(body as Record<string, unknown>) }

  for (const field of fields) {
    if (isMaskSentinel(unmasked[field as string])) {
      unmasked[field as string] = undefined
    }
  }

  return unmasked as T
}

/**
 * The keys inside `Secret.config` that hold a credential. The config is a
 * free-form JSON column, so this is the explicit list of what counts - today
 * only the OAuth client secret (typed by the user, or written by dynamic
 * client registration in `oauth.registration.ts`).
 */
export const SECRET_CONFIG_CREDENTIAL_KEYS = ['clientSecret'] as const

type JsonObjectLike = Record<string, unknown> | null | undefined

/**
 * Mask the credential keys inside a `Secret.config` object for output. A
 * non-object config (null, undefined, or a non-object JSON value) is returned
 * as-is.
 */
export function maskSecretConfig<T extends JsonObjectLike>(config: T): T {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config
  }

  return maskCredentials(
    config as Record<string, unknown>,
    SECRET_CONFIG_CREDENTIAL_KEYS as unknown as readonly string[]
  ) as T
}

/**
 * Merge an incoming `Secret.config` over the stored one for a write: every
 * credential key that arrives as the sentinel is restored from `existing`.
 * An incoming `null`/`undefined` config is returned untouched (null clears,
 * undefined leaves the column alone - the route decides).
 */
export function unmaskSecretConfig<T extends JsonObjectLike>(
  config: T,
  existing: JsonObjectLike
): T {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return config
  }

  const merged: Record<string, unknown> = { ...config }

  for (const key of SECRET_CONFIG_CREDENTIAL_KEYS) {
    if (isMaskSentinel(merged[key])) {
      if (existing && typeof existing === 'object' && key in existing) {
        merged[key] = existing[key]
      } else {
        delete merged[key]
      }
    }
  }

  return merged as T
}
