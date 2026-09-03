import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Multi Agent Chat app (6c4a7b9e).
 *
 * @description Validates the `config` field from app.manifest. This app uses
 * embedded chat sessions in a horizontally scrollable workspace.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
