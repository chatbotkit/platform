// @ts-check
import schema from '@/lib/joi.schema'

function validateRequiredKeys(required, helpers) {
  const parent = helpers.state.ancestors?.[0]

  if (!parent?.properties || typeof parent.properties !== 'object') {
    return required
  }

  const knownPropertyNames = new Set(Object.keys(parent.properties))
  const unknownRequiredKeys = required.filter(
    (key) => !knownPropertyNames.has(key)
  )

  if (unknownRequiredKeys.length > 0) {
    return helpers.message(
      `"required" contains keys not present in "properties": ${unknownRequiredKeys.join(', ')}`
    )
  }

  return required
}

/**
 * A schema that validates JSON Schema structures allowing for additional
 * unknown properties to support extended JSON Schema use cases.
 */
export const looseJsonSchema = schema
  .alternatives()
  .try(
    // string
    schema
      .object({
        type: schema.string().valid('string').required(),
        description: schema.string().allow(''),
        enum: schema.array().items(schema.string()),
        minLength: schema.number().integer().min(0),
        maxLength: schema.number().integer().min(0),
        pattern: schema.string(),
        format: schema.string(),
        default: schema.any(),
      })
      .unknown(true)
      .id('string'),
    // number
    schema
      .object({
        type: schema.string().valid('number', 'integer').required(),
        description: schema.string().allow(''),
        enum: schema.alternatives().conditional('type', {
          is: 'integer',
          then: schema.array().items(schema.number().integer()),
          otherwise: schema.array().items(schema.number()),
        }),
        minimum: schema.number(),
        maximum: schema.number(),
        exclusiveMinimum: schema
          .alternatives()
          .try(schema.number(), schema.boolean()),
        exclusiveMaximum: schema
          .alternatives()
          .try(schema.number(), schema.boolean()),
        multipleOf: schema.number().positive(),
        default: schema.any(),
      })
      .unknown(true)
      .id('number'),
    // boolean
    schema
      .object({
        type: schema.string().valid('boolean').required(),
        description: schema.string().allow(''),
        default: schema.any(),
      })
      .unknown(true)
      .id('boolean'),
    // object
    schema
      .object({
        type: schema.string().valid('object').required(),
        description: schema.string().allow(''),
        properties: schema
          .object()
          .pattern(/^/, schema.link('#root'))
          .optional(),
        required: schema
          .array()
          .items(schema.string())
          .unique()
          .custom(validateRequiredKeys),
        additionalProperties: schema
          .alternatives()
          .try(schema.boolean(), schema.link('#root')),
        default: schema.any(),
      })
      .unknown(true)
      .id('object'),
    // array
    schema
      .object({
        type: schema.string().valid('array').required(),
        description: schema.string().allow(''),
        items: schema.link('#root').optional(),
        default: schema.any(),
      })
      .unknown(true)
      .id('array'),
    // empty
    schema.object().keys({}).max(0)
  )
  .id('root')

/**
 * A schema that validates JSON Schema properties (unwrapped object)
 */
export const propertiesJsonSchema = schema
  .object()
  .pattern(/^/, looseJsonSchema)
  .id('root')

/**
 * A schema that validates all types combined
 *
 * @todo add missing types, and other validation rules
 */
export default schema
  .alternatives()
  .try(
    // string
    schema
      .object({
        type: schema.string().valid('string').required(),
        description: schema.string().allow(''),
        enum: schema.array().items(schema.string()),
        minLength: schema.number().integer().min(0),
        maxLength: schema.number().integer().min(0),
        pattern: schema.string(),
        format: schema.string(),
        default: schema.any(),
      })
      .id('string'),
    // number
    schema
      .object({
        type: schema.string().valid('number', 'integer').required(),
        description: schema.string().allow(''),
        enum: schema.alternatives().conditional('type', {
          is: 'integer',
          then: schema.array().items(schema.number().integer()),
          otherwise: schema.array().items(schema.number()),
        }),
        minimum: schema.number(),
        maximum: schema.number(),
        exclusiveMinimum: schema
          .alternatives()
          .try(schema.number(), schema.boolean()),
        exclusiveMaximum: schema
          .alternatives()
          .try(schema.number(), schema.boolean()),
        multipleOf: schema.number().positive(),
        default: schema.any(),
      })
      .id('number'),
    // boolean
    schema
      .object({
        type: schema.string().valid('boolean').required(),
        description: schema.string().allow(''),
        default: schema.any(),
      })
      .id('boolean'),
    // object
    schema
      .object({
        type: schema.string().valid('object').required(),
        description: schema.string().allow(''),
        properties: schema
          .object()
          .pattern(/^/, schema.link('#root'))
          .optional(),
        required: schema
          .array()
          .items(schema.string())
          .unique()
          .custom(validateRequiredKeys),
        additionalProperties: schema
          .alternatives()
          .try(schema.boolean(), schema.link('#root')),
        default: schema.any(),
      })
      .id('object'),
    // array
    schema
      .object({
        type: schema.string().valid('array').required(),
        description: schema.string().allow(''),
        items: schema.link('#root').optional(),
        default: schema.any(),
      })
      .id('array'),
    // empty
    schema.object().keys({}).max(0)
  )
  .id('root')
