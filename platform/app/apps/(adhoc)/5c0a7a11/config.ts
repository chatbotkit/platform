import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Live Conversations app (5c0a7a11).
 *
 * @description Validates the `config` field from app.manifest. This app
 * monitors active conversations and inspects the agent execution stream as
 * it happens.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema

