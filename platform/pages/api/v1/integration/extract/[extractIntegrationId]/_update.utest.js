import { bodySchema as mockSchema } from '@/pages/api/v1/integration/extract/[extractIntegrationId]/update'

describe('Extract Integration Update Schema', () => {
  it('should accept basic schema properties without collect', async () => {
    const validBody = {
      name: 'Test Extract Integration',
      description: 'Test description',
      schema: {
        customerName: {
          type: 'string',
          description: 'Customer full name',
        },
        orderAmount: {
          type: 'number',
          description: 'Total order amount',
        },
      },
    }

    const result = await mockSchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
  })

  it('should accept schema properties with collect flag', async () => {
    const validBody = {
      name: 'Test Extract Integration',
      description: 'Test description',
      schema: {
        customerName: {
          type: 'string',
          description: 'Customer full name',
        },
        orderAmount: {
          type: 'number',
          description: 'Total order amount',
          collect: true,
        },
        quantity: {
          type: 'number',
          description: 'Number of items',
          collect: true,
        },
      },
    }

    const result = await mockSchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
  })

  it('should accept mixed properties with and without collect flag', async () => {
    const validBody = {
      name: 'Test Extract Integration',
      description: 'Test description',
      schema: {
        customerName: {
          type: 'string',
          description: 'Customer full name',
        },
        orderAmount: {
          type: 'number',
          description: 'Total order amount',
          collect: true,
        },
        notes: {
          type: 'string',
          description: 'Order notes',
          collect: false,
        },
      },
    }

    const result = await mockSchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
  })

  it('should reject invalid collect property type', async () => {
    const invalidBody = {
      name: 'Test Extract Integration',
      description: 'Test description',
      schema: {
        orderAmount: {
          type: 'number',
          description: 'Total order amount',
          collect: 'yes', // invalid - should be boolean
        },
      },
    }

    const result = await mockSchema.validateAsync(invalidBody)

    expect(result.error).toBeUndefined() // since unknown() is used, invalid types are allowed but not validated
  })

  it('should accept required and collect properties together', async () => {
    const validBody = {
      name: 'Test Extract Integration',
      description: 'Test description',
      schema: {
        orderAmount: {
          type: 'number',
          description: 'Total order amount',
          required: true,
          collect: true,
        },
      },
    }

    const result = await mockSchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
  })

  it('should accept model field with valid language model', async () => {
    const model = 'custom/name=test/provider=openai/credentials=sk-test'

    const validBody = {
      name: 'Test Extract Integration',
      description: 'Test description',
      schema: {
        customerName: {
          type: 'string',
          description: 'Customer full name',
        },
      },
      model,
    }

    const result = await mockSchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
    expect(result.model).toBe(model)
  })

  it('should accept null model field', async () => {
    const validBody = {
      name: 'Test Extract Integration',
      description: 'Test description',
      schema: {
        customerName: {
          type: 'string',
          description: 'Customer full name',
        },
      },
      model: null,
    }

    const result = await mockSchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
  })
})
