import messagesSchema from '@/schemas/messages'

describe('messagesSchema', () => {
  it('must correctly validate', () => {
    expect(messagesSchema.validate([]).error).toBeUndefined()
  })

  it('must accept a valid message', async () => {
    const validMessage = {
      type: 'bot',
      text: 'This should pass',
    }

    await expect(
      messagesSchema.validateAsync([validMessage])
    ).resolves.not.toThrow()
  })

  it('must reject an invalid message', async () => {
    const invalidMessage = {
      type: 'invalidType',
      text: 'This should fail',
    }

    await expect(
      messagesSchema.validateAsync([invalidMessage])
    ).rejects.toThrow()
  })

  it('must accept id and createdAt just in case (id)', async () => {
    const validMessage = {
      type: 'bot',
      text: 'This should pass',
      id: '12345',
    }

    await expect(
      messagesSchema.validateAsync([validMessage])
    ).resolves.not.toThrow()
  })

  it('must accept id and createdAt just in case (createdAt iso)', async () => {
    const validMessage = {
      type: 'bot',
      text: 'This should pass',
      createdAt: new Date().toISOString(),
    }

    await expect(
      messagesSchema.validateAsync([validMessage])
    ).resolves.not.toThrow()
  })

  it('must accept id and createdAt just in case (createdAt timestamp)', async () => {
    const validMessage = {
      type: 'bot',
      text: 'This should pass',
      createdAt: Date.now(),
    }

    await expect(
      messagesSchema.validateAsync([validMessage])
    ).resolves.not.toThrow()
  })
})
