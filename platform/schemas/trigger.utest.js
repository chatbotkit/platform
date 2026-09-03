import trigger from '@/schemas/trigger'

describe('trigger schema', () => {
  it('should accept null', async () => {
    const value = await trigger.validateAsync(null)

    expect(value).toBeNull()
  })

  it('should accept valid trigger types', async () => {
    const validTriggers = ['never', 'automatic']

    for (const triggerType of validTriggers) {
      const value = await trigger.validateAsync(triggerType)

      expect(value).toBe(triggerType)
    }
  })

  it('should reject invalid trigger types', async () => {
    const invalidTriggers = ['invalid', 'random', 'test']

    for (const triggerType of invalidTriggers) {
      await expect(trigger.validateAsync(triggerType)).rejects.toThrow()
    }
  })

  it('should reject non-string values', async () => {
    const invalidValues = [123, {}, [], true]

    for (const value of invalidValues) {
      await expect(trigger.validateAsync(value)).rejects.toThrow()
    }
  })

  it('should accept undefined (schema allows optional values)', async () => {
    const value = await trigger.validateAsync(undefined)

    expect(value).toBeUndefined()
  })
})
