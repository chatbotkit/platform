import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Trace app.
 *
 * @description Validates the `config` field from app.manifest. The Trace app
 * is a client-only analytics and debugging tool.
 */
const ConfigSchema = z
  .object({
    // Currently no specific config fields required - client-only app
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 61
 *
 * ### Trace Configuration
 *
 * The Trace app currently has no dedicated configuration fields. It is a client-only debugging tool and does not require portal-specific setup.
 */
