import { PolicyType } from '@/prisma/types'
import { RetentionPolicyConfig, UsagePolicyConfig } from '@/prisma/zod'

import type { z } from 'zod'

/**
 * The config schema for each policy type. The Policy row's `type` column is the
 * authoritative discriminator (config carries no `type`), so the correct shape
 * is selected here by `type` rather than from inside the JSON.
 */
const SCHEMA_BY_TYPE: Record<string, z.ZodTypeAny> = {
  [PolicyType.retention]: RetentionPolicyConfig,
  [PolicyType.usage]: UsagePolicyConfig,
}

/**
 * Validate a policy `config` against the schema selected by the policy `type`.
 *
 * Returns the parsed config; `null`/`undefined` pass through unchanged (a policy
 * may carry no config). Throws a `ZodError` when the config does not match the
 * type, and a plain `Error` for an unknown type.
 *
 * @throws {Error} when config is invalid for the type
 */
export function parsePolicyConfig(type: string, config: unknown): unknown {
  if (config === null || config === undefined) {
    return config
  }

  const schema = SCHEMA_BY_TYPE[type]

  if (!schema) {
    throw new Error(`unknown policy type: ${type}`)
  }

  return schema.parse(config)
}
