import { z } from '@/lib/zod.schema'

// --- Schemas ---

export const diligenceFeatureSchema = z
  .object({
    name: z.literal('diligence'),
  })
  .strict()

export const personalizationFeatureSchema = z
  .object({
    name: z.literal('personalization'),
  })
  .strict()

export const memoryFeatureSchema = z
  .object({
    name: z.literal('memory'),
  })
  .strict()

export const taskFeatureSchema = z
  .object({
    name: z.literal('task'),
  })
  .strict()

export const timeFeatureSchema = z
  .object({
    name: z.literal('time'),
  })
  .strict()

export const timeoutMarksFeatureSchema = z
  .object({
    name: z.literal('timeoutMarks'),
  })
  .strict()

export const markdownFeatureSchema = z
  .object({
    name: z.literal('markdown'),
  })
  .strict()

export const buttonsFeatureSchema = z
  .object({
    name: z.literal('buttons'),
  })
  .strict()

export const mathFeatureSchema = z
  .object({
    name: z.literal('math'),
  })
  .strict()

export const referencesFeatureSchema = z
  .object({
    name: z.literal('references'),
  })
  .strict()

export const carouselFeatureSchema = z
  .object({
    name: z.literal('carousel'),
  })
  .strict()

export const formFeatureSchema = z
  .object({
    name: z.literal('form'),
  })
  .strict()

export const mermaidFeatureSchema = z
  .object({
    name: z.literal('mermaid'),
  })
  .strict()

export const audioFeatureSchema = z
  .object({
    name: z.literal('audio'),
  })
  .strict()

export const canvasFeatureSchema = z
  .object({
    name: z.literal('canvas'),
  })
  .strict()

export const footnotesFeatureSchema = z
  .object({
    name: z.literal('footnotes'),
  })
  .strict()

export const batchFeatureSchema = z
  .object({
    name: z.literal('batch'),
    options: z
      .object({
        // @note when set, the run is only considered finished once the model
        // calls `_success` / `_failure`. A turn that ends otherwise (the model
        // stops talking) is treated as an unsettled continuation: the engine
        // nudges it to keep going and surfaces the turn as an `iteration` so the
        // caller's normal continuation loop drives it to settlement.
        settle: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const silentFeatureSchema = z
  .object({
    name: z.literal('silent'),
  })
  .strict()

export const answerFeatureSchema = z
  .object({
    name: z.literal('answer'),
  })
  .strict()

export const visionFeatureSchema = z
  .object({
    name: z.literal('vision'),
  })
  .strict()

export const attachmentsFeatureSchema = z
  .object({
    name: z.literal('attachments'),
  })
  .strict()

export const datasetFeatureSchema = z
  .object({
    name: z.literal('dataset'),
  })
  .strict()

export const skillsetFeatureSchema = z
  .object({
    name: z.literal('skillset'),
  })
  .strict()

export const authFeatureSchema = z
  .object({
    name: z.literal('auth'),
  })
  .strict()

export const chunkingFeatureSchema = z
  .object({
    name: z.literal('chunking'),
  })
  .strict()

export const noFeaturesFeatureSchema = z
  .object({
    name: z.literal('noFeatures'),
  })
  .strict()

export const noFunctionsFeatureSchema = z
  .object({
    name: z.literal('noFunctions'),
  })
  .strict()

export const noInlineDatasetsFeatureSchema = z
  .object({
    name: z.literal('noInlineDatasets'),
  })
  .strict()

export const noInlineSkillsetsFeatureSchema = z
  .object({
    name: z.literal('noInlineSkillsets'),
  })
  .strict()

export const bpaccFeatureSchema = z
  .object({
    name: z.literal('bpacc'),
  })
  .strict()

export const reprogrammingFeatureSchema = z
  .object({
    name: z.literal('reprogramming'),
  })
  .strict()

export const justificationFeatureSchema = z
  .object({
    name: z.literal('justification'),
  })
  .strict()

export const compactFeatureOptionsSchema = z
  .object({
    tokens: z.number().int().positive().optional(),
    messages: z.number().int().positive().optional(),
  })
  .strict()
  .refine((options) => {
    return (
      typeof options.tokens === 'number' || typeof options.messages === 'number'
    )
  }, 'At least one of options.tokens or options.messages must be provided')

export const compactFeatureSchema = z
  .object({
    name: z.literal('compact'),
    options: compactFeatureOptionsSchema,
  })
  .strict()

export const webFeatureOptionsSchema = z
  .object({
    search: z.boolean().optional(),
    fetch: z.boolean().optional(),
  })
  .strict()

export const webFeatureSchema = z
  .object({
    name: z.literal('web'),
    options: webFeatureOptionsSchema.optional(),
  })
  .strict()

export const skillsFeatureSkillSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    path: z.string(),
  })
  .strict()

export const skillsFeatureOptionsSchema = z
  .object({
    skills: z.array(skillsFeatureSkillSchema),
  })
  .strict()

export const skillsFeatureSchema = z
  .object({
    name: z.literal('skills'),
    options: skillsFeatureOptionsSchema,
  })
  .strict()

export const backstoryFeatureSchema = z
  .object({
    name: z.literal('backstory'),
    options: z
      .object({
        mode: z.enum(['extend', 'replace']),
        text: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict()

export const notesFeatureSchema = z
  .object({
    name: z.literal('notes'),
    options: z
      .object({
        // @note each entry is a short "nota bene" note appended to the backstory
        // for this run, rendered as an emphatic `!NB:` line. This is the
        // array-friendly shorthand for repeating a `backstory` extend feature
        // once per note. Blank entries are rejected; an empty array is a no-op.
        notes: z.array(z.string().trim().min(1)),
      })
      .strict(),
  })
  .strict()

export const bashFeatureSchema = z
  .object({
    name: z.literal('bash'),
  })
  .strict()

export const userInfoFeatureOptionsSchema = z
  .object({
    name: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    externalId: z.string().optional(),
    source: z.string().optional(),
  })
  .strict()

export const userInfoFeatureSchema = z
  .object({
    name: z.literal('userInfo'),
    options: userInfoFeatureOptionsSchema,
  })
  .strict()

export const featureSchema = z.discriminatedUnion('name', [
  diligenceFeatureSchema,
  personalizationFeatureSchema,
  memoryFeatureSchema,
  taskFeatureSchema,
  timeFeatureSchema,
  timeoutMarksFeatureSchema,
  markdownFeatureSchema,
  buttonsFeatureSchema,
  mathFeatureSchema,
  referencesFeatureSchema,
  carouselFeatureSchema,
  formFeatureSchema,
  mermaidFeatureSchema,
  audioFeatureSchema,
  canvasFeatureSchema,
  footnotesFeatureSchema,
  batchFeatureSchema,
  silentFeatureSchema,
  answerFeatureSchema,
  visionFeatureSchema,
  attachmentsFeatureSchema,
  datasetFeatureSchema,
  skillsetFeatureSchema,
  authFeatureSchema,
  webFeatureSchema,
  chunkingFeatureSchema,
  noFeaturesFeatureSchema,
  noFunctionsFeatureSchema,
  noInlineDatasetsFeatureSchema,
  noInlineSkillsetsFeatureSchema,
  bpaccFeatureSchema,
  reprogrammingFeatureSchema,
  justificationFeatureSchema,
  compactFeatureSchema,
  skillsFeatureSchema,
  backstoryFeatureSchema,
  notesFeatureSchema,
  bashFeatureSchema,
  userInfoFeatureSchema,
])

// --- Types ---

export type DiligenceFeature = z.infer<typeof diligenceFeatureSchema>
export type PersonalizationFeature = z.infer<
  typeof personalizationFeatureSchema
>
export type MemoryFeature = z.infer<typeof memoryFeatureSchema>
export type TaskFeature = z.infer<typeof taskFeatureSchema>
export type TimeFeature = z.infer<typeof timeFeatureSchema>
export type TimeoutMarksFeature = z.infer<typeof timeoutMarksFeatureSchema>
export type MarkdownFeature = z.infer<typeof markdownFeatureSchema>
export type ButtonsFeature = z.infer<typeof buttonsFeatureSchema>
export type MathFeature = z.infer<typeof mathFeatureSchema>
export type ReferencesFeature = z.infer<typeof referencesFeatureSchema>
export type CarouselFeature = z.infer<typeof carouselFeatureSchema>
export type FormFeature = z.infer<typeof formFeatureSchema>
export type MermaidFeature = z.infer<typeof mermaidFeatureSchema>
export type AudioFeature = z.infer<typeof audioFeatureSchema>
export type CanvasFeature = z.infer<typeof canvasFeatureSchema>
export type FootnotesFeature = z.infer<typeof footnotesFeatureSchema>
export type BatchFeature = z.infer<typeof batchFeatureSchema>
export type SilentFeature = z.infer<typeof silentFeatureSchema>
export type AnswerFeature = z.infer<typeof answerFeatureSchema>
export type VisionFeature = z.infer<typeof visionFeatureSchema>
export type AttachmentsFeature = z.infer<typeof attachmentsFeatureSchema>
export type DatasetFeature = z.infer<typeof datasetFeatureSchema>
export type SkillsetFeature = z.infer<typeof skillsetFeatureSchema>
export type AuthFeature = z.infer<typeof authFeatureSchema>
export type WebFeature = z.infer<typeof webFeatureSchema>
export type ChunkingFeature = z.infer<typeof chunkingFeatureSchema>
export type NoFeaturesFeature = z.infer<typeof noFeaturesFeatureSchema>
export type NoFunctionsFeature = z.infer<typeof noFunctionsFeatureSchema>
export type NoInlineDatasetsFeature = z.infer<
  typeof noInlineDatasetsFeatureSchema
>
export type NoInlineSkillsetsFeature = z.infer<
  typeof noInlineSkillsetsFeatureSchema
>
export type BpaccFeature = z.infer<typeof bpaccFeatureSchema>
export type ReprogrammingFeature = z.infer<typeof reprogrammingFeatureSchema>
export type JustificationFeature = z.infer<typeof justificationFeatureSchema>
export type CompactFeature = z.infer<typeof compactFeatureSchema>
export type SkillsFeature = z.infer<typeof skillsFeatureSchema>
export type BackstoryFeature = z.infer<typeof backstoryFeatureSchema>
export type NotesFeature = z.infer<typeof notesFeatureSchema>
export type BashFeature = z.infer<typeof bashFeatureSchema>
export type UserInfoFeature = z.infer<typeof userInfoFeatureSchema>

export type Feature = z.infer<typeof featureSchema>
