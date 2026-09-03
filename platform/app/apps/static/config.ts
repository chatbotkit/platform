import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Static app.
 *
 * @description Validates the `config` field from app.manifest. This app
 * serves a configured space as a static website.
 */
const ConfigSchema = z
  .object({
    spaceId: z
      .string()
      .optional()
      .describe('Space ID to serve as a static website'),
    prefix: z
      .string()
      .optional()
      .describe('Optional folder prefix inside the configured space'),
    index: z
      .string()
      .optional()
      .default('index.html')
      .describe('Directory index filename'),
    notFound: z
      .string()
      .optional()
      .default('404.html')
      .describe('Not found filename'),
    directoryIndex: z
      .boolean()
      .optional()
      .default(true)
      .describe('Serve index files for directory-like paths'),
  })
  .passthrough()

export default ConfigSchema
