import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Blueprint app (b7f4c2de).
 *
 * @description Validates the `config` field from app.manifest. This app
 * lists blueprints and allows opening each blueprint in a read-only designer.
 */
const ConfigSchema = z
  .object({
    blueprintIds: z
      .array(z.string())
      .optional()
      .describe('List of blueprint IDs to include in the list (if empty, shows none)'),
  })
  .passthrough()

export default ConfigSchema
