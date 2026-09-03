import { schema } from '@/lib/joi.handler'

import secretIdSchema from '@/schemas/secretId'

describe('secretIdSchema', () => {
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
        secretId: secretIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { secretId: null }, { secretId: null })
      await validate(s, { secretId: '' }, { secretId: null })
      await validate(s, { secretId: '  ' }, { secretId: null })
    })
  })
})
