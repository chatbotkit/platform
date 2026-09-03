import { schema } from '@/lib/joi.handler'

import conversationIdSchema from '@/schemas/conversationId'

describe('conversationIdSchema', () => {
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
        conversationId: conversationIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { conversationId: null }, { conversationId: null })
      await validate(s, { conversationId: '' }, { conversationId: null })
      await validate(s, { conversationId: '  ' }, { conversationId: null })
    })
  })
})
