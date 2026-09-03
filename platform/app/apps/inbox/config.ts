import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Inbox app.
 *
 * @description Validates the `config` field from app.manifest. The Inbox app
 * displays conversation history with filtering options.
 */
const ConfigSchema = z
  .object({
    filters: z
      .object({
        integration: z
          .boolean()
          .describe('Show integration-related conversations'),
        safety: z.boolean().describe('Show safety-flagged conversations'),
        console: z.boolean().describe('Show console/debug conversations'),
      })
      .passthrough()
      .default({
        integration: true,
        safety: true,
        console: true,
      })
      .describe('Filter configuration for conversation display'),
  })
  .passthrough()

export default ConfigSchema

/**
 * @doc Apps
 * @index 31
 *
 * ### Inbox Configuration
 *
 * Configure Inbox through the `config` field in `app.manifest` or in portal settings.
 *
 * | Field | Type | Default | Description |
 * | --- | --- | --- | --- |
 * | `filters.integration` | `boolean` | `true` | Show integration-related conversation tabs |
 * | `filters.safety` | `boolean` | `true` | Show safety-related tabs such as moderation |
 * | `filters.console` | `boolean` | `true` | Show console and debug tabs |
 *
 * Set any filter to `false` to remove that category from the sidebar. This is useful when you want a portal to expose only a subset of conversation views.
 */
