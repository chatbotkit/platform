import messageTypeSchema from '@/schemas/messageType'

jest.mock('@/prisma/types', () => ({
  MessageType: {
    user: 'user',
    bot: 'bot',
    reasoning: 'reasoning',
    context: 'context',
    instruction: 'instruction',
    backstory: 'backstory',
    activity: 'activity',
  },
}))

describe('messageTypeSchema', () => {
  it('should validate user message type', () => {
    const result = messageTypeSchema.validate('user')

    expect(result).toEqual({ value: 'user' })
  })

  it('should validate bot message type', () => {
    const result = messageTypeSchema.validate('bot')

    expect(result).toEqual({ value: 'bot' })
  })

  it('should validate reasoning message type', () => {
    const result = messageTypeSchema.validate('reasoning')

    expect(result).toEqual({ value: 'reasoning' })
  })

  it('should validate context message type', () => {
    const result = messageTypeSchema.validate('context')

    expect(result).toEqual({ value: 'context' })
  })

  it('should validate instruction message type', () => {
    const result = messageTypeSchema.validate('instruction')

    expect(result).toEqual({ value: 'instruction' })
  })

  it('should validate backstory message type', () => {
    const result = messageTypeSchema.validate('backstory')

    expect(result).toEqual({ value: 'backstory' })
  })

  it('should validate activity message type', () => {
    const result = messageTypeSchema.validate('activity')

    expect(result).toEqual({ value: 'activity' })
  })

  it('should reject invalid message type', () => {
    const result = messageTypeSchema.validate('invalid')

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('must be one of')
  })

  it('should reject empty string', () => {
    const result = messageTypeSchema.validate('')

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('must be one of')
  })

  it('should reject null values', () => {
    const result = messageTypeSchema.validate(null)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('must be one of')
  })

  it('should reject non-string values', () => {
    const result = messageTypeSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('must be one of')
  })

  it('should reject array values', () => {
    const result = messageTypeSchema.validate(['user'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('must be one of')
  })

  it('should reject object values', () => {
    const result = messageTypeSchema.validate({ type: 'user' })

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('must be one of')
  })

  it('should be case-sensitive', () => {
    const result = messageTypeSchema.validate('USER')

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('must be one of')
  })
})
