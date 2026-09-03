import z from '@/lib/zod.schema'

/**
 * Configuration schema for the Note Stream app (95ca8b4c).
 *
 * @description Validates the `config` field from app.manifest. This app
 * captures a live transcript of in-person meetings and notes, feeds it into a
 * contact-scoped conversation as context, and lets the user ask questions
 * against that running context.
 */
const ConfigSchema = z
  .object({
    // Optional model to use when answering questions. Falls back to the
    // platform default when omitted.
    model: z.string().optional(),
  })
  .passthrough()

export default ConfigSchema
