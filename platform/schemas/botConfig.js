// @ts-check
import schema from '@/lib/joi.schema'

import backstorySchema from '@/schemas/backstory'
import datasetIdSchema from '@/schemas/datasetId'
import languageModelSchema from '@/schemas/languageModel'
import skillsetIdSchema from '@/schemas/skillsetId'

export const botConfig = schema.object({
  backstory: backstorySchema,

  model: languageModelSchema,

  datasetId: datasetIdSchema('use'),
  skillsetId: skillsetIdSchema('use'),

  privacy: schema.boolean(),
  moderation: schema.boolean(),
})

export default botConfig
