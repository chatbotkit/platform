import { schema } from '@/lib/joi.handler'

import description2Schema from '@/schemas/description2'

describe('description2Schema', () => {
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
        description: description2Schema,
      })

      await validate(s, {}, {})
      await validate(s, { description: null }, { description: null })
      await validate(s, { description: '' }, { description: null })
      await validate(s, { description: '  ' }, { description: null })
    })
  })
})
