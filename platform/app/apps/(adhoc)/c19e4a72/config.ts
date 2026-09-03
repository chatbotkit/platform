import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Triage Inbox app (c19e4a72).
 *
 * @description Validates the `config` field from app.manifest. This app
 * provides a reimagined conversation inbox with filtering and triage capabilities.
 */
const ConfigSchema = z
  .object({
    filters: z
      .object({
        integration: z.boolean().default(true).describe('Show integration-related conversations'),
        safety: z.boolean().default(true).describe('Show safety-flagged conversations'),
        console: z.boolean().default(true).describe('Show console conversations'),
      })
      .passthrough()
      .default({
        integration: true,
        safety: true,
        console: true,
      })
      .describe('Filter options for conversation inbox visibility'),
  })
  .passthrough()

export default ConfigSchema
