import jsonSchema, {
  looseJsonSchema,
  propertiesJsonSchema,
} from '@/schemas/jsonSchema'

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

describe('jsonSchema', () => {
  it('should validate a minimal object schema without properties', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
      }).error
    ).toBeUndefined()
  })

  it('should validate a minimal array schema without items', () => {
    expect(
      jsonSchema.validate({
        type: 'array',
      }).error
    ).toBeUndefined()
  })

  it('should validate object schema with additionalProperties boolean and no properties', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
        additionalProperties: true,
      }).error
    ).toBeUndefined()
  })

  it('should validate object schema with additionalProperties schema and no properties', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
        additionalProperties: {
          type: 'string',
        },
      }).error
    ).toBeUndefined()
  })

  it('should validate a valid schema of primitive types', () => {
    expect(
      jsonSchema.validate({
        type: 'string',
        description: 'A string',
      }).error
    ).toBeUndefined()

    expect(
      jsonSchema.validate({
        type: 'number',
        description: 'A number',
      }).error
    ).toBeUndefined()

    expect(
      jsonSchema.validate({
        type: 'boolean',
        description: 'A boolean',
      }).error
    ).toBeUndefined()
  })

  it('should validate a valid schema of object types', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
        description: 'An object',
        properties: {
          name: {
            type: 'string',
            description: 'A string',
          },
          age: {
            type: 'number',
            description: 'A number',
          },
        },
      }).error
    ).toBeUndefined()
  })

  it('should validate a valid schema of array types', () => {
    expect(
      jsonSchema.validate({
        type: 'array',
        description: 'An array',
        items: {
          type: 'string',
          description: 'A string',
        },
      }).error
    ).toBeUndefined()
  })

  it('should validate a valid schema of mixted nested types', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
        description: 'An object',
        properties: {
          name: {
            type: 'string',
            description: 'A string',
          },
          age: {
            type: 'number',
            description: 'A number',
          },
          children: {
            type: 'array',
            description: 'An array',
            items: {
              type: 'object',
              description: 'An object',
              properties: {
                name: {
                  type: 'string',
                  description: 'A string',
                },
                age: {
                  type: 'number',
                  description: 'A number',
                },
              },
            },
          },
        },
      }).error
    ).toBeUndefined()
  })

  it('should not validate an invalid schema', () => {
    expect(
      jsonSchema.validate({
        type: 'invalid',
        description: 'An invalid type',
      }).error
    ).toBeDefined()

    expect(
      jsonSchema.validate({
        type: 'object',
        description: 'An object',
        properties: {
          name: {
            type: 'invalid',
            description: 'An invalid type',
          },
        },
      }).error
    ).toBeDefined()

    expect(
      jsonSchema.validate({
        type: 'array',
        description: 'An array',
        items: {
          type: 'invalid',
          description: 'An invalid type',
        },
      }).error
    ).toBeDefined()
  })

  it('should reject required keys not defined in properties when properties exist', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
        properties: {
          known: { type: 'string' },
        },
        required: ['known', 'unknown'],
      }).error
    ).toBeDefined()
  })

  it('should allow required without properties for spec compatibility', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
        required: ['externalKey'],
      }).error
    ).toBeUndefined()
  })

  it('should reject duplicate entries in required', () => {
    expect(
      jsonSchema.validate({
        type: 'object',
        properties: {
          key: { type: 'string' },
        },
        required: ['key', 'key'],
      }).error
    ).toBeDefined()
  })

  it('should validate integer enum with only integer values', () => {
    expect(
      jsonSchema.validate({
        type: 'integer',
        enum: [1, 2, 3],
      }).error
    ).toBeUndefined()
  })

  it('should reject integer enum containing non-integer values', () => {
    expect(
      jsonSchema.validate({
        type: 'integer',
        enum: [1, 2.5, 3],
      }).error
    ).toBeDefined()
  })
})

describe('propertiesJsonSchema', () => {
  const validProperties = {
    language: {
      type: 'string',
      description:
        'The language used for the conversation, e.g. italian, spanish, english, etc..',
    },
    topic: {
      type: 'string',
      description: 'The main topic for the conversation',
    },
    questions: {
      type: 'array',
      description: 'Up to 5 questions that the user submitted',
      items: {
        type: 'string',
        description: 'The question content',
      },
    },
  }

  it('validates the provided properties schema', () => {
    const { error } = propertiesJsonSchema.validate(validProperties)

    expect(error).toBeUndefined()
  })

  it('fails when a property has an invalid type', () => {
    const { error } = propertiesJsonSchema.validate({
      ...validProperties,

      language: {
        ...validProperties.language,
        type: 'invalid',
      },
    })

    expect(error).toBeDefined()
  })

  it('fails when array items have invalid type', () => {
    const { error } = propertiesJsonSchema.validate({
      ...validProperties,

      questions: {
        ...validProperties.questions,
        items: {
          type: 'invalid',
          description: 'The question content',
        },
      },
    })

    expect(error).toBeDefined()
  })

  describe('zod-to-json-schema compatibility', () => {
    it('validates string schemas converted from zod', () => {
      const zodSchema = z.object({
        name: z.string().describe('User name'),
        email: z.string().email().describe('Email address'),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: nameError } = jsonSchema.validate(properties.name)

      expect(nameError).toBeUndefined()

      const { error: emailError } = jsonSchema.validate(properties.email)

      expect(emailError).toBeUndefined()
    })

    it('validates number schemas with constraints from zod', () => {
      const zodSchema = z.object({
        age: z.number().int().min(0).max(120).describe('Age in years'),
        price: z.number().positive().multipleOf(0.01).describe('Price in USD'),
        rating: z.number().min(1).max(5).describe('Rating'),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: ageError } = jsonSchema.validate(properties.age)

      expect(ageError).toBeUndefined()

      const { error: priceError } = jsonSchema.validate(properties.price)

      expect(priceError).toBeUndefined()

      const { error: ratingError } = jsonSchema.validate(properties.rating)

      expect(ratingError).toBeUndefined()
    })

    it('validates boolean schemas from zod', () => {
      const zodSchema = z.object({
        isActive: z.boolean().describe('Active status'),
        verified: z.boolean(),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: isActiveError } = jsonSchema.validate(properties.isActive)

      expect(isActiveError).toBeUndefined()

      const { error: verifiedError } = jsonSchema.validate(properties.verified)

      expect(verifiedError).toBeUndefined()
    })

    it('validates array schemas from zod', () => {
      const zodSchema = z.object({
        tags: z.array(z.string()).describe('List of tags'),
        scores: z.array(z.number()),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: tagsError } = jsonSchema.validate(properties.tags)

      expect(tagsError).toBeUndefined()

      const { error: scoresError } = jsonSchema.validate(properties.scores)

      expect(scoresError).toBeUndefined()
    })

    it('validates nested object schemas from zod', () => {
      const zodSchema = z.object({
        user: z
          .object({
            name: z.string(),
            age: z.number(),
            email: z.string().email(),
          })
          .describe('User information'),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: userError } = jsonSchema.validate(properties.user)

      expect(userError).toBeUndefined()
    })

    it('validates complex nested schemas from zod', () => {
      const zodSchema = z.object({
        users: z
          .array(
            z.object({
              name: z.string(),
              age: z.number().min(0),
              roles: z.array(z.string()),
              metadata: z.object({
                createdAt: z.string(),
                active: z.boolean(),
              }),
            })
          )
          .describe('List of users'),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error } = jsonSchema.validate(properties.users)

      expect(error).toBeUndefined()
    })

    it('validates string schemas with length constraints from zod', () => {
      const zodSchema = z.object({
        username: z.string().min(3).max(20).describe('Username'),
        bio: z.string().max(500),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: usernameError } = jsonSchema.validate(properties.username)

      expect(usernameError).toBeUndefined()

      const { error: bioError } = jsonSchema.validate(properties.bio)

      expect(bioError).toBeUndefined()
    })

    it('validates enum schemas from zod', () => {
      const zodSchema = z.object({
        status: z.enum(['active', 'inactive', 'pending']).describe('Status'),
        priority: z.enum(['low', 'medium', 'high']),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: statusError } = looseJsonSchema.validate(properties.status)

      expect(statusError).toBeUndefined()

      const { error: priorityError } = looseJsonSchema.validate(
        properties.priority
      )

      expect(priorityError).toBeUndefined()
    })

    it('validates the entire properties object from zod schema', () => {
      const zodSchema = z.object({
        language: z
          .string()
          .describe(
            'The language used for the conversation, e.g. italian, spanish, english, etc..'
          ),
        topic: z.string().describe('The main topic for the conversation'),
        questions: z
          .array(z.string().describe('The question content'))
          .max(5)
          .describe('Up to 5 questions that the user submitted'),
        metadata: z.object({
          timestamp: z.string(),
          version: z.number(),
        }),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error } = propertiesJsonSchema.validate(properties)

      expect(error).toBeUndefined()
    })

    it('validates schemas with default values from zod', () => {
      const zodSchema = z.object({
        name: z.string().default('Anonymous'),
        count: z.number().default(0),
        enabled: z.boolean().default(false),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: nameError } = looseJsonSchema.validate(properties.name)

      expect(nameError).toBeUndefined()

      const { error: countError } = looseJsonSchema.validate(properties.count)

      expect(countError).toBeUndefined()

      const { error: enabledError } = looseJsonSchema.validate(
        properties.enabled
      )

      expect(enabledError).toBeUndefined()
    })

    it('validates integer type from zod int() modifier', () => {
      const zodSchema = z.object({
        count: z.number().int().describe('Item count'),
        userId: z.number().int().positive(),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      // @note zod-to-json-schema converts .int() to type: 'integer'
      expect(properties.count.type).toBe('integer')
      expect(properties.userId.type).toBe('integer')

      const { error: countError } = jsonSchema.validate(properties.count)

      expect(countError).toBeUndefined()

      const { error: userIdError } = jsonSchema.validate(properties.userId)

      expect(userIdError).toBeUndefined()
    })

    it('validates schemas with exclusiveMinimum as boolean', () => {
      const zodSchema = z.object({
        price: z.number().positive(),
        discount: z.number().min(0).max(1),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      // @note zod positive() generates exclusiveMinimum: true
      expect(properties.price.exclusiveMinimum).toBe(true)

      const { error: priceError } = looseJsonSchema.validate(properties.price)

      expect(priceError).toBeUndefined()
    })

    it('validates objects with additionalProperties', () => {
      const zodSchema = z.object({
        metadata: z
          .object({
            key: z.string(),
          })
          .describe('Metadata object'),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      // @note zod-to-json-schema adds additionalProperties: false by default
      expect(properties.metadata.additionalProperties).toBe(false)

      const { error } = looseJsonSchema.validate(properties.metadata)

      expect(error).toBeUndefined()
    })

    it('validates array with minItems and maxItems', () => {
      const zodSchema = z.object({
        tags: z.array(z.string()).min(1).max(10).describe('Tags'),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error } = looseJsonSchema.validate(properties.tags)

      expect(error).toBeUndefined()
    })

    it('validates optional fields from zod', () => {
      const zodSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: requiredError } = jsonSchema.validate(properties.required)

      expect(requiredError).toBeUndefined()

      const { error: optionalError } = jsonSchema.validate(properties.optional)

      expect(optionalError).toBeUndefined()
    })

    it('validates complex real-world agent tool schemas', () => {
      // @note this mimics the actual tool schemas used in the agent system
      const zodSchema = z.object({
        plan: z.object({
          steps: z
            .array(z.string())
            .describe('Array of step descriptions in order of execution'),
          rationale: z
            .string()
            .optional()
            .describe('Brief explanation of the plan approach'),
        }),
        progress: z.object({
          completed: z
            .array(z.string())
            .optional()
            .describe('Steps that have been completed'),
          current: z
            .string()
            .optional()
            .describe('Current step being worked on'),
          blockers: z
            .array(z.string())
            .optional()
            .describe('Any issues preventing progress'),
          nextSteps: z
            .array(z.string())
            .optional()
            .describe('Next actions to take'),
        }),
        exit: z.object({
          code: z
            .number()
            .int()
            .min(0)
            .max(255)
            .describe('Exit status code (0 = success, non-zero = failure)'),
          message: z
            .string()
            .optional()
            .describe('Optional message explaining the exit reason'),
        }),
      })

      const converted = zodToJsonSchema(zodSchema, { target: 'openApi3' })
      const properties = converted.properties

      const { error: planError } = looseJsonSchema.validate(properties.plan)

      expect(planError).toBeUndefined()

      const { error: progressError } = looseJsonSchema.validate(
        properties.progress
      )

      expect(progressError).toBeUndefined()

      const { error: exitError } = looseJsonSchema.validate(properties.exit)

      expect(exitError).toBeUndefined()

      // validate the entire properties object
      const { error: allError } = propertiesJsonSchema.validate(properties)

      expect(allError).toBeUndefined()
    })
  })
})
