import { bodySchema as createBodySchema } from '@/pages/api/v1/policy/create'

describe('Policy Create Schema', () => {
  it('should accept valid policy creation with retention type', async () => {
    const validBody = {
      name: 'Test Retention Policy',
      description: 'Automatically expire conversations after 30 days',
      type: 'retention',
      config: {
        expiresInDays: 30,
      },
    }

    const result = await createBodySchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
    expect(result.name).toBe('Test Retention Policy')
    expect(result.type).toBe('retention')
    expect(result.config.expiresInDays).toBe(30)
  })

  it('should set default type to retention', async () => {
    const validBody = {
      name: 'Test Policy',
      description: 'Test description',
    }

    const result = await createBodySchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
    expect(result.type).toBe('retention')
  })

  it('should set default config to undefined when not provided', async () => {
    const validBody = {
      name: 'Test Policy',
      description: 'Test description',
      type: 'retention',
    }

    const result = await createBodySchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
    expect(result.config).toBeUndefined()
  })

  it('should reject invalid policy type', async () => {
    const invalidBody = {
      name: 'Test Policy',
      description: 'Test description',
      type: 'invalid_type',
      config: {},
    }

    try {
      await createBodySchema.validateAsync(invalidBody)

      throw new Error('Should have thrown validation error')
    } catch (error) {
      expect(error.message).toContain('must be one of [retention, usage]')
    }
  })

  it('should accept missing name field', async () => {
    const validBody = {
      description: 'Test description',
      type: 'retention',
      config: {},
    }

    const result = await createBodySchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
    expect(result.name).toBeUndefined()
    expect(result.type).toBe('retention')
  })

  // @note config gets a loose structural check against the union of shapes at
  // the body level; the authoritative type-specific validation lives in the
  // handler (parsePolicyConfig) and is covered by lib/policy.config.utest.js

  it('should accept a config that matches one of the union shapes', async () => {
    const validBody = {
      name: 'Token Guard',
      description: 'Block on heavy usage',
      type: 'usage',
      config: {
        metric: 'tokens',
        threshold: 100000,
        windowInSeconds: 600,
        actions: { block: { durationInSeconds: 600 } },
      },
    }

    const result = await createBodySchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
    expect(result.config.metric).toBe('tokens')
  })

  it('should reject a config with a wrong field type at the body level', async () => {
    const invalidBody = {
      name: 'Bad Field',
      description: 'expiresInDays must be a number',
      type: 'retention',
      config: { expiresInDays: 'soon' },
    }

    await expect(createBodySchema.validateAsync(invalidBody)).rejects.toThrow()
  })

  it('should accept a valid lifecycle state', async () => {
    const validBody = {
      name: 'Disabled Policy',
      description: 'Kept around but not enforced',
      type: 'retention',
      state: 'disabled',
    }

    const result = await createBodySchema.validateAsync(validBody)

    expect(result.error).toBeUndefined()
    expect(result.state).toBe('disabled')
  })

  it('should reject an invalid lifecycle state', async () => {
    const invalidBody = {
      name: 'Test Policy',
      description: 'Test description',
      type: 'retention',
      state: 'archived',
    }

    await expect(createBodySchema.validateAsync(invalidBody)).rejects.toThrow()
  })
})
