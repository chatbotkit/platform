import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Media Graph app (f2a9c7d4).
 *
 * @description Validates the `config` field from app.manifest. This app lets
 * users build a graph of AI generated images where each node is an image
 * derived from a prompt and/or one or more parent images.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema
