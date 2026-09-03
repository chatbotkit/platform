import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Connect app.
 *
 * @description Validates the `config` field from app.manifest. The Connect app
 * allows users to connect to external services and manage OAuth integrations.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 21
 *
 * ### Connect Configuration
 *
 * The Connect app currently has no dedicated configuration fields. It works with an empty `config` object and is ready to use as soon as the app is added.
 */
