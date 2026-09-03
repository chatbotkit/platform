import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Agents app (e083ca0f).
 *
 * @description Validates the `config` field from app.manifest. This app
 * provides an agent customization experience for ChatBotKit.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
