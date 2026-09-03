import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Slack Integrations app (f49c75da).
 *
 * @description Validates the `config` field from app.manifest. This app
 * manages Slack integration configurations.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
