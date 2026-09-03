import { schema } from '@/lib/joi.handler'

import name2Schema from '@/schemas/name2'

describe('name2Schema', () => {
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
        name: name2Schema,
      })

      await validate(s, {}, {})
      await validate(s, { name: null }, { name: null })
      await validate(s, { name: '' }, { name: null })
      await validate(s, { name: '  ' }, { name: null })
    })
  })
})
