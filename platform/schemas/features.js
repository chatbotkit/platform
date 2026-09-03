// @ts-check
import { featureSchema } from '@/lib/conversation.features'
import schema from '@/lib/joi.schema'

const requestFeatureSchema = featureSchema.refine(
  ({ name }) => name !== 'bpacc',
  {
    message: 'bpacc is not allowed in request features',
  }
)

export default schema
  .array()
  .items(schema.object().zodSchema(requestFeatureSchema))
