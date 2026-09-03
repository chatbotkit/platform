// @ts-check
import schema from '@/lib/joi.schema'
import { parseImageModel } from '@/lib/model.utils'

// import { defaultImageModel } from '@/config/models'

export default schema
  .string()
  .allow(null, '') // the reason we allow this is because we want to allow partial updates
  // .default(defaultImageModel) // the reason this line is disabled is because we want to allow this schema to be used in the update route
  .custom((value) => {
    if (value) {
      parseImageModel(value)
    }

    return value
  }, 'model')
