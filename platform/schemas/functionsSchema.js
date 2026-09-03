import schema from '@/lib/joi.schema'

import jsonSchema from '@/schemas/jsonSchema'

export const functionCallSchema = schema.object({
  start: schema.boolean(),
  end: schema.boolean(),
})

export const functionSchema = schema.object({
  name: schema
    .string()
    .pattern(/^(?!_)[A-Za-z$][A-Za-z0-9_$]*$/)
    .max(64)
    .messages({
      'string.pattern.base':
        'Name must be a valid JS function identifier and cannot start with underscore',
      'string.max': 'Name must be at most 64 characters long',
    })
    .required(),
  description: schema.string().required(),

  parameters: jsonSchema,

  result: schema
    .object({
      data: schema.any(),
      channel: schema.string(),
    })
    .or('data', 'channel')
    .messages({
      'object.missing': 'Result must include at least one of data or channel',
    }),

  call: functionCallSchema,
})

export default schema.array().items(functionSchema).unique('name').messages({
  'array.unique': 'Function names must be unique',
})
