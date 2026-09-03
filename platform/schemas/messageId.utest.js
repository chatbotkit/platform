import { schema } from '@/lib/joi.handler'

import messageIdSchema from '@/schemas/messageId'

describe('messageIdSchema', () => {
  describe('basic validation', () => {
    const validate = async (schema, input, expected) => {
      const response = await schema.validateAsync(input)

      expect(response).toEqual(expected)
    }

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should correctly handle falsy values', async () => {
      const s = schema.object({
        messageId: messageIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { messageId: null }, { messageId: null })
      await validate(s, { messageId: '' }, { messageId: null })
      await validate(s, { messageId: '  ' }, { messageId: null })
    })
  })
})
